import { google, gmail_v1 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { requiredEnv, intEnv, floatEnv } from "@/lib/env";
import { decryptText, encryptText } from "@/lib/security";
import { classifyEmail } from "@/lib/classifier";
import { saveCandidateAsApplicationWithAudit } from "@/lib/application-writer";
import { addSyncLog } from "@/lib/sync-log";
import {
  recordCandidateDecision,
  recordSkippedDecision,
  toJsonArray,
} from "@/lib/decision-log";
import type { User } from "@prisma/client";
import {
  shouldAutoIgnoreClassification,
  shouldTryAutoSaveClassification,
} from "@/lib/classification-policy";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type GmailMessageProcessResult =
  | "already_known"
  | "skipped_low_confidence"
  | "pending_review"
  | "auto_confirmed"
  | "created";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function getGoogleAuthUrl() {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
}

export async function exchangeCodeForUser(code: string) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const profile = await oauth2.userinfo.get();
  const email = profile.data.email;

  if (!email) throw new Error("Google account email was not returned.");

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      gmailAccessToken: encryptText(tokens.access_token),
      gmailRefreshToken: encryptText(tokens.refresh_token),
      gmailTokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    },
    update: {
      gmailAccessToken: encryptText(tokens.access_token),
      gmailRefreshToken: tokens.refresh_token
        ? encryptText(tokens.refresh_token)
        : undefined,
      gmailTokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    },
  });

  await addSyncLog(
    user.id,
    "gmail_connected",
    "Gmail account connected or reconnected.",
  );
  return user;
}

export async function getGmailClientForUser(user: User) {
  const accessToken = decryptText(user.gmailAccessToken);
  const refreshToken = decryptText(user.gmailRefreshToken);

  if (!accessToken && !refreshToken) {
    throw new Error("This user has not connected Gmail yet.");
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken ?? undefined,
    refresh_token: refreshToken ?? undefined,
    expiry_date: user.gmailTokenExpiry?.getTime(),
  });

  oauth2Client.on("tokens", async (tokens) => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        gmailAccessToken: tokens.access_token
          ? encryptText(tokens.access_token)
          : undefined,
        gmailRefreshToken: tokens.refresh_token
          ? encryptText(tokens.refresh_token)
          : undefined,
        gmailTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      },
    });
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

function decodeBase64Url(value?: string | null): string {
  if (!value) return "";
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function headerValue(message: gmail_v1.Schema$Message, name: string): string {
  return (
    message.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&zwnj;|&zwj;|&nbsp;|&shy;/gi, " ")
    .replace(/&middot;|&centerdot;/gi, "\u00b7")
    .replace(/&bull;|&bullet;/gi, "\u2022")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/[A-Za-z0-9+/=_-]{180,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeUnreadableBody(text: string): boolean {
  if (!text.trim()) return true;
  const longEncodedRuns = text.match(/[A-Za-z0-9+/=_-]{120,}/g)?.length ?? 0;
  const zwnjRuns = text.match(/&zwnj;/gi)?.length ?? 0;
  return longEncodedRuns >= 2 || zwnjRuns >= 5;
}

function extractBodyFromPayload(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";

  const mimeType = payload.mimeType ?? "";
  if (
    payload.body?.data &&
    (mimeType.includes("text/plain") || mimeType.includes("text/html"))
  ) {
    const decoded = decodeBase64Url(payload.body.data);
    const looksHtml = /<\s*html|<!doctype|<\s*body|<\s*div|<\s*p[\s>]/i.test(
      decoded,
    );
    return mimeType.includes("text/html") || looksHtml
      ? stripHtml(decoded)
      : decoded;
  }

  if (payload.parts?.length) {
    const plain = payload.parts
      .filter((part) => part.mimeType?.includes("text/plain"))
      .map(extractBodyFromPayload)
      .join("\n")
      .trim();

    // LinkedIn "application sent" emails ship a one-line text/plain stub while
    // the role/company card lives only in the HTML part. When the plain text is
    // too thin to hold those details, fall back to the richer HTML part.
    if (plain.length < 200) {
      const html = payload.parts
        .filter((part) => part.mimeType?.includes("text/html"))
        .map(extractBodyFromPayload)
        .join("\n")
        .trim();
      if (html.length > plain.length) return html;
    }

    if (plain) return plain;

    return payload.parts.map(extractBodyFromPayload).join("\n");
  }

  return "";
}

export function buildGmailSearchQueries(scanDays: number) {
  const dateFilter = `newer_than:${scanDays}d`;

  return [
    `("thank you for applying" OR "thanks for applying" OR "application received" OR "we received your application" OR "we've received your application" OR "successfully received your application" OR "successfully applied" OR "application submitted" OR "your application was sent" OR "your application has been sent" OR "we received your job application" OR "application has been sent" OR "your recent job application" OR "se ha enviado tu solicitud" OR "tu solicitud para el puesto" OR "solicitado el" OR "hemos recibido tu solicitud" OR "hemos recibido tu candidatura" OR "gracias por postularte" OR "candidatura recibida" OR "solicitud recibida") ${dateFilter}`,
    `("unfortunately" OR "we regret" OR "not moving forward" OR "not selected" OR "not be able to proceed" OR "decided to proceed with other candidates" OR "proceed with other candidates" OR "unsuccessful application" OR "no longer under consideration" OR "application has been unsuccessful" OR "will not be progressing your application" OR "shortlisting for this stage" OR "lamentablemente" OR "no has sido seleccionado" OR "no seguiremos adelante" OR "hemos decidido no seguir" OR "no seguir con tu proceso") ${dateFilter}`,
    `("schedule your interview" OR "book your interview" OR "interview request" OR "interview invitation" OR "interview invite" OR "interview process" OR "next interview" OR "introductory conversation" OR "introduction interview" OR "invitation from an unknown sender" OR "calendar invitation" OR Calendly OR "please complete" OR "complete your assessment" OR "complete your coding" OR "complete your video interview" OR "coding challenge" OR "technical assessment" OR "technical test" OR "prueba técnica" OR "prueba tecnica" OR entrevista OR HireVue OR HackerRank OR Codility OR CodeSignal OR TestGorilla) ${dateFilter}`,
    `("your application has been viewed" OR "your application has been read" OR "your application is in review" OR "your application for" OR "application for" OR "applied to" OR "applied for" OR "tu actualización de" OR "tu actualizacion de" OR "tu candidatura" OR "tu solicitud" OR candidatura OR postulación OR postulacion) ${dateFilter}`,
    `("move forward with the interview process" OR "next steps on your application" OR "take the next step" OR "AI-led interview" OR "AI led interview" OR "select a time" OR "Calendly link" OR Calendly OR "Zoom web conference" OR Zoom OR "Microsoft Teams" OR "Google Meet" OR "Add to calendar" OR "invitation from an unknown sender" OR "event name" OR "nombre del evento" OR "entrevista introductoria" OR "proceso de entrevista" OR "siguientes pasos" OR "confirma tu disponibilidad" OR "selecciona una hora") ${dateFilter}`,
    `("GetYourGuide Interview Request" OR "interview request" OR "introduction interview" OR "introductory conversation" OR "phone screen" OR "recruiter screen" OR "technical interview" OR "coding challenge" OR "online assessment" OR "assessment invitation" OR "prueba técnica" OR "prueba tecnica" OR "entrevista") ${dateFilter}`,
  ];
}

async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults: number,
): Promise<string[]> {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  return (
    (response.data.messages
      ?.map((message) => message.id)
      .filter(Boolean) as string[]) ?? []
  );
}

async function getMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  return response.data;
}

export async function processGmailMessageForUser(
  user: User,
  messageId: string,
  trigger: string = "manual",
): Promise<GmailMessageProcessResult> {
  const exists = await prisma.emailCandidate.findUnique({
    where: { gmailMessageId: messageId },
  });
  if (exists) return "already_known";

  const gmail = await getGmailClientForUser(user);
  const autoConfirmThreshold = Math.max(
    0,
    Math.min(1, floatEnv("AUTO_CONFIRM_CONFIDENCE", 0.72)),
  );

  const message = await getMessage(gmail, messageId);
  const subject = headerValue(message, "Subject");
  const from = headerValue(message, "From");
  // Emails the user sent themselves (replies in private threads, self-CCs) are
  // not job-application updates. Skip them before any classification.
  if (from && from.toLowerCase().includes(user.email.toLowerCase())) {
    await addSyncLog(
      user.id,
      `${trigger}_message_self_sent`,
      "Skipped Gmail message because it was sent by the user, not an application update.",
      { messageId, subject, from },
    );
    return "skipped_low_confidence";
  }
  const dateHeader = headerValue(message, "Date");
  const emailDate = dateHeader ? new Date(dateHeader) : null;
  const rawBody = extractBodyFromPayload(message.payload ?? undefined);
  const body = looksLikeUnreadableBody(rawBody)
    ? (message.snippet ?? rawBody)
    : rawBody;

  const classification = classifyEmail({
    from,
    subject,
    body,
    snippet: message.snippet ?? "",
    date: emailDate,
  });

  const shouldAutoIgnore = shouldAutoIgnoreClassification(classification);

  if (shouldAutoIgnore) {
    await addSyncLog(
      user.id,
      `${trigger}_message_skipped`,
      "Skipped Gmail message because it was low-confidence or clearly not a tracked application update.",
      {
        action: "skipped_not_relevant",
        applicationDelta: 0,
        taskDelta: 0,
        messageId,
        subject,
        from,
        status: classification.status,
        eventType: classification.eventType,
        taskType: classification.taskType,
        company: classification.company,
        position: classification.position,
        confidence: classification.confidence,
        summary: classification.summary,
      },
    );

    await recordSkippedDecision(
      user.id,
      {
        gmailMessageId: messageId,
        emailThreadId: message.threadId ?? null,
        emailSubject: subject || null,
        emailFrom: from || null,
        emailDate:
          emailDate && !Number.isNaN(emailDate.getTime()) ? emailDate : null,
      },
      classification,
      classification.summary,
      trigger,
    );

    return "skipped_low_confidence";
  }

  const canAutoConfirm = shouldTryAutoSaveClassification(
    classification,
    autoConfirmThreshold,
  );

  const candidate = await prisma.emailCandidate.create({
    data: {
      userId: user.id,
      gmailMessageId: messageId,
      emailThreadId: message.threadId ?? null,
      emailSubject: subject || null,
      emailFrom: from || null,
      emailDate:
        emailDate && !Number.isNaN(emailDate.getTime()) ? emailDate : null,
      snippet: message.snippet ?? null,
      bodyPreview: body.slice(0, 1200),
      company: classification.company,
      position: classification.position,
      status: classification.status,
      eventType: classification.eventType,
      taskType: classification.taskType,
      deadline: classification.deadline,
      summary: classification.summary,
      confidence: classification.confidence,
      reviewStatus: canAutoConfirm ? "CONFIRMED" : "PENDING",
      refIdsJson: toJsonArray(classification.refIds),
    },
  });

  if (canAutoConfirm) {
    const saveResult = await saveCandidateAsApplicationWithAudit(candidate, {
      trigger,
    });

    if (!saveResult.application) {
      await addSyncLog(
        user.id,
        `${trigger}_message_review`,
        "Gmail message was high confidence, but it could not be matched safely, so it was sent to Review Inbox.",
        {
          action: saveResult.action,
          applicationDelta: saveResult.applicationDelta,
          taskDelta: saveResult.taskDelta,
          matchedApplicationId: saveResult.matchedApplicationId,
          createdApplicationId: saveResult.createdApplicationId,
          reason: saveResult.reason,
          messageId,
          subject,
          from,
          status: classification.status,
          eventType: classification.eventType,
          taskType: classification.taskType,
          company: classification.company,
          position: classification.position,
          confidence: classification.confidence,
          summary: classification.summary,
        },
      );

      return "pending_review";
    }

    const application = saveResult.application;

    await addSyncLog(
      user.id,
      `${trigger}_message_saved`,
      "Gmail message auto-saved to tracker.",
      {
        action: saveResult.action,
        applicationDelta: saveResult.applicationDelta,
        taskDelta: saveResult.taskDelta,
        matchedApplicationId: saveResult.matchedApplicationId,
        createdApplicationId: saveResult.createdApplicationId,
        reason: saveResult.reason,
        messageId,
        subject,
        from,
        status: classification.status,
        eventType: classification.eventType,
        taskType: classification.taskType,
        company: application.company,
        position: application.position,
        confidence: classification.confidence,
      },
    );

    return "auto_confirmed";
  }
  await addSyncLog(
    user.id,
    `${trigger}_message_review`,
    "Gmail message sent to Review Inbox.",
    {
      action: "sent_to_review_needs_manual_confirmation",
      applicationDelta: 0,
      taskDelta: 0,
      matchedApplicationId: null,
      createdApplicationId: null,
      reason: "Email was job-related but was not safe enough to auto-save.",
      messageId,
      subject,
      from,
      status: classification.status,
      eventType: classification.eventType,
      taskType: classification.taskType,
      company: classification.company,
      position: classification.position,
      confidence: classification.confidence,
      summary: classification.summary,
    },
  );

  await recordCandidateDecision(
    candidate,
    "review_weak",
    "Email was job-related but was not safe enough to auto-save.",
    trigger,
  );

  return "pending_review";
}

export async function syncGmailForUser(
  user: User,
  scanDays: number,
  trigger = "manual_scan",
) {
  const gmail = await getGmailClientForUser(user);
  const maxEmails = intEnv("MAX_EMAILS_PER_SCAN", 100);
  const queries = buildGmailSearchQueries(scanDays);
  const ids = new Set<string>();

  for (const query of queries) {
    const result = await listMessageIds(
      gmail,
      query,
      Math.ceil(maxEmails / queries.length),
    );
    result.forEach((id) => ids.add(id));
  }

  let scanned = 0;
  let created = 0;
  let autoConfirmed = 0;
  let pendingReview = 0;
  let skippedLowConfidence = 0;
  let alreadyKnown = 0;

  for (const id of Array.from(ids).slice(0, maxEmails)) {
    scanned += 1;
    const result = await processGmailMessageForUser(user, id, trigger);

    if (result === "already_known") alreadyKnown += 1;
    if (result === "skipped_low_confidence") skippedLowConfidence += 1;
    if (result === "pending_review") {
      created += 1;
      pendingReview += 1;
    }
    if (result === "auto_confirmed") {
      created += 1;
      autoConfirmed += 1;
    }
    if (result === "created") created += 1;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSyncedAt: new Date() },
  });

  const result = {
    scanned,
    created,
    autoConfirmed,
    pendingReview,
    alreadyKnown,
    skippedLowConfidence,
    messageIdsFound: ids.size,
  };

  await addSyncLog(user.id, trigger, "Gmail scan completed.", result);

  return result;
}

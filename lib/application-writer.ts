import { prisma } from "@/lib/prisma";
import { addSyncLog } from "@/lib/sync-log";
import {
  canCreateNewApplication,
  getUnmatchedUpdateReviewReason,
} from "@/lib/classification-policy";
import type {
  Application,
  ApplicationStatus,
  EmailCandidate,
  EventType,
  TaskType,
} from "@prisma/client";
import {
  recordCandidateDecision,
  decisionOutcomeFromAction,
} from "@/lib/decision-log";

function clean(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(the|a|an|el|la|los|las|un|una)\b/g, " ")
    .replace(/\b(ltd|limited|inc|llc|plc|gmbh|s\.a\.?|s\.l\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

function similarity(a: string, b: string) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }

  return overlap / Math.max(left.size, right.size);
}

function isUnknown(value: string | null | undefined) {
  const normalized = normalize(value);
  return (
    !normalized ||
    normalized === "unknown company" ||
    normalized === "unknown position"
  );
}

function looksLikeRoleText(value: string | null | undefined) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return /\b(engineer|developer|software|backend|frontend|fullstack|data|machine learning|analyst|designer|product manager|graduate|junior|senior|intern)\b/i.test(
    normalized,
  );
}

function isLowQualityCompany(value: string | null | undefined) {
  const normalized = normalize(value);
  return (
    isUnknown(value) ||
    looksLikeRoleText(value) ||
    [
      "linkedin",
      "indeed",
      "totaljobs",
      "glassdoor",
      "efinancialcareers",
      "workday",
      "micro1",
      "broadbean",
      "jobs",
      "careers",
    ].includes(normalized)
  );
}

function isLowQualityPosition(value: string | null | undefined) {
  const normalized = normalize(value);
  return (
    isUnknown(value) ||
    normalized.includes("has been sent") ||
    normalized.includes("has been viewed") ||
    normalized.includes("application has been") ||
    normalized === "role" ||
    normalized === "position"
  );
}

function taskTitleFor(type: TaskType) {
  switch (type) {
    case "NORMAL_INTERVIEW":
      return "Prepare for interview";
    case "AI_INTERVIEW":
      return "Complete AI/video interview";
    case "CODING_TASK":
      return "Complete coding task";
    case "ASSESSMENT":
      return "Complete assessment";
    default:
      return "Complete job task";
  }
}

function shouldAutoCreateTask(
  eventType: EventType,
  taskType: TaskType | null,
  applicationStatus: ApplicationStatus,
) {
  if (!taskType) return false;
  if (["REJECTED", "WITHDRAWN"].includes(applicationStatus)) return false;
  return [
    "INTERVIEW_INVITE",
    "AI_INTERVIEW_INVITE",
    "CODING_TEST_RECEIVED",
    "ASSESSMENT_RECEIVED",
  ].includes(eventType);
}

async function closeTasksForTerminalApplication(
  applicationId: string,
  status: ApplicationStatus,
) {
  if (!["REJECTED", "WITHDRAWN"].includes(status)) return;

  await prisma.task.updateMany({
    where: { applicationId, status: "TODO" },
    data: { status: "CANCELLED" },
  });
}

function isTaskCompletionCandidate(candidate: EmailCandidate) {
  return (candidate.summary ?? "")
    .toLowerCase()
    .includes("task completion confirmation");
}

async function markTasksDoneForCompletion(applicationId: string) {
  await prisma.task.updateMany({
    where: { applicationId, status: "TODO" },
    data: { status: "DONE" },
  });
}

const statusPriority: Record<ApplicationStatus, number> = {
  UNKNOWN: 0,
  APPLIED: 1,
  INTERVIEW: 2,
  AI_INTERVIEW: 2,
  CODING_TASK: 2,
  ASSESSMENT: 2,
  OFFER: 3,
  REJECTED: 4,
  WITHDRAWN: 4,
};

async function shouldUpdateStatus(
  applicationId: string,
  incomingDate: Date | null,
  incomingStatus: ApplicationStatus,
) {
  if (incomingStatus === "UNKNOWN") return false;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });

  if (!application) return true;

  // Never downgrade a later-stage application back to APPLIED just because a platform
  // sends a delayed confirmation email.
  if (statusPriority[incomingStatus] < statusPriority[application.status])
    return false;

  const latestEvent = await prisma.applicationEvent.findFirst({
    where: { applicationId, emailDate: { not: null } },
    orderBy: { emailDate: "desc" },
    select: { emailDate: true },
  });

  if (!latestEvent?.emailDate || !incomingDate) return true;
  return incomingDate.getTime() >= latestEvent.emailDate.getTime();
}

async function findApplicationByThread(candidate: EmailCandidate) {
  if (!candidate.emailThreadId) return null;

  const previousCandidate = await prisma.emailCandidate.findFirst({
    where: {
      userId: candidate.userId,
      emailThreadId: candidate.emailThreadId,
      applicationId: { not: null },
      gmailMessageId: { not: candidate.gmailMessageId },
    },
    orderBy: { emailDate: "desc" },
    include: { application: true },
  });

  return previousCandidate?.application ?? null;
}

function normalizeEmailAddress(value: string | null | undefined) {
  const match = (value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function senderDomain(value: string | null | undefined) {
  const email = normalizeEmailAddress(value);
  if (!email) return null;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  return domain.replace(/^mail\./, "").replace(/^email\./, "");
}

function isGenericSenderDomain(domain: string | null) {
  if (!domain) return true;

  return [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "yahoo.com",
    "linkedin.com",
    "indeed.com",
    "totaljobs.com",
    "glassdoor.com",
    "reed.co.uk",
    "greenhouse.io",
    "lever.co",
    "ashbyhq.com",
    "workday.com",
    "myworkdayjobs.com",
    "smartrecruiters.com",
    "broadbean.com",
  ].some((generic) => domain === generic || domain.endsWith(`.${generic}`));
}

function textIncludesNormalized(
  haystack: string,
  needle: string | null | undefined,
) {
  const normalizedNeedle = normalize(needle);
  if (!normalizedNeedle || normalizedNeedle.length < 4) return false;
  return normalize(haystack).includes(normalizedNeedle);
}

function evidenceTextForCandidate(candidate: EmailCandidate) {
  return [
    candidate.emailSubject,
    candidate.emailFrom,
    candidate.snippet,
    candidate.bodyPreview,
    candidate.company,
    candidate.position,
    candidate.summary,
  ]
    .filter(Boolean)
    .join(" ");
}

type MatchScore = {
  application: Application;
  score: number;
  reasons: string[];
};

function addScore(match: MatchScore, points: number, reason: string) {
  match.score += points;
  match.reasons.push(reason);
}

async function findApplicationBySimilarity(
  candidate: EmailCandidate,
  company: string,
  position: string,
): Promise<Application | null> {
  const applications = await prisma.application.findMany({
    where: { userId: candidate.userId },
    orderBy: { updatedAt: "desc" },
  });

  const companyNorm = normalize(company);
  const positionNorm = normalize(position);
  const incomingIsApplicationConfirmation =
    candidate.eventType === "APPLICATION_CONFIRMED";
  const incomingIsFollowUp = !incomingIsApplicationConfirmation;
  const activeApplications = applications.filter(
    (app) => !["REJECTED", "WITHDRAWN"].includes(app.status),
  );
  const pool = incomingIsFollowUp ? activeApplications : applications;

  // Application confirmations must be matched very strictly.
  // They should only match an existing application when they look like the same exact job.
  // Do not use fuzzy matching for APPLICATION_CONFIRMED because that causes separate
  // Totaljobs/Broadbean confirmations to stack under one application.
  if (incomingIsApplicationConfirmation) {
    if (!isUnknown(position)) {
      const exactRoleMatches = activeApplications.filter(
        (app) => normalize(app.position) === positionNorm,
      );

      const exactCompanyAndRoleMatch = exactRoleMatches.find(
        (app) =>
          !isLowQualityCompany(company) &&
          !isLowQualityCompany(app.company) &&
          normalize(app.company) === companyNorm,
      );

      if (exactCompanyAndRoleMatch) return exactCompanyAndRoleMatch;

      const lowQualityCompanyRoleMatches = exactRoleMatches.filter(
        (app) =>
          isLowQualityCompany(company) && isLowQualityCompany(app.company),
      );

      if (lowQualityCompanyRoleMatches.length === 1) {
        return lowQualityCompanyRoleMatches[0];
      }
    }

    return null;
  }

  const applicationIds = pool.map((application) => application.id);

  const previousCandidates =
    applicationIds.length > 0
      ? await prisma.emailCandidate.findMany({
          where: {
            userId: candidate.userId,
            applicationId: { in: applicationIds },
            id: { not: candidate.id },
          },
          orderBy: [{ emailDate: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : [];

  const previousEvents =
    applicationIds.length > 0
      ? await prisma.applicationEvent.findMany({
          where: {
            applicationId: { in: applicationIds },
          },
          orderBy: [{ emailDate: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : [];

  const candidatesByApplication = new Map<string, EmailCandidate[]>();
  for (const previousCandidate of previousCandidates) {
    if (!previousCandidate.applicationId) continue;

    const existing =
      candidatesByApplication.get(previousCandidate.applicationId) ?? [];
    existing.push(previousCandidate);
    candidatesByApplication.set(previousCandidate.applicationId, existing);
  }

  const eventsByApplication = new Map<string, typeof previousEvents>();
  for (const previousEvent of previousEvents) {
    const existing = eventsByApplication.get(previousEvent.applicationId) ?? [];
    existing.push(previousEvent);
    eventsByApplication.set(previousEvent.applicationId, existing);
  }

  const incomingText = evidenceTextForCandidate(candidate);
  const incomingDomain = senderDomain(candidate.emailFrom);

  const scored: MatchScore[] = pool.map((application) => {
    const match: MatchScore = {
      application,
      score: 0,
      reasons: [],
    };

    const appCompanyNorm = normalize(application.company);
    const appPositionNorm = normalize(application.position);
    const previousForApp = candidatesByApplication.get(application.id) ?? [];
    const eventsForApp = eventsByApplication.get(application.id) ?? [];

    const companyExact =
      !isUnknown(company) &&
      !isLowQualityCompany(company) &&
      !isLowQualityCompany(application.company) &&
      appCompanyNorm === companyNorm;

    const positionExact =
      !isUnknown(position) &&
      !isLowQualityPosition(position) &&
      !isLowQualityPosition(application.position) &&
      appPositionNorm === positionNorm;

    const positionSimilarity = similarity(application.position, position);
    const companySimilarity = similarity(application.company, company);

    if (companyExact && positionExact) {
      addScore(match, 100, "exact company and exact role");
    }

    if (companyExact && positionSimilarity >= 0.55) {
      addScore(match, 82, "exact company and similar role");
    }

    if (positionExact && companySimilarity >= 0.5) {
      addScore(match, 78, "exact role and similar company");
    }

    if (
      !isUnknown(position) &&
      isLowQualityCompany(application.company) &&
      positionSimilarity >= 0.68
    ) {
      addScore(
        match,
        72,
        "existing application has low-quality company and role matches",
      );
    }

    if (
      !isUnknown(company) &&
      isLowQualityPosition(application.position) &&
      companyExact
    ) {
      addScore(
        match,
        70,
        "existing application has low-quality role and company matches",
      );
    }

    if (
      !isUnknown(company) &&
      textIncludesNormalized(incomingText, application.company) &&
      positionSimilarity >= 0.55
    ) {
      addScore(
        match,
        74,
        "incoming email text mentions application company and role is similar",
      );
    }

    if (
      !isUnknown(position) &&
      textIncludesNormalized(incomingText, application.position)
    ) {
      addScore(match, 58, "incoming email text mentions application role");
    }

    for (const previousCandidate of previousForApp) {
      const previousText = evidenceTextForCandidate(previousCandidate);
      const previousDomain = senderDomain(previousCandidate.emailFrom);

      if (
        candidate.emailThreadId &&
        previousCandidate.emailThreadId &&
        candidate.emailThreadId === previousCandidate.emailThreadId
      ) {
        addScore(match, 95, "same Gmail thread as previous linked candidate");
      }

      if (
        incomingDomain &&
        previousDomain &&
        incomingDomain === previousDomain &&
        !isGenericSenderDomain(incomingDomain)
      ) {
        addScore(
          match,
          35,
          "same useful sender domain as previous linked candidate",
        );
      }

      if (
        !isUnknown(position) &&
        previousCandidate.position &&
        similarity(previousCandidate.position, position) >= 0.72
      ) {
        addScore(match, 55, "role similar to previous linked candidate");
      }

      if (
        !isUnknown(company) &&
        previousCandidate.company &&
        !isLowQualityCompany(previousCandidate.company) &&
        similarity(previousCandidate.company, company) >= 0.72
      ) {
        addScore(match, 55, "company similar to previous linked candidate");
      }

      if (
        !isUnknown(position) &&
        textIncludesNormalized(previousText, position)
      ) {
        addScore(
          match,
          35,
          "previous linked email text contains incoming role",
        );
      }

      if (
        !isUnknown(company) &&
        textIncludesNormalized(previousText, company)
      ) {
        addScore(
          match,
          35,
          "previous linked email text contains incoming company",
        );
      }
    }

    for (const previousEvent of eventsForApp) {
      const previousEventText = [
        previousEvent.emailSubject,
        previousEvent.emailFrom,
        previousEvent.summary,
      ]
        .filter(Boolean)
        .join(" ");

      if (
        !isUnknown(position) &&
        textIncludesNormalized(previousEventText, position)
      ) {
        addScore(match, 25, "previous timeline event contains incoming role");
      }

      if (
        !isUnknown(company) &&
        textIncludesNormalized(previousEventText, company)
      ) {
        addScore(
          match,
          25,
          "previous timeline event contains incoming company",
        );
      }
    }

    return match;
  });

  const sorted = scored
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = sorted[0];
  const second = sorted[1];

  if (!best) return null;

  const minimumScore =
    candidate.eventType === "REJECTION_RECEIVED" ||
    candidate.eventType === "INTERVIEW_INVITE" ||
    candidate.eventType === "AI_INTERVIEW_INVITE" ||
    candidate.eventType === "CODING_TEST_RECEIVED" ||
    candidate.eventType === "ASSESSMENT_RECEIVED"
      ? 72
      : 76;

  const secondScore = second?.score ?? 0;
  const scoreGap = best.score - secondScore;

  // Accept very strong matches immediately.
  // Otherwise require the best match to clearly beat the second-best match.
  if (best.score >= 95) return best.application;

  if (best.score >= minimumScore && scoreGap >= 10) {
    return best.application;
  }

  return null;
}

export type SaveCandidateAction =
  | "created_new_application"
  | "created_new_application_manual_review"
  | "updated_existing_application"
  | "sent_to_review_unmatched_update";

export type SaveCandidateOptions = {
  allowCreateFromReview?: boolean;
  forceApplicationId?: string | null;
  trigger?: string;
};

export type SaveCandidateResult = {
  application: Application | null;
  action: SaveCandidateAction;
  applicationDelta: 0 | 1;
  taskDelta: 0 | 1;
  matchedApplicationId: string | null;
  createdApplicationId: string | null;
  reason: string;
};

export async function saveCandidateAsApplicationWithAudit(
  candidate: EmailCandidate,
  options: SaveCandidateOptions = {},
): Promise<SaveCandidateResult> {
  const allowCreateFromReview = options.allowCreateFromReview === true;
  const trigger = options.trigger ?? "save";
  const forcedApplication = options.forceApplicationId
    ? await prisma.application.findFirst({
        where: {
          id: options.forceApplicationId,
          userId: candidate.userId,
        },
      })
    : null;

  const incomingCompany = clean(candidate.company, "Unknown company");
  const incomingPosition = clean(candidate.position, "Unknown position");

  const threadMatch =
    candidate.eventType === "APPLICATION_CONFIRMED"
      ? null
      : await findApplicationByThread(candidate);
  const similarityMatch =
    forcedApplication ??
    threadMatch ??
    (await findApplicationBySimilarity(
      candidate,
      incomingCompany,
      incomingPosition,
    ));

  const company =
    similarityMatch && isUnknown(incomingCompany)
      ? similarityMatch.company
      : incomingCompany;
  const position =
    similarityMatch && isUnknown(incomingPosition)
      ? similarityMatch.position
      : incomingPosition;

  const taskCompletion = isTaskCompletionCandidate(candidate);

  if (
    !similarityMatch &&
    !allowCreateFromReview &&
    !canCreateNewApplication(candidate.eventType)
  ) {
    const reason = getUnmatchedUpdateReviewReason(candidate.eventType);

    await prisma.emailCandidate.update({
      where: { id: candidate.id },
      data: {
        applicationId: null,
        reviewStatus: "PENDING",
      },
    });

    const result: SaveCandidateResult = {
      application: null,
      action: "sent_to_review_unmatched_update",
      applicationDelta: 0,
      taskDelta: 0,
      matchedApplicationId: null,
      createdApplicationId: null,
      reason,
    };

    await addSyncLog(
      candidate.userId,
      "message_review",
      "Unmatched job update was sent to Review Inbox instead of creating a new application.",
      {
        action: result.action,
        applicationDelta: result.applicationDelta,
        taskDelta: result.taskDelta,
        matchedApplicationId: result.matchedApplicationId,
        createdApplicationId: result.createdApplicationId,
        reason: result.reason,
        messageId: candidate.gmailMessageId,
        subject: candidate.emailSubject,
        from: candidate.emailFrom,
        company: candidate.company,
        position: candidate.position,
        status: candidate.status,
        eventType: candidate.eventType,
        taskType: candidate.taskType,
        confidence: candidate.confidence,
      },
    );

    await recordCandidateDecision(
      candidate,
      "review_unmatched",
      result.reason,
      trigger,
      result.matchedApplicationId,
    );

    return result;
  }

  const createdNewApplication = !similarityMatch;

  const application = similarityMatch
    ? await prisma.application.update({
        where: { id: similarityMatch.id },
        data: {
          ...(taskCompletion &&
          !["REJECTED", "WITHDRAWN"].includes(similarityMatch.status)
            ? { status: "APPLIED" as ApplicationStatus }
            : (await shouldUpdateStatus(
                  similarityMatch.id,
                  candidate.emailDate,
                  candidate.status,
                ))
              ? { status: candidate.status }
              : {}),
          // Improve Unknown fields when a later email contains better extracted data.
          ...(isLowQualityCompany(similarityMatch.company) &&
          !isUnknown(company)
            ? { company }
            : {}),
          ...(isLowQualityPosition(similarityMatch.position) &&
          !isUnknown(position)
            ? { position }
            : {}),
        },
      })
    : await prisma.application.create({
        data: {
          userId: candidate.userId,
          company,
          position,
          status: candidate.status,
          source: "gmail",
        },
      });

  const existingEvent = await prisma.applicationEvent.findFirst({
    where: {
      applicationId: application.id,
      gmailMessageId: candidate.gmailMessageId,
    },
  });

  const existingApplicationConfirmationEvent =
    candidate.eventType === "APPLICATION_CONFIRMED"
      ? await prisma.applicationEvent.findFirst({
          where: {
            applicationId: application.id,
            type: "APPLICATION_CONFIRMED",
          },
        })
      : null;

  if (!existingEvent && !existingApplicationConfirmationEvent) {
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: candidate.eventType,
        emailSubject: candidate.emailSubject,
        emailFrom: candidate.emailFrom,
        emailDate: candidate.emailDate,
        gmailMessageId: candidate.gmailMessageId,
        summary: candidate.summary,
        confidence: candidate.confidence,
        deadline: candidate.deadline,
      },
    });
  }

  await closeTasksForTerminalApplication(application.id, application.status);

  if (taskCompletion) {
    await markTasksDoneForCompletion(application.id);
  }

  let taskDelta: 0 | 1 = 0;

  if (
    shouldAutoCreateTask(
      candidate.eventType,
      candidate.taskType,
      application.status,
    )
  ) {
    const title = taskTitleFor(candidate.taskType as TaskType);
    const duplicateTask = await prisma.task.findFirst({
      where: {
        applicationId: application.id,
        type: candidate.taskType as TaskType,
        status: { in: ["TODO", "DONE"] },
        title,
      },
    });

    if (!duplicateTask) {
      await prisma.task.create({
        data: {
          applicationId: application.id,
          type: candidate.taskType as TaskType,
          title,
          deadline: candidate.deadline,
        },
      });

      taskDelta = 1;
    }
  }

  await prisma.emailCandidate.update({
    where: { id: candidate.id },
    data: {
      applicationId: application.id,
      company: application.company,
      position: application.position,
      reviewStatus: "CONFIRMED",
    },
  });

  const result: SaveCandidateResult = {
    application,
    action: createdNewApplication
      ? allowCreateFromReview && !canCreateNewApplication(candidate.eventType)
        ? "created_new_application_manual_review"
        : "created_new_application"
      : "updated_existing_application",
    applicationDelta: createdNewApplication ? 1 : 0,
    taskDelta,
    matchedApplicationId: similarityMatch?.id ?? null,
    createdApplicationId: createdNewApplication ? application.id : null,
    reason: createdNewApplication
      ? allowCreateFromReview && !canCreateNewApplication(candidate.eventType)
        ? "User manually confirmed this Review Inbox item, so it was allowed to create a new application."
        : "Email was classified as APPLICATION_CONFIRMED, so it was allowed to create a new application."
      : "Email matched an existing application.",
  };

  await addSyncLog(
    candidate.userId,
    createdNewApplication ? "application_created" : "application_updated",
    createdNewApplication
      ? "Created new application from Gmail email."
      : "Updated existing application from Gmail email.",
    {
      action: result.action,
      applicationDelta: result.applicationDelta,
      taskDelta: result.taskDelta,
      matchedApplicationId: result.matchedApplicationId,
      createdApplicationId: result.createdApplicationId,
      reason: result.reason,
      messageId: candidate.gmailMessageId,
      subject: candidate.emailSubject,
      from: candidate.emailFrom,
      company: application.company,
      position: application.position,
      status: application.status,
      eventType: candidate.eventType,
      taskType: candidate.taskType,
      confidence: candidate.confidence,
    },
  );

  await recordCandidateDecision(
    candidate,
    decisionOutcomeFromAction(result.action),
    result.reason,
    trigger,
    result.matchedApplicationId,
  );

  return result;
}

export async function saveCandidateAsApplication(
  candidate: EmailCandidate,
): Promise<Application> {
  const result = await saveCandidateAsApplicationWithAudit(candidate);

  if (!result.application) {
    throw new Error(result.reason);
  }

  return result.application;
}

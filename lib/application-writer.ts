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
  // Do not group separate "application has been sent" emails just because
  // Gmail threaded them together, the company is Unknown/Broadbean/Totaljobs,
  // or the roles look vaguely similar.
  if (incomingIsApplicationConfirmation) {
    if (
      !isUnknown(company) &&
      !isLowQualityCompany(company) &&
      !isUnknown(position)
    ) {
      const exactDuplicate = activeApplications.find(
        (app) =>
          normalize(app.company) === companyNorm &&
          normalize(app.position) === positionNorm,
      );

      if (exactDuplicate) return exactDuplicate;
    }

    return null;
  }

  // 1) Exact normalized company + position match.
  let match = pool.find(
    (app) =>
      normalize(app.company) === companyNorm &&
      normalize(app.position) === positionNorm,
  );
  if (match) return match;

  // 2) Same company and similar role text.
  match = pool.find(
    (app) =>
      normalize(app.company) === companyNorm &&
      similarity(app.position, position) >= 0.55,
  );
  if (match) return match;

  // 3) Existing app had an unknown/bad company, but the role matches. This fixes
  // job-board flows where the confirmation only says the role, then a later email
  // reveals the employer.
  if (!isUnknown(position)) {
    match = pool.find(
      (app) =>
        isLowQualityCompany(app.company) &&
        similarity(app.position, position) >= 0.55,
    );
    if (match) return match;
  }

  // 4) Existing app had an unknown/bad role, but the company matches.
  if (!isUnknown(company)) {
    match = pool.find(
      (app) =>
        normalize(app.company) === companyNorm &&
        isLowQualityPosition(app.position),
    );
    if (match) return match;
  }

  // 5) For follow-ups, use a stricter one-and-only role match even when the company
  // differs. This catches LinkedIn/recruiter follow-ups that use a recruiter sender
  // but mention the same role.
  if (incomingIsFollowUp && !isUnknown(position)) {
    const roleMatches = pool.filter(
      (app) => similarity(app.position, position) >= 0.68,
    );
    if (roleMatches.length === 1) return roleMatches[0];
  }

  // 6) If the incoming email only has company, only link automatically when there
  // is exactly one existing application for that company.
  if (isUnknown(position)) {
    const companyMatches = pool.filter(
      (app) => normalize(app.company) === companyNorm,
    );
    if (companyMatches.length === 1) return companyMatches[0];
  }

  // 7) If the incoming email only has position, only link automatically when there
  // is exactly one strong role match. This helps LinkedIn/job board follow-ups.
  if (isUnknown(company)) {
    const roleMatches = pool.filter(
      (app) => similarity(app.position, position) >= 0.75,
    );
    if (roleMatches.length === 1) return roleMatches[0];
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

  const incomingCompany = clean(candidate.company, "Unknown company");
  const incomingPosition = clean(candidate.position, "Unknown position");

  const threadMatch =
    candidate.eventType === "APPLICATION_CONFIRMED"
      ? null
      : await findApplicationByThread(candidate);
  const similarityMatch =
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

import type { Classification } from "@/lib/classifier";

export const CREATE_NEW_APPLICATION_EVENT_TYPES = new Set([
  "APPLICATION_CONFIRMED",
]);

export const EXISTING_APPLICATION_EVENT_TYPES = new Set([
  "FOLLOW_UP",
  "APPLICATION_VIEWED",
  "GENERAL_UPDATE",
  "REJECTION_RECEIVED",
  "INTERVIEW_INVITE",
  "ASSESSMENT_RECEIVED",
  "CODING_TEST_RECEIVED",
  "AI_INTERVIEW_INVITE",
  "OFFER_RECEIVED",
  "TASK_COMPLETED",
]);

const AUTO_SAVE_EVENT_TYPES = new Set([
  "APPLICATION_CONFIRMED",
  "FOLLOW_UP",
  "APPLICATION_VIEWED",
  "REJECTION_RECEIVED",
  "INTERVIEW_INVITE",
  "ASSESSMENT_RECEIVED",
  "CODING_TEST_RECEIVED",
  "AI_INTERVIEW_INVITE",
  "OFFER_RECEIVED",
  "TASK_COMPLETED",
]);

export function canCreateNewApplication(eventType: string | null | undefined) {
  if (!eventType) return false;
  return CREATE_NEW_APPLICATION_EVENT_TYPES.has(eventType);
}

export function mustMatchExistingApplication(
  eventType: string | null | undefined,
) {
  if (!eventType) return false;
  return EXISTING_APPLICATION_EVENT_TYPES.has(eventType);
}

export function getUnmatchedUpdateReviewReason(
  eventType: string | null | undefined,
) {
  switch (eventType) {
    case "FOLLOW_UP":
      return "Follow-up email could not be matched to an existing application.";
    case "APPLICATION_VIEWED":
      return "Application-viewed email could not be matched to an existing application.";
    case "GENERAL_UPDATE":
      return "General job update could not be matched to an existing application.";
    case "REJECTION_RECEIVED":
      return "Rejection email could not be matched to an existing application.";
    case "INTERVIEW_INVITE":
      return "Interview email could not be matched to an existing application.";
    case "ASSESSMENT_RECEIVED":
      return "Assessment email could not be matched to an existing application.";
    case "CODING_TEST_RECEIVED":
      return "Coding test email could not be matched to an existing application.";
    case "AI_INTERVIEW_INVITE":
      return "AI interview email could not be matched to an existing application.";
    case "OFFER_RECEIVED":
      return "Offer email could not be matched to an existing application.";
    case "TASK_COMPLETED":
      return "Task-completion email could not be matched to an existing application.";
    default:
      return "Job-related email could not be matched to an existing application.";
  }
}

export function hasEnoughIdentityForAutomation(classification: Classification) {
  return Boolean(classification.company || classification.position);
}

export function shouldAutoIgnoreClassification(classification: Classification) {
  const summary = classification.summary.toLowerCase();

  if (classification.confidence < 0.34) return true;

  if (
    summary.includes("job alert") ||
    summary.includes("job recommendation") ||
    summary.includes("recommendation detected") ||
    summary.includes("not an application update") ||
    summary.includes("not a tracked application update")
  ) {
    return true;
  }

  if (
    classification.status === "UNKNOWN" &&
    classification.eventType === "GENERAL_UPDATE" &&
    !classification.company &&
    !classification.position &&
    classification.confidence < 0.55
  ) {
    return true;
  }

  return false;
}

export function shouldTryAutoSaveClassification(
  classification: Classification,
  threshold = 0.72,
) {
  if (shouldAutoIgnoreClassification(classification)) return false;
  if (!hasEnoughIdentityForAutomation(classification)) return false;
  if (!AUTO_SAVE_EVENT_TYPES.has(classification.eventType)) return false;

  if (classification.eventType === "APPLICATION_CONFIRMED") {
    return classification.confidence >= Math.min(0.68, threshold);
  }

  return classification.confidence >= threshold;
}

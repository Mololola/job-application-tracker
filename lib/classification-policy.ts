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

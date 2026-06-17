import { prisma } from "@/lib/prisma";
import type {
  ApplicationStatus,
  EmailCandidate,
  EventType,
  TaskType,
} from "@prisma/client";

/**
 * Observability layer for the email -> classification -> matching -> routing
 * pipeline. The matcher already computes evidence (reasons[], best/second/gap)
 * and then throws it away by returning `Application | null`. This module gives
 * that evidence a place to live so every routing decision is explainable on a
 * /debug/decisions page and usable as a test oracle.
 *
 * Design mirrors lib/sync-log.ts: writes are best-effort and must NEVER break
 * Gmail sync, and we cap retention to keep the local SQLite db small.
 */

// What ultimately happened to the email.
export type DecisionOutcome =
  | "created" // new application created (APPLICATION_CONFIRMED only)
  | "auto_confirmed" // matched + auto-linked to an existing application
  | "linked" // linked to an existing application
  | "review_ambiguous" // strong match but two close candidates -> Review
  | "review_weak" // weak single candidate -> Review
  | "review_unmatched" // concrete event, no candidate -> Review
  | "ignored"; // auto-ignored as noise / low confidence

// One weighted reason contributing to a match score.
export interface DecisionEvidence {
  feature: string; // e.g. "exact company and exact role", "ref_id_exact"
  weight: number; // points contributed (your matcher uses a 0..100+ scale)
  detail?: string; // human-readable ("ref JR-44821 == JR-44821")
}

// A single candidate application the email was scored against.
export interface DecisionMatchCandidate {
  applicationId: string;
  company: string | null;
  position: string | null;
  score: number;
  evidence: DecisionEvidence[];
}

// The full, structured trace persisted as JSON in DecisionLog.trace.
export interface DecisionTrace {
  email: {
    gmailMessageId?: string | null;
    emailThreadId?: string | null;
    emailSubject?: string | null;
    emailFrom?: string | null;
    emailDate?: Date | string | null;
  };

  // Optional relevance gate (populate once lib/relevance.ts exists).
  relevance?: {
    class: "LIFECYCLE" | "NOISE" | "AMBIGUOUS";
    lifecycleScore: number;
    noiseScore: number;
    override?: string;
    signals: DecisionEvidence[];
  };

  classification: {
    eventType: EventType;
    status: ApplicationStatus;
    taskType: TaskType | null;
    confidence: number;
    summary: string;
    signals?: DecisionEvidence[];
  };

  extraction: {
    company: string | null;
    position: string | null;
    refIds: string[];
    deadline?: Date | string | null;
  };

  // Populated for non-confirmation events that go through the matcher.
  matching?: {
    candidates: DecisionMatchCandidate[]; // sorted desc by score
    bestApplicationId: string | null;
    bestScore: number;
    secondScore: number;
    gap: number;
  };

  decision: DecisionOutcome;
  reason: string;
  trigger: string;
}

// ---------------------------------------------------------------------------
// JSON array helpers (SQLite has no scalar lists; arrays are JSON strings).
// ---------------------------------------------------------------------------

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function toJsonArray(
  values: Iterable<string> | null | undefined,
): string | null {
  const arr = Array.from(values ?? []).filter(
    (v) => typeof v === "string" && v.length > 0,
  );
  const unique = Array.from(new Set(arr));
  return unique.length > 0 ? JSON.stringify(unique) : null;
}

// Keep at most this many decision logs per user (tunable; this is local/personal).
const MAX_DECISION_LOGS_PER_USER = 2000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Persist a decision trace. Denormalizes the headline fields onto columns for
 * fast filtering, and stores the full trace as JSON for the debug page.
 * Best-effort: any failure is swallowed so it can never break Gmail sync.
 */
export async function recordDecisionLog(
  userId: string,
  trace: DecisionTrace,
): Promise<void> {
  try {
    const matching = trace.matching;

    await prisma.decisionLog.create({
      data: {
        userId,
        gmailMessageId: trace.email.gmailMessageId ?? null,
        emailThreadId: trace.email.emailThreadId ?? null,
        emailSubject: trace.email.emailSubject ?? null,
        emailFrom: trace.email.emailFrom ?? null,
        emailDate: toDate(trace.email.emailDate),

        decision: trace.decision,
        reason: trace.reason?.slice(0, 500) ?? null,
        trigger: trace.trigger,

        eventType: trace.classification.eventType,
        status: trace.classification.status,
        confidence: trace.classification.confidence,

        company: trace.extraction.company,
        position: trace.extraction.position,
        refIdsJson: toJsonArray(trace.extraction.refIds),

        matchedApplicationId: matching?.bestApplicationId ?? null,
        bestScore: matching?.bestScore ?? null,
        secondScore: matching?.secondScore ?? null,
        scoreGap: matching?.gap ?? null,

        // Cap the JSON blob so a pathological email can't bloat the row.
        trace: JSON.stringify(trace).slice(0, 20000),
      },
    });

    const stale = await prisma.decisionLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: MAX_DECISION_LOGS_PER_USER,
      select: { id: true },
    });

    if (stale.length > 0) {
      await prisma.decisionLog.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
  } catch (error) {
    // Logging must never break Gmail sync.
    console.error("Failed to write decision log", error);
  }
}

// Map the save function's action string to a decision outcome.
export function decisionOutcomeFromAction(action: string): DecisionOutcome {
  switch (action) {
    case "created_new_application":
    case "created_new_application_manual_review":
      return "created";
    case "updated_existing_application":
      return "linked";
    case "sent_to_review_unmatched_update":
      return "review_unmatched";
    default:
      return "review_weak";
  }
}

// Log a decision when we have a saved EmailCandidate row (most call sites).
export async function recordCandidateDecision(
  candidate: EmailCandidate,
  outcome: DecisionOutcome,
  reason: string,
  trigger: string,
  matchedApplicationId: string | null = null,
): Promise<void> {
  await recordDecisionLog(candidate.userId, {
    email: {
      gmailMessageId: candidate.gmailMessageId,
      emailThreadId: candidate.emailThreadId,
      emailSubject: candidate.emailSubject,
      emailFrom: candidate.emailFrom,
      emailDate: candidate.emailDate,
    },
    classification: {
      eventType: candidate.eventType,
      status: candidate.status,
      taskType: candidate.taskType,
      confidence: candidate.confidence,
      summary: candidate.summary ?? "",
    },
    extraction: {
      company: candidate.company,
      position: candidate.position,
      refIds: parseJsonArray(candidate.refIdsJson),
    },
    // Real match scores are added in the next pass; for now we just record
    // which application (if any) the email linked to.
    matching: matchedApplicationId
      ? {
          candidates: [],
          bestApplicationId: matchedApplicationId,
          bestScore: 0,
          secondScore: 0,
          gap: 0,
        }
      : undefined,
    decision: outcome,
    reason,
    trigger,
  });
}

// Log a decision when the email was skipped before any candidate row was created.
export async function recordSkippedDecision(
  userId: string,
  email: {
    gmailMessageId?: string | null;
    emailThreadId?: string | null;
    emailSubject?: string | null;
    emailFrom?: string | null;
    emailDate?: Date | string | null;
  },
  classification: {
    eventType: EventType;
    status: ApplicationStatus;
    taskType: TaskType | null;
    confidence: number;
    summary: string;
    company: string | null;
    position: string | null;
  },
  reason: string,
  trigger: string,
): Promise<void> {
  await recordDecisionLog(userId, {
    email,
    classification: {
      eventType: classification.eventType,
      status: classification.status,
      taskType: classification.taskType,
      confidence: classification.confidence,
      summary: classification.summary,
    },
    extraction: {
      company: classification.company,
      position: classification.position,
      refIds: [],
    },
    decision: "ignored",
    reason,
    trigger,
  });
}

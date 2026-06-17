import { prisma } from "@/lib/prisma";
import { saveCandidateAsApplicationWithAudit } from "@/lib/application-writer";
import type { ApplicationStatus, EventType, TaskType } from "@prisma/client";

function normalize(value: FormDataEntryValue | null): string | null {
  const text = value?.toString().trim();
  return text ? text : null;
}

function normalizeDate(value: FormDataEntryValue | null): Date | null {
  const text = normalize(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function confirmCandidateFromForm(formData: FormData) {
  const candidateId = normalize(formData.get("candidateId"));
  if (!candidateId) throw new Error("Missing candidateId");

  const candidate = await prisma.emailCandidate.findUnique({
    where: { id: candidateId },
  });
  if (!candidate) throw new Error("Candidate not found");

  const company =
    normalize(formData.get("company")) ??
    candidate.company ??
    "Unknown company";
  const position =
    normalize(formData.get("position")) ??
    candidate.position ??
    "Unknown position";
  const status = (normalize(formData.get("status")) ??
    candidate.status) as ApplicationStatus;
  const eventType = (normalize(formData.get("eventType")) ??
    candidate.eventType) as EventType;
  const taskTypeRaw = normalize(formData.get("taskType")) ?? candidate.taskType;
  const taskType = taskTypeRaw ? (taskTypeRaw as TaskType) : null;
  const deadline =
    normalizeDate(formData.get("deadline")) ?? candidate.deadline;

  const updatedCandidate = await prisma.emailCandidate.update({
    where: { id: candidate.id },
    data: {
      company,
      position,
      status,
      eventType,
      taskType,
      deadline,
    },
  });
  const forceApplicationId = normalize(formData.get("applicationId"));

  const result = await saveCandidateAsApplicationWithAudit(updatedCandidate, {
    allowCreateFromReview: true,
    forceApplicationId,
    trigger: "manual_review",
  });

  if (!result.application) {
    throw new Error(result.reason);
  }

  return result.application;
}

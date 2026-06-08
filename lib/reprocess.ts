import { prisma } from "@/lib/prisma";
import { classifyEmail } from "@/lib/classifier";
import { floatEnv } from "@/lib/env";
import { saveCandidateAsApplicationWithAudit } from "@/lib/application-writer";

function normalizeKey(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(the|a|an|ltd|limited|inc|llc|plc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function taskKey(
  company: string | null | undefined,
  position: string | null | undefined,
  type: string | null | undefined,
) {
  return `${normalizeKey(company)}|${normalizeKey(position)}|${type ?? ""}`;
}

export async function reprocessStoredEmailsForUser(userId: string) {
  const threshold = Math.max(
    0,
    Math.min(1, floatEnv("AUTO_CONFIRM_CONFIDENCE", 0.72)),
  );
  const candidates = await prisma.emailCandidate.findMany({
    where: { userId },
    orderBy: [{ emailDate: "asc" }, { createdAt: "asc" }],
  });

  const existingApplications = await prisma.application.findMany({
    where: { userId },
    select: { id: true },
  });

  const completedTasks = await prisma.task.findMany({
    where: { status: "DONE", application: { userId } },
    include: { application: true },
  });
  const completedTaskKeys = new Set(
    completedTasks.map((task) =>
      taskKey(task.application.company, task.application.position, task.type),
    ),
  );

  const applicationIds = existingApplications.map(
    (application) => application.id,
  );

  await prisma.emailCandidate.updateMany({
    where: { userId },
    data: { applicationId: null },
  });

  if (applicationIds.length > 0) {
    await prisma.task.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
    await prisma.applicationEvent.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
    await prisma.application.deleteMany({
      where: { id: { in: applicationIds } },
    });
  }

  let confirmed = 0;
  let pending = 0;
  let ignored = 0;
  let reclassified = 0;

  for (const candidate of candidates) {
    const classification = classifyEmail({
      from: candidate.emailFrom ?? "",
      subject: candidate.emailSubject ?? "",
      body: `${candidate.snippet ?? ""}\n${candidate.bodyPreview ?? ""}`,
      date: candidate.emailDate,
    });

    reclassified += 1;

    // If you manually ignored an email, keep it ignored even if you reprocess
    // the mailbox later. This prevents dismissed alerts/spam from coming back.
    if (candidate.reviewStatus === "IGNORED") {
      await prisma.emailCandidate.update({
        where: { id: candidate.id },
        data: {
          applicationId: null,
          company: classification.company,
          position: classification.position,
          status: classification.status,
          eventType: classification.eventType,
          taskType: classification.taskType,
          deadline: classification.deadline,
          summary: classification.summary,
          confidence: classification.confidence,
          reviewStatus: "IGNORED",
        },
      });
      ignored += 1;
      continue;
    }

    const shouldIgnore =
      classification.confidence < 0.34 ||
      classification.summary.toLowerCase().includes("job alert") ||
      classification.summary.toLowerCase().includes("recommendation detected");

    const hasEnoughIdentity = Boolean(
      classification.company || classification.position,
    );
    const shouldConfirm =
      !shouldIgnore &&
      classification.status !== "UNKNOWN" &&
      classification.confidence >= threshold &&
      hasEnoughIdentity;

    const reviewStatus = shouldIgnore
      ? "IGNORED"
      : shouldConfirm
        ? "CONFIRMED"
        : "PENDING";

    const updatedCandidate = await prisma.emailCandidate.update({
      where: { id: candidate.id },
      data: {
        applicationId: null,
        company: classification.company,
        position: classification.position,
        status: classification.status,
        eventType: classification.eventType,
        taskType: classification.taskType,
        deadline: classification.deadline,
        summary: classification.summary,
        confidence: classification.confidence,
        reviewStatus,
      },
    });

    if (shouldConfirm) {
      const saveResult =
        await saveCandidateAsApplicationWithAudit(updatedCandidate);

      if (saveResult.application) {
        confirmed += 1;
      } else {
        pending += 1;
      }
    } else if (shouldIgnore) {
      ignored += 1;
    } else {
      pending += 1;
    }
  }

  const recreatedOpenTasks = await prisma.task.findMany({
    where: { status: "TODO", application: { userId } },
    include: { application: true },
  });

  for (const task of recreatedOpenTasks) {
    if (
      completedTaskKeys.has(
        taskKey(task.application.company, task.application.position, task.type),
      )
    ) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "DONE" },
      });
    }
  }

  return {
    reclassified,
    confirmed,
    pending,
    ignored,
    deletedApplications: applicationIds.length,
  };
}

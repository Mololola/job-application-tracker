import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { classifyEmail } from "@/lib/classifier";
import { floatEnv } from "@/lib/env";
import { saveCandidateAsApplication } from "@/lib/application-writer";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });

  const threshold = Math.max(0, Math.min(1, floatEnv("AUTO_CONFIRM_CONFIDENCE", 0.72)));
  const candidates = await prisma.emailCandidate.findMany({
    where: {
      userId: user.id,
      reviewStatus: "PENDING"
    },
    orderBy: { emailDate: "asc" }
  });

  let ignored = 0;
  let updated = 0;
  let autoConfirmed = 0;

  for (const candidate of candidates) {
    const classification = classifyEmail({
      from: candidate.emailFrom ?? "",
      subject: candidate.emailSubject ?? "",
      body: candidate.bodyPreview ?? "",
      snippet: candidate.snippet ?? "",
      date: candidate.emailDate
    });

    if (classification.confidence < 0.34) {
      await prisma.emailCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: "IGNORED",
          company: classification.company,
          position: classification.position,
          status: classification.status,
          eventType: classification.eventType,
          taskType: classification.taskType,
          deadline: classification.deadline,
          summary: classification.summary,
          confidence: classification.confidence
        }
      });
      ignored += 1;
      continue;
    }

    const updatedCandidate = await prisma.emailCandidate.update({
      where: { id: candidate.id },
      data: {
        company: classification.company,
        position: classification.position,
        status: classification.status,
        eventType: classification.eventType,
        taskType: classification.taskType,
        deadline: classification.deadline,
        summary: classification.summary,
        confidence: classification.confidence
      }
    });
    updated += 1;

    if (classification.status !== "UNKNOWN" && classification.confidence >= threshold) {
      await saveCandidateAsApplication(updatedCandidate);
      autoConfirmed += 1;
    }
  }

  const params = new URLSearchParams({
    cleaned: String(candidates.length),
    ignored: String(ignored),
    updated: String(updated),
    autoConfirmed: String(autoConfirmed)
  });

  return NextResponse.redirect(new URL(`/dashboard?${params.toString()}`, request.url), { status: 303 });
}

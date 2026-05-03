import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { floatEnv } from "@/lib/env";
import { saveCandidateAsApplication } from "@/lib/application-writer";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.redirect(
      new URL("/settings?error=not_connected", request.url),
      { status: 303 },
    );

  const threshold = Math.max(
    0,
    Math.min(1, floatEnv("AUTO_CONFIRM_CONFIDENCE", 0.72)),
  );
  const candidates = await prisma.emailCandidate.findMany({
    where: {
      userId: user.id,
      reviewStatus: "PENDING",
      status: { not: "UNKNOWN" },
      confidence: { gte: threshold },
    },
    orderBy: { emailDate: "asc" },
  });

  for (const candidate of candidates) {
    await saveCandidateAsApplication(candidate);
  }

  const params = new URLSearchParams({
    autoSavedExisting: String(candidates.length),
  });
  return NextResponse.redirect(
    new URL(`/dashboard?${params.toString()}`, request.url),
    { status: 303 },
  );
}

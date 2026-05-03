import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const candidateId = formData.get("candidateId")?.toString();

  if (!candidateId) return NextResponse.redirect(new URL("/review?error=missing_candidate", request.url), { status: 303 });

  try {
    await prisma.emailCandidate.update({
      where: { id: candidateId },
      data: { reviewStatus: "IGNORED" }
    });
    return NextResponse.redirect(new URL("/review?ignored=1", request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/review?error=ignore_failed", request.url), { status: 303 });
  }
}

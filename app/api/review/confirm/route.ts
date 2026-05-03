import { NextRequest, NextResponse } from "next/server";
import { confirmCandidateFromForm } from "@/lib/review";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  try {
    await confirmCandidateFromForm(formData);
    return NextResponse.redirect(new URL("/review?confirmed=1", request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/review?error=confirm_failed", request.url), { status: 303 });
  }
}

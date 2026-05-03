import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { syncGmailForUser } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });

  const formData = await request.formData();
  const scanDaysRaw = formData.get("scanDays")?.toString() ?? "180";
  const scanDays = Math.max(1, Math.min(730, Number.parseInt(scanDaysRaw, 10) || 180));

  try {
    const result = await syncGmailForUser(user, scanDays);
    const params = new URLSearchParams({
      synced: "1",
      created: String(result.created),
      auto: String(result.autoConfirmed),
      review: String(result.pendingReview),
      scanned: String(result.scanned),
      known: String(result.alreadyKnown)
    });
    return NextResponse.redirect(new URL(`/dashboard?${params.toString()}`, request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=sync_failed", request.url), { status: 303 });
  }
}

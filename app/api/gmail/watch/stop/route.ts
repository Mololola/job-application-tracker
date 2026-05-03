import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { stopGmailWatchForUser } from "@/lib/gmail-push";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });
  }

  try {
    await stopGmailWatchForUser(user);
    return NextResponse.redirect(new URL("/settings?watch=stopped", request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=watch_stop_failed", request.url), { status: 303 });
  }
}

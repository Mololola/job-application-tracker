import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { runWatchCatchupForUser } from "@/lib/gmail-push";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });
  }

  try {
    await runWatchCatchupForUser(user, "manual_catchup");
    return NextResponse.redirect(new URL("/settings/sync-logs?catchup=1", request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=catchup_failed", request.url), { status: 303 });
  }
}

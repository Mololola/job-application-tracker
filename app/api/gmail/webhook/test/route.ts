import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { processGmailPushPayload } from "@/lib/gmail-push";
import { addSyncLog } from "@/lib/sync-log";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });
  }

  try {
    const fakeHistoryId = user.gmailHistoryId ?? "1";
    await addSyncLog(user.id, "webhook_test", "Testing local Gmail push processor with the current stored history ID.", {
      emailAddress: user.email,
      historyId: fakeHistoryId,
    });
    await processGmailPushPayload({ emailAddress: user.email, historyId: fakeHistoryId });
    return NextResponse.redirect(new URL("/settings/sync-logs?webhookTest=1", request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=webhook_test_failed", request.url), { status: 303 });
  }
}

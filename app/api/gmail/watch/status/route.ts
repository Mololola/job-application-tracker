import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getWebhookUrl } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: user.email,
    pushEnabled: user.gmailPushEnabled,
    topicName: user.gmailWatchTopicName,
    historyId: user.gmailHistoryId,
    watchExpiration: user.gmailWatchExpiration?.toISOString() ?? null,
    webhookUrl: getWebhookUrl(),
  });
}

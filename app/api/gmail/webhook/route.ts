import { NextRequest, NextResponse } from "next/server";
import { processGmailPushPayload, type GmailPushPayload } from "@/lib/gmail-push";
import { addSystemSyncLog } from "@/lib/sync-log";

export const dynamic = "force-dynamic";

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.GMAIL_WEBHOOK_SECRET;
  if (!secret) return true;
  return (
    request.nextUrl.searchParams.get("token") === secret ||
    request.headers.get("x-webhook-secret") === secret
  );
}

function decodePubSubData(data?: string): { payload: GmailPushPayload | null; decoded?: string; error?: string } {
  if (!data) return { payload: null, error: "missing_message_data" };
  try {
    const decoded = Buffer.from(data, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { emailAddress?: unknown; historyId?: unknown };
    const emailAddress = typeof parsed.emailAddress === "string" ? parsed.emailAddress : null;
    const historyId = parsed.historyId === null || parsed.historyId === undefined ? null : String(parsed.historyId);
    if (!emailAddress || !historyId) {
      return { payload: null, decoded, error: "missing_emailAddress_or_historyId" };
    }
    return { payload: { emailAddress, historyId }, decoded };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(request: NextRequest) {
  const requestInfo = {
    url: request.url,
    userAgent: request.headers.get("user-agent"),
    contentType: request.headers.get("content-type"),
  };

  if (!isAuthorized(request)) {
    await addSystemSyncLog("webhook_unauthorized", "Webhook was called but the token/header did not match GMAIL_WEBHOOK_SECRET.", requestInfo);
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch((error) => ({ __parseError: String(error) }))) as (PubSubPushBody & { __parseError?: string }) | null;

  await addSystemSyncLog("webhook_received", "Webhook POST received from Pub/Sub/ngrok.", {
    ...requestInfo,
    subscription: body?.subscription ?? null,
    messageId: body?.message?.messageId ?? null,
    publishTime: body?.message?.publishTime ?? null,
    parseError: body?.__parseError ?? null,
  });

  if (!body || body.__parseError) {
    await addSystemSyncLog("webhook_malformed", "Webhook body could not be parsed as JSON.", { body, requestInfo });
    return new NextResponse(null, { status: 204 });
  }

  const decoded = decodePubSubData(body.message?.data);

  if (!decoded.payload) {
    await addSystemSyncLog("webhook_malformed", "Webhook reached the app, but Pub/Sub data did not decode into a Gmail push payload.", {
      error: decoded.error,
      decoded: decoded.decoded,
      bodySummary: {
        subscription: body.subscription,
        messageId: body.message?.messageId,
        hasData: Boolean(body.message?.data),
      },
    });
    // Return 204 so Pub/Sub does not retry malformed test payloads forever.
    return new NextResponse(null, { status: 204 });
  }

  try {
    const result = await processGmailPushPayload(decoded.payload);
    if (!result.ok) {
      await addSystemSyncLog("push_user_not_found", "Gmail push payload was valid, but no connected user matched the email address.", result);
    }
    // Pub/Sub push subscriptions acknowledge a message when the endpoint returns a 2xx status.
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await addSystemSyncLog("webhook_failed", "Gmail webhook failed while processing the push payload.", {
      error: message,
      payload: decoded.payload,
    });
    console.error("Gmail webhook failed", error);
    // Return 204 so Pub/Sub does not retry the same notification forever during local development.
    // Missed/failed messages can still be recovered with Settings -> Catch up recent Gmail.
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET(request: NextRequest) {
  await addSystemSyncLog("webhook_get", "Webhook GET health check received.", {
    url: request.url,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    message: "Gmail webhook is reachable. Pub/Sub will send POST requests here.",
  });
}

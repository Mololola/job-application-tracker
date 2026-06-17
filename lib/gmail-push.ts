import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { intEnv, requiredEnv } from "@/lib/env";
import {
  getGmailClientForUser,
  processGmailMessageForUser,
  syncGmailForUser,
} from "@/lib/gmail";
import { addSyncLog } from "@/lib/sync-log";

export type GmailPushPayload = {
  emailAddress: string;
  historyId: string;
};

function normalizeHistoryId(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseGmailExpiration(value: string | number | null | undefined) {
  if (!value) return null;
  const asNumber =
    typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(asNumber)) return null;
  return new Date(asNumber);
}

export function getConfiguredTopicName() {
  return requiredEnv("GOOGLE_PUBSUB_TOPIC_NAME");
}

export function getWebhookUrl() {
  const baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const secret = process.env.GMAIL_WEBHOOK_SECRET;
  if (!baseUrl) return null;
  return `${baseUrl}/api/gmail/webhook${secret ? `?token=${encodeURIComponent(secret)}` : ""}`;
}

export async function runWatchCatchupForUser(
  user: User,
  trigger = "watch_catchup",
) {
  const days = Math.max(1, Math.min(14, intEnv("GMAIL_WATCH_CATCHUP_DAYS", 2)));
  await addSyncLog(
    user.id,
    trigger,
    `Running recent Gmail catch-up scan for the last ${days} day(s).`,
  );
  const result = await syncGmailForUser(user, days, trigger);
  await addSyncLog(
    user.id,
    `${trigger}_complete`,
    "Recent Gmail catch-up scan completed.",
    result,
  );
  return result;
}

export async function startGmailWatchForUser(
  user: User,
  options: { runCatchup?: boolean } = {},
) {
  const topicName = getConfiguredTopicName();
  const gmail = await getGmailClientForUser(user);

  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    },
  });

  const historyId = normalizeHistoryId(response.data.historyId);
  const expiration = parseGmailExpiration(response.data.expiration ?? null);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      gmailHistoryId: historyId,
      gmailWatchExpiration: expiration,
      gmailPushEnabled: true,
      gmailWatchTopicName: topicName,
    },
  });

  await addSyncLog(
    user.id,
    "watch_start",
    "Gmail real-time listener started.",
    {
      topicName,
      historyId,
      expiration: expiration?.toISOString() ?? null,
      catchupEnabled: options.runCatchup !== false,
    },
  );

  if (options.runCatchup !== false) {
    await runWatchCatchupForUser(updated, "watch_catchup");
  }

  return updated;
}

export async function stopGmailWatchForUser(user: User) {
  const gmail = await getGmailClientForUser(user);
  await gmail.users.stop({ userId: "me" });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      gmailPushEnabled: false,
      gmailWatchExpiration: null,
    },
  });

  await addSyncLog(user.id, "watch_stop", "Gmail real-time listener stopped.");
  return updated;
}

export async function renewGmailWatchForUser(user: User) {
  await addSyncLog(
    user.id,
    "watch_renew",
    "Renewing Gmail real-time listener.",
  );
  return startGmailWatchForUser(user, { runCatchup: true });
}

async function listHistoryMessageIds(user: User, startHistoryId: string) {
  const gmail = await getGmailClientForUser(user);
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let pages = 0;

  do {
    pages += 1;
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
      pageToken,
    });

    for (const history of response.data.history ?? []) {
      for (const added of history.messagesAdded ?? []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { ids: Array.from(ids), pages };
}

export async function processGmailPushPayload(payload: GmailPushPayload) {
  const user = await prisma.user.findUnique({
    where: { email: payload.emailAddress },
  });

  if (!user) {
    return {
      ok: false,
      reason: "unknown_user",
      emailAddress: payload.emailAddress,
    };
  }

  await addSyncLog(
    user.id,
    "push_received",
    "Gmail push notification received.",
    payload,
  );

  if (!user.gmailHistoryId) {
    const scanDays = Math.max(
      1,
      Math.min(30, intEnv("GMAIL_PUSH_BACKFILL_DAYS", 7)),
    );
    const backfill = await syncGmailForUser(user, scanDays, "push_backfill");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        gmailHistoryId: String(payload.historyId),
        gmailPushEnabled: true,
      },
    });
    await addSyncLog(
      user.id,
      "push_backfill",
      "No stored Gmail history ID existed, so a short backfill scan was run.",
      backfill,
    );
    return { ok: true, reason: "backfilled", result: backfill };
  }

  try {
    const history = await listHistoryMessageIds(user, user.gmailHistoryId);
    let processed = 0;
    let created = 0;
    let autoConfirmed = 0;
    let pendingReview = 0;
    let alreadyKnown = 0;
    let skippedLowConfidence = 0;

    for (const id of history.ids) {
      const result = await processGmailMessageForUser(user, id, "push");
      processed += 1;
      if (result === "created") created += 1;
      if (result === "auto_confirmed") {
        created += 1;
        autoConfirmed += 1;
      }
      if (result === "pending_review") {
        created += 1;
        pendingReview += 1;
      }
      if (result === "already_known") alreadyKnown += 1;
      if (result === "skipped_low_confidence") skippedLowConfidence += 1;
    }

    let emptyHistoryCatchup = null;
    if (history.ids.length === 0) {
      const catchupDays = Math.max(
        1,
        Math.min(7, intEnv("GMAIL_PUSH_EMPTY_HISTORY_CATCHUP_DAYS", 1)),
      );
      emptyHistoryCatchup = await syncGmailForUser(
        user,
        catchupDays,
        "push_empty_history_catchup",
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        gmailHistoryId: String(payload.historyId),
        lastSyncedAt: new Date(),
        gmailPushEnabled: true,
      },
    });

    const result = {
      pages: history.pages,
      messageIdsFound: history.ids.length,
      processed,
      created,
      autoConfirmed,
      pendingReview,
      alreadyKnown,
      skippedLowConfidence,
      previousHistoryId: user.gmailHistoryId,
      newHistoryId: payload.historyId,
      emptyHistoryCatchup,
    };

    await addSyncLog(
      user.id,
      "push_processed",
      "Gmail push notification processed.",
      result,
    );
    return { ok: true, reason: "processed", result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Dead OAuth token: retrying and backfilling will also fail, and Pub/Sub
    // retries every failed push forever (that is the flood of identical
    // webhook_failed logs). Disable push, flag for reconnect, and return ok so
    // Pub/Sub stops hammering this endpoint.
    if (message.includes("invalid_grant")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { gmailPushEnabled: false },
      });
      await addSyncLog(
        user.id,
        "gmail_reconnect_required",
        "Gmail access is invalid (invalid_grant). Real-time sync disabled — please reconnect Gmail in Settings.",
        { error: message },
      );
      return { ok: true, reason: "reconnect_required", error: message };
    }

    const scanDays = Math.max(
      1,
      Math.min(30, intEnv("GMAIL_PUSH_BACKFILL_DAYS", 7)),
    );
    const backfill = await syncGmailForUser(
      user,
      scanDays,
      "push_history_recovery",
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        gmailHistoryId: String(payload.historyId),
        gmailPushEnabled: true,
      },
    });
    await addSyncLog(
      user.id,
      "push_history_recovery",
      "Gmail history processing failed, so a short recovery scan was run.",
      {
        error: message,
        backfill,
      },
    );

    return {
      ok: true,
      reason: "history_recovered",
      error: message,
      result: backfill,
    };
  }
}

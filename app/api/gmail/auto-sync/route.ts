import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { intEnv } from "@/lib/env";
import { syncGmailForUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";

type AutoSyncResponse = {
  connected: boolean;
  skipped?: boolean;
  reason?: string;
  synced?: boolean;
  scanDays?: number;
  minMinutes?: number;
  nextAllowedAt?: string | null;
  result?: Awaited<ReturnType<typeof syncGmailForUser>>;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json<AutoSyncResponse>({
      connected: false,
      skipped: true,
      reason: "not_connected",
    });
  }

  const urlScanDays = Number.parseInt(
    request.nextUrl.searchParams.get("scanDays") ?? "",
    10,
  );

  const scanDays = Math.max(
    1,
    Math.min(
      90,
      Number.isFinite(urlScanDays)
        ? urlScanDays
        : intEnv("BACKGROUND_SYNC_DAYS", 14),
    ),
  );

  const minMinutes = Math.max(1, intEnv("BACKGROUND_SYNC_MINUTES", 5));
  const now = Date.now();
  const last = user.lastSyncedAt?.getTime() ?? 0;
  const nextAllowedAt = last ? new Date(last + minMinutes * 60 * 1000) : null;

  if (last && now - last < minMinutes * 60 * 1000) {
    return NextResponse.json<AutoSyncResponse>({
      connected: true,
      skipped: true,
      reason: "too_soon",
      scanDays,
      minMinutes,
      nextAllowedAt: nextAllowedAt?.toISOString() ?? null,
    });
  }

  try {
    const result = await syncGmailForUser(user, scanDays);

    return NextResponse.json<AutoSyncResponse>({
      connected: true,
      synced: true,
      scanDays,
      minMinutes,
      result,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json<AutoSyncResponse>(
      {
        connected: true,
        skipped: true,
        reason: "sync_failed",
        scanDays,
        minMinutes,
      },
      { status: 500 },
    );
  }
}

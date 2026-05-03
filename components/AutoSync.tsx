"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SyncResult = {
  connected: boolean;
  skipped?: boolean;
  reason?: string;
  synced?: boolean;
  result?: {
    created: number;
    autoConfirmed: number;
    pendingReview: number;
    alreadyKnown: number;
    scanned: number;
  };
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AutoSync() {
  const router = useRouter();
  const runningRef = useRef(false);
  const [message, setMessage] = useState("Auto-sync starting...");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enabled = (process.env.NEXT_PUBLIC_ENABLE_AUTO_SYNC ?? "true").toLowerCase() !== "false";
    if (!enabled) {
      setVisible(false);
      return;
    }

    const intervalMinutes = Math.max(
      1,
      Number.parseInt(process.env.NEXT_PUBLIC_AUTO_SYNC_MINUTES ?? "5", 10) || 5,
    );
    const scanDays = Math.max(
      1,
      Number.parseInt(process.env.NEXT_PUBLIC_AUTO_SYNC_DAYS ?? "14", 10) || 14,
    );

    async function runSync() {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const response = await fetch(`/api/gmail/auto-sync?scanDays=${scanDays}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as SyncResult;

        if (!data.connected) {
          setVisible(false);
          return;
        }

        setVisible(true);

        if (data.synced && data.result) {
          const saved = data.result.autoConfirmed;
          const review = data.result.pendingReview;
          const created = data.result.created;

          if (saved > 0 || review > 0) {
            setMessage(
              `Auto-sync: ${saved} saved, ${review} to review at ${formatTime(new Date())}`,
            );
            router.refresh();
          } else {
            setMessage(`Auto-sync checked at ${formatTime(new Date())}. No new job emails.`);
          }
        } else if (data.reason === "too_soon") {
          setMessage(`Auto-sync active. Last checked recently.`);
        } else if (data.reason === "sync_failed") {
          setMessage("Auto-sync failed. Reconnect Gmail in Settings if it keeps happening.");
        }
      } catch {
        setVisible(true);
        setMessage("Auto-sync could not check Gmail. Is the dev server still running?");
      } finally {
        runningRef.current = false;
      }
    }

    const firstRun = window.setTimeout(runSync, 8000);
    const interval = window.setInterval(runSync, intervalMinutes * 60 * 1000);

    return () => {
      window.clearTimeout(firstRun);
      window.clearInterval(interval);
    };
  }, [router]);

  if (!visible) return null;

  return <div className="autosync-widget">{message}</div>;
}

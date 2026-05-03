import { prisma } from "@/lib/prisma";

export async function addSyncLog(
  userId: string,
  trigger: string,
  message: string,
  details?: unknown,
) {
  const detailsText =
    typeof details === "undefined"
      ? null
      : typeof details === "string"
        ? details
        : JSON.stringify(details, null, 2);

  try {
    await prisma.syncLog.create({
      data: {
        userId,
        trigger,
        message,
        details: detailsText?.slice(0, 6000) ?? null,
      },
    });

    // Keep the local database small for personal use.
    const oldLogs = await prisma.syncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: 250,
      select: { id: true },
    });

    if (oldLogs.length > 0) {
      await prisma.syncLog.deleteMany({
        where: { id: { in: oldLogs.map((log) => log.id) } },
      });
    }
  } catch (error) {
    // Logging must never break Gmail sync.
    console.error("Failed to write sync log", error);
  }
}

export async function addSystemSyncLog(
  trigger: string,
  message: string,
  details?: unknown,
) {
  try {
    const user = await prisma.user.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!user) {
      console.log(`[${trigger}] ${message}`, details ?? "");
      return;
    }
    await addSyncLog(user.id, trigger, message, details);
  } catch (error) {
    console.error("Failed to write system sync log", error);
  }
}

import { prisma } from "@/lib/prisma";

export async function getDashboardStats(userId: string) {
  const twoWeeksFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  const [
    total,
    pendingCandidates,
    pendingApplications,
    rejectedApplications,
    openTasks,
    tasksDueSoon,
    statusGroups,
    interviews
  ] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    prisma.emailCandidate.count({ where: { userId, reviewStatus: "PENDING" } }),
    prisma.application.count({ where: { userId, status: { in: ["APPLIED", "UNKNOWN"] } } }),
    prisma.application.count({ where: { userId, status: "REJECTED" } }),
    prisma.task.count({ where: { application: { userId, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, status: "TODO" } }),
    prisma.task.count({
      where: {
        application: { userId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
        status: "TODO",
        deadline: {
          gte: new Date(),
          lte: twoWeeksFromNow
        }
      }
    }),
    prisma.application.groupBy({ by: ["status"], where: { userId }, _count: true }),
    prisma.application.count({ where: { userId, status: { in: ["INTERVIEW", "AI_INTERVIEW", "CODING_TASK", "ASSESSMENT", "OFFER"] } } })
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((group) => [group.status, group._count]));
  const responseRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
  const rejectionRate = total > 0 ? Math.round((rejectedApplications / total) * 100) : 0;

  return {
    total,
    pendingCandidates,
    pendingApplications,
    rejectedApplications,
    openTasks,
    tasksDueSoon,
    byStatus,
    responseRate,
    rejectionRate
  };
}

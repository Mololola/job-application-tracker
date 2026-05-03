import { getCurrentUser } from "@/lib/session";
import { getDashboardStats } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { boolEnv, intEnv } from "@/lib/env";
import { syncGmailForUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, name: string) {
  const value = params[name];
  return typeof value === "string" ? value : null;
}

function statusLabel(status: string) {
  if (status === "APPLIED") return "PENDING";
  return status;
}

async function maybeAutoSync(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (!boolEnv("AUTO_SYNC_ON_DASHBOARD", true)) return null;

  const minMinutes = intEnv("AUTO_SYNC_MINUTES", 15);
  const scanDays = intEnv("AUTO_SYNC_DAYS", 30);
  const now = Date.now();
  const last = user.lastSyncedAt?.getTime() ?? 0;
  const shouldSync = !last || now - last > minMinutes * 60 * 1000;

  if (!shouldSync) return null;

  try {
    return await syncGmailForUser(user, scanDays);
  } catch (error) {
    console.error(error);
    return { error: true };
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();
  const params = (await searchParams) ?? {};

  if (!user) {
    return (
      <div className="card">
        <h1>Dashboard</h1>
        <p className="muted">Connect Gmail first to start tracking applications.</p>
        <a className="button" href="/api/gmail/auth">Connect Gmail</a>
      </div>
    );
  }

  const autoSyncResult = await maybeAutoSync(user);

  const [stats, recentApplications, upcomingTasks] = await Promise.all([
    getDashboardStats(user.id),
    prisma.application.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.task.findMany({
      where: { application: { userId: user.id, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, status: "TODO" },
      include: { application: true },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: 6
    })
  ]);

  const manualSyncMessage = param(params, "synced") === "1"
    ? `Scan complete. ${param(params, "auto") ?? "0"} emails were saved automatically. ${param(params, "review") ?? "0"} need review.`
    : null;
  const autoSavedExisting = param(params, "autoSavedExisting");
  const cleaned = param(params, "cleaned");
  const ignored = param(params, "ignored");
  const cleanupAutoConfirmed = param(params, "autoConfirmed");

  return (
    <div className="grid">
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Signed in as {user.email}. High-confidence job emails are now saved automatically.
          </p>
        </div>
        <a className="button" href="/settings">Run bigger scan</a>
      </div>

      {manualSyncMessage && <div className="card"><strong>{manualSyncMessage}</strong></div>}
      {autoSavedExisting && <div className="card"><strong>Auto-saved {autoSavedExisting} existing detected emails.</strong></div>}
      {cleaned && (
        <div className="card">
          <strong>Review Inbox cleaned.</strong> Checked {cleaned} pending emails, ignored {ignored ?? "0"} job alerts/recommendations, and auto-saved {cleanupAutoConfirmed ?? "0"} real application updates.
        </div>
      )}
      {param(params, "reprocessed") && (
        <div className="card">
          <strong>Reprocessed stored emails.</strong> Checked {param(params, "reprocessed")} emails, rebuilt {param(params, "confirmed") ?? "0"} applications, ignored {param(params, "ignored") ?? "0"} non-application emails, and left {param(params, "pending") ?? "0"} for manual review.
        </div>
      )}
      {autoSyncResult && "error" in autoSyncResult && <div className="card"><strong>Auto-sync failed.</strong> Go to Settings and reconnect Gmail if this keeps happening.</div>}
      {autoSyncResult && !("error" in autoSyncResult) && autoSyncResult.created > 0 && (
        <div className="card">
          <strong>Auto-sync found new job emails.</strong> {autoSyncResult.autoConfirmed} saved automatically; {autoSyncResult.pendingReview} need review.
        </div>
      )}

      <section className="grid grid-4">
        <a className="card" href="/applications"><div className="muted">Total applications</div><div className="stat-number">{stats.total}</div></a>
        <a className="card" href="/applications?group=pending"><div className="muted">Pending</div><div className="stat-number">{stats.pendingApplications}</div></a>
        <a className="card" href="/applications?status=REJECTED"><div className="muted">Rejections</div><div className="stat-number">{stats.rejectedApplications}</div></a>
        <a className="card" href="/tasks"><div className="muted">Tasks to complete</div><div className="stat-number">{stats.openTasks}</div></a>
      </section>

      <section className="grid grid-4">
        <div className="card"><div className="muted">Tasks due soon</div><div className="stat-number">{stats.tasksDueSoon}</div></div>
        <div className="card"><div className="muted">Interview / task rate</div><div className="stat-number">{stats.responseRate}%</div></div>
        <div className="card"><div className="muted">Rejection rate</div><div className="stat-number">{stats.rejectionRate}%</div></div>
        <a className="card" href="/review"><div className="muted">Needs manual review</div><div className="stat-number">{stats.pendingCandidates}</div></a>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h2>Status breakdown</h2>
          <table className="table">
            <tbody>
              {Object.entries(stats.byStatus).length === 0 && <tr><td className="muted">No applications yet.</td></tr>}
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <tr key={status}>
                  <td><a href={`/applications?status=${status}`}><span className="badge">{statusLabel(status)}</span></a></td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Upcoming tasks</h2>
          <div className="timeline">
            {upcomingTasks.length === 0 && <p className="muted">No open tasks yet.</p>}
            {upcomingTasks.map((task) => (
              <div className="timeline-item" key={task.id}>
                <strong><a href={`/applications/${task.application.id}`}>{task.title}</a></strong>
                <p className="muted">
                  Type: {task.type}<br />
                  {task.application.company} — {task.application.position}<br />
                  {task.deadline ? `Due ${task.deadline.toLocaleDateString()}` : "No deadline detected"}
                </p>
              </div>
            ))}
          </div>
          <div className="actions"><a className="button secondary" href="/tasks">See all tasks</a></div>
        </div>
      </section>

      <section className="card">
        <h2>Recent applications</h2>
        <table className="table">
          <thead><tr><th>Company</th><th>Position</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {recentApplications.length === 0 && <tr><td colSpan={4} className="muted">No applications yet. Run a Gmail scan from Settings.</td></tr>}
            {recentApplications.map((application) => (
              <tr key={application.id}>
                <td><a href={`/applications/${application.id}`}><strong>{application.company}</strong></a></td>
                <td>{application.position}</td>
                <td><span className="badge">{statusLabel(application.status)}</span></td>
                <td>{application.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

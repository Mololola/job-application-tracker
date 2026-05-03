import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SyncLogsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="card">
        <h1>Sync logs</h1>
        <p className="muted">Connect Gmail first.</p>
      </div>
    );
  }

  const logs = await prisma.syncLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="grid">
      <div>
        <h1>Sync logs</h1>
        <p className="muted">Use this page to debug exactly what Gmail push or manual scan processed.</p>
      </div>

      <div className="actions">
        <a className="button secondary" href="/settings">Back to settings</a>
        <a className="button secondary" href="/api/gmail/watch/status">View listener status JSON</a>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Trigger</th>
            <th>Message</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.createdAt.toLocaleString()}</td>
              <td><span className="badge">{log.trigger}</span></td>
              <td>{log.message}</td>
              <td>
                {log.details ? <pre className="log-details">{log.details}</pre> : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">No logs yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

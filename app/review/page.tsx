import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

const statuses = ["APPLIED", "REJECTED", "INTERVIEW", "AI_INTERVIEW", "CODING_TASK", "ASSESSMENT", "OFFER", "WITHDRAWN", "UNKNOWN"];
const eventTypes = ["APPLICATION_CONFIRMED", "REJECTION_RECEIVED", "INTERVIEW_INVITE", "AI_INTERVIEW_INVITE", "CODING_TEST_RECEIVED", "ASSESSMENT_RECEIVED", "FOLLOW_UP", "OFFER_RECEIVED", "GENERAL_UPDATE"];
const taskTypes = ["", "AI_INTERVIEW", "NORMAL_INTERVIEW", "CODING_TASK", "ASSESSMENT", "OTHER"];

function dateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const user = await getCurrentUser();
  const params = (await searchParams) ?? {};

  if (!user) {
    return (
      <div className="card">
        <h1>Review Inbox</h1>
        <p className="muted">Connect Gmail first.</p>
        <a className="button" href="/api/gmail/auth">Connect Gmail</a>
      </div>
    );
  }

  const candidates = await prisma.emailCandidate.findMany({
    where: { userId: user.id, reviewStatus: "PENDING" },
    orderBy: [{ confidence: "desc" }, { emailDate: "desc" }],
    take: 30
  });

  const synced = params.synced === "1";
  const created = typeof params.created === "string" ? params.created : null;
  const scanned = typeof params.scanned === "string" ? params.scanned : null;

  return (
    <div className="grid">
      <div>
        <h1>Review Inbox</h1>
        <p className="muted">Confirm, edit, or ignore job-related emails detected from Gmail.</p>
      </div>

      {synced && (
        <div className="card">
          Scan complete. Created <strong>{created}</strong> new review candidates from <strong>{scanned}</strong> scanned messages.
        </div>
      )}

      {candidates.length === 0 && (
        <div className="card">
          <h2>No pending candidates</h2>
          <p className="muted">Run a scan from Settings. Auto-sync also checks Gmail while this app is open.</p>
          <a className="button" href="/settings">Go to Settings</a>
        </div>
      )}

      {candidates.map((candidate) => (
        <section className="card" key={candidate.id}>
          <div className="actions" style={{ justifyContent: "space-between", marginTop: 0 }}>
            <div>
              <span className="badge">{Math.round(candidate.confidence * 100)}% confidence</span>{" "}
              <span className="badge">{candidate.status}</span>
            </div>
            <form className="inline" method="post" action="/api/review/ignore">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <button className="danger" type="submit">Ignore</button>
            </form>
          </div>

          <h2>{candidate.emailSubject ?? "No subject"}</h2>
          <p className="muted">
            From: {candidate.emailFrom ?? "Unknown sender"}<br />
            Date: {candidate.emailDate ? candidate.emailDate.toLocaleString() : "Unknown date"}<br />
            Summary: {candidate.summary ?? "No summary"}
          </p>

          <form method="post" action="/api/review/confirm">
            <input type="hidden" name="candidateId" value={candidate.id} />
            <div className="form-grid">
              <label>
                Company
                <input name="company" defaultValue={candidate.company ?? ""} placeholder="Example: Google" />
              </label>
              <label>
                Position
                <input name="position" defaultValue={candidate.position ?? ""} placeholder="Example: Software Engineer" />
              </label>
              <label>
                Status
                <select name="status" defaultValue={candidate.status}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Event type
                <select name="eventType" defaultValue={candidate.eventType}>
                  {eventTypes.map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
                </select>
              </label>
              <label>
                Task type
                <select name="taskType" defaultValue={candidate.taskType ?? ""}>
                  {taskTypes.map((taskType) => <option key={taskType || "none"} value={taskType}>{taskType || "No task"}</option>)}
                </select>
              </label>
              <label>
                Deadline
                <input type="date" name="deadline" defaultValue={dateInputValue(candidate.deadline)} />
              </label>
            </div>

            <label style={{ marginTop: 12 }}>
              Email preview
              <textarea readOnly defaultValue={candidate.bodyPreview ?? candidate.snippet ?? ""} />
            </label>

            <div className="actions">
              <button type="submit">Confirm and save</button>
            </div>
          </form>
        </section>
      ))}
    </div>
  );
}

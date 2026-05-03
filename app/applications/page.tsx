import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { ApplicationStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ApplicationsPageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

const statuses: ApplicationStatus[] = ["APPLIED", "REJECTED", "INTERVIEW", "AI_INTERVIEW", "CODING_TASK", "ASSESSMENT", "OFFER", "WITHDRAWN", "UNKNOWN"];

function statusLabel(status: string) {
  if (status === "APPLIED") return "PENDING";
  return status;
}

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const user = await getCurrentUser();
  const params = (await searchParams) ?? {};
  const selectedStatus = typeof params.status === "string" && statuses.includes(params.status as ApplicationStatus)
    ? params.status as ApplicationStatus
    : null;
  const group = typeof params.group === "string" ? params.group : null;

  if (!user) {
    return (
      <div className="card">
        <h1>Applications</h1>
        <p className="muted">Connect Gmail first.</p>
        <a className="button" href="/api/gmail/auth">Connect Gmail</a>
      </div>
    );
  }

  const where: Prisma.ApplicationWhereInput = { userId: user.id };
  if (selectedStatus) where.status = selectedStatus;
  if (group === "pending") where.status = { in: ["APPLIED", "UNKNOWN"] };

  const applications = await prisma.application.findMany({
    where,
    include: { _count: { select: { events: true, tasks: true } } },
    orderBy: { updatedAt: "desc" }
  });

  const title = selectedStatus
    ? `${statusLabel(selectedStatus)} applications`
    : group === "pending"
      ? "Pending applications"
      : "Applications";

  return (
    <div className="grid">
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{title}</h1>
          <p className="muted">Applications are saved automatically from high-confidence Gmail matches.</p>
        </div>
        <a className="button" href="/settings">Scan Gmail</a>
      </div>

      <div className="actions">
        <a className="button secondary" href="/applications">All</a>
        <a className="button secondary" href="/applications?group=pending">Pending</a>
        <a className="button secondary" href="/applications?status=REJECTED">Rejected</a>
        <a className="button secondary" href="/applications?status=INTERVIEW">Interviews</a>
        <a className="button secondary" href="/applications?status=CODING_TASK">Coding tasks</a>
        <a className="button secondary" href="/applications?status=ASSESSMENT">Assessments</a>
        <a className="button secondary" href="/applications?status=OFFER">Offers</a>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Position</th>
            <th>Status</th>
            <th>Events</th>
            <th>Tasks</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {applications.length === 0 && <tr><td colSpan={6} className="muted">No applications found for this filter.</td></tr>}
          {applications.map((application) => (
            <tr key={application.id}>
              <td><a href={`/applications/${application.id}`}><strong>{application.company}</strong></a></td>
              <td>{application.position}</td>
              <td><span className="badge">{statusLabel(application.status)}</span></td>
              <td>{application._count.events}</td>
              <td>{application._count.tasks}</td>
              <td>{application.updatedAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

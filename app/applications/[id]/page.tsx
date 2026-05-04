import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import EditApplicationForm from "@/components/EditApplicationForm";
import MergeApplicationForm from "@/components/MergeApplicationForm";

export const dynamic = "force-dynamic";

type ApplicationDetailPageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;
  const application = await prisma.application.findFirst({
    where: { id, userId: user.id },
    include: {
      events: { orderBy: [{ emailDate: "desc" }, { createdAt: "desc" }] },
      tasks: { orderBy: [{ deadline: "asc" }, { createdAt: "desc" }] },
    },
  });

  if (!application) notFound();

  const mergeCandidates = await prisma.application.findMany({
    where: {
      userId: user.id,
      id: {
        not: application.id,
      },
    },
    select: {
      id: true,
      company: true,
      position: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
    ],
    take: 100,
  });

  return (
    <div className="grid">
      <div>
        <a className="muted" href="/applications">
          ← Back to applications
        </a>
        <h1>{application.company}</h1>
        <p className="muted">
          {application.position} ·{" "}
          <span className="badge">{application.status}</span>
        </p>
      </div>

      <EditApplicationForm
        application={{
          id: application.id,
          company: application.company,
          position: application.position,
          status: application.status,
        }}
      />

      <section className="grid grid-2">
        <div className="card">
          <h2>Tasks</h2>
          <div className="timeline">
            {application.tasks.length === 0 && (
              <p className="muted">No tasks saved for this application.</p>
            )}
            {application.tasks.map((task) => (
              <div className="timeline-item" key={task.id}>
                <strong>{task.title}</strong>
                <p className="muted">
                  Type: {task.type}
                  <br />
                  Status: {task.status}
                  <br />
                  {task.deadline
                    ? `Deadline: ${task.deadline.toLocaleDateString()}`
                    : "No deadline detected"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Application info</h2>
          <p className="muted">
            Source: {application.source}
            <br />
            Created: {application.createdAt.toLocaleDateString()}
            <br />
            Last updated: {application.updatedAt.toLocaleDateString()}
          </p>
        </div>
      </section>

      <MergeApplicationForm
        sourceApplication={{
          id: application.id,
          company: application.company,
          position: application.position,
        }}
        candidates={mergeCandidates.map((candidate) => ({
          id: candidate.id,
          company: candidate.company,
          position: candidate.position,
          status: candidate.status,
          updatedAt: candidate.updatedAt.toISOString(),
        }))}
      />

      <section className="card">
        <h2>Email timeline</h2>
        <div className="timeline">
          {application.events.length === 0 && (
            <p className="muted">No events yet.</p>
          )}
          {application.events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <strong>{event.type}</strong>
              <p className="muted">
                {event.emailDate
                  ? event.emailDate.toLocaleString()
                  : event.createdAt.toLocaleString()}
                <br />
                {event.emailSubject ?? "No subject"}
                <br />
                From: {event.emailFrom ?? "Unknown sender"}
                <br />
                Confidence: {Math.round(event.confidence * 100)}%<br />
                {event.deadline
                  ? `Deadline: ${event.deadline.toLocaleDateString()}`
                  : ""}
              </p>
              {event.summary && <p>{event.summary}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

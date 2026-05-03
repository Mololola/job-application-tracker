import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="card">
        <h1>Tasks</h1>
        <p className="muted">Connect Gmail first.</p>
        <a className="button" href="/api/gmail/auth">Connect Gmail</a>
      </div>
    );
  }

  const tasks = await prisma.task.findMany({
    where: { application: { userId: user.id, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, status: "TODO" },
    include: { application: true },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }]
  });

  return (
    <div className="grid">
      <div>
        <h1>Tasks to complete</h1>
        <p className="muted">Interviews, AI/video interviews, coding tasks, and assessments detected from Gmail.</p>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Type</th>
            <th>Company</th>
            <th>Position</th>
            <th>Deadline</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && <tr><td colSpan={6} className="muted">No open tasks.</td></tr>}
          {tasks.map((task) => (
            <tr key={task.id}>
              <td><strong>{task.title}</strong></td>
              <td><span className="badge">{task.type}</span></td>
              <td><a href={`/applications/${task.application.id}`}>{task.application.company}</a></td>
              <td>{task.application.position}</td>
              <td>{task.deadline ? task.deadline.toLocaleDateString() : "No deadline detected"}</td>
              <td>
                <form className="inline" method="post" action="/api/tasks/complete">
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit" className="secondary">Mark done</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <section className="hero">
      <div>
        <p className="badge">Personal MVP</p>
        <h1>Track your job applications from Gmail.</h1>
        <p>
          Import past application emails, review detected updates, track rejections, interviews,
          AI interviews, coding tasks, assessments, deadlines, and basic job-search statistics.
        </p>
        <div className="actions">
          {user ? <a className="button" href="/dashboard">Open dashboard</a> : <a className="button" href="/api/gmail/auth">Connect Gmail</a>}
          <a className="button secondary" href="/settings">Setup guide</a>
        </div>
      </div>
      <div className="card">
        <h2>What this first version does</h2>
        <ul className="muted">
          <li>Reads Gmail with read-only access.</li>
          <li>Finds likely job-related emails.</li>
          <li>Creates review candidates instead of blindly saving everything.</li>
          <li>Lets you confirm, edit, or ignore each result.</li>
          <li>Builds an applications table and dashboard stats.</li>
        </ul>
      </div>
    </section>
  );
}

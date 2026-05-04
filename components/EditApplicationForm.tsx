"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ApplicationStatus =
  | "APPLIED"
  | "REJECTED"
  | "INTERVIEW"
  | "AI_INTERVIEW"
  | "CODING_TASK"
  | "ASSESSMENT"
  | "OFFER"
  | "WITHDRAWN"
  | "UNKNOWN";

type EditApplicationFormProps = {
  application: {
    id: string;
    company: string;
    position: string;
    status: ApplicationStatus;
  };
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "APPLIED",
  "REJECTED",
  "INTERVIEW",
  "AI_INTERVIEW",
  "CODING_TASK",
  "ASSESSMENT",
  "OFFER",
  "WITHDRAWN",
  "UNKNOWN",
];

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function EditApplicationForm({
  application,
}: EditApplicationFormProps) {
  const router = useRouter();

  const [company, setCompany] = useState(application.company);
  const [position, setPosition] = useState(application.position);
  const [status, setStatus] = useState<ApplicationStatus>(application.status);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company,
          position,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update application.");
      }

      const cancelledTasks = Number(data.cancelledTasks ?? 0);

      if (cancelledTasks > 0) {
        setMessage(
          `Application updated. ${cancelledTasks} open task(s) were cancelled because the application is now ${formatStatus(
            status,
          )}.`,
        );
      } else {
        setMessage("Application updated.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Edit application</h2>
      <p className="muted">
        Use this when the classifier found the right email but extracted the
        wrong company, role, or status.
      </p>

      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Company
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Company name"
          />
        </label>

        <label>
          Position / role
          <input
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            placeholder="Position or role"
          />
        </label>

        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ApplicationStatus)
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save correction"}
        </button>
      </form>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}

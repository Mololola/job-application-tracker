"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type MergeCandidate = {
  id: string;
  company: string;
  position: string;
  status: string;
  updatedAt: string;
};

type MergeApplicationFormProps = {
  sourceApplication: {
    id: string;
    company: string;
    position: string;
  };
  candidates: MergeCandidate[];
};

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function MergeApplicationForm({
  sourceApplication,
  candidates,
}: MergeApplicationFormProps) {
  const router = useRouter();

  const [targetApplicationId, setTargetApplicationId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTarget = useMemo(() => {
    return candidates.find((candidate) => candidate.id === targetApplicationId);
  }, [candidates, targetApplicationId]);

  const canMerge = Boolean(targetApplicationId) && confirmText === "MERGE";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMerge) {
      setError('Type "MERGE" to confirm.');
      return;
    }

    setIsMerging(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/applications/${sourceApplication.id}/merge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetApplicationId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to merge applications.");
      }

      setMessage(
        `Merged successfully. Moved ${data.movedEvents} event(s), ${data.movedTasks} task(s), and ${data.movedEmails} linked email(s).`,
      );

      router.push(`/applications/${data.targetApplicationId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsMerging(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <section className="card danger-card">
        <h2>Merge duplicate application</h2>
        <p className="muted">
          No other applications are available to merge into.
        </p>
      </section>
    );
  }

  return (
    <section className="card danger-card">
      <h2>Merge duplicate application</h2>

      <p className="muted">
        Use this only when this application is a duplicate. All events, tasks,
        and linked emails from this application will be moved into the selected
        application. This application will then be deleted.
      </p>

      <div className="merge-summary">
        <strong>This application will be merged:</strong>
        <br />
        {sourceApplication.company} — {sourceApplication.position}
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Keep this application
          <select
            value={targetApplicationId}
            onChange={(event) => setTargetApplicationId(event.target.value)}
          >
            <option value="">Select the correct application...</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.company} — {candidate.position} —{" "}
                {formatStatus(candidate.status)}
              </option>
            ))}
          </select>
        </label>

        {selectedTarget && (
          <div className="merge-target-preview">
            <strong>Selected target:</strong>
            <br />
            {selectedTarget.company} — {selectedTarget.position}
            <br />
            <span className="muted">
              Status: {formatStatus(selectedTarget.status)}
            </span>
          </div>
        )}

        <label>
          Type MERGE to confirm
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="MERGE"
          />
        </label>

        <button type="submit" disabled={!canMerge || isMerging}>
          {isMerging ? "Merging..." : "Merge into selected application"}
        </button>
      </form>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}

import { getCurrentUser } from "@/lib/session";
import { getConfiguredTopicName, getWebhookUrl } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

function safeTopicName() {
  try {
    return getConfiguredTopicName();
  } catch {
    return null;
  }
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "Not active";
  return date.toLocaleString();
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getCurrentUser();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const connected = params.connected === "1";
  const watch = typeof params.watch === "string" ? params.watch : null;
  const topicName = safeTopicName();
  const webhookUrl = getWebhookUrl();

  return (
    <div className="grid">
      <div>
        <h1>Settings</h1>
        <p className="muted">Connect Gmail, run scans, and control the real-time Gmail listener.</p>
      </div>

      {connected && <div className="card"><strong>Gmail connected.</strong> You can now scan your emails or start the real-time listener.</div>}
      {watch && <div className="card"><strong>Real-time listener:</strong> {watch}.</div>}
      {error && <div className="card"><strong>Something went wrong:</strong> {error}</div>}

      <section className="card">
        <h2>1. Gmail connection</h2>
        {user ? <p className="muted">Connected as <strong>{user.email}</strong>.</p> : <p className="muted">No Gmail account connected yet.</p>}
        <div className="actions">
          <a className="button" href="/api/gmail/auth">{user ? "Reconnect Gmail" : "Connect Gmail"}</a>
        </div>
      </section>

      <section className="card">
        <h2>2. Real-time Gmail listener</h2>
        <p className="muted">
          This is the v12 event-driven mode with diagnostics. Gmail notifies Google Pub/Sub when your inbox changes,
          Pub/Sub calls your public webhook URL, then this app reads only the new Gmail messages and classifies them.
        </p>

        <div className="grid grid-2">
          <div className="card subtle-card">
            <strong>Status</strong>
            <p className="muted">
              {user?.gmailPushEnabled ? "Active" : "Not active"}<br />
              Expires: {formatDate(user?.gmailWatchExpiration)}
            </p>
          </div>
          <div className="card subtle-card">
            <strong>Webhook URL</strong>
            <p className="muted break-word">{webhookUrl ?? "Set PUBLIC_APP_URL in .env first."}</p>
          </div>
        </div>

        <p className="muted">
          Topic: <code>{topicName ?? "Set GOOGLE_PUBSUB_TOPIC_NAME in .env"}</code>
        </p>

        <div className="actions">
          <form method="post" action="/api/gmail/watch/start">
            <button type="submit">Start real-time listener</button>
          </form>
          <form method="post" action="/api/gmail/watch/renew">
            <button type="submit" className="secondary">Renew listener</button>
          </form>
          <form method="post" action="/api/gmail/watch/stop">
            <button type="submit" className="secondary">Stop listener</button>
          </form>
          <form method="post" action="/api/gmail/watch/catch-up">
            <button type="submit" className="secondary">Catch up recent Gmail</button>
          </form>
          <form method="post" action="/api/gmail/webhook/test">
            <button type="submit" className="secondary">Test webhook processor</button>
          </form>
          <a className="button secondary" href="/settings/sync-logs">View sync logs</a>
        </div>

        <p className="muted">
          Gmail watches expire, so renew this listener daily while testing. Start/Renew also runs a short catch-up scan
          controlled by <code>GMAIL_WATCH_CATCHUP_DAYS</code>. For local development, your <code>PUBLIC_APP_URL</code>
          should be your ngrok HTTPS forwarding URL, not <code>localhost</code>.
        </p>
      </section>

      <section className="card">
        <h2>3. Manual scan and reprocessing</h2>
        <p className="muted">
          Manual scan is still useful for debugging and backfills. Real-time push handles new emails after the listener is active.
        </p>
        <form method="post" action="/api/gmail/sync" className="form-grid">
          <label>
            Days to scan
            <input type="number" name="scanDays" defaultValue="180" min="1" max="730" />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit">Scan and auto-save</button>
          </div>
        </form>
        <div className="actions">
          <form method="post" action="/api/review/auto-confirm">
            <button type="submit" className="secondary">Auto-save existing detected emails</button>
          </form>
          <form method="post" action="/api/review/cleanup">
            <button type="submit" className="secondary">Clean job alerts from Review Inbox</button>
          </form>
          <form method="post" action="/api/review/reprocess">
            <button type="submit" className="secondary">Reprocess stored emails and rebuild applications</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>4. Backup polling</h2>
        <p className="muted">
          v10 keeps browser polling as a backup, but you can disable it by setting
          <code>NEXT_PUBLIC_ENABLE_AUTO_SYNC="false"</code> in your <code>.env</code> file.
          Push notifications should be the main flow once ngrok and Pub/Sub are configured.
        </p>
      </section>
    </div>
  );
}

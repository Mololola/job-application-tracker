# Job Application Tracker v10

Personal Gmail-based job application tracker built with Next.js, TypeScript, Prisma, SQLite, and the Gmail API.

v10 adds real-time Gmail push notifications using Google Cloud Pub/Sub.

## Main features

- Gmail OAuth connection with `gmail.readonly`
- Manual historical scan
- Automatic classification of job application confirmations, rejections, interviews, AI interviews, coding tasks, assessments, offers, and follow-ups
- Application dashboard and status counts
- Task list for real actions you need to complete
- Review Inbox for uncertain emails
- Real-time Gmail listener using Gmail `users.watch` + Pub/Sub push subscription
- Sync logs page for debugging what happened to every pushed/scanned email

## Important files

- `lib/classifier.ts` — rule-based multilingual email classifier
- `lib/application-writer.ts` — links emails to existing applications, creates events/tasks, cancels tasks after rejections
- `lib/gmail.ts` — Gmail OAuth, scans, message fetching, message processing
- `lib/gmail-push.ts` — Gmail watch, Pub/Sub history processing, real-time sync
- `lib/sync-log.ts` — sync/debug logs
- `app/api/gmail/webhook/route.ts` — Pub/Sub push webhook
- `app/api/gmail/watch/start/route.ts` — starts Gmail listener
- `app/settings/page.tsx` — setup controls
- `app/settings/sync-logs/page.tsx` — debug logs
- `prisma/schema.prisma` — database schema

## Local setup

```bash
npm install
npx prisma migrate dev --name gmail_push_v10
npm run dev
```

Keep your existing `.env` and `prisma/dev.db` when upgrading from older versions.

## Required `.env` values

```env
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/gmail/callback"
APP_SECRET="replace-with-a-long-random-secret"
MAX_EMAILS_PER_SCAN="100"
AUTO_CONFIRM_CONFIDENCE="0.72"

NEXT_PUBLIC_ENABLE_AUTO_SYNC="false"
AUTO_SYNC_ON_DASHBOARD="false"
AUTO_SYNC_MINUTES="60"
AUTO_SYNC_DAYS="30"
BACKGROUND_SYNC_MINUTES="60"
BACKGROUND_SYNC_DAYS="14"
NEXT_PUBLIC_AUTO_SYNC_MINUTES="60"
NEXT_PUBLIC_AUTO_SYNC_DAYS="14"

PUBLIC_APP_URL="https://your-ngrok-domain.ngrok-free.app"
GOOGLE_PUBSUB_TOPIC_NAME="projects/YOUR_GOOGLE_CLOUD_PROJECT_ID/topics/gmail-job-tracker-topic"
GMAIL_WEBHOOK_SECRET="replace-with-a-random-webhook-secret"
GMAIL_PUSH_BACKFILL_DAYS="7"
```

## Real-time Gmail flow

1. Run the app locally.
2. Run ngrok or another tunnel to expose `localhost:3000` publicly over HTTPS.
3. Put the ngrok HTTPS URL in `PUBLIC_APP_URL`.
4. Create a Google Cloud Pub/Sub topic.
5. Grant Gmail permission to publish to the topic.
6. Create a Pub/Sub push subscription that points to:

```text
https://your-ngrok-domain.ngrok-free.app/api/gmail/webhook?token=YOUR_GMAIL_WEBHOOK_SECRET
```

7. Go to Settings and click **Start real-time listener**.
8. New Gmail messages should now arrive through Pub/Sub and appear in Sync Logs.

## Debugging

Open:

```text
http://localhost:3000/settings/sync-logs
```

You should see logs like:

- Gmail real-time listener started
- Gmail push notification received
- Gmail message auto-saved to tracker
- Gmail message sent to Review Inbox
- Skipped low-confidence Gmail message

## Notes

Gmail watches expire. While testing locally, click **Renew listener** in Settings once per day.
For production, add a scheduled job that renews the Gmail watch daily.


## V13 webhook fix

V13 fixes Gmail Pub/Sub webhook retries caused by Gmail `historyId` arriving as a number in some payloads. The app now always stores Gmail history IDs as strings, matching the Prisma schema. The webhook also acknowledges unexpected processing failures to prevent infinite Pub/Sub retry loops during local development; use Settings -> Catch up recent Gmail after any webhook error.


## V14 Spanish Workday confirmation calibration

This version improves Spanish application-confirmation detection, especially Workday emails such as:

- `Has enviado correctamente tu candidatura para el puesto ... en COMPANY`
- `Hemos recibido correctamente tu candidatura para el puesto ...`

Expected classification:

- status: `APPLIED`
- event type: `APPLICATION_CONFIRMED`
- task: none
- company and position extracted from the subject/body when available

After installing this version, use Settings → Reprocess stored emails and rebuild applications to reclassify already-stored review emails.

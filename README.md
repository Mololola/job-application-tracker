# Job Application Tracker

A personal job application tracker that connects to Gmail, detects job-related emails, and automatically organizes applications, rejections, interviews, assessments, coding tasks, and follow-ups.

This project started as a personal tool to track job applications more reliably than manually checking Gmail.

## Current stable version

Stable checkpoint: `V14`

The app currently supports:

- Gmail OAuth login
- Gmail scanning
- Gmail real-time push notifications through Google Pub/Sub
- Application confirmation detection
- Rejection detection
- Interview/task detection
- Coding task and assessment detection
- Follow-up detection
- Manual review inbox for uncertain emails
- Dashboard statistics
- Application detail pages with email timeline
- Task page for active tasks
- Sync logs for debugging Gmail scan and push behavior

## Main idea

The tracker watches Gmail for job-related emails and tries to answer:

1. Is this a real job application email?
2. Is this a new application confirmation?
3. Is this a rejection?
4. Is this an interview invite?
5. Is this a coding task, assessment, AI interview, or other task?
6. Is this only a job alert or recommendation that should be ignored?
7. Is this a follow-up for an existing application?

The goal is for the dashboard to stay updated automatically.

Example:

- New application confirmation received:
  - Total applications +1
  - Pending +1

- Rejection received for an existing pending application:
  - Pending -1
  - Rejections +1

- Interview invite received:
  - Application status changes to interview
  - Tasks to complete +1

- Task completion confirmation received:
  - Matching task is marked done
  - Active task disappears from task list

## Tech stack

- Next.js
- TypeScript
- Prisma
- SQLite for local development
- Gmail API
- Google OAuth
- Google Pub/Sub
- ngrok for local webhook testing

## Important privacy note

This project connects to a real Gmail account.

Never commit:

- `.env`
- OAuth secrets
- Gmail tokens
- local database files
- `.next`
- `node_modules`

The `.gitignore` file should protect these files.

The file `.env.example` is safe to commit because it should contain placeholder values only.

## Local development setup

### 1. Install dependencies

```bash
npm install
```

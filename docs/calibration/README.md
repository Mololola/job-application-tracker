# Email Calibration Dataset

This folder contains anonymized examples used to improve the job application email classifier.

The tracker should classify Gmail messages into these main outcomes:

- `APPLICATION_CONFIRMED`
- `REJECTION_RECEIVED`
- `INTERVIEW_INVITE`
- `AI_INTERVIEW_INVITE`
- `ASSESSMENT_RECEIVED`
- `CODING_TEST_RECEIVED`
- `FOLLOW_UP`
- `IGNORED`
- `UNKNOWN / REVIEW_REQUIRED`

## Purpose

The goal is to reduce false positives and false negatives.

False positive example:

- A job alert or job recommendation being saved as a real application.

False negative example:

- A real application confirmation staying in Review Inbox instead of being saved automatically.

## Important behavior rules

1. Job alerts should be ignored.
2. Job recommendations should be ignored.
3. Application confirmations should increase total applications and pending applications.
4. Rejections should update an existing application to rejected when possible.
5. Rejections should not create a new application if a matching company/role exists.
6. Interview invitations should create an active task.
7. AI interviews, coding tests, assessments, and technical tasks should create active tasks.
8. Task completion emails should mark matching active tasks as done.
9. Application viewed emails should be saved as follow-up events, but should not create a task.
10. Follow-up emails should not increase total application count if they match an existing application.

## Multilingual support

The classifier should support English and Spanish.

Important Spanish application confirmation phrases:

- se ha enviado tu solicitud
- solicitud enviada
- candidatura enviada
- candidatura recibida
- hemos recibido correctamente tu candidatura
- has enviado correctamente tu candidatura
- los siguientes documentos se han enviado

Important Spanish rejection phrases:

- hemos decidido no seguir con tu proceso
- no seguiremos con tu candidatura
- no avanzaremos con tu candidatura
- no has sido seleccionado
- no continuaremos con tu proceso
- lamentablemente no continuaremos
- no podemos avanzar con tu solicitud

Important Spanish follow-up phrases:

- ha visto tu solicitud
- han visto tu solicitud
- actualización de tu solicitud
- actualización de tu candidatura

Important Spanish task/interview phrases:

- entrevista
- agenda una entrevista
- selecciona una hora
- prueba técnica
- evaluación
- test técnico
- reto técnico
- entrevista en vídeo
- entrevista de IA

## Dataset format

Each line in `email-calibration-cases.jsonl` is one JSON object.

Each object includes:

- `id`
- `language`
- `category`
- `subject`
- `senderHint`
- `bodySnippet`
- `expected`
- `extraction`
- `notes`

Do not add private email addresses, OAuth credentials, Gmail tokens, or full personal emails to this dataset.
Use anonymized examples only.

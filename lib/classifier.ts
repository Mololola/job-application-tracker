import type { ApplicationStatus, EventType, TaskType } from "@prisma/client";

export type RawEmail = {
  from: string;
  subject: string;
  body: string;
  snippet?: string;
  date?: Date | null;
};

export type Classification = {
  company: string | null;
  position: string | null;
  status: ApplicationStatus;
  eventType: EventType;
  taskType: TaskType | null;
  deadline: Date | null;
  confidence: number;
  summary: string;
  refIds?: string[];
};

type MatchResult = {
  status: ApplicationStatus;
  eventType: EventType;
  taskType: TaskType | null;
  confidence: number;
  summary: string;
};

const jobBoardDomains = [
  "linkedin",
  "indeed",
  "totaljobs",
  "totaljobsmail",
  "reed",
  "glassdoor",
  "monster",
  "cv-library",
  "jobalerts",
  "efinancialcareers",
  "jobs",
  "noreply",
  "no-reply",
];

const atsDomains = [
  "workday",
  "myworkday",
  "myworkdayjobs",
  "greenhouse",
  "lever",
  "ashby",
  "ashbyhq",
  "smartrecruiters",
  "icims",
  "successfactors",
  "oraclecloud",
  "jobvite",
  "bamboohr",
  "personio",
  "teamtailor",
  "talent",
  "workable",
  "recruitee",
  "breezy",
  "pinpoint",
  "candidate",
  "applicant",
];

const genericCompanyWords = new Set([
  "gdpr",
  "privacy",
  "guidelines",
  "opportunity",
  "consideration",
  "application",
  "candidate",
  "candidates",
  "role",
  "position",
  "team",
  "hr",
  "recruitment",
  "recruiting",
  "careers",
  "career",
  "talent",
  "jobs",
  "job",
  "workday",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "ashby",
  "linkedin",
  "indeed",
  "totaljobs",
  "totaljobsmail",
  "glassdoor",
  "efinancialcareers",
  "jobalerts",
  "alertas",
  "empleo",
  "recommended",
  "recommendation",
  "recommendations",
  "noreply",
  "notification",
  "notifications",
  "info",
  "email",
  "mail",
  "sender",
  "workflow",
  "engineer",
  "engineering",
  "developer",
  "software",
  "backend",
  "frontend",
  "front-end",
  "fullstack",
  "full-stack",
  "data",
  "machine",
  "learning",
  "analyst",
  "product",
  "designer",
  "graduate",
  "junior",
  "senior",
  "intern",
  "internship",
]);

const invalidCompanyPhrases = [
  "joining us",
  "joining us!",
  "joining",
  "us",
  "our team",
  "the team",
  "global talent acquisition",
  "talent acquisition",
  "candidate account",
  "candidate home",
];

// These are emails that are about jobs, but not about a job the user applied to.
// They must not create applications or tasks.
const nonApplicationPhrases = [
  "job opportunity",
  "job opportunity - from",
  "oportunidad de empleo",
  "oportunidad de empleo - de",
  "ad response",
  "repuesta a anuncio",
  "re: ad response",
  "ad response from",
  "ad response de",
  "suitable application for",
  "application suitable for",
  "job alert",
  "job alerts",
  "alerta de empleo",
  "alertas de empleo",
  "new jobs match your preferences",
  "nuevos empleos coinciden con tus preferencias",
  "nuevos empleos coinciden",
  "our recommendation",
  "our recommendations",
  "we recommend this job",
  "we recommend this role",
  "recommended job",
  "recommended jobs",
  "job recommendation",
  "jobs recommended for you",
  "recomendacion de empleo",
  "recomendaciones de empleo",
  "trabajos recomendados",
  "empleos recomendados",
  "hire feed",
  "take a look and see if you want to apply",
  "see if you want to apply",
  "don't forget to apply",
  "dont forget to apply",
  "reminder: don't forget to apply",
  "reminder: dont forget to apply",
  "jobs you've interacted with but have not yet applied",
  "jobs you have interacted with but have not yet applied",
  "but have not yet applied",
  "still live and accepting applications",
  "don't miss out and apply today",
  "dont miss out and apply today",
  "solicitar con perfil y cv",
  "apply with your profile",
  "apply now",
  "solicitar ahora",
  "based on your profile",
  "basado en tu perfil",
  "job matches",
  "jobs you may be interested in",
  "empleos que podrian interesarte",
  "weekly job digest",
  "daily job digest",
  "unsubscribe from these job alerts",
  "cancelar la suscripcion a estas alertas",
  "let's get you a job",
  "lets get you a job",
  "show in the browser",
  "view this email in your browser",
  "jobs you've saved",
  "jobs you saved",
  "roles you may like",
  "jobs similar to",
  "more jobs like",
  "application developer |",
  "remote |",
  "hour remote",
  "not yet applied",
  "haven't applied",
  "have not applied",
  "you got a message in arc",
  "view feed",
  "complete the form fully so our festivals team can review your application",
  "festivals team can review your application",
  "message in arc",
  "ubeya",
  "popular jobs that match your skills",
  "empleos populares que solicitan tus aptitudes",
  "descubre otros empleos similares",
  "otros empleos similares que podrian interesarte",
  "otros empleos similares que podrían interesarte",
];

const applicationConfirmationPhrases = [
  "thank you for applying",
  "thanks for applying",
  "thanks for applying to",
  "thank you for applying to",
  "thanks you for applying",
  "thank you for your application",
  "thanks for your application",
  "application received",
  "we received your application",
  "we've received your application",
  "we have received your application",
  "we successfully received your application",
  "successfully received your application",
  "we received your job application",
  "we have received your job application",
  "your application has been received",
  "your job application has been received",
  "successfully applied",
  "your application was submitted",
  "application submitted",
  "your application was sent",
  "your application has been sent",
  "application has been sent",
  "application successfully sent",
  "your application has been successfully sent",
  "good job. your application for",
  "we have your application",
  "we'll take a look at your application",
  "we will take a look at your application",
  "your recent job application",
  "your recent application",
  "we are currently reviewing your application",
  "we're currently reviewing your application",
  "application in review",
  "your application: in review",
  "gracias por aplicar",
  "gracias por postularte",
  "gracias por tu candidatura",
  "gracias por tu solicitud",
  "hemos recibido tu solicitud",
  "hemos recibido tu candidatura",
  "recibimos tu solicitud",
  "recibimos tu candidatura",
  "hemos recibido correctamente tu candidatura",
  "hemos recibido correctamente tu solicitud",
  "recibido correctamente tu candidatura",
  "recibido correctamente tu solicitud",
  "has enviado correctamente tu candidatura",
  "has enviado correctamente tu solicitud",
  "candidatura enviada correctamente",
  "solicitud enviada correctamente",
  "solicitud recibida",
  "candidatura recibida",
  "postulacion recibida",
  "solicitud enviada",
  "candidatura enviada",
  "postulacion enviada",
  "se ha enviado tu solicitud",
  "se ha enviado tu candidatura",
  "tu solicitud se ha enviado",
  "tu candidatura se ha enviado",
  "solicitud para el puesto",
  "tu solicitud para el puesto",
  "tu candidatura para el puesto",
  "has enviado correctamente",
  "hemos recibido correctamente",
  "tu solicitud ha sido enviada",
  "tu candidatura ha sido enviada",
  "los siguientes documentos se han enviado",
  "se han enviado a",
  "se ha enviado tu solicitud",
  "solicitado el",
  "applied on",
];

const viewedOrReadPhrases = [
  "has been viewed",
  "has been read",
  "has just been read",
  "recruiter has viewed your application",
  "viewed your application",
  "read your application",
  "application has been viewed",
  "application has been read",
  "ha visto tu solicitud",
  "ha visto tu candidatura",
  "han visto tu solicitud",
  "han visto tu candidatura",
];

const rejectionPhrases = [
  "we regret to inform",
  "regret to inform",
  "after careful consideration",
  "not moving forward",
  "won't be moving forward",
  "will not be moving forward",
  "we wont be moving forward",
  "we won't be moving forward",
  "not move forward",
  "not selected",
  "unable to progress",
  "will not be proceeding",
  "not be proceeding",
  "not be progressing",
  "not be able to proceed",
  "not able to proceed",
  "have not been selected",
  "decided not to move forward",
  "decided to proceed with other candidates",
  "proceed with other candidates",
  "proceeding with other candidates",
  "other candidates for this position",
  "other candidates better match",
  "unsuccessful application",
  "application has been unsuccessful",
  "your application was unsuccessful",
  "your application has been unsuccessful",
  "your application is unsuccessful",
  "you have been unsuccessful",
  "you were unsuccessful",
  "we are unable to progress",
  "unable to take your application further",
  "unable to move your application forward",
  "we will not progress your application",
  "will not progress your application",
  "will not be progressing your application",
  "not be progressing your application on this occasion",
  "not progressing your application",
  "shortlisting for this stage of the recruitment process has now concluded",
  "will not be progressing your application on this occasion",
  "we cannot progress your application",
  "we are unable to offer",
  "unable to offer you",
  "not be making you an offer",
  "not successful",
  "no longer under consideration",
  "position has been filled",
  "we have filled this position",
  "we received many strong applications",
  "not be able to proceed to interview",
  "no further action will be taken",
  "lamentablemente",
  "lo sentimos",
  "no avanzaremos",
  "no seguiremos adelante",
  "no continuaremos",
  "no has sido seleccionado",
  "no has sido seleccionada",
  "no fuiste seleccionado",
  "no fuiste seleccionada",
  "no podemos continuar",
  "hemos decidido no seguir con tu proceso de seleccion",
  "hemos decidido no seguir con tu proceso de selección",
  "no seguir con tu proceso de seleccion",
  "no seguir con tu proceso de selección",
  "no seguiremos con tu proceso",
  "no continuaremos con tu candidatura",
  "no continuaremos con tu solicitud",
  "no podemos avanzar con tu candidatura",
  "no podemos avanzar con tu solicitud",
  "no podremos avanzar",
  "candidatura no ha sido seleccionada",
  "solicitud no ha sido seleccionada",
];

// Strong interview phrases. Avoid classifying every email containing the word "interview"
// as a task. The user should only see a task when there is a clear action to schedule/attend.
const strongInterviewPhrases = [
  "schedule your interview",
  "book your interview",
  "select an interview time",
  "choose an interview time",
  "invited to interview",
  "invite you to interview",
  "interview request",
  "interview invitation",
  "interview invite",
  "move forward with the interview process",
  "excited to move forward with the interview process",
  "next steps on your application",
  "next step on your application",
  "take the next step",
  "take your next step",
  "we would love for you to take the next step",
  "we'd love for you to take the next step",
  "select a time through the calendly link",
  "select a time through calendly",
  "calendly link",
  "book a slot",
  "choose a slot",
  "confirm your availability",
  "next interview",
  "interview process",
  "introductory conversation",
  "introduction interview",
  "event name introduction interview",
  "interview has been scheduled",
  "your interview is scheduled",
  "upcoming interview",
  "availability for an interview",
  "availability for a call",
  "schedule a call",
  "book a time",
  "please book",
  "please schedule",
  "meet with the hiring team",
  "meet with our team",
  "recruiter screen",
  "phone screen",
  "technical interview",
  "video call with",
  "video interview with",
  "next round interview",
  "next stage interview",
  "programar una entrevista",
  "agendar una entrevista",
  "invitarte a una entrevista",
  "invitamos a una entrevista",
  "entrevista programada",
  "disponibilidad para una entrevista",
  "solicitud de entrevista",
  "invitacion a entrevista",
  "invitación a entrevista",
  "proceso de entrevista",
  "siguiente entrevista",
  "siguientes pasos de tu solicitud",
  "siguientes pasos en tu candidatura",
  "avanzar con el proceso de entrevista",
  "selecciona una hora",
  "elige una hora",
  "confirma tu disponibilidad",
  "entrevista introductoria",
];

const aiInterviewPhrases = [
  "hirevue",
  "complete your ai interview",
  "complete the ai interview",
  "ai interview invitation",
  "ai interview invite",
  "ai-led interview",
  "ai led interview",
  "ai-powered interview",
  "short ai-led interview",
  "short ai led interview",
  "one-way interview",
  "one way interview",
  "complete your video interview",
  "record your video interview",
  "recorded interview invitation",
  "modern hire",
  "entrevista grabada",
  "entrevista en video",
  "entrevista de video",
  "entrevista con ia",
  "entrevista con inteligencia artificial",
  "entrevista asistida por ia",
];

const aiInterviewCompletePhrases = [
  "ai interview is complete",
  "video interview is complete",
  "interview is complete",
  "your interview is complete",
  "you have completed your interview",
  "completed your ai interview",
  "completed your video interview",
];

const codingTaskPhrases = [
  "coding challenge",
  "coding assessment",
  "technical assessment",
  "hackerrank",
  "codility",
  "codesignal",
  "take-home",
  "take home",
  "programming test",
  "technical test",
  "complete the coding",
  "complete your coding",
  "prueba tecnica",
  "evaluacion tecnica",
  "reto de programacion",
  "test tecnico",
];

const assessmentPhrases = [
  "complete your assessment",
  "complete the assessment",
  "assessment invitation",
  "online assessment",
  "testgorilla",
  "psychometric",
  "aptitude test",
  "online test",
  "complete the test",
  "complete your test",
  "evaluacion online",
  "evaluacion en linea",
  "prueba online",
  "prueba en linea",
  "test psicometrico",
  "prueba de aptitud",
];

const offerPhrases = [
  "pleased to offer you",
  "delighted to offer you",
  "we would like to offer you",
  "we are offering you",
  "job offer",
  "offer letter",
  "conditional offer",
  "formal offer",
  "nos complace ofrecerte",
  "nos gustaria ofrecerte",
  "oferta de trabajo",
  "carta de oferta",
];

const applicationUpdatePhrases = [
  "update on your application",
  "update about your application",
  "application update",
  "next steps on your application",
  "next step on your application",
  "your application has been viewed",
  "your application has been read",
  "your application is in review",
  "your application: in review",
  "application in review",
  "we are currently reviewing your application",
  "we're currently reviewing your application",
  "we will now start reviewing applications",
  "we will now start reviewing your application",
  "we will be back in touch",
  "we'll be in touch soon",
  "we will be in touch soon",
  "actualizacion de tu solicitud",
  "actualización de tu solicitud",
  "tu actualizacion de",
  "tu actualización de",
  "actualizacion de tu candidatura",
  "actualización de tu candidatura",
  "tu candidatura esta en revision",
  "tu solicitud esta en revision",
];

const taskCompletionPhrases = [
  "thank you for completing your ai interview",
  "thanks for completing your ai interview",
  "thank you for completing your video interview",
  "thanks for completing your video interview",
  "ai interview is complete",
  "video interview is complete",
  "your interview is complete",
  "you have completed your interview",
  "completed your ai interview",
  "completed your video interview",
  "thanks for taking the",
  "thank you for taking the",
  "thanks for completing the assessment",
  "thank you for completing the assessment",
  "assessment is complete",
  "test is complete",
  "challenge is complete",
  "you have completed the assessment",
  "you have completed the test",
  "you have completed the challenge",
  "gracias por completar",
  "has completado",
];

const taskActionPhrases = [
  "please complete",
  "complete your",
  "complete the",
  "you need to complete",
  "required to complete",
  "invited to complete",
  "start your",
  "take your",
  "please take",
  "must be completed",
  "due by",
  "deadline",
  "expires",
  "schedule your",
  "book your",
  "select an",
  "choose an",
  "pick a",
  "please schedule",
  "please book",
  "select a time",
  "select a time through",
  "calendly link",
  "take the next step",
  "take your next step",
  "book a slot",
  "choose a slot",
  "confirm your availability",
  "schedule the call",
  "calendar invitation",
  "zoom web conference",
  "add to calendar",
  "accept the invitation",
  "record your",
  "submit your",
  "completa",
  "complete su",
  "completar",
  "agenda",
  "agendar",
  "programa",
  "programar",
  "selecciona una hora",
  "elige una hora",
  "confirma tu disponibilidad",
  "acepta la invitacion",
  "acepta la invitación",
  "graba",
  "grabar",
];

const harmlessApplicationNoise = [
  "we will be back in touch",
  "we'll be in touch",
  "potential next steps",
  "these could include",
  "we consider each application carefully",
  "if we feel that the role is not quite right for you",
  "we won't be able to meet with everyone",
  "we will now start reviewing applications",
];

function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&zwnj;|&zwj;|&nbsp;|&shy;|&amp;|&quot;|&#39;|&apos;/gi, " ")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9@._+\-'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWhitespace(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&zwnj;|&zwj;|&nbsp;|&shy;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return text.includes(normalizeForMatching(phrase));
}

function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => containsPhrase(text, phrase));
}

function countHits(text: string, phrases: string[]) {
  return phrases.filter((phrase) => containsPhrase(text, phrase)).length;
}

function hasApplicationConfirmationSignal(normalizedText: string): boolean {
  if (containsAny(normalizedText, applicationConfirmationPhrases)) return true;

  return (
    /\byour application for [a-z0-9@._+\-'\s]{2,160} has been sent\b/i.test(
      normalizedText,
    ) ||
    /\byour application for [a-z0-9@._+\-'\s]{2,160} was sent\b/i.test(
      normalizedText,
    ) ||
    /\byour application for [a-z0-9@._+\-'\s]{2,160} has been submitted\b/i.test(
      normalizedText,
    ) ||
    /\byour application for [a-z0-9@._+\-'\s]{2,160} was submitted\b/i.test(
      normalizedText,
    ) ||
    /\byour application for [a-z0-9@._+\-'\s]{2,160} has been received\b/i.test(
      normalizedText,
    ) ||
    /\byour application for [a-z0-9@._+\-'\s]{2,160} was received\b/i.test(
      normalizedText,
    ) ||
    /\byour recent job application for [a-z0-9@._+\-'\s]{2,160}\b/i.test(
      normalizedText,
    ) ||
    /\bwe received your application for [a-z0-9@._+\-'\s]{2,160}\b/i.test(
      normalizedText,
    ) ||
    /\bwe have received your application for [a-z0-9@._+\-'\s]{2,160}\b/i.test(
      normalizedText,
    ) ||
    /\bapplication for [a-z0-9@._+\-'\s]{2,160} has been sent\b/i.test(
      normalizedText,
    ) ||
    /\bapplication for [a-z0-9@._+\-'\s]{2,160} was submitted\b/i.test(
      normalizedText,
    ) ||
    /\btu solicitud para [a-z0-9@._+\-'\s]{2,160} ha sido enviada\b/i.test(
      normalizedText,
    ) ||
    /\btu candidatura para [a-z0-9@._+\-'\s]{2,160} ha sido enviada\b/i.test(
      normalizedText,
    ) ||
    /\bse ha enviado tu solicitud para [a-z0-9@._+\-'\s]{2,160}\b/i.test(
      normalizedText,
    ) ||
    /\bse ha enviado tu candidatura para [a-z0-9@._+\-'\s]{2,160}\b/i.test(
      normalizedText,
    )
  );
}

function titleCase(value: string): string {
  return value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z0-9&+/.#-]+$/.test(part)) return part;
      if (part.length <= 2) return part.toUpperCase();
      return part[0]?.toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

function stripLeadingArticles(value: string): string {
  return value.replace(/^(the|a|an|el|la|los|las|un|una)\s+/i, "").trim();
}

function trimJunk(value: string): string {
  return value
    .replace(
      /\b(HR|Recruiting|Recruitment|Careers|Career|Talent Acquisition|Talent|Jobs|Job Alerts?|Alertas? de empleo|Team|Notifications?|Notification|No Reply|Noreply|Info|Email|Mail|Sender|Workflow)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .replace(/^[-–—:|,\s]+|[-–—:|,\s]+$/g, "")
    .trim();
}

function removeTrailingNoise(value: string): string {
  return value
    .replace(/\b(hi|hello|dear)\s+luis\b.*$/i, "")
    .replace(
      /\b(thank you|thanks|gracias|regards|best regards|kind regards)\b.*$/i,
      "",
    )
    .replace(
      /\b(if your profile|if you have|please go|we're keeping|we are keeping|we'll take|we will take|we encourage|in the meantime)\b.*$/i,
      "",
    )
    .replace(/[.!?;,]+$/g, "")
    .trim();
}

function looksLikeCompany(value: string | null | undefined): value is string {
  if (!value) return false;
  const cleaned = stripLeadingArticles(removeTrailingNoise(value.trim()));
  if (cleaned.length < 2 || cleaned.length > 70) return false;
  const lower = normalizeForMatching(cleaned);
  if (invalidCompanyPhrases.includes(lower)) return false;
  if (
    [...genericCompanyWords].some(
      (word) =>
        lower === word ||
        lower.startsWith(`${word} `) ||
        lower.endsWith(` ${word}`),
    )
  )
    return false;
  if (
    jobBoardDomains.some(
      (domain) => lower === domain || lower.includes(`${domain} `),
    )
  )
    return false;
  if (
    atsDomains.some(
      (domain) => lower === domain || lower.startsWith(`${domain} `),
    )
  )
    return false;
  if (/^(this|our|your|my|este|esta|tu|su|co|com|mail|email)\b/i.test(cleaned))
    return false;
  // Reject only if the value is essentially a pure role title (every significant
  // word is a role/seniority word). Still rejects "Software Engineer", but now
  // accepts real companies that contain role words, e.g. "Soar Software Development".
  const roleOnlyWords = new Set([
    "application",
    "candidate",
    "position",
    "role",
    "job",
    "empleo",
    "candidatura",
    "solicitud",
    "recommendation",
    "recommended",
    "interview",
    "assessment",
    "engineer",
    "engineering",
    "developer",
    "development",
    "software",
    "backend",
    "frontend",
    "fullstack",
    "full-stack",
    "machine",
    "learning",
    "data",
    "scientist",
    "analyst",
    "product",
    "manager",
    "graduate",
    "junior",
    "senior",
    "intern",
    "internship",
    "lead",
    "principal",
    "program",
    "programme",
    "trainee",
    "scheme",
    "team",
    "the",
    "a",
    "an",
    "of",
    "de",
  ]);
  const sigWords = lower.split(/\s+/).filter((w) => w.length > 1);
  if (sigWords.length > 0 && sigWords.every((w) => roleOnlyWords.has(w)))
    return false;
  // Reject contact-line junk that sometimes gets scraped as a "company":
  // phone numbers, emails, URLs, telephone labels.
  if (
    /@|https?:\/\/|www\.|telephone|tel:|phone|\+?\d[\d()\s-]{6,}/i.test(cleaned)
  )
    return false;
  // Reject values that are mostly digits/symbols rather than letters.
  const letterCount = (cleaned.match(/[a-zA-ZÁÉÍÓÚÑáéíóúñ]/g) ?? []).length;
  if (letterCount < cleaned.replace(/\s/g, "").length * 0.5) return false;

  return /[a-zA-Z]/.test(cleaned);
}

function cleanupCompany(value: string): string | null {
  const cleaned = trimJunk(stripLeadingArticles(removeTrailingNoise(value)))
    .replace(
      /\s*[-–—|]\s*(?:workday|myworkday|greenhouse|lever|ashby|ashbyhq|smartrecruiters|icims|successfactors|oraclecloud|jobvite|bamboohr|personio|teamtailor)\s*$/i,
      "",
    )
    .replace(
      /\b(?:for|para|por|as|como|role|position|puesto|vacante)\b.*$/i,
      "",
    )
    .replace(/[.!?;,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return looksLikeCompany(cleaned) ? titleCase(cleaned.slice(0, 70)) : null;
}

function senderDomain(from: string): string {
  return from.match(/@([a-z0-9.-]+)\.[a-z]{2,}/i)?.[1]?.toLowerCase() ?? "";
}

function looksLikePersonName(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.replace(/["']/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  if (
    /\b(team|careers|recruitment|recruiting|talent|hr|jobs|support|no.?reply|notifications?)\b/i.test(
      cleaned,
    )
  )
    return false;
  return parts.every((part) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'’-]{1,}$/.test(part));
}

function extractCompanyFromEmail(from: string): string | null {
  const displayMatch = from.match(/^\s*"?([^"<]+)"?\s*</);
  const displayRaw = displayMatch?.[1]?.trim();
  const display = trimJunk(displayRaw ?? "");

  const domain = senderDomain(from);

  // Many recruiter emails use a real person's name as the display name
  // (for example Dan Shone <dan.shone-external@getyourguide.com>). Prefer the
  // company domain in those cases instead of saving the recruiter as the company.
  const displayCompany = looksLikePersonName(display)
    ? null
    : cleanupCompany(display);
  if (displayCompany) return displayCompany;

  if (!domain) return null;

  const domainParts = domain
    .split(".")
    .filter((part) => !jobBoardDomains.includes(part.toLowerCase()))
    .filter((part) => !atsDomains.includes(part.toLowerCase()))
    .filter(
      (part) =>
        ![
          "mail",
          "email",
          "notification",
          "notifications",
          "workflow",
          "sender",
          "app",
        ].includes(part.toLowerCase()),
    );

  const finalPart = domainParts.pop();
  if (!finalPart) return null;

  return cleanupCompany(finalPart.replace(/[-_]/g, " "));
}

function firstUsefulLine(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^[-=_]{3,}$/.test(line))
    .filter((line) => !/^[A-Za-z0-9+/=_-]{80,}$/.test(line))
    .slice(0, 100);
}

function looksLikeRoleCandidate(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeForMatching(value);
  if (!normalized || normalized.length < 4 || normalized.length > 120)
    return false;
  if (containsAny(normalized, nonApplicationPhrases)) return false;
  if (
    /^(junior|senior|graduate|intern|internship|role|position|puesto|cargo)$/i.test(
      normalized,
    )
  )
    return false;
  return /\b(engineer|engineering|developer|software|backend|frontend|front end|fullstack|full stack|data|machine|learning|analyst|designer|product|manager|graduate|junior|senior|intern|java|python|javascript|typescript|react|cloud|devops|qa|test|r d|research|arquitectura|desarrollador|desarrolladora|ingeniero|ingeniera|disenador|diseñador|analista|datos|producto)\b/i.test(
    normalized,
  );
}

function extractStructuredCompany(
  lines: string[],
  subject: string,
): string | null {
  const subjectCompanyPatterns = [
    /tu actualizaci[oó]n de\s+([^\n]{2,80})/i,
    /se ha enviado tu solicitud a\s+([^\n]{2,80})/i,
    /se ha enviado tu candidatura a\s+([^\n]{2,80})/i,
    /has enviado correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([^\n]{2,100})/i,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([^\n]{2,100})/i,
    /tu solicitud para el puesto de [^\n]{2,120}\s+en\s+([^\n]{2,80})/i,
    /tu candidatura para el puesto de [^\n]{2,120}\s+en\s+([^\n]{2,80})/i,
  ];

  for (const pattern of subjectCompanyPatterns) {
    const value = cleanupCompany(subject.match(pattern)?.[1] ?? "");
    if (value) return value;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/[·•]/.test(line)) continue;
    const left = line.split(/[·•]/)[0]?.trim();
    const company = cleanupCompany(left ?? "");
    const previous = lines[index - 1];
    if (
      company &&
      (!previous ||
        looksLikeRoleCandidate(previous) ||
        /recruiter|talent|sourcing/i.test(previous))
    ) {
      return company;
    }
  }

  return null;
}

function extractStructuredPosition(
  lines: string[],
  subject: string,
): string | null {
  const subjectPositionPatterns = [
    /thank you\s+(?:for|in)\s+your\s+interest\s+in\s+(?:the\s+)?([^\n.!?]{2,90}?)\s+position\s+(?:at|with|for)\s+/i,
    /thank you\s+(?:for|in)\s+your\s+interest\s+in\s+(?:the\s+)?([^\n.!?]{2,90}?)\s+(?:role|vacancy)\b/i,
    /tu solicitud para el puesto(?: de)?\s+([^\n]{2,120}?)\s+en\s+/i,
    /tu candidatura para el puesto(?: de)?\s+([^\n]{2,120}?)\s+en\s+/i,
    /solicitud en indeed\s*:\s*([^\n|:]{2,120})/i,
    /has enviado correctamente tu (?:candidat ura|solicitud) para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /next steps on your application\s*[-–—:]\s*([^\n|:]{2,120})/i,
  ];

  for (const pattern of subjectPositionPatterns) {
    const value = cleanupPosition(subject.match(pattern)?.[1] ?? "");
    if (value && looksLikeRoleCandidate(value)) return value;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (looksLikeRoleCandidate(line) && next && /[·•]/.test(next)) {
      const value = cleanupPosition(line);
      if (value) return value;
    }
  }

  for (const line of lines.slice(0, 12)) {
    const value = cleanupPosition(line);
    if (value && looksLikeRoleCandidate(value)) return value;
  }

  return null;
}

function extractCompany(
  textWithNewlines: string,
  from: string,
  subject: string,
): string | null {
  const compact = cleanWhitespace(textWithNewlines);
  const lines = firstUsefulLine(textWithNewlines);
  const lineText = lines.join("\n");
  const linkedInCardCompanyMatches = [
    ...compact.matchAll(
      /([^.\n\r]{4,90})\.\s+(.{2,90}?)\.\s+(?:solicitado|applied on)\b/gi,
    ),
  ];

  for (const match of linkedInCardCompanyMatches) {
    const possibleRole = cleanupPosition(match[1] ?? "");
    if (!possibleRole || !looksLikeRoleCandidate(possibleRole)) continue;

    const company = cleanupCompany(match[2] ?? "");
    if (company) return company;
  }

  const subjectPatterns = [
    /has enviado correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,'’+\- ]{2,120})/iu,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,'’+\- ]{2,120})/iu,
    /tu solicitud para el puesto(?: de)? [^\n]{2,120}\s+en\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,'’+\- ]{2,120})/iu,
    /tu candidatura para el puesto(?: de)? [^\n]{2,120}\s+en\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,'’+\- ]{2,120})/iu,
    /tu actualizaci[oó]n de\s+([A-Za-z0-9&.,'’+\- ]{2,80})/i,
    /se ha enviado tu solicitud a\s+([A-Za-z0-9&.,'’+\- ]{2,80})/i,
    /se ha enviado tu candidatura a\s+([A-Za-z0-9&.,'’+\- ]{2,80})/i,
    /has enviado correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([A-Za-z0-9&.,'’+\- ]{2,100})/i,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)? [^\n]{2,140}\s+en\s+([A-Za-z0-9&.,'’+\- ]{2,100})/i,
    /tu solicitud para el puesto de [^\n]{2,120}\s+en\s+([A-Za-z0-9&.,'’+\- ]{2,80})/i,
    /tu candidatura para el puesto de [^\n]{2,120}\s+en\s+([A-Za-z0-9&.,'’+\- ]{2,80})/i,
    /update on your application\s*@\s*([A-Za-z0-9&.,'’+\- ]{2,70})/i,
    /application\s*@\s*([A-Za-z0-9&.,'’+\- ]{2,70})/i,
    /los siguientes documentos se han enviado a\s+([A-Za-z0-9&.,'’+\- ]{2,100})/i,
    /documentos se han enviado a\s+([A-Za-z0-9&.,'’+\- ]{2,100})/i,
    /your application\s+to\s+([A-Za-z0-9&.,'’+\- ]{2,70})\s+has\s+been\s+(?:viewed|read)/i,
    /update on your application for the role of [^\n.!?]{2,120}\s+with\s+([A-Za-z0-9&.,'’+\- ]{2,70})/i,
    /application for [^\n.!?]{2,120}\s+(?:at|with)\s+([A-Za-z0-9&.,'’+\- ]{2,70})/i,
    /(?:position|role)\s+(?:at|with)\s+([A-Za-z0-9&.,'’+\- ]{2,70})/i,
    /(?:interview|conversation)\s+(?:at|with)\s+([A-Za-z0-9&.,'’+\- ]{2,70})/i,
  ];

  for (const pattern of subjectPatterns) {
    const value = cleanupCompany(subject.match(pattern)?.[1] ?? "");
    if (value) return value;
  }

  const structuredCompany = extractStructuredCompany(lines, subject);
  if (structuredCompany) return structuredCompany;

  const patterns = [
    /^\s*at\s+([^,\n]{2,70}),\s+/im,
    /thank\s+you,?\s*\n\s*([^\n]{2,70})\s+global\s+talent\s+acquisition/i,
    /([^\n]{2,70})\s+global\s+talent\s+acquisition/i,
    /(?:senior\s+)?(?:recruiter|talent\s+partner|hiring\s+partner|recruitment\s+consultant|talent\s+sourcing)[^@\n]{0,90}@\s*([^\n|•🚀]{2,70})/i,
    /(?:company|empresa)\s*[:\-–—]\s*([^\n]{2,70})/i,
    /(?:thank(?:s| you)|thanks you)\s+for\s+(?:applying|your application)\s+(?:to|with|in)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:application|candidatura|solicitud|postulacion)\s+(?:was\s+)?(?:sent|submitted|enviada|recibida)\s+(?:to|a|para)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:your application|tu candidatura|tu solicitud)\s+(?:for|to)\s+[^\n.!?]{2,110}\s+(?:at|with|en)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:you applied|has aplicado|te postulaste)\s+(?:to|for|a|para)?\s*[^\n.!?]{0,100}\s+(?:at|with|en)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:thank you for your interest in|thanks for your interest in)\s+(?:the\s+)?[^\n.!?]{2,110}?\s+(?:position|role)\s+(?:at|with)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:position|role)\s+(?:at|with|en)\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:company|empresa|employer|organizacion|organización)\s*[:\-–—]\s*([^\n]{2,70})/i,
    /(?:best regards|kind regards|regards|thanks),?\s*\n\s*([^\n]{2,70})\s+(?:recruitment|recruiting|talent|careers|hiring)\s+team/i,
    /(?:best regards|kind regards|regards|thanks),?\s*([A-Z][A-Za-z0-9&.,'’+\- ]{2,70})\s+(?:recruitment|recruiting|talent|careers|hiring)\s+team/i,
    /([^\n]{2,70})\s+(?:recruitment|recruiting|talent|careers|hiring)\s+team/i,
    /(?:thank you|thanks)\s+for\s+your\s+interest\s+in\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
    /(?:gracias)\s+por\s+tu\s+interes\s+en\s+([^\n.!?,]{2,70})(?:[.!?,\n\r]|$)/i,
  ];

  for (const pattern of patterns) {
    const value = cleanupCompany(
      (lineText.match(pattern) ?? compact.match(pattern))?.[1] ?? "",
    );
    if (value) return value;
  }

  const fromCompany = extractCompanyFromEmail(from);
  if (fromCompany) return fromCompany;

  return null;
}

function cleanupPosition(value: string): string | null {
  const cleaned = stripLeadingArticles(value)
    .replace(/^(?:puesto|cargo|position|role|vacante)\s+(?:de\s+)?/i, "")
    .replace(/\s+-\s*\d{2,}\s*$/g, "")
    .replace(/\s+#?\d{3,}\s*$/g, "")
    .replace(/\s*\(job\s*id\s*[^)]*\)/gi, "")
    .replace(/\s*\(ref(?:erence)?\s*[^)]*\)/gi, "")
    .replace(/\s*\(\s*[A-Z]?\d{3,}[A-Z0-9]*\s*\)/gi, "")
    .replace(
      /\b(has been sent|has been successfully sent|was sent|successfully sent|application has been sent|application sent|has just been read|has been read|has been viewed)\b.*$/i,
      "",
    )
    .replace(
      /\b(opportunity|role|position|vacancy|puesto|cargo|rol|vacante)\b\.?$/i,
      "",
    )
    .replace(
      /\b(after careful consideration|careful consideration|thank you|thanks|unfortunately|lamentablemente|lo sentimos|we'll take a look|we will take a look)\b.*$/i,
      "",
    )
    .replace(/\b(at|with|en)\s+[A-Z][A-Za-z0-9&.,'’+\- ]{2,70}$/i, "")
    .replace(/[.!?;,]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—:|\s]+|[-–—:|\s]+$/g, "")
    .trim();

  if (cleaned.length < 2) return null;
  if (cleaned.length > 100) return null;
  if (
    /^(the|this|our|your|my|an?|for|el|la|los|las|tu|su|para|junior|senior|graduate|intern|internship)$/i.test(
      cleaned,
    )
  )
    return null;
  if (
    /\b(alert|alerta|recommendation|recomendacion|recommended|recomendado|hire feed|apply now|solicitar ahora)\b/i.test(
      cleaned,
    )
  )
    return null;
  return titleCase(cleaned.slice(0, 90));
}

function extractPosition(
  textWithNewlines: string,
  subject: string,
): string | null {
  const combined = `${subject}\n${textWithNewlines}`;
  const compact = cleanWhitespace(combined);
  const lines = firstUsefulLine(combined);
  const structuredPosition = extractStructuredPosition(lines, subject);
  if (structuredPosition) return structuredPosition;
  const linkedInCardPositionMatches = [
    ...compact.matchAll(
      /([^.\n\r]{4,90})\.\s+(.{2,90}?)\.\s+(?:solicitado|applied on)\b/gi,
    ),
  ];

  for (const match of linkedInCardPositionMatches) {
    const position = cleanupPosition(match[1] ?? "");
    if (position && looksLikeRoleCandidate(position)) return position;
  }

  const patterns = [
    /solicitud en indeed\s*:\s*([^\n|:]{2,120})/i,
    /thank\s+you\s+(?:for|in)\s+your\s+interest\s+in\s+(?:the\s+)?([^\n.!?]{2,90}?)\s+position\s+(?:at|with|for)\s+/i,
    /thank\s+you\s+(?:for|in)\s+your\s+interest\s+in\s+(?:the\s+)?([^\n.!?]{2,90}?)\s+(?:role|vacancy)\b/i,
    /tu solicitud para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /tu candidatura para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /has enviado correctamente tu (?:candidatura|solicitud) para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)?\s+([^\n]{2,130}?)\s+en\s+/i,
    /hemos recibido correctamente tu (?:candidatura|solicitud) para el puesto(?: de)?\s+([^\n.!?]{2,130}?)(?:\s+position\b|[.!?,\n\r]|$)/i,
    /next\s+steps?\s+on\s+your\s+application\s*[-:–—]\s*([^\n|:]{2,130})/i,
    /thanks?\s+for\s+applying\s+to\s+(?:the\s+)?([^\n.!?]{2,130}?)\s+(?:role|position)\b/i,
    /thank\s+you\s+for\s+applying\s+to\s+(?:the\s+)?([^\n.!?]{2,130}?)\s+(?:role|position)\b/i,
    /(?:take\s+the\s+next\s+step|next\s+step)\s*[:\-–—]?\s*(?:a\s+short\s+)?(?:ai[- ]led\s+)?interview\s+(?:for|for\s+the)\s+([^\n.!?]{2,130})/i,
    /thank\s+you\s+for\s+your\s+interest\s+in\s+the\s+([^\n.!?]{2,130}?)\s+position\s+(?:at|with)\s+/i,
    /thanks\s+for\s+your\s+interest\s+in\s+the\s+([^\n.!?]{2,130}?)\s+position\s+(?:at|with)\s+/i,
    /successfully\s+received\s+your\s+application\s+for\s+the\s+([^\n.!?]{2,130}?)(?:\s+position|\s+role|[.!?,\n\r]|$)/i,
    /we\s+have\s+successfully\s+received\s+your\s+application\s+for\s+the\s+([^\n.!?]{2,130}?)(?:\s+position|\s+role|[.!?,\n\r]|$)/i,
    /your\s+(?:recent\s+job\s+)?application\s+for\s+([\s\S]{2,130}?)\s*(?:-\s*\d+)?\s+has\s+been\s+sent/i,
    /application\s+for\s+([\s\S]{2,130}?)\s*(?:-\s*\d+)?\s+has\s+been\s+sent/i,
    /your\s+recent\s+job\s+application\s+for\s+([\s\S]{2,130}?)(?:\s+-\s*\d+|[.!?,\n\r]|$)/i,
    /we\s+received\s+your\s+(?:job\s+)?application\s+for\s+([\s\S]{2,130}?)(?:\s+-\s*\d+|[.!?,\n\r]|$)/i,
    /your\s+application\s+for\s+([\s\S]{2,130}?)(?:\s+(?:at|with)\s+|[.!?,\n\r]|$)/i,
    /update on your application for the role of ([^-\n.!?]{2,130}?)\s+with\s+/i,
    /(?:application for|applied for|recent application for|for the role of|for the position of|position of|role of)\s+([\s\S]{2,130}?)(?:\s+(?:at|with)\s+|[.!?,\n\r]|$)/i,
    /(?:solicitud para|candidatura para|postulacion para|aplicacion para|puesto(?: de)?|rol de|vacante de)\s+([^\n.!?]{2,130})(?:\s+en\s+|[.!?,\n\r]|$)/i,
    /(?:you applied|has aplicado|te postulaste)\s+(?:to|for|a|para)\s+([^\n.!?]{2,130})(?:\s+(?:at|with|en)\s+|[.!?,\n\r]|$)/i,
    /(?:regarding|about)\s+your\s+application\s+for\s+([^\n.!?]{2,130})(?:[.!?,\n\r]|$)/i,
    /(?:interview for|assessment for|coding challenge for)\s+([^\n.!?]{2,130})(?:\s+(?:at|with)\s+|[.!?,\n\r]|$)/i,
    /(?:entrevista para|evaluacion para|prueba tecnica para)\s+([^\n.!?]{2,130})(?:\s+en\s+|[.!?,\n\r]|$)/i,
    /(?:position|role|job title|puesto|cargo)\s*[:\-–—]\s*([^\n]{2,130})/i,
  ];

  for (const pattern of patterns) {
    const value = cleanupPosition(
      (combined.match(pattern) ?? compact.match(pattern))?.[1] ?? "",
    );
    if (value) return value;
  }

  return null;
}

function parseEnglishMonthDate(value: string): Date | null {
  const cleaned = value
    .replace(
      /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b,?/gi,
      " ",
    )
    .replace(/\b(CEST|CET|GMT|BST|UTC)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSpanishMonthDate(value: string): Date | null {
  const months: Record<string, number> = {
    enero: 0,
    ene: 0,
    febrero: 1,
    feb: 1,
    marzo: 2,
    mar: 2,
    abril: 3,
    abr: 3,
    mayo: 4,
    may: 4,
    junio: 5,
    jun: 5,
    julio: 6,
    jul: 6,
    agosto: 7,
    ago: 7,
    septiembre: 8,
    setiembre: 8,
    sep: 8,
    octubre: 9,
    oct: 9,
    noviembre: 10,
    nov: 10,
    diciembre: 11,
    dic: 11,
  };
  const match = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(
      /(\d{1,2})\s*(?:de\s*)?([a-z]+)\s*(?:de\s*)?(\d{4})?(?:\s*[·,\-–—]?\s*(\d{1,2}):(\d{2}))?/i,
    );
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = months[match[2]];
  if (month === undefined) return null;
  const year = match[3]
    ? Number.parseInt(match[3], 10)
    : new Date().getFullYear();
  const hour = match[4] ? Number.parseInt(match[4], 10) : 9;
  const minute = match[5] ? Number.parseInt(match[5], 10) : 0;
  return new Date(year, month, day, hour, minute);
}

function extractDeadline(text: string): Date | null {
  const nowYear = new Date().getFullYear();
  const normalized = normalizeForMatching(text);

  const absolutePatternOne =
    /(?:deadline|complete by|due by|before|by|fecha limite|fecha límite|antes del?|para el?)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+\s+\d{1,2},?\s+\d{4})/i;
  const absolutePatternTwo =
    /(?:deadline|complete by|due by|before|by|fecha limite|fecha límite|antes del?|para el?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;
  const relativePattern =
    /(?:within|en un plazo de|dentro de)\s+(\d{1,2})\s+(?:days|business days|dias|días|dias habiles|días hábiles)/i;

  const absolute =
    text.match(absolutePatternOne)?.[1] ??
    text.match(absolutePatternTwo)?.[1] ??
    normalized.match(absolutePatternOne)?.[1] ??
    normalized.match(absolutePatternTwo)?.[1];
  if (absolute) {
    const parsed = new Date(absolute);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const relativeDays = normalized.match(relativePattern)?.[1];
  if (relativeDays) {
    const date = new Date();
    date.setDate(date.getDate() + Number.parseInt(relativeDays, 10));
    return date;
  }

  const monthDay = text.match(
    /(?:deadline|complete by|due by|before|by)\s+([A-Z][a-z]+\s+\d{1,2})(?:[.!?,\n\r]|$)/i,
  )?.[1];
  if (monthDay) {
    const parsed = new Date(`${monthDay}, ${nowYear}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const englishEventDate =
    text.match(
      /\b(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b,?\s+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i,
    )?.[1] ??
    text.match(
      /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    )?.[1];
  if (englishEventDate) {
    const parsed = parseEnglishMonthDate(englishEventDate);
    if (parsed) return parsed;
  }

  const spanishEventDate =
    text.match(
      /\b(?:lun|lunes|mar|martes|mie|miercoles|miércoles|jue|jueves|vie|viernes|sab|sáb|sabado|sábado|dom|domingo)\b,?\s+(\d{1,2}\s*(?:de\s*)?[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,12}(?:\s*(?:de\s*)?\d{4})?(?:\s*[·,\-–—]?\s*\d{1,2}:\d{2})?)/i,
    )?.[1] ??
    text.match(
      /\b(\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s+de\s+\d{4}(?:\s+\d{1,2}:\d{2})?)/i,
    )?.[1];
  if (spanishEventDate) {
    const parsed = parseSpanishMonthDate(spanishEventDate);
    if (parsed) return parsed;
  }

  return null;
}

function isRecommendationOrAlert(
  normalizedText: string,
  from: string,
  subject: string,
): boolean {
  // Dedicated alert / connection-request addresses are NEVER application
  // updates, regardless of body content. Real application confirmations come
  // from a different address, so this is safe.
  const fromLower = from.toLowerCase();
  if (
    fromLower.includes("jobalerts-noreply@") ||
    fromLower.includes("invitations@linkedin.com")
  ) {
    return true;
  }

  const fromNormalized = normalizeForMatching(from);
  const subjectNormalized = normalizeForMatching(subject);
  const platformSender = [...jobBoardDomains, "jobalerts-noreply"].some(
    (part) => fromNormalized.includes(part),
  );
  const obviousText = containsAny(normalizedText, nonApplicationPhrases);
  const obviousSubject = containsAny(subjectNormalized, [
    "job opportunity",
    "job opportunity from",
    "job opportunities",
    "ad response",
    "re ad response",
    "suitable application for",
    "job alert",
    "job alerts",
    "alerta de empleo",
    "alertas de empleo",
    "our recommendation",
    "recommended",
    "recommended jobs",
    "hire feed",
    "don't forget to apply",
    "dont forget to apply",
    "solicitar ahora",
    "jobs in",
    "new jobs",
    "jobs for you",
    "new job opportunities",
    "empleos para ti",
    "ofertas para ti",
    "nuevas ofertas",
    "vacantes para ti",
  ]);

  return (
    obviousText ||
    obviousSubject ||
    (platformSender &&
      containsAny(normalizedText, [
        "recommended",
        "recommendation",
        "job alert",
        "alertas de empleo",
        "apply now",
        "solicitar ahora",
        "don't forget to apply",
        "dont forget to apply",
        "not yet applied",
      ]))
  );
}

function hasStrongRejection(normalizedText: string): boolean {
  const hits = countHits(normalizedText, rejectionPhrases);
  if (hits > 0) return true;

  // "Unfortunately" and "regret" are too broad on their own, because many
  // confirmations say things like "unfortunately we cannot meet everyone".
  return (
    /\b(unfortunately|we regret)\b.{0,120}\b(not selected|unsuccessful|not moving forward|won'?t be moving forward|will not be moving forward|other candidates|unable to progress|not proceeding|not progressed|cannot progress|position has been filled)\b/i.test(
      normalizedText,
    ) ||
    /\b(after careful consideration)\b.{0,180}\b(other candidates|not selected|unsuccessful|not moving forward|unable to progress|not proceeding|not be progressing)\b/i.test(
      normalizedText,
    ) ||
    /\b(hemos decidido|lamentablemente|lo sentimos)\b.{0,180}\b(no seguir|no continuaremos|no podemos continuar|no has sido seleccionado|no ha sido seleccionada|no podemos avanzar)\b/i.test(
      normalizedText,
    )
  );
}

function isTaskCompletion(normalizedText: string): boolean {
  return containsAny(normalizedText, taskCompletionPhrases);
}

function hasTaskAction(normalizedText: string): boolean {
  return containsAny(normalizedText, taskActionPhrases);
}

function isHarmlessConfirmationNoise(normalizedText: string): boolean {
  return containsAny(normalizedText, harmlessApplicationNoise);
}

function classifyBySignals(
  normalizedText: string,
  recommendationOrAlert: boolean,
): MatchResult | null {
  const isRejection = hasStrongRejection(normalizedText);
  const isOffer = containsAny(normalizedText, offerPhrases);
  const isApplicationConfirmation =
    hasApplicationConfirmationSignal(normalizedText);
  const isViewedOrRead = containsAny(normalizedText, viewedOrReadPhrases);
  const isApplicationUpdate = containsAny(
    normalizedText,
    applicationUpdatePhrases,
  );
  const taskDone = isTaskCompletion(normalizedText);

  // Terminal/explicit outcomes win even if the email came from a job board.
  if (isRejection) {
    return {
      status: "REJECTED",
      eventType: "REJECTION_RECEIVED",
      taskType: null,
      confidence:
        0.91 +
        Math.min(0.06, countHits(normalizedText, rejectionPhrases) * 0.01),
      summary: "Rejection or unsuccessful application email detected.",
    };
  }

  if (isOffer) {
    return {
      status: "OFFER",
      eventType: "OFFER_RECEIVED",
      taskType: null,
      confidence:
        0.88 + Math.min(0.04, countHits(normalizedText, offerPhrases) * 0.01),
      summary: "Job offer email detected.",
    };
  }

  // A task-completion confirmation should close existing tasks and return the
  // application to pending. It is not a new task.
  if (taskDone) {
    return {
      status: "APPLIED",
      eventType: "FOLLOW_UP",
      taskType: null,
      confidence:
        0.86 +
        Math.min(0.05, countHits(normalizedText, taskCompletionPhrases) * 0.01),
      summary:
        "Task completion confirmation detected. Existing matching tasks should be marked done.",
    };
  }

  // Job ads/recommendations must not become application confirmations just
  // because the email also contains phrases like "application has been sent".
  if (recommendationOrAlert) {
    return null;
  }

  // Clear next-step/action emails should create tasks even if they also say "thanks for applying".
  // This catches LinkedIn/recruiter messages like "Next steps on your application" and
  // "we'd love for you to take the next step: a short AI-led interview".
  const earlyActionRequired = hasTaskAction(normalizedText);
  const earlyAiComplete = containsAny(
    normalizedText,
    aiInterviewCompletePhrases,
  );
  const earlyInterviewConcrete = containsAny(normalizedText, [
    "interview request",
    "interview invitation",
    "interview invite",
    "move forward with the interview process",
    "excited to move forward with the interview process",
    "next steps on your application",
    "next step on your application",
    "take the next step",
    "select a time through the calendly link",
    "calendly link",
    "introductory conversation",
    "introduction interview",
    "event name introduction interview",
    "interview has been scheduled",
    "your interview is scheduled",
    "upcoming interview",
    "zoom web conference",
    "entrevista programada",
    "entrevista introductoria",
    "siguientes pasos de tu solicitud",
    "avanzar con el proceso de entrevista",
  ]);
  const earlyCoding =
    containsAny(normalizedText, codingTaskPhrases) &&
    earlyActionRequired &&
    !taskDone;
  const earlyAiInterview =
    containsAny(normalizedText, aiInterviewPhrases) &&
    (earlyActionRequired || earlyInterviewConcrete) &&
    !earlyAiComplete &&
    !taskDone;
  const earlyInterview =
    containsAny(normalizedText, strongInterviewPhrases) &&
    (earlyActionRequired || earlyInterviewConcrete) &&
    !taskDone;
  const earlyAssessment =
    containsAny(normalizedText, assessmentPhrases) &&
    earlyActionRequired &&
    !taskDone;

  if (!recommendationOrAlert && earlyCoding) {
    return {
      status: "CODING_TASK",
      eventType: "CODING_TEST_RECEIVED",
      taskType: "CODING_TASK",
      confidence:
        0.9 +
        Math.min(0.05, countHits(normalizedText, codingTaskPhrases) * 0.01),
      summary: "Coding task or technical assessment action required.",
    };
  }

  if (!recommendationOrAlert && earlyAiInterview) {
    return {
      status: "AI_INTERVIEW",
      eventType: "AI_INTERVIEW_INVITE",
      taskType: "AI_INTERVIEW",
      confidence:
        0.9 +
        Math.min(0.05, countHits(normalizedText, aiInterviewPhrases) * 0.01),
      summary: "AI/video interview action required.",
    };
  }

  if (!recommendationOrAlert && earlyInterview) {
    return {
      status: "INTERVIEW",
      eventType: "INTERVIEW_INVITE",
      taskType: "NORMAL_INTERVIEW",
      confidence:
        0.87 +
        Math.min(
          0.06,
          countHits(normalizedText, strongInterviewPhrases) * 0.01,
        ),
      summary: "Interview scheduling or attendance action required.",
    };
  }

  if (!recommendationOrAlert && earlyAssessment) {
    return {
      status: "ASSESSMENT",
      eventType: "ASSESSMENT_RECEIVED",
      taskType: "ASSESSMENT",
      confidence:
        0.84 +
        Math.min(0.05, countHits(normalizedText, assessmentPhrases) * 0.01),
      summary: "Assessment or online test action required.",
    };
  }

  // Viewed/read updates must win before generic confirmation phrases.
  // LinkedIn viewed emails often include phrases like "solicitado el", which
  // can otherwise look like a fresh application confirmation.
  if (isViewedOrRead) {
    return {
      status: "APPLIED",
      eventType: "FOLLOW_UP",
      taskType: null,
      confidence:
        0.82 +
        Math.min(0.08, countHits(normalizedText, viewedOrReadPhrases) * 0.01),
      summary: "Application viewed/read follow-up detected. No task required.",
    };
  }

  // Application confirmations should be pending, not tasks. Do this before task checks
  // because confirmations often mention "next steps", "interview", or "assessment" as possible future steps.
  if (isApplicationConfirmation) {
    return {
      status: "APPLIED",
      eventType: "APPLICATION_CONFIRMED",
      taskType: null,
      confidence:
        0.88 +
        Math.min(
          0.06,
          countHits(normalizedText, applicationConfirmationPhrases) * 0.01,
        ),
      summary: "Application confirmation email detected.",
    };
  }

  if (
    isViewedOrRead ||
    isApplicationUpdate ||
    isHarmlessConfirmationNoise(normalizedText)
  ) {
    return {
      status: "APPLIED",
      eventType: "FOLLOW_UP",
      taskType: null,
      confidence:
        0.76 +
        Math.min(
          0.08,
          (countHits(normalizedText, viewedOrReadPhrases) +
            countHits(normalizedText, applicationUpdatePhrases)) *
            0.01,
        ),
      summary: "Application follow-up/update detected. No task required.",
    };
  }

  // If this is clearly a job alert/recommendation, never create a task from generic listing text.
  if (recommendationOrAlert) return null;

  const actionRequired = hasTaskAction(normalizedText);
  const aiComplete = containsAny(normalizedText, aiInterviewCompletePhrases);
  const scheduledOrConcreteInterview = containsAny(normalizedText, [
    "interview request",
    "interview invitation",
    "interview invite",
    "move forward with the interview process",
    "excited to move forward with the interview process",
    "introductory conversation",
    "introduction interview",
    "event name introduction interview",
    "interview has been scheduled",
    "your interview is scheduled",
    "upcoming interview",
    "zoom web conference",
    "entrevista programada",
    "entrevista introductoria",
  ]);
  const isCoding =
    containsAny(normalizedText, codingTaskPhrases) &&
    actionRequired &&
    !taskDone;
  const isAiInterview =
    containsAny(normalizedText, aiInterviewPhrases) &&
    actionRequired &&
    !aiComplete &&
    !taskDone;
  const isInterview =
    containsAny(normalizedText, strongInterviewPhrases) &&
    (actionRequired || scheduledOrConcreteInterview) &&
    !taskDone;
  const isAssessment =
    containsAny(normalizedText, assessmentPhrases) &&
    actionRequired &&
    !taskDone;

  if (isCoding) {
    return {
      status: "CODING_TASK",
      eventType: "CODING_TEST_RECEIVED",
      taskType: "CODING_TASK",
      confidence:
        0.88 +
        Math.min(0.05, countHits(normalizedText, codingTaskPhrases) * 0.01),
      summary: "Coding task or technical assessment action required.",
    };
  }

  if (isAiInterview) {
    return {
      status: "AI_INTERVIEW",
      eventType: "AI_INTERVIEW_INVITE",
      taskType: "AI_INTERVIEW",
      confidence:
        0.87 +
        Math.min(0.05, countHits(normalizedText, aiInterviewPhrases) * 0.01),
      summary: "AI/video interview action required.",
    };
  }

  if (isInterview) {
    return {
      status: "INTERVIEW",
      eventType: "INTERVIEW_INVITE",
      taskType: "NORMAL_INTERVIEW",
      confidence:
        0.83 +
        Math.min(
          0.05,
          countHits(normalizedText, strongInterviewPhrases) * 0.01,
        ),
      summary: "Interview scheduling or attendance action required.",
    };
  }

  if (isAssessment) {
    return {
      status: "ASSESSMENT",
      eventType: "ASSESSMENT_RECEIVED",
      taskType: "ASSESSMENT",
      confidence:
        0.8 +
        Math.min(0.05, countHits(normalizedText, assessmentPhrases) * 0.01),
      summary: "Assessment or online test action required.",
    };
  }

  return null;
}

function hasGenericJobApplicationSignal(normalizedText: string): boolean {
  // Keep this strict. Generic recruiter emails about a "role", "job spec", or
  // "position" are too noisy. Do not treat job titles like "Application Developer"
  // as a user application.
  if (containsAny(normalizedText, nonApplicationPhrases)) return false;

  return (
    containsAny(normalizedText, [
      "your application",
      "your recent application",
      "your recent job application",
      "my application",
      "we received your application",
      "we have received your application",
      "application has been",
      "application was submitted",
      "application submitted",
      "applied for",
      "applied to",
      "you applied",
      "tu solicitud",
      "tu candidatura",
      "tu postulacion",
      "tu postulación",
      "hemos recibido tu solicitud",
      "hemos recibido tu candidatura",
      "hemos recibido correctamente tu candidatura",
      "hemos recibido correctamente tu solicitud",
      "has enviado correctamente tu candidatura",
      "has enviado correctamente tu solicitud",
      "candidatura recibida",
      "solicitud recibida",
    ]) ||
    /\bapplication\s+for\s+[a-z0-9 .,+#&\-/]{2,120}\s+(has been|was|is|at|with)\b/i.test(
      normalizedText,
    )
  );
}

function shouldSkipAmbiguousRecruiterEmail(
  normalizedText: string,
  subject: string,
): boolean {
  const normalizedSubject = normalizeForMatching(subject);
  return (
    containsAny(normalizedSubject, [
      "role discussed",
      "job spec",
      "role spec",
    ]) ||
    containsAny(normalizedText, [
      "please carefully review the attached job spec",
      "confirm you are happy for me to represent you",
      "keep the company name between us",
      "not to represent you",
    ])
  );
}

function extractReferenceIds(text: string): string[] {
  const ids = new Set<string>();

  const patterns: RegExp[] = [
    // "Ref" / "Reference" / "Requisition" / "Req" + ID (separator required)
    /\b(?:reference|requisition|ref|req)\s*(?:id|no|number|code)?[:#.\s]+([A-Za-z0-9][A-Za-z0-9\-_/]{2,24})\b/gi,
    // "Job/Vacancy/Posting/Position" must be qualified (id/no/number/code/ref)
    /\b(?:job|vacancy|posting|position)\s*(?:id|no|number|code|reference|ref)[:#.\s]+([A-Za-z0-9][A-Za-z0-9\-_/]{2,24})\b/gi,
    // Spanish: Referencia / ID de la oferta / Ref. oferta
    /\b(?:referencia|id\s*de\s*la\s*oferta|ref\.?\s*oferta)[:#.\s]+([A-Za-z0-9][A-Za-z0-9\-_/]{2,24})\b/gi,
    // Workday-style requisition (e.g. JR-0012345)
    /\b(JR[-_]?\d{4,})\b/gi,
    // Greenhouse job id embedded in a URL (?gh_jid=12345)
    /[?&]gh_jid=(\d{4,})/gi,
    // Lever posting UUID in a URL
    /jobs\.lever\.co\/[^/\s]+\/([0-9a-fA-F-]{12,})/gi,
  ];

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const raw = (match[1] ?? "").toUpperCase().replace(/[\s#.]/g, "");
      // Require a digit so we never capture plain words like "REF: TEAM".
      if (raw.length >= 3 && /\d/.test(raw)) {
        ids.add(raw);
      }
    }
  }

  return Array.from(ids).slice(0, 10);
}

export function classifyEmail(email: RawEmail): Classification {
  const result = classifyEmailInner(email);
  const refIds = extractReferenceIds(
    `${email.subject || ""}\n${email.body || email.snippet || ""}`,
  );
  return refIds.length > 0 ? { ...result, refIds } : result;
}

function classifyEmailInner(email: RawEmail): Classification {
  const subject = email.subject || "";
  const body = email.body || email.snippet || "";
  const textWithNewlines = `${subject}\n${body}`;
  const compactText = cleanWhitespace(textWithNewlines);
  const normalizedText = normalizeForMatching(compactText);

  const recommendationOrAlert = isRecommendationOrAlert(
    normalizedText,
    email.from,
    subject,
  );
  const signal = classifyBySignals(normalizedText, recommendationOrAlert);

  // For pure alerts/recommendations/reminders, do not extract company/role into the Review Inbox.
  // That reduces noise like eFinancialCareers, Glassdoor, LinkedIn alerts, and "solicitar ahora" emails.
  if (recommendationOrAlert && !signal) {
    return {
      company: null,
      position: null,
      status: "UNKNOWN",
      eventType: "GENERAL_UPDATE",
      taskType: null,
      deadline: null,
      confidence: 0.06,
      summary:
        "Job alert, reminder, or job recommendation detected, not an application update.",
    };
  }

  const company = extractCompany(textWithNewlines, email.from, subject);
  const position = extractPosition(textWithNewlines, subject);
  const deadline = extractDeadline(textWithNewlines);

  if (signal) {
    const confidenceBonus =
      (company ? 0.03 : 0) + (position ? 0.03 : 0) + (deadline ? 0.02 : 0);
    return {
      company,
      position,
      status: signal.status,
      eventType: signal.eventType,
      taskType: signal.taskType,
      deadline,
      confidence: Math.min(0.98, signal.confidence + confidenceBonus),
      summary: signal.summary,
    };
  }

  if (shouldSkipAmbiguousRecruiterEmail(normalizedText, subject)) {
    return {
      company: null,
      position: null,
      status: "UNKNOWN",
      eventType: "GENERAL_UPDATE",
      taskType: null,
      deadline: null,
      confidence: 0.12,
      summary:
        "Recruiter/job-spec email detected, but not a tracked application update.",
    };
  }

  if (hasGenericJobApplicationSignal(normalizedText)) {
    return {
      company,
      position,
      status: "UNKNOWN",
      eventType: "GENERAL_UPDATE",
      taskType: null,
      deadline,
      confidence: company || position ? 0.36 : 0.18,
      summary:
        "Possible job-application email detected, but the exact status is unclear.",
    };
  }

  return {
    company,
    position,
    status: "UNKNOWN",
    eventType: "GENERAL_UPDATE",
    taskType: null,
    deadline,
    confidence: 0.08,
    summary: "No strong job-application signal detected.",
  };
}

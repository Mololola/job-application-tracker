-- AlterTable
ALTER TABLE "Application" ADD COLUMN "atsSlugsJson" TEXT;
ALTER TABLE "Application" ADD COLUMN "companyNormalized" TEXT;
ALTER TABLE "Application" ADD COLUMN "refIdsJson" TEXT;
ALTER TABLE "Application" ADD COLUMN "senderDomainsJson" TEXT;

-- AlterTable
ALTER TABLE "EmailCandidate" ADD COLUMN "inReplyToHeader" TEXT;
ALTER TABLE "EmailCandidate" ADD COLUMN "messageIdHeader" TEXT;
ALTER TABLE "EmailCandidate" ADD COLUMN "refIdsJson" TEXT;
ALTER TABLE "EmailCandidate" ADD COLUMN "referencesHeader" TEXT;

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "emailThreadId" TEXT,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "emailDate" DATETIME,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "trigger" TEXT,
    "eventType" TEXT,
    "status" TEXT,
    "confidence" REAL,
    "company" TEXT,
    "position" TEXT,
    "refIdsJson" TEXT,
    "matchedApplicationId" TEXT,
    "bestScore" REAL,
    "secondScore" REAL,
    "scoreGap" REAL,
    "trace" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DecisionLog_userId_createdAt_idx" ON "DecisionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLog_gmailMessageId_idx" ON "DecisionLog"("gmailMessageId");

-- CreateIndex
CREATE INDEX "DecisionLog_decision_idx" ON "DecisionLog"("decision");

-- CreateIndex
CREATE INDEX "Application_companyNormalized_idx" ON "Application"("companyNormalized");

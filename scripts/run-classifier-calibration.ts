import fs from "node:fs";
import path from "node:path";
import { classifyEmail } from "../lib/classifier";

type CalibrationCase = {
  id: string;
  language?: string;
  category?: string;
  subject?: string;
  senderHint?: string;
  from?: string;
  bodySnippet?: string;
  body?: string;
  expected?: {
    status?: string | null;
    eventType?: string | null;
    taskType?: string | null;
    shouldIgnore?: boolean;
    shouldCreateTask?: boolean;
    shouldCreateNewApplication?: boolean;
    shouldGoToReview?: boolean;
  };
  extraction?: {
    company?: string | null;
    position?: string | null;
  };
  notes?: string;
};

type TestResult = {
  id: string;
  passed: boolean;
  warnings: string[];
  errors: string[];
};

const DATASET_PATH = path.join(
  process.cwd(),
  "docs",
  "calibration",
  "email-calibration-cases.jsonl",
);

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function readJsonl(filePath: string): CalibrationCase[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Calibration dataset not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line, index) => {
      try {
        return JSON.parse(line) as CalibrationCase;
      } catch (error) {
        throw new Error(
          `Invalid JSON on line ${index + 1} in ${filePath}:\n${line}`,
        );
      }
    });
}

function looksIgnored(result: ReturnType<typeof classifyEmail>): boolean {
  return (
    result.status === "UNKNOWN" &&
    result.eventType === "GENERAL_UPDATE" &&
    result.taskType === null &&
    result.confidence <= 0.2
  );
}

function isUnknownLike(value: string | null | undefined): boolean {
  if (!value) return true;

  const normalized = normalize(value);

  return (
    normalized === "unknown" ||
    normalized === "unknown company" ||
    normalized === "unknown position" ||
    normalized.startsWith("unknown_or")
  );
}

function compareCase(testCase: CalibrationCase): TestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = classifyEmail({
    from: testCase.senderHint ?? testCase.from ?? "",
    subject: testCase.subject ?? "",
    body: testCase.bodySnippet ?? testCase.body ?? "",
    snippet: testCase.bodySnippet ?? testCase.body ?? "",
    date: null,
  });

  const expected = testCase.expected ?? {};
  const extraction = testCase.extraction ?? {};

  const expectedIgnore =
    expected.shouldIgnore === true ||
    normalize(expected.eventType) === "ignored" ||
    normalize(expected.eventType) === "ignore" ||
    normalize(expected.status) === "ignored" ||
    normalize(expected.status) === "ignore";

  if (expectedIgnore) {
    if (!looksIgnored(result)) {
      errors.push(
        `Expected ignored/low-confidence email, got status=${result.status}, eventType=${result.eventType}, confidence=${result.confidence}`,
      );
    }

    if (result.taskType !== null) {
      errors.push(`Expected no task, got taskType=${result.taskType}`);
    }

    return {
      id: testCase.id,
      passed: errors.length === 0,
      warnings,
      errors,
    };
  }

  if (expected.status && result.status !== expected.status) {
    errors.push(`Expected status=${expected.status}, got ${result.status}`);
  }

  if (expected.eventType && result.eventType !== expected.eventType) {
    errors.push(
      `Expected eventType=${expected.eventType}, got ${result.eventType}`,
    );
  }

  const expectedTaskType = expected.taskType ?? null;
  if (result.taskType !== expectedTaskType) {
    errors.push(
      `Expected taskType=${expectedTaskType}, got ${result.taskType}`,
    );
  }

  if (expected.shouldCreateTask === true && result.taskType === null) {
    errors.push("Expected a task to be created, but taskType is null");
  }

  if (expected.shouldCreateTask === false && result.taskType !== null) {
    errors.push(`Expected no task, but got taskType=${result.taskType}`);
  }

  if (
    extraction.company &&
    !isUnknownLike(extraction.company) &&
    normalize(result.company) !== normalize(extraction.company)
  ) {
    warnings.push(
      `Company differs. Expected "${extraction.company}", got "${result.company}"`,
    );
  }

  if (
    extraction.position &&
    !isUnknownLike(extraction.position) &&
    normalize(result.position) !== normalize(extraction.position)
  ) {
    warnings.push(
      `Position differs. Expected "${extraction.position}", got "${result.position}"`,
    );
  }

  return {
    id: testCase.id,
    passed: errors.length === 0,
    warnings,
    errors,
  };
}

function main() {
  const cases = readJsonl(DATASET_PATH);
  const strictMode = process.argv.includes("--strict");

  let passed = 0;
  let failed = 0;
  let warningCount = 0;

  console.log(`\nRunning classifier calibration tests...`);
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log(`Cases: ${cases.length}\n`);

  for (const testCase of cases) {
    const result = compareCase(testCase);

    if (result.passed) {
      passed += 1;
      console.log(`✅ PASS ${result.id}`);
    } else {
      failed += 1;
      console.log(`❌ FAIL ${result.id}`);

      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      warningCount += result.warnings.length;
      for (const warning of result.warnings) {
        console.log(`   ⚠️  ${warning}`);
      }
    }
  }

  console.log(`\nSummary`);
  console.log(`Passed:   ${passed}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Warnings: ${warningCount}`);

  if (failed > 0 && strictMode) {
    process.exit(1);
  }

  if (failed > 0 && !strictMode) {
    console.log("");
    console.log(
      "Note: Some calibration cases failed. This command is running in report mode, so it will not fail the process.",
    );
    console.log(
      "Use `npm run test:classifier:strict` when you want failures to exit with code 1.",
    );
  }
}

main();

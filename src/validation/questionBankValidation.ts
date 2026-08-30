import type { QuestionBank } from "../domain/questionBank.ts";
import { manifestSchema, type Manifest } from "../schemas/manifest.ts";
import { questionsSchema, type Question } from "../schemas/question.ts";

export interface QuestionPackSource {
  directoryName: string;
  manifest: unknown;
  questions: unknown;
  introduction?: string;
}

export interface ValidationIssue {
  bank: string;
  file: string;
  question?: string;
  field: string;
  reason: string;
}

interface ParsedQuestionPack {
  source: QuestionPackSource;
  manifest: Manifest;
  questions: Question[];
}

export class QuestionPackValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(formatValidationIssues(issues));
    this.name = "QuestionPackValidationError";
    this.issues = issues;
  }
}

export function validateQuestionPacks(
  sources: readonly QuestionPackSource[],
): QuestionBank[] {
  const issues: ValidationIssue[] = [];
  const parsedPacks: ParsedQuestionPack[] = [];
  const parsedManifests: Array<{
    source: QuestionPackSource;
    manifest: Manifest;
  }> = [];

  for (const source of sources) {
    const bank = getBankLabel(source);
    const manifestResult = manifestSchema.safeParse(source.manifest);

    if (!manifestResult.success) {
      for (const issue of manifestResult.error.issues) {
        issues.push({
          bank,
          file: "manifest.json",
          field: formatFieldPath(issue.path),
          reason: issue.message,
        });
      }
    } else {
      parsedManifests.push({ source, manifest: manifestResult.data });
    }

    const questionsResult = questionsSchema.safeParse(source.questions);
    const questionsFile = manifestResult.success
      ? manifestResult.data.files.questions
      : "questions.json";

    if (!questionsResult.success) {
      for (const issue of questionsResult.error.issues) {
        const questionIndex = getQuestionIndex(issue.path);
        issues.push({
          bank,
          file: questionsFile,
          question:
            questionIndex === undefined
              ? undefined
              : getQuestionLabel(source.questions, questionIndex),
          field: formatQuestionFieldPath(issue.path),
          reason: issue.message,
        });
      }
    }

    if (manifestResult.success && questionsResult.success) {
      parsedPacks.push({
        source,
        manifest: manifestResult.data,
        questions: questionsResult.data,
      });
    }
  }

  validateUniqueBankIds(parsedManifests, issues);

  for (const pack of parsedPacks) {
    validateQuestionSemantics(pack, issues);
  }

  if (issues.length > 0) {
    throw new QuestionPackValidationError(issues);
  }

  return parsedPacks.map(toRuntimeQuestionBank);
}

export function formatValidationIssues(issues: readonly ValidationIssue[]) {
  const formattedIssues = issues.map((issue) => {
    const lines = [
      "Bank:",
      issue.bank,
      "",
      "File:",
      issue.file,
    ];

    if (issue.question) {
      lines.push("", "Question:", issue.question);
    }

    lines.push("", "Field:", issue.field, "", "Reason:", issue.reason);
    return lines.join("\n");
  });

  return `Question Pack validation failed\n\n${formattedIssues.join(
    "\n\n---\n\n",
  )}`;
}

function validateUniqueBankIds(
  manifests: ReadonlyArray<{
    source: QuestionPackSource;
    manifest: Manifest;
  }>,
  issues: ValidationIssue[],
) {
  const seenBankIds = new Set<string>();

  for (const { source, manifest } of manifests) {
    if (seenBankIds.has(manifest.id)) {
      issues.push({
        bank: manifest.id || source.directoryName,
        file: "manifest.json",
        field: "id",
        reason: `Question Bank ID "${manifest.id}" is duplicated.`,
      });
    } else {
      seenBankIds.add(manifest.id);
    }
  }
}

function validateQuestionSemantics(
  pack: ParsedQuestionPack,
  issues: ValidationIssue[],
) {
  const seenQuestionIds = new Set<string>();
  const bank = pack.manifest.id || pack.source.directoryName;
  const file = pack.manifest.files.questions;

  for (const question of pack.questions) {
    if (seenQuestionIds.has(question.id)) {
      issues.push({
        bank,
        file,
        question: question.id,
        field: "id",
        reason: `Question ID "${question.id}" is duplicated.`,
      });
    } else {
      seenQuestionIds.add(question.id);
    }

    if (question.options.length < 2) {
      issues.push({
        bank,
        file,
        question: question.id,
        field: "options",
        reason: "A question must contain at least two options.",
      });
    }

    const seenOptionIds = new Set<string>();
    for (const [optionIndex, option] of question.options.entries()) {
      if (seenOptionIds.has(option.id)) {
        issues.push({
          bank,
          file,
          question: question.id,
          field: `options[${optionIndex}].id`,
          reason: `Option ID "${option.id}" is duplicated.`,
        });
      } else {
        seenOptionIds.add(option.id);
      }
    }

    const seenCorrectAnswers = new Set<string>();
    for (const [answerIndex, answer] of question.correctAnswers.entries()) {
      if (seenCorrectAnswers.has(answer)) {
        issues.push({
          bank,
          file,
          question: question.id,
          field: `correctAnswers[${answerIndex}]`,
          reason: `Correct answer "${answer}" is duplicated.`,
        });
      } else {
        seenCorrectAnswers.add(answer);
      }

      if (!seenOptionIds.has(answer)) {
        issues.push({
          bank,
          file,
          question: question.id,
          field: `correctAnswers[${answerIndex}]`,
          reason: `Option "${answer}" does not exist in options.`,
        });
      }
    }

    if (question.type === "single" && question.correctAnswers.length !== 1) {
      issues.push({
        bank,
        file,
        question: question.id,
        field: "correctAnswers",
        reason: "A single question must contain exactly one correct answer.",
      });
    }

    if (question.type === "multiple" && question.correctAnswers.length < 2) {
      issues.push({
        bank,
        file,
        question: question.id,
        field: "correctAnswers",
        reason: "A multiple question must contain at least two correct answers.",
      });
    }
  }
}

function toRuntimeQuestionBank(pack: ParsedQuestionPack): QuestionBank {
  const { files: _files, schemaVersion: _schemaVersion, ...metadata } =
    pack.manifest;

  return {
    ...metadata,
    ...(pack.source.introduction === undefined
      ? {}
      : { introduction: pack.source.introduction }),
    questions: pack.questions,
  };
}

function getBankLabel(source: QuestionPackSource) {
  if (
    typeof source.manifest === "object" &&
    source.manifest !== null &&
    "id" in source.manifest &&
    typeof source.manifest.id === "string"
  ) {
    return source.manifest.id || source.directoryName;
  }

  return source.directoryName;
}

function getQuestionIndex(path: PropertyKey[]) {
  return typeof path[0] === "number" ? path[0] : undefined;
}

function getQuestionLabel(questions: unknown, index: number) {
  if (Array.isArray(questions)) {
    const question = questions[index];
    if (
      typeof question === "object" &&
      question !== null &&
      "id" in question &&
      typeof question.id === "string"
    ) {
      return question.id || `#${index + 1}`;
    }
  }

  return `#${index + 1}`;
}

function formatFieldPath(path: PropertyKey[]) {
  return path.length === 0 ? "<root>" : path.map(String).join(".");
}

function formatQuestionFieldPath(path: PropertyKey[]) {
  const fieldPath = typeof path[0] === "number" ? path.slice(1) : path;
  return formatFieldPath(fieldPath);
}

import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { QuestionBank } from "../src/domain/questionBank.ts";
import { manifestSchema } from "../src/schemas/manifest.ts";
import {
  QuestionPackValidationError,
  validateQuestionPacks,
  type QuestionPackSource,
  type ValidationIssue,
} from "../src/validation/questionBankValidation.ts";

export async function validateQuestionBanksAt(
  projectRoot: string,
): Promise<QuestionBank[]> {
  const questionBanksDirectory = resolve(projectRoot, "question-banks");
  const issues: ValidationIssue[] = [];
  const sources: QuestionPackSource[] = [];
  let entries;

  try {
    entries = await readdir(questionBanksDirectory, { withFileTypes: true });
  } catch (error) {
    throw new QuestionPackValidationError([
      {
        bank: "<root>",
        file: "question-banks",
        field: "directory",
        reason: getErrorMessage(error),
      },
    ]);
  }

  const bankDirectories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of bankDirectories) {
    const directoryName = entry.name;
    const bankDirectory = resolve(questionBanksDirectory, directoryName);
    const manifestPath = resolve(bankDirectory, "manifest.json");
    const rawManifest = await readJsonFile(
      manifestPath,
      directoryName,
      "manifest.json",
      "<file>",
      issues,
    );

    if (rawManifest === undefined) {
      continue;
    }

    const manifestResult = manifestSchema.safeParse(rawManifest);
    if (!manifestResult.success) {
      const bank = getRawBankId(rawManifest) || directoryName;
      for (const issue of manifestResult.error.issues) {
        issues.push({
          bank,
          file: "manifest.json",
          field:
            issue.path.length === 0
              ? "<root>"
              : issue.path.map(String).join("."),
          reason: issue.message,
        });
      }
      continue;
    }

    const manifest = manifestResult.data;
    const bank = manifest.id || directoryName;
    const questionsPath = resolveDeclaredFile(
      bankDirectory,
      manifest.files.questions,
      bank,
      "files.questions",
      issues,
    );

    if (!questionsPath) {
      continue;
    }

    const questions = await readJsonFile(
      questionsPath,
      bank,
      manifest.files.questions,
      "files.questions",
      issues,
    );

    if (questions === undefined) {
      continue;
    }

    let introduction: string | undefined;
    if (manifest.files.introduction) {
      const introductionPath = resolveDeclaredFile(
        bankDirectory,
        manifest.files.introduction,
        bank,
        "files.introduction",
        issues,
      );

      if (!introductionPath) {
        continue;
      }

      try {
        introduction = await readFile(introductionPath, "utf8");
      } catch (error) {
        issues.push({
          bank,
          file: manifest.files.introduction,
          field: "files.introduction",
          reason: getErrorMessage(error),
        });
        continue;
      }
    }

    sources.push({
      directoryName,
      manifest: rawManifest,
      questions,
      ...(introduction === undefined ? {} : { introduction }),
    });
  }

  let banks: QuestionBank[] = [];
  let validationIssues: ValidationIssue[] = [];

  try {
    banks = validateQuestionPacks(sources);
  } catch (error) {
    if (error instanceof QuestionPackValidationError) {
      validationIssues = error.issues;
    } else {
      throw error;
    }
  }

  const allIssues = [...issues, ...validationIssues];
  if (allIssues.length > 0) {
    throw new QuestionPackValidationError(allIssues);
  }

  return banks;
}

async function runCli() {
  console.log("Scanning question-banks...\n");

  try {
    const banks = await validateQuestionBanksAt(process.cwd());

    for (const bank of banks) {
      console.log(`✓ ${bank.id}`);
      console.log(`  ${bank.questions.length} questions`);
      console.log("  valid\n");
    }

    console.log("All question banks are valid.");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Unknown validation error.",
    );
    process.exitCode = 1;
  }
}

async function readJsonFile(
  filePath: string,
  bank: string,
  displayFile: string,
  missingField: string,
  issues: ValidationIssue[],
) {
  let content: string;

  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    issues.push({
      bank,
      file: displayFile,
      field: missingField,
      reason: getErrorMessage(error),
    });
    return undefined;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    issues.push({
      bank,
      file: displayFile,
      field: "<root>",
      reason: getErrorMessage(error),
    });
    return undefined;
  }
}

function resolveDeclaredFile(
  bankDirectory: string,
  declaredPath: string,
  bank: string,
  field: "files.questions" | "files.introduction",
  issues: ValidationIssue[],
) {
  if (isAbsolute(declaredPath)) {
    issues.push({
      bank,
      file: "manifest.json",
      field,
      reason: `Path "${declaredPath}" must be relative to its Question Pack directory.`,
    });
    return undefined;
  }

  const resolvedPath = resolve(bankDirectory, declaredPath);
  const relativePath = relative(bankDirectory, resolvedPath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    issues.push({
      bank,
      file: "manifest.json",
      field,
      reason: `Path "${declaredPath}" leaves its Question Pack directory.`,
    });
    return undefined;
  }

  return resolvedPath;
}

function getRawBankId(manifest: unknown) {
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "id" in manifest &&
    typeof manifest.id === "string"
  ) {
    return manifest.id;
  }

  return undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const executedFile = process.argv[1];
if (
  executedFile &&
  pathToFileURL(resolve(executedFile)).href === import.meta.url
) {
  await runCli();
}

import type { QuestionBank } from "../domain/questionBank";
import { manifestSchema } from "../schemas/manifest";
import {
  QuestionPackValidationError,
  validateQuestionPacks,
  type QuestionPackSource,
  type ValidationIssue,
} from "../validation/questionBankValidation";

interface QuestionBankModuleMaps {
  manifests: Record<string, unknown>;
  jsonFiles: Record<string, unknown>;
  markdownFiles: Record<string, unknown>;
}

const manifests = import.meta.glob(
  "../../question-banks/*/manifest.json",
  {
    eager: true,
    import: "default",
  },
) as Record<string, unknown>;

const jsonFiles = import.meta.glob("../../question-banks/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const markdownFiles = import.meta.glob("../../question-banks/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, unknown>;

export const questionBanks = loadQuestionBanksFromModules({
  manifests,
  jsonFiles,
  markdownFiles,
});

export function loadQuestionBanksFromModules({
  manifests: manifestModules,
  jsonFiles: jsonModules,
  markdownFiles: markdownModules,
}: QuestionBankModuleMaps): QuestionBank[] {
  const sources: QuestionPackSource[] = [];
  const issues: ValidationIssue[] = [];

  for (const [manifestPath, rawManifest] of Object.entries(manifestModules)) {
    const directoryName = getDirectoryName(manifestPath);
    const manifestResult = manifestSchema.safeParse(rawManifest);

    if (!manifestResult.success) {
      sources.push({
        directoryName,
        manifest: rawManifest,
        questions: [],
      });
      continue;
    }

    const bank = manifestResult.data.id || directoryName;
    let questionsPath: string;
    try {
      questionsPath = resolveModulePath(
        manifestPath,
        manifestResult.data.files.questions,
      );
    } catch (error) {
      issues.push({
        bank,
        file: "manifest.json",
        field: "files.questions",
        reason: getErrorMessage(error),
      });
      continue;
    }
    const questions = jsonModules[questionsPath];

    if (questions === undefined) {
      issues.push({
        bank,
        file: "manifest.json",
        field: "files.questions",
        reason: `File "${manifestResult.data.files.questions}" does not exist.`,
      });
      continue;
    }

    let introductionPath: string | undefined;
    try {
      introductionPath = manifestResult.data.files.introduction
        ? resolveModulePath(
            manifestPath,
            manifestResult.data.files.introduction,
          )
        : undefined;
    } catch (error) {
      issues.push({
        bank,
        file: "manifest.json",
        field: "files.introduction",
        reason: getErrorMessage(error),
      });
      continue;
    }
    const introduction = introductionPath
      ? markdownModules[introductionPath]
      : undefined;

    if (introductionPath && typeof introduction !== "string") {
      issues.push({
        bank,
        file: "manifest.json",
        field: "files.introduction",
        reason: `File "${manifestResult.data.files.introduction}" does not exist or is not readable as Markdown.`,
      });
      continue;
    }

    sources.push({
      directoryName,
      manifest: rawManifest,
      questions,
      ...(typeof introduction === "string" ? { introduction } : {}),
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

export function resolveModulePath(
  manifestPath: string,
  declaredPath: string,
): string {
  if (
    declaredPath.startsWith("/") ||
    declaredPath.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/u.test(declaredPath)
  ) {
    throw new Error(`Question Pack path "${declaredPath}" must be relative.`);
  }

  const directorySegments = manifestPath.split("/").slice(0, -1);
  const minimumLength = directorySegments.length;
  const resolvedSegments = [...directorySegments];

  for (const segment of declaredPath.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (resolvedSegments.length === minimumLength) {
        throw new Error(
          `Question Pack path "${declaredPath}" leaves its directory.`,
        );
      }
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join("/");
}

function getDirectoryName(manifestPath: string) {
  return manifestPath.split("/").at(-2) ?? manifestPath;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

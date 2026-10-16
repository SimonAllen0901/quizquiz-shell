import {
  browserStorageAdapter,
  type StorageAdapter,
} from "./storageAdapter";

export const PROGRESS_STORAGE_KEY = "quizquiz-shell-progress";

export interface AnswerResult {
  questionId: string;
  selectedOptionIds: string[];
  correct: boolean;
  submittedAt: string;
}

export interface QuestionBankProgress {
  seenQuestionIds: string[];
  favoriteQuestionIds: string[];
  answerResults: Record<string, AnswerResult>;
}

export type AppProgress = Record<string, QuestionBankProgress>;

export interface ProgressStorage {
  getAppProgress(): AppProgress;
  getBankProgress(bankId: string): QuestionBankProgress;
  recordAnswerResult(
    bankId: string,
    questionId: string,
    selectedOptionIds: readonly string[],
    correct: boolean,
  ): AnswerResult;
  toggleFavorite(bankId: string, questionId: string): boolean;
  cleanBankProgress(
    bankId: string,
    validQuestionIds: ReadonlySet<string> | readonly string[],
  ): QuestionBankProgress;
  restartBank(bankId: string): void;
  resetBank(bankId: string): void;
  clearBankFavorites(bankId: string): void;
  resetAll(): void;
}

export function createProgressStorage(
  storage: StorageAdapter,
  now: () => string = () => new Date().toISOString(),
): ProgressStorage {
  function getAppProgress(): AppProgress {
    const serialized = safeGetItem(storage, PROGRESS_STORAGE_KEY);
    if (serialized === null) {
      return {};
    }

    try {
      return normalizeAppProgress(JSON.parse(serialized) as unknown);
    } catch {
      return {};
    }
  }

  function saveAppProgress(progress: AppProgress) {
    safeSetItem(storage, PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  }

  function getBankProgress(bankId: string): QuestionBankProgress {
    return getAppProgress()[bankId] ?? createEmptyBankProgress();
  }

  function resetBank(bankId: string) {
    const progress = getAppProgress();
    const current = progress[bankId];
    if (!current) return;

    progress[bankId] = {
      seenQuestionIds: [],
      favoriteQuestionIds: [...current.favoriteQuestionIds],
      answerResults: {},
    };
    saveAppProgress(progress);
  }

  return {
    getAppProgress,
    getBankProgress,
    recordAnswerResult(bankId, questionId, selectedOptionIds, correct) {
      const progress = getAppProgress();
      const bankProgress = progress[bankId] ?? createEmptyBankProgress();
      const result: AnswerResult = {
        questionId,
        selectedOptionIds: [...selectedOptionIds],
        correct,
        submittedAt: now(),
      };

      progress[bankId] = {
        seenQuestionIds: bankProgress.seenQuestionIds.includes(questionId)
          ? [...bankProgress.seenQuestionIds]
          : [...bankProgress.seenQuestionIds, questionId],
        favoriteQuestionIds: [...bankProgress.favoriteQuestionIds],
        answerResults: {
          ...bankProgress.answerResults,
          [questionId]: result,
        },
      };
      saveAppProgress(progress);
      return result;
    },
    toggleFavorite(bankId, questionId) {
      const progress = getAppProgress();
      const bankProgress = progress[bankId] ?? createEmptyBankProgress();
      const isFavorite = bankProgress.favoriteQuestionIds.includes(questionId);

      progress[bankId] = {
        seenQuestionIds: [...bankProgress.seenQuestionIds],
        favoriteQuestionIds: isFavorite
          ? bankProgress.favoriteQuestionIds.filter((id) => id !== questionId)
          : [...bankProgress.favoriteQuestionIds, questionId],
        answerResults: { ...bankProgress.answerResults },
      };
      saveAppProgress(progress);
      return !isFavorite;
    },
    cleanBankProgress(bankId, validQuestionIds) {
      const progress = getAppProgress();
      const current = progress[bankId] ?? createEmptyBankProgress();
      const cleaned = cleanStaleQuestionIds(current, validQuestionIds);

      if (bankId in progress) {
        progress[bankId] = cleaned;
        saveAppProgress(progress);
      }

      return cleaned;
    },
    restartBank: resetBank,
    resetBank,
    clearBankFavorites(bankId) {
      const progress = getAppProgress();
      const current = progress[bankId];
      if (!current) return;

      progress[bankId] = { ...current, favoriteQuestionIds: [] };
      saveAppProgress(progress);
    },
    resetAll() {
      safeRemoveItem(storage, PROGRESS_STORAGE_KEY);
    },
  };
}

export function normalizeAppProgress(value: unknown): AppProgress {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([bankId, bankProgress]) => [
      bankId,
      normalizeBankProgress(bankProgress) ?? createEmptyBankProgress(),
    ]),
  );
}

export function cleanStaleQuestionIds(
  progress: QuestionBankProgress,
  validQuestionIds: ReadonlySet<string> | readonly string[],
): QuestionBankProgress {
  const validIds =
    validQuestionIds instanceof Set
      ? validQuestionIds
      : new Set(validQuestionIds);

  return {
    seenQuestionIds: progress.seenQuestionIds.filter((id) => validIds.has(id)),
    favoriteQuestionIds: progress.favoriteQuestionIds.filter((id) =>
      validIds.has(id),
    ),
    answerResults: Object.fromEntries(
      Object.entries(progress.answerResults).filter(([questionId]) =>
        validIds.has(questionId),
      ),
    ),
  };
}

export function createEmptyBankProgress(): QuestionBankProgress {
  return {
    seenQuestionIds: [],
    favoriteQuestionIds: [],
    answerResults: {},
  };
}

function normalizeBankProgress(value: unknown): QuestionBankProgress | null {
  if (
    !isRecord(value) ||
    !isStringArray(value.seenQuestionIds) ||
    !isStringArray(value.favoriteQuestionIds)
  ) {
    return null;
  }

  const rawAnswerResults = value.answerResults;
  if (rawAnswerResults === undefined) {
    return {
      seenQuestionIds: [...value.seenQuestionIds],
      favoriteQuestionIds: [...value.favoriteQuestionIds],
      answerResults: {},
    };
  }

  if (!isRecord(rawAnswerResults)) {
    return null;
  }

  const answerResults: Record<string, AnswerResult> = {};
  for (const [questionId, result] of Object.entries(rawAnswerResults)) {
    if (!isAnswerResult(result)) {
      return null;
    }
    answerResults[questionId] = {
      questionId: result.questionId,
      selectedOptionIds: [...result.selectedOptionIds],
      correct: result.correct,
      submittedAt: result.submittedAt,
    };
  }

  return {
    seenQuestionIds: [...value.seenQuestionIds],
    favoriteQuestionIds: [...value.favoriteQuestionIds],
    answerResults,
  };
}

function isAnswerResult(value: unknown): value is AnswerResult {
  return (
    isRecord(value) &&
    typeof value.questionId === "string" &&
    isStringArray(value.selectedOptionIds) &&
    typeof value.correct === "boolean" &&
    typeof value.submittedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function safeGetItem(storage: StorageAdapter, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: StorageAdapter, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage failure must not crash the App.
  }
}

function safeRemoveItem(storage: StorageAdapter, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage failure must not crash the App.
  }
}

export const progressStorage = createProgressStorage(browserStorageAdapter);

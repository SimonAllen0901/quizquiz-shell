import type { AnswerResult } from "../../storage/progressStorage";

export interface AnswerStats {
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
}

export function deriveAnswerStats(
  answerResults: Readonly<Record<string, AnswerResult>>,
  validQuestionIds?: ReadonlySet<string> | readonly string[],
): AnswerStats {
  const validIds =
    validQuestionIds === undefined
      ? undefined
      : validQuestionIds instanceof Set
        ? validQuestionIds
        : new Set(validQuestionIds);
  const validResults = Object.entries(answerResults).filter(
    ([questionId]) => validIds === undefined || validIds.has(questionId),
  );
  const correctCount = validResults.filter(
    ([, result]) => result.correct,
  ).length;
  const incorrectCount = validResults.length - correctCount;
  const answeredCount = correctCount + incorrectCount;

  return {
    answeredCount,
    correctCount,
    incorrectCount,
    accuracy: answeredCount > 0 ? correctCount / answeredCount : null,
  };
}

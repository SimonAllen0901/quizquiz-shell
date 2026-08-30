import { describe, expect, it } from "vitest";

import type { AnswerResult } from "../../storage/progressStorage";
import { deriveAnswerStats } from "./progressStats";

const answerResults: Record<string, AnswerResult> = {
  q1: { questionId: "q1", selectedOptionIds: ["a"], correct: true, submittedAt: "2026-08-30T01:00:00Z" },
  q2: { questionId: "q2", selectedOptionIds: ["b"], correct: false, submittedAt: "2026-08-30T01:01:00Z" },
  q3: { questionId: "q3", selectedOptionIds: ["c"], correct: true, submittedAt: "2026-08-30T01:02:00Z" },
};

describe("deriveAnswerStats", () => {
  it("returns null accuracy when there are no effective results", () => {
    expect(deriveAnswerStats({})).toEqual({
      answeredCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: null,
    });
    expect(deriveAnswerStats(answerResults, ["missing"])).toEqual({
      answeredCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: null,
    });
  });

  it("derives counts and accuracy only from answer results", () => {
    expect(deriveAnswerStats(answerResults)).toEqual({
      answeredCount: 3,
      correctCount: 2,
      incorrectCount: 1,
      accuracy: 2 / 3,
    });
  });

  it("excludes stale question IDs when current IDs are supplied", () => {
    expect(deriveAnswerStats(answerResults, ["q1", "q2"])).toEqual({
      answeredCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      accuracy: 0.5,
    });
  });

  it("does not mutate answer results or add persisted statistics", () => {
    const snapshot = structuredClone(answerResults);

    deriveAnswerStats(answerResults);

    expect(answerResults).toEqual(snapshot);
    expect(Object.keys(answerResults.q1)).toEqual([
      "questionId",
      "selectedOptionIds",
      "correct",
      "submittedAt",
    ]);
  });
});

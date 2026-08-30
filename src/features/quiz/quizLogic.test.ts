import { describe, expect, it, vi } from "vitest";

import {
  getAvailableQuestionIds,
  isAnswerCorrect,
  selectRandomUnseenQuestionId,
} from "./quizLogic";

describe("unseen question selection", () => {
  it("excludes seen IDs while preserving question order", () => {
    expect(getAvailableQuestionIds(["q1", "q2", "q3"], ["q2", "unknown"])).toEqual([
      "q1",
      "q3",
    ]);
  });

  it("uses the injected random source to choose from unseen questions", () => {
    expect(selectRandomUnseenQuestionId(["q1", "q2", "q3"], ["q2"], () => 0)).toBe("q1");
    expect(selectRandomUnseenQuestionId(["q1", "q2", "q3"], ["q2"], () => 0.999)).toBe(
      "q3",
    );
  });

  it("returns null without using randomness when all questions are seen", () => {
    const random = vi.fn(() => 0);

    expect(selectRandomUnseenQuestionId(["q1"], ["q1"], random)).toBeNull();
    expect(random).not.toHaveBeenCalled();
  });
});

describe("answer judgment", () => {
  it("judges a single-choice answer by exact set equality", () => {
    expect(isAnswerCorrect(["a"], ["a"])).toBe(true);
    expect(isAnswerCorrect(["b"], ["a"])).toBe(false);
    expect(isAnswerCorrect([], ["a"])).toBe(false);
    expect(isAnswerCorrect(["a", "b"], ["a"])).toBe(false);
  });

  it("judges multiple-choice answers without depending on order", () => {
    expect(isAnswerCorrect(["c", "a"], ["a", "c"])).toBe(true);
    expect(isAnswerCorrect(["a"], ["a", "c"])).toBe(false);
    expect(isAnswerCorrect(["a", "b", "c"], ["a", "c"])).toBe(false);
  });

  it("normalizes duplicate selected IDs as a set", () => {
    expect(isAnswerCorrect(["a", "a", "c"], ["a", "c"])).toBe(true);
  });
});

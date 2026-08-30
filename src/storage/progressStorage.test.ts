import { describe, expect, it, vi } from "vitest";

import { MemoryStorage } from "../test/memoryStorage";
import {
  PROGRESS_STORAGE_KEY,
  cleanStaleQuestionIds,
  createProgressStorage,
  type AppProgress,
} from "./progressStorage";
import type { StorageAdapter } from "./storageAdapter";

const NOW = "2026-08-30T01:02:03.000Z";

function seed(storage: MemoryStorage, progress: unknown): void {
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

function readStored(storage: MemoryStorage): AppProgress {
  return JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY) ?? "{}") as AppProgress;
}

describe("progressStorage defensive parsing and migration", () => {
  it("returns empty progress for a missing value, malformed JSON, and invalid root values", () => {
    const storage = new MemoryStorage();
    const progressStorage = createProgressStorage(storage);

    expect(progressStorage.getAppProgress()).toEqual({});

    storage.setItem(PROGRESS_STORAGE_KEY, "{");
    expect(progressStorage.getAppProgress()).toEqual({});

    for (const invalid of [null, [], "text", 1]) {
      seed(storage, invalid);
      expect(progressStorage.getAppProgress()).toEqual({});
    }
  });

  it("migrates legacy bank progress without answerResults", () => {
    const storage = new MemoryStorage();
    seed(storage, {
      bank: {
        seenQuestionIds: ["q1"],
        favoriteQuestionIds: ["q2"],
      },
    });

    expect(createProgressStorage(storage).getBankProgress("bank")).toEqual({
      seenQuestionIds: ["q1"],
      favoriteQuestionIds: ["q2"],
      answerResults: {},
    });
  });

  it("clears only a malformed bank and preserves other valid banks", () => {
    const storage = new MemoryStorage();
    seed(storage, {
      broken: { seenQuestionIds: "q1", favoriteQuestionIds: [], answerResults: {} },
      valid: {
        seenQuestionIds: ["q2"],
        favoriteQuestionIds: [],
        answerResults: {
          q2: {
            questionId: "q2",
            selectedOptionIds: ["a"],
            correct: true,
            submittedAt: NOW,
          },
        },
      },
    });

    expect(createProgressStorage(storage).getAppProgress()).toEqual({
      broken: { seenQuestionIds: [], favoriteQuestionIds: [], answerResults: {} },
      valid: {
        seenQuestionIds: ["q2"],
        favoriteQuestionIds: [],
        answerResults: {
          q2: {
            questionId: "q2",
            selectedOptionIds: ["a"],
            correct: true,
            submittedAt: NOW,
          },
        },
      },
    });
  });

  it("treats malformed answerResults and malformed result entries as bank-level damage", () => {
    const storage = new MemoryStorage();
    const progressStorage = createProgressStorage(storage);

    seed(storage, {
      bank: { seenQuestionIds: [], favoriteQuestionIds: [], answerResults: [] },
    });
    expect(progressStorage.getBankProgress("bank")).toEqual({
      seenQuestionIds: [],
      favoriteQuestionIds: [],
      answerResults: {},
    });

    seed(storage, {
      bank: {
        seenQuestionIds: ["q1"],
        favoriteQuestionIds: ["q1"],
        answerResults: {
          q1: { questionId: "q1", selectedOptionIds: "a", correct: true, submittedAt: NOW },
        },
      },
    });
    expect(progressStorage.getBankProgress("bank")).toEqual({
      seenQuestionIds: [],
      favoriteQuestionIds: [],
      answerResults: {},
    });
  });

  it("does not throw when the storage implementation rejects access", () => {
    const throwingStorage: StorageAdapter = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const progressStorage = createProgressStorage(throwingStorage, () => NOW);

    expect(progressStorage.getAppProgress()).toEqual({});
    expect(() =>
      progressStorage.recordAnswerResult("bank", "q1", ["a"], true),
    ).not.toThrow();
    expect(() => progressStorage.resetAll()).not.toThrow();
  });
});

describe("progressStorage operations", () => {
  it("records an answer, marks the question seen once, and overwrites the latest result", () => {
    const storage = new MemoryStorage();
    const progressStorage = createProgressStorage(storage, () => NOW);
    const selected = ["a"];

    progressStorage.recordAnswerResult("bank", "q1", selected, false);
    selected.push("mutated");
    progressStorage.recordAnswerResult("bank", "q1", ["b"], true);

    expect(progressStorage.getBankProgress("bank")).toEqual({
      seenQuestionIds: ["q1"],
      favoriteQuestionIds: [],
      answerResults: {
        q1: {
          questionId: "q1",
          selectedOptionIds: ["b"],
          correct: true,
          submittedAt: NOW,
        },
      },
    });
  });

  it("toggles favorites and returns the new favorite state", () => {
    const storage = new MemoryStorage();
    const progressStorage = createProgressStorage(storage);

    expect(progressStorage.toggleFavorite("bank", "q1")).toBe(true);
    expect(progressStorage.toggleFavorite("bank", "q2")).toBe(true);
    expect(progressStorage.toggleFavorite("bank", "q1")).toBe(false);
    expect(progressStorage.getBankProgress("bank").favoriteQuestionIds).toEqual(["q2"]);
  });

  it("cleans stale question IDs from all persisted progress collections", () => {
    const storage = new MemoryStorage();
    seed(storage, {
      bank: {
        seenQuestionIds: ["q1", "removed"],
        favoriteQuestionIds: ["removed", "q2"],
        answerResults: {
          q1: { questionId: "q1", selectedOptionIds: ["a"], correct: true, submittedAt: NOW },
          removed: { questionId: "removed", selectedOptionIds: ["b"], correct: false, submittedAt: NOW },
        },
      },
    });
    const progressStorage = createProgressStorage(storage);

    expect(progressStorage.cleanBankProgress("bank", ["q1", "q2"])).toEqual({
      seenQuestionIds: ["q1"],
      favoriteQuestionIds: ["q2"],
      answerResults: {
        q1: { questionId: "q1", selectedOptionIds: ["a"], correct: true, submittedAt: NOW },
      },
    });
    expect(readStored(storage).bank).toEqual(progressStorage.getBankProgress("bank"));
  });

  it("does not create a missing bank while cleaning stale IDs", () => {
    const storage = new MemoryStorage();
    const progressStorage = createProgressStorage(storage);

    expect(progressStorage.cleanBankProgress("missing", ["q1"])).toEqual({
      seenQuestionIds: [],
      favoriteQuestionIds: [],
      answerResults: {},
    });
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("restart clears seen questions and answer results but preserves favorites", () => {
    const storage = new MemoryStorage();
    seed(storage, {
      bank: {
        seenQuestionIds: ["q1"],
        favoriteQuestionIds: ["q1"],
        answerResults: {
          q1: { questionId: "q1", selectedOptionIds: ["a"], correct: true, submittedAt: NOW },
        },
      },
    });
    const progressStorage = createProgressStorage(storage);

    progressStorage.restartBank("bank");

    expect(progressStorage.getBankProgress("bank")).toEqual({
      seenQuestionIds: [],
      favoriteQuestionIds: ["q1"],
      answerResults: {},
    });
  });

  it("resetBank removes only the selected bank", () => {
    const storage = new MemoryStorage();
    seed(storage, {
      first: { seenQuestionIds: ["q1"], favoriteQuestionIds: [], answerResults: {} },
      second: { seenQuestionIds: ["q2"], favoriteQuestionIds: [], answerResults: {} },
    });
    const progressStorage = createProgressStorage(storage);

    progressStorage.resetBank("first");

    expect(progressStorage.getAppProgress()).toEqual({
      second: { seenQuestionIds: ["q2"], favoriteQuestionIds: [], answerResults: {} },
    });
  });

  it("resetAll removes only the progress storage key", () => {
    const storage = new MemoryStorage();
    seed(storage, { bank: { seenQuestionIds: [], favoriteQuestionIds: [], answerResults: {} } });
    storage.setItem("quizquiz-shell-theme", "dark");
    const progressStorage = createProgressStorage(storage);

    progressStorage.resetAll();

    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("quizquiz-shell-theme")).toBe("dark");
  });
});

describe("cleanStaleQuestionIds", () => {
  it("does not mutate its input", () => {
    const progress = {
      seenQuestionIds: ["q1", "old"],
      favoriteQuestionIds: ["q1"],
      answerResults: {
        q1: { questionId: "q1", selectedOptionIds: ["a"], correct: true, submittedAt: NOW },
      },
    };
    const snapshot = structuredClone(progress);

    expect(cleanStaleQuestionIds(progress, ["q1"])).toEqual({
      seenQuestionIds: ["q1"],
      favoriteQuestionIds: ["q1"],
      answerResults: progress.answerResults,
    });
    expect(progress).toEqual(snapshot);
  });
});

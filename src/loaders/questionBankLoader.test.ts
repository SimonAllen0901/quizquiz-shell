import { describe, expect, it } from "vitest";
import { QuestionPackValidationError } from "../validation/questionBankValidation";
import {
  loadQuestionBanksFromModules,
  questionBanks,
  resolveModulePath,
} from "./questionBankLoader";

const questions = [
  {
    id: "q001",
    type: "single",
    question: "A valid question",
    options: [
      { id: "A", text: "Correct" },
      { id: "B", text: "Incorrect" },
    ],
    correctAnswers: ["A"],
  },
];

function manifest(id: string, introduction = true) {
  return {
    schemaVersion: 1,
    id,
    name: `${id} name`,
    files: {
      questions: "./questions.json",
      ...(introduction ? { introduction: "./introduction.md" } : {}),
    },
  };
}

describe("build-time Question Pack loader", () => {
  it("loads the real demo-bank through Vite import.meta.glob", () => {
    expect(questionBanks).toHaveLength(1);
    expect(questionBanks[0]).toMatchObject({
      id: "demo-bank",
      version: "1.0.0",
    });
    expect(questionBanks[0]?.questions).toHaveLength(3);
    expect(questionBanks[0]?.introduction).toContain("Demo Question Bank");
  });

  it("discovers multiple packs from module maps without source imports", () => {
    const banks = loadQuestionBanksFromModules({
      manifests: {
        "../../question-banks/alpha/manifest.json": manifest("alpha"),
        "../../question-banks/beta/manifest.json": manifest("beta", false),
      },
      jsonFiles: {
        "../../question-banks/alpha/questions.json": questions,
        "../../question-banks/beta/questions.json": questions,
      },
      markdownFiles: {
        "../../question-banks/alpha/introduction.md": "# Alpha",
      },
    });

    expect(banks.map((bank) => bank.id)).toEqual(["alpha", "beta"]);
    expect(banks[0]?.introduction).toBe("# Alpha");
    expect(banks[1]?.introduction).toBeUndefined();
  });

  it("fails when a manifest-declared questions file is missing", () => {
    expect(() =>
      loadQuestionBanksFromModules({
        manifests: {
          "../../question-banks/broken/manifest.json": manifest("broken"),
        },
        jsonFiles: {},
        markdownFiles: {},
      }),
    ).toThrowError(QuestionPackValidationError);

    try {
      loadQuestionBanksFromModules({
        manifests: {
          "../../question-banks/broken/manifest.json": manifest("broken"),
        },
        jsonFiles: {},
        markdownFiles: {},
      });
    } catch (error) {
      expect((error as Error).message).toContain("Bank:\nbroken");
      expect((error as Error).message).toContain("Field:\nfiles.questions");
    }
  });

  it("rejects declared paths that leave the Question Pack directory", () => {
    expect(() =>
      resolveModulePath(
        "../../question-banks/demo/manifest.json",
        "../questions.json",
      ),
    ).toThrow("leaves its directory");
  });
});

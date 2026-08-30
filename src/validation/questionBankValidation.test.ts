import { describe, expect, it } from "vitest";
import { manifestSchema } from "../schemas/manifest";
import { questionSchema } from "../schemas/question";
import {
  QuestionPackValidationError,
  validateQuestionPacks,
  type QuestionPackSource,
} from "./questionBankValidation";

const validManifest = {
  schemaVersion: 1,
  id: "demo-bank",
  name: "Demo Bank",
  shortName: "Demo",
  description: "A demo question bank.",
  version: "1.0.0",
  language: "zh-TW",
  files: {
    questions: "./questions.json",
    introduction: "./introduction.md",
  },
} as const;

const validQuestions = [
  {
    id: "q001",
    type: "single",
    question: "Which option is correct?",
    options: [
      { id: "A", text: "Correct" },
      { id: "B", text: "Incorrect" },
    ],
    correctAnswers: ["A"],
    explanation: "Option **A** is correct.",
    tags: ["demo"],
  },
  {
    id: "q002",
    type: "multiple",
    question: "Select both correct options.",
    options: [
      { id: "A", text: "First" },
      { id: "B", text: "Second" },
      { id: "C", text: "Third" },
    ],
    correctAnswers: ["A", "C"],
  },
] as const;

function createSource(
  overrides: Partial<QuestionPackSource> = {},
): QuestionPackSource {
  return {
    directoryName: "demo-bank",
    manifest: validManifest,
    questions: validQuestions,
    introduction: "# Demo Bank",
    ...overrides,
  };
}

function captureValidationError(sources: QuestionPackSource[]) {
  try {
    validateQuestionPacks(sources);
  } catch (error) {
    expect(error).toBeInstanceOf(QuestionPackValidationError);
    return error as QuestionPackValidationError;
  }

  throw new Error("Expected validation to fail.");
}

describe("Question Pack Zod schemas", () => {
  it("accepts every field defined by the manifest and question specs", () => {
    expect(manifestSchema.safeParse(validManifest).success).toBe(true);
    expect(questionSchema.safeParse(validQuestions[0]).success).toBe(true);
  });

  it("rejects fields outside the defined Question schema", () => {
    const result = questionSchema.safeParse({
      ...validQuestions[0],
      difficulty: "easy",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported manifest versions and manifest-only custom fields", () => {
    expect(
      manifestSchema.safeParse({ ...validManifest, schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      manifestSchema.safeParse({ ...validManifest, homepage: "/demo" }).success,
    ).toBe(false);
  });

  it("reports structural errors with bank, file, question, and field", () => {
    const error = captureValidationError([
      createSource({
        questions: [{ ...validQuestions[0], type: "boolean" }],
      }),
    ]);

    expect(error.message).toContain("Bank:\ndemo-bank");
    expect(error.message).toContain("File:\n./questions.json");
    expect(error.message).toContain("Question:\nq001");
    expect(error.message).toContain("Field:\ntype");
    expect(error.message).toContain("Reason:");
  });
});

describe("Question Pack semantic validation", () => {
  it("returns Runtime QuestionBank models for valid packs", () => {
    const [bank] = validateQuestionPacks([createSource()]);

    expect(bank).toEqual({
      id: "demo-bank",
      name: "Demo Bank",
      shortName: "Demo",
      description: "A demo question bank.",
      version: "1.0.0",
      language: "zh-TW",
      introduction: "# Demo Bank",
      questions: validQuestions,
    });
    expect(bank).not.toHaveProperty("files");
    expect(bank).not.toHaveProperty("schemaVersion");
  });

  it("rejects duplicate bank IDs", () => {
    const error = captureValidationError([
      createSource(),
      createSource({ directoryName: "another-directory" }),
    ]);

    expect(error.issues).toContainEqual(
      expect.objectContaining({
        bank: "demo-bank",
        file: "manifest.json",
        field: "id",
      }),
    );
  });

  it("rejects an empty questions array", () => {
    const error = captureValidationError([createSource({ questions: [] })]);

    expect(error.issues).toContainEqual(
      expect.objectContaining({
        bank: "demo-bank",
        file: "./questions.json",
        field: "<root>",
      }),
    );
  });

  it.each([
    {
      name: "duplicate question IDs",
      questions: [validQuestions[0], validQuestions[0]],
      field: "id",
      reason: "Question ID \"q001\" is duplicated.",
    },
    {
      name: "fewer than two options",
      questions: [
        {
          ...validQuestions[0],
          options: [{ id: "A", text: "Only option" }],
        },
      ],
      field: "options",
      reason: "A question must contain at least two options.",
    },
    {
      name: "duplicate option IDs",
      questions: [
        {
          ...validQuestions[0],
          options: [
            { id: "A", text: "First" },
            { id: "A", text: "Duplicate" },
          ],
        },
      ],
      field: "options[1].id",
      reason: "Option ID \"A\" is duplicated.",
    },
    {
      name: "a correct answer that does not reference an option",
      questions: [{ ...validQuestions[0], correctAnswers: ["E"] }],
      field: "correctAnswers[0]",
      reason: "Option \"E\" does not exist in options.",
    },
    {
      name: "more than one correct answer for a single question",
      questions: [{ ...validQuestions[0], correctAnswers: ["A", "B"] }],
      field: "correctAnswers",
      reason: "A single question must contain exactly one correct answer.",
    },
    {
      name: "fewer than two correct answers for a multiple question",
      questions: [{ ...validQuestions[1], correctAnswers: ["A"] }],
      field: "correctAnswers",
      reason: "A multiple question must contain at least two correct answers.",
    },
    {
      name: "duplicate correct answers",
      questions: [{ ...validQuestions[1], correctAnswers: ["A", "A"] }],
      field: "correctAnswers[1]",
      reason: "Correct answer \"A\" is duplicated.",
    },
  ])("rejects $name", ({ questions, field, reason }) => {
    const error = captureValidationError([createSource({ questions })]);

    expect(error.issues).toContainEqual(
      expect.objectContaining({
        bank: "demo-bank",
        file: "./questions.json",
        question: questions[0]?.id,
        field,
        reason,
      }),
    );
  });
});

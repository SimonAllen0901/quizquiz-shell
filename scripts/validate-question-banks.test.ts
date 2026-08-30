import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { QuestionPackValidationError } from "../src/validation/questionBankValidation.ts";
import { validateQuestionBanksAt } from "./validate-question-banks.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createProjectFixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), "quizquiz-cli-"));
  temporaryDirectories.push(projectRoot);
  await mkdir(join(projectRoot, "question-banks", "fixture-bank"), {
    recursive: true,
  });
  return projectRoot;
}

async function writeValidPack(projectRoot: string) {
  const bankDirectory = join(
    projectRoot,
    "question-banks",
    "fixture-bank",
  );
  await writeFile(
    join(bankDirectory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "fixture-bank",
      name: "Fixture Bank",
      files: { questions: "./questions.json" },
    }),
  );
  await writeFile(
    join(bankDirectory, "questions.json"),
    JSON.stringify([
      {
        id: "q001",
        type: "single",
        question: "A valid fixture question",
        options: [
          { id: "A", text: "Correct" },
          { id: "B", text: "Incorrect" },
        ],
        correctAnswers: ["A"],
      },
    ]),
  );
}

describe("Question Pack validation CLI", () => {
  it("loads and validates a filesystem Question Pack", async () => {
    const projectRoot = await createProjectFixture();
    await writeValidPack(projectRoot);

    const banks = await validateQuestionBanksAt(projectRoot);

    expect(banks).toHaveLength(1);
    expect(banks[0]).toMatchObject({ id: "fixture-bank" });
  });

  it("reports semantic errors from filesystem content", async () => {
    const projectRoot = await createProjectFixture();
    await writeValidPack(projectRoot);
    const questionsPath = join(
      projectRoot,
      "question-banks",
      "fixture-bank",
      "questions.json",
    );
    await writeFile(
      questionsPath,
      JSON.stringify([
        {
          id: "q001",
          type: "single",
          question: "Broken answer reference",
          options: [
            { id: "A", text: "First" },
            { id: "B", text: "Second" },
          ],
          correctAnswers: ["E"],
        },
      ]),
    );

    await expect(validateQuestionBanksAt(projectRoot)).rejects.toMatchObject({
      name: "QuestionPackValidationError",
      issues: [
        expect.objectContaining({
          bank: "fixture-bank",
          question: "q001",
          field: "correctAnswers[0]",
        }),
      ],
    });
  });

  it("rejects manifest paths that leave the pack directory", async () => {
    const projectRoot = await createProjectFixture();
    const manifestPath = join(
      projectRoot,
      "question-banks",
      "fixture-bank",
      "manifest.json",
    );
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        id: "fixture-bank",
        name: "Fixture Bank",
        files: { questions: "../questions.json" },
      }),
    );

    await expect(validateQuestionBanksAt(projectRoot)).rejects.toBeInstanceOf(
      QuestionPackValidationError,
    );
  });

  it("exits with a non-zero status when validation fails", async () => {
    const projectRoot = await createProjectFixture();
    const scriptPath = resolve(
      process.cwd(),
      "scripts/validate-question-banks.ts",
    );
    await writeFile(
      join(projectRoot, "question-banks", "fixture-bank", "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "fixture-bank",
        name: "Fixture Bank",
        files: { questions: "./missing.json" },
      }),
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Question Pack validation failed");
    expect(result.stderr).toContain("fixture-bank");
    expect(result.stderr).toContain("missing.json");
    expect(result.stderr).toContain("Field:\nfiles.questions");
  });
});

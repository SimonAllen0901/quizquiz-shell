import { stat } from "node:fs/promises";
import { resolve } from "node:path";

const demoBankDirectory = resolve(process.cwd(), "question-banks/demo-bank");

try {
  const directory = await stat(demoBankDirectory);

  if (!directory.isDirectory()) {
    throw new Error("question-banks/demo-bank is not a directory.");
  }

  console.log("Question bank skeleton validation passed.");
} catch (error) {
  console.error("Question bank skeleton validation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

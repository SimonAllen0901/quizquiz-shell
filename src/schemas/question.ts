import { z } from "zod";

export const questionTypeSchema = z.enum(["single", "multiple"]);

export const questionOptionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
  })
  .strict();

export const questionSchema = z
  .object({
    id: z.string(),
    type: questionTypeSchema,
    question: z.string(),
    options: z.array(questionOptionSchema),
    correctAnswers: z.array(z.string()),
    explanation: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const questionsSchema = z
  .array(questionSchema)
  .min(1, "questions.json must contain at least one question.");

export type QuestionType = z.infer<typeof questionTypeSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type Question = z.infer<typeof questionSchema>;

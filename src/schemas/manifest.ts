import { z } from "zod";

export const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    name: z.string(),
    shortName: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    language: z.string().optional(),
    files: z
      .object({
        questions: z.string(),
        introduction: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;

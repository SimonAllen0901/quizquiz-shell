import type { Question } from "../schemas/question.ts";

export interface QuestionBank {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  version?: string;
  language?: string;
  introduction?: string;
  questions: Question[];
}

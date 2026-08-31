import { Link } from "react-router-dom";
import type { QuestionBank } from "../domain/questionBank";
import type { QuestionBankProgress } from "../storage/progressStorage";
import { ProgressSummary } from "./ProgressSummary";

interface QuestionBankCardProps {
  bank: QuestionBank;
  progress: QuestionBankProgress;
}

export function QuestionBankCard({ bank, progress }: QuestionBankCardProps) {
  const validQuestionIds = new Set(bank.questions.map((question) => question.id));
  const favoriteCount = progress.favoriteQuestionIds.filter((questionId) =>
    validQuestionIds.has(questionId),
  ).length;

  return (
    <article className="bank-card">
      <div>
        <p className="eyebrow">{bank.shortName ?? "Question Bank"}</p>
        <h2><Link to={`/banks/${bank.id}`}>{bank.name}</Link></h2>
        {bank.description && <p className="muted">{bank.description}</p>}
        <p className="question-count">共 {bank.questions.length} 題 · 收藏 {favoriteCount} 題</p>
      </div>
      <ProgressSummary bank={bank} progress={progress} compact />
      <div className="card-actions">
        <Link className="button secondary" to={`/banks/${bank.id}`}>查看題庫</Link>
        <Link className="button primary" to={`/banks/${bank.id}/quiz`}>開始刷題</Link>
      </div>
    </article>
  );
}

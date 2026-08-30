import type { QuestionBank } from "../domain/questionBank";
import { deriveAnswerStats } from "../features/progress/progressStats";
import type { QuestionBankProgress } from "../storage/progressStorage";

interface ProgressSummaryProps {
  bank: QuestionBank;
  progress: QuestionBankProgress;
  compact?: boolean;
}

export function ProgressSummary({ bank, progress, compact = false }: ProgressSummaryProps) {
  const questionIds = bank.questions.map((question) => question.id);
  const validIds = new Set(questionIds);
  const completedCount = progress.seenQuestionIds.filter((id) => validIds.has(id)).length;
  const favoriteCount = progress.favoriteQuestionIds.filter((id) => validIds.has(id)).length;
  const stats = deriveAnswerStats(progress.answerResults, validIds);
  const progressPercent = bank.questions.length > 0
    ? (completedCount / bank.questions.length) * 100
    : 0;
  const accuracy = stats.accuracy === null
    ? "尚無資料"
    : `${Math.round(stats.accuracy * 100)}%`;

  return (
    <section className={compact ? "progress-summary compact" : "progress-summary"} aria-label="作答進度">
      <div className="progress-heading">
        <strong>已完成</strong>
        <span>{completedCount} / {bank.questions.length}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="題庫完成進度"
        aria-valuemin={0}
        aria-valuemax={bank.questions.length}
        aria-valuenow={completedCount}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <dl className="stats-list">
        <div><dt>答對</dt><dd>{stats.correctCount}</dd></div>
        <div><dt>答錯</dt><dd>{stats.incorrectCount}</dd></div>
        <div><dt>正確率</dt><dd>{accuracy}</dd></div>
        {!compact && <div><dt>收藏</dt><dd>{favoriteCount}</dd></div>}
      </dl>
    </section>
  );
}

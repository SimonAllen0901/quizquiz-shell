import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { MarkdownContent } from "../components/MarkdownContent";
import { ProgressSummary } from "../components/ProgressSummary";
import type { QuestionBank } from "../domain/questionBank";
import { cleanStaleQuestionIds, type ProgressStorage } from "../storage/progressStorage";

interface BankPageProps {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
}

export function BankPage({ banks, storage }: BankPageProps) {
  const { bankId } = useParams();
  const bank = banks.find((candidate) => candidate.id === bankId);

  if (!bank) {
    return (
      <EmptyState title="找不到題庫">
        <p>題庫不存在或未通過載入驗證。</p>
        <Link className="button primary" to="/">返回題庫首頁</Link>
      </EmptyState>
    );
  }

  const progress = cleanStaleQuestionIds(
    storage.getBankProgress(bank.id),
    bank.questions.map((question) => question.id),
  );

  return (
    <section>
      <Link className="back-link" to="/">← 所有題庫</Link>
      <div className="bank-detail-grid">
        <article className="content-card introduction-card">
          <p className="eyebrow">{bank.shortName ?? "Question Bank"}</p>
          <h1>{bank.name}</h1>
          {bank.description && <p className="lead">{bank.description}</p>}
          {bank.introduction && (
            <div className="markdown-body">
              <MarkdownContent>{bank.introduction}</MarkdownContent>
            </div>
          )}
        </article>
        <aside className="side-card">
          <h2>題庫進度</h2>
          <ProgressSummary bank={bank} progress={progress} />
          <Link className="button primary full-width" to={`/banks/${bank.id}/quiz`}>
            {progress.seenQuestionIds.length > 0 ? "繼續刷題" : "開始刷題"}
          </Link>
        </aside>
      </div>
    </section>
  );
}

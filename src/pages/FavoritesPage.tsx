import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { InlineMarkdownContent, MarkdownContent } from "../components/MarkdownContent";
import type { QuestionBank } from "../domain/questionBank";
import type { Question } from "../schemas/question";
import { cleanStaleQuestionIds, type ProgressStorage } from "../storage/progressStorage";

interface FavoritesPageProps {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
}

export function FavoritesPage({ banks, storage }: FavoritesPageProps) {
  const favoriteBanks = banks
    .map((bank) => ({
      bank,
      progress: storage.cleanBankProgress(
        bank.id,
        bank.questions.map((question) => question.id),
      ),
    }))
    .filter(({ progress }) => progress.favoriteQuestionIds.length > 0);

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Favorites</p>
        <h1>我的收藏</h1>
        <p className="muted">只顯示目前有收藏題目的題庫。</p>
      </div>
      {favoriteBanks.length === 0 ? (
        <EmptyState title="尚未收藏任何題目">
          <p>開始刷題後，可以在題目頁把想複習的題目加入收藏。</p>
          <Link className="button primary" to="/">返回題庫首頁</Link>
        </EmptyState>
      ) : (
        <div className="bank-grid">
          {favoriteBanks.map(({ bank, progress }) => (
            <article className="bank-card" key={bank.id}>
              <div>
                <p className="eyebrow">{bank.shortName ?? "Question Bank"}</p>
                <h2><Link to={`/favorites/${bank.id}`}>{bank.name}</Link></h2>
                {bank.description && <p className="muted">{bank.description}</p>}
                <p className="question-count">已收藏 {progress.favoriteQuestionIds.length} 題</p>
              </div>
              <div className="card-actions">
                <Link className="button primary" to={`/favorites/${bank.id}`}>查看收藏</Link>
                <Link className="button secondary" to={`/banks/${bank.id}`}>題庫介紹</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function FavoriteQuestionsPage({ banks, storage }: FavoritesPageProps) {
  const { bankId } = useParams();
  const bank = banks.find((candidate) => candidate.id === bankId);

  if (!bank) {
    return (
      <EmptyState title="找不到題庫">
        <p>題庫不存在或未通過載入驗證。</p>
        <Link className="button primary" to="/favorites">返回收藏首頁</Link>
      </EmptyState>
    );
  }

  const progress = storage.cleanBankProgress(
    bank.id,
    bank.questions.map((question) => question.id),
  );
  const favoriteQuestions = progress.favoriteQuestionIds
    .map((questionId) => bank.questions.find((question) => question.id === questionId))
    .filter((question): question is Question => question !== undefined);

  return (
    <section>
      <Link className="back-link" to="/favorites">← 我的收藏</Link>
      <div className="page-heading">
        <p className="eyebrow">{bank.shortName ?? "Question Bank"}</p>
        <h1>{bank.name}</h1>
        <p className="muted">共收藏 {favoriteQuestions.length} 題。</p>
      </div>
      {favoriteQuestions.length === 0 ? (
        <EmptyState title="這個題庫沒有收藏題目">
          <p>收藏可能已被移除，或題目已不存在。</p>
          <Link className="button primary" to={`/banks/${bank.id}/quiz`}>前往刷題</Link>
        </EmptyState>
      ) : (
        <div className="favorite-question-list">
          {favoriteQuestions.map((question) => (
            <Link
              className="favorite-question-row"
              key={question.id}
              to={`/favorites/${bank.id}/${question.id}`}
            >
              <span className="favorite-question-id">{question.id}</span>
              <span className="favorite-question-preview">
                <InlineMarkdownContent>{createQuestionPreview(question.question)}</InlineMarkdownContent>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function FavoriteQuestionDetailPage({ banks, storage }: FavoritesPageProps) {
  const { bankId, questionId } = useParams();
  const bank = banks.find((candidate) => candidate.id === bankId);

  if (!bank) {
    return (
      <EmptyState title="找不到題庫">
        <p>題庫不存在或未通過載入驗證。</p>
        <Link className="button primary" to="/favorites">返回收藏首頁</Link>
      </EmptyState>
    );
  }

  const progress = cleanStaleQuestionIds(
    storage.getBankProgress(bank.id),
    bank.questions.map((question) => question.id),
  );
  const question = bank.questions.find((candidate) => candidate.id === questionId);

  if (!question || !progress.favoriteQuestionIds.includes(question.id)) {
    return (
      <EmptyState title="找不到收藏題目">
        <p>這題不存在，或尚未加入收藏。</p>
        <Link className="button primary" to={`/favorites/${bank.id}`}>返回題庫收藏</Link>
      </EmptyState>
    );
  }

  const correctOptions = question.options.filter((option) =>
    question.correctAnswers.includes(option.id),
  );

  return (
    <section>
      <Link className="back-link" to={`/favorites/${bank.id}`}>← {bank.name}</Link>
      <article className="quiz-card">
        <div className="question-meta">
          <span>{question.type === "single" ? "單選題" : "複選題"}</span>
          <span>{question.id}</span>
        </div>
        <div className="question-content markdown-body">
          <MarkdownContent>{question.question}</MarkdownContent>
        </div>
        <div className="favorite-detail-section">
          <h2>選項</h2>
          <div className="option-list">
            {question.options.map((option) => {
              const isCorrect = question.correctAnswers.includes(option.id);

              return (
                <div className={`question-option ${isCorrect ? "correct" : "disabled"}`} key={option.id}>
                  <strong>{option.id}</strong>
                  <span className="option-text"><InlineMarkdownContent>{option.text}</InlineMarkdownContent></span>
                  {isCorrect && <span className="state-label">正確答案</span>}
                </div>
              );
            })}
          </div>
        </div>
        <section className="explanation-panel">
          <h2>正確答案</h2>
          <p>
            {correctOptions.map((option) => `${option.id}. ${option.text}`).join("、")}
          </p>
        </section>
        <section className="explanation-panel">
          <h2>詳解</h2>
          {question.explanation?.trim() ? (
            <div className="markdown-body"><MarkdownContent>{question.explanation}</MarkdownContent></div>
          ) : (
            <p className="muted">這題沒有提供詳解。</p>
          )}
        </section>
      </article>
    </section>
  );
}

function createQuestionPreview(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  return compact.length > 96 ? `${compact.slice(0, 95)}...` : compact;
}

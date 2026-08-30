import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { InlineMarkdownContent, MarkdownContent } from "../components/MarkdownContent";
import { ProgressSummary } from "../components/ProgressSummary";
import type { QuestionBank } from "../domain/questionBank";
import { isAnswerCorrect, selectRandomUnseenQuestionId } from "../features/quiz/quizLogic";
import {
  cleanStaleQuestionIds,
  type ProgressStorage,
  type QuestionBankProgress,
} from "../storage/progressStorage";

interface QuizPageProps {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
  random?: () => number;
}

export function QuizPage({ banks, storage, random = Math.random }: QuizPageProps) {
  const { bankId } = useParams();
  const bank = banks.find((candidate) => candidate.id === bankId);

  if (!bank) {
    return (
      <EmptyState title="找不到題庫">
        <p>無法開始刷題，請回到首頁選擇有效題庫。</p>
        <Link className="button primary" to="/">返回題庫首頁</Link>
      </EmptyState>
    );
  }

  return <QuizSession bank={bank} storage={storage} random={random} />;
}

interface QuizSessionProps {
  bank: QuestionBank;
  storage: ProgressStorage;
  random: () => number;
}

function QuizSession({ bank, storage, random }: QuizSessionProps) {
  const allQuestionIds = useMemo(
    () => bank.questions.map((question) => question.id),
    [bank.questions],
  );
  const readProgress = (): QuestionBankProgress => cleanStaleQuestionIds(
    storage.getBankProgress(bank.id),
    allQuestionIds,
  );
  const [progress, setProgress] = useState(readProgress);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(() =>
    selectRandomUnseenQuestionId(allQuestionIds, readProgress().seenQuestionIds, random),
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    setProgress(storage.cleanBankProgress(bank.id, allQuestionIds));
  }, [allQuestionIds, bank.id, storage]);

  const currentQuestion = bank.questions.find((question) => question.id === currentQuestionId);

  function toggleOption(optionId: string) {
    if (!currentQuestion || submitted) return;

    if (currentQuestion.type === "single") {
      setSelectedOptionIds([optionId]);
      return;
    }

    setSelectedOptionIds((selected) =>
      selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId],
    );
  }

  function submitAnswer() {
    if (!currentQuestion || submitted || selectedOptionIds.length === 0) return;

    const answerIsCorrect = isAnswerCorrect(
      currentQuestion.correctAnswers,
      selectedOptionIds,
    );
    storage.recordAnswerResult(
      bank.id,
      currentQuestion.id,
      selectedOptionIds,
      answerIsCorrect,
    );
    setProgress(readProgress());
    setCorrect(answerIsCorrect);
    setSubmitted(true);
  }

  function showNextQuestion() {
    const nextProgress = readProgress();
    setProgress(nextProgress);
    setCurrentQuestionId(
      selectRandomUnseenQuestionId(allQuestionIds, nextProgress.seenQuestionIds, random),
    );
    setSelectedOptionIds([]);
    setSubmitted(false);
    setCorrect(null);
  }

  function restart() {
    storage.restartBank(bank.id);
    const restartedProgress = readProgress();
    setProgress(restartedProgress);
    setCurrentQuestionId(
      selectRandomUnseenQuestionId(allQuestionIds, restartedProgress.seenQuestionIds, random),
    );
    setSelectedOptionIds([]);
    setSubmitted(false);
    setCorrect(null);
  }

  function toggleFavorite() {
    if (!currentQuestion) return;
    storage.toggleFavorite(bank.id, currentQuestion.id);
    setProgress(readProgress());
  }

  if (!currentQuestion) {
    return <CompletedState bank={bank} progress={progress} onRestart={restart} />;
  }

  const isFavorite = progress.favoriteQuestionIds.includes(currentQuestion.id);
  const nextWillComplete = progress.seenQuestionIds.length >= bank.questions.length;

  return (
    <section>
      <div className="quiz-topbar">
        <Link className="back-link" to={`/banks/${bank.id}`}>← {bank.shortName ?? bank.name}</Link>
        <span>{progress.seenQuestionIds.length} / {bank.questions.length}</span>
      </div>
      <div className="quiz-layout">
        <article className="quiz-card">
          <div className="question-meta">
            <span>{currentQuestion.type === "single" ? "單選題" : "複選題"}</span>
            <span>{currentQuestion.id}</span>
          </div>
          <div className="question-content markdown-body">
            <MarkdownContent>{currentQuestion.question}</MarkdownContent>
          </div>
          <fieldset className="option-list">
            <legend className="sr-only">請選擇答案</legend>
            {currentQuestion.options.map((option) => {
              const selected = selectedOptionIds.includes(option.id);
              const isCorrectOption = currentQuestion.correctAnswers.includes(option.id);
              const state = submitted
                ? isCorrectOption
                  ? "correct"
                  : selected
                    ? "incorrect"
                    : "disabled"
                : selected
                  ? "selected"
                  : "default";

              return (
                <label className={`question-option ${state}`} key={option.id}>
                  <input
                    type={currentQuestion.type === "single" ? "radio" : "checkbox"}
                    name={`question-${currentQuestion.id}`}
                    value={option.id}
                    checked={selected}
                    disabled={submitted}
                    onChange={() => toggleOption(option.id)}
                  />
                  <strong>{option.id}</strong>
                  <span className="option-text"><InlineMarkdownContent>{option.text}</InlineMarkdownContent></span>
                  {submitted && isCorrectOption && <span className="state-label">正確答案</span>}
                  {submitted && selected && !isCorrectOption && <span className="state-label">你的答案</span>}
                </label>
              );
            })}
          </fieldset>

          {submitted && (
            <div className={correct ? "result-feedback correct" : "result-feedback incorrect"} role="status">
              {correct ? "回答正確" : "回答錯誤"}
            </div>
          )}

          {submitted && currentQuestion.explanation?.trim() && (
            <section className="explanation-panel">
              <h2>詳解</h2>
              <div className="markdown-body"><MarkdownContent>{currentQuestion.explanation}</MarkdownContent></div>
            </section>
          )}

          <div className="quiz-actions">
            <button className="button secondary" type="button" onClick={toggleFavorite}>
              {isFavorite ? "★ 已收藏" : "☆ 收藏"}
            </button>
            {submitted ? (
              <button className="button primary" type="button" onClick={showNextQuestion}>
                {nextWillComplete ? "查看完成結果" : "下一題"}
              </button>
            ) : (
              <button
                className="button primary"
                type="button"
                disabled={selectedOptionIds.length === 0}
                onClick={submitAnswer}
              >
                送出答案
              </button>
            )}
          </div>
        </article>
        <aside className="side-card quiz-side-card">
          <p className="eyebrow">題庫</p>
          <h2>{bank.name}</h2>
          <ProgressSummary bank={bank} progress={progress} />
          <Link className="button secondary full-width" to={`/banks/${bank.id}`}>回題庫介紹</Link>
        </aside>
      </div>
    </section>
  );
}

function CompletedState({
  bank,
  progress,
  onRestart,
}: {
  bank: QuestionBank;
  progress: QuestionBankProgress;
  onRestart: () => void;
}) {
  return (
    <section className="completed-card">
      <p className="eyebrow">Completed</p>
      <h1>本題庫已全部完成</h1>
      <p>你已完成「{bank.name}」的所有題目。</p>
      <ProgressSummary bank={bank} progress={progress} />
      <div className="card-actions centered">
        <button className="button primary" type="button" onClick={onRestart}>重新開始</button>
        <Link className="button secondary" to={`/favorites/${bank.id}`}>查看收藏</Link>
        <Link className="button secondary" to={`/banks/${bank.id}`}>回題庫介紹</Link>
      </div>
    </section>
  );
}

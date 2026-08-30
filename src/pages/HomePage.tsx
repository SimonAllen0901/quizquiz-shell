import { QuestionBankCard } from "../components/QuestionBankCard";
import type { QuestionBank } from "../domain/questionBank";
import type { ProgressStorage } from "../storage/progressStorage";

interface HomePageProps {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
}

export function HomePage({ banks, storage }: HomePageProps) {
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Quizquiz Shell</p>
        <h1>選擇題庫，開始刷題</h1>
        <p className="muted">進度保存在這個瀏覽器中，隨時都能接著完成。</p>
      </div>
      {banks.length === 0 ? (
        <section className="empty-state">
          <h2>尚未載入任何題庫</h2>
          <p>請加入合法的 Question Pack 後重新建置。</p>
        </section>
      ) : (
        <div className="bank-grid">
          {banks.map((bank) => (
            <QuestionBankCard key={bank.id} bank={bank} progress={storage.getBankProgress(bank.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

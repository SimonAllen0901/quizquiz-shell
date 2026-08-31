import { useState, type ChangeEvent } from "react";
import { useOutletContext } from "react-router-dom";
import type { AppLayoutContext } from "../components/AppLayout";
import type { QuestionBank } from "../domain/questionBank";
import type { ProgressStorage } from "../storage/progressStorage";
import type { ThemePreference } from "../storage/themeStorage";

interface SettingsPageProps {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
}

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type PendingReset =
  | { type: "bank"; bank: QuestionBank; step: 1 | 2 }
  | { type: "all"; step: 1 | 2 };

export function SettingsPage({ banks, storage }: SettingsPageProps) {
  const { themePreference, setThemePreference } = useOutletContext<AppLayoutContext>();
  const [selectedBankId, setSelectedBankId] = useState(banks[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);

  function handleThemeChange(event: ChangeEvent<HTMLInputElement>) {
    setThemePreference(event.target.value as ThemePreference);
  }

  function requestSelectedBankReset() {
    const selectedBank = banks.find((bank) => bank.id === selectedBankId);
    if (!selectedBank) return;

    setPendingReset({ type: "bank", bank: selectedBank, step: 1 });
  }

  function requestAllDataReset() {
    setPendingReset({ type: "all", step: 1 });
  }

  function advanceResetConfirmation() {
    setPendingReset((current) => current ? { ...current, step: 2 } : current);
  }

  function confirmReset() {
    if (!pendingReset || pendingReset.step !== 2) return;

    if (pendingReset.type === "bank") {
      storage.resetBank(pendingReset.bank.id);
      setStatusMessage(`已重置「${pendingReset.bank.name}」。`);
    } else {
      storage.resetAll();
      setStatusMessage("已重置全部資料。");
    }
    setPendingReset(null);
  }

  const resetDialogCopy = pendingReset ? getResetDialogCopy(pendingReset) : null;

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Settings</p>
        <h1>設定</h1>
        <p className="muted">調整外觀與本機保存的刷題資料。</p>
      </div>

      <div className="settings-layout">
        <section className="content-card settings-section" aria-labelledby="theme-settings-heading">
          <h2 id="theme-settings-heading">Theme</h2>
          <fieldset className="segmented-control">
            <legend className="sr-only">Theme 設定</legend>
            {themeOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={themePreference === option.value}
                  onChange={handleThemeChange}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="content-card settings-section" aria-labelledby="data-settings-heading">
          <h2 id="data-settings-heading">資料設定</h2>
          <div className="field-group">
            <label htmlFor="reset-bank">選擇題庫</label>
            <select
              id="reset-bank"
              value={selectedBankId}
              onChange={(event) => setSelectedBankId(event.target.value)}
              disabled={banks.length === 0}
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
          </div>
          <div className="settings-actions">
            <button
              className="button secondary"
              type="button"
              disabled={banks.length === 0}
              onClick={requestSelectedBankReset}
            >
              重置所選題庫
            </button>
            <button className="button danger" type="button" onClick={requestAllDataReset}>
              重置全部資料
            </button>
          </div>
          {statusMessage && <p className="settings-status" role="status">{statusMessage}</p>}
        </section>
      </div>

      {pendingReset && resetDialogCopy && (
        <ResetConfirmationDialog
          copy={resetDialogCopy}
          step={pendingReset.step}
          onCancel={() => setPendingReset(null)}
          onConfirm={pendingReset.step === 1 ? advanceResetConfirmation : confirmReset}
        />
      )}
    </section>
  );
}

function ResetConfirmationDialog({
  copy,
  step,
  onCancel,
  onConfirm,
}: {
  copy: { title: string; body: string; action: string };
  step: 1 | 2;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="reset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-body"
      >
        <p className="eyebrow">Step {step} / 2</p>
        <h2 id="reset-dialog-title">{copy.title}</h2>
        <p id="reset-dialog-body">{copy.body}</p>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="button danger" type="button" onClick={onConfirm} autoFocus>
            {copy.action}
          </button>
        </div>
      </section>
    </div>
  );
}

function getResetDialogCopy(reset: PendingReset) {
  if (reset.type === "bank") {
    return {
      title: reset.step === 1 ? "重置所選題庫？" : "再次確認重置題庫",
      body: reset.step === 1
        ? `將清除「${reset.bank.name}」的作答進度、答題結果與收藏。其他題庫不受影響。`
        : "這個動作無法復原。確認後會立即清除所選題庫資料。",
      action: reset.step === 1 ? "確認重置範圍" : "永久重置題庫",
    };
  }

  return {
    title: reset.step === 1 ? "重置全部資料？" : "再次確認重置全部資料",
    body: reset.step === 1
      ? "將清除所有題庫的作答進度、答題結果與收藏。Theme 設定會保留。"
      : "這個動作無法復原。確認後會立即清除全部刷題資料。",
    action: reset.step === 1 ? "確認重置範圍" : "永久重置全部資料",
  };
}

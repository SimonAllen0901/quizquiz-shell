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

export function SettingsPage({ banks, storage }: SettingsPageProps) {
  const { themePreference, setThemePreference } = useOutletContext<AppLayoutContext>();
  const [selectedBankId, setSelectedBankId] = useState(banks[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleThemeChange(event: ChangeEvent<HTMLInputElement>) {
    setThemePreference(event.target.value as ThemePreference);
  }

  function resetSelectedBank() {
    const selectedBank = banks.find((bank) => bank.id === selectedBankId);
    if (!selectedBank) return;

    if (
      window.confirm(`確定要重置「${selectedBank.name}」的所有作答與收藏資料？`) &&
      window.confirm("請再次確認：這個動作無法復原。")
    ) {
      storage.resetBank(selectedBank.id);
      setStatusMessage(`已重置「${selectedBank.name}」。`);
    }
  }

  function resetAllData() {
    if (
      window.confirm("確定要重置所有題庫的作答與收藏資料？") &&
      window.confirm("請再次確認：所有資料都會被清除，且無法復原。")
    ) {
      storage.resetAll();
      setStatusMessage("已重置全部資料。");
    }
  }

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
              onClick={resetSelectedBank}
            >
              重置所選題庫
            </button>
            <button className="button danger" type="button" onClick={resetAllData}>
              重置全部資料
            </button>
          </div>
          {statusMessage && <p className="settings-status" role="status">{statusMessage}</p>}
        </section>
      </div>
    </section>
  );
}

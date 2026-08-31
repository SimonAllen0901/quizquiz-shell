import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { QuestionBank } from "../domain/questionBank";
import { createProgressStorage, PROGRESS_STORAGE_KEY } from "../storage/progressStorage";
import { createThemeStorage, THEME_STORAGE_KEY } from "../storage/themeStorage";
import { MemoryStorage } from "../test/memoryStorage";
import { createAppRoutes } from "./router";

const bank: QuestionBank = {
  id: "test-bank",
  name: "測試題庫",
  shortName: "測試",
  description: "用來驗證核心流程。",
  introduction: "# 題庫介紹\n\n這是 **整合測試** 題庫。",
  questions: [
    {
      id: "q-single",
      type: "single",
      question: "請選出正確的單選答案。",
      options: [
        { id: "A", text: "Alpha" },
        { id: "B", text: "Beta" },
      ],
      correctAnswers: ["A"],
      explanation: "Alpha 才是**正確答案**。",
    },
    {
      id: "q-multiple",
      type: "multiple",
      question: "請選出兩個正確答案。",
      options: [
        { id: "A", text: "Apple" },
        { id: "B", text: "Banana" },
        { id: "C", text: "Cherry" },
      ],
      correctAnswers: ["A", "C"],
    },
  ],
};

function renderRoute(
  path: string,
  {
    banks = [bank],
    memory = new MemoryStorage(),
    random = () => 0,
  }: {
    banks?: readonly QuestionBank[];
    memory?: MemoryStorage;
    random?: () => number;
  } = {},
): { memory: MemoryStorage; router: ReturnType<typeof createMemoryRouter>; storage: ReturnType<typeof createProgressStorage> } & RenderResult {
  const storage = createProgressStorage(memory, () => "2026-08-30T10:00:00.000Z");
  const themeStorage = createThemeStorage(memory);
  const router = createMemoryRouter(
    createAppRoutes({ banks, storage, themeStorage, random }),
    { initialEntries: [path] },
  );
  const view = render(<RouterProvider router={router} />);
  return { ...view, memory, router, storage };
}

describe("core routes", () => {
  it("shows every loaded bank on the home page with canonical links", () => {
    const secondBank: QuestionBank = { ...bank, id: "second", name: "第二題庫" };

    renderRoute("/", { banks: [bank, secondBank] });

    expect(screen.getByRole("heading", { name: "選擇題庫，開始刷題" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "測試題庫" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "第二題庫" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "開始刷題" })[0]).toHaveAttribute(
      "href",
      "/banks/test-bank/quiz",
    );
  });

  it("renders mobile bottom navigation with the main destinations", () => {
    renderRoute("/");

    const bottomNav = screen.getByRole("navigation", { name: "底部主選單" });
    expect(within(bottomNav).getByRole("link", { name: "題庫" })).toHaveAttribute("href", "/");
    expect(within(bottomNav).getByRole("link", { name: "收藏" })).toHaveAttribute("href", "/favorites");
    expect(within(bottomNav).getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
  });

  it("shows the bank introduction and derived progress statistics", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {
          "q-single": {
            questionId: "q-single",
            selectedOptionIds: ["A"],
            correct: true,
            submittedAt: "2026-08-30T09:00:00.000Z",
          },
        },
      },
    }));

    renderRoute("/banks/test-bank", { memory });

    expect(screen.getByRole("heading", { name: "測試題庫" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "題庫介紹" })).toBeInTheDocument();
    expect(screen.getByText("整合測試")).toBeInTheDocument();
    const summary = screen.getByLabelText("作答進度");
    expect(within(summary).getByText("1 / 2")).toBeInTheDocument();
    expect(within(summary).getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "繼續刷題" })).toHaveAttribute(
      "href",
      "/banks/test-bank/quiz",
    );
  });

  it.each(["/banks/missing", "/banks/missing/quiz"])(
    "handles an invalid bankId at %s",
    (path) => {
      renderRoute(path);

      expect(screen.getByRole("heading", { name: "找不到題庫" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "返回題庫首頁" })).toHaveAttribute("href", "/");
    },
  );
});

describe("quiz flow", () => {
  it("submits single and multiple answers, persists results, and reaches completion", () => {
    const { storage } = renderRoute("/banks/test-bank/quiz");

    const submit = screen.getByRole("button", { name: "送出答案" });
    expect(submit).toBeDisabled();
    expect(screen.queryByText("詳解")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Beta/ }));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(screen.getByRole("status")).toHaveTextContent("回答錯誤");
    expect(screen.getByRole("heading", { name: "詳解" })).toBeInTheDocument();
    expect(screen.getByText("正確答案", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Alpha/ })).toBeDisabled();
    expect(storage.getBankProgress(bank.id).answerResults["q-single"]).toMatchObject({
      selectedOptionIds: ["B"],
      correct: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "下一題" }));
    expect(screen.getByText("複選題")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Apple/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Cherry/ }));
    fireEvent.click(screen.getByRole("button", { name: "送出答案" }));

    expect(screen.getByRole("status")).toHaveTextContent("回答正確");
    expect(screen.queryByRole("heading", { name: "詳解" })).not.toBeInTheDocument();
    expect(storage.getBankProgress(bank.id).seenQuestionIds).toEqual([
      "q-single",
      "q-multiple",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "查看完成結果" }));
    expect(screen.getByRole("heading", { name: "本題庫已全部完成" })).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("randomly selects only from unfinished questions", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: [],
        answerResults: {},
      },
    }));

    renderRoute("/banks/test-bank/quiz", { memory, random: () => 0 });

    expect(screen.getByText("請選出兩個正確答案。")).toBeInTheDocument();
    expect(screen.queryByText("請選出正確的單選答案。")).not.toBeInTheDocument();
  });

  it("supports selecting an option with Enter for keyboard use", () => {
    const { container } = renderRoute("/banks/test-bank/quiz");

    expect(container.querySelector(".app-layout")).toHaveClass("quiz-mode");

    const beta = screen.getByRole("radio", { name: /Beta/ });
    fireEvent.keyDown(beta, { key: "Enter" });

    expect(beta).toBeChecked();
    expect(screen.getByRole("button", { name: "送出答案" })).toBeEnabled();
  });

  it("shows completed state on entry and restart keeps favorites while clearing results", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single", "q-multiple"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {
          "q-single": {
            questionId: "q-single",
            selectedOptionIds: ["A"],
            correct: true,
            submittedAt: "2026-08-30T09:00:00.000Z",
          },
        },
      },
    }));
    const { storage } = renderRoute("/banks/test-bank/quiz", { memory });

    expect(screen.getByRole("heading", { name: "本題庫已全部完成" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新開始" }));

    expect(screen.getByText("請選出正確的單選答案。")).toBeInTheDocument();
    expect(storage.getBankProgress(bank.id)).toEqual({
      seenQuestionIds: [],
      favoriteQuestionIds: ["q-single"],
      answerResults: {},
    });
  });
});

describe("favorites flow", () => {
  it("shows only banks that have favorite questions", () => {
    const secondBank: QuestionBank = { ...bank, id: "second", name: "第二題庫" };
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: [],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
      second: {
        seenQuestionIds: [],
        favoriteQuestionIds: [],
        answerResults: {},
      },
    }));

    renderRoute("/favorites", { banks: [bank, secondBank], memory });

    expect(screen.getByRole("heading", { name: "我的收藏" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "測試題庫" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "第二題庫" })).not.toBeInTheDocument();
    expect(screen.getByText("已收藏 1 題")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看收藏" })).toHaveAttribute(
      "href",
      "/favorites/test-bank",
    );
  });

  it("shows favorite question ids and previews without exposing answers", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: [],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
    }));

    renderRoute("/favorites/test-bank", { memory });

    expect(screen.getByRole("heading", { name: "測試題庫" })).toBeInTheDocument();
    expect(screen.getByText("q-single")).toBeInTheDocument();
    expect(screen.getByText("請選出正確的單選答案。")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.queryByText("正確答案")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /q-single/ })).toHaveAttribute(
      "href",
      "/favorites/test-bank/q-single",
    );
  });

  it("shows favorite question detail with options, correct answer, and explanation", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: [],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
    }));

    renderRoute("/favorites/test-bank/q-single", { memory });

    expect(screen.getByText("請選出正確的單選答案。")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getAllByText("正確答案").length).toBeGreaterThan(0);
    expect(screen.getByText("A. Alpha")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "詳解" })).toBeInTheDocument();
    expect(screen.getByText("正確答案", { selector: "strong" })).toBeInTheDocument();
  });

  it("does not show an unfavorited question detail", () => {
    renderRoute("/favorites/test-bank/q-single");

    expect(screen.getByRole("heading", { name: "找不到收藏題目" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回題庫收藏" })).toHaveAttribute(
      "href",
      "/favorites/test-bank",
    );
  });
});

describe("settings flow", () => {
  it("persists theme preference and applies it immediately", () => {
    const { memory } = renderRoute("/settings");

    expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(memory.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("resets the selected bank only after two confirmations", () => {
    const secondBank: QuestionBank = { ...bank, id: "second", name: "第二題庫" };
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
      second: {
        seenQuestionIds: ["q-multiple"],
        favoriteQuestionIds: ["q-multiple"],
        answerResults: {},
      },
    }));
    const { storage } = renderRoute("/settings", { banks: [bank, secondBank], memory });
    fireEvent.change(screen.getByLabelText("選擇題庫"), { target: { value: "second" } });
    fireEvent.click(screen.getByRole("button", { name: "重置所選題庫" }));
    expect(screen.getByRole("dialog", { name: "重置所選題庫？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "確認重置範圍" }));
    expect(screen.getByRole("dialog", { name: "再次確認重置題庫" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "永久重置題庫" }));

    expect(storage.getAppProgress()).toEqual({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("已重置「第二題庫」。");
  });

  it("does not reset a bank when the reset dialog is canceled at the second step", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
    }));
    const { storage } = renderRoute("/settings", { memory });
    fireEvent.click(screen.getByRole("button", { name: "重置所選題庫" }));
    fireEvent.click(screen.getByRole("button", { name: "確認重置範圍" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getBankProgress("test-bank")).toEqual({
      seenQuestionIds: ["q-single"],
      favoriteQuestionIds: ["q-single"],
      answerResults: {},
    });
  });

  it("resets all progress data only after two confirmations", () => {
    const memory = new MemoryStorage();
    memory.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      "test-bank": {
        seenQuestionIds: ["q-single"],
        favoriteQuestionIds: ["q-single"],
        answerResults: {},
      },
    }));
    memory.setItem(THEME_STORAGE_KEY, "dark");
    const { storage } = renderRoute("/settings", { memory });
    fireEvent.click(screen.getByRole("button", { name: "重置全部資料" }));
    expect(screen.getByRole("dialog", { name: "重置全部資料？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "確認重置範圍" }));
    expect(screen.getByRole("dialog", { name: "再次確認重置全部資料" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "永久重置全部資料" }));

    expect(storage.getAppProgress()).toEqual({});
    expect(memory.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("status")).toHaveTextContent("已重置全部資料。");
  });
});

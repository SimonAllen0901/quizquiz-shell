import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { QuestionBank } from "../domain/questionBank";
import { createProgressStorage, PROGRESS_STORAGE_KEY } from "../storage/progressStorage";
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
) {
  const storage = createProgressStorage(memory, () => "2026-08-30T10:00:00.000Z");
  const router = createMemoryRouter(
    createAppRoutes({ banks, storage, random }),
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { memory, router, storage };
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

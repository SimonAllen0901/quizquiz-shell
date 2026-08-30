import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { EmptyState } from "../components/EmptyState";
import { PlaceholderPage } from "../components/PlaceholderPage";
import type { QuestionBank } from "../domain/questionBank";
import { questionBanks } from "../loaders/questionBankLoader";
import { BankPage } from "../pages/BankPage";
import { HomePage } from "../pages/HomePage";
import { QuizPage } from "../pages/QuizPage";
import { progressStorage, type ProgressStorage } from "../storage/progressStorage";

export interface AppDependencies {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
  random: () => number;
}

const defaultDependencies: AppDependencies = {
  banks: questionBanks,
  storage: progressStorage,
  random: Math.random,
};

export function createAppRoutes(
  dependencies: AppDependencies = defaultDependencies,
): RouteObject[] {
  return [
    {
      element: <AppLayout />,
      children: [
        { path: "/", element: <HomePage banks={dependencies.banks} storage={dependencies.storage} /> },
        { path: "/banks/:bankId", element: <BankPage banks={dependencies.banks} storage={dependencies.storage} /> },
        {
          path: "/banks/:bankId/quiz",
          element: <QuizPage banks={dependencies.banks} storage={dependencies.storage} random={dependencies.random} />,
        },
        { path: "/favorites", element: <PlaceholderPage title="我的收藏" description="收藏列表將在後續階段實作。" /> },
        { path: "/favorites/:bankId", element: <PlaceholderPage title="題庫收藏清單" description="收藏列表將在後續階段實作。" /> },
        { path: "/favorites/:bankId/:questionId", element: <PlaceholderPage title="收藏題目詳情" description="收藏詳情將在後續階段實作。" /> },
        { path: "/settings", element: <PlaceholderPage title="設定" description="Theme 與資料設定將在後續階段實作。" /> },
        {
          path: "*",
          element: <EmptyState title="找不到頁面"><p>這個網址不存在。</p></EmptyState>,
        },
      ],
    },
  ];
}

export const router = createBrowserRouter(createAppRoutes());

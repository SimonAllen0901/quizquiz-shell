import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { EmptyState } from "../components/EmptyState";
import type { QuestionBank } from "../domain/questionBank";
import { questionBanks } from "../loaders/questionBankLoader";
import { BankPage } from "../pages/BankPage";
import {
  FavoriteQuestionDetailPage,
  FavoriteQuestionsPage,
  FavoritesPage,
} from "../pages/FavoritesPage";
import { HomePage } from "../pages/HomePage";
import { QuizPage } from "../pages/QuizPage";
import { SettingsPage } from "../pages/SettingsPage";
import { progressStorage, type ProgressStorage } from "../storage/progressStorage";
import { themeStorage, type ThemeStorage } from "../storage/themeStorage";

export interface AppDependencies {
  banks: readonly QuestionBank[];
  storage: ProgressStorage;
  themeStorage: ThemeStorage;
  random: () => number;
}

const defaultDependencies: AppDependencies = {
  banks: questionBanks,
  storage: progressStorage,
  themeStorage,
  random: Math.random,
};

export function createAppRoutes(
  dependencies: AppDependencies = defaultDependencies,
): RouteObject[] {
  return [
    {
      element: <AppLayout themeStorage={dependencies.themeStorage} />,
      children: [
        { path: "/", element: <HomePage banks={dependencies.banks} storage={dependencies.storage} /> },
        { path: "/banks/:bankId", element: <BankPage banks={dependencies.banks} storage={dependencies.storage} /> },
        {
          path: "/banks/:bankId/quiz",
          element: <QuizPage banks={dependencies.banks} storage={dependencies.storage} random={dependencies.random} />,
        },
        { path: "/favorites", element: <FavoritesPage banks={dependencies.banks} storage={dependencies.storage} /> },
        { path: "/favorites/:bankId", element: <FavoriteQuestionsPage banks={dependencies.banks} storage={dependencies.storage} /> },
        { path: "/favorites/:bankId/:questionId", element: <FavoriteQuestionDetailPage banks={dependencies.banks} storage={dependencies.storage} /> },
        { path: "/settings", element: <SettingsPage banks={dependencies.banks} storage={dependencies.storage} /> },
        {
          path: "*",
          element: <EmptyState title="找不到頁面"><p>這個網址不存在。</p></EmptyState>,
        },
      ],
    },
  ];
}

export const router = createBrowserRouter(createAppRoutes());

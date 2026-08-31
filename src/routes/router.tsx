import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { EmptyState } from "../components/EmptyState";
import type { QuestionBank } from "../domain/questionBank";
import { questionBanks } from "../loaders/questionBankLoader";
import { progressStorage, type ProgressStorage } from "../storage/progressStorage";
import { themeStorage, type ThemeStorage } from "../storage/themeStorage";

const HomePage = lazy(() =>
  import("../pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const BankPage = lazy(() =>
  import("../pages/BankPage").then((module) => ({ default: module.BankPage })),
);
const QuizPage = lazy(() =>
  import("../pages/QuizPage").then((module) => ({ default: module.QuizPage })),
);
const FavoritesPage = lazy(() =>
  import("../pages/FavoritesPage").then((module) => ({ default: module.FavoritesPage })),
);
const FavoriteQuestionsPage = lazy(() =>
  import("../pages/FavoritesPage").then((module) => ({ default: module.FavoriteQuestionsPage })),
);
const FavoriteQuestionDetailPage = lazy(() =>
  import("../pages/FavoritesPage").then((module) => ({ default: module.FavoriteQuestionDetailPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

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
        {
          path: "/",
          element: withRouteSuspense(<HomePage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "/banks/:bankId",
          element: withRouteSuspense(<BankPage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "/banks/:bankId/quiz",
          element: withRouteSuspense(
            <QuizPage
              banks={dependencies.banks}
              storage={dependencies.storage}
              random={dependencies.random}
            />,
          ),
        },
        {
          path: "/favorites",
          element: withRouteSuspense(<FavoritesPage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "/favorites/:bankId",
          element: withRouteSuspense(<FavoriteQuestionsPage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "/favorites/:bankId/:questionId",
          element: withRouteSuspense(<FavoriteQuestionDetailPage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "/settings",
          element: withRouteSuspense(<SettingsPage banks={dependencies.banks} storage={dependencies.storage} />),
        },
        {
          path: "*",
          element: <EmptyState title="找不到頁面"><p>這個網址不存在。</p></EmptyState>,
        },
      ],
    },
  ];
}

export const router = createBrowserRouter(createAppRoutes());

function withRouteSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<RouteLoading />}>
      {element}
    </Suspense>
  );
}

function RouteLoading() {
  return (
    <section className="route-loading" role="status" aria-live="polite">
      載入中...
    </section>
  );
}

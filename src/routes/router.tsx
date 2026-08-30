import { createBrowserRouter, useParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PlaceholderPage } from "../components/PlaceholderPage";

function BankPlaceholder({ mode }: { mode: "bank" | "quiz" | "favorites" }) {
  const { bankId } = useParams();
  const titles = {
    bank: "題庫介紹",
    quiz: "隨機刷題",
    favorites: "題庫收藏清單",
  };

  return (
    <PlaceholderPage
      title={titles[mode]}
      description={`Question Bank: **${bankId ?? "unknown"}**`}
    />
  );
}

function FavoriteQuestionPlaceholder() {
  const { bankId, questionId } = useParams();

  return (
    <PlaceholderPage
      title="收藏題目詳情"
      description={`Question Bank: **${bankId ?? "unknown"}**  \nQuestion: **${questionId ?? "unknown"}**`}
    />
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: (
          <PlaceholderPage
            title="題庫首頁"
            description="Question Pack loader 將在後續階段實作。"
          />
        ),
      },
      { path: "/banks/:bankId", element: <BankPlaceholder mode="bank" /> },
      { path: "/quiz/:bankId", element: <BankPlaceholder mode="quiz" /> },
      {
        path: "/favorites",
        element: (
          <PlaceholderPage
            title="我的收藏"
            description="收藏功能將在後續階段實作。"
          />
        ),
      },
      {
        path: "/favorites/:bankId",
        element: <BankPlaceholder mode="favorites" />,
      },
      {
        path: "/favorites/:bankId/:questionId",
        element: <FavoriteQuestionPlaceholder />,
      },
      {
        path: "/settings",
        element: (
          <PlaceholderPage
            title="設定"
            description="Theme 與資料設定將在後續階段實作。"
          />
        ),
      },
      {
        path: "*",
        element: (
          <PlaceholderPage
            title="找不到頁面"
            description="請返回[題庫首頁](/)。"
          />
        ),
      },
    ],
  },
]);

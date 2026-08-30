import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceholderPage } from "./PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders its title and markdown content", () => {
    render(
      <PlaceholderPage
        title="題庫首頁"
        description="This is **Quizquiz Shell**."
      />,
    );

    expect(screen.getByRole("heading", { name: "題庫首頁" })).toBeInTheDocument();
    expect(screen.getByText("Quizquiz Shell")).toHaveTextContent("Quizquiz Shell");
  });
});

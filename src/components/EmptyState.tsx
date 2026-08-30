import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  children: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h1>{title}</h1>
      <div>{children}</div>
    </section>
  );
}

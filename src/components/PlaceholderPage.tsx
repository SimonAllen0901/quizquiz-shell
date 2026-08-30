import { MarkdownContent } from "./MarkdownContent";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <p className="eyebrow">MVP skeleton</p>
      <h1>{title}</h1>
      <MarkdownContent>{description}</MarkdownContent>
    </section>
  );
}

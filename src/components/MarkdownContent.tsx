import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

type MarkdownContentProps = ComponentProps<typeof ReactMarkdown>;

export function MarkdownContent(props: MarkdownContentProps) {
  return <ReactMarkdown {...props} />;
}

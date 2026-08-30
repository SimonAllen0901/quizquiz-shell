import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

type MarkdownContentProps = ComponentProps<typeof ReactMarkdown>;

export function MarkdownContent(props: MarkdownContentProps) {
  return <ReactMarkdown {...props} />;
}

export function InlineMarkdownContent(props: MarkdownContentProps) {
  return (
    <ReactMarkdown
      {...props}
      components={{
        ...props.components,
        p: ({ children }) => <span>{children}</span>,
      }}
    />
  );
}

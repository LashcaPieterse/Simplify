import Markdown from "react-markdown";
import { assertResourceImage } from "@/lib/content/resources";

type MarkdownNode = { type: string; url?: string; identifier?: string; children?: MarkdownNode[] };

function validateImages() {
  return (tree: MarkdownNode) => {
    const definitions = new Map<string, string>();
    const walk = (node: MarkdownNode, visit: (node: MarkdownNode) => void) => {
      visit(node);
      node.children?.forEach((child) => walk(child, visit));
    };
    walk(tree, (node) => {
      if (node.type === "definition" && node.identifier && node.url) definitions.set(node.identifier, node.url);
    });
    walk(tree, (node) => {
      if (node.type === "image" && node.url) assertResourceImage(node.url);
      if (node.type === "imageReference" && node.identifier) {
        const source = definitions.get(node.identifier);
        if (source) assertResourceImage(source);
      }
    });
  };
}

export function ResourceMarkdown({ children }: { children: string }) {
  return (
    <Markdown skipHtml remarkPlugins={[validateImages]} components={{
      a: ({ href, children }) => (
        <a href={href} {...(href && /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline decoration-brand-300 underline-offset-4 transition hover:text-brand-600">{children}</a>
      ),
      blockquote: ({ children }) => <blockquote className="border-l-4 border-brand-200 pl-4 italic">{children}</blockquote>,
      ul: ({ children }) => <ul className="ml-5 list-disc space-y-2 text-brand-700 marker:text-brand-400">{children}</ul>,
      ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2 text-brand-700 marker:text-brand-400">{children}</ol>,
    }}>{children}</Markdown>
  );
}

import { Fragment, createElement, type JSX, type ReactNode } from "react";
import { getExternalLinkProps, normalizeHref } from "@/lib/links";

export type PortableTextSpan = {
  _type: "span";
  text?: string;
  marks?: string[];
};

export type PortableTextMarkDef = {
  _key: string;
  href?: string;
  [key: string]: unknown;
};

export type PortableTextBlock = {
  _type: string;
  _key?: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
  listItem?: "bullet" | "number" | string;
  level?: number;
  [key: string]: unknown;
};

type PortableTextProps = {
  value?: PortableTextBlock[] | null;
};

function renderSpan(span: PortableTextSpan, markDefs: PortableTextMarkDef[] | undefined, key: string) {
  if (span._type !== "span") {
    return null;
  }

  let node: ReactNode = span.text ?? null;
  if (node === null) {
    return null;
  }

  const marks = Array.isArray(span.marks) ? span.marks : [];

  node = marks.reduceRight<ReactNode>((acc, mark) => applyMark(acc, mark, markDefs), node);

  return <Fragment key={key}>{node}</Fragment>;
}

function applyMark(content: ReactNode, mark: string, markDefs: PortableTextMarkDef[] | undefined): ReactNode {
  if (mark === "strong") {
    return <strong>{content}</strong>;
  }
  if (mark === "em") {
    return <em>{content}</em>;
  }
  if (mark === "code") {
    return <code>{content}</code>;
  }

  const definition = markDefs?.find((def) => def._key === mark);
  if (definition?.href) {
    const href = normalizeHref(definition.href);
    const externalProps = getExternalLinkProps(href);

    return (
      <a href={href} {...externalProps} className="underline decoration-brand-300 underline-offset-4 transition hover:text-brand-600">
        {content}
      </a>
    );
  }

  return content;
}

function renderBlock(block: PortableTextBlock, index: number) {
  if (block._type !== "block") {
    return null;
  }

  const key = block._key ?? `block-${index}`;
  const children = (block.children ?? []).map((child, childIndex) =>
    renderSpan(child, block.markDefs, `${key}-${childIndex}`)
  );

  const { tag, className } = getBlockRender(block.style);
  return createElement(tag, { key, className }, children);
}

function getBlockRender(style?: string): { tag: keyof JSX.IntrinsicElements; className?: string } {
  switch (style) {
    case "h2":
      return { tag: "h2" };
    case "h3":
      return { tag: "h3" };
    case "blockquote":
      return { tag: "blockquote", className: "border-l-4 border-brand-200 pl-4 italic" };
    default:
      return { tag: "p" };
  }
}

function groupBlocks(blocks: PortableTextBlock[]) {
  const elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let currentListType: "ul" | "ol" | null = null;
  let listIndex = 0;

  const flushList = () => {
    if (!listItems.length || !currentListType) {
      return;
    }
    const ListTag = currentListType as keyof JSX.IntrinsicElements;
    const listClass = currentListType === "ol" ? "list-decimal" : "list-disc";
    elements.push(
      <ListTag
        key={`list-${listIndex++}`}
        className={`ml-5 ${listClass} space-y-2 text-brand-700 marker:text-brand-400`}
      >
        {listItems}
      </ListTag>
    );
    listItems = [];
    currentListType = null;
  };

  blocks.forEach((block, index) => {
    if (block._type === "block" && block.listItem) {
      const listType = block.listItem === "number" ? "ol" : "ul";
      if (currentListType !== listType) {
        flushList();
        currentListType = listType;
      }
      const key = block._key ?? `block-${index}`;
      const children = (block.children ?? []).map((child, childIndex) =>
        renderSpan(child, block.markDefs, `${key}-${childIndex}`)
      );
      listItems.push(<li key={key}>{children}</li>);
      return;
    }

    flushList();
    const rendered = renderBlock(block, index);
    if (rendered) {
      elements.push(rendered);
    }
  });

  flushList();
  return elements;
}

export function PortableText({ value }: PortableTextProps) {
  if (!value?.length) {
    return null;
  }

  const nodes = groupBlocks(value);

  return <>{nodes}</>;
}

export const PortableTextRenderer = PortableText;

export default PortableText;

import type { PortableTextComponents } from "@portabletext/react";
import { PortableText as PortableTextRenderer } from "@portabletext/react";

import { getExternalLinkProps, normalizeHref } from "@/lib/links";

type LinkValue = {
  href?: string | null;
};

type PortableTextRendererProps = Parameters<typeof PortableTextRenderer>[0];

type PortableTextProps = {
  value: PortableTextRendererProps["value"];
  components?: PortableTextComponents;
};

const defaultComponents: PortableTextComponents = {
  marks: {
    link: ({ children, value }) => {
      const href = normalizeHref((value as LinkValue | undefined)?.href ?? undefined);
      const externalProps = getExternalLinkProps(href);

      return (
        <a href={href} {...externalProps} className="underline decoration-brand-300 underline-offset-4 transition hover:text-brand-600">
          {children}
        </a>
      );
    }
  }
};

function mergeComponents(overrides?: PortableTextComponents): PortableTextComponents {
  if (!overrides) {
    return defaultComponents;
  }

  return {
    ...defaultComponents,
    ...overrides,
    marks: {
      ...defaultComponents.marks,
      ...(overrides.marks ?? {})
    }
  };
}

export function PortableText({ value, components }: PortableTextProps) {
  return <PortableTextRenderer value={value} components={mergeComponents(components)} />;
}

export default PortableText;

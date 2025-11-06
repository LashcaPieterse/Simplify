import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "sanity";

import { getExternalLinkProps, normalizeHref } from "@/lib/links";

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => <h2 className="mt-8 text-2xl font-semibold text-brand-900">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-6 text-xl font-semibold text-brand-900">{children}</h3>,
    normal: ({ children }) => <p className="mt-4 text-base text-brand-700">{children}</p>
  },
  list: {
    bullet: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 text-brand-700">{children}</ul>,
    number: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-brand-700">{children}</ol>
  },
  marks: {
    link: ({ children, value }) => {
      const href = normalizeHref(value?.href as string | undefined);
      const externalProps = getExternalLinkProps(href);

      return (
        <a href={href} className="text-brand-600 underline" {...externalProps}>
          {children}
        </a>
      );
    }
  }
};

export function PortableTextRenderer({ value }: { value: PortableTextBlock[] }) {
  return <PortableText value={value} components={components} />;
}

import { useMemo } from "react";
import type { SanityDocument } from "sanity";
import { resolvePreviewUrl } from "../utils/resolvePreviewUrl";

type PreviewPaneProps = {
  document: {
    displayed: SanityDocument;
  };
};

export function PreviewPane({ document }: PreviewPaneProps) {
  const displayed = document.displayed;
  const previewUrl = useMemo(() => resolvePreviewUrl(displayed), [displayed]);

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Configure the preview URL to enable live preview.
      </div>
    );
  }

  return (
    <iframe
      src={previewUrl}
      title="Preview"
      className="h-full w-full"
      referrerPolicy="no-referrer"
    />
  );
}

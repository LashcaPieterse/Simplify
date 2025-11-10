import { EyeOpenIcon } from "@sanity/icons";
import type { DocumentActionComponent, SanityDocument } from "sanity";
import { resolvePreviewUrl } from "../utils/resolvePreviewUrl";

type SupportedActionTypes =
  | "homePage"
  | "siteSettings"
  | "country"
  | "plan"
  | "regionBundle"
  | "post";

const previewableTypes = new Set<SupportedActionTypes>([
  "homePage",
  "siteSettings",
  "country",
  "plan",
  "regionBundle",
  "post"
]);

export const openPreviewAction: DocumentActionComponent = (props) => {
  const doc = (props.draft || props.published) as SanityDocument | undefined;

  if (!doc || !previewableTypes.has(doc._type as SupportedActionTypes)) {
    return null;
  }

  return {
    label: "Open preview",
    icon: EyeOpenIcon,
    onHandle: () => {
      const url = resolvePreviewUrl(doc);
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    }
  };
};

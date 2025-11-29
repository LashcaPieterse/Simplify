import {
  DefaultDocumentNodeResolver,
  StructureBuilder
} from "sanity/desk";
import { CogIcon, EarthGlobeIcon, DocumentTextIcon, BookIcon, PackageIcon } from "@sanity/icons";
import { PreviewPane } from "./components/PreviewPane";

const singletonItems = [
  {
    id: "siteSettings",
    title: "Site Settings",
    schemaType: "siteSettings"
  },
  {
    id: "homePage",
    title: "Home",
    schemaType: "homePage"
  }
] as const;

const previewableTypes = new Set([
  "siteSettings",
  "homePage",
  "country",
  "plan",
  "eSimProduct",
  "regionBundle",
  "post"
]);

export const structure = (S: StructureBuilder) =>
  S.list()
    .title("Content")
    .items([
      ...singletonItems.map((singleton) =>
        S.listItem()
          .title(singleton.title)
          .icon(singleton.schemaType === "siteSettings" ? CogIcon : EarthGlobeIcon)
          .child(
            S.document()
              .schemaType(singleton.schemaType)
              .documentId(singleton.id)
          )
      ),
      S.divider(),
      S.documentTypeListItem("country").title("Countries").icon(EarthGlobeIcon),
      S.documentTypeListItem("carrier").title("Carriers").icon(DocumentTextIcon),
      S.documentTypeListItem("plan").title("Plans").icon(PackageIcon),
      S.documentTypeListItem("catalogCountry")
        .title("Catalog Countries")
        .icon(EarthGlobeIcon),
      S.documentTypeListItem("catalogOperator")
        .title("Catalog Operators")
        .icon(DocumentTextIcon),
      S.documentTypeListItem("catalogPackage")
        .title("Catalog Packages")
        .icon(PackageIcon),
      S.documentTypeListItem("eSimProduct").title("eSIM Products").icon(PackageIcon),
      S.documentTypeListItem("regionBundle").title("Region Bundles").icon(PackageIcon),
      S.documentTypeListItem("post").title("Posts").icon(BookIcon)
    ]);

export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, { schemaType }) => {
  if (previewableTypes.has(schemaType)) {
    return S.document().views([S.view.form(), S.view.component(PreviewPane).title("Preview")]);
  }

  return S.document();
};

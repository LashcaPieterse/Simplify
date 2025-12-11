import { defineField, defineType } from "sanity";
import { CatalogPackagePriceInput } from "../components/CatalogPackagePriceInput";

const statusOptions: { title: string; value: "active" | "comingSoon" | "archived" }[] = [
  { title: "Active", value: "active" },
  { title: "Coming soon", value: "comingSoon" },
  { title: "Archived", value: "archived" }
];

export const eSimProduct = defineType({
  name: "eSimProduct",
  title: "Featured Product",
  type: "document",
  fields: [
    defineField({
      name: "displayName",
      title: "Display name",
      type: "string",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "displayName", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "priceUSD",
      title: "Price (USD)",
      type: "number",
      readOnly: true,
      components: { input: CatalogPackagePriceInput },
      description: "Derived from the selected catalog package selling price.",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      description: "Optional. If left empty, the cover image from the linked Catalog Country will be used.",
    }),
    defineField({
      name: "shortDescription",
      title: "Short description",
      type: "string",
      validation: (Rule) => Rule.required().max(200)
    }),
    defineField({
      name: "longDescription",
      title: "Long description",
      type: "array",
      of: [{ type: "block" }],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "package",
      title: "Catalog package",
      type: "reference",
      to: [{ type: "catalogPackage" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "country",
      title: "Catalog country",
      type: "reference",
      to: [{ type: "catalogCountry" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "providerBadge",
      title: "Provider badge",
      type: "string",
      description: "Optional badge text shown alongside the provider.",
      validation: (Rule) => Rule.max(40)
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: statusOptions,
        layout: "radio"
      },
      initialValue: statusOptions[0].value,
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "keywords",
      title: "Search keywords",
      type: "array",
      of: [{ type: "string" }],
      validation: (Rule) => Rule.required().min(1)
    })
  ],
  preview: {
    select: {
      title: "displayName",
      subtitle: "status",
      media: "coverImage",
      priceUSD: "priceUSD"
    },
    prepare({ title, subtitle, media, priceUSD }) {
      const priceLabel =
        typeof priceUSD === "number" ? `$${priceUSD.toFixed(2)}` : "Price unavailable";

      return {
        title,
        subtitle: subtitle ? `${subtitle} • ${priceLabel}` : priceLabel,
        media
      };
    }
  }
});

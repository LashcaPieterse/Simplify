import { defineField, defineType } from "sanity";

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
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      description: "Optional. If left empty, the cover image from the linked Catalog Country will be used.",
      validation: (Rule) => Rule.optional()
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
      name: "plan",
      title: "Associated plan",
      type: "reference",
      to: [{ type: "plan" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "reference",
      to: [{ type: "country" }],
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
      media: "coverImage"
    }
  }
});

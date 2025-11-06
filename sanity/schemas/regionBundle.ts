import { defineField, defineType } from "sanity";

export const regionBundle = defineType({
  name: "regionBundle",
  title: "Region bundle",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Name",
      validation: (Rule) => Rule.required().max(80)
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "countries",
      type: "array",
      title: "Countries",
      of: [{ type: "reference", to: [{ type: "country" }] }],
      validation: (Rule) => Rule.required().min(2)
    }),
    defineField({
      name: "sharedDataGB",
      type: "number",
      title: "Shared data (GB)",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "includes",
      type: "array",
      title: "Includes",
      of: [{ type: "string" }],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "fiveG",
      type: "boolean",
      title: "5G access"
    }),
    defineField({
      name: "support",
      type: "string",
      title: "Support",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "perks",
      type: "array",
      title: "Perks",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "heroImage",
      type: "image",
      title: "Hero image",
      options: { hotspot: true }
    }),
    defineField({
      name: "ctaLabel",
      type: "string",
      title: "CTA label",
      validation: (Rule) => Rule.max(80)
    }),
    defineField({
      name: "ctaTarget",
      type: "url",
      title: "CTA target"
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "support",
      media: "heroImage"
    }
  }
});

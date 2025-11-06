import { defineField, defineType } from "sanity";

export const plan = defineType({
  name: "plan",
  title: "Plan",
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
      name: "priceUSD",
      type: "number",
      title: "Price (USD)",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "dataGB",
      type: "number",
      title: "Data (GB)",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "validityDays",
      type: "number",
      title: "Validity (days)",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "hotspot",
      type: "boolean",
      title: "Hotspot support"
    }),
    defineField({
      name: "fiveG",
      type: "boolean",
      title: "5G access"
    }),
    defineField({
      name: "features",
      type: "array",
      title: "Key features",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "provider",
      type: "reference",
      title: "Provider",
      to: [{ type: "carrier" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "country",
      type: "reference",
      title: "Country",
      to: [{ type: "country" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "label",
      type: "string",
      title: "Badge label",
      validation: (Rule) => Rule.max(30)
    }),
    defineField({
      name: "shortBlurb",
      type: "string",
      title: "Short blurb",
      validation: (Rule) => Rule.required().max(180)
    }),
    defineField({
      name: "whatsIncluded",
      type: "array",
      title: "What's included",
      of: [{ type: "string" }],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "installSteps",
      type: "array",
      title: "Installation steps",
      of: [{ type: "block" }],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "terms",
      type: "array",
      title: "Terms",
      of: [{ type: "block" }]
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "provider.title"
    }
  }
});

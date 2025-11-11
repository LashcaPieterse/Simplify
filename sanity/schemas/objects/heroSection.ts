import { defineField, defineType } from "sanity";

export const heroSection = defineType({
  name: "heroSection",
  title: "Hero section",
  type: "object",
  fields: [
    defineField({
      name: "headline",
      type: "string",
      title: "Headline",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "subhead",
      type: "text",
      rows: 3,
      title: "Subhead",
      validation: (Rule) => Rule.required().max(320)
    }),
    defineField({
      name: "ctas",
      title: "Calls to action",
      type: "array",
      of: [
        defineField({
          name: "cta",
          type: "link",
          title: "CTA"
        })
      ],
      validation: (Rule) => Rule.max(2)
    }),
    defineField({
      name: "featuredProducts",
      title: "Featured products",
      description: "Highlight up to three hero products to surface in the storefront card.",
      type: "array",
      of: [
        defineField({
          name: "product",
          type: "reference",
          to: [{ type: "eSimProduct" }]
        })
      ],
      validation: (Rule) => Rule.max(3)
    }),
    defineField({
      name: "stats",
      title: "Stats",
      type: "array",
      of: [
        defineField({
          name: "stat",
          title: "Stat",
          type: "object",
          fields: [
            defineField({
              name: "label",
              type: "string",
              title: "Label",
              validation: (Rule) => Rule.required().max(80)
            }),
            defineField({
              name: "value",
              type: "string",
              title: "Value",
              validation: (Rule) => Rule.required().max(40)
            })
          ]
        })
      ],
      validation: (Rule) => Rule.required().min(1).max(3)
    })
  ]
});

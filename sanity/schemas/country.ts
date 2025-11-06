import { defineField, defineType } from "sanity";

export const country = defineType({
  name: "country",
  title: "Country",
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
      options: {
        source: "title",
        maxLength: 96
      },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "featured",
      type: "boolean",
      title: "Featured"
    }),
    defineField({
      name: "badge",
      type: "string",
      title: "Badge",
      description: "Short badge label such as 'Popular'",
      validation: (Rule) => Rule.max(30)
    }),
    defineField({
      name: "coverImage",
      type: "image",
      title: "Cover image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "summary",
      type: "text",
      rows: 4,
      title: "Summary",
      validation: (Rule) => Rule.required().max(320)
    }),
    defineField({
      name: "carriers",
      type: "array",
      title: "Carriers",
      of: [{ type: "reference", to: [{ type: "carrier" }] }]
    }),
    defineField({
      name: "plans",
      type: "array",
      title: "Plans",
      of: [{ type: "reference", to: [{ type: "plan" }] }]
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "badge",
      media: "coverImage"
    }
  }
});

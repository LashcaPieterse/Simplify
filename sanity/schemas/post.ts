import { defineField, defineType } from "sanity";

export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      title: "Excerpt",
      validation: (Rule) => Rule.required().max(240)
    }),
    defineField({
      name: "coverImage",
      type: "image",
      title: "Cover image",
      options: { hotspot: true }
    }),
    defineField({
      name: "body",
      type: "array",
      title: "Body",
      of: [{ type: "block" }],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "readingMinutes",
      type: "number",
      title: "Reading minutes",
      validation: (Rule) => Rule.required().positive()
    }),
    defineField({
      name: "tags",
      type: "array",
      title: "Tags",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "publishedAt",
      type: "datetime",
      title: "Published at",
      validation: (Rule) => Rule.required()
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "publishedAt",
      media: "coverImage"
    }
  }
});

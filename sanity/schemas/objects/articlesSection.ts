import { defineField, defineType } from "sanity";

export const articlesSection = defineType({
  name: "articlesSection",
  title: "Articles section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "posts",
      title: "Posts",
      type: "array",
      of: [{ type: "reference", to: [{ type: "post" }] }],
      validation: (Rule) => Rule.required().min(1).max(4)
    })
  ]
});

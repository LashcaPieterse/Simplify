import { defineField, defineType } from "sanity";

export const link = defineType({
  name: "link",
  title: "Link",
  type: "object",
  fields: [
    defineField({
      name: "label",
      type: "string",
      title: "Label",
      validation: (Rule) => Rule.required().min(1).max(120)
    }),
    defineField({
      name: "url",
      type: "url",
      title: "URL",
      validation: (Rule) => Rule.required(),
      description: "Accepts internal or external URLs"
    })
  ]
});

import { defineField, defineType } from "sanity";

export const whyChooseUsSection = defineType({
  name: "whyChooseUsSection",
  title: "Why choose us section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "bullets",
      title: "Bullets",
      type: "array",
      of: [{ type: "iconBullet" }],
      validation: (Rule) => Rule.required().min(3).max(6)
    })
  ]
});

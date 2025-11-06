import { defineField, defineType } from "sanity";

export const newsletterSection = defineType({
  name: "newsletterSection",
  title: "Newsletter section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "body",
      type: "text",
      rows: 3,
      title: "Body",
      validation: (Rule) => Rule.required().max(320)
    }),
    defineField({
      name: "ctaLabel",
      type: "string",
      title: "CTA label",
      validation: (Rule) => Rule.required().max(60)
    }),
    defineField({
      name: "ctaTarget",
      type: "url",
      title: "CTA target",
      validation: (Rule) => Rule.required()
    })
  ]
});

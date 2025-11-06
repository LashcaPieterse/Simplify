import { defineField, defineType } from "sanity";

export const iconBullet = defineType({
  name: "iconBullet",
  title: "Icon bullet",
  type: "object",
  fields: [
    defineField({
      name: "iconName",
      type: "string",
      title: "Icon name",
      description: "Name of the icon rendered in the front-end icon set",
      validation: (Rule) => Rule.required().max(60)
    }),
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "body",
      type: "text",
      rows: 3,
      title: "Body",
      validation: (Rule) => Rule.required().max(280)
    })
  ]
});

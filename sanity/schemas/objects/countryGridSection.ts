import { defineField, defineType } from "sanity";

export const countryGridSection = defineType({
  name: "countryGridSection",
  title: "Country grid section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "countries",
      type: "array",
      title: "Countries",
      of: [{ type: "reference", to: [{ type: "country" }] }],
      validation: (Rule) => Rule.required().min(1).max(6)
    })
  ]
});

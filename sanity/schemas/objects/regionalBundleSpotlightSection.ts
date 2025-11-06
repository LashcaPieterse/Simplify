import { defineField, defineType } from "sanity";

export const regionalBundleSpotlightSection = defineType({
  name: "regionalBundleSpotlightSection",
  title: "Regional bundle spotlight",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "bundle",
      title: "Region bundle",
      type: "reference",
      to: [{ type: "regionBundle" }],
      validation: (Rule) => Rule.required()
    })
  ]
});

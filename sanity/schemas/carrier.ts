import { defineField, defineType } from "sanity";

export const carrier = defineType({
  name: "carrier",
  title: "Carrier",
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
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "logo",
      type: "image",
      title: "Logo",
      options: { hotspot: true }
    }),
    defineField({
      name: "country",
      type: "reference",
      title: "Country",
      to: [{ type: "country" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "notes",
      type: "text",
      rows: 4,
      title: "Notes"
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "country.title",
      media: "logo"
    }
  }
});

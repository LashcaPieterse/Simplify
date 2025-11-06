import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Site title",
      validation: (Rule) => Rule.required().max(80)
    }),
    defineField({
      name: "tagline",
      type: "string",
      title: "Tagline",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "logo",
      type: "image",
      title: "Logo",
      options: { hotspot: true }
    }),
    defineField({
      name: "contactEmail",
      type: "string",
      title: "Contact email",
      validation: (Rule) => Rule.required().email()
    }),
    defineField({
      name: "navigation",
      type: "array",
      title: "Navigation",
      of: [{ type: "link" }],
      validation: (Rule) => Rule.required().min(1).max(6)
    }),
    defineField({
      name: "footerLinks",
      type: "array",
      title: "Footer links",
      of: [{ type: "link" }],
      validation: (Rule) => Rule.max(8)
    })
  ],
  preview: {
    prepare: () => ({
      title: "Site settings"
    })
  }
});

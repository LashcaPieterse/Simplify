import { defineField, defineType } from "sanity";

export const catalogCountry = defineType({
  name: "catalogCountry",
  title: "Catalog Country",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "countryCode",
      title: "Country code",
      type: "string",
      validation: (Rule) => Rule.required().max(4)
    }),
    defineField({
      name: "image",
      title: "Cover image",
      type: "image",
      options: { hotspot: true }
    }),
    defineField({
      name: "metadataJson",
      title: "Raw metadata (JSON)",
      type: "text",
      rows: 4,
      description: "Upstream payload persisted for debugging.",
      readOnly: true
    }),
    defineField({
      name: "lastSyncedAt",
      title: "Last synced at",
      type: "datetime",
      readOnly: true
    })
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "countryCode",
      media: "image"
    }
  }
});

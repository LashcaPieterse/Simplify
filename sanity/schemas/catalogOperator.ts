import { defineField, defineType } from "sanity";

export const catalogOperator = defineType({
  name: "catalogOperator",
  title: "Catalog Operator",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required().max(120)
    }),
    defineField({
      name: "apiOperatorId",
      title: "API operator ID",
      type: "number"
    }),
    defineField({
      name: "operatorCode",
      title: "Operator code",
      type: "string"
    }),
    defineField({
      name: "image",
      title: "Cover image",
      type: "image",
      options: { hotspot: true }
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "reference",
      to: [{ type: "catalogCountry" }],
      validation: (Rule) => Rule.required()
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
      subtitle: "country.title",
      media: "image"
    }
  }
});

import { defineField, defineType } from "sanity";

export const catalogPackage = defineType({
  name: "catalogPackage",
  title: "Catalog Package",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "externalId",
      title: "External ID",
      type: "string",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "priceCents",
      title: "Price (cents)",
      type: "number",
      validation: (Rule) => Rule.required().min(0)
    }),
    defineField({
      name: "sellingPriceCents",
      title: "Selling price (cents)",
      type: "number",
      description: "Recommended retail price when available."
    }),
    defineField({
      name: "currencyCode",
      title: "Currency",
      type: "string",
      validation: (Rule) => Rule.required().length(3)
    }),
    defineField({
      name: "dataAmountMb",
      title: "Data allowance (MB)",
      type: "number"
    }),
    defineField({
      name: "validityDays",
      title: "Validity (days)",
      type: "number"
    }),
    defineField({
      name: "isUnlimited",
      title: "Unlimited data",
      type: "boolean"
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "reference",
      to: [{ type: "catalogCountry" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "operator",
      title: "Operator",
      type: "reference",
      to: [{ type: "catalogOperator" }],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "shortInfo",
      title: "Short info",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "qrInstallation",
      title: "QR installation notes",
      type: "text",
      rows: 4
    }),
    defineField({
      name: "manualInstallation",
      title: "Manual installation notes",
      type: "text",
      rows: 4
    }),
    defineField({
      name: "isFairUsagePolicy",
      title: "Has fair usage policy",
      type: "boolean"
    }),
    defineField({
      name: "fairUsagePolicy",
      title: "Fair usage policy",
      type: "text",
      rows: 3
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
      name: "isActive",
      title: "Active",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "deactivatedAt",
      title: "Deactivated at",
      type: "datetime"
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
      subtitle: "operator.title",
      media: "image"
    }
  }
});

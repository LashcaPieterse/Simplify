import { defineField, defineType } from "sanity";

const destinationTypes = [
  { title: "City", value: "city" },
  { title: "Country", value: "country" },
  { title: "Route", value: "route" }
];

export const tripDestination = defineType({
  name: "tripDestination",
  title: "Trip Destination",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
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
      name: "destinationType",
      title: "Destination type",
      type: "string",
      options: {
        list: destinationTypes,
        layout: "radio"
      },
      initialValue: "city",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "country",
      title: "Catalog country",
      type: "reference",
      to: [{ type: "catalogCountry" }],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const document = context.document as { active?: boolean } | undefined;
          if (document?.active === false || value?._ref) {
            return true;
          }
          return "Active trip destinations should reference a catalog country.";
        }).warning()
    }),
    defineField({
      name: "aliases",
      title: "Aliases",
      description: "Alternative spellings users may type, such as Marrakech for Marrakesh.",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "searchTerms",
      title: "Search terms",
      description: "Airport names, route names, neighborhoods, or common travel phrases.",
      type: "array",
      of: [{ type: "string" }]
    }),
    defineField({
      name: "active",
      title: "Active",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "featured",
      title: "Featured chip",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "sortOrder",
      title: "Sort order",
      type: "number",
      initialValue: 100
    }),
    defineField({
      name: "regionalBundle",
      title: "Regional bundle",
      description: "Optional bundle to promote when this destination implies a broader route.",
      type: "reference",
      to: [{ type: "regionBundle" }]
    }),
    defineField({
      name: "preferredPackages",
      title: "Preferred packages",
      description: "Merchandising boosts only. Live Airalo availability and price still decide whether a package can sell.",
      type: "array",
      of: [
        defineField({
          name: "package",
          title: "Package",
          type: "reference",
          to: [{ type: "catalogPackage" }],
          options: {
            filter: ({ document }) => {
              const doc = document as { country?: { _ref?: string } } | null;
              const countryId = doc?.country?._ref;
              if (!countryId) {
                return { filter: "defined(country)", params: {} };
              }
              return { filter: "country._ref == $countryId", params: { countryId } };
            }
          }
        })
      ],
      validation: (Rule) =>
        Rule.unique().custom(async (_value, context) => {
          const document = context.document as {
            active?: boolean;
            country?: { _ref?: string };
          } | undefined;
          const countryId = document?.country?._ref;

          if (document?.active === false || !countryId) {
            return true;
          }

          const client = context.getClient({ apiVersion: "2025-01-01" });
          const activePackageCount = await client.fetch<number>(
            'count(*[_type == "catalogPackage" && country._ref == $countryId && isActive == true])',
            { countryId }
          );

          if (activePackageCount > 0) {
            return true;
          }

          return "No active catalog packages are available for this destination country.";
        }).warning()
    })
  ],
  orderings: [
    {
      title: "Featured order",
      name: "featuredOrder",
      by: [
        { field: "featured", direction: "desc" },
        { field: "sortOrder", direction: "asc" },
        { field: "title", direction: "asc" }
      ]
    }
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "country.title",
      type: "destinationType"
    },
    prepare({ title, subtitle, type }) {
      return {
        title,
        subtitle: [type, subtitle].filter(Boolean).join(" · ")
      };
    }
  }
});

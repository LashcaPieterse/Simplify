import { defineField, defineType } from "sanity";

export const heroSection = defineType({
  name: "heroSection",
  title: "Hero section",
  type: "object",
  fields: [
    defineField({
      name: "headline",
      type: "string",
      title: "Headline",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "subhead",
      type: "text",
      rows: 3,
      title: "Subhead",
      validation: (Rule) => Rule.required().max(320)
    }),
    defineField({
      name: "ctas",
      title: "Calls to action",
      type: "array",
      of: [
        defineField({
          name: "cta",
          type: "link",
          title: "CTA"
        })
      ],
      validation: (Rule) => Rule.max(2)
    }),
    defineField({
      name: "featuredProducts",
      title: "Featured products",
      description: "Highlight up to three hero products to surface in the storefront card.",
      type: "array",
      of: [
        defineField({
          name: "product",
          type: "reference",
          to: [{ type: "eSimProduct" }]
        })
      ],
      validation: (Rule) => Rule.max(3)
    }),
    defineField({
      name: "tripMatcherSettings",
      title: "Trip matcher settings",
      type: "object",
      fields: [
        defineField({
          name: "title",
          title: "Widget title",
          type: "string",
          initialValue: "Plan your African eSIM",
          validation: (Rule) => Rule.max(80)
        }),
        defineField({
          name: "subtitle",
          title: "Widget subtitle",
          type: "string",
          initialValue: "Match destination, stay length, and data needs.",
          validation: (Rule) => Rule.max(140)
        }),
        defineField({
          name: "badgeLabel",
          title: "Badge label",
          type: "string",
          initialValue: "Live match",
          validation: (Rule) => Rule.max(40)
        }),
        defineField({
          name: "placeholder",
          title: "Search placeholder",
          type: "string",
          initialValue: "City, country, or route",
          validation: (Rule) => Rule.max(80)
        }),
        defineField({
          name: "popularDestinations",
          title: "Popular destinations",
          description: "Ordered chips shown below the search input.",
          type: "array",
          of: [
            defineField({
              name: "destination",
              title: "Destination",
              type: "reference",
              to: [{ type: "tripDestination" }]
            })
          ],
          validation: (Rule) => Rule.max(18)
        }),
        defineField({
          name: "noMatchTitle",
          title: "No-match title",
          type: "string",
          initialValue: "No active match for {destination}.",
          description: "Use {destination} where the typed destination should appear.",
          validation: (Rule) => Rule.max(120)
        }),
        defineField({
          name: "noMatchBody",
          title: "No-match body",
          type: "string",
          initialValue: "Try one of the live African destinations below.",
          validation: (Rule) => Rule.max(180)
        }),
        defineField({
          name: "regionalTripLabel",
          title: "Regional trip label",
          type: "string",
          initialValue: "Multi-country trip? Compare {bundle}.",
          description: "Use {bundle} where the regional bundle title should appear.",
          validation: (Rule) => Rule.max(140)
        }),
        defineField({
          name: "emptyStateMessage",
          title: "Empty state message",
          type: "string",
          initialValue: "Live plans are syncing. Pick a destination to see the best available match.",
          validation: (Rule) => Rule.max(180)
        })
      ]
    }),
    defineField({
      name: "stats",
      title: "Stats",
      type: "array",
      of: [
        defineField({
          name: "stat",
          title: "Stat",
          type: "object",
          fields: [
            defineField({
              name: "label",
              type: "string",
              title: "Label",
              validation: (Rule) => Rule.required().max(80)
            }),
            defineField({
              name: "value",
              type: "string",
              title: "Value",
              validation: (Rule) => Rule.required().max(40)
            })
          ]
        })
      ],
      validation: (Rule) => Rule.required().min(1).max(3)
    })
  ]
});

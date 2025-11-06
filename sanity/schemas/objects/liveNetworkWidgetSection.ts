import { defineField, defineType } from "sanity";

export const liveNetworkWidgetSection = defineType({
  name: "liveNetworkWidgetSection",
  title: "Live network widget",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "regions",
      title: "Regions",
      type: "array",
      of: [
        defineField({
          name: "region",
          type: "object",
          title: "Region",
          fields: [
            defineField({
              name: "name",
              type: "string",
              title: "Name",
              validation: (Rule) => Rule.required().max(80)
            }),
            defineField({
              name: "latencyMs",
              type: "number",
              title: "Latency (ms)",
              validation: (Rule) => Rule.required().positive()
            }),
            defineField({
              name: "signalQuality",
              type: "string",
              title: "Signal quality",
              validation: (Rule) => Rule.required().max(40)
            })
          ]
        })
      ],
      validation: (Rule) => Rule.required().min(3).max(6)
    })
  ]
});

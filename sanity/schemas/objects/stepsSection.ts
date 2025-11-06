import { defineField, defineType } from "sanity";

export const stepsSection = defineType({
  name: "stepsSection",
  title: "Steps section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      validation: (Rule) => Rule.required().max(160)
    }),
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      of: [
        defineField({
          name: "step",
          title: "Step",
          type: "object",
          fields: [
            defineField({
              name: "stepNo",
              type: "number",
              title: "Step number",
              validation: (Rule) => Rule.required().integer().positive()
            }),
            defineField({
              name: "title",
              type: "string",
              title: "Title",
              validation: (Rule) => Rule.required().max(80)
            }),
            defineField({
              name: "body",
              type: "text",
              title: "Body",
              rows: 3,
              validation: (Rule) => Rule.required().max(240)
            })
          ]
        })
      ],
      validation: (Rule) => Rule.required().min(3).max(5)
    })
  ]
});

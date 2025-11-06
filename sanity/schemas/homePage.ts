import { defineField, defineType } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Internal title",
      initialValue: "Home",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: [
        { type: "heroSection" },
        { type: "countryGridSection" },
        { type: "whyChooseUsSection" },
        { type: "stepsSection" },
        { type: "regionalBundleSpotlightSection" },
        { type: "liveNetworkWidgetSection" },
        { type: "newsletterSection" },
        { type: "articlesSection" }
      ],
      validation: (Rule) => Rule.required().min(1)
    })
  ],
  preview: {
    prepare: () => ({
      title: "Home page"
    })
  }
});

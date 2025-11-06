export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "";
export const apiVersion = process.env.SANITY_API_VERSION ?? "2025-01-01";

const notConfiguredMessage =
  "Sanity client is not configured in this build. All content is served from local fixtures.";

export const sanityClient = {
  async fetch() {
    throw new Error(notConfiguredMessage);
  }
};

export const getSanityClient = () => sanityClient;
export const previewClient = sanityClient;

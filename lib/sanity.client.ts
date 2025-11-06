import { createClient, type ClientConfig } from "next-sanity";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
export const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";
const token = process.env.SANITY_READ_TOKEN;

if (!projectId || !dataset) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET environment variables.");
}

const config: ClientConfig = {
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published"
};

export const sanityClient = createClient(config);

export const getSanityClient = (previewToken?: string) =>
  previewToken
    ? createClient({
        ...config,
        useCdn: false,
        token: previewToken,
        perspective: "previewDrafts"
      })
    : sanityClient;

export const previewClient = token
  ? createClient({
      ...config,
      useCdn: false,
      token,
      perspective: "previewDrafts"
    })
  : sanityClient;

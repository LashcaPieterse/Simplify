import { createClient, type ClientConfig, type SanityClient } from "next-sanity";

export const projectId =
  process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "";
export const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

export const isSanityConfigured = Boolean(projectId && dataset);

const defaultConfig: ClientConfig = {
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production" && !process.env.SANITY_READ_TOKEN,
  perspective: "published"
};

let cachedClient: SanityClient | null = null;
let cachedPreviewClient: SanityClient | null = null;

const assertConfig = () => {
  if (!isSanityConfigured) {
    throw new Error(
      "Missing Sanity project ID or dataset. Add SANITY_PROJECT_ID and SANITY_DATASET to your environment."
    );
  }
};

export const getSanityClient = ({ preview = false }: { preview?: boolean } = {}) => {
  assertConfig();

  if (preview) {
    if (cachedPreviewClient) {
      return cachedPreviewClient;
    }

    const token = process.env.SANITY_READ_TOKEN;
    cachedPreviewClient = createClient({
      ...defaultConfig,
      token,
      useCdn: false,
      perspective: token ? "previewDrafts" : "published"
    });

    return cachedPreviewClient;
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(defaultConfig);
  return cachedClient;
};

export const sanityClient = isSanityConfigured ? getSanityClient() : null;
export const previewClient =
  isSanityConfigured && process.env.SANITY_READ_TOKEN
    ? getSanityClient({ preview: true })
    : sanityClient;

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemas";
import { structure, defaultDocumentNode } from "./sanity/deskStructure";
import { openPreviewAction } from "./sanity/plugins/openPreviewAction";

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET;

if (!projectId || !dataset) {
  throw new Error(
    "Sanity project ID and dataset must be provided via NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET environment variables (or their SANITY_* counterparts)."
  );
}

export default defineConfig({
  name: "simplify-studio",
  title: "Simplify Studio",
  projectId,
  dataset,
  apiVersion: process.env.SANITY_API_VERSION || "2025-01-01",
  basePath: process.env.SANITY_STUDIO_BASE_PATH || "/studio",
  plugins: [
    deskTool({
      structure,
      defaultDocumentNode
    }),
    visionTool()
  ],
  schema: {
    types: schemaTypes
  },
  document: {
    actions: (prev) => [...prev, openPreviewAction]
  }
});

import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemas";
import { defaultDocumentNode, structure } from "./sanity/deskStructure";
import { openPreviewAction } from "./sanity/plugins/openPreviewAction";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";
const basePath = process.env.SANITY_STUDIO_BASE_PATH || "/studio";

if (!projectId || !dataset) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET environment variables.");
}

const singletonTypes = new Set(["siteSettings", "homePage"]);
const previewActionTypes = new Set(["siteSettings", "homePage", "country", "plan", "regionBundle", "post"]);
const privilegedRoles = new Set(["administrator", "editor"]);

export default defineConfig({
  name: "simplify-studio",
  title: "Simplify Studio",
  projectId,
  dataset,
  basePath,
  schema: {
    types: schemaTypes
  },
  plugins: [deskTool({ structure, defaultDocumentNode }), visionTool()],
  document: {
    newDocumentOptions: (prev, { creationContext }) => {
      if (creationContext.type === "global") {
        return prev.filter((templateItem) => {
          const schemaType = (templateItem as { schemaType?: string }).schemaType;
          return !schemaType || !singletonTypes.has(schemaType);
        });
      }

      return prev;
    },
    actions: (prev, context) => {
      const userRoles = context.currentUser?.roles?.map((role) => role.name) ?? [];
      const hasPrivilege = userRoles.some((role) => privilegedRoles.has(role));

      let filtered = prev.filter((action) => {
        if (singletonTypes.has(context.schemaType) && ["duplicate", "unpublish"].includes(action.action)) {
          return false;
        }

        if (!hasPrivilege && ["delete", "unpublish", "publish"].includes(action.action)) {
          return false;
        }

        return true;
      });

      if (previewActionTypes.has(context.schemaType)) {
        filtered = [...filtered, openPreviewAction];
      }

      return filtered;
    }
  },
  apiVersion
});

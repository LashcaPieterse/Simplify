import createImageUrlBuilder from "@sanity/image-url";
import type { Image } from "sanity";
import { dataset, projectId } from "./sanity.client";

const builder = projectId && dataset ? createImageUrlBuilder({ projectId, dataset }) : null;

export const urlForImage = (source: Image | null | undefined) =>
  source && builder ? builder.image(source).auto("format").fit("max") : null;

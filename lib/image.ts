import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import { dataset, projectId } from "./sanity.client";

type ImageUrlBuilder = ReturnType<typeof imageUrlBuilder>;

export type ImageAsset = {
  url?: string;
  path?: string;
  _ref?: string;
  [key: string]: unknown;
};

export type ImageLike = {
  asset?: ImageAsset | null;
  url?: string;
  [key: string]: unknown;
};

class StaticImageBuilder {
  constructor(private readonly baseUrl: string) {}

  width(value?: number) {
    void value;
    return this;
  }

  height(value?: number) {
    void value;
    return this;
  }

  auto(value?: string) {
    void value;
    return this;
  }

  fit(value?: string) {
    void value;
    return this;
  }

  url() {
    return this.baseUrl;
  }
}

let cachedBuilder: ImageUrlBuilder | null = null;

const getImageBuilder = () => {
  if (!projectId || !dataset) {
    return null;
  }

  if (!cachedBuilder) {
    cachedBuilder = imageUrlBuilder({ projectId, dataset });
  }

  return cachedBuilder;
};

const resolveUrl = (source: ImageLike | string | null | undefined) => {
  if (!source) {
    return null;
  }

  const isValidImageSrc = (value: string) =>
    value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");

  if (typeof source === "string") {
    return isValidImageSrc(source) ? source : null;
  }

  if (typeof source.url === "string" && source.url.length > 0) {
    return isValidImageSrc(source.url) ? source.url : null;
  }

  const asset = source.asset;
  if (asset) {
    if (typeof asset === "string") {
      return asset;
    }

    if (typeof asset.url === "string" && asset.url.length > 0) {
      return isValidImageSrc(asset.url) ? asset.url : null;
    }

    if (typeof asset.path === "string" && asset.path.length > 0) {
      return isValidImageSrc(asset.path) ? asset.path : null;
    }
  }

  return null;
};

const isSanityImageSource = (source: unknown): source is SanityImageSource => {
  if (!source || typeof source !== "object") {
    return false;
  }

  const candidate = source as { [key: string]: unknown };

  if (candidate._type === "image") {
    return true;
  }

  return typeof candidate.asset !== "undefined";
};

export const urlForImage = (source: ImageLike | string | null | undefined) => {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    return new StaticImageBuilder(source);
  }

  const builder = getImageBuilder();
  if (builder && isSanityImageSource(source)) {
    try {
      return builder.image(source as SanityImageSource);
    } catch {
      // fall through to static resolution
    }
  }

  const url = resolveUrl(source);
  return url ? new StaticImageBuilder(url) : null;
};

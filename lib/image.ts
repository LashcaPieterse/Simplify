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

function resolveUrl(source: ImageLike | string | null | undefined) {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    return source;
  }

  if (typeof source.url === "string" && source.url.length > 0) {
    return source.url;
  }

  const asset = source.asset;
  if (asset) {
    if (typeof asset === "string") {
      return asset;
    }

    if (typeof asset.url === "string" && asset.url.length > 0) {
      return asset.url;
    }

    if (typeof asset.path === "string" && asset.path.length > 0) {
      return asset.path;
    }

    if (typeof asset._ref === "string" && asset._ref.length > 0) {
      return asset._ref;
    }
  }

  return null;
}

export const urlForImage = (source: ImageLike | string | null | undefined) => {
  const url = resolveUrl(source);
  return url ? new StaticImageBuilder(url) : null;
};

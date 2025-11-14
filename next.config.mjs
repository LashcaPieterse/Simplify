/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**"
      }
    ]
  },
  env: (() => {
    const env = {};
    const projectId =
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
    const dataset =
      process.env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.SANITY_DATASET;
    const apiVersion =
      process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? process.env.SANITY_API_VERSION;

    if (projectId) {
      env.NEXT_PUBLIC_SANITY_PROJECT_ID = projectId;
    }
    if (dataset) {
      env.NEXT_PUBLIC_SANITY_DATASET = dataset;
    }
    if (apiVersion) {
      env.NEXT_PUBLIC_SANITY_API_VERSION = apiVersion;
    }

    return env;
  })()
};

export default nextConfig;

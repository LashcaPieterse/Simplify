/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: process.cwd()
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.airalo.com",
        pathname: "/**"
      }
    ]
  },
  outputFileTracingIncludes: {
    "/resources": ["./content/resources/**/*.md", "./public/images/resources/**/*"],
    "/resources/*": ["./content/resources/**/*.md", "./public/images/resources/**/*"],
    "/sitemap.xml": ["./content/resources/**/*.md", "./public/images/resources/**/*"]
  }
};

export default nextConfig;

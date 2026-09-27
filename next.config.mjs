// Static export for GitHub Pages. BASE_PATH is set by the Pages workflow
// (e.g. "/proofpath"); locally it is empty so the app is served from "/".
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@simulization/shared"],
  // Tailwind v4 via its Turbopack loader (without this rule, globals.css is not processed by Tailwind).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

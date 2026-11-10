import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the About page is now the top of /blogs
  redirects: () => [{ source: "/about", destination: "/blogs", permanent: true }],
};

export default nextConfig;

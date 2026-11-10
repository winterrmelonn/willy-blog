import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // app/sat/route.ts reads this file at request time
  outputFileTracingIncludes: { "/sat": ["./app/sat/index.html"] },
  // the About page is now the top of /blogs
  redirects: () => [{ source: "/about", destination: "/blogs", permanent: true }],
};

export default nextConfig;

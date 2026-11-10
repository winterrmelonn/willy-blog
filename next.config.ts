import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // app/sat/route.ts reads this file at request time
  outputFileTracingIncludes: { "/sat": ["./app/sat/index.html"] },
};

export default nextConfig;

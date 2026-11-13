import type { NextConfig } from "next";

// public/ folders must not share a name with a page: on AWS (OpenNext) a path whose first segment matches a
// public folder is served from S3, so public/sat would hide /sat. Hence public/sat-bank.

const nextConfig: NextConfig = {
  // app/sat/route.ts reads this file at request time
  outputFileTracingIncludes: { "/sat": ["./app/sat/index.html"] },
  // the About page is now the top of /blogs
  redirects: () => [{ source: "/about", destination: "/blogs", permanent: true }],
};

export default nextConfig;

import { createHash } from "node:crypto";

// public/sat-bank (about 86 MB) is served straight from S3, so on AWS CloudFront only hands it to browsers that
// carry this token as the "sat" cookie (checked at the edge, see sst.config.ts); app/sat/route.ts gives it to
// admins. It's derived from the auth secret, so changing BetterAuthSecret also revokes it.
export const satToken = (authSecret: string) => createHash("sha256").update(`sat-bank:${authSecret}`).digest("hex");

// The check CloudFront runs on every request (injected into SST's CloudFront Function, runtime cloudfront-js-2.0:
// keep it to plain ES5 and to names SST's own code won't reuse)
export const satGate = (token: string) => `
  if (event.request.uri.indexOf("/sat-bank/") === 0) {
    var satCookie = event.request.cookies.sat;
    if (!satCookie || satCookie.value !== "${token}") return { statusCode: 403, statusDescription: "Forbidden" };
  }`;

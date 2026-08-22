/**
 * Security headers (plan Section 39). No custom CSP — this app doesn't load
 * third-party scripts/styles beyond Next's own bundles, and a misconfigured
 * CSP here risks breaking the app for no real benefit; revisit if that
 * changes. `poweredByHeader: false` drops the `X-Powered-By: Next.js`
 * header, minor info disclosure about the stack with no upside.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

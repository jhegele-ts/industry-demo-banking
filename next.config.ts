import type { NextConfig } from "next";

/**
 * Hostnames this app may be reached on besides localhost — i.e. an ngrok
 * tunnel when the demo is being shared.
 *
 * Add a specific host with TUNNEL_HOST in .env.local if you use a provider
 * that isn't covered by the wildcards below.
 */
const TUNNEL_ORIGINS = [
  "*.ngrok-free.dev",
  "*.ngrok-free.app",
  "*.ngrok.app",
  "*.ngrok.io",
  ...(process.env.TUNNEL_HOST ? [process.env.TUNNEL_HOST] : []),
];

const nextConfig: NextConfig = {
  // Emits a minimal, self-contained .next/standalone/server.js (only the
  // files each page's dependency trace actually needs) for the Dockerfile.
  output: "standalone",

  // Dev-only assets and endpoints (HMR websocket included) are blocked for
  // cross-origin requests by default. Through a tunnel the browser's origin
  // is the tunnel host, not localhost, so without this the HMR socket fails
  // repeatedly and the dev client keeps forcing reloads — which is what
  // interrupts a form submit mid-flight.
  allowedDevOrigins: TUNNEL_ORIGINS,

  experimental: {
    serverActions: {
      // Server Actions run a CSRF check comparing Origin against Host (or
      // X-Forwarded-Host) and abort on a mismatch. ngrok rewrites Host to the
      // local address by default, so Origin (the tunnel host) never matches
      // and every action is rejected — sign-in is a Server Action, so login
      // fails with nothing useful in the browser console.
      allowedOrigins: TUNNEL_ORIGINS,
    },
  },
};

export default nextConfig;

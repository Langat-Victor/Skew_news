import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./lib/news/image-hosts";

const nextConfig: NextConfig = {
  images: {
    /*
      Article images come from publisher CDNs, so the optimiser needs an explicit
      allowlist. The list lives in lib/news/image-hosts.ts because the runtime
      guard reads it too: an unlisted host makes /_next/image return HTTP 400 (a
      broken box), and the guard turns that case into placeholder art instead.
      One list, so the two can never drift.
    */
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

export default nextConfig;

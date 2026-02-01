/**
 * Next.js Configuration
 *
 * Combines template and project Next.js configs.
 * - config/next/next.template.ts: Template config (synced from template)
 * - config/next/next.project.ts: Project overrides (not synced)
 */

import type { NextConfig } from "next";
import { pwaConfig, nextTemplateConfig, withPWA } from "./config/next/next.template";
import { nextProjectConfig } from "./config/next/next.project";

// Deep merge template and project configs
const mergedConfig: NextConfig = {
  ...nextTemplateConfig,
  ...nextProjectConfig,
  // Merge webpack if both have it
  webpack(config, options) {
    let result = config;
    if (nextTemplateConfig.webpack) {
      result = nextTemplateConfig.webpack(result, options);
    }
    if (nextProjectConfig.webpack) {
      result = nextProjectConfig.webpack(result, options);
    }
    return result;
  },
  // Merge rewrites if both have them
  async rewrites() {
    const templateRewrites = nextTemplateConfig.rewrites ? await nextTemplateConfig.rewrites() : [];
    const projectRewrites = nextProjectConfig.rewrites ? await nextProjectConfig.rewrites() : [];

    // Handle both array and object formats
    const templateArray = Array.isArray(templateRewrites) ? templateRewrites : [];
    const projectArray = Array.isArray(projectRewrites) ? projectRewrites : [];

    return [...templateArray, ...projectArray];
  },
};

// Apply PWA wrapper
const nextConfig = withPWA(pwaConfig)(mergedConfig);

export default nextConfig;

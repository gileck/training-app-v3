/**
 * PWA Configuration - Project-specific values
 *
 * This file contains project-specific PWA metadata.
 * Edit these values for your project.
 * The _document.tsx file imports from here and should not need modification.
 */

export const pwaConfig = {
  // App identity
  applicationName: "App Template AI",
  appleWebAppTitle: "App Template",
  description: "A custom SPA application with PWA capabilities",

  // Theme
  themeColor: "#000000",

  // Icons - paths relative to /public
  icons: {
    appleTouchIcon: "/icons/apple-touch-icon.png",
    appleTouchIcon152: "/icons/icon-152x152.png",
    appleTouchIcon167: "/icons/icon-167x167.png",
    appleTouchIcon180: "/icons/icon-180x180.png",
    favicon32: "/favicon-32x32.png",
    splashScreen: "/icons/icon-512x512.png",
  },
};
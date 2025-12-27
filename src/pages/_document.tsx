import { Html, Head, Main, NextScript } from "next/document";
import { pwaConfig } from "@/config/pwa.config";

export default function Document() {
  const { applicationName, appleWebAppTitle, description, themeColor, icons } = pwaConfig;

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="application-name" content={applicationName} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appleWebAppTitle} />
        <meta name="description" content={description} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={themeColor} />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href={icons.appleTouchIcon} />
        <link rel="apple-touch-icon" sizes="152x152" href={icons.appleTouchIcon152} />
        <link rel="apple-touch-icon" sizes="180x180" href={icons.appleTouchIcon180} />
        <link rel="apple-touch-icon" sizes="167x167" href={icons.appleTouchIcon167} />
        <link rel="icon" type="image/png" sizes="32x32" href={icons.favicon32} />

        {/* iOS splash screens */}
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(min-device-width: 768px) and (max-device-width: 1024px)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(min-device-width: 834px) and (max-device-width: 834px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href={icons.splashScreen}
          media="(min-device-width: 1024px) and (max-device-width: 1024px) and (-webkit-device-pixel-ratio: 2)"
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

declare module 'next-pwa' {
  import { NextConfig } from 'next';
  
  interface RuntimeCachingRule {
    urlPattern: RegExp | string;
    handler: string;
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
      cacheableResponse?: {
        statuses?: number[];
        headers?: {
          [key: string]: string;
        };
      };
      networkTimeoutSeconds?: number;
      backgroundSync?: {
        name: string;
        options?: {
          maxRetentionTime?: number;
        };
      };
    };
  }
  
  type PWAConfig = {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    skipWaiting?: boolean;
    runtimeCaching?: RuntimeCachingRule[];
    publicExcludes?: string[];
    buildExcludes?: string[] | RegExp[];
    fallbacks?: {
      [key: string]: string;
    };
  };
  
  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  
  export = withPWA;
}

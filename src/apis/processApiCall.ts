import { NextApiRequest, NextApiResponse } from "next";
import { apiHandlers } from "./apis";
import { createCache } from "@/common/cache";
import { CacheResult } from "@/common/cache/types";
import { fsCacheProvider, s3CacheProvider } from "@/server/template/cache/providers";
import { appConfig } from "@/app.config";
import { getUserContext } from "./getUserContext";
import { sendNotificationToOwner } from "@/server/template/telegram";

// Create server-side cache instance
const provider = appConfig.cacheType === 's3' ? s3CacheProvider : fsCacheProvider;
const serverCache = createCache(provider);

export const processApiCall = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<CacheResult<unknown>> => {
  // Parse name from URL parameter - replace underscores with slashes
  // e.g., "auth_me" becomes "auth/me"
  const rawNameParam = req.query.name;
  const nameParam = Array.isArray(rawNameParam) ? rawNameParam.join("/") : rawNameParam;
  const name = String(nameParam ?? "").replace(/_/g, "/") as keyof typeof apiHandlers;

  const params = req.body?.params;
  const apiHandler = apiHandlers[name];

  // NOTE: Client code expects HTTP 200 always; errors must be encoded in the JSON body.
  if (!apiHandler) {
    return { data: { error: `Unknown API: ${String(name)}`, errorCode: 'UNKNOWN_API' }, isFromCache: false };
  }

  const userContext = getUserContext(req, res);

  // Centralized admin gating: any API under `admin/*` is admin-only.
  if (String(name).startsWith("admin/") && !userContext.isAdmin) {
    return { data: { error: "Forbidden", errorCode: 'FORBIDDEN' }, isFromCache: false };
  }

  // Create a wrapped function that handles context internally
  const processWithContext = () => {
    const processFunc = apiHandler.process;

    try {
      // Now all process functions expect two parameters
      return (processFunc as (params: unknown, context: unknown) => Promise<unknown>)(params, userContext);
    } catch (error) {
      console.error(`Error processing API call ${name}:`, error);
      throw error;
    }
  };

  try {
    // Server-side caching is disabled - React Query handles client-side caching
    const result = await serverCache.withCache(
      processWithContext,
      {
        key: String(name),
        params: {
          ...(typeof params === "object" && params !== null ? params : {}),
          userId: userContext.userId,
        },
      },
      {
        disableCache: true,
      }
    );

    return result;
  } catch (error) {
    // Expected/handled behavior: never throw to the route layer; always return HTTP 200 with an error payload.
    console.error(`processApiCall failed for ${String(name)}:`, error);

    // Fire-and-forget: notify admin of server errors via Telegram
    void sendNotificationToOwner(
      `🚨 API Error: ${String(name)}\n\n${error instanceof Error ? error.message : String(error)}${error instanceof Error && error.stack ? `\n\n${error.stack.slice(0, 500)}` : ''}`
    );

    return {
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: 'SERVER_ERROR',
        ...((process.env.NODE_ENV === 'development' || userContext.isAdmin) && error instanceof Error && { errorDetails: error.stack }),
      },
      isFromCache: false,
    };
  }
};

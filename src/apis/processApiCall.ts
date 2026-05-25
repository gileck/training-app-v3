import { NextApiRequest, NextApiResponse } from "next";
import { apiHandlers } from "./apis";
import { createCache } from "@/common/cache";
import { CacheResult } from "@/common/cache/types";
import { fsCacheProvider, s3CacheProvider } from "@/server/template/cache/providers";
import { appConfig } from "@/app.config";
import { getUserContext } from "./getUserContext";
import { sendNotificationToOwner } from "@/server/template/telegram";
import {
  runWithRpcCallContext,
  isRpcConnectionRequiredError,
  RPC_CONNECTION_REQUIRED_CODE,
} from "@/server/template/rpc";

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

  // Centralized admin gating: any API under `admin/*` requires either
  //   - the on-behalf-of user to BE the admin, OR
  //   - the caller to hold ADMIN_API_TOKEN (tokenAuth=true). The token is
  //     the privilege boundary — SDK/MCP callers need this to resolve e.g.
  //     usernames via admin/users/list.
  if (
    String(name).startsWith("admin/") &&
    !userContext.isAdmin &&
    !userContext.authDebug.tokenAuth
  ) {
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

  // Run the handler inside an AsyncLocalStorage context so the RPC gate
  // can identify the calling user without every callRemote caller having
  // to thread userId through.
  const processInRpcContext = () =>
    runWithRpcCallContext(
      { userId: userContext.userId, clientToken: userContext.rpcConnectionToken },
      () => Promise.resolve(processWithContext())
    );

  try {
    // Server-side caching is disabled - React Query handles client-side caching
    const result = await serverCache.withCache(
      processInRpcContext,
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
    // RPC connection gate failures are expected — surface them with a distinct
    // errorCode so the client can route the user to the Connection page,
    // and skip the owner notification (otherwise admins get spammed during
    // normal "session expired" flows).
    if (isRpcConnectionRequiredError(error)) {
      return {
        data: {
          error: error instanceof Error ? error.message : 'RPC connection required',
          errorCode: RPC_CONNECTION_REQUIRED_CODE,
        },
        isFromCache: false,
      };
    }

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

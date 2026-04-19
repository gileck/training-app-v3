import { NextApiRequest, NextApiResponse } from "next";
import { parse, serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { AuthTokenPayload, AuthDebugInfo } from "./template/auth/types";
import { getJwtSecret, COOKIE_NAME } from "./template/auth/server";

const ADMIN_TOKEN_HEADER = 'authorization';
const ON_BEHALF_OF_HEADER = 'x-on-behalf-of';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}


export function getUserContext(req: NextApiRequest, res: NextApiResponse) {
  const adminUserId = process.env.ADMIN_USER_ID;
  const cookies = parse(req.headers.cookie || '');

  // Bearer-token auth path: used by SDKs/agents. Requires X-On-Behalf-Of.
  // Checked before dev-mode LOCAL_USER_ID shortcut so SDKs can test locally.
  const authHeader = req.headers[ADMIN_TOKEN_HEADER];
  const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (authHeaderStr && authHeaderStr.startsWith('Bearer ')) {
    const presented = authHeaderStr.slice('Bearer '.length).trim();
    const expected = process.env.ADMIN_API_TOKEN;
    const tokenAuthDebug: AuthDebugInfo = { cookiePresent: false, tokenAuth: true };
    const noopHelpers = {
      getCookieValue: (name: string) => cookies[name],
      setCookie: () => undefined,
      clearCookie: () => undefined,
    };

    if (!expected) {
      tokenAuthDebug.tokenError = 'admin_token_not_configured';
      return { userId: undefined, isAdmin: false, authDebug: tokenAuthDebug, ...noopHelpers };
    }
    if (!safeEqual(presented, expected)) {
      tokenAuthDebug.tokenError = 'invalid_bearer';
      return { userId: undefined, isAdmin: false, authDebug: tokenAuthDebug, ...noopHelpers };
    }

    const onBehalfOfRaw = req.headers[ON_BEHALF_OF_HEADER];
    const onBehalfOf = Array.isArray(onBehalfOfRaw) ? onBehalfOfRaw[0] : onBehalfOfRaw;
    if (!onBehalfOf) {
      tokenAuthDebug.tokenError = 'missing_on_behalf_of';
      return { userId: undefined, isAdmin: false, authDebug: tokenAuthDebug, ...noopHelpers };
    }

    return {
      userId: onBehalfOf,
      isAdmin: !!adminUserId && onBehalfOf === adminUserId,
      authDebug: tokenAuthDebug,
      ...noopHelpers,
    };
  }

  if (
    process.env.NODE_ENV === 'development' &&
    !(process.env.IGNORE_LOCAL_USER_ID === 'true')) {
    if (!process.env.LOCAL_USER_ID) {
      throw new Error("LOCAL_USER_ID is not set")
    }
    const userId = process.env.LOCAL_USER_ID;
    return {
      userId,
      isAdmin: !!adminUserId && userId === adminUserId,
      authDebug: { cookiePresent: true } as AuthDebugInfo,
      getCookieValue: () => undefined,
      setCookie: () => undefined,
      clearCookie: () => undefined
    };
  }

  let userId = undefined;
  const token = cookies[COOKIE_NAME];

  // Track auth debug info for diagnosing auth failures
  const authDebug: AuthDebugInfo = {
    cookiePresent: !!token,
  };

  if (token) {
    try {
      // Verify and decode the token
      const decoded = jwt.verify(token, getJwtSecret()) as unknown as AuthTokenPayload;
      userId = decoded.userId;
    } catch (err) {
      // Capture detailed error info for debugging
      const error = err as Error & { name?: string };
      authDebug.tokenError = error.message;
      authDebug.tokenErrorCode = error.name || 'UnknownError';

      // Log with more detail
      console.warn('[Auth] Token verification failed:', {
        errorCode: authDebug.tokenErrorCode,
        errorMessage: authDebug.tokenError,
      });

      // Invalid token - clear it
      res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
        path: '/',
        expires: new Date(0)
      }));
    }
  }

  // Create context with auth info and cookie helpers
  const context = {
    userId,
    isAdmin: !!userId && !!adminUserId && userId === adminUserId,
    authDebug,
    getCookieValue: (name: string) => cookies[name],
    setCookie: (name: string, value: string, options: Record<string, unknown>) => {
      res.setHeader('Set-Cookie', serialize(name, value, options as Record<string, string | number | boolean>));
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      res.setHeader('Set-Cookie', serialize(name, '', {
        ...(options as Record<string, string | number | boolean>),
        path: '/',
        expires: new Date(0)
      }));
    }
  };

  return context;
}

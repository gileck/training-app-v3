import { NextApiRequest, NextApiResponse } from "next";
import { parse, serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload, AuthDebugInfo } from "./template/auth/types";
import { getJwtSecret, COOKIE_NAME } from "./template/auth/server";


export function getUserContext(req: NextApiRequest, res: NextApiResponse) {
  const adminUserId = process.env.ADMIN_USER_ID;

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
  const cookies = parse(req.headers.cookie || '');
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
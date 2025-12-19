import { NextApiRequest, NextApiResponse } from "next";
import { parse, serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from "./auth/types";
import { JWT_SECRET, COOKIE_NAME } from "./auth/server";


export function getUserContext(req: NextApiRequest, res: NextApiResponse) {
  const adminUserId = process.env.ADMIN_USER_ID;

  if (process.env.NODE_ENV === 'development') {
    if (!process.env.LOCAL_USER_ID) {
      throw new Error("LOCAL_USER_ID is not set")
    }
    const userId = process.env.LOCAL_USER_ID;
    return {
      userId,
      isAdmin: !!adminUserId && userId === adminUserId,
      getCookieValue: () => undefined,
      setCookie: () => undefined,
      clearCookie: () => undefined
    };
  }


  let userId = undefined;
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];

  if (token) {
    try {
      // Verify and decode the token
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as AuthTokenPayload;
      userId = decoded.userId;
    } catch (err) {
      // Invalid token - clear it
      console.warn('Invalid auth token:', err);
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
import type { UserResponse } from "./types";
import type { User } from "@/server/database/collections/users/types";

// Shared constants and utilities used by multiple auth handlers.
// Keeping these outside `server.ts` prevents circular imports (handlers importing server.ts).

export const SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.error(
    "[AUTH ERROR] JWT_SECRET environment variable is not set. Authentication will not work."
  );
  throw new Error("JWT_SECRET environment variable is required");
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = "7d";
export const COOKIE_NAME = "auth_token";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

export const sanitizeUser = (user: User): UserResponse => {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    profilePicture: user.profilePicture,
    // Filled by handlers based on request context
    isAdmin: false,
  };
};

import type { UserResponse } from "./types";
import type { User } from "@/server/database/collections/template/users/types";

// Shared constants and utilities used by multiple auth handlers.
// Keeping these outside `server.ts` prevents circular imports (handlers importing server.ts).

export const SALT_ROUNDS = 10;

export function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return process.env.JWT_SECRET;
}
export const JWT_EXPIRES_IN = "3650d";
export const COOKIE_NAME = "auth_token";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years (~forever)
  path: "/",
};

export const sanitizeUser = (user: User): UserResponse => {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    profilePicture: user.profilePicture,
    notificationsEnabled: user.notificationsEnabled,
    telegramChatId: user.telegramChatId,
    // Filled by handlers based on request context
    isAdmin: false,
  };
};

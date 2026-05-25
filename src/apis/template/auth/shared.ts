import type { UserResponse } from "./types";
import type { User } from "@/server/database/collections/template/users/types";

// Shared constants and utilities used by multiple auth handlers.
// Keeping these outside `server.ts` prevents circular imports (handlers importing server.ts).

export const SALT_ROUNDS = 10;

// Centralized admin check used by every auth path (cookie, bearer token,
// dev-mode LOCAL_USER_ID shortcut, login, register).
//
// Two grants:
//   1. ADMIN_USER_ID matches the userId — the production rule.
//   2. Local dev shortcut — when NODE_ENV=development and the user is the
//      LOCAL_USER_ID, treat them as admin even if ADMIN_USER_ID is unset
//      or different. This makes /admin/* routes work out of the box on a
//      fresh local install. To opt out, set IGNORE_LOCAL_USER_ID=true
//      (which disables the LOCAL_USER_ID shortcut entirely).
export function isAdminUser(userId: string | undefined | null): boolean {
  if (!userId) return false;
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.IGNORE_LOCAL_USER_ID !== 'true' &&
    process.env.LOCAL_USER_ID &&
    userId === process.env.LOCAL_USER_ID
  ) {
    return true;
  }
  return !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
}

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
  const twoFactorEnabled = user.twoFactorEnabled ?? user.telegramTwoFactorEnabled ?? false;
  const twoFactorMethod =
    user.twoFactorMethod ?? (user.telegramTwoFactorEnabled ? 'telegram' : undefined);

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    profilePicture: user.profilePicture,
    notificationsEnabled: user.notificationsEnabled,
    telegramChatId: user.telegramChatId,
    twoFactorEnabled,
    twoFactorMethod,
    // Filled by handlers based on request context
    isAdmin: false,
  };
};

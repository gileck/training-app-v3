import { ObjectId } from 'mongodb';
import * as userSessions from '@/server/database/collections/template/user-sessions';
import * as users from '@/server/database/collections/template/users/users';
import type { SessionType } from '@/server/database/collections/template/user-sessions/types';

/**
 * Fire-and-forget: record a session event and update the user's lastSeenAt.
 * Errors are logged and swallowed so auth flows never fail because of
 * tracking. Returns immediately; the inserts complete in the background.
 */
export function recordSession(userId: string, type: SessionType): void {
  try {
    const userObjectId = new ObjectId(userId);
    const onError = (err: unknown) => console.warn('[recordSession] failed:', err);
    void userSessions
      .insertSession({ userId: userObjectId, type, createdAt: new Date() })
      .catch(onError);
    void users.touchLastSeen(userObjectId).catch(onError);
  } catch (err) {
    console.warn('[recordSession] failed:', err);
  }
}

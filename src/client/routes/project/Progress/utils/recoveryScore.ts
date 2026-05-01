/**
 * Recovery Score Calculation (Client wrapper)
 *
 * Re-exports the shared isomorphic recovery score calculation.
 * The actual logic lives in @/shared/utils/recoveryScore for use in both client and server.
 */

export { calculateRecoveryScore } from '@/shared/utils/recoveryScore';
export type { RecoveryScoreResult, DailyLoad } from '@/shared/utils/recoveryScore';

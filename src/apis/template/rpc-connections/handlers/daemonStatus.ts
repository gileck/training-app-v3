import {
  DAEMON_LIVENESS_WINDOW_MS,
  getDaemonStatus,
} from '@/server/database/collections/template/rpc-daemon-status/daemon-status';
import type { DaemonStatusRequest, DaemonStatusResponse } from '../types';

export const daemonStatus = async (
  _request: DaemonStatusRequest
): Promise<DaemonStatusResponse> => {
  const status = await getDaemonStatus();
  if (!status) {
    return { alive: false, lastHeartbeat: null, startedAt: null, ageMs: null };
  }
  const ageMs = Date.now() - status.lastHeartbeat.getTime();
  return {
    alive: ageMs < DAEMON_LIVENESS_WINDOW_MS,
    lastHeartbeat: status.lastHeartbeat.toISOString(),
    startedAt: status.startedAt.toISOString(),
    hostname: status.hostname,
    ageMs,
  };
};

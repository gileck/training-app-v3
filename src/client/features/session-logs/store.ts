/**
 * Session Logs Store
 * 
 * Zustand store for storing session logs in memory.
 * Logs are kept for the current session and sent with bug reports.
 */

import { createStore } from '@/client/stores';
import type { SessionLog, LogLevel, NetworkStatus } from './types';

const MAX_LOGS = 500; // Keep last 500 logs to prevent memory issues

interface SessionLogsState {
    logs: SessionLog[];
    
    // Actions
    addLog: (log: Omit<SessionLog, 'id' | 'timestamp' | 'networkStatus'> & { networkStatus?: NetworkStatus }) => void;
    clearLogs: () => void;
    getLogs: () => SessionLog[];
    getLogsByLevel: (level: LogLevel) => SessionLog[];
    getLogsByFeature: (feature: string) => SessionLog[];
}

function generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getNetworkStatus(): NetworkStatus {
    if (typeof navigator !== 'undefined') {
        return navigator.onLine ? 'online' : 'offline';
    }
    return 'online';
}

function getPerformanceTime(): number | undefined {
    if (typeof performance !== 'undefined') {
        return Math.round(performance.now());
    }
    return undefined;
}

export const useSessionLogsStore = createStore<SessionLogsState>({
    key: 'session-logs',
    label: 'Session Logs',
    inMemoryOnly: true,
    creator: (set, get) => ({
        logs: [],

        addLog: (logData) => {
            const log: SessionLog = {
                id: generateLogId(),
                timestamp: new Date().toISOString(),
                networkStatus: logData.networkStatus ?? getNetworkStatus(),
                performanceTime: getPerformanceTime(),
                ...logData,
            };

            set((state) => {
                const newLogs = [...state.logs, log];
                // Keep only the last MAX_LOGS entries
                if (newLogs.length > MAX_LOGS) {
                    return { logs: newLogs.slice(-MAX_LOGS) };
                }
                return { logs: newLogs };
            });
        },

        clearLogs: () => {
            set({ logs: [] });
        },

        getLogs: () => {
            return get().logs;
        },

        getLogsByLevel: (level) => {
            return get().logs.filter((log) => log.level === level);
        },

        getLogsByFeature: (feature) => {
            return get().logs.filter((log) => log.feature === feature);
        },
    }),
});

// Selector hooks for convenience
export function useSessionLogs(): SessionLog[] {
    return useSessionLogsStore((state) => state.logs);
}

export function useAddLog() {
    return useSessionLogsStore((state) => state.addLog);
}

/**
 * Network Logger Hook
 * 
 * Logs network status changes (online/offline transitions).
 * Should be used once at the app root level.
 */

import { useEffect, useRef } from 'react';
import { logger } from './logger';

/**
 * Hook to log network status changes
 * Captures online/offline transitions automatically
 */
export function useNetworkLogger() {
    const previousStatus = useRef<boolean | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Log initial status on mount
        const initialStatus = navigator.onLine;
        logger.info('network', `Network status: ${initialStatus ? 'online' : 'offline'}`, {
            meta: { status: initialStatus ? 'online' : 'offline', event: 'initial' }
        });
        previousStatus.current = initialStatus;

        const handleOnline = () => {
            if (previousStatus.current === false) {
                logger.info('network', 'Network connection restored', {
                    meta: { 
                        status: 'online', 
                        event: 'reconnected',
                        previousStatus: 'offline'
                    }
                });
            }
            previousStatus.current = true;
        };

        const handleOffline = () => {
            if (previousStatus.current === true) {
                logger.warn('network', 'Network connection lost', {
                    meta: { 
                        status: 'offline', 
                        event: 'disconnected',
                        previousStatus: 'online'
                    }
                });
            }
            previousStatus.current = false;
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
}


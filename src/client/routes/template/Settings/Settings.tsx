/**
 * Settings Page Component
 *
 * Provides cache management and AI model configuration.
 */

import { useState } from 'react';
import { Card } from '@/client/components/template/ui/card';
import { Alert } from '@/client/components/template/ui/alert';
import { CacheSection } from './components/CacheSection';
import { AIModelSection } from './components/AIModelSection';

interface SnackbarState {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
}

export function Settings() {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral snackbar notification
    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'info'
    });

    const handleSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
        setSnackbar({ open: true, message, severity });
    };

    return (
        <div className="mx-auto max-w-3xl py-4">
            <h1 className="text-2xl font-semibold">Settings</h1>

            <Card className="mt-3 p-4">
                <CacheSection onSnackbar={handleSnackbar} />

                <hr className="my-4 border-border" />

                <AIModelSection />
            </Card>

            {snackbar.open && (
                <div className="fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2">
                    <Alert variant={snackbar.severity === 'success' ? 'success' : snackbar.severity === 'warning' ? 'warning' : snackbar.severity === 'info' ? 'info' : 'destructive'}>
                        {snackbar.message}
                    </Alert>
                </div>
            )}
        </div>
    );
}

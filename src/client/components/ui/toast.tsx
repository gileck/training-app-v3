/**
 * Toast Notification Component
 * 
 * Simple toast notifications with auto-dismiss.
 */

import { createStore } from '@/client/stores';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
}

const useToastStore = createStore<ToastStore>({
    key: 'toast',
    label: 'Toast',
    inMemoryOnly: true,
    creator: (set) => ({
        toasts: [],
        addToast: (message, type) => {
            const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            set((state) => ({
                toasts: [...state.toasts, { id, message, type }],
            }));
            // Auto-remove after 4 seconds
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            }, 4000);
        },
        removeToast: (id) => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        },
    }),
});

// Toast API for use anywhere in the app
export const toast = {
    success: (message: string) => useToastStore.getState().addToast(message, 'success'),
    error: (message: string) => useToastStore.getState().addToast(message, 'error'),
    info: (message: string) => useToastStore.getState().addToast(message, 'info'),
};

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />,
    error: <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
    info: <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
};

const TOAST_STYLES: Record<ToastType, string> = {
    success: 'border-green-500 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
    error: 'border-red-500 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
    info: 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
    return (
        <div
            className={`flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg ${TOAST_STYLES[t.type]} animate-in slide-in-from-right-full duration-300`}
        >
            {TOAST_ICONS[t.type]}
            <span className="flex-1 text-sm font-medium">{t.message}</span>
            <button
                onClick={onRemove}
                className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((state) => state.toasts);
    const removeToast = useToastStore((state) => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
            ))}
        </div>
    );
}

/**
 * Toast Notification Component
 * 
 * Simple toast notifications with auto-dismiss.
 */

import { createStore } from '@/client/stores';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    actions?: ToastAction[];
    duration?: number; // Custom duration in ms (default 4000)
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type: ToastType, options?: { actions?: ToastAction[]; duration?: number }) => void;
    removeToast: (id: string) => void;
}

const useToastStore = createStore<ToastStore>({
    key: 'toast',
    label: 'Toast',
    inMemoryOnly: true,
    creator: (set) => ({
        toasts: [],
        addToast: (message, type, options) => {
            const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const duration = options?.duration ?? 4000;
            set((state) => ({
                toasts: [...state.toasts, { id, message, type, actions: options?.actions, duration }],
            }));
            // Auto-remove after duration
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            }, duration);
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
    success: (message: string, options?: { actions?: ToastAction[]; duration?: number }) =>
        useToastStore.getState().addToast(message, 'success', options),
    error: (message: string, options?: { actions?: ToastAction[]; duration?: number }) =>
        useToastStore.getState().addToast(message, 'error', options),
    info: (message: string, options?: { actions?: ToastAction[]; duration?: number }) =>
        useToastStore.getState().addToast(message, 'info', options),
};

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    error: <XCircle className="h-5 w-5 text-destructive" />,
    info: <AlertCircle className="h-5 w-5 text-info" />,
};

const TOAST_STYLES: Record<ToastType, string> = {
    success: 'border-l-success bg-card text-foreground',
    error: 'border-l-destructive bg-card text-foreground',
    info: 'border-l-info bg-card text-foreground',
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
    return (
        <div
            className={`flex flex-col gap-2 rounded-lg border border-border border-l-4 px-4 py-3 shadow-xl ${TOAST_STYLES[t.type]} animate-in slide-in-from-right-full duration-300`}
        >
            <div className="flex items-center gap-3">
                {TOAST_ICONS[t.type]}
                <span className="flex-1 text-sm font-medium">{t.message}</span>
                <button
                    onClick={onRemove}
                    className="rounded p-1 opacity-60 hover:opacity-100 transition-opacity"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {t.actions && t.actions.length > 0 && (
                <div className="flex gap-2 ml-8">
                    {t.actions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                action.onClick();
                                onRemove();
                            }}
                            className="text-xs font-medium px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((state) => state.toasts);
    const removeToast = useToastStore((state) => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
                </div>
            ))}
        </div>
    );
}

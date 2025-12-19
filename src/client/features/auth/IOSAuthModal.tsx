import React, { useEffect, useState } from 'react';
import { cn } from '@/client/lib/utils';

interface IOSAuthModalProps {
    children: React.ReactNode;
    isOpen: boolean;
}

/**
 * iOS-native inspired full-screen auth modal
 * Features:
 * - Glassmorphism backdrop
 * - Centered card with soft shadows
 * - Smooth fade-in animation
 * - Client-only rendering to avoid SSR hydration issues
 */
export const IOSAuthModal: React.FC<IOSAuthModalProps> = ({ children, isOpen }) => {
    // eslint-disable-next-line state-management/prefer-state-architecture -- prevent SSR hydration mismatch
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Don't render during SSR or before mount to prevent hydration mismatch
    if (!isMounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            {/* Glassmorphism backdrop */}
            <div 
                className={cn(
                    'absolute inset-0 backdrop-blur-xl bg-gradient-to-br',
                    'from-slate-100/90 via-white/80 to-slate-50/90',
                    'dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95',
                    'animate-in fade-in duration-300'
                )}
            />
            
            {/* Subtle gradient orbs for depth */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-400/20 dark:bg-violet-500/10 rounded-full blur-3xl" />
            </div>

            {/* Modal card */}
            <div 
                className={cn(
                    'relative z-10 w-full max-w-[380px] mx-4',
                    'animate-in fade-in zoom-in-95 duration-300',
                    'bg-white dark:bg-slate-900',
                    'rounded-3xl',
                    'shadow-2xl shadow-black/10 dark:shadow-black/50',
                    'border border-slate-200 dark:border-slate-700',
                    'p-8'
                )}
            >
                {children}
            </div>
        </div>
    );
};


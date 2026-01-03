import React, { useEffect, useState } from 'react';
import { cn } from '@/client/lib/utils';

interface IOSAuthModalProps {
    children: React.ReactNode;
    isOpen: boolean;
    /** Optional  callback for dismissible modal. When provided, backdrop click closes the modal. */
    onOpenChange?: (open: boolean) => void;
}

/**
 * iOS-native inspired full-screen auth modal
 * Features:
 * - Glassmorphism backdrop
 * - Centered card with soft shadows
 * - Smooth fade-in animation
 * - Client-only rendering to avoid SSR hydration issues
 * - Optional dismissible via onOpenChange prop (backdrop click)
 */
export const IOSAuthModal: React.FC<IOSAuthModalProps> = ({ children, isOpen, onOpenChange }) => {
    // eslint-disable-next-line state-management/prefer-state-architecture -- prevent SSR hydration mismatch
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Don't render during SSR or before mount to prevent hydration mismatch
    if (!isMounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            {/* Glassmorphism backdrop - clickable to dismiss if onOpenChange provided */}
            <div 
                className={cn(
                    'absolute inset-0 backdrop-blur-xl bg-gradient-to-br',
                    'from-background/90 via-card/80 to-muted/90',
                    'animate-in fade-in duration-300',
                    onOpenChange && 'cursor-pointer'
                )}
                onClick={onOpenChange ? () => onOpenChange(false) : undefined}
            />
            
            {/* Subtle gradient orbs for depth */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/15 rounded-full blur-3xl" />
            </div>

            {/* Modal card - stop propagation so clicking card doesn't close */}
            <div 
                className={cn(
                    'relative z-10 w-full max-w-[380px] mx-4',
                    'animate-in fade-in zoom-in-95 duration-300',
                    'bg-card',
                    'rounded-3xl',
                    'shadow-2xl shadow-foreground/5',
                    'border border-border',
                    'p-8'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};


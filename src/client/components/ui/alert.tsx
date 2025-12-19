import * as React from 'react';
import { cn } from '@/client/lib/utils';

const variants = {
    default: 'bg-background text-foreground',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
    success: 'border-green-500/50 text-green-700 dark:text-green-400',
    warning: 'border-yellow-500/50 text-yellow-700 dark:text-yellow-400',
    info: 'border-blue-500/50 text-blue-700 dark:text-blue-400',
} as const;

type Variant = keyof typeof variants;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: Variant;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'default', ...props }, ref) => (
        <div
            ref={ref}
            role="alert"
            className={cn('relative w-full rounded-lg border p-4', variants[variant], className)}
            {...props}
        />
    )
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
    )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
    )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };



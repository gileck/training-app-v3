import * as React from 'react';
import { cn } from '@/client/lib/utils';

export interface LinearProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0 - 100; when undefined, indeterminate
  thickness?: 'sm' | 'md';
}

export const LinearProgress = React.forwardRef<HTMLDivElement, LinearProgressProps>(
  ({ className, value, thickness = 'md', ...props }, ref) => {
    const heightClass = thickness === 'sm' ? 'h-1' : 'h-1.5';
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={typeof value === 'number' ? value : undefined}
        className={cn('relative w-full overflow-hidden rounded bg-muted', heightClass, className)}
        {...props}
      >
        {typeof value === 'number' ? (
          <span
            className="block h-full bg-primary transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        ) : (
          <span className="absolute inset-y-0 left-0 w-2/5 bg-primary animate-[linear-progress_1.2s_ease-in-out_infinite]" />
        )}
      </div>
    );
  }
);
LinearProgress.displayName = 'LinearProgress';



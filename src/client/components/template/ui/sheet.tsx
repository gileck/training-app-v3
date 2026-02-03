import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/client/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    side?: 'left' | 'right' | 'top' | 'bottom';
}

const sideStyles = {
    left: 'inset-y-0 left-0 h-full w-3/4 sm:w-80',
    right: 'inset-y-0 right-0 h-full w-3/4 sm:w-80',
    top: 'inset-x-0 top-0 w-full',
    bottom: 'inset-x-0 bottom-0 w-full',
};

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    SheetContentProps
>(({ className, side = 'right', ...props }, ref) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-[overlay-in_200ms_ease-out] data-[state=closed]:animate-[overlay-out_150ms_ease-in]" />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed z-50 flex flex-col gap-2 border bg-background p-0 shadow-lg sm:rounded-none',
                // enter/exit animations based on side
                side === 'left' && 'data-[state=open]:animate-[sheet-in-left_200ms_ease-out] data-[state=closed]:animate-[sheet-out-left_150ms_ease-in]',
                side === 'right' && 'data-[state=open]:animate-[sheet-in-right_200ms_ease-out] data-[state=closed]:animate-[sheet-out-right_150ms_ease-in]',
                side === 'top' && 'data-[state=open]:animate-[sheet-in-top_200ms_ease-out] data-[state=closed]:animate-[sheet-out-top_150ms_ease-in]',
                side === 'bottom' && 'data-[state=open]:animate-[sheet-in-bottom_200ms_ease-out] data-[state=closed]:animate-[sheet-out-bottom_150ms_ease-in]',
                sideStyles[side],
                className
            )}
            {...props}
        />
    </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
));
SheetTitle.displayName = 'SheetTitle';

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle };



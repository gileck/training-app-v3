import * as React from 'react';
import { cn } from '@/client/lib/utils';

interface TabsContextValue {
    value: string;
    onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
    const context = React.useContext(TabsContext);

    if (!context) {
        throw new Error('Tabs components must be used within <Tabs>.');
    }

    return context;
}

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
    }
>(({ className, value, defaultValue, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
    const currentValue = value ?? internalValue;

    const handleValueChange = React.useCallback(
        (nextValue: string) => {
            if (value === undefined) {
                setInternalValue(nextValue);
            }

            onValueChange?.(nextValue);
        },
        [onValueChange, value]
    );

    return (
        <TabsContext.Provider
            value={{
                value: currentValue,
                onValueChange: handleValueChange,
            }}
        >
            <div ref={ref} className={cn('space-y-4', className)} {...props} />
        </TabsContext.Provider>
    );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'inline-flex h-11 items-center rounded-2xl border border-border bg-muted/40 p-1',
                className
            )}
            {...props}
        />
    )
);
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, onClick, ...props }, ref) => {
    const context = useTabsContext();
    const isActive = context.value === value;

    return (
        <button
            ref={ref}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
                'inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                className
            )}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    context.onValueChange?.(value);
                }
            }}
            {...props}
        />
    );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = useTabsContext();

    if (context.value !== value) {
        return null;
    }

    return <div ref={ref} className={cn('outline-none', className)} {...props} />;
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };

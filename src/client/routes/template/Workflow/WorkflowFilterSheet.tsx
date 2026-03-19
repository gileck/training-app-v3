import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/client/components/template/ui/sheet';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Separator } from '@/client/components/template/ui/separator';
import { Filter, X, Bug, Sparkles, ArrowUpDown } from 'lucide-react';
import { useIOSKeyboardOffset } from '@/client/lib/hooks';
import { cn } from '@/client/lib/utils';
import type { TypeFilter, PriorityFilter, SizeFilter, DomainFilter, SortBy } from './store';

interface WorkflowFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    typeFilter: TypeFilter;
    onTypeChange: (v: TypeFilter) => void;
    priorityFilter: PriorityFilter;
    onPriorityChange: (v: PriorityFilter) => void;
    sizeFilter: SizeFilter;
    onSizeChange: (v: SizeFilter) => void;
    domainFilter: DomainFilter;
    onDomainChange: (v: DomainFilter) => void;
    domainOptions: string[];
    sortBy: SortBy;
    onSortChange: (v: SortBy) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
    critical: 'bg-destructive',
    high: 'bg-warning',
    medium: 'bg-primary',
    low: 'bg-secondary',
};

function FilterOption({ label, isActive, onClick, icon, colorDot }: {
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    colorDot?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
        >
            {colorDot && <span className={cn('h-3 w-3 rounded-full flex-shrink-0', colorDot)} />}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {isActive && <X className="h-4 w-4 flex-shrink-0" />}
        </button>
    );
}

function countActiveFilters(type: TypeFilter, priority: PriorityFilter, size: SizeFilter, domain: DomainFilter, sort: SortBy): number {
    let count = 0;
    if (type !== 'all') count++;
    if (priority !== 'all') count++;
    if (size !== 'all') count++;
    if (domain !== 'all') count++;
    if (sort !== 'date') count++;
    return count;
}

export function WorkflowFilterSheet({
    open,
    onOpenChange,
    typeFilter,
    onTypeChange,
    priorityFilter,
    onPriorityChange,
    sizeFilter,
    onSizeChange,
    domainFilter,
    onDomainChange,
    domainOptions,
    sortBy,
    onSortChange,
}: WorkflowFilterSheetProps) {
    const keyboardOffset = useIOSKeyboardOffset();

    const activeCount = countActiveFilters(typeFilter, priorityFilter, sizeFilter, domainFilter, sortBy);
    const hasActiveFilters = activeCount > 0;

    const clearAll = () => {
        onTypeChange('all');
        onPriorityChange('all');
        onSizeChange('all');
        onDomainChange('all');
        onSortChange('date');
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="max-h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8 pt-4"
                style={{
                    transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
                    transition: 'transform 0.1s ease-out',
                }}
            >
                <SheetHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-1">
                                    {activeCount}
                                </Badge>
                            )}
                        </SheetTitle>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <X className="h-5 w-5" />
                            </Button>
                        </SheetClose>
                    </div>
                </SheetHeader>

                <div className="space-y-1">
                    {/* Type */}
                    <div className="space-y-2">
                        <div className="py-2 text-sm font-medium text-foreground">Type</div>
                        <div className="grid grid-cols-2 gap-2 pb-2">
                            <FilterOption label="All Types" isActive={typeFilter === 'all'} onClick={() => onTypeChange('all')} />
                            <FilterOption label="Features" isActive={typeFilter === 'feature'} onClick={() => onTypeChange('feature')} icon={<Sparkles className="h-4 w-4" />} />
                            <FilterOption label="Bugs" isActive={typeFilter === 'bug'} onClick={() => onTypeChange('bug')} icon={<Bug className="h-4 w-4" />} />
                        </div>
                    </div>

                    {domainOptions.length > 0 && (
                        <>
                            <Separator />

                            {/* Domain */}
                            <div className="space-y-2">
                                <div className="py-2 text-sm font-medium text-foreground">Domain</div>
                                <div className="grid grid-cols-2 gap-2 pb-2">
                                    <FilterOption label="All" isActive={domainFilter === 'all'} onClick={() => onDomainChange('all')} />
                                    {domainOptions.map((d) => (
                                        <FilterOption key={d} label={d} isActive={domainFilter === d} onClick={() => onDomainChange(d)} />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Priority */}
                    <div className="space-y-2">
                        <div className="py-2 text-sm font-medium text-foreground">Priority</div>
                        <div className="grid grid-cols-2 gap-2 pb-2">
                            <FilterOption label="All" isActive={priorityFilter === 'all'} onClick={() => onPriorityChange('all')} />
                            <FilterOption label="Critical" isActive={priorityFilter === 'critical'} onClick={() => onPriorityChange('critical')} colorDot={PRIORITY_COLORS.critical} />
                            <FilterOption label="High" isActive={priorityFilter === 'high'} onClick={() => onPriorityChange('high')} colorDot={PRIORITY_COLORS.high} />
                            <FilterOption label="Medium" isActive={priorityFilter === 'medium'} onClick={() => onPriorityChange('medium')} colorDot={PRIORITY_COLORS.medium} />
                            <FilterOption label="Low" isActive={priorityFilter === 'low'} onClick={() => onPriorityChange('low')} colorDot={PRIORITY_COLORS.low} />
                        </div>
                    </div>

                    <Separator />

                    {/* Size */}
                    <div className="space-y-2">
                        <div className="py-2 text-sm font-medium text-foreground">Size</div>
                        <div className="grid grid-cols-3 gap-2 pb-2">
                            <FilterOption label="All" isActive={sizeFilter === 'all'} onClick={() => onSizeChange('all')} />
                            <FilterOption label="XS" isActive={sizeFilter === 'XS'} onClick={() => onSizeChange('XS')} />
                            <FilterOption label="S" isActive={sizeFilter === 'S'} onClick={() => onSizeChange('S')} />
                            <FilterOption label="M" isActive={sizeFilter === 'M'} onClick={() => onSizeChange('M')} />
                            <FilterOption label="L" isActive={sizeFilter === 'L'} onClick={() => onSizeChange('L')} />
                            <FilterOption label="XL" isActive={sizeFilter === 'XL'} onClick={() => onSizeChange('XL')} />
                        </div>
                    </div>

                    <Separator />

                    {/* Sort */}
                    <div className="space-y-2">
                        <div className="py-2 text-sm font-medium text-foreground">Sort By</div>
                        <div className="grid grid-cols-3 gap-2 pb-2">
                            <FilterOption label="Date" isActive={sortBy === 'date'} onClick={() => onSortChange('date')} icon={<ArrowUpDown className="h-4 w-4" />} />
                            <FilterOption label="Priority" isActive={sortBy === 'priority'} onClick={() => onSortChange('priority')} icon={<ArrowUpDown className="h-4 w-4" />} />
                            <FilterOption label="Size" isActive={sortBy === 'size'} onClick={() => onSortChange('size')} icon={<ArrowUpDown className="h-4 w-4" />} />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    {hasActiveFilters && (
                        <Button variant="outline" className="flex-1" onClick={clearAll}>
                            Clear All
                        </Button>
                    )}
                    <Button className="flex-1" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export { countActiveFilters };

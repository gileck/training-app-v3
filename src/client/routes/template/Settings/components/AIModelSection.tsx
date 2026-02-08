/**
 * AI Model Selection Section Component
 */

import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/client/components/template/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/template/ui/collapsible';
import { getModelsByTier } from '@/common/ai/models';
import { useSettingsStore, useIsAdmin } from '@/client/features';
import { ChevronDown, ChevronRight } from 'lucide-react';

function formatPrice(price: number): string {
    return price < 1 ? `$${price.toFixed(2)}` : `$${price}`;
}

export function AIModelSection() {
    const settings = useSettingsStore((state) => state.settings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);
    const isAdmin = useIsAdmin();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral toggle for collapsible UI
    const [pricingOpen, setPricingOpen] = useState(false);

    const groupedModels = useMemo(() => getModelsByTier(), []);

    const handleModelChange = (value: string) => {
        updateSettings({ aiModel: value });
    };

    return (
        <>
            <h2 className="mb-2 text-lg font-medium">AI Model</h2>
            <p className="mb-2 text-sm text-muted-foreground">
                Select the AI model to use for chat and other AI-powered features.
            </p>
            <Select value={settings.aiModel} onValueChange={handleModelChange}>
                <SelectTrigger>
                    <SelectValue placeholder="AI Model" />
                </SelectTrigger>
                <SelectContent>
                    {groupedModels.map(({ tier, models }) => (
                        <SelectGroup key={tier}>
                            <SelectLabel>{tier}{!isAdmin && tier !== 'Budget' ? ' (Admin only)' : ''}</SelectLabel>
                            {models.map((model) => (
                                <SelectItem key={model.id} value={model.id} disabled={!isAdmin && tier !== 'Budget'}>
                                    {model.name} ({model.provider})
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>

            <Collapsible open={pricingOpen} onOpenChange={setPricingOpen} className="mt-3">
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    {pricingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Pricing (per 1M tokens)
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                    {groupedModels.map(({ tier, models }) => (
                        <div key={tier}>
                            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">{tier}</p>
                            <div className="space-y-1">
                                {models.map((model) => (
                                    <div key={model.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                                        <span>{model.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatPrice(model.inputPricePer1M)} in / {formatPrice(model.outputPricePer1M)} out
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </CollapsibleContent>
            </Collapsible>
        </>
    );
}

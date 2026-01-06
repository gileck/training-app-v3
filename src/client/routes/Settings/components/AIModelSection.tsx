/**
 * AI Model Selection Section Component
 */

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { getAllModels, type AIModelDefinition } from '@/common/ai/models';
import { useSettingsStore } from '@/client/features/settings';

export function AIModelSection() {
    const settings = useSettingsStore((state) => state.settings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    // eslint-disable-next-line state-management/prefer-state-architecture -- static data from sync function, not API
    const [models] = useState<AIModelDefinition[]>(getAllModels());

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
                    {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                            {model.name} ({model.provider})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </>
    );
}

import React from 'react';
import { Check, Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { fontPresets } from './fonts';
import { useThemeStore } from './store';

/**
 * Font family selector dropdown
 */
export function FontSelector() {
    const currentFontId = useThemeStore((s) => s.settings.fontFamily);
    const setFontFamily = useThemeStore((s) => s.setFontFamily);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Font</h3>
            </div>

            <Select value={currentFontId} onValueChange={setFontFamily}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a font" />
                </SelectTrigger>
                <SelectContent>
                    {fontPresets.map((font) => (
                        <SelectItem 
                            key={font.id} 
                            value={font.id}
                            className="py-2"
                        >
                            <div className="flex items-center gap-2">
                                <span 
                                    className="text-sm"
                                    style={{ fontFamily: font.fontFamily }}
                                >
                                    {font.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {font.description}
                                </span>
                                {currentFontId === font.id && (
                                    <Check className="ml-auto h-4 w-4 text-primary" />
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}


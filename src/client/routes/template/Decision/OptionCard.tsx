/**
 * OptionCard Component
 *
 * Renders a single decision option with dynamic metadata fields.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/client/components/template/ui/label';
import { RadioGroupItem } from '@/client/components/template/ui/radio-group';
import type { DecisionOption, MetadataFieldConfig } from '@/apis/template/agent-decision/types';
import { MetadataField } from './MetadataField';

interface OptionCardProps {
    option: DecisionOption;
    isSelected: boolean;
    metadataSchema: MetadataFieldConfig[];
}

export function OptionCard({ option, isSelected, metadataSchema }: OptionCardProps) {
    // Separate inline metadata (badge/tag shown in title row) from block metadata (file-list/text shown below)
    const inlineFields = metadataSchema.filter(f => f.type === 'badge' || f.type === 'tag');
    const blockFields = metadataSchema.filter(f => f.type === 'file-list' || f.type === 'text');

    return (
        <div
            className={`p-3 rounded-md border transition-colors cursor-pointer overflow-hidden ${
                isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
            }`}
            onClick={() => {
                const radio = document.getElementById(`decision-${option.id}`) as HTMLButtonElement | null;
                radio?.click();
            }}
        >
            {/* Title row with radio */}
            <div className="flex items-start gap-2 sm:gap-3">
                <RadioGroupItem
                    value={option.id}
                    id={`decision-${option.id}`}
                    className="mt-0.5 shrink-0"
                />
                <Label htmlFor={`decision-${option.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-sm sm:text-base">{option.title}</span>
                        {inlineFields.map(field => {
                            const value = option.metadata[field.key];
                            if (value === undefined) return null;
                            return (
                                <MetadataField key={field.key} config={field} value={value} />
                            );
                        })}
                        {option.isRecommended && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Recommended
                            </span>
                        )}
                    </div>
                </Label>
            </div>

            {/* Description rendered as markdown */}
            {option.description && (
                <div className="markdown-body text-sm mt-2 pl-6 sm:pl-7 overflow-hidden">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {option.description}
                    </ReactMarkdown>
                </div>
            )}

            {/* Block metadata fields */}
            {blockFields.map(field => {
                const value = option.metadata[field.key];
                if (value === undefined) return null;
                return (
                    <div key={field.key} className="mt-1 pl-6 sm:pl-7 overflow-hidden">
                        <MetadataField config={field} value={value} />
                    </div>
                );
            })}
        </div>
    );
}

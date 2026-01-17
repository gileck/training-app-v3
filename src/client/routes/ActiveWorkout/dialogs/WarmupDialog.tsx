import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { Loader2, RefreshCw, Sparkles, Cpu, DollarSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getAllModels, type AIModelDefinition } from '@/common/ai/models';
import type { WarmupCost } from '@/apis/workout-warmup/types';

const models = getAllModels();

// Group models by provider for better UX
const modelsByProvider = models.reduce(
    (acc, model) => {
        if (!acc[model.provider]) {
            acc[model.provider] = [];
        }
        acc[model.provider].push(model);
        return acc;
    },
    {} as Record<string, AIModelDefinition[]>
);

const providerLabels: Record<string, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
};

interface WarmupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    warmup: string | null;
    cost: WarmupCost | null;
    isLoading: boolean;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    onGenerate: () => void;
    onRegenerate: () => void;
}

export function WarmupDialog({
    open,
    onOpenChange,
    warmup,
    cost,
    isLoading,
    selectedModelId,
    onModelChange,
    onGenerate,
    onRegenerate,
}: WarmupDialogProps) {
    const hasWarmup = warmup !== null && warmup.length > 0;
    const selectedModel = models.find((m) => m.id === selectedModelId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header with gradient accent */}
                <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
                    <DialogTitle className="flex items-center gap-2.5 text-lg">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        AI Warmup
                    </DialogTitle>
                </DialogHeader>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        /* Loading State */
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                <div className="relative p-4 rounded-full bg-primary/10">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-foreground">Generating warmup...</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Using {selectedModel?.name || 'AI'}
                                </p>
                            </div>
                        </div>
                    ) : hasWarmup ? (
                        /* Warmup Content */
                        <div className="px-5 py-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown
                                    components={{
                                        h2: ({ children }) => (
                                            <h2 className="text-base font-semibold text-foreground mt-5 mb-2 first:mt-0 flex items-center gap-2">
                                                <span className="w-1 h-5 bg-primary rounded-full" />
                                                {children}
                                            </h2>
                                        ),
                                        h3: ({ children }) => (
                                            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">
                                                {children}
                                            </h3>
                                        ),
                                        p: ({ children }) => (
                                            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                                                {children}
                                            </p>
                                        ),
                                        ul: ({ children }) => (
                                            <ul className="text-sm text-muted-foreground mb-3 pl-4 space-y-1.5 list-disc marker:text-primary/60">
                                                {children}
                                            </ul>
                                        ),
                                        ol: ({ children }) => (
                                            <ol className="text-sm text-muted-foreground mb-3 pl-4 space-y-1.5 list-decimal marker:text-primary/60 marker:font-semibold">
                                                {children}
                                            </ol>
                                        ),
                                        li: ({ children }) => (
                                            <li className="leading-relaxed">{children}</li>
                                        ),
                                        strong: ({ children }) => (
                                            <strong className="font-semibold text-foreground">
                                                {children}
                                            </strong>
                                        ),
                                    }}
                                >
                                    {warmup}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        /* Empty State - Generate */
                        <div className="flex flex-col items-center justify-center px-5 py-10 gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                                <Sparkles className="h-10 w-10 text-primary" />
                            </div>
                            <div className="text-center space-y-1.5">
                                <p className="text-lg font-semibold text-foreground">
                                    Generate AI Warmup
                                </p>
                                <p className="text-sm text-muted-foreground max-w-[280px]">
                                    Get a personalized warmup routine tailored to your workout
                                    exercises
                                </p>
                            </div>

                            {/* Model Selection Card */}
                            <div className="w-full max-w-sm p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                    Select AI Model
                                </div>
                                <Select value={selectedModelId} onValueChange={onModelChange}>
                                    <SelectTrigger className="w-full h-11 bg-background">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(modelsByProvider).map(
                                            ([provider, providerModels]) => (
                                                <SelectGroup key={provider}>
                                                    <SelectLabel className="text-xs text-muted-foreground">
                                                        {providerLabels[provider] || provider}
                                                    </SelectLabel>
                                                    {providerModels.map((model) => (
                                                        <SelectItem key={model.id} value={model.id}>
                                                            {model.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Generate Button */}
                            <Button
                                onClick={onGenerate}
                                size="lg"
                                className="w-full max-w-sm h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-100"
                            >
                                <Sparkles className="mr-2 h-5 w-5" />
                                Generate Warmup
                            </Button>

                            {/* Close Button */}
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Close
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer - Only show when warmup exists */}
                {hasWarmup && !isLoading && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/30 space-y-3">
                        {/* Cost info */}
                        {cost && (
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span>Generation cost</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{cost.modelName}</span>
                                    <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                                        ${cost.totalCost.toFixed(4)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Actions row */}
                        <div className="flex items-center gap-3">
                            {/* Model selector */}
                            <Select value={selectedModelId} onValueChange={onModelChange}>
                                <SelectTrigger className="flex-1 h-10 bg-background">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(modelsByProvider).map(
                                        ([provider, providerModels]) => (
                                            <SelectGroup key={provider}>
                                                <SelectLabel className="text-xs text-muted-foreground">
                                                    {providerLabels[provider] || provider}
                                                </SelectLabel>
                                                {providerModels.map((model) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )
                                    )}
                                </SelectContent>
                            </Select>

                            {/* Regenerate Button */}
                            <Button
                                onClick={onRegenerate}
                                disabled={isLoading}
                                className="h-10 px-4 rounded-lg bg-primary hover:bg-primary/90 active:scale-[0.97] transition-all duration-100"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate
                            </Button>

                            {/* Close Button */}
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="h-10 px-4 rounded-lg active:scale-[0.97] transition-all duration-100"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

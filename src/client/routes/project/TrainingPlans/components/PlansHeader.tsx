import { Button } from '@/client/components/ui/button';
import { Plus, Sparkles, FileJson, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';

interface PlansHeaderProps {
    onCreateManual: () => void;
    onCreateWithAi: () => void;
    onImport: () => void;
}

export function PlansHeader({
    onCreateManual,
    onCreateWithAi,
    onImport,
}: PlansHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold">Training Plans</h1>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="rounded-xl">
                        <Plus className="mr-2 h-4 w-4" />
                        New Plan
                        <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onCreateManual}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Manually
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onCreateWithAi}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create with AI
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onImport}>
                        <FileJson className="h-4 w-4 mr-2" />
                        Import from JSON
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

import { Button } from '@/client/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

interface ManagePlanHeaderProps {
    plan: TrainingPlanClient;
    onBack: () => void;
}

export function ManagePlanHeader({ plan, onBack }: ManagePlanHeaderProps) {
    return (
        <div className="flex items-center gap-3 mb-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="rounded-full"
            >
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
                <h1 className="text-xl font-semibold">{plan.name}</h1>
                <p className="text-sm text-muted-foreground">{plan.durationWeeks} weeks</p>
            </div>
        </div>
    );
}

import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Plus, Calendar, Sparkles, FileJson } from 'lucide-react';

interface PlansEmptyStateProps {
    onCreateManual: () => void;
    onCreateWithAi: () => void;
    onImport: () => void;
}

export function PlansEmptyState({
    onCreateManual,
    onCreateWithAi,
    onImport,
}: PlansEmptyStateProps) {
    return (
        <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No training plans yet</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                    Create a training plan to start tracking your workouts
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <Button onClick={onCreateManual}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Manually
                    </Button>
                    <Button onClick={onCreateWithAi} variant="outline">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Create with AI
                    </Button>
                    <Button onClick={onImport} variant="outline">
                        <FileJson className="mr-2 h-4 w-4" />
                        Import JSON
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

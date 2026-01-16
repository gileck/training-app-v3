/**
 * ExercisesTab Empty State Component
 */

import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Dumbbell, Plus } from 'lucide-react';

interface ExercisesEmptyStateProps {
    onAddClick: () => void;
}

export function ExercisesEmptyState({ onAddClick }: ExercisesEmptyStateProps) {
    return (
        <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
                <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No exercises yet</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                    Add exercises from the library to build your plan
                </p>
                <Button onClick={onAddClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Exercise
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * Success State Component
 *
 * Displayed after successfully submitting clarification answers.
 */

import { CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/client/components/ui/card';

interface SuccessStateProps {
    issueNumber: number;
}

export function SuccessState({ issueNumber }: SuccessStateProps) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-primary" />
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-foreground">
                            Answer Submitted!
                        </h2>
                        <p className="text-muted-foreground">
                            Your clarification has been posted to Issue #{issueNumber}.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            The agent will continue processing on the next workflow run.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

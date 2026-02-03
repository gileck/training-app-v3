import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Badge } from '@/client/components/template/ui/badge';
import {
    CheckCircle,
    Copy,
    Edit2,
    MoreVertical,
    Download,
    Settings2,
    Share2,
    Trash2,
    Calendar,
    Bot,
    FileJson,
    Link,
    Plus,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import type { TrainingPlanClient, PlanCreationSource } from '@/server/database/collections/trainingPlans/types';

interface PlanCardProps {
    plan: TrainingPlanClient;
    onManage: (plan: TrainingPlanClient) => void;
    onSetActive: (plan: TrainingPlanClient) => void;
    onEdit: (plan: TrainingPlanClient) => void;
    onDuplicate: (plan: TrainingPlanClient) => void;
    onExport: (plan: TrainingPlanClient) => void;
    onShare: (plan: TrainingPlanClient) => void;
    onDelete: (plan: TrainingPlanClient) => void;
    isSetActiveLoading?: boolean;
    isDuplicateLoading?: boolean;
    isExportLoading?: boolean;
}

/**
 * Get display info for plan creation source
 */
function getCreationSourceInfo(source?: PlanCreationSource): { icon: React.ReactNode; label: string } | null {
    switch (source) {
        case 'ai':
            return { icon: <Bot className="h-3 w-3" />, label: 'AI Generated' };
        case 'import':
            return { icon: <FileJson className="h-3 w-3" />, label: 'Imported' };
        case 'share':
            return { icon: <Link className="h-3 w-3" />, label: 'Shared' };
        case 'duplicate':
            return { icon: <Copy className="h-3 w-3" />, label: 'Duplicated' };
        case 'manual':
            return { icon: <Plus className="h-3 w-3" />, label: 'Created' };
        default:
            return null; // Don't show for plans without creationSource (legacy)
    }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export function PlanCard({
    plan,
    onManage,
    onSetActive,
    onEdit,
    onDuplicate,
    onExport,
    onShare,
    onDelete,
    isSetActiveLoading = false,
    isDuplicateLoading = false,
    isExportLoading = false,
}: PlanCardProps) {
    return (
        <Card
            className={`rounded-2xl border-0 shadow-sm transition-all cursor-pointer hover:bg-muted/50 active:scale-[0.99] ${
                plan.isActive ? 'ring-2 ring-primary bg-primary/5' : ''
            }`}
            onClick={() => onManage(plan)}
        >
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            {plan.durationWeeks} weeks
                        </p>
                        {/* Creation source and date */}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            {(() => {
                                const sourceInfo = getCreationSourceInfo(plan.creationSource);
                                if (sourceInfo) {
                                    return (
                                        <>
                                            {sourceInfo.icon}
                                            <span>{sourceInfo.label} · {formatDate(plan.createdAt)}</span>
                                        </>
                                    );
                                }
                                // Legacy plans without creationSource - just show date
                                return (
                                    <>
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(plan.createdAt)}</span>
                                    </>
                                );
                            })()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {plan.isActive && (
                            <Badge className="bg-primary text-primary-foreground">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                            </Badge>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-lg h-8 w-8 p-0"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {!plan.isActive && (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => onSetActive(plan)}
                                            disabled={isSetActiveLoading}
                                            className="text-primary focus:text-primary"
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Set Active
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuItem onClick={() => onEdit(plan)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDuplicate(plan)}
                                    disabled={isDuplicateLoading}
                                >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onExport(plan)}
                                    disabled={isExportLoading}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onShare(plan)}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onDelete(plan)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onManage(plan);
                    }}
                    className="rounded-lg"
                >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Manage
                </Button>
            </CardContent>
        </Card>
    );
}

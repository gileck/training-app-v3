import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import { Label } from '@/client/components/ui/label';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Badge } from '@/client/components/ui/badge';
import { toast } from '@/client/components/ui/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Dumbbell, Search, ChevronUp, ChevronDown, Sparkles, ArrowUpDown, Check, X, Filter, ListChecks, MessageSquare, Copy, Bookmark } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { useRouter } from '../../router';
import {
    usePlan,
    usePlanExercises,
    useExerciseLibrary,
    useAddPlanExercise,
    useBulkAddPlanExercises,
    useUpdatePlanExercise,
    useDeletePlanExercise,
    useReorderPlanExercises,
    useCreateExercise,
    useUpdateExercise,
    useDeleteExercise,
} from './hooks';
import {
    useSavedWorkouts,
    useCreateSavedWorkout,
    useUpdateSavedWorkout,
    useDeleteSavedWorkout,
} from '../Home/hooks';
import { CreateExerciseDialog } from '@/client/components/CreateExerciseDialog';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';

export function ManagePlan() {
    const { navigate, routeParams, queryParams } = useRouter();
    const planId = routeParams.planId || '';

    // Queries
    const { data: planData, isLoading: planLoading } = usePlan(planId);
    const { data: exercisesData, isLoading: exercisesLoading } = usePlanExercises(planId);
    const { data: libraryData, isLoading: libraryLoading } = useExerciseLibrary();

    // Mutations
    const addExerciseMutation = useAddPlanExercise();
    const bulkAddMutation = useBulkAddPlanExercises();
    const updateExerciseMutation = useUpdatePlanExercise(planId);
    const deleteExerciseMutation = useDeletePlanExercise(planId);
    const reorderMutation = useReorderPlanExercises(planId);
    
    // Custom exercise mutations
    const createExerciseMutation = useCreateExercise();
    const updateExerciseDefMutation = useUpdateExercise();
    const deleteExerciseDefMutation = useDeleteExercise();

    // Saved workouts
    const { data: savedWorkoutsData } = useSavedWorkouts();
    const createWorkoutMutation = useCreateSavedWorkout();
    const updateWorkoutMutation = useUpdateSavedWorkout();
    const deleteWorkoutMutation = useDeleteSavedWorkout();
    const savedWorkouts = savedWorkoutsData?.workouts || [];

    // UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral tab state
    const [activeTab, setActiveTab] = useState<'exercises' | 'workouts'>(
        queryParams.tab === 'workouts' ? 'workouts' : 'exercises'
    );

    // Update tab when query param changes
    useEffect(() => {
        if (queryParams.tab === 'workouts') {
            setActiveTab('workouts');
        }
    }, [queryParams.tab]);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral sheet state
    const [addSheetOpen, setAddSheetOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral search filter
    const [searchQuery, setSearchQuery] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configSets, setConfigSets] = useState(3);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configReps, setConfigReps] = useState(12);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configWeight, setConfigWeight] = useState(0);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configComments, setConfigComments] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToDelete, setExerciseToDelete] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToEdit, setExerciseToEdit] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [createExerciseOpen, setCreateExerciseOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editExerciseDefOpen, setEditExerciseDefOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseDefToEdit, setExerciseDefToEdit] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteExerciseDefDialogOpen, setDeleteExerciseDefDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseDefToDelete, setExerciseDefToDelete] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral mode state
    const [isReorderMode, setIsReorderMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter state
    const [filterMuscle, setFilterMuscle] = useState<string>('all');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter state
    const [filterType, setFilterType] = useState<string>('all');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter UI state
    const [showFilters, setShowFilters] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter state
    const [filterSource, setFilterSource] = useState<'all' | 'system' | 'custom'>('all');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-select mode
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-select state
    const [selectedExercises, setSelectedExercises] = useState<Map<string, {
        exercise: ExerciseDefinitionClient;
        sets: number;
        reps: number;
        weight: number;
        comments: string;
    }>>(new Map());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-config view
    const [showMultiConfig, setShowMultiConfig] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral notes dialog
    const [notesDialogExerciseId, setNotesDialogExerciseId] = useState<string | null>(null);

    // Workouts tab state - unified create/edit dialog
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [workoutDialogOpen, setWorkoutDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- null = create mode, workout = edit mode
    const [editingWorkout, setEditingWorkout] = useState<SavedWorkoutWithExercises | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [workoutName, setWorkoutName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection
    const [selectedWorkoutExercises, setSelectedWorkoutExercises] = useState<Set<string>>(new Set());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteWorkoutDialogOpen, setDeleteWorkoutDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral context
    const [workoutToDelete, setWorkoutToDelete] = useState<SavedWorkoutWithExercises | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral expand state
    const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

    const plan = planData?.plan;
    const planExercises = exercisesData?.exercises || [];
    const exerciseLibrary = libraryData?.exercises || [];

    // Get unique muscle groups and exercise types for filters (exclude empty strings)
    const uniqueMuscles = [...new Set(exerciseLibrary.map((ex) => ex.primaryMuscle).filter(Boolean))].sort();
    const uniqueTypes = [...new Set(exerciseLibrary.map((ex) => ex.type).filter(Boolean))].sort();

    // Track which exercises are already in the plan
    const addedExerciseIds = new Set(planExercises.map((e) => e.exerciseDefId));

    // Filter library by search query and filters (but keep exercises already in plan visible)
    const filteredLibrary = exerciseLibrary.filter((ex) => {
        // Apply source filter
        if (filterSource === 'system' && !ex.isSystem) return false;
        if (filterSource === 'custom' && ex.isSystem) return false;
        // Apply muscle filter
        if (filterMuscle !== 'all' && ex.primaryMuscle !== filterMuscle) return false;
        // Apply type filter
        if (filterType !== 'all' && ex.type !== filterType) return false;
        // Apply search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
                !ex.name.toLowerCase().includes(query) &&
                !ex.primaryMuscle.toLowerCase().includes(query) &&
                !ex.type.toLowerCase().includes(query)
            ) {
                return false;
            }
        }
        return true;
    });

    // Sort: exercises not in plan first, then alphabetically
    const sortedFilteredLibrary = [...filteredLibrary].sort((a, b) => {
        const aInPlan = addedExerciseIds.has(a._id);
        const bInPlan = addedExerciseIds.has(b._id);
        if (aInPlan !== bInPlan) return aInPlan ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    const hasActiveFilters = filterMuscle !== 'all' || filterType !== 'all' || filterSource !== 'all';

    const handleSelectExercise = (exercise: ExerciseDefinitionClient) => {
        setSelectedExercise(exercise);
        setConfigSets(3);
        setConfigReps(exercise.isStatic ? 0 : 12);
        setConfigWeight(exercise.isBodyweight ? 0 : 20);
        setConfigComments('');
    };

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral success message
    const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

    const handleAddExercise = () => {
        if (!selectedExercise) return;

        const exerciseName = selectedExercise.name;
        addExerciseMutation.mutate(
            {
                planId,
                exerciseDefId: selectedExercise._id,
                sets: configSets,
                reps: configReps,
                weight: configWeight,
                comments: configComments.trim() || undefined,
            },
            {
                onSuccess: () => {
                    // Close the sheet and reset state
                    setSelectedExercise(null);
                    setConfigComments('');
                    setAddSheetOpen(false);
                    setSearchQuery('');
                    // Show success message (will show on plan page)
                    setAddSuccessMessage(`"${exerciseName}" added to plan`);
                    setTimeout(() => setAddSuccessMessage(null), 3000);
                },
                onError: (error) => {
                    toast.error(`Failed to add exercise: ${error.message}`);
                },
            }
        );
    };

    // Multi-select handlers
    const handleToggleMultiSelect = (exercise: ExerciseDefinitionClient) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(exercise._id)) {
                newMap.delete(exercise._id);
            } else {
                newMap.set(exercise._id, {
                    exercise,
                    sets: 3,
                    reps: exercise.isStatic ? 0 : 12,
                    weight: exercise.isBodyweight ? 0 : 20,
                    comments: '',
                });
            }
            return newMap;
        });
    };

    const handleUpdateMultiConfig = (exerciseId: string, field: 'sets' | 'reps' | 'weight' | 'comments', value: number | string) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            const item = newMap.get(exerciseId);
            if (item) {
                newMap.set(exerciseId, { ...item, [field]: value });
            }
            return newMap;
        });
    };

    const handleAddAllExercises = () => {
        const exercises = Array.from(selectedExercises.values()).map((item) => ({
            exerciseDefId: item.exercise._id,
            sets: item.sets,
            reps: item.reps,
            weight: item.weight,
            comments: item.comments.trim() || undefined,
        }));

        bulkAddMutation.mutate(
            { planId, exercises },
            {
                onSuccess: (response) => {
                    const addedCount = response?.addedCount || 0;
                    const failedCount = response?.failedCount || 0;

                    if (addedCount > 0) {
                        let message = `${addedCount} exercise${addedCount > 1 ? 's' : ''} added to plan`;
                        if (failedCount > 0) {
                            message += ` (${failedCount} failed)`;
                        }
                        setAddSuccessMessage(message);
                        setTimeout(() => setAddSuccessMessage(null), 3000);
                    } else if (failedCount > 0) {
                        // All failed - show errors
                        const errors = response?.results
                            ?.filter((r) => r.error)
                            .map((r) => r.error)
                            .join(', ');
                        toast.error(`Failed to add exercises: ${errors}`);
                    }

                    // Reset multi-select state and close dialogs
                    setSelectedExercises(new Map());
                    setShowMultiConfig(false);
                    setIsMultiSelectMode(false);
                    setAddSheetOpen(false);
                    setSearchQuery('');
                },
                onError: (error) => {
                    toast.error(`Failed to add exercises: ${error.message}`);
                },
            }
        );
    };

    const handleCancelMultiSelect = () => {
        setSelectedExercises(new Map());
        setShowMultiConfig(false);
        setIsMultiSelectMode(false);
    };

    const handleEditExercise = (exercise: PlanExerciseWithDefinition) => {
        setExerciseToEdit(exercise);
        setConfigSets(exercise.sets);
        setConfigReps(exercise.reps);
        setConfigWeight(exercise.weight);
        setConfigComments(exercise.comments || '');
        setEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
        if (!exerciseToEdit) return;

        updateExerciseMutation.mutate(
            {
                planExerciseId: exerciseToEdit._id,
                sets: configSets,
                reps: configReps,
                weight: configWeight,
                comments: configComments.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setExerciseToEdit(null);
                    setConfigComments('');
                },
                onError: (error) => {
                    toast.error(`Failed to update exercise: ${error.message}`);
                },
            }
        );
    };

    const handleDeleteExercise = (exercise: PlanExerciseWithDefinition) => {
        setExerciseToDelete(exercise);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!exerciseToDelete) return;

        deleteExerciseMutation.mutate(
            { planExerciseId: exerciseToDelete._id },
            {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setExerciseToDelete(null);
                },
                onError: (error) => {
                    toast.error(`Failed to delete exercise: ${error.message}`);
                },
            }
        );
    };

    const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= planExercises.length) return;

        // Create new order by swapping positions
        const newOrder = [...planExercises];
        const [moved] = newOrder.splice(index, 1);
        newOrder.splice(newIndex, 0, moved);

        // Get new exercise IDs in order
        const exerciseIds = newOrder.map((ex) => ex._id);
        reorderMutation.mutate({ planId, exerciseIds });
    };

    // Custom Exercise Handlers
    const handleCreateCustomExercise = (data: {
        name: string;
        imageBase64?: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }) => {
        createExerciseMutation.mutate(data, {
            onSuccess: (serverExercise) => {
                setCreateExerciseOpen(false);
                // Auto-select the newly created exercise with real server ID
                if (serverExercise) {
                    handleSelectExercise(serverExercise);
                }
            },
            onError: (error) => {
                toast.error(`Failed to create exercise: ${error.message}`);
            },
        });
    };

    const handleEditExerciseDef = (exercise: ExerciseDefinitionClient) => {
        setExerciseDefToEdit(exercise);
        setEditExerciseDefOpen(true);
    };

    const handleUpdateExerciseDef = (data: {
        name: string;
        imageBase64?: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }) => {
        if (!exerciseDefToEdit) return;

        updateExerciseDefMutation.mutate(
            {
                exerciseId: exerciseDefToEdit._id,
                ...data,
            },
            {
                onSuccess: () => {
                    setEditExerciseDefOpen(false);
                    setExerciseDefToEdit(null);
                },
            }
        );
    };

    const handleDeleteExerciseDefClick = (exercise: ExerciseDefinitionClient) => {
        // Check if exercise is used in current plan
        const isInPlan = planExercises.some((pe) => pe.exerciseDefId === exercise._id);
        if (isInPlan) {
            toast.error('Cannot delete: This exercise is currently used in this plan. Remove it from the plan first.');
            return;
        }
        setExerciseDefToDelete(exercise);
        setDeleteExerciseDefDialogOpen(true);
    };

    const confirmDeleteExerciseDef = () => {
        if (!exerciseDefToDelete) return;

        deleteExerciseDefMutation.mutate(
            { exerciseId: exerciseDefToDelete._id },
            {
                onSuccess: () => {
                    setDeleteExerciseDefDialogOpen(false);
                    setExerciseDefToDelete(null);
                },
            }
        );
    };

    // ==================== Saved Workouts Handlers ====================

    // Open workout dialog for create or edit
    const handleOpenWorkoutDialog = (workout?: SavedWorkoutWithExercises) => {
        if (workout) {
            // Edit mode - populate with existing workout data
            setEditingWorkout(workout);
            setWorkoutName(workout.name);
            // Select exercises that are in this workout AND exist in the current plan
            const workoutExerciseDefIds = new Set(workout.exercises.map((ex) => ex.exerciseDefId));
            const matchingPlanExerciseIds = planExercises
                .filter((pe) => workoutExerciseDefIds.has(pe.exerciseDefId))
                .map((pe) => pe._id);
            setSelectedWorkoutExercises(new Set(matchingPlanExerciseIds));
        } else {
            // Create mode - start fresh
            setEditingWorkout(null);
            setWorkoutName('');
            setSelectedWorkoutExercises(new Set());
        }
        setWorkoutDialogOpen(true);
    };

    const handleToggleWorkoutExercise = (exerciseId: string) => {
        setSelectedWorkoutExercises((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(exerciseId)) {
                newSet.delete(exerciseId);
            } else {
                newSet.add(exerciseId);
            }
            return newSet;
        });
    };

    const handleSelectAllWorkoutExercises = () => {
        setSelectedWorkoutExercises(new Set(planExercises.map((ex) => ex._id)));
    };

    const handleDeselectAllWorkoutExercises = () => {
        setSelectedWorkoutExercises(new Set());
    };

    const handleSaveWorkout = () => {
        if (!workoutName.trim() || selectedWorkoutExercises.size === 0) return;

        // Get selected exercises in their original order
        const selectedPlanExercises = planExercises.filter((ex) => 
            selectedWorkoutExercises.has(ex._id)
        );

        if (editingWorkout) {
            // Update existing workout
            updateWorkoutMutation.mutate(
                {
                    workoutId: editingWorkout._id,
                    name: workoutName.trim(),
                    exercises: selectedPlanExercises.map((ex) => ({
                        exerciseDefId: ex.exerciseDefId,
                        sets: ex.sets,
                        reps: ex.reps,
                        weight: ex.weight,
                        durationSeconds: ex.durationSeconds,
                    })),
                },
                {
                    onSuccess: () => {
                        setWorkoutDialogOpen(false);
                        setEditingWorkout(null);
                        setWorkoutName('');
                        setSelectedWorkoutExercises(new Set());
                        toast.success('Workout updated');
                    },
                    onError: (err) => {
                        toast.error(`Failed to update workout: ${err.message}`);
                    },
                }
            );
        } else {
            // Create new workout
            createWorkoutMutation.mutate(
                {
                    name: workoutName.trim(),
                    exercises: selectedPlanExercises.map((ex) => ({
                        exerciseDefId: ex.exerciseDefId,
                        sets: ex.sets,
                        reps: ex.reps,
                        weight: ex.weight,
                        durationSeconds: ex.durationSeconds,
                    })),
                },
                {
                    onSuccess: () => {
                        setWorkoutDialogOpen(false);
                        setWorkoutName('');
                        setSelectedWorkoutExercises(new Set());
                        toast.success('Workout created');
                    },
                    onError: (err) => {
                        toast.error(`Failed to create workout: ${err.message}`);
                    },
                }
            );
        }
    };

    const handleDeleteWorkoutClick = (workout: SavedWorkoutWithExercises) => {
        setWorkoutToDelete(workout);
        setDeleteWorkoutDialogOpen(true);
    };

    const confirmDeleteWorkout = () => {
        if (!workoutToDelete) return;

        deleteWorkoutMutation.mutate(
            { workoutId: workoutToDelete._id },
            {
                onSuccess: () => {
                    setDeleteWorkoutDialogOpen(false);
                    setWorkoutToDelete(null);
                    toast.success('Workout deleted');
                },
                onError: (err) => {
                    toast.error(`Failed to delete: ${err.message}`);
                },
            }
        );
    };

    const handleDuplicateWorkout = (workout: SavedWorkoutWithExercises) => {
        createWorkoutMutation.mutate(
            {
                name: `${workout.name} (Copy)`,
                exercises: workout.exercises.map((ex) => ({
                    exerciseDefId: ex.exerciseDefId,
                    sets: ex.sets,
                    reps: ex.reps,
                    weight: ex.weight,
                    durationSeconds: ex.durationSeconds,
                })),
            },
            {
                onSuccess: () => {
                    toast.success('Workout duplicated');
                },
            }
        );
    };

    const isLoading = planLoading || exercisesLoading;

    // Loading state
    if (isLoading && !plan) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-6 w-48" />
                </div>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-xl">
                        <CardContent className="p-3 flex items-center gap-3">
                            <Skeleton className="h-16 w-16 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="p-4 pb-20">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/training-plans')}
                    className="mb-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Card className="rounded-2xl border-destructive bg-destructive/10 p-4">
                    <p className="text-destructive">Plan not found</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Success toast - shown at page level */}
            {addSuccessMessage && (
                <div className="fixed top-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    <Check className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{addSuccessMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/training-plans')}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold">{plan.name}</h1>
                    <p className="text-sm text-muted-foreground">{plan.durationWeeks} weeks</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'exercises' | 'workouts')} className="w-full">
                <TabsList className="w-full bg-muted p-1 rounded-xl">
                    <TabsTrigger value="exercises" className="flex-1 rounded-lg text-sm font-medium">
                        <Dumbbell className="h-4 w-4 mr-2" />
                        Exercises
                    </TabsTrigger>
                    <TabsTrigger value="workouts" className="flex-1 rounded-lg text-sm font-medium">
                        <Bookmark className="h-4 w-4 mr-2" />
                        Workouts
                    </TabsTrigger>
                </TabsList>

                {/* Exercises Tab */}
                <TabsContent value="exercises" className="mt-4 space-y-4">
                    {/* Add/Reorder buttons for exercises */}
                    <div className="flex gap-2 justify-end">
                        {planExercises.length > 1 && (
                            <Button
                                variant={isReorderMode ? 'secondary' : 'outline'}
                                size="icon"
                                onClick={() => setIsReorderMode(!isReorderMode)}
                                className="rounded-xl h-10 w-10"
                            >
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        )}
                        <Button onClick={() => setAddSheetOpen(true)} className="rounded-xl">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Exercise
                        </Button>
                    </div>

                    {/* Exercise list */}
            {planExercises.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No exercises yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Add exercises from the library to build your plan
                        </p>
                        <Button onClick={() => setAddSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Exercise
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {planExercises.map((exercise, index) => (
                        <Card
                            key={exercise._id}
                            className="rounded-xl border-0 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                    {/* Reorder buttons - only show in reorder mode */}
                                    {isReorderMode && (
                                        <div className="flex flex-col gap-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleMoveExercise(index, 'up')}
                                                disabled={index === 0 || reorderMutation.isPending}
                                                className="h-7 w-7 rounded-md"
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleMoveExercise(index, 'down')}
                                                disabled={index === planExercises.length - 1 || reorderMutation.isPending}
                                                className="h-7 w-7 rounded-md"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                                        {exercise.exerciseDef.imageUrl ? (
                                            <Image
                                                src={exercise.exerciseDef.imageUrl}
                                                alt={exercise.exerciseDef.name}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate">
                                            {exercise.exerciseDef.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {exercise.sets} sets × {exercise.reps} reps
                                            {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className="mt-1 text-xs bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                                        >
                                            {exercise.exerciseDef.primaryMuscle}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditExercise(exercise)}
                                            className="h-9 w-9 rounded-full"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteExercise(exercise)}
                                            className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    </div>
                )}
                </TabsContent>

                {/* Workouts Tab */}
                <TabsContent value="workouts" className="mt-4 space-y-4">
                    {/* Create workout button */}
                    <div className="flex gap-2 justify-end">
                        <Button
                            onClick={() => handleOpenWorkoutDialog()}
                            disabled={planExercises.length === 0}
                            className="rounded-xl"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Workout
                        </Button>
                    </div>

                    {/* Workouts list */}
                    {savedWorkouts.length === 0 ? (
                        <Card className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No saved workouts</h3>
                                <p className="text-sm text-muted-foreground mb-4 text-center">
                                    Create a workout from your plan exercises
                                </p>
                                <Button
                                    onClick={() => handleOpenWorkoutDialog()}
                                    disabled={planExercises.length === 0}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Workout
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {savedWorkouts.map((workout) => {
                                const isExpanded = expandedWorkoutId === workout._id;
                                return (
                                    <Card
                                        key={workout._id}
                                        className="rounded-xl border-0 shadow-sm overflow-hidden"
                                    >
                                        <CardContent className="p-0">
                                            {/* Header - clickable to expand */}
                                            <div
                                                className="p-4 cursor-pointer active:bg-muted/50 transition-colors"
                                                onClick={() => setExpandedWorkoutId(isExpanded ? null : workout._id)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold truncate">{workout.name}</h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenWorkoutDialog(workout)}
                                                            className="h-8 w-8 rounded-full"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDuplicateWorkout(workout)}
                                                            disabled={createWorkoutMutation.isPending}
                                                            className="h-8 w-8 rounded-full"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteWorkoutClick(workout)}
                                                            className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expandable exercise list */}
                                            {isExpanded && (
                                                <div className="border-t bg-muted/30">
                                                    {workout.exercises.map((ex, index) => (
                                                        <div
                                                            key={ex.exerciseDefId}
                                                            className={`flex items-center gap-3 p-3 ${index !== workout.exercises.length - 1 ? 'border-b border-border/50' : ''}`}
                                                        >
                                                            <div className="w-12 h-12 rounded-lg bg-background overflow-hidden flex-shrink-0 relative">
                                                                {ex.exerciseDef.imageUrl ? (
                                                                    <Image
                                                                        src={ex.exerciseDef.imageUrl}
                                                                        alt={ex.exerciseDef.name}
                                                                        fill
                                                                        className="object-contain"
                                                                        unoptimized
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-sm truncate">
                                                                    {ex.exerciseDef.name}
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {ex.sets} sets × {ex.reps} reps
                                                                    {ex.weight > 0 && ` • ${ex.weight}kg`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Add Exercise Dialog */}
            <Dialog open={addSheetOpen} onOpenChange={setAddSheetOpen}>
                <DialogContent className="w-[calc(100%-32px)] max-w-lg h-[calc(100vh-48px)] max-h-[calc(100vh-48px)] rounded-2xl p-0 gap-0 flex flex-col">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="text-lg font-semibold">
                            {selectedExercise ? 'Configure Exercise' : 'Add Exercise'}
                        </DialogTitle>
                    </div>

                    {selectedExercise ? (
                        /* Exercise configuration */
                        <div className="flex-1 overflow-y-auto px-5 py-5">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
                                        {selectedExercise.imageUrl ? (
                                            <Image
                                                src={selectedExercise.imageUrl}
                                                alt={selectedExercise.name}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{selectedExercise.name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedExercise.primaryMuscle} • {selectedExercise.type}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>Sets</Label>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setConfigSets((s) => Math.max(1, s - 1))}
                                                className="h-11 w-11 rounded-lg"
                                            >
                                                -
                                            </Button>
                                            <span className="w-12 text-center font-semibold text-xl">
                                                {configSets}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setConfigSets((s) => Math.min(10, s + 1))}
                                                className="h-11 w-11 rounded-lg"
                                            >
                                                +
                                            </Button>
                                        </div>
                                    </div>

                                    {!selectedExercise.isStatic && (
                                        <div className="grid gap-2">
                                            <Label>Reps</Label>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setConfigReps((r) => Math.max(1, r - 1))}
                                                    className="h-11 w-11 rounded-lg"
                                                >
                                                    -
                                                </Button>
                                                <span className="w-12 text-center font-semibold text-xl">
                                                    {configReps}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setConfigReps((r) => Math.min(50, r + 1))}
                                                    className="h-11 w-11 rounded-lg"
                                                >
                                                    +
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {!selectedExercise.isBodyweight && (
                                        <div className="grid gap-2">
                                            <Label>Weight (kg)</Label>
                                            <Input
                                                type="number"
                                                value={configWeight}
                                                onChange={(e) => setConfigWeight(Number(e.target.value))}
                                                className="rounded-lg"
                                            />
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label>Notes (optional)</Label>
                                        <Textarea
                                            value={configComments}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfigComments(e.target.value)}
                                            placeholder="Add any notes or reminders..."
                                            className="rounded-lg resize-none"
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Exercise library browser */
                        <div className="flex-1 overflow-hidden flex flex-col px-5 py-4">
                            {/* Create Custom Exercise - Prominent */}
                            <button
                                onClick={() => setCreateExerciseOpen(true)}
                                className="w-full mb-4 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-3 group"
                            >
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold text-foreground">Create Custom Exercise</p>
                                    <p className="text-sm text-muted-foreground">Add your own exercise to the library</p>
                                </div>
                            </button>

                            {/* Search and Filter Row */}
                            <div className="flex gap-2 mb-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search exercises..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 rounded-xl h-10"
                                    />
                                </div>
                                <Button
                                    variant={showFilters || hasActiveFilters ? 'secondary' : 'outline'}
                                    size="icon"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="rounded-xl h-10 w-10 shrink-0 relative"
                                >
                                    <Filter className="h-4 w-4" />
                                    {hasActiveFilters && (
                                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                                    )}
                                </Button>
                            </div>

                            {/* Filters Panel */}
                            {showFilters && (
                                <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b">
                                    <Select value={filterSource} onValueChange={(v) => setFilterSource(v as 'all' | 'system' | 'custom')}>
                                        <SelectTrigger className="w-[100px] rounded-xl h-9">
                                            <SelectValue placeholder="Source" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="system">Library</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterMuscle} onValueChange={setFilterMuscle}>
                                        <SelectTrigger className="w-[120px] rounded-xl h-9">
                                            <SelectValue placeholder="Muscle" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Muscles</SelectItem>
                                            {uniqueMuscles.map((muscle) => (
                                                <SelectItem key={muscle} value={muscle}>
                                                    {muscle}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="w-[120px] rounded-xl h-9">
                                            <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            {uniqueTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {(filterMuscle !== 'all' || filterType !== 'all' || filterSource !== 'all') && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setFilterMuscle('all'); setFilterType('all'); setFilterSource('all'); }}
                                            className="rounded-xl text-muted-foreground h-9"
                                        >
                                            <X className="h-3 w-3 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Multi-select toggle */}
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-muted-foreground">
                                    {sortedFilteredLibrary.length} exercise{sortedFilteredLibrary.length !== 1 ? 's' : ''}
                                </p>
                                <button
                                    onClick={() => {
                                        setIsMultiSelectMode(!isMultiSelectMode);
                                        if (isMultiSelectMode) {
                                            setSelectedExercises(new Map());
                                            setShowMultiConfig(false);
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        isMultiSelectMode 
                                            ? 'bg-primary text-primary-foreground' 
                                            : 'bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <ListChecks className="h-4 w-4" />
                                    Multi-select
                                </button>
                            </div>

                            {/* Exercise List */}
                            <div className="flex-1 overflow-y-auto -mx-5 px-5">
                                {libraryLoading ? (
                                    <div className="divide-y divide-border">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="flex items-center gap-4 py-3">
                                                <Skeleton className="h-14 w-14 rounded-lg" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : sortedFilteredLibrary.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {searchQuery || hasActiveFilters
                                            ? 'No exercises match your filters'
                                            : 'No exercises found'}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {sortedFilteredLibrary.map((exercise) => {
                                            const isInPlan = addedExerciseIds.has(exercise._id);
                                            const isSelected = selectedExercises.has(exercise._id);
                                            return (
                                            <div
                                                key={exercise._id}
                                                className={`flex items-center gap-4 py-3.5 transition-all ${
                                                    isInPlan ? 'bg-muted/30' : isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                                                }`}
                                            >
                                                <button
                                                    onClick={() => {
                                                        if (isInPlan) return;
                                                        if (isMultiSelectMode) {
                                                            handleToggleMultiSelect(exercise);
                                                        } else {
                                                            handleSelectExercise(exercise);
                                                        }
                                                    }}
                                                    disabled={isInPlan}
                                                    className={`flex items-center gap-4 flex-1 min-w-0 text-left transition-transform ${
                                                        isInPlan ? 'opacity-60 cursor-default' : 'active:scale-[0.99]'
                                                    }`}
                                                >
                                                    <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                                                        {exercise.imageUrl ? (
                                                            <Image
                                                                src={exercise.imageUrl}
                                                                alt={exercise.name}
                                                                fill
                                                                className="object-contain"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        {isInPlan && (
                                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                <Check className="h-6 w-6 text-primary" />
                                                            </div>
                                                        )}
                                                        {isSelected && !isInPlan && (
                                                            <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                                                <Check className="h-6 w-6 text-primary" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-[15px] truncate">{exercise.name}</p>
                                                            {isInPlan && (
                                                                <Badge variant="outline" className="text-xs shrink-0 text-primary border-primary/50">
                                                                    In Plan
                                                                </Badge>
                                                            )}
                                                            {isSelected && !isInPlan && (
                                                                <Badge className="text-xs shrink-0">
                                                                    Selected
                                                                </Badge>
                                                            )}
                                                            {!exercise.isSystem && (
                                                                <Badge variant="secondary" className="text-xs shrink-0">
                                                                    Custom
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mt-0.5">
                                                            {exercise.primaryMuscle} • {exercise.type}
                                                        </p>
                                                    </div>
                                                </button>
                                                {/* Edit/Delete buttons for custom exercises */}
                                                {!exercise.isSystem && (
                                                    <div className="flex gap-1 shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditExerciseDef(exercise);
                                                            }}
                                                            className="h-8 w-8 rounded-full"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteExerciseDefClick(exercise);
                                                            }}
                                                            className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Multi-select action bar */}
                            {isMultiSelectMode && selectedExercises.size > 0 && (
                                <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t">
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleCancelMultiSelect}
                                            className="flex-1 h-12 rounded-xl"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => setShowMultiConfig(true)}
                                            className="flex-1 h-12 rounded-xl"
                                        >
                                            Configure {selectedExercises.size} Exercise{selectedExercises.size > 1 ? 's' : ''}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer for Configure Exercise */}
                    {selectedExercise && (
                        <div className="shrink-0 border-t px-5 py-4 flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedExercise(null)}
                                className="flex-1 h-12 rounded-xl"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleAddExercise}
                                disabled={addExerciseMutation.isPending}
                                className="flex-1 h-12 rounded-xl"
                            >
                                {addExerciseMutation.isPending ? 'Adding...' : 'Add to Plan'}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Multi-Configure Dialog - Mobile First */}
            <Dialog open={showMultiConfig} onOpenChange={setShowMultiConfig}>
                <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto w-[calc(100%-32px)] max-w-md mx-auto p-4">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="text-lg">Configure Exercises</DialogTitle>
                        <DialogDescription className="text-sm">
                            Set up {selectedExercises.size} exercise{selectedExercises.size > 1 ? 's' : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {Array.from(selectedExercises.entries()).map(([exerciseId, item]) => (
                            <Card key={exerciseId} className="rounded-xl border-0 bg-muted/50">
                                <CardContent className="p-3 space-y-3">
                                    {/* Exercise header */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-lg bg-background overflow-hidden flex-shrink-0 relative">
                                            {item.exercise.imageUrl ? (
                                                <Image
                                                    src={item.exercise.imageUrl}
                                                    alt={item.exercise.name}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{item.exercise.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.exercise.primaryMuscle}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setNotesDialogExerciseId(exerciseId)}
                                            className={`h-9 w-9 rounded-full ${item.comments ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setSelectedExercises((prev) => {
                                                    const newMap = new Map(prev);
                                                    newMap.delete(exerciseId);
                                                    return newMap;
                                                });
                                                if (selectedExercises.size <= 1) {
                                                    setShowMultiConfig(false);
                                                }
                                            }}
                                            className="h-9 w-9 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Configuration rows - each on its own line */}
                                    <div className="space-y-2">
                                        {/* Sets row */}
                                        <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                            <Label className="text-sm font-medium">Sets</Label>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleUpdateMultiConfig(exerciseId, 'sets', Math.max(1, item.sets - 1))}
                                                    className="h-9 w-9 rounded-lg"
                                                >
                                                    -
                                                </Button>
                                                <span className="w-8 text-center font-semibold text-lg">{item.sets}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleUpdateMultiConfig(exerciseId, 'sets', Math.min(10, item.sets + 1))}
                                                    className="h-9 w-9 rounded-lg"
                                                >
                                                    +
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Reps row */}
                                        {!item.exercise.isStatic && (
                                            <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                                <Label className="text-sm font-medium">Reps</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleUpdateMultiConfig(exerciseId, 'reps', Math.max(1, item.reps - 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        -
                                                    </Button>
                                                    <span className="w-8 text-center font-semibold text-lg">{item.reps}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleUpdateMultiConfig(exerciseId, 'reps', Math.min(50, item.reps + 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Weight row */}
                                        {!item.exercise.isBodyweight && (
                                            <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                                <Label className="text-sm font-medium">Weight (kg)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleUpdateMultiConfig(exerciseId, 'weight', Math.max(0, item.weight - 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={item.weight}
                                                        onChange={(e) => handleUpdateMultiConfig(exerciseId, 'weight', Number(e.target.value))}
                                                        className="w-20 h-9 rounded-lg text-center font-semibold"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleUpdateMultiConfig(exerciseId, 'weight', item.weight + 1)}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            onClick={handleAddAllExercises}
                            disabled={bulkAddMutation.isPending || selectedExercises.size === 0}
                            className="w-full h-12 rounded-xl text-base font-semibold"
                        >
                            {bulkAddMutation.isPending ? 'Adding...' : `Add ${selectedExercises.size} to Plan`}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowMultiConfig(false)}
                            className="w-full h-11 rounded-xl"
                        >
                            Back
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Notes Dialog for Multi-Select */}
            <Dialog open={!!notesDialogExerciseId} onOpenChange={(open) => !open && setNotesDialogExerciseId(null)}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Notes</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={notesDialogExerciseId ? selectedExercises.get(notesDialogExerciseId)?.comments || '' : ''}
                        onChange={(e) => {
                            if (notesDialogExerciseId) {
                                handleUpdateMultiConfig(notesDialogExerciseId, 'comments', e.target.value);
                            }
                        }}
                        placeholder="Add any notes or reminders..."
                        className="rounded-lg resize-none"
                        rows={4}
                    />
                    <DialogFooter>
                        <Button onClick={() => setNotesDialogExerciseId(null)} className="rounded-xl">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Exercise Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="rounded-3xl p-0 gap-0 border-0 shadow-2xl overflow-hidden max-w-sm">
                    {exerciseToEdit && (
                        <>
                            {/* Header with exercise info */}
                            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-background shadow-md overflow-hidden flex-shrink-0 relative border border-border/50">
                                        {exerciseToEdit.exerciseDef.imageUrl ? (
                                            <Image
                                                src={exerciseToEdit.exerciseDef.imageUrl}
                                                alt={exerciseToEdit.exerciseDef.name}
                                                fill
                                                className="object-contain p-1"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Dumbbell className="h-7 w-7 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-bold truncate">{exerciseToEdit.exerciseDef.name}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {exerciseToEdit.exerciseDef.primaryMuscle}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Configuration controls */}
                            <div className="p-6 pt-4 space-y-5">
                                {/* Sets & Reps in a row */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Sets */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Sets
                                        </label>
                                        <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setConfigSets((s) => Math.max(1, s - 1))}
                                                className="h-10 w-10 rounded-lg hover:bg-background"
                                            >
                                                <span className="text-lg font-medium">−</span>
                                            </Button>
                                            <span className="text-2xl font-bold tabular-nums">
                                                {configSets}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setConfigSets((s) => Math.min(10, s + 1))}
                                                className="h-10 w-10 rounded-lg hover:bg-background"
                                            >
                                                <span className="text-lg font-medium">+</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Reps */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Reps
                                        </label>
                                        <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setConfigReps((r) => Math.max(1, r - 1))}
                                                className="h-10 w-10 rounded-lg hover:bg-background"
                                            >
                                                <span className="text-lg font-medium">−</span>
                                            </Button>
                                            <span className="text-2xl font-bold tabular-nums">
                                                {configReps}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setConfigReps((r) => Math.min(50, r + 1))}
                                                className="h-10 w-10 rounded-lg hover:bg-background"
                                            >
                                                <span className="text-lg font-medium">+</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Weight */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Weight
                                    </label>
                                    <div className="flex items-center bg-muted/50 rounded-xl p-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setConfigWeight((w) => Math.max(0, w - 2.5))}
                                            className="h-10 w-10 rounded-lg hover:bg-background"
                                        >
                                            <span className="text-lg font-medium">−</span>
                                        </Button>
                                        <div className="flex-1 text-center">
                                            <Input
                                                type="number"
                                                value={configWeight}
                                                onChange={(e) => setConfigWeight(Number(e.target.value))}
                                                className="h-10 text-center text-2xl font-bold border-0 bg-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setConfigWeight((w) => w + 2.5)}
                                            className="h-10 w-10 rounded-lg hover:bg-background"
                                        >
                                            <span className="text-lg font-medium">+</span>
                                        </Button>
                                        <span className="pr-3 text-sm font-medium text-muted-foreground">kg</span>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Notes
                                    </label>
                                    <Textarea
                                        value={configComments}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfigComments(e.target.value)}
                                        placeholder="Add notes or reminders..."
                                        className="rounded-xl resize-none bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[80px]"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 pt-0 flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditDialogOpen(false)}
                                    className="flex-1 h-12 rounded-xl font-semibold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveEdit}
                                    disabled={updateExerciseMutation.isPending}
                                    className="flex-1 h-12 rounded-xl font-semibold"
                                >
                                    {updateExerciseMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Remove Exercise?</DialogTitle>
                        <DialogDescription>
                            This will remove &quot;{exerciseToDelete?.exerciseDef.name}&quot; from
                            your plan and delete all progress data for this exercise.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteExerciseMutation.isPending}
                            className="rounded-lg"
                        >
                            {deleteExerciseMutation.isPending ? 'Removing...' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Custom Exercise Dialog */}
            <CreateExerciseDialog
                open={createExerciseOpen}
                onOpenChange={setCreateExerciseOpen}
                onSubmit={handleCreateCustomExercise}
                isPending={createExerciseMutation.isPending}
            />

            {/* Edit Custom Exercise Dialog */}
            <CreateExerciseDialog
                open={editExerciseDefOpen}
                onOpenChange={setEditExerciseDefOpen}
                onSubmit={handleUpdateExerciseDef}
                isPending={updateExerciseDefMutation.isPending}
                editMode
                initialData={exerciseDefToEdit ? {
                    name: exerciseDefToEdit.name,
                    imageUrl: exerciseDefToEdit.imageUrl,
                    primaryMuscle: exerciseDefToEdit.primaryMuscle,
                    secondaryMuscles: exerciseDefToEdit.secondaryMuscles,
                    type: exerciseDefToEdit.type,
                    isBodyweight: exerciseDefToEdit.isBodyweight,
                    isStatic: exerciseDefToEdit.isStatic,
                } : undefined}
            />

            {/* Delete Custom Exercise Confirmation Dialog */}
            <Dialog open={deleteExerciseDefDialogOpen} onOpenChange={setDeleteExerciseDefDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Delete Custom Exercise?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;{exerciseDefToDelete?.name}&quot;.
                            This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteExerciseDefDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteExerciseDef}
                            disabled={deleteExerciseDefMutation.isPending}
                            className="rounded-lg"
                        >
                            {deleteExerciseDefMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== Saved Workouts Dialogs ==================== */}

            {/* Create/Edit Workout Dialog */}
            <Dialog open={workoutDialogOpen} onOpenChange={setWorkoutDialogOpen}>
                <DialogContent className="rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-0 shadow-2xl">
                    {/* Header */}
                    <div className="p-6 pb-4">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">
                                {editingWorkout ? 'Edit Workout' : 'New Workout'}
                            </DialogTitle>
                        </DialogHeader>
                        
                        {/* Workout Name Input */}
                        <div className="mt-4">
                            <Input
                                id="workout-name"
                                value={workoutName}
                                onChange={(e) => setWorkoutName(e.target.value)}
                                placeholder="Workout name..."
                                className="h-12 rounded-xl border-2 border-muted text-base font-medium placeholder:text-muted-foreground/50 focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    {/* Exercise Selection Section */}
                    <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
                        {/* Selection Header */}
                        <div className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-sm sticky top-0">
                            <span className="text-sm font-medium">
                                {selectedWorkoutExercises.size === 0 
                                    ? 'Select exercises' 
                                    : `${selectedWorkoutExercises.size} selected`}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAllWorkoutExercises}
                                    className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 hover:text-primary"
                                >
                                    All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeselectAllWorkoutExercises}
                                    className="text-xs h-8 px-3 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                >
                                    None
                                </Button>
                            </div>
                        </div>

                        {/* Exercise List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                            {planExercises.map((exercise) => {
                                const isSelected = selectedWorkoutExercises.has(exercise._id);
                                return (
                                    <div
                                        key={exercise._id}
                                        onClick={() => handleToggleWorkoutExercise(exercise._id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                                            isSelected 
                                                ? 'bg-primary/10 ring-1 ring-primary/30' 
                                                : 'bg-background hover:bg-background/80'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                            isSelected 
                                                ? 'bg-primary border-primary scale-110' 
                                                : 'border-muted-foreground/20 bg-background'
                                        }`}>
                                            {isSelected && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
                                        </div>
                                        
                                        {/* Exercise image */}
                                        <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative border border-border/50">
                                            {exercise.exerciseDef.imageUrl ? (
                                                <Image
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt={exercise.exerciseDef.name}
                                                    fill
                                                    className="object-contain p-1"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Exercise info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                                                {exercise.exerciseDef.name}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {exercise.sets} × {exercise.reps}
                                                {exercise.weight > 0 && ` · ${exercise.weight}kg`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-background">
                        <Button
                            onClick={handleSaveWorkout}
                            disabled={!workoutName.trim() || selectedWorkoutExercises.size === 0 || createWorkoutMutation.isPending || updateWorkoutMutation.isPending}
                            className="w-full h-12 rounded-xl font-semibold text-base"
                        >
                            {(createWorkoutMutation.isPending || updateWorkoutMutation.isPending)
                                ? 'Saving...' 
                                : selectedWorkoutExercises.size === 0 
                                    ? 'Select exercises'
                                    : editingWorkout
                                        ? `Save Changes (${selectedWorkoutExercises.size})`
                                        : `Create Workout (${selectedWorkoutExercises.size})`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Workout Dialog */}
            <Dialog open={deleteWorkoutDialogOpen} onOpenChange={setDeleteWorkoutDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Delete Workout?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;{workoutToDelete?.name}&quot;. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteWorkoutDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteWorkout}
                            disabled={deleteWorkoutMutation.isPending}
                            className="rounded-lg"
                        >
                            {deleteWorkoutMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}


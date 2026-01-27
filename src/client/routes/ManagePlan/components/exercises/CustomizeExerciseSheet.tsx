/**
 * Customize Exercise Sheet
 * 
 * Full-screen sheet for customizing exercise definition overrides.
 * Allows users to override name, image, muscles, type, and flags.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Checkbox } from '@/client/components/ui/checkbox';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/client/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import { Dumbbell, Upload, X, Clipboard, RotateCcw } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { ExerciseOverrides } from '@/client/features/plan-data/types';
import { ModifiedFieldIndicator } from './ModifiedFieldIndicator';
import {
    getEffectiveExerciseValues,
    isFieldOverridden,
    removeOverrideField,
    createOverridesFromChanges,
} from '../../utils/exerciseOverrides';

// Common muscle groups (same as CreateExerciseDialog)
const MUSCLE_GROUPS = [
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Forearms',
    'Core',
    'Abs',
    'Quadriceps',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Full Body',
    'Cardio',
];

// Exercise types
const EXERCISE_TYPES = ['Strength', 'Cardio', 'Flexibility', 'Balance', 'Plyometric'];

interface CustomizeExerciseSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Original exercise definition */
    exerciseDef: ExerciseDefinitionClient;
    /** Current overrides (if any) */
    currentOverrides?: ExerciseOverrides;
    /** Callback when user saves customizations */
    onSave: (overrides: ExerciseOverrides | undefined) => void;
    isPending?: boolean;
}

export function CustomizeExerciseSheet({
    open,
    onOpenChange,
    exerciseDef,
    currentOverrides,
    onSave,
    isPending = false,
}: CustomizeExerciseSheetProps) {
    // Get effective values (original merged with current overrides)
    const effective = getEffectiveExerciseValues(exerciseDef, currentOverrides);

    // Form state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [name, setName] = useState(effective.name);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [primaryMuscle, setPrimaryMuscle] = useState(effective.primaryMuscle);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(effective.secondaryMuscles);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [type, setType] = useState(effective.type);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [isBodyweight, setIsBodyweight] = useState(effective.isBodyweight);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [isStatic, setIsStatic] = useState(effective.isStatic);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [imagePreview, setImagePreview] = useState<string>(effective.imageUrl);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [showResetDialog, setShowResetDialog] = useState(false);

    // Track which fields have been modified in this session
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [localOverrides, setLocalOverrides] = useState<ExerciseOverrides | undefined>(currentOverrides);

    // Reset form when sheet opens
    useEffect(() => {
        if (open) {
            const eff = getEffectiveExerciseValues(exerciseDef, currentOverrides);
            setName(eff.name);
            setPrimaryMuscle(eff.primaryMuscle);
            setSecondaryMuscles(eff.secondaryMuscles);
            setType(eff.type);
            setIsBodyweight(eff.isBodyweight);
            setIsStatic(eff.isStatic);
            setImageBase64(undefined);
            setImagePreview(eff.imageUrl);
            setLocalOverrides(currentOverrides);
        }
    }, [open, exerciseDef, currentOverrides]);

    const processImageFile = useCallback((file: File) => {
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setImageBase64(base64);
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processImageFile(file);
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    processImageFile(file);
                }
                break;
            }
        }
    }, [processImageFile]);

    // Listen for paste events when sheet is open
    useEffect(() => {
        if (open) {
            document.addEventListener('paste', handlePaste);
            return () => document.removeEventListener('paste', handlePaste);
        }
    }, [open, handlePaste]);

    const removeImage = () => {
        setImageBase64(undefined);
        setImagePreview('');
    };

    const handleSecondaryMuscleToggle = (muscle: string) => {
        if (muscle === primaryMuscle) return;
        setSecondaryMuscles((prev) =>
            prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
        );
    };

    const handleResetField = (field: keyof ExerciseOverrides) => {
        const newOverrides = removeOverrideField(localOverrides, field);
        setLocalOverrides(newOverrides);

        // Reset the form field to original value
        switch (field) {
            case 'name':
                setName(exerciseDef.name);
                break;
            case 'imageUrl':
                setImagePreview(exerciseDef.imageUrl);
                setImageBase64(undefined);
                break;
            case 'primaryMuscle':
                setPrimaryMuscle(exerciseDef.primaryMuscle);
                break;
            case 'secondaryMuscles':
                setSecondaryMuscles(exerciseDef.secondaryMuscles);
                break;
            case 'type':
                setType(exerciseDef.type);
                break;
            case 'isBodyweight':
                setIsBodyweight(exerciseDef.isBodyweight);
                break;
            case 'isStatic':
                setIsStatic(exerciseDef.isStatic);
                break;
        }
    };

    const handleResetAll = () => {
        setName(exerciseDef.name);
        setPrimaryMuscle(exerciseDef.primaryMuscle);
        setSecondaryMuscles(exerciseDef.secondaryMuscles);
        setType(exerciseDef.type);
        setIsBodyweight(exerciseDef.isBodyweight);
        setIsStatic(exerciseDef.isStatic);
        setImageBase64(undefined);
        setImagePreview(exerciseDef.imageUrl);
        setLocalOverrides(undefined);
        setShowResetDialog(false);
    };

    const handleSave = () => {
        // Determine the final image URL
        const finalImageUrl = imageBase64 || imagePreview;

        // Create overrides from current form values
        const overrides = createOverridesFromChanges(exerciseDef, {
            name,
            imageUrl: finalImageUrl,
            primaryMuscle,
            secondaryMuscles: secondaryMuscles.filter((m) => m !== primaryMuscle),
            type,
            isBodyweight,
            isStatic,
        });

        onSave(overrides);
    };

    const hasAnyOverrides = localOverrides && Object.keys(localOverrides).length > 0;

    // Check if current form values differ from original
    const currentOverridesFromForm = createOverridesFromChanges(exerciseDef, {
        name,
        imageUrl: imageBase64 || imagePreview,
        primaryMuscle,
        secondaryMuscles: secondaryMuscles.filter((m) => m !== primaryMuscle),
        type,
        isBodyweight,
        isStatic,
    });
    const hasFormChanges = currentOverridesFromForm && Object.keys(currentOverridesFromForm).length > 0;

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
                    <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
                        <SheetTitle className="text-left">Customize Exercise</SheetTitle>
                        <p className="text-sm text-muted-foreground text-left">
                            Customizing: {exerciseDef.name}
                        </p>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        <div className="space-y-5">
                            {/* Exercise Name */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="exercise-name">Name</Label>
                                    {isFieldOverridden(currentOverridesFromForm, 'name') && (
                                        <ModifiedFieldIndicator
                                            originalValue={exerciseDef.name}
                                            onReset={() => handleResetField('name')}
                                        />
                                    )}
                                </div>
                                <Input
                                    id="exercise-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Exercise name"
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label>Image</Label>
                                    {isFieldOverridden(currentOverridesFromForm, 'imageUrl') && (
                                        <ModifiedFieldIndicator
                                            originalValue={exerciseDef.imageUrl ? 'Original image' : '(no image)'}
                                            onReset={() => handleResetField('imageUrl')}
                                        />
                                    )}
                                </div>
                                {imagePreview ? (
                                    <div className="relative w-full h-36 rounded-lg bg-muted overflow-hidden">
                                        <img
                                            src={imagePreview}
                                            alt="Exercise preview"
                                            className="w-full h-full object-contain"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={removeImage}
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="flex items-center gap-3 mb-1">
                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-muted-foreground/50">or</span>
                                                <Clipboard className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Click to upload or paste image
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Primary Muscle */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label>Primary Muscle</Label>
                                    {isFieldOverridden(currentOverridesFromForm, 'primaryMuscle') && (
                                        <ModifiedFieldIndicator
                                            originalValue={exerciseDef.primaryMuscle}
                                            onReset={() => handleResetField('primaryMuscle')}
                                        />
                                    )}
                                </div>
                                <Select value={primaryMuscle} onValueChange={setPrimaryMuscle}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select primary muscle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MUSCLE_GROUPS.map((muscle) => (
                                            <SelectItem key={muscle} value={muscle}>
                                                {muscle}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Secondary Muscles */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label>Secondary Muscles</Label>
                                    {isFieldOverridden(currentOverridesFromForm, 'secondaryMuscles') && (
                                        <ModifiedFieldIndicator
                                            originalValue={exerciseDef.secondaryMuscles.join(', ') || '(none)'}
                                            onReset={() => handleResetField('secondaryMuscles')}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {MUSCLE_GROUPS.filter((m) => m !== primaryMuscle).map((muscle) => (
                                        <Button
                                            key={muscle}
                                            variant={secondaryMuscles.includes(muscle) ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handleSecondaryMuscleToggle(muscle)}
                                            className="rounded-full text-xs"
                                        >
                                            {muscle}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Exercise Type */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label>Exercise Type</Label>
                                    {isFieldOverridden(currentOverridesFromForm, 'type') && (
                                        <ModifiedFieldIndicator
                                            originalValue={exerciseDef.type}
                                            onReset={() => handleResetField('type')}
                                        />
                                    )}
                                </div>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EXERCISE_TYPES.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Checkboxes */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="bodyweight"
                                        checked={isBodyweight}
                                        onCheckedChange={(checked) => setIsBodyweight(checked === true)}
                                    />
                                    <Label htmlFor="bodyweight" className="text-sm font-normal cursor-pointer flex items-center">
                                        Bodyweight exercise
                                        {isFieldOverridden(currentOverridesFromForm, 'isBodyweight') && (
                                            <ModifiedFieldIndicator
                                                originalValue={exerciseDef.isBodyweight ? 'Yes' : 'No'}
                                                onReset={() => handleResetField('isBodyweight')}
                                            />
                                        )}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="static"
                                        checked={isStatic}
                                        onCheckedChange={(checked) => setIsStatic(checked === true)}
                                    />
                                    <Label htmlFor="static" className="text-sm font-normal cursor-pointer flex items-center">
                                        Static/Timed exercise
                                        {isFieldOverridden(currentOverridesFromForm, 'isStatic') && (
                                            <ModifiedFieldIndicator
                                                originalValue={exerciseDef.isStatic ? 'Yes' : 'No'}
                                                onReset={() => handleResetField('isStatic')}
                                            />
                                        )}
                                    </Label>
                                </div>
                            </div>

                            {/* Reset All Button */}
                            {(hasAnyOverrides || hasFormChanges) && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowResetDialog(true)}
                                    className="w-full"
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Reset All to Defaults
                                </Button>
                            )}
                        </div>
                    </div>

                    <SheetFooter className="px-5 py-4 border-t shrink-0 flex-row gap-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isPending || !name.trim() || !primaryMuscle}
                            className="flex-1 h-12 rounded-xl"
                        >
                            <Dumbbell className="h-4 w-4 mr-2" />
                            {isPending ? 'Saving...' : 'Save Customizations'}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Reset Confirmation Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset all customizations?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore all fields to the original exercise definition values.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAll}>
                            Reset
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

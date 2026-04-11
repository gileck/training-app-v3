import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import { Checkbox } from '@/client/components/project/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import { Dumbbell, Upload, X, Clipboard, WifiOff } from 'lucide-react';
import { useEffectiveOffline } from '@/client/features/template/settings';

// Common muscle groups
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

/**
 * Prepend any values present in `extras` that are missing from `base`.
 * Used to ensure the Select dropdowns always contain the exercise's
 * currently-stored value, even when that value isn't in the hardcoded
 * default list (e.g. imported system exercises that use `Upper body`
 * or `Thighs` which aren't in the defaults).
 */
function withMissingPrepended(base: readonly string[], extras: readonly string[]): string[] {
    const seen = new Set(base);
    const prepend: string[] = [];
    for (const value of extras) {
        if (value && !seen.has(value)) {
            prepend.push(value);
            seen.add(value);
        }
    }
    return prepend.length > 0 ? [...prepend, ...base] : [...base];
}

interface CreateExerciseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: {
        name: string;
        imageBase64?: string;
        /**
         * Only meaningful in edit/override mode: true when the user
         * explicitly removed an image that was present in initialData
         * and did not replace it with a new upload. Callers that don't
         * support "clear image" (e.g. the createExercise flow) can
         * safely ignore this field.
         */
        imageCleared?: boolean;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }) => void;
    isPending?: boolean;
    // For edit mode
    editMode?: boolean;
    initialData?: {
        name: string;
        imageUrl?: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    };
}

export function CreateExerciseDialog({
    open,
    onOpenChange,
    onSubmit,
    isPending = false,
    editMode = false,
    initialData,
}: CreateExerciseDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [name, setName] = useState(initialData?.name || '');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [primaryMuscle, setPrimaryMuscle] = useState(initialData?.primaryMuscle || '');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(initialData?.secondaryMuscles || []);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [type, setType] = useState(initialData?.type || 'Strength');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [isBodyweight, setIsBodyweight] = useState(initialData?.isBodyweight || false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [isStatic, setIsStatic] = useState(initialData?.isStatic || false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [imagePreview, setImagePreview] = useState<string | undefined>(initialData?.imageUrl);

    // Image upload requires a network round-trip; when offline we hide
    // the picker so base64 payloads never enter the offline sync queue.
    const isOffline = useEffectiveOffline();

    // Dropdown lists get the initial values prepended so pre-existing
    // muscle / type values that aren't in the hardcoded defaults remain
    // selectable (and visible) in edit mode.
    const muscleOptions = withMissingPrepended(
        MUSCLE_GROUPS,
        [
            initialData?.primaryMuscle ?? '',
            ...(initialData?.secondaryMuscles ?? []),
            primaryMuscle,
            ...secondaryMuscles,
        ].filter(Boolean)
    );
    const typeOptions = withMissingPrepended(
        EXERCISE_TYPES,
        [initialData?.type ?? '', type].filter(Boolean)
    );

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

    // Listen for paste events when dialog is open. Skip while offline so
    // pasting an image doesn't sneak base64 into the offline sync queue.
    useEffect(() => {
        if (open && !isOffline) {
            document.addEventListener('paste', handlePaste);
            return () => document.removeEventListener('paste', handlePaste);
        }
    }, [open, handlePaste, isOffline]);

    // Reset form when the dialog opens. We intentionally depend ONLY on
    // `open` — not on `initialData` — because parents pass inline object
    // literals (`initialData={exerciseToEdit ? { ... } : undefined}`) which
    // produce a new reference on every render. Depending on that reference
    // would cause the effect to re-fire on every parent re-render while
    // the dialog is open and wipe in-progress image uploads and chip
    // toggles. Capturing the initialData at open-transition is correct
    // because the dialog is remounted/closed between edits anyway.
    useEffect(() => {
        if (open) {
            setName(initialData?.name || '');
            setPrimaryMuscle(initialData?.primaryMuscle || '');
            setSecondaryMuscles(initialData?.secondaryMuscles || []);
            setType(initialData?.type || 'Strength');
            setIsBodyweight(initialData?.isBodyweight || false);
            setIsStatic(initialData?.isStatic || false);
            setImageBase64(undefined);
            setImagePreview(initialData?.imageUrl);
        }
    }, [open]);

    const removeImage = () => {
        setImageBase64(undefined);
        setImagePreview(undefined);
    };

    const handleSecondaryMuscleToggle = (muscle: string) => {
        if (muscle === primaryMuscle) return; // Can't select same as primary
        setSecondaryMuscles((prev) =>
            prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
        );
    };

    const handleSubmit = () => {
        if (!name.trim() || !primaryMuscle) return;

        // In edit mode, detect "user removed the existing image" so override
        // callers can distinguish "no image change" from "explicit clear".
        const imageCleared =
            editMode && !!initialData?.imageUrl && !imagePreview && !imageBase64;

        onSubmit({
            name: name.trim(),
            imageBase64,
            imageCleared,
            primaryMuscle,
            secondaryMuscles: secondaryMuscles.filter((m) => m !== primaryMuscle),
            type,
            isBodyweight,
            isStatic,
        });
    };

    const resetForm = () => {
        setName(initialData?.name || '');
        setPrimaryMuscle(initialData?.primaryMuscle || '');
        setSecondaryMuscles(initialData?.secondaryMuscles || []);
        setType(initialData?.type || 'Strength');
        setIsBodyweight(initialData?.isBodyweight || false);
        setIsStatic(initialData?.isStatic || false);
        setImageBase64(undefined);
        setImagePreview(initialData?.imageUrl);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            resetForm();
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editMode ? 'Edit Exercise' : 'Create Custom Exercise'}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Exercise Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="exercise-name">Exercise Name *</Label>
                        <Input
                            id="exercise-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Barbell Bench Press"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="grid gap-2">
                        <Label>Image (optional)</Label>
                        {imagePreview ? (
                            <div className="relative w-full h-40 rounded-lg bg-muted overflow-hidden">
                                <img
                                    src={imagePreview}
                                    alt="Exercise preview"
                                    className="w-full h-full object-contain"
                                />
                                {!isOffline && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 h-8 w-8 rounded-full"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ) : isOffline ? (
                            <div className="flex flex-col items-center justify-center w-full h-36 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30">
                                <WifiOff className="h-6 w-6 text-muted-foreground mb-2" />
                                <span className="text-sm text-muted-foreground">
                                    Connect to change image
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Other fields still work offline
                                </span>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-36 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Upload className="h-7 w-7 text-muted-foreground" />
                                        <span className="text-muted-foreground/50">or</span>
                                        <Clipboard className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        Click to upload or paste image
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        Max 2MB
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
                    <div className="grid gap-2">
                        <Label>Primary Muscle *</Label>
                        <Select value={primaryMuscle} onValueChange={setPrimaryMuscle}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select primary muscle" />
                            </SelectTrigger>
                            <SelectContent>
                                {muscleOptions.map((muscle) => (
                                    <SelectItem key={muscle} value={muscle}>
                                        {muscle}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Secondary Muscles */}
                    <div className="grid gap-2">
                        <Label>Secondary Muscles</Label>
                        <div className="flex flex-wrap gap-2">
                            {muscleOptions.filter((m) => m !== primaryMuscle).map((muscle) => (
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
                    <div className="grid gap-2">
                        <Label>Exercise Type</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {typeOptions.map((t) => (
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
                            <Label htmlFor="bodyweight" className="text-sm font-normal cursor-pointer">
                                Bodyweight exercise (no weight tracking)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="static"
                                checked={isStatic}
                                onCheckedChange={(checked) => setIsStatic(checked === true)}
                            />
                            <Label htmlFor="static" className="text-sm font-normal cursor-pointer">
                                Static/Timed exercise (track duration instead of reps)
                            </Label>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !primaryMuscle || isPending}
                    >
                        <Dumbbell className="h-4 w-4 mr-2" />
                        {isPending ? 'Creating...' : editMode ? 'Save Changes' : 'Create Exercise'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


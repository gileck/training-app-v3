import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/client/components/template/ui/dialog';
import { useThemeStore, useHasAnyCustomColors } from './store';

interface SaveThemeDialogProps {
    /** Optional trigger element. If not provided, uses default button */
    trigger?: React.ReactNode;
}

/**
 * Dialog for saving current customizations as a new custom theme
 */
export function SaveThemeDialog({ trigger }: SaveThemeDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog open state
    const [open, setOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [name, setName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form validation
    const [error, setError] = useState('');
    
    const saveAsCustomTheme = useThemeStore((s) => s.saveAsCustomTheme);
    const hasCustomColors = useHasAnyCustomColors();
    
    const handleSave = () => {
        const trimmedName = name.trim();
        
        if (!trimmedName) {
            setError('Please enter a name for your theme');
            return;
        }
        
        if (trimmedName.length > 30) {
            setError('Name must be 30 characters or less');
            return;
        }
        
        saveAsCustomTheme(trimmedName);
        setName('');
        setError('');
        setOpen(false);
    };
    
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setName('');
            setError('');
        }
    };
    
    // Default trigger button
    const defaultTrigger = (
        <Button
            variant="outline"
            size="sm"
            disabled={!hasCustomColors}
            className="gap-1"
        >
            <Save className="h-4 w-4" />
            Save as Theme
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || defaultTrigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save Custom Theme</DialogTitle>
                    <DialogDescription>
                        Save your current color customizations as a new theme. 
                        Both light and dark mode colors will be saved.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="theme-name">Theme Name</Label>
                        <Input
                            id="theme-name"
                            placeholder="My Custom Theme"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSave();
                                }
                            }}
                            maxLength={30}
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                    
                    {!hasCustomColors && (
                        <p className="text-sm text-muted-foreground">
                            Tip: Customize some colors first, then save as a theme.
                        </p>
                    )}
                </div>
                
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Theme
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


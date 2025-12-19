/**
 * Bug Report Dialog
 * 
 * Modal dialog for users to report bugs with description and optional screenshot.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/client/components/ui/dialog';
import { Button } from '@/client/components/ui/button';
import { Label } from '@/client/components/ui/label';
import { Input } from '@/client/components/ui/input';
import { Bug, Upload, X, Send, Loader2, Gauge, Clipboard } from 'lucide-react';
import { useBugReportStore } from './store';
import { useSubmitBugReport } from './hooks';
import { toast } from '@/client/components/ui/toast';
import { compressImage, formatBytes } from '@/client/utils/imageCompression';
import type { BugCategory } from './types';

// Maximum allowed image size: 800KB (leaves room for other data in 1MB request limit)
const MAX_IMAGE_SIZE = 800 * 1024;

export function BugReportDialog() {
    const isOpen = useBugReportStore((state) => state.isOpen);
    const closeDialog = useBugReportStore((state) => state.closeDialog);
    
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [category, setCategory] = useState<BugCategory>('bug');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [description, setDescription] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [screenshot, setScreenshot] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [screenshotName, setScreenshotName] = useState<string>('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [isCompressing, setIsCompressing] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const submitMutation = useSubmitBugReport();

    const handleClose = () => {
        setCategory('bug');
        setDescription('');
        setScreenshot(null);
        setScreenshotName('');
        closeDialog();
    };

    // Process an image file (shared between file input and paste)
    const processImageFile = useCallback(async (file: File, sourceName: string) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Warn if original file is very large (> 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error(`Image is too large (${formatBytes(file.size)}). Please use an image smaller than 5MB.`);
            return;
        }

        try {
            setIsCompressing(true);

            // Compress the image
            const result = await compressImage(file, MAX_IMAGE_SIZE);

            // Check if compressed image is still too large
            if (result.compressedSize > MAX_IMAGE_SIZE) {
                toast.error(
                    `Image is still too large after compression (${formatBytes(result.compressedSize)}). ` +
                    `Please use a smaller image or lower resolution screenshot.`
                );
                return;
            }

            // Show compression info if significant
            if (result.compressionRatio < 0.9) {
                toast.success(
                    `Image compressed from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)}`
                );
            }

            setScreenshot(result.dataUrl);
            setScreenshotName(sourceName);
        } catch (error) {
            console.error('Image compression failed:', error);
            toast.error('Failed to process image. Please try a different image.');
        } finally {
            setIsCompressing(false);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processImageFile(file, file.name);
    };

    // Handle paste events for screenshots
    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
                    processImageFile(file, `pasted-screenshot-${timestamp}.png`);
                }
                return;
            }
        }
    }, [processImageFile]);

    // Listen for paste events at document level when dialog is open
    useEffect(() => {
        if (!isOpen) return;

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [isOpen, handlePaste]);

    const handleRemoveScreenshot = () => {
        setScreenshot(null);
        setScreenshotName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!description.trim()) {
            toast.error('Please describe the bug');
            return;
        }

        try {
            await submitMutation.mutateAsync({
                description: description.trim(),
                screenshot: screenshot || undefined,
                category,
            });
            
            handleClose();
            const message = category === 'performance' 
                ? 'Performance report submitted with timing data. Thank you!'
                : 'Bug report submitted successfully. Thank you!';
            toast.success(message);
        } catch (error) {
            // Provide user-friendly error messages
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (errorMessage.includes('413') || errorMessage.includes('Body exceeded') || errorMessage.includes('1mb limit')) {
                toast.error('Report is too large. Try removing the screenshot or reducing its size.');
            } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
                toast.error('Network error. Please check your connection and try again.');
            } else if (errorMessage.includes('timeout')) {
                toast.error('Request timed out. Please try again.');
            } else {
                toast.error('Failed to submit report. Please try again.');
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bug className="h-5 w-5 text-red-500" />
                        Report an Issue
                    </DialogTitle>
                    <DialogDescription>
                        Describe the issue you encountered. Your session logs and browser info will be included automatically.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category Selection */}
                    <div className="space-y-2">
                        <Label>Report Type</Label>
                        <div className="flex rounded-md border">
                            <button
                                type="button"
                                onClick={() => setCategory('bug')}
                                disabled={submitMutation.isPending}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-l-md px-3 py-2 text-sm transition-colors ${
                                    category === 'bug'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background hover:bg-muted'
                                }`}
                            >
                                <Bug className="h-4 w-4" />
                                Bug
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory('performance')}
                                disabled={submitMutation.isPending}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-r-md px-3 py-2 text-sm transition-colors ${
                                    category === 'performance'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background hover:bg-muted'
                                }`}
                            >
                                <Gauge className="h-4 w-4" />
                                Performance
                            </button>
                        </div>
                        {category === 'performance' && (
                            <p className="text-xs text-muted-foreground">
                                Performance reports include all request timings and performance metrics.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            placeholder={category === 'performance' 
                                ? "Describe the performance issue. What was slow?" 
                                : "What happened? What were you trying to do?"}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={submitMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Screenshot (optional)</Label>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={submitMutation.isPending}
                        />
                        
                        {screenshot ? (
                            <div className="relative rounded-md border p-2">
                                <div className="flex items-center gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 user-uploaded screenshot */}
                                    <img 
                                        src={screenshot} 
                                        alt="Screenshot preview" 
                                        className="h-16 w-16 rounded object-cover"
                                    />
                                    <span className="flex-1 truncate text-sm text-muted-foreground">
                                        {screenshotName}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveScreenshot}
                                        disabled={submitMutation.isPending}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={submitMutation.isPending || isCompressing}
                                >
                                    {isCompressing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Compressing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload Screenshot
                                        </>
                                    )}
                                </Button>
                                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                    <Clipboard className="h-3 w-3" />
                                    <span>or paste from clipboard (Ctrl/⌘+V)</span>
                                    <span className="ml-2 text-muted-foreground/70">· Max: {formatBytes(MAX_IMAGE_SIZE)}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleClose}
                            disabled={submitMutation.isPending || isCompressing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={submitMutation.isPending || isCompressing || !description.trim()}
                        >
                            {submitMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : isCompressing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Compressing...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Report
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}


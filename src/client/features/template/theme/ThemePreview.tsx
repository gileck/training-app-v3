import React from 'react';
import { Bell, Check, Star, Trash2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Card } from '@/client/components/template/ui/card';
import { Switch } from '@/client/components/template/ui/switch';

/**
 * Live preview of current theme settings
 */
export function ThemePreview() {
    return (
        <div className="space-y-2">
            <div>
                <h3 className="text-sm font-medium">Preview</h3>
                <p className="text-xs text-muted-foreground">
                    See how components look with your theme
                </p>
            </div>

            <Card className="p-4">
                <div className="space-y-4">
                    {/* Header area */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-foreground">Sample Card</h4>
                            <p className="text-sm text-muted-foreground">
                                This is how your content will look
                            </p>
                        </div>
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Buttons row */}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm">Primary</Button>
                        <Button size="sm" variant="secondary">Secondary</Button>
                        <Button size="sm" variant="outline">Outline</Button>
                        <Button size="sm" variant="ghost">Ghost</Button>
                        <Button size="sm" variant="destructive">
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                        </Button>
                    </div>

                    {/* Interactive elements */}
                    <div className="flex items-center gap-4 border-t border-border pt-4">
                        <div className="flex items-center gap-2">
                            <Switch defaultChecked />
                            <span className="text-sm">Enabled</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <Star className="h-4 w-4 text-muted-foreground" />
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Muted section */}
                    <div className="rounded-md bg-muted p-3">
                        <p className="text-sm text-muted-foreground">
                            <Check className="mr-1 inline h-4 w-4 text-success" />
                            This is a muted section with success indicator
                        </p>
                    </div>

                    {/* Accent section */}
                    <div className="rounded-md bg-accent p-3">
                        <p className="text-sm text-accent-foreground">
                            Accent background with accent-foreground text
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}


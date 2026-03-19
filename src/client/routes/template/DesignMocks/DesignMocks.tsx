/**
 * Design Mocks Route
 *
 * Public, full-screen route that renders agent-generated design mock pages.
 * Dynamically imports the mock page component based on the issue slug from the URL.
 * Mock files only exist on PR branches (Vercel previews), not on production.
 *
 * Toolbar controls: view state, theme preset, and dark/light mode.
 * Theme changes use the real theme store so CSS variables update automatically.
 */

import { useRouter, useThemeStore, themePresets } from '@/client/features';
import React, { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/client/components/template/ui/select';
import { Moon, Sun } from 'lucide-react';

export type ViewState = 'populated' | 'empty' | 'loading';
export type ColorMode = 'light' | 'dark';

class MockErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
                    <p className="text-muted-foreground">Design mock not available.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export function DesignMocks() {
    const { routeParams } = useRouter();
    const issueSlug = routeParams.issueSlug; // e.g. "issue-147"
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI control for mock preview toolbar
    const [viewState, setViewState] = useState<ViewState>('populated');

    const mode = useThemeStore((s) => s.settings.mode);
    const presetId = useThemeStore((s) => s.settings.presetId);
    const setMode = useThemeStore((s) => s.setMode);
    const setPreset = useThemeStore((s) => s.setPreset);

    const MockPage = useMemo(() => {
        if (!issueSlug) return null;
        return React.lazy(() => import(`@/pages/design-mocks/${issueSlug}`));
    }, [issueSlug]);

    if (!issueSlug || !MockPage) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
                <p className="text-muted-foreground">No design mock specified.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-2">
                <Select value={viewState} onValueChange={(v) => setViewState(v as ViewState)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="populated">Populated</SelectItem>
                        <SelectItem value="empty">Empty State</SelectItem>
                        <SelectItem value="loading">Loading State</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={presetId} onValueChange={setPreset}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {themePresets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <button
                    onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 h-8 text-xs text-foreground hover:bg-muted transition-colors"
                >
                    {mode === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {mode === 'light' ? 'Light' : 'Dark'}
                </button>
            </div>
            <MockErrorBoundary>
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-screen bg-background">
                        <Skeleton className="h-96 w-full max-w-md" />
                    </div>
                }>
                    <MockPage viewState={viewState} colorMode={mode} />
                </Suspense>
            </MockErrorBoundary>
        </div>
    );
}

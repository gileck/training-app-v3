/**
 * Boot Performance Logger
 * 
 * Tracks and logs timing metrics for app initialization phases.
 * Helps diagnose slow startups and identify bottlenecks.
 * 
 * All boot logs are captured via the session logger and included in bug reports.
 * The session logger's performanceTime provides accurate timing from page load.
 * 
 * Timeline explanation:
 *   0ms           - Browser starts loading page (HTML request sent)
 *   ~50-150ms     - JS bundle downloading
 *   ~150-190ms    - JS parsing and compilation
 *   ~190ms+       - First module executes (BUNDLE_LOADED event)
 * 
 * Console commands for debugging:
 *   printPerformanceLogs()    // Pretty print full performance summary
 *   printLogs('boot')         // Show all boot session logs
 *   logNavigationTiming()     // Log browser navigation timing breakdown
 *   logResourceTiming()       // Log all loaded resources with timing
 */

import { logger } from '../session-logs';

// Capture bundle load time immediately (before any other code)
// This will be logged when logBundleLoaded() is called
const bundleLoadedAt = typeof performance !== 'undefined' ? performance.now() : 0;

interface BootMetric {
    phase: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

interface BootPerformance {
    metrics: Map<string, BootMetric>;
}

// Global singleton for boot performance tracking
const bootPerf: BootPerformance = {
    metrics: new Map(),
};

/**
 * Get current performance time (consistent with session logger)
 * Returns 0 in SSR since boot timing doesn't apply there.
 */
function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : 0;
}

/**
 * Mark the start of a boot phase
 */
export function markPhaseStart(phase: string): void {
    bootPerf.metrics.set(phase, {
        phase,
        startTime: now(),
    });
    
    // Log to session logger (performanceTime is added automatically)
    logger.info('boot', `▶ ${phase} started`, {
        meta: { phase }
    });
}

/**
 * Mark the end of a boot phase
 */
export function markPhaseEnd(phase: string): void {
    const metric = bootPerf.metrics.get(phase);
    
    if (metric) {
        metric.endTime = now();
        metric.duration = metric.endTime - metric.startTime;
        
        // Log to session logger
        logger.info('boot', `✓ ${phase} completed in ${metric.duration.toFixed(0)}ms`, {
            meta: { phase, durationMs: Math.round(metric.duration) }
        });
    }
}

/**
 * Mark a single event (instant, no duration)
 */
export function markEvent(event: string): void {
    bootPerf.metrics.set(event, {
        phase: event,
        startTime: now(),
        endTime: now(),
        duration: 0,
    });
    
    // Log to session logger
    logger.info('boot', `● ${event}`, {
        meta: { event }
    });
}

/**
 * Log status information (not a timing event, just info)
 */
export function logStatus(label: string, data: Record<string, unknown>): void {
    // Log to session logger
    logger.info('boot', `📋 ${label}`, {
        meta: data
    });
}

/**
 * Log boot summary to session logger (called automatically after auth resolves)
 */
export function printBootSummary(): void {
    const sortedMetrics = Array.from(bootPerf.metrics.values())
        .sort((a, b) => a.startTime - b.startTime);
    
    // Build summary data (durations only - timing handled by session logger)
    const metricsData: Record<string, string> = {};
    
    for (const metric of sortedMetrics) {
        if (metric.duration !== undefined && metric.duration > 0) {
            metricsData[metric.phase] = `${Math.round(metric.duration)}ms`;
        } else {
            metricsData[metric.phase] = 'instant';
        }
    }
    
    // Log to session logger
    logger.info('boot', '📊 Performance Summary', { meta: metricsData });
}

/**
 * Get all metrics (for debugging/display)
 */
export function getBootMetrics(): BootMetric[] {
    return Array.from(bootPerf.metrics.values());
}

/**
 * Get total boot time (from first to last metric)
 */
export function getTotalBootTime(): number {
    const metrics = Array.from(bootPerf.metrics.values());
    if (metrics.length === 0) return 0;
    
    const first = Math.min(...metrics.map(m => m.startTime));
    const last = Math.max(...metrics.map(m => m.endTime || m.startTime));
    return last - first;
}

/**
 * Log browser navigation timing metrics.
 * Shows what happened during the 0ms to "Bundle Loaded" gap.
 * Call from console: logNavigationTiming()
 */
export function logNavigationTiming(): void {
    if (typeof window === 'undefined' || !window.performance) {
        console.log('[Boot] Navigation timing not available');
        return;
    }
    
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) {
        console.log('[Boot] No navigation timing entries');
        return;
    }
    
    const nav = entries[0];
    
    console.group('[Boot] 🌐 Navigation Timing (0ms to Bundle Load)');
    console.log(`DNS Lookup:       ${Math.round(nav.domainLookupEnd - nav.domainLookupStart)}ms`);
    console.log(`TCP Connection:   ${Math.round(nav.connectEnd - nav.connectStart)}ms`);
    console.log(`Request:          ${Math.round(nav.responseStart - nav.requestStart)}ms`);
    console.log(`Response:         ${Math.round(nav.responseEnd - nav.responseStart)}ms`);
    console.log(`DOM Interactive:  ${Math.round(nav.domInteractive)}ms`);
    console.log(`DOM Complete:     ${Math.round(nav.domComplete)}ms`);
    console.log(`Bundle Loaded:    ${Math.round(bundleLoadedAt)}ms (first JS executed)`);
    console.groupEnd();
    
    // Also log to session logger
    logger.info('boot', '🌐 Navigation Timing', {
        meta: {
            dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcpMs: Math.round(nav.connectEnd - nav.connectStart),
            requestMs: Math.round(nav.responseStart - nav.requestStart),
            responseMs: Math.round(nav.responseEnd - nav.responseStart),
            domInteractiveMs: Math.round(nav.domInteractive),
            domCompleteMs: Math.round(nav.domComplete),
            bundleLoadedMs: Math.round(bundleLoadedAt),
        }
    });
}

/**
 * Log resource timing for all loaded assets.
 * Shows JS, CSS, fonts loaded during boot with cache vs network info.
 * Call from console: logResourceTiming()
 */
export function logResourceTiming(filter?: 'js' | 'css' | 'all'): void {
    if (typeof window === 'undefined' || !window.performance) {
        console.log('[Boot] Resource timing not available');
        return;
    }
    
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    // Filter by type
    const filtered = entries.filter(e => {
        if (filter === 'js') return isJsResource(e.name);
        if (filter === 'css') return isCssResource(e.name);
        return true;
    });
    
    // Sort by start time
    const sorted = filtered.sort((a, b) => a.startTime - b.startTime);
    
    console.group(`[Boot] 📦 Resource Timing (${sorted.length} resources${filter ? `, filter: ${filter}` : ''})`);
    
    // Summary stats
    const jsResources = sorted.filter(r => isJsResource(r.name));
    const cssResources = sorted.filter(r => isCssResource(r.name));
    const totalSize = sorted.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const cachedCount = sorted.filter(r => r.transferSize === 0).length;
    
    console.log(`JS bundles: ${jsResources.length}, CSS: ${cssResources.length}`);
    console.log(`Total transfer: ${Math.round(totalSize / 1024)}KB, Cached: ${cachedCount}/${sorted.length}`);
    console.log('');
    
    // Show resources
    console.log('Start    Duration  Size     Type    Source    Name');
    console.log('─'.repeat(80));
    
    for (const entry of sorted) {
        const start = Math.round(entry.startTime).toString().padStart(5);
        const duration = Math.round(entry.duration).toString().padStart(5);
        const size = entry.transferSize 
            ? `${Math.round(entry.transferSize / 1024)}KB`.padStart(7)
            : ' cached'.padStart(7);
        const type = entry.initiatorType.padEnd(7);
        
        // Determine source (SW cache, browser cache, or network)
        let source = 'network';
        if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
            source = 'sw-cache'; // Service worker cache
        } else if (entry.transferSize === 0 && entry.decodedBodySize === 0) {
            source = 'memory'; // Memory cache
        }
        source = source.padEnd(9);
        
        // Shorten name for display
        const name = entry.name.replace(window.location.origin, '').substring(0, 50);
        
        console.log(`${start}ms  ${duration}ms  ${size}  ${type}  ${source}  ${name}`);
    }
    
    console.groupEnd();
    
    // Also log summary to session logger
    logger.info('boot', '📦 Resource Timing Summary', {
        meta: {
            totalResources: sorted.length,
            jsCount: jsResources.length,
            cssCount: cssResources.length,
            totalTransferKB: Math.round(totalSize / 1024),
            cachedCount,
            networkCount: sorted.length - cachedCount,
        }
    });
}

interface TimelineEvent {
    time: number;
    label: string;
    type: 'nav' | 'resource' | 'boot';
    highlight?: 'success' | 'warning';
    duration?: number;
}

/**
 * Check if a resource URL is a JS file (handles query strings)
 */
function isJsResource(url: string): boolean {
    const pathname = new URL(url, window.location.origin).pathname;
    return pathname.endsWith('.js');
}

/**
 * Check if a resource URL is a CSS file (handles query strings)
 */
function isCssResource(url: string): boolean {
    const pathname = new URL(url, window.location.origin).pathname;
    return pathname.endsWith('.css');
}

/**
 * Get detailed resource timing for unified timeline
 */
function getResourceTimingDetails(): { jsStart: number; jsEnd: number; cssStart: number; cssEnd: number } | null {
    if (typeof window === 'undefined' || !window.performance) return null;
    
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = entries.filter(e => isJsResource(e.name));
    const cssResources = entries.filter(e => isCssResource(e.name));
    
    if (jsResources.length === 0) return null;
    
    return {
        jsStart: Math.round(Math.min(...jsResources.map(e => e.startTime))),
        jsEnd: Math.round(Math.max(...jsResources.map(e => e.responseEnd))),
        cssStart: cssResources.length > 0 ? Math.round(Math.min(...cssResources.map(e => e.startTime))) : 0,
        cssEnd: cssResources.length > 0 ? Math.round(Math.max(...cssResources.map(e => e.responseEnd))) : 0,
    };
}

/**
 * Shared data structure used by both printPerformanceLogs() and getPerformanceSummary()
 */
interface PerformanceData {
    timeline: TimelineEvent[];
    resourceStats: ResourceStats | null;
    firstContentTime: number | null;
}

/**
 * Build the unified performance data (shared by console and report output)
 */
function buildPerformanceData(): PerformanceData | null {
    if (typeof window === 'undefined') return null;
    
    const navStats = getNavigationStats();
    const resourceStats = getResourceStats();
    const resourceTiming = getResourceTimingDetails();
    const metrics = Array.from(bootPerf.metrics.values());
    
    // Build unified timeline
    const timeline: TimelineEvent[] = [];
    
    // Add navigation timing events
    if (navStats) {
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navEntries.length > 0) {
            const nav = navEntries[0];
            timeline.push({ time: 0, label: '🌐 Page request sent', type: 'nav' });
            if (nav.domainLookupEnd > nav.domainLookupStart) {
                timeline.push({ time: Math.round(nav.domainLookupStart), label: `DNS Lookup (${navStats.dnsMs}ms)`, type: 'nav' });
            }
            if (nav.connectEnd > nav.connectStart) {
                timeline.push({ time: Math.round(nav.connectStart), label: `TCP Connection (${navStats.tcpMs}ms)`, type: 'nav' });
            }
            timeline.push({ time: Math.round(nav.responseStart), label: `TTFB - Server responded (${navStats.ttfbMs}ms)`, type: 'nav' });
            timeline.push({ time: Math.round(nav.responseEnd), label: 'HTML downloaded', type: 'nav' });
            timeline.push({ time: Math.round(nav.domInteractive), label: 'DOM Ready', type: 'nav' });
        }
    }
    
    // Add resource timing events
    if (resourceTiming) {
        timeline.push({ time: resourceTiming.jsStart, label: '📦 Started downloading JS', type: 'resource' });
        if (resourceTiming.cssStart > 0) {
            timeline.push({ time: resourceTiming.cssStart, label: '📦 Started downloading CSS', type: 'resource' });
        }
        if (resourceTiming.cssEnd > 0 && resourceTiming.cssEnd < resourceTiming.jsEnd) {
            timeline.push({ time: resourceTiming.cssEnd, label: '✓ All CSS loaded', type: 'resource' });
        }
        timeline.push({ time: resourceTiming.jsEnd, label: '✓ All JS loaded', type: 'resource' });
    }
    
    // Add boot phase events
    for (const metric of metrics) {
        const event: TimelineEvent = {
            time: Math.round(metric.startTime),
            label: metric.phase,
            type: 'boot',
            duration: metric.duration && metric.duration > 0 ? Math.round(metric.duration) : undefined,
        };
        
        // Add highlights
        if (metric.phase.includes('Content Shown')) {
            event.highlight = 'success';
        } else if (metric.phase.includes('Preflight') || metric.phase.includes('Validation')) {
            event.highlight = 'warning';
        }
        
        timeline.push(event);
    }
    
    // Sort by time
    timeline.sort((a, b) => a.time - b.time);
    
    // Find first content time
    const firstContent = metrics.find(m => m.phase.includes('Content Shown'));
    const firstContentTime = firstContent ? Math.round(firstContent.startTime) : null;
    
    return {
        timeline,
        resourceStats,
        firstContentTime,
    };
}

/**
 * Print a comprehensive performance summary to the console with colors.
 * Call from browser console: printPerformanceLogs()
 * 
 * Shows a unified chronological timeline of all events from page load to app ready.
 * Uses the same data as getPerformanceSummary() but with colored console output.
 */
export function printPerformanceLogs(): void {
    if (typeof window === 'undefined') {
        console.log('[Boot] Not available in SSR');
        return;
    }
    
    const data = buildPerformanceData();
    if (!data) {
        console.log('[Boot] No performance data available');
        return;
    }
    
    const { timeline, resourceStats, firstContentTime } = data;
    
    // Print header
    console.log('');
    console.log('%c╔══════════════════════════════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold');
    console.log('%c║                    APP LOAD TIMELINE                          ║', 'color: #4CAF50; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold');
    console.log('');
    
    // Print unified timeline with colors
    for (const event of timeline) {
        const timeStr = `${event.time}ms`.padStart(6);
        const durationStr = event.duration ? ` (${event.duration}ms)` : '';
        
        let icon = '';
        if (event.type === 'boot') {
            icon = event.duration ? '▶ ' : '● ';
        }
        
        // Determine style
        let style = '';
        if (event.highlight === 'success') {
            style = 'color: #4CAF50; font-weight: bold';
        } else if (event.highlight === 'warning') {
            style = 'color: #FF9800';
        } else if (event.type === 'nav') {
            style = 'color: #2196F3';
        } else if (event.type === 'resource') {
            style = 'color: #26C6DA';
        }
        
        if (style) {
            console.log(`%c${timeStr}  ${icon}${event.label}${durationStr}`, style);
        } else {
            console.log(`${timeStr}  ${icon}${event.label}${durationStr}`);
        }
    }
    
    console.log('');
    
    // Resource summary
    if (resourceStats) {
        console.log('%c┌─ 📦 RESOURCE SUMMARY ──────────────────────────────────────┐', 'color: #26C6DA');
        console.log(`│  JS:  ${resourceStats.jsCount} files, ${resourceStats.jsKB}KB`);
        console.log(`│  CSS: ${resourceStats.cssCount} files, ${resourceStats.cssKB}KB`);
        console.log('│');
        
        // Cache status breakdown
        const { swCache, memoryCache, network, totalFiles } = resourceStats.cacheDetails;
        console.log(`│  Cache Status (${totalFiles} static files):`);
        if (swCache > 0) {
            console.log(`│    ✓ ${swCache} from SW/disk cache (instant, SWR revalidates in background)`);
        }
        if (memoryCache > 0) {
            console.log(`│    ✓ ${memoryCache} from memory cache`);
        }
        if (network > 0) {
            console.log(`│    ↓ ${network} from network`);
        }
        if (swCache === 0 && memoryCache === 0 && network === totalFiles) {
            console.log('│    (fresh load - no cached resources)');
        }
        
        console.log('%c└─────────────────────────────────────────────────────────────┘', 'color: #26C6DA');
        console.log('');
    }
    
    // Summary line
    if (firstContentTime !== null) {
        console.log(`%c✨ Time to first content: ${firstContentTime}ms`, 'color: #4CAF50; font-size: 14px; font-weight: bold');
        console.log('');
    }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    win.logNavigationTiming = logNavigationTiming;
    win.logResourceTiming = logResourceTiming;
    win.printPerformanceLogs = printPerformanceLogs;
}

// Export constants for phase names
export const BOOT_PHASES = {
    // Very early (JS bundle loading)
    BUNDLE_LOADED: 'Bundle Loaded',
    
    // Core initialization
    APP_MOUNT: 'App Mount',
    QUERY_PROVIDER_INIT: 'QueryProvider Init',
    STORE_HYDRATION: 'Zustand Store Hydration',
    
    // Auth flow
    AUTH_PREFLIGHT_START: 'Auth Preflight Start',
    AUTH_PREFLIGHT_COMPLETE: 'Auth Preflight Complete',
    AUTH_VALIDATION_START: 'Auth Validation Start',
    AUTH_VALIDATION_COMPLETE: 'Auth Validation Complete',
    
    // UI states
    BOOT_GATE_WAITING: 'BootGate Waiting',
    BOOT_GATE_PASSED: 'BootGate Passed',
    AUTH_WRAPPER_RENDER: 'AuthWrapper Render',
    LOGIN_FORM_SHOWN: 'Login Form Shown',
    APP_CONTENT_SHOWN: 'App Content Shown',
    APP_CONTENT_SHOWN_INSTANT: 'App Content Shown (Instant Boot)',
    APP_CONTENT_SHOWN_VALIDATED: 'App Content Shown (Validated)',
    HOME_PAGE_READY: 'Home Page Ready',
} as const;

/**
 * Log bundle loaded event (called automatically when this module loads)
 * Uses the pre-captured bundleLoadedAt time for accuracy.
 */
function logBundleLoaded(): void {
    // Store metric with the actual bundle load time (captured at module top)
    bootPerf.metrics.set(BOOT_PHASES.BUNDLE_LOADED, {
        phase: BOOT_PHASES.BUNDLE_LOADED,
        startTime: bundleLoadedAt, // Use the time captured at module load, not now()
        endTime: bundleLoadedAt,
        duration: 0,
    });
    
    logger.info('boot', `● ${BOOT_PHASES.BUNDLE_LOADED}`);
}

// Log bundle loaded immediately when this module first executes
// This is the earliest point we can log - when JS first runs
logBundleLoaded();

// ============================================================================
// ON-DEMAND PERFORMANCE DETAILS (only calculated when reporting performance issues)
// ============================================================================

interface ResourceStats {
    jsCount: number; 
    cssCount: number; 
    jsKB: number; 
    cssKB: number;
    jsCached: number;
    cssCached: number;
    jsLoadTime: string;
    cssLoadTime: string;
    // Detailed cache breakdown
    cacheDetails: {
        swCache: number;    // Served from Service Worker / disk cache (transferSize=0, decodedBodySize>0)
        memoryCache: number; // Served from memory cache (transferSize=0, decodedBodySize=0)
        network: number;    // Fetched from network (transferSize>0)
        totalFiles: number;
    };
}

interface NavigationStats {
    dnsMs: number;
    tcpMs: number;
    ttfbMs: number;
    downloadMs: number;
    domReadyMs: number;
    bundleStartMs: number;
}

/**
 * Get aggregated resource loading stats (called on-demand)
 * 
 * Cache detection logic:
 * - SW/Disk cache: transferSize=0, decodedBodySize>0 (served from Service Worker or browser disk cache)
 * - Memory cache: transferSize=0, decodedBodySize=0 (served from browser memory, e.g. same-page navigation)
 * - Network: transferSize>0 (fetched from network)
 * 
 * Note: For SWR (Stale-While-Revalidate) resources, the response is served from cache instantly,
 * and revalidation happens in the background. This appears as a cache hit in Resource Timing.
 */
function getResourceStats(): ResourceStats | null {
    if (typeof window === 'undefined' || !window.performance) {
        return null;
    }
    
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (entries.length === 0) return null;
    
    const jsResources = entries.filter(e => isJsResource(e.name));
    const cssResources = entries.filter(e => isCssResource(e.name));
    
    const jsKB = Math.round(jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024);
    const cssKB = Math.round(cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024);
    const jsCached = jsResources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
    const cssCached = cssResources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
    
    // Detailed cache breakdown for all resources (JS + CSS + others)
    const allStaticResources = entries.filter(e => 
        isJsResource(e.name) || isCssResource(e.name)
    );
    const swCache = allStaticResources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
    const memoryCache = allStaticResources.filter(r => r.transferSize === 0 && r.decodedBodySize === 0).length;
    const network = allStaticResources.filter(r => r.transferSize > 0).length;
    
    // JS timing
    const jsLoadTime = jsResources.length > 0
        ? (() => {
            const jsFirst = Math.round(Math.min(...jsResources.map(e => e.startTime)));
            const jsLast = Math.round(Math.max(...jsResources.map(e => e.responseEnd)));
            return `${jsFirst}→${jsLast}ms`;
        })()
        : 'N/A';
    
    // CSS timing
    const cssLoadTime = cssResources.length > 0
        ? (() => {
            const cssFirst = Math.round(Math.min(...cssResources.map(e => e.startTime)));
            const cssLast = Math.round(Math.max(...cssResources.map(e => e.responseEnd)));
            return `${cssFirst}→${cssLast}ms`;
        })()
        : 'N/A';
    
    return {
        jsCount: jsResources.length,
        cssCount: cssResources.length,
        jsKB,
        cssKB,
        jsCached,
        cssCached,
        jsLoadTime,
        cssLoadTime,
        cacheDetails: {
            swCache,
            memoryCache,
            network,
            totalFiles: allStaticResources.length,
        },
    };
}

/**
 * Get navigation timing metrics (called on-demand)
 */
function getNavigationStats(): NavigationStats | null {
    if (typeof window === 'undefined' || !window.performance) {
        return null;
    }
    
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) return null;
    
    const nav = entries[0];
    
    return {
        dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcpMs: Math.round(nav.connectEnd - nav.connectStart),
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        downloadMs: Math.round(nav.responseEnd - nav.responseStart),
        domReadyMs: Math.round(nav.domInteractive),
        bundleStartMs: Math.round(bundleLoadedAt),
    };
}

/**
 * Generate a formatted performance summary string.
 * Call this when submitting a performance bug report.
 * Returns a string to include directly in the report (not added to session logs).
 * Uses the same data as printPerformanceLogs() but as plain text.
 */
export function getPerformanceSummary(): string {
    const data = buildPerformanceData();
    
    if (!data) {
        return '[Performance data not available]';
    }
    
    return formatPerformanceDataAsText(data.timeline, data.resourceStats, data.firstContentTime);
}

/**
 * Shared formatting logic - converts performance data to plain text
 * Used by both live summary and stored report summary
 */
function formatPerformanceDataAsText(
    timeline: Array<{ time: number; label: string; type?: string; duration?: number }>,
    resourceStats: ResourceStats | null,
    firstContentTime: number | null
): string {
    const lines: string[] = [];
    
    lines.push('=== APP LOAD TIMELINE ===');
    lines.push('');
    
    // Print timeline
    for (const event of timeline) {
        const timeStr = `${event.time}ms`.padStart(6);
        const durationStr = event.duration ? ` (${event.duration}ms)` : '';
        
        let icon = '';
        if (event.type === 'boot') {
            icon = event.duration ? '▶ ' : '● ';
        }
        
        lines.push(`${timeStr}  ${icon}${event.label}${durationStr}`);
    }
    
    lines.push('');
    
    // Resource summary with cache status
    if (resourceStats) {
        lines.push('📦 RESOURCE SUMMARY');
        lines.push(`  JS:  ${resourceStats.jsCount} files, ${resourceStats.jsKB}KB`);
        lines.push(`  CSS: ${resourceStats.cssCount} files, ${resourceStats.cssKB}KB`);
        
        const { swCache, memoryCache, network, totalFiles } = resourceStats.cacheDetails;
        lines.push(`  Cache Status (${totalFiles} static files):`);
        if (swCache > 0) {
            lines.push(`    ✓ ${swCache} from SW/disk cache`);
        }
        if (memoryCache > 0) {
            lines.push(`    ✓ ${memoryCache} from memory cache`);
        }
        if (network > 0) {
            lines.push(`    ↓ ${network} from network`);
        }
        lines.push('');
    }
    
    // Time to first content
    if (firstContentTime !== null) {
        lines.push(`✨ Time to first content: ${firstContentTime}ms`);
    }
    
    lines.push('');
    lines.push('===========================');
    
    return lines.join('\n');
}

// Types for stored report data (matches what's saved in DB)
interface StoredSessionLog {
    feature: string;
    message: string;
    performanceTime?: number;
}

interface StoredPerformanceEntry {
    entryType: string;
    name?: string;
    transferSize?: number;
    decodedBodySize?: number;
    // Navigation timing specific
    domainLookupStart?: number;
    domainLookupEnd?: number;
    connectStart?: number;
    connectEnd?: number;
    requestStart?: number;
    responseStart?: number;
    responseEnd?: number;
    domInteractive?: number;
    domComplete?: number;
}

/**
 * Generate performance summary from stored report data.
 * Use this in Reports page to reconstruct summary from DB data.
 * 
 * @param sessionLogs - Session logs from stored report
 * @param performanceEntries - Performance entries from stored report
 */
export function generatePerformanceSummaryFromStoredData(
    sessionLogs: StoredSessionLog[],
    performanceEntries?: StoredPerformanceEntry[]
): string | null {
    // Build timeline from session logs (boot events)
    const bootLogs = sessionLogs
        .filter(log => log.feature === 'boot' && log.performanceTime !== undefined)
        .sort((a, b) => (a.performanceTime || 0) - (b.performanceTime || 0));
    
    if (bootLogs.length === 0) {
        return null;
    }
    
    // Build timeline events
    const timeline: Array<{ time: number; label: string; type: string; duration?: number }> = [];
    
    // Add navigation timing events
    const navEntry = performanceEntries?.find(e => e.entryType === 'navigation');
    if (navEntry) {
        timeline.push({ time: 0, label: '🌐 Page request sent', type: 'nav' });
        
        // Add DNS, TCP, TTFB if we have the data
        if (navEntry.domainLookupStart !== undefined && navEntry.domainLookupEnd !== undefined) {
            const dnsMs = navEntry.domainLookupEnd - navEntry.domainLookupStart;
            if (dnsMs > 0) {
                timeline.push({ time: navEntry.domainLookupStart, label: `DNS Lookup (${dnsMs}ms)`, type: 'nav' });
            }
        }
        if (navEntry.connectStart !== undefined && navEntry.connectEnd !== undefined) {
            const tcpMs = navEntry.connectEnd - navEntry.connectStart;
            if (tcpMs > 0) {
                timeline.push({ time: navEntry.connectStart, label: `TCP Connection (${tcpMs}ms)`, type: 'nav' });
            }
        }
        if (navEntry.responseStart !== undefined && navEntry.requestStart !== undefined) {
            const ttfbMs = navEntry.responseStart - navEntry.requestStart;
            timeline.push({ time: navEntry.responseStart, label: `TTFB - Server responded (${ttfbMs}ms)`, type: 'nav' });
        }
        if (navEntry.responseEnd !== undefined) {
            timeline.push({ time: navEntry.responseEnd, label: 'HTML downloaded', type: 'nav' });
        }
        if (navEntry.domInteractive !== undefined) {
            timeline.push({ time: navEntry.domInteractive, label: 'DOM Ready', type: 'nav' });
        }
    }
    
    // Add boot events from session logs
    for (const log of bootLogs) {
        // Strip leading icons from message (they're already in the log)
        // Icons: ● ▶ ✓ 📋 📊 🌐 📦 (use unicode flag for emoji support)
        const cleanMessage = log.message.replace(/^(?:●|▶|✓|📋|📊|🌐|📦)\s*/u, '');
        
        timeline.push({
            time: Math.round(log.performanceTime || 0),
            label: cleanMessage,
            type: 'boot',
        });
    }
    
    // Sort by time
    timeline.sort((a, b) => a.time - b.time);
    
    // Build resource stats from performanceEntries
    let resourceStats: ResourceStats | null = null;
    if (performanceEntries && performanceEntries.length > 0) {
        // Helper to check file type (handles query strings in URLs)
        const isJs = (name: string) => {
            try {
                return new URL(name).pathname.endsWith('.js');
            } catch {
                return name.endsWith('.js');
            }
        };
        const isCss = (name: string) => {
            try {
                return new URL(name).pathname.endsWith('.css');
            } catch {
                return name.endsWith('.css');
            }
        };
        
        const jsEntries = performanceEntries.filter(e => 
            e.entryType === 'resource' && e.name && isJs(e.name)
        );
        const cssEntries = performanceEntries.filter(e => 
            e.entryType === 'resource' && e.name && isCss(e.name)
        );
        
        if (jsEntries.length > 0 || cssEntries.length > 0) {
            const jsKB = Math.round(jsEntries.reduce((sum, e) => sum + (e.transferSize || 0), 0) / 1024);
            const cssKB = Math.round(cssEntries.reduce((sum, e) => sum + (e.transferSize || 0), 0) / 1024);
            
            // Cache status breakdown
            const allStaticEntries = [...jsEntries, ...cssEntries];
            const swCache = allStaticEntries.filter(e => 
                e.transferSize === 0 && e.decodedBodySize && e.decodedBodySize > 0
            ).length;
            const memoryCache = allStaticEntries.filter(e => 
                e.transferSize === 0 && (!e.decodedBodySize || e.decodedBodySize === 0)
            ).length;
            const network = allStaticEntries.filter(e => 
                e.transferSize && e.transferSize > 0
            ).length;
            
            resourceStats = {
                jsCount: jsEntries.length,
                cssCount: cssEntries.length,
                jsKB,
                cssKB,
                jsCached: 0,
                cssCached: 0,
                jsLoadTime: 'N/A',
                cssLoadTime: 'N/A',
                cacheDetails: {
                    swCache,
                    memoryCache,
                    network,
                    totalFiles: allStaticEntries.length,
                },
            };
        }
    }
    
    // Find first content time
    const contentShownLog = bootLogs.find(log => log.message.includes('Content Shown'));
    const firstContentTime = contentShownLog?.performanceTime 
        ? Math.round(contentShownLog.performanceTime) 
        : null;
    
    return formatPerformanceDataAsText(timeline, resourceStats, firstContentTime);
}

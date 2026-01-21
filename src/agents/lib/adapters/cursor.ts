/**
 * Cursor Adapter (Stub)
 *
 * Placeholder adapter for Cursor AI integration.
 * To be implemented in the future.
 */

import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';

// ============================================================
// CURSOR ADAPTER (STUB)
// ============================================================

class CursorAdapter implements AgentLibraryAdapter {
    readonly name = 'cursor';
    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false, // To be determined
        customTools: false, // To be determined
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        throw new Error('Cursor adapter not yet implemented. Use "claude-code-sdk" instead.');
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async run(_options: AgentRunOptions): Promise<AgentRunResult> {
        throw new Error('Cursor adapter not yet implemented. Use "claude-code-sdk" instead.');
    }

    async dispose(): Promise<void> {
        this.initialized = false;
    }
}

// Export singleton instance
const cursorAdapter = new CursorAdapter();
export default cursorAdapter;

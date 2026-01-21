/**
 * Gemini Adapter (Stub)
 *
 * Placeholder adapter for Google Gemini integration.
 * To be implemented in the future.
 */

import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';

// ============================================================
// GEMINI ADAPTER (STUB)
// ============================================================

class GeminiAdapter implements AgentLibraryAdapter {
    readonly name = 'gemini';
    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: false, // To be determined
        fileWrite: false, // To be determined
        webFetch: true,
        customTools: false, // To be determined
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        throw new Error('Gemini adapter not yet implemented. Use "claude-code-sdk" instead.');
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async run(_options: AgentRunOptions): Promise<AgentRunResult> {
        throw new Error('Gemini adapter not yet implemented. Use "claude-code-sdk" instead.');
    }

    async dispose(): Promise<void> {
        this.initialized = false;
    }
}

// Export singleton instance
const geminiAdapter = new GeminiAdapter();
export default geminiAdapter;

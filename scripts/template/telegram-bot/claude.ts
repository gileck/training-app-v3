/**
 * Claude Code SDK integration for Telegram Bot
 */

import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { PROJECT_ROOT, ALLOWED_BASH_COMMANDS, BOT_CONFIG, OUTPUT_SCHEMA, getSystemPrompt } from './config';
import { getOrCreateSession, clearSession, saveSessions } from './sessions';
import type { ClaudeStructuredResponse, ProcessResult } from './types';

// ============================================================
// CLAUDE PROCESSING
// ============================================================

export async function processWithClaude(prompt: string, chatKey: string): Promise<ProcessResult> {
    let result = '';
    let structuredOutput: ClaudeStructuredResponse | undefined;
    const toolCalls: string[] = [];

    const session = getOrCreateSession(chatKey);
    const isNewSession = !session.sessionId;

    let finalPrompt = prompt;
    if (isNewSession) {
        const systemContext = getSystemPrompt(ALLOWED_BASH_COMMANDS, session.summary);
        finalPrompt = `${systemContext}User request: ${prompt}`;
    }

    console.log(`\n⚙️  Processing with Claude... (session: ${session.sessionId ? session.sessionId.slice(0, 8) + '...' : 'new'})`);

    try {
        const queryOptions: Record<string, unknown> = {
            allowedTools: BOT_CONFIG.allowedTools,
            cwd: PROJECT_ROOT,
            model: BOT_CONFIG.model,
            maxTurns: BOT_CONFIG.maxTurns,
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            outputFormat: OUTPUT_SCHEMA,
        };

        if (session.sessionId) {
            queryOptions.resume = session.sessionId;
        }

        for await (const message of query({
            prompt: finalPrompt,
            options: queryOptions,
        })) {
            // Capture session ID from init message
            if (message.type === 'system' && (message as SDKMessage & { subtype?: string }).subtype === 'init') {
                const initMsg = message as SDKMessage & { session_id?: string };
                if (initMsg.session_id && !session.sessionId) {
                    session.sessionId = initMsg.session_id;
                    saveSessions();
                    console.log(`   📍 Session ID: ${session.sessionId.slice(0, 8)}...`);
                }
            }

            // Capture session ID from any message if not set yet
            if (!session.sessionId && 'session_id' in message && message.session_id) {
                session.sessionId = message.session_id as string;
                saveSessions();
                console.log(`   📍 Session ID: ${session.sessionId.slice(0, 8)}...`);
            }

            // Handle assistant messages
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;

                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        result = (block as { type: 'text'; text: string }).text;
                    }
                    if (block.type === 'tool_use') {
                        const toolUse = block as { type: 'tool_use'; name: string; input: Record<string, unknown> };
                        const target = toolUse.input?.file_path || toolUse.input?.pattern || toolUse.input?.command || '';
                        const targetStr = target ? `: ${String(target).slice(0, 50)}` : '';
                        toolCalls.push(`${toolUse.name}${targetStr}`);
                        console.log(`   🔧 Tool: ${toolUse.name}${targetStr}`);
                    }
                }
            }

            // Handle final result with structured output
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage & { structured_output?: ClaudeStructuredResponse };
                if (resultMsg.subtype === 'success') {
                    if (resultMsg.structured_output) {
                        structuredOutput = resultMsg.structured_output;
                        result = structuredOutput.text;
                        console.log(`   📦 Structured output with ${structuredOutput.buttons?.length || 0} buttons`);
                    } else if (resultMsg.result) {
                        result = resultMsg.result;
                    }
                }
            }
        }

        // Update message count and save
        session.messageCount++;
        saveSessions();

        // Check if we hit the max turns limit
        const hitMaxTurns = toolCalls.length >= BOT_CONFIG.maxTurns - 1;
        if (hitMaxTurns) {
            console.log(`   ⚠️ Hit max turns limit (${toolCalls.length}/${BOT_CONFIG.maxTurns})`);
        }

        // Add tool summary and max turns warning if applicable
        let suffix = '';
        if (toolCalls.length > 0) {
            suffix = `\n\n_Tools used: ${toolCalls.length}_`;
        }
        if (hitMaxTurns) {
            suffix += `\n\n⚠️ _Response may be incomplete - hit max turns limit (${BOT_CONFIG.maxTurns}). Try a more specific question or use /clear to start fresh._`;
        }
        result = result + suffix;

        const buttonCount = structuredOutput?.buttons?.length || 0;
        console.log(`   ✅ Claude done (${toolCalls.length} tools, ${result.length} chars, ${buttonCount} buttons, msg #${session.messageCount})`);

        return {
            text: result || 'No response generated.',
            buttons: structuredOutput?.buttons
        };

    } catch (error) {
        console.error('   ❌ Claude error:', error);
        return { text: `Error: ${error instanceof Error ? error.message : String(error)}` };
    }
}

export async function summarizeConversation(chatKey: string): Promise<string> {
    const session = getOrCreateSession(chatKey);

    if (!session.sessionId) {
        return 'No active conversation to summarize.';
    }

    console.log(`\n📝 Summarizing conversation...`);

    try {
        let summary = '';

        for await (const message of query({
            prompt: 'Please provide a concise summary of our conversation so far. Include key topics discussed, decisions made, and any important context that would be useful for continuing this conversation later. Format it as a brief paragraph.',
            options: {
                cwd: PROJECT_ROOT,
                model: BOT_CONFIG.model,
                maxTurns: 1,
                resume: session.sessionId,
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
            },
        })) {
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        const textContent = (block as { type: 'text'; text: string }).text;
                        // Try parsing as JSON in case session has structured output
                        try {
                            const parsed = JSON.parse(textContent);
                            summary = parsed.text || textContent;
                        } catch {
                            summary = textContent;
                        }
                    }
                }
            }
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage & { structured_output?: { text: string } };
                if (resultMsg.subtype === 'success') {
                    // Handle structured output (session may have JSON format)
                    if (resultMsg.structured_output?.text) {
                        summary = resultMsg.structured_output.text;
                    } else if (resultMsg.result) {
                        // Try parsing as JSON in case it's structured
                        try {
                            const parsed = JSON.parse(resultMsg.result);
                            summary = parsed.text || resultMsg.result;
                        } catch {
                            summary = resultMsg.result;
                        }
                    }
                }
            }
        }

        // Store summary and clear session
        const oldMessageCount = session.messageCount;
        clearSession(chatKey);
        const newSession = getOrCreateSession(chatKey);
        newSession.summary = summary;

        console.log(`   ✅ Summary created (${summary.length} chars from ${oldMessageCount} messages)`);
        return `📝 *Conversation Summary*\n\n${summary}\n\n_Session cleared. Summary will be used as context for next conversation._`;

    } catch (error) {
        console.error('   ❌ Summary error:', error);
        return `Error creating summary: ${error instanceof Error ? error.message : String(error)}`;
    }
}

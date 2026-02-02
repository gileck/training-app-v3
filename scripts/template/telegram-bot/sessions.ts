/**
 * Session management for Telegram Claude Bot
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ChatSession } from './types';
import { BOT_CONFIG } from './config';

// ============================================================
// SESSION STORAGE
// ============================================================

const SESSIONS_FILE = path.join(process.cwd(), '.telegram-bot-sessions.json');

// Store sessions per chat
const chatSessions = new Map<string, ChatSession>();

// Store callback data (Telegram has 64-byte limit on callback_data)
const callbackStorage = new Map<string, string>();
let callbackCounter = 0;

// ============================================================
// CALLBACK STORAGE
// ============================================================

export function storeCallback(text: string): string {
    const id = `cb_${++callbackCounter}`;
    callbackStorage.set(id, text);
    // Clean old callbacks
    if (callbackStorage.size > BOT_CONFIG.maxCallbackStorage) {
        const firstKey = callbackStorage.keys().next().value;
        if (firstKey) callbackStorage.delete(firstKey);
    }
    return id;
}

export function getCallback(id: string): string | undefined {
    return callbackStorage.get(id);
}

// ============================================================
// SESSION PERSISTENCE
// ============================================================

export function loadSessions(): void {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
            for (const [key, value] of Object.entries(data)) {
                chatSessions.set(key, value as ChatSession);
            }
            console.log(`📂 Loaded ${chatSessions.size} session(s) from disk`);
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

export function saveSessions(): void {
    try {
        const data: Record<string, ChatSession> = {};
        for (const [key, value] of chatSessions.entries()) {
            data[key] = value;
        }
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save sessions:', error);
    }
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

export function getOrCreateSession(chatKey: string): ChatSession {
    if (!chatSessions.has(chatKey)) {
        chatSessions.set(chatKey, {
            sessionId: null,
            summary: null,
            messageCount: 0,
        });
        saveSessions();
    }
    return chatSessions.get(chatKey)!;
}

export function updateSession(chatKey: string, updates: Partial<ChatSession>): void {
    const session = getOrCreateSession(chatKey);
    Object.assign(session, updates);
    saveSessions();
}

export function clearSession(chatKey: string): void {
    chatSessions.set(chatKey, {
        sessionId: null,
        summary: null,
        messageCount: 0,
    });
    saveSessions();
}

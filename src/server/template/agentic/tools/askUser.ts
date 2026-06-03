/**
 * `ask_user` — a human-in-the-loop multiple-choice tool.
 *
 * The agent presents the user one or more questions (each single- or
 * multi-select) and BLOCKS the turn until the user submits answers.
 * This works because tools run inside the long-lived RPC daemon (not a
 * request/response Lambda): the SDK keeps the agent's turn open while
 * the tool's Promise is pending, so we can simply poll the question row
 * until the user answers — no session-resume gymnastics.
 *
 * The input shape mirrors the native AskUserQuestion tool (`questions[]`
 * with `multiSelect` + `{label, description}` options) so the model
 * reaches for it instinctively.
 *
 * Flow:
 *   1. Tool handler writes a 'pending' agentQuestions row keyed by the
 *      assistant message id (`ctx.sourceMessageId`).
 *   2. The client surfaces the row (via getConversation) and renders an
 *      interactive widget under the assistant bubble.
 *   3. The user submits → the answerQuestion API flips the row to
 *      'answered' with their selections.
 *   4. This handler's poll loop sees 'answered' and returns the chosen
 *      labels (per question) to the agent, which continues the turn.
 *
 * Correlation is by the row's own id (surfaced to the client), not the
 * adapter's per-call id — so this needs ZERO adapter changes and works
 * identically under the Claude Code and Codex adapters.
 */

import { z } from 'zod';
import { ObjectId } from 'mongodb';
import {
    createQuestion,
    expireQuestion,
    findQuestionById,
} from '@/server/database/collections/template/agentQuestions/agentQuestions';
import type { AgentSubQuestion } from '@/server/database/collections/template/agentQuestions/types';
import { defineTool } from '../defineTool';
import type { AgenticTool } from '../types';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const askUserInputSchema = {
    questions: z
        .array(
            z.object({
                question: z
                    .string()
                    .min(1)
                    .describe('The question text shown to the user.'),
                header: z
                    .string()
                    .optional()
                    .describe(
                        'Optional short label/title for the question (1–3 words).'
                    ),
                options: z
                    .array(
                        z.object({
                            label: z
                                .string()
                                .min(1)
                                .describe(
                                    'The option text the user sees; this exact string is returned if chosen.'
                                ),
                            description: z
                                .string()
                                .optional()
                                .describe(
                                    'Optional one-line clarification shown under the label.'
                                ),
                        })
                    )
                    .min(2)
                    .max(12)
                    .describe('The 2–12 options for this question.'),
                multiSelect: z
                    .boolean()
                    .optional()
                    .describe(
                        'If true, the user may pick more than one option for THIS question. Defaults to false (single choice).'
                    ),
                allowOther: z
                    .boolean()
                    .optional()
                    .describe(
                        'If true (the default), the user can also type a free-text answer in an "Other…" field — returned as `other`, and combinable with a selected option. Set false to force a closed choice.'
                    ),
                minSelections: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe(
                        'Minimum options to select for this question (multiSelect only). Defaults to 1.'
                    ),
                maxSelections: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe(
                        'Maximum options to select for this question (multiSelect only). Defaults to the number of options.'
                    ),
            })
        )
        .min(1)
        .max(8)
        .describe(
            'One or more questions to ask at once. Use a single-element array for a single question.'
        ),
} as const;

type AskUserArgs = z.infer<z.ZodObject<typeof askUserInputSchema>>;

export interface AskUserToolOptions {
    /** How long to block waiting for an answer before giving up.
     *  Defaults to 5 minutes. */
    timeoutMs?: number;
    /** Poll cadence while waiting. Defaults to 1s. */
    pollIntervalMs?: number;
}

/** Normalize + validate the raw questions into stored sub-questions. */
function normalizeQuestions(
    raw: AskUserArgs['questions']
): { ok: true; questions: AgentSubQuestion[] } | { ok: false; error: string } {
    const questions: AgentSubQuestion[] = [];
    for (let i = 0; i < raw.length; i++) {
        const q = raw[i];
        // De-dupe options by label, preserving order.
        const seen = new Set<string>();
        const options = [];
        for (const opt of q.options) {
            const label = opt.label.trim();
            if (label && !seen.has(label)) {
                seen.add(label);
                options.push({
                    label,
                    ...(opt.description?.trim()
                        ? { description: opt.description.trim() }
                        : {}),
                });
            }
        }
        if (options.length < 2) {
            return {
                ok: false,
                error: `Question ${i + 1}: provide at least 2 distinct, non-empty options.`,
            };
        }
        const multiSelect = q.multiSelect ?? false;
        const minSelections = multiSelect
            ? Math.min(options.length, Math.max(0, q.minSelections ?? 1))
            : 1;
        const maxSelections = multiSelect
            ? Math.min(options.length, Math.max(1, q.maxSelections ?? options.length))
            : 1;
        if (maxSelections < minSelections) {
            return {
                ok: false,
                error: `Question ${i + 1}: maxSelections must be >= minSelections.`,
            };
        }
        questions.push({
            question: q.question.trim(),
            ...(q.header?.trim() ? { header: q.header.trim() } : {}),
            options,
            multiSelect,
            minSelections,
            maxSelections,
            allowOther: q.allowOther ?? true,
        });
    }
    return { ok: true, questions };
}

/**
 * Build the `ask_user` tool. Generic over the project's tool data
 * context — the tool only uses identity fields on the context (userId /
 * conversationId / sourceMessageId), so it composes with any `TData`.
 */
export function createAskUserTool<TData = unknown>(
    options: AskUserToolOptions = {}
): AgenticTool<typeof askUserInputSchema, TData> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    return defineTool<typeof askUserInputSchema, TData>({
        name: 'ask_user',
        description:
            'Ask the user one or more multiple-choice questions and WAIT for their answer. ' +
            'Use whenever you need the user to choose among concrete options before continuing — ' +
            'disambiguating intent, picking from candidates, or confirming a subset. ' +
            'Each question can be single-choice or multi-select (set multiSelect per question), ' +
            'and you may ask several questions at once. ' +
            'By default each question also accepts a free-text "Other" answer (returned as `other`, ' +
            'and combinable with a chosen option) — set allowOther:false to force a closed choice. ' +
            'Returns the option labels the user selected (and any `other` text), per question. ' +
            'Prefer this over asking in plain text when the answer is a choice among known options.',
        inputSchema: askUserInputSchema,
        handler: async (args, ctx) => {
            const normalized = normalizeQuestions(args.questions);
            if (!normalized.ok) {
                return { ok: false, error: normalized.error };
            }

            const questionId = await createQuestion({
                userId: new ObjectId(ctx.userId),
                conversationId: ctx.conversationId,
                messageId: new ObjectId(ctx.sourceMessageId),
                questions: normalized.questions,
            });

            // Block until the user answers, the batch is cancelled, or
            // we time out. Safe to block here — the daemon is a long-
            // lived process and the SDK holds the turn open.
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                const row = await findQuestionById(questionId);
                if (!row) {
                    return {
                        ok: false,
                        error: 'The question was removed before it was answered.',
                    };
                }
                if (row.status === 'answered') {
                    return {
                        ok: true,
                        data: {
                            responses: row.questions.map((q, i) => {
                                const a = row.answers[i] ?? { selected: [] };
                                return {
                                    question: q.question,
                                    selected: a.selected,
                                    // The user's free-text "Other" answer,
                                    // when provided (may accompany a chosen
                                    // option).
                                    ...(a.other ? { other: a.other } : {}),
                                };
                            }),
                        },
                    };
                }
                if (row.status === 'cancelled') {
                    return {
                        ok: false,
                        error: 'The user dismissed the question without answering.',
                    };
                }
                await sleep(pollIntervalMs);
            }

            await expireQuestion(questionId);
            return {
                ok: false,
                error: 'Timed out waiting for the user to answer the question.',
            };
        },
    });
}

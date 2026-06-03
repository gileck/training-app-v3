/**
 * MultipleChoiceQuestion
 *
 * Renders a batch of questions the agent asked mid-turn (one or more,
 * each single- or multi-select, each optionally accepting a free-text
 * "Other" answer).
 *
 *   - 'pending'  → an interactive widget: pick option(s) and/or type an
 *                  "Other…" answer per question, one Submit for the batch.
 *   - answered   → a compact recap "message" of what the user chose.
 *   - cancelled/
 *     expired    → a short muted caption.
 *
 * "Other" is a separate channel: the user can fill it INSTEAD of (it
 * waives the minimum-selection requirement) or ALONGSIDE a chosen option.
 *
 * Presentational only — the caller owns the answer mutation and passes
 * `onSubmit` (per-question answers, index-aligned) + `isSubmitting`.
 */

import { useState } from 'react';
import { Check, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { cn } from '@/client/lib/utils';
import type {
    AgentQuestionAnswer,
    AgentQuestionClient,
    AgentSubQuestion,
} from '@/server/database/collections/template/agentQuestions/types';

export interface MultipleChoiceQuestionProps {
    question: AgentQuestionClient;
    /** Per-question answers, index-aligned to `question.questions`. */
    onSubmit: (answers: AgentQuestionAnswer[]) => void;
    isSubmitting?: boolean;
}

function selectionHint(q: AgentSubQuestion): string {
    const base = !q.multiSelect
        ? 'Pick one'
        : q.minSelections === q.maxSelections
          ? `Pick exactly ${q.minSelections}`
          : q.maxSelections >= q.options.length && q.minSelections <= 1
            ? 'Pick one or more'
            : `Pick ${q.minSelections}–${q.maxSelections}`;
    return q.allowOther ? `${base} · or write your own` : base;
}

function lockedCaption(status: AgentQuestionClient['status']): string | null {
    switch (status) {
        case 'cancelled':
            return 'Dismissed without answering';
        case 'expired':
            return 'Timed out — no answer recorded';
        default:
            return null;
    }
}

/** Whether an answer satisfies its question's bounds. A non-empty
 *  "Other" waives the minimum-selection requirement. */
function isSatisfied(q: AgentSubQuestion, answer: AgentQuestionAnswer): boolean {
    if (answer.selected.length > q.maxSelections) return false;
    const hasOther = q.allowOther && !!answer.other?.trim();
    if (hasOther) return true;
    return answer.selected.length >= q.minSelections;
}

/**
 * Coerce a possibly-legacy answer into the current shape. Persisted
 * client cache (and rows answered before the schema evolved) may carry
 * `string[]` instead of `{ selected, other }` — never let that crash a
 * render.
 */
function asAnswer(raw: unknown): AgentQuestionAnswer {
    if (Array.isArray(raw)) {
        return {
            selected: raw.filter((s): s is string => typeof s === 'string'),
        };
    }
    if (raw && typeof raw === 'object') {
        const o = raw as { selected?: unknown; other?: unknown };
        return {
            selected: Array.isArray(o.selected)
                ? o.selected.filter((s): s is string => typeof s === 'string')
                : [],
            ...(typeof o.other === 'string' && o.other ? { other: o.other } : {}),
        };
    }
    return { selected: [] };
}

/** Human-readable recap of one answered sub-question. */
function answerSummary(answer: AgentQuestionAnswer): string {
    const parts = [...answer.selected];
    if (answer.other?.trim()) parts.push(`Other: “${answer.other.trim()}”`);
    return parts.length > 0 ? parts.join(', ') : '—';
}

function AnsweredRecap({ question }: { question: AgentQuestionClient }) {
    const caption = lockedCaption(question.status);
    if (caption) {
        return (
            <div className="w-full rounded-2xl border border-border bg-muted/40 px-3 py-2 text-[11px] italic text-muted-foreground">
                {caption}
            </div>
        );
    }
    return (
        <div className="w-full rounded-2xl border border-border bg-muted/40 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-success" />
                Your answer{question.questions.length > 1 ? 's' : ''}
            </div>
            <dl className="space-y-1 text-sm">
                {(question.questions ?? []).map((sub, i) => (
                    <div key={i} className="flex flex-wrap gap-x-1.5">
                        <dt className="text-muted-foreground">
                            {sub.header ?? sub.question}:
                        </dt>
                        <dd className="font-medium text-foreground">
                            {answerSummary(asAnswer(question.answers?.[i]))}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export function MultipleChoiceQuestion({
    question,
    onSubmit,
    isSubmitting,
}: MultipleChoiceQuestionProps) {
    const isPending = question.status === 'pending';
    const subs = Array.isArray(question.questions) ? question.questions : [];

    // Local pre-submit answers, one per sub-question.
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral pre-submit form state, like a text input
    const [draft, setDraft] = useState<AgentQuestionAnswer[]>(() =>
        subs.map(() => ({ selected: [] }))
    );

    if (!isPending) {
        return <AnsweredRecap question={question} />;
    }

    const patch = (qIndex: number, next: AgentQuestionAnswer) =>
        setDraft((cur) => cur.map((a, i) => (i === qIndex ? next : a)));

    const toggle = (qIndex: number, label: string) => {
        if (isSubmitting) return;
        const sub = subs[qIndex];
        const cur = draft[qIndex];
        if (!sub.multiSelect) {
            patch(qIndex, { ...cur, selected: [label] });
            return;
        }
        if (cur.selected.includes(label)) {
            patch(qIndex, {
                ...cur,
                selected: cur.selected.filter((l) => l !== label),
            });
        } else if (cur.selected.length < sub.maxSelections) {
            patch(qIndex, { ...cur, selected: [...cur.selected, label] });
        }
    };

    const setOther = (qIndex: number, other: string) => {
        if (isSubmitting) return;
        patch(qIndex, { ...draft[qIndex], other });
    };

    const canSubmit =
        !isSubmitting && subs.every((sub, i) => isSatisfied(sub, draft[i]));

    const submit = () => {
        onSubmit(
            draft.map((a) => ({
                selected: a.selected,
                ...(a.other?.trim() ? { other: a.other.trim() } : {}),
            }))
        );
    };

    return (
        <div className="w-full space-y-3 rounded-2xl border border-border bg-card/60 p-3">
            {subs.map((sub, qIndex) => {
                const answer = draft[qIndex];
                return (
                    <div key={qIndex} className="space-y-2">
                        <div className="flex items-start gap-2">
                            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                                {sub.header && (
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        {sub.header}
                                    </p>
                                )}
                                <p className="text-sm font-medium text-foreground">
                                    {sub.question}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {selectionHint(sub)}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {sub.options.map((option) => {
                                const isChosen = answer.selected.includes(
                                    option.label
                                );
                                return (
                                    <button
                                        key={option.label}
                                        type="button"
                                        onClick={() =>
                                            toggle(qIndex, option.label)
                                        }
                                        disabled={isSubmitting}
                                        aria-pressed={isChosen}
                                        className={cn(
                                            'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                                            isChosen
                                                ? 'border-primary/50 bg-primary/10 text-foreground'
                                                : 'border-border bg-background text-foreground',
                                            !isSubmitting &&
                                                'hover:border-primary/40 hover:bg-muted',
                                            isSubmitting && 'cursor-default'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                                                sub.multiSelect
                                                    ? 'rounded'
                                                    : 'rounded-full',
                                                isChosen
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-muted-foreground/40'
                                            )}
                                        >
                                            {isChosen && (
                                                <Check
                                                    className="h-3 w-3"
                                                    strokeWidth={3}
                                                />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block break-words">
                                                {option.label}
                                            </span>
                                            {option.description && (
                                                <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}

                            {sub.allowOther && (
                                <div
                                    className={cn(
                                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                                        answer.other?.trim()
                                            ? 'border-primary/50 bg-primary/10'
                                            : 'border-dashed border-muted-foreground/40 bg-background'
                                    )}
                                >
                                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                        Other
                                    </span>
                                    <input
                                        type="text"
                                        value={answer.other ?? ''}
                                        onChange={(e) =>
                                            setOther(qIndex, e.target.value)
                                        }
                                        disabled={isSubmitting}
                                        placeholder="Type your own answer…"
                                        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            <div className="flex items-center justify-end">
                <Button
                    type="button"
                    size="sm"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="h-8 rounded-full px-4"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Sending…
                        </>
                    ) : (
                        'Submit'
                    )}
                </Button>
            </div>
        </div>
    );
}

import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import { toStringId } from '@/server/template/utils';
import type {
    AgentQuestionAnswer,
    AgentQuestionClient,
    AgentQuestionDocument,
    AgentSubQuestion,
} from './types';

const COLLECTION = 'agentQuestions';
let collectionPromise: Promise<Collection<AgentQuestionDocument>> | null = null;

function getCollection(): Promise<Collection<AgentQuestionDocument>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<AgentQuestionDocument>(COLLECTION);
            await col.createIndex({ conversationId: 1, createdAt: 1 });
            await col.createIndex({ messageId: 1 });
            // 1-day TTL — a question is only useful while the turn that
            // asked it is alive. Stragglers self-clean.
            await col.createIndex(
                { createdAt: 1 },
                { expireAfterSeconds: 24 * 60 * 60 }
            );
            return col;
        })().catch((err) => {
            collectionPromise = null;
            throw err;
        });
    }
    return collectionPromise;
}

export interface CreateQuestionInput {
    userId: ObjectId;
    conversationId: ObjectId;
    messageId: ObjectId;
    /** The normalized question batch (defaults already applied). */
    questions: AgentSubQuestion[];
}

/** Insert a pending question batch. Returns the new row's id. */
export async function createQuestion(
    input: CreateQuestionInput
): Promise<ObjectId> {
    const col = await getCollection();
    const doc: AgentQuestionDocument = {
        _id: new ObjectId(),
        userId: input.userId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        questions: input.questions,
        status: 'pending',
        answers: input.questions.map(() => ({ selected: [] })),
        createdAt: new Date(),
    };
    await col.insertOne(doc);
    return doc._id;
}

export async function findQuestionById(
    id: ObjectId
): Promise<AgentQuestionDocument | null> {
    const col = await getCollection();
    return col.findOne({ _id: id });
}

export async function findQuestionsByConversationId(
    conversationId: ObjectId,
    userId: ObjectId
): Promise<AgentQuestionDocument[]> {
    const col = await getCollection();
    return col
        .find({ conversationId, userId })
        .sort({ createdAt: 1 })
        .toArray();
}

export type AnswerQuestionResult =
    | { ok: true; question: AgentQuestionDocument }
    | { ok: false; error: string };

/**
 * Validate a single sub-question's answer against its options +
 * min/max bounds + Other policy. Returns the normalized answer (known
 * labels in option order, plus a trimmed `other` when allowed) or an
 * error string.
 *
 * A non-empty `other` counts as an answer on its own — so the minimum-
 * selection requirement is waived when the user typed something there.
 */
function validateAnswer(
    sub: AgentSubQuestion,
    index: number,
    answer: AgentQuestionAnswer
): { ok: true; answer: AgentQuestionAnswer } | { ok: false; error: string } {
    const allowed = new Set(sub.options.map((o) => o.label));
    const unknown = answer.selected.filter((s) => !allowed.has(s));
    if (unknown.length > 0) {
        return {
            ok: false,
            error: `Question ${index + 1}: unknown option(s): ${unknown.join(', ')}`,
        };
    }
    // De-dupe + preserve option order.
    const selected = sub.options
        .map((o) => o.label)
        .filter((label) => answer.selected.includes(label));

    const other =
        sub.allowOther && answer.other && answer.other.trim()
            ? answer.other.trim()
            : undefined;

    if (selected.length > sub.maxSelections) {
        return {
            ok: false,
            error: `Question ${index + 1}: select at most ${sub.maxSelections} option(s).`,
        };
    }
    // The min is waived when the user provided free-text "Other".
    if (!other && selected.length < sub.minSelections) {
        return {
            ok: false,
            error: `Question ${index + 1}: select at least ${sub.minSelections} option(s)${
                sub.allowOther ? ' or fill in "Other"' : ''
            }.`,
        };
    }
    return { ok: true, answer: { selected, ...(other ? { other } : {}) } };
}

/**
 * Record the user's answers to the whole batch. Validates each sub-
 * question against its options + bounds, and only succeeds while the
 * row is still 'pending' (so a late answer after timeout/cancel can't
 * revive a dead question). Atomic: the find-and-update is guarded on
 * status.
 */
export async function answerQuestion(input: {
    id: ObjectId;
    userId: ObjectId;
    /** Per sub-question answer, index-aligned to `questions`. */
    answers: AgentQuestionAnswer[];
}): Promise<AnswerQuestionResult> {
    const col = await getCollection();
    const question = await col.findOne({ _id: input.id, userId: input.userId });
    if (!question) return { ok: false, error: 'Question not found.' };
    if (question.status !== 'pending') {
        return {
            ok: false,
            error: 'This question is no longer awaiting an answer.',
        };
    }
    if (input.answers.length !== question.questions.length) {
        return {
            ok: false,
            error: `Expected answers for ${question.questions.length} question(s), got ${input.answers.length}.`,
        };
    }

    const normalizedAnswers: AgentQuestionAnswer[] = [];
    for (let i = 0; i < question.questions.length; i++) {
        const result = validateAnswer(
            question.questions[i],
            i,
            input.answers[i] ?? { selected: [] }
        );
        if (!result.ok) return result;
        normalizedAnswers.push(result.answer);
    }

    const answeredAt = new Date();
    const updated = await col.findOneAndUpdate(
        { _id: input.id, userId: input.userId, status: 'pending' },
        { $set: { status: 'answered', answers: normalizedAnswers, answeredAt } },
        { returnDocument: 'after' }
    );
    if (!updated) {
        // Lost a race — something else flipped it out of 'pending'.
        return {
            ok: false,
            error: 'This question is no longer awaiting an answer.',
        };
    }
    return { ok: true, question: updated };
}

/**
 * Mark every still-pending question on a message as cancelled. Called
 * when the user cancels the assistant turn so the blocked `ask_user`
 * tool stops waiting and returns control to the agent.
 */
export async function cancelQuestionsForMessage(
    messageId: ObjectId
): Promise<void> {
    const col = await getCollection();
    await col.updateMany(
        { messageId, status: 'pending' },
        { $set: { status: 'cancelled' } }
    );
}

/** Flip a still-pending question to 'expired' (tool wait timed out). */
export async function expireQuestion(id: ObjectId): Promise<void> {
    const col = await getCollection();
    await col.updateOne(
        { _id: id, status: 'pending' },
        { $set: { status: 'expired' } }
    );
}

/**
 * Coerce a possibly-legacy stored answer into the current shape. Rows
 * created before the schema evolved may have `answers` as `string[][]`
 * (selected labels only) instead of `{ selected, other }[]`. TTL clears
 * them within a day, but until then the client must not choke.
 */
function normalizeStoredAnswer(raw: unknown): AgentQuestionAnswer {
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

/** Coerce a possibly-legacy stored sub-question into the current shape. */
function normalizeStoredSubQuestion(raw: unknown): AgentSubQuestion {
    const o = (raw ?? {}) as Record<string, unknown>;
    const options = Array.isArray(o.options)
        ? o.options.map((opt) =>
              typeof opt === 'string'
                  ? { label: opt }
                  : {
                        label: String((opt as { label?: unknown })?.label ?? ''),
                        ...((opt as { description?: unknown })?.description
                            ? {
                                  description: String(
                                      (opt as { description?: unknown }).description
                                  ),
                              }
                            : {}),
                    }
          )
        : [];
    const multiSelect =
        typeof o.multiSelect === 'boolean'
            ? o.multiSelect
            : o.allowMultiple === true;
    return {
        question: String(o.question ?? ''),
        ...(typeof o.header === 'string' ? { header: o.header } : {}),
        options,
        multiSelect,
        minSelections:
            typeof o.minSelections === 'number' ? o.minSelections : 1,
        maxSelections:
            typeof o.maxSelections === 'number'
                ? o.maxSelections
                : multiSelect
                  ? options.length
                  : 1,
        allowOther: o.allowOther === true,
    };
}

export function toQuestionClient(
    doc: AgentQuestionDocument
): AgentQuestionClient {
    // Legacy rows (pre multi-question / pre-Other) may be missing
    // `questions` or carry an old `answers` shape — normalize both.
    const legacy = doc as unknown as {
        questions?: unknown;
        answers?: unknown;
        question?: unknown;
    };
    const rawQuestions = Array.isArray(legacy.questions)
        ? legacy.questions
        : legacy.question !== undefined
          ? [legacy]
          : [];
    const questions = rawQuestions.map(normalizeStoredSubQuestion);
    const rawAnswers = Array.isArray(legacy.answers) ? legacy.answers : [];
    const answers = questions.map((_, i) =>
        normalizeStoredAnswer(rawAnswers[i])
    );

    return {
        id: toStringId(doc._id),
        conversationId: toStringId(doc.conversationId),
        messageId: toStringId(doc.messageId),
        questions,
        status: doc.status,
        answers,
        createdAt: doc.createdAt.toISOString(),
        answeredAt: doc.answeredAt ? doc.answeredAt.toISOString() : null,
    };
}

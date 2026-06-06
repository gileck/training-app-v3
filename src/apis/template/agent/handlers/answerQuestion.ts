/**
 * Record the user's answer to a multiple-choice question the agent
 * asked mid-turn.
 *
 * The agent's `ask_user` tool is blocked on the daemon polling this
 * question's row; flipping it to 'answered' here unblocks the tool,
 * which returns the selection to the model and the turn continues. We
 * don't touch the assistant message — the daemon owns its lifecycle.
 */

import type { ObjectId } from 'mongodb';
import {
    answerQuestion as answerQuestionRow,
    toQuestionClient,
} from '@/server/database/collections/template/agentQuestions/agentQuestions';
import { toQueryId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    AnswerQuestionRequest,
    AnswerQuestionResponse,
} from '../types';

export const answerQuestion = async (
    request: AnswerQuestionRequest,
    context: ApiHandlerContext
): Promise<AnswerQuestionResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.questionId) return { error: 'questionId is required' };
    if (
        !Array.isArray(request.answers) ||
        !request.answers.every(
            (a) =>
                a &&
                typeof a === 'object' &&
                Array.isArray(a.selected) &&
                a.selected.every((s) => typeof s === 'string') &&
                (a.other === undefined || typeof a.other === 'string')
        )
    ) {
        return {
            error: 'answers must be an array of { selected: string[]; other?: string }',
        };
    }

    try {
        const userId = toQueryId(context.userId) as ObjectId;
        const questionId = toQueryId(request.questionId) as ObjectId;

        const result = await answerQuestionRow({
            id: questionId,
            userId,
            answers: request.answers,
        });
        if (!result.ok) return { error: result.error };

        return { question: toQuestionClient(result.question) };
    } catch (error) {
        console.error('answerQuestion error:', error);
        return {
            error:
                error instanceof Error ? error.message : 'Failed to answer question',
        };
    }
};

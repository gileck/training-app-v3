import { AIModelAdapter } from '@/server/template/ai/baseModelAdapter';
import type { AIModelAdapterResponse } from '@/server/template/ai/types';
import { getModelById } from '@/server/template/ai/models';
import { SendChatMessageRequest, SendChatMessageResponse } from './types';
import { SEND_CHAT_MESSAGE } from './index';

export * from './index';

const process = async (request: SendChatMessageRequest): Promise<SendChatMessageResponse> => {
    try {
        const { modelId, text } = request;

        if (!text?.trim()) {
            return { error: 'No message provided' };
        }

        const selectedModelId = modelId || 'gemini-2.5-flash';
        const adapter = new AIModelAdapter(selectedModelId);

        const response: AIModelAdapterResponse<string> = await adapter.processPromptToText(text);
        const modelInfo = getModelById(selectedModelId);

        return {
            result: response.result,
            cost: {
                totalCost: response.cost.totalCost,
                modelId: selectedModelId,
                modelName: modelInfo.name,
            },
        };
    } catch (error) {
        console.error('Error in chat:', error);
        return {
            error: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
};

export const chatApiHandlers = {
    [SEND_CHAT_MESSAGE]: { process },
};

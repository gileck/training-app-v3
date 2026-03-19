export interface SendChatMessageRequest {
    modelId: string;
    text: string;
}

export interface ChatCost {
    totalCost: number;
    modelId: string;
    modelName: string;
}

export interface SendChatMessageResponse {
    result?: string;
    cost?: ChatCost;
    error?: string;
}

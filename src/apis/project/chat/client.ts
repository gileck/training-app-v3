import { ChatRequest, ChatResponse } from "./types";
import apiClient from "@/client/utils/apiClient";
import { name } from "./index";
import type { CacheResult } from "@/common/cache/types";

export { type ChatRequest, type ChatResponse };

/**
 * Send a chat message request to the API
 * @param request The chat request parameters
 * @returns Promise with the chat response
 */
export const sendChatMessage = (request: ChatRequest): Promise<CacheResult<ChatResponse>> => {
  return apiClient.call<ChatResponse, ChatRequest>(name, request);
};

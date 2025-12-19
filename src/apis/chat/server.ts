import { AIModelAdapter } from "../../server/ai/baseModelAdapter";
import { AIModelAdapterResponse } from "../../server/ai/types";
import { ChatRequest, ChatResponse } from "./types";
import { name } from "./index";

export * from "./index";

/**
 * Process a chat request and return a response
 * This function contains the core business logic for the chat API
 */
export const process = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const { modelId, text } = request;

    // Validate input
    if (!modelId || !text) {
      return {
        result: "",
        cost: { totalCost: 0 },
        error: "Missing required fields: modelId and text are required."
      };
    }

    // Initialize the AI model adapter
    const adapter = new AIModelAdapter(modelId);

    // Create a simple prompt
    const prompt = `User: ${text}\n\nAssistant:`;

    // Process the prompt and get the response
    const response: AIModelAdapterResponse<string> = await adapter.processPromptToText(prompt);

    // Return the response
    return {
      result: response.result,
      cost: response.cost
    };
  } catch (error) {
    console.error("Error processing AI request:", error);
    return {
      result: "",
      cost: { totalCost: 0 },
      error: `Error processing AI request: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const chatApiHandlers = {
  [name]: { process },
};

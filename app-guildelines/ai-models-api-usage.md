# AI Models API Usage Guidelines

## Core Principles

1. **NEVER use AI models directly** - Always use the adapter pattern
2. **All AI calls must be server-side only** - Never call AI APIs from client-side code
3. **All AI calls must include caching** - To reduce costs and improve performance
4. **All AI calls must include proper error handling** - Always return 200 status codes with error fields

## Adapter Pattern for AI Models

### Directory Structure

```
/src
  /ai
    /adapters
      /openai.ts       - OpenAI-specific implementation
      /anthropic.ts    - Anthropic-specific implementation
      /other-models.ts - Other model implementations
      /index.ts        - Exports all adapters
    /baseModelAdapter.ts - Base adapter class/interface
    /types.ts          - Shared types for AI models
```

### Using the AI Model Adapter

1. **Always initialize the adapter with a model ID**:
   ```typescript
   import { AIModelAdapter } from "../ai/baseModelAdapter";
   
   // Initialize with a specific model ID
   const adapter = new AIModelAdapter("model-id-here");
   ```

2. **Use the adapter's methods to process prompts**:
   ```typescript
   // For text completion
   const response = await adapter.processPromptToText(prompt);
   
   // For other response types (if implemented)
   const jsonResponse = await adapter.processPromptToJson(prompt);
   ```

3. **Always handle costs and errors properly**:
   ```typescript
   try {
     const response = await adapter.processPromptToText(prompt);
     
     // Handle the response
     console.log("Result:", response.result);
     console.log("Cost:", response.cost.totalCost);
     
     return {
       result: response.result,
       cost: response.cost
     };
   } catch (error) {
     console.error("Error with AI adapter:", error);
     return {
       result: "",
       cost: { totalCost: 0 },
       error: `AI service error: ${error instanceof Error ? error.message : String(error)}`
     };
   }
   ```

## Implementation Guidelines

1. **Model Selection**:
   - Use environment variables to configure default models
   - Allow overriding the model at runtime when needed
   - Keep a list of supported models in a central configuration

2. **Error Handling**:
   - Wrap all AI API calls in try/catch blocks
   - Always return proper error messages in the response
   - Never throw errors that would result in 500 status codes
   - Log errors for debugging but sanitize sensitive information

3. **Caching**:
   - Implement file-system caching for identical prompts
   - Use a deterministic hash of the prompt as the cache key
   - Include cache invalidation mechanisms
   - Make caching configurable (enable/disable) for development

4. **Cost Tracking**:
   - Always track and return the cost of each AI call
   - Implement budget limits to prevent excessive spending
   - Consider implementing usage quotas per user/session

5. **Security**:
   - Never expose API keys in client-side code
   - Sanitize all user input before sending to AI models
   - Implement content filtering for both input and output
   - Consider implementing rate limiting

## Example Usage in Server-Side Code

```typescript
import { AIModelAdapter } from "../ai/baseModelAdapter";
import { AIModelAdapterResponse } from "../ai/types";

async function generateAIResponse(userInput: string): Promise<{
  result: string;
  cost: { totalCost: number };
  error?: string;
}> {
  try {
    // Initialize the AI model adapter
    const adapter = new AIModelAdapter("default-model-id");

    // Create a prompt
    const prompt = `User: ${userInput}\n\nAssistant:`;

    // Process the prompt and get the response
    const response: AIModelAdapterResponse<string> = await adapter.processPromptToText(prompt);

    // Return the response
    return {
      result: response.result,
      cost: response.cost
    };
  } catch (error) {
    console.error("Error with AI adapter:", error);
    return {
      result: "",
      cost: { totalCost: 0 },
      error: `AI service error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
```

## What NOT to Do

1. **NEVER call AI APIs directly**:
   ```typescript
   // DON'T DO THIS
   import OpenAI from 'openai';
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   
   const response = await openai.chat.completions.create({
     model: "gpt-4",
     messages: [{ role: "user", content: "Hello!" }],
   });
   ```

2. **NEVER call AI APIs from client-side**:
   ```typescript
   // DON'T DO THIS in React components or other client-side code
   const callAI = async () => {
     const response = await fetch('https://api.openai.com/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`, // NEVER expose API keys in client code
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         model: 'gpt-4',
         messages: [{ role: 'user', content: userInput }],
       }),
     });
     
     const data = await response.json();
     // ...
   };
   ```

3. **NEVER hardcode model IDs**:
   ```typescript
   // DON'T DO THIS
   const adapter = new AIModelAdapter("gpt-4"); // Hardcoded model ID
   ```

4. **NEVER ignore costs**:
   ```typescript
   // DON'T DO THIS
   const response = await adapter.processPromptToText(prompt);
   return { result: response.result }; // Cost information is ignored
   ```

## Best Practices

1. Use environment variables for API keys and default model IDs
2. Implement proper caching to reduce costs
3. Track and monitor usage and costs
4. Implement rate limiting and budget controls
5. Handle errors gracefully and provide meaningful error messages
6. Always use the adapter pattern to abstract away specific AI provider implementations
7. Keep the adapter implementation flexible to easily switch between different AI providers
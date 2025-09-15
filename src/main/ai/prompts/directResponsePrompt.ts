/**
 * Direct response prompts for handling requests without tools
 */

export interface DirectResponsePromptParams {
  lastUserMessage?: string;
  planReasoning?: string;
}

export const createDirectResponsePrompt = (params: DirectResponsePromptParams): string => {
  const { lastUserMessage, planReasoning } = params;
  
  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

Based on analysis: ${planReasoning}

Provide a direct, helpful response.`;
};

export const createSwarmDirectResponsePrompt = (params: DirectResponsePromptParams): string => {
  const { lastUserMessage, planReasoning } = params;
  
  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

Based on your analysis: ${planReasoning}

Please provide a direct, helpful response without using any tools.`;
};

/**
 * Direct response prompts for handling requests without tools
 */

export interface DirectResponsePromptParams {
  lastUserMessage?: string;
  planReasoning?: string;
  todos?: Array<{
    id: string;
    text: string;
    completed: boolean;
    order: number;
  }>;
}

export const createDirectResponsePrompt = (params: DirectResponsePromptParams): string => {
  const { lastUserMessage, planReasoning } = params;

  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

Based on analysis: ${planReasoning}

Provide a direct, helpful response.`;
};

export const createSwarmDirectResponsePrompt = (params: DirectResponsePromptParams): string => {
  const { lastUserMessage, planReasoning, todos } = params;

  // Build todos context if available
  let todosContext = '';
  if (todos && todos.length > 0) {
    const todosList = todos.map((todo, idx) =>
      `${idx + 1}. ${todo.text}`
    ).join('\n');
    todosContext = `\n\nPlanned approach:\n${todosList}\n`;
  }

  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

Based on your analysis: ${planReasoning}${todosContext}

Please provide a direct, helpful response that addresses all aspects of the user's request without using any tools.`;
};

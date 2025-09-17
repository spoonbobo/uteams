/**
 * Synthesis prompts for combining and formatting agent results
 */

export interface SynthesisPromptParams {
  lastUserMessage?: string;
  planReasoning?: string;
  toolResults: string;
}

export const createSynthesisPrompt = (params: SynthesisPromptParams): string => {
  const { lastUserMessage, planReasoning, toolResults } = params;

  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

${planReasoning ? `Analysis: ${planReasoning}` : ''}

Results:
${toolResults}

Provide a clear, helpful response based on these results.
Do NOT mention tool names or technical details.
Focus on answering the user's question directly.`;
};

export interface SwarmSynthesisPromptParams {
  lastUserMessage?: string;
  planReasoning?: string;
  resultsContent: string;
  todos?: Array<{
    id: string;
    text: string;
    completed: boolean;
    order: number;
  }>;
  completedTodos?: Array<{
    id: string;
    text: string;
    completed: boolean;
    order: number;
  }>;
}

export const createSwarmSynthesisPrompt = (params: SwarmSynthesisPromptParams): string => {
  const { lastUserMessage, planReasoning, resultsContent, todos, completedTodos } = params;

  // Build todos context if available
  let todosContext = '';
  if (todos && todos.length > 0) {
    const todosList = todos.map((todo, idx) =>
      `${idx + 1}. ${todo.text} [${todo.completed ? '✓' : ' '}]`
    ).join('\n');
    todosContext = `\n\nTasks planned to address your request:\n${todosList}`;
  }

  // Build completed todos summary if available
  let completedContext = '';
  if (completedTodos && completedTodos.length > 0) {
    const completedList = completedTodos.map(todo => `- ${todo.text}`).join('\n');
    completedContext = `\n\nCompleted tasks:\n${completedList}`;
  }

  return `You are a helpful assistant synthesizing the results of a multi-step task.

Original user request: "${lastUserMessage}"

${planReasoning ? `Initial analysis: ${planReasoning}` : ''}${todosContext}${completedContext}

Information gathered from completing these tasks:
${resultsContent}

Based on the completed tasks and gathered information, provide a comprehensive response that:
1. Directly addresses the user's original request
2. Synthesizes all the gathered information coherently
3. Presents the information in a natural, conversational way
4. Ensures all aspects of the original request are covered

IMPORTANT:
- Do NOT include raw URLs, technical details, or tool output formatting
- Do NOT mention "Title:", "URL:", "Content:", or similar technical markers
- Do NOT list the tasks or mention them explicitly - focus on the results
- Provide a natural, conversational response that feels like a direct answer to the original question
- If the information is search results, summarize and synthesize the key points naturally`;
};

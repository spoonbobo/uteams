/**
 * Todo execution prompt for processing individual todos
 */

export interface TodoExecutionPromptParams {
  todoText: string;
  todoIndex: number;
  totalTodos: number;
  previousResults?: any;
  isAgent?: boolean;
}

export const createTodoExecutionPrompt = (params: TodoExecutionPromptParams): string => {
  const { todoText, todoIndex, totalTodos, previousResults, isAgent } = params;
  
  if (isAgent) {
    return `You are executing step ${todoIndex + 1} of ${totalTodos} in a task plan.

Current Task: "${todoText}"

${previousResults ? `Previous Results:\n${JSON.stringify(previousResults, null, 2)}\n` : ''}

IMPORTANT: When you complete this task, you MUST include the token "COMPLETED" in your response.
This signals that the task is done and the system can move to the next step.

Execute the task and provide the results. Remember to include "COMPLETED" when done.`;
  }
  
  // For synthesis/direct response
  return `You are executing step ${todoIndex + 1} of ${totalTodos} in a task plan.

Current Task: "${todoText}"

${previousResults ? `Context from previous steps:\n${JSON.stringify(previousResults, null, 2)}\n` : ''}

IMPORTANT: 
1. Focus ONLY on completing this specific task
2. When you finish this task, you MUST include the token "COMPLETED" in your response
3. This signals the system to move to the next step

Provide a focused response for this specific task. Include "COMPLETED" when done.`;
};

/**
 * Check if a response contains the completion token
 */
export const isTaskCompleted = (response: string): boolean => {
  return response.includes('COMPLETED') || response.includes('completed');
};

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
}

export const createSwarmSynthesisPrompt = (params: SwarmSynthesisPromptParams): string => {
  const { lastUserMessage, planReasoning, resultsContent } = params;
  
  return `You are a helpful assistant. The user asked: "${lastUserMessage}"

${planReasoning ? `Context: ${planReasoning}` : ''}

Information gathered:
${resultsContent}

Based on this information, provide a clear, helpful, and natural response to the user.
IMPORTANT:
- Do NOT include raw URLs, technical details, or tool output formatting
- Do NOT mention "Title:", "URL:", "Content:", or similar technical markers
- Provide a natural, conversational response
- Focus on answering what the user actually asked
- If the information is search results, summarize the key points naturally`;
};

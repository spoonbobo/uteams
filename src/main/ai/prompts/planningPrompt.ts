/**
 * Planning prompt for analyzing user requests and creating execution plans
 */

export interface PlanningPromptParams {
  userQuery: string;
  agentDescriptions: string;
  userProfile?: {
    name?: string;
    language?: string;
    context?: Record<string, any>;
  };
}

export const createPlanningPrompt = (params: PlanningPromptParams): string => {
  const { userQuery, agentDescriptions, userProfile } = params;
  
  return `You are a planning assistant. Analyze the user's request and create a plan with user-friendly task descriptions.

User Request: ${userQuery}

Available agents:
${agentDescriptions}

${userProfile ? `User Profile:\n- Name: ${userProfile.name || 'Unknown'}\n- Language: ${userProfile.language || 'English'}\n- Context: ${JSON.stringify(userProfile.context || {})}` : ''}

Analyze if this request needs tools/agents or can be answered directly.
Examples of requests that DON'T need tools:
- Greetings (hi, hello, how are you)
- General questions about capabilities
- Simple conversation
- Questions that can be answered from general knowledge

Examples that DO need tools:
- Web searches ("search for", "find information about", "what's the latest")
- Current information (weather, news, prices)
- Specific data retrieval
- Memory operations ("remember", "recall")

IMPORTANT: Use natural first-person language from the AI assistant's perspective.
Use varied, conversational phrasing to sound more natural and helpful.
Do NOT mention specific agent names (like "memory_agent", "tavily_agent", etc.). Instead, describe what you'll do directly.

Examples of good action descriptions (use variety):
- "Let me search for stored information about this topic"
- "I'll find the latest information on the web"
- "I can gather relevant details from web pages"
- "Let me check what I have in memory"
- "I'll provide a direct answer based on my knowledge"
- "I can look up information about this"
- "Let me see what I can find"
- "I'll help you by searching for details"

Respond in this format:
REASONING: [your reasoning in first person - don't mention agent names]
REQUIRES_TOOLS: [yes/no]
SELECTED_AGENT: [agent_name or none]
STEPS:
- [action using varied first-person phrasing - don't mention agent names]
- [next action using different phrasing - don't mention agent names]
...`;
};

/**
 * General Agent
 * Handles general tasks, synthesis, and direct responses that don't require specialized tools
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage
} from '@langchain/core/messages';
import {
  BaseAgent,
  AgentConfig,
  AgentState,
  AgentResult,
  AgentCapabilities
} from '../types/agent';

/**
 * General Agent
 * Processes general requests, synthesis, and formatting tasks
 */
export class GeneralAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      name: 'general_agent',
      description: 'General purpose agent for synthesis, formatting, and direct responses',
      capabilities: {
        webSearch: false,
        webScraping: false,
        screenCapture: false,
        dataAnalysis: false,
        toolExecution: false,
        canHandoff: true,
      },
      prompt: `You are a general purpose assistant. Your role is to:
1. Synthesize and format information from other agents
2. Provide direct responses to user queries
3. Format and present results in a clear, user-friendly way
4. Handle general tasks that don't require specialized tools
5. Complete todo tasks that involve synthesis or formatting

IMPORTANT: When executing a specific task:
- Focus on completing ONLY the requested task
- Include "COMPLETED" at the end of your response when the task is done
- This signals the system to move to the next step

When synthesizing:
- Present information clearly and concisely
- Use appropriate formatting (bullet points, sections, etc.)
- Maintain context from previous results
- Provide comprehensive yet readable responses`,
      handoffTargets: ['tavily_agent', 'playwright_agent', 'memory_agent'],
      llmConfig: {
        temperature: 0.0,
      },
    };

    super({ ...defaultConfig, ...config });
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'General purpose agent for synthesis, formatting, and direct responses. Handles tasks that don\'t require specialized tools.';
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapabilities {
    return this.config.capabilities;
  }

  /**
   * Check if this agent should handle the request
   */
  shouldHandle(state: AgentState): boolean {
    // General agent can handle anything, but typically handles:
    // - Synthesis tasks
    // - Formatting tasks
    // - Direct responses
    // - General questions

    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;

    const content = typeof lastMessage.content === 'string'
      ? lastMessage.content.toLowerCase()
      : '';

    // Keywords that indicate general/synthesis tasks
    const generalKeywords = [
      'synthesize', 'format', 'summarize', 'explain',
      'describe', 'present', 'organize', 'compile',
      'review', 'analyze', 'compare', 'contrast'
    ];

    // If it doesn't match specialized agents, general agent handles it
    const needsSpecializedAgent =
      content.includes('search') || content.includes('scrape') ||
      content.includes('remember') || content.includes('recall');

    return !needsSpecializedAgent || generalKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Execute the general agent
   */
  async execute(state: AgentState): Promise<AgentResult> {
    console.log(`🎯 General Agent executing for session ${state.sessionId}`);

    try {
      // Check if we're executing a specific todo
      let taskContext = '';
      let isTodoExecution = false;

      // Look for todo execution context in the last AI message
      const todoContextMessage = state.messages.filter(m => m._getType() === 'ai').pop();
      if (todoContextMessage && typeof todoContextMessage.content === 'string') {
        const content = todoContextMessage.content;
        if (content.includes('Current Task:') && content.includes('COMPLETED')) {
          taskContext = content;
          isTodoExecution = true;
          console.log(`🎯 General Agent: Executing todo task`);
        }
      }

      // Extract context from state
      const toolResults = (state as any).toolResults;
      const plan = (state as any).plan;

      // Build context for synthesis
      let contextPrompt = '';

      if (plan) {
        contextPrompt += `\nPlan Context:\n- Reasoning: ${plan.reasoning}\n`;
        if (plan.steps && plan.steps.length > 0) {
          contextPrompt += `- Steps: ${plan.steps.join(', ')}\n`;
        }
      }

      if (toolResults && toolResults.length > 0) {
        contextPrompt += '\nPrevious Results:\n';
        toolResults.forEach((result: any, index: number) => {
          if (typeof result === 'string') {
            contextPrompt += `${index + 1}. ${result.substring(0, 200)}...\n`;
          } else if (result.content) {
            contextPrompt += `${index + 1}. ${result.content.substring(0, 200)}...\n`;
          } else {
            contextPrompt += `${index + 1}. ${JSON.stringify(result).substring(0, 200)}...\n`;
          }
        });
      }

      // Create system message with context
      const systemMessage = new SystemMessage(`
You are a General Agent responsible for synthesis, formatting, and direct responses.

${isTodoExecution ? `You are executing a specific todo task. Focus ONLY on this task and include "COMPLETED" at the end when done.` : ''}

${contextPrompt}

Your task:
1. ${isTodoExecution ? 'Complete the specific todo task' : 'Provide a comprehensive response'}
2. Synthesize any available information from previous results
3. Format the response clearly and professionally
4. ${isTodoExecution ? 'Mark completion with "COMPLETED"' : 'Ensure the response is complete and helpful'}

Guidelines:
- Be concise yet comprehensive
- Use appropriate formatting (bullet points, sections, etc.)
- Maintain context from previous interactions
- Provide actionable and clear information
${isTodoExecution ? '- End with "COMPLETED" when the task is done' : ''}
`);

      // Get the user's original request
      const userMessages = state.messages.filter(m => m._getType() === 'human');
      const lastUserMessage = userMessages[userMessages.length - 1];

      // Prepare messages for LLM
      const messages = [
        systemMessage,
        ...(taskContext ? [new AIMessage(taskContext)] : []),
        ...(lastUserMessage ? [lastUserMessage] : []),
      ];

      // Generate response
      console.log(`🎯 General Agent: Generating response...`);
      const response = await this.llm.invoke(messages, {
        signal: state.signal,  // Pass abort signal for cancellation
      });

      let responseContent = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Add COMPLETED token if this is a todo execution and not already present
      if (isTodoExecution && !responseContent.includes('COMPLETED')) {
        responseContent += '\n\nCOMPLETED';
        console.log(`🎯 General Agent: Added COMPLETED token`);
      }

      console.log(`🎯 General Agent: Response generated (${responseContent.length} chars)`);

      return {
        messages: [new AIMessage(responseContent)],
        metadata: {
          ...state.metadata,
          generalAgentProcessed: true,
          todoCompleted: isTodoExecution,
        },
      };
    } catch (error) {
      console.error('General Agent execution error:', error);

      return {
        messages: [
          new AIMessage(`I encountered an error while processing your request: ${(error as Error).message}. Let me try to help you another way.`),
        ],
        metadata: {
          ...state.metadata,
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Determine if we should hand off to another agent
   */
  private shouldHandoff(content: string): boolean {
    const text = content.toLowerCase();

    // Hand off to specialized agents when needed
    if (text.includes('search') && text.includes('web')) {
      return true;
    }
    if (text.includes('scrape') || text.includes('extract')) {
      return true;
    }
    if (text.includes('remember') || text.includes('recall')) {
      return true;
    }

    return false;
  }

  /**
   * Determine which agent to hand off to
   */
  private determineHandoff(content: string): { targetAgent: string; reason: string } | null {
    const text = content.toLowerCase();

    if (text.includes('search') && text.includes('web')) {
      return {
        targetAgent: 'tavily_agent',
        reason: 'Web search required',
      };
    }

    if (text.includes('scrape') || text.includes('extract')) {
      return {
        targetAgent: 'playwright_agent',
        reason: 'Web scraping required',
      };
    }

    if (text.includes('remember') || text.includes('recall')) {
      return {
        targetAgent: 'memory_agent',
        reason: 'Memory operation required',
      };
    }

    return null;
  }
}

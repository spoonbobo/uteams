/**
 * Agent Types and Interfaces
 * Defines the base structure for all LangGraph agents
 */

import { ChatOpenAI } from '@langchain/openai';
import { Command } from '@langchain/langgraph';
import { 
  HumanMessage, 
  SystemMessage, 
  AIMessage,
  BaseMessage 
} from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Agent capabilities define what an agent can do
 */
export interface AgentCapabilities {
  /** Web search and browsing */
  webSearch?: boolean;
  /** Web scraping and interaction */
  webScraping?: boolean;
  /** Local screen content search */
  screenCapture?: boolean;
  /** Data analysis and predictions */
  dataAnalysis?: boolean;
  /** Tool execution */
  toolExecution?: boolean;
  /** Can hand off to other agents */
  canHandoff?: boolean;
  /** Memory management and recall */
  memory?: boolean;
  /** User preference management */
  userPreferences?: boolean;
  /** Conversation history management */
  conversationHistory?: boolean;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique agent identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Agent capabilities */
  capabilities: AgentCapabilities;
  /** System prompt for the agent */
  prompt: string;
  /** MCP tools available to this agent */
  tools?: any[];
  /** Other agents this agent can hand off to */
  handoffTargets?: string[];
  /** LLM model configuration */
  llmConfig?: {
    model?: string;
    temperature?: number;
  };
}

/**
 * Agent state for execution
 */
export interface AgentState {
  /** Current messages in the conversation */
  messages: BaseMessage[];
  /** Session identifier */
  sessionId: string;
  /** Current progress (0-100) */
  progress?: number;
  /** Current step/phase */
  currentStep?: string;
  /** Any errors encountered */
  errors?: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Output messages from the agent */
  messages: BaseMessage[];
  /** Updated state */
  state?: Partial<AgentState>;
  /** Command for navigation (handoffs) */
  command?: Command;
  /** Tool results if any */
  toolResults?: any[];
  /** Metadata about the execution */
  metadata?: Record<string, any>;
}

/**
 * Handoff information
 */
export interface HandoffInfo {
  /** Target agent name */
  targetAgent: string;
  /** Reason for handoff */
  reason?: string;
  /** Context to pass to target agent */
  context?: Record<string, any>;
  /** Messages to include in handoff */
  messages?: BaseMessage[];
}

/**
 * Base Agent Class
 * All agents should extend this class
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llm: ChatOpenAI;
  protected mcpTools: any[];
  protected handoffTools: Map<string, any>;

  constructor(config: AgentConfig, llm?: ChatOpenAI) {
    this.config = config;
    this.llm = llm || this.createLLM();
    this.mcpTools = config.tools || [];
    this.handoffTools = new Map();
    
    // Initialize handoff tools if agent can hand off
    if (config.capabilities.canHandoff && config.handoffTargets) {
      this.initializeHandoffTools();
    }
  }

  /**
   * Create LLM instance with agent-specific config
   */
  protected createLLM(): ChatOpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;
    
    if (!apiKey) {
      console.error('[Agent] OPENAI_API_KEY is not set. Please check your .env.production file.');
      throw new Error('OpenAI API key is required but not found in environment variables. Please set OPENAI_API_KEY in your .env.production file.');
    }
    
    console.log('[Agent] Creating LLM with baseURL:', baseURL || 'default OpenAI API');
    
    return new ChatOpenAI({
      model: this.config.llmConfig?.model || 'deepseek-chat',
      temperature: this.config.llmConfig?.temperature || 0.3,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
    });
  }

  /**
   * Initialize handoff tools for this agent
   */
  protected initializeHandoffTools(): void {
    if (!this.config.handoffTargets) return;

    for (const targetAgent of this.config.handoffTargets) {
      const toolName = `transfer_to_${targetAgent}`;
      const handoffTool = this.createHandoffTool(targetAgent);
      this.handoffTools.set(targetAgent, handoffTool);
    }
  }

  /**
   * Create a handoff tool for a specific target agent
   */
  protected createHandoffTool(targetAgent: string): any {
    const toolName = `transfer_to_${targetAgent}`;
    const toolDescription = `Transfer control to ${targetAgent} agent`;

    return tool(
      async (input: { reason?: string; context?: Record<string, any> }, config: any) => {
        // Create handoff command
        return new Command({
          goto: targetAgent,
          update: {
            messages: [
              new AIMessage({
                content: `Transferring to ${targetAgent}: ${input.reason || 'Specialized assistance needed'}`,
                name: this.config.name,
              }),
            ],
            metadata: {
              ...input.context,
              handoffFrom: this.config.name,
              handoffReason: input.reason,
            },
          },
          graph: Command.PARENT,
        });
      },
      {
        name: toolName,
        description: toolDescription,
        schema: z.object({
          reason: z.string().optional().describe('Reason for handoff'),
          context: z.record(z.any()).optional().describe('Context to pass to target agent'),
        }),
      }
    );
  }

  /**
   * Get all tools available to this agent (MCP + handoff tools)
   */
  getAllTools(): any[] {
    const tools = [...this.mcpTools];
    if (this.handoffTools.size > 0) {
      tools.push(...Array.from(this.handoffTools.values()));
    }
    return tools;
  }

  /**
   * Execute the agent with given state
   */
  abstract execute(state: AgentState): Promise<AgentResult>;

  /**
   * Check if agent can handle a specific request
   */
  canHandle(request: string): boolean {
    const text = request.toLowerCase();
    
    // Check capabilities against request
    if (this.config.capabilities.webSearch) {
      const webKeywords = ['search', 'web', 'internet', 'google', 'find online', 'news'];
      if (webKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.webScraping) {
      const scrapeKeywords = ['scrape', 'extract', 'fetch from', 'get data from', 'website'];
      if (scrapeKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.screenCapture) {
      const screenKeywords = ['screen', 'screenshot', 'window', 'clipboard', 'local', 'recent'];
      if (screenKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.dataAnalysis) {
      const analysisKeywords = ['analyze', 'predict', 'forecast', 'trend', 'statistics'];
      if (analysisKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.memory) {
      const memoryKeywords = ['remember', 'recall', 'memory', 'forget', 'save this', 'store'];
      if (memoryKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.userPreferences) {
      const prefKeywords = ['preference', 'settings', 'my name', 'my information', 'profile'];
      if (prefKeywords.some(k => text.includes(k))) return true;
    }
    
    if (this.config.capabilities.conversationHistory) {
      const historyKeywords = ['previous', 'last time', 'history', 'past conversation'];
      if (historyKeywords.some(k => text.includes(k))) return true;
    }
    
    return false;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * Create a handoff to another agent
   */
  protected createHandoff(handoffInfo: HandoffInfo): Command {
    return new Command({
      goto: handoffInfo.targetAgent,
      update: {
        messages: handoffInfo.messages || [],
        metadata: {
          handoffFrom: this.config.name,
          handoffReason: handoffInfo.reason,
          ...handoffInfo.context,
        },
      },
      graph: Command.PARENT,
    });
  }
}

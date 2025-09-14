/**
 * Agent Registry and Factory
 * Manages agent instances and provides factory methods
 */

import { ChatOpenAI } from '@langchain/openai';
import { BaseAgent, AgentConfig } from '../types/agent';
import { TavilyAgent } from './tavilyAgent';
import { PlaywrightAgent } from './playwrightAgent';
import { MemoryAgent } from './memoryAgent';
import { MCPClient } from '../utils/mcpClient';

/**
 * Agent types available in the system
 */
export enum AgentType {
  TAVILY = 'tavily_agent',
  PLAYWRIGHT = 'playwright_agent',
  MEMORY = 'memory_agent',
}

/**
 * Agent Registry
 * Singleton that manages all agent instances
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, BaseAgent>;
  private mcpClient: MCPClient | null = null;
  private llm: ChatOpenAI | null = null;

  private constructor() {
    this.agents = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Initialize registry with MCP client and LLM
   */
  async initialize(mcpClient: MCPClient, llm?: ChatOpenAI): Promise<void> {
    this.mcpClient = mcpClient;
    this.llm = llm || this.createDefaultLLM();
    
    // Initialize MCP client if not already initialized
    await this.mcpClient.initialize();
    
    // Create default agents
    await this.createDefaultAgents();
  }

  /**
   * Create default LLM instance
   */
  private createDefaultLLM(): ChatOpenAI {
    return new ChatOpenAI({
      model: 'deepseek-chat',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });
  }

  /**
   * Create default agents with MCP tools
   */
  private async createDefaultAgents(): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    const mcpTools = this.mcpClient.getTools();

    // Filter tools for each agent
    const tavilyTools = mcpTools.filter((t: any) => {
      const name = String(t?.name || '').toLowerCase();
      return name.includes('tavily');
    });

    const playwrightTools = mcpTools.filter((t: any) => {
      const name = String(t?.name || '').toLowerCase();
      return name.includes('playwright') || 
             name.includes('navigate') || 
             name.includes('screenshot') ||
             name.includes('click') ||
             name.includes('scrape');
    });


    // Create Tavily agent
    if (tavilyTools.length > 0) {
      const tavilyAgent = new TavilyAgent({
        tools: tavilyTools,
      });
      this.registerAgent(AgentType.TAVILY, tavilyAgent);
    }

    // Create Playwright agent
    if (playwrightTools.length > 0) {
      const playwrightAgent = new PlaywrightAgent({
        tools: playwrightTools,
      });
      this.registerAgent(AgentType.PLAYWRIGHT, playwrightAgent);
    }


    // Create Memory agent
    // Memory agent doesn't require specific MCP tools, it uses memory tools
    const memoryConfig: AgentConfig = {
      name: AgentType.MEMORY,
      description: 'Memory and preference management specialist',
      capabilities: {
        memory: true,
        userPreferences: true,
        conversationHistory: true,
        canHandoff: true,
      },
      prompt: 'You are a memory specialist that helps users manage their information and preferences.',
      handoffTargets: [AgentType.TAVILY, AgentType.PLAYWRIGHT],
    };
    
    const memoryAgent = new MemoryAgent(
      memoryConfig,
      this.llm!,
      [] // Memory agent uses its own memory tools, not MCP tools
    );
    this.registerAgent(AgentType.MEMORY, memoryAgent);
  }

  /**
   * Register an agent
   */
  registerAgent(name: string, agent: BaseAgent): void {
    this.agents.set(name, agent);
    console.log(`✅ Registered agent: ${name}`);
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Map<string, BaseAgent> {
    return this.agents;
  }

  /**
   * Create a custom agent
   */
  createCustomAgent(config: AgentConfig): BaseAgent {
    // This would be extended to support custom agent types
    throw new Error('Custom agents not yet implemented');
  }

  /**
   * Find best agent for a request
   */
  findBestAgent(request: string): BaseAgent | null {
    let bestAgent: BaseAgent | null = null;
    let bestScore = 0;

    for (const [name, agent] of this.agents) {
      if (agent.canHandle(request)) {
        // Simple scoring based on capability match
        const score = this.scoreAgent(agent, request);
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  /**
   * Score an agent for a request
   */
  private scoreAgent(agent: BaseAgent, request: string): number {
    const text = request.toLowerCase();
    const config = agent.getConfig();
    let score = 0;

    // Web search keywords
    if (config.capabilities.webSearch) {
      const keywords = ['search', 'find', 'web', 'internet', 'google', 'news'];
      score += keywords.filter(k => text.includes(k)).length * 10;
    }

    // Web scraping keywords
    if (config.capabilities.webScraping) {
      const keywords = ['scrape', 'extract', 'fetch', 'website', 'page'];
      score += keywords.filter(k => text.includes(k)).length * 10;
    }

    // Screen capture keywords
    if (config.capabilities.screenCapture) {
      const keywords = ['screen', 'screenshot', 'local', 'recent', 'clipboard'];
      score += keywords.filter(k => text.includes(k)).length * 10;
    }

    // Data analysis keywords
    if (config.capabilities.dataAnalysis) {
      const keywords = ['analyze', 'predict', 'forecast', 'trend', 'statistics'];
      score += keywords.filter(k => text.includes(k)).length * 10;
    }

    // Memory management keywords
    if (config.capabilities.memory) {
      const keywords = ['remember', 'recall', 'memory', 'forget', 'my name', 'my preference', 
                       'last time', 'previous', 'history', 'save this', 'store'];
      score += keywords.filter(k => text.includes(k)).length * 15; // Higher weight for memory
    }

    // User preferences keywords
    if (config.capabilities.userPreferences) {
      const keywords = ['preference', 'settings', 'profile', 'my information', 'update my'];
      score += keywords.filter(k => text.includes(k)).length * 12;
    }

    return score;
  }

  /**
   * Clean up all agents
   */
  async cleanup(): Promise<void> {
    // Cleanup MCP client
    if (this.mcpClient) {
      await this.mcpClient.cleanup();
    }
    
    // Clear agent registry
    this.agents.clear();
  }
}

// Export singleton instance
export const agentRegistry = AgentRegistry.getInstance();

// Export agent classes
export { TavilyAgent } from './tavilyAgent';
export { PlaywrightAgent } from './playwrightAgent';

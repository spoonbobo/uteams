/**
 * Multi-Agent Graph Builder
 * Main orchestrator that creates LangGraph state graphs with multiple agents and handoff capabilities
 * Based on LangGraph's multi-agent patterns: https://langchain-ai.github.io/langgraphjs/agents/multi-agent/
 */

import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { AgentRegistry } from '../agents';
import { MultiAgentState, MultiAgentConfig } from './types';
import { buildSwarmGraph } from './builders';

/**
 * Multi-Agent Graph Builder
 * Creates state graphs with multiple agents that can hand off control
 */
export class MultiAgentGraphBuilder {
  private registry: AgentRegistry;
  private config: MultiAgentConfig;
  private llm: ChatOpenAI;

  constructor(
    registry: AgentRegistry,
    config: MultiAgentConfig,
  ) {
    this.registry = registry;
    this.config = config;
    this.llm = config.llm || this.createDefaultLLM();
  }

  private createDefaultLLM(): ChatOpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;
    
    if (!apiKey) {
      console.error('[MultiAgentGraphBuilder] OPENAI_API_KEY is not set. Please check your .env.production file.');
      throw new Error('OpenAI API key is required but not found in environment variables. Please set OPENAI_API_KEY in your .env.production file.');
    }
    
    console.log('[MultiAgentGraphBuilder] Creating LLM with baseURL:', baseURL || 'default OpenAI API');
    
    return new ChatOpenAI({
      model: 'deepseek-chat',
      temperature: 0.3,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
    });
  }

  /**
   * Build the multi-agent graph using swarm architecture
   */
  buildGraph(): StateGraph<MultiAgentState> {
    return buildSwarmGraph(this.registry, this.config, this.llm, this.selectBestAgent.bind(this));
  }
  
  /**
   * Select the best agent for a query
   */
  private selectBestAgent(query: string): string {
    // Use registry's findBestAgent if available
    const bestAgent = this.registry.findBestAgent(query);
    if (bestAgent) {
      return bestAgent.getName();
    }
    
    // Fallback to first agent
    return this.config.defaultAgent || this.config.agents[0];
  }

  /**
   * Create a swarm agent configuration
   */
  static createSwarmConfig(
    agents: string[],
    defaultAgent?: string,
  ): MultiAgentConfig {
    return {
      agents,
      defaultAgent,
    };
  }
}

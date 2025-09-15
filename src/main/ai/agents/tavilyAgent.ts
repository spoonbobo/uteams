/**
 * Tavily Agent
 * Specializes in web search and information retrieval using Tavily MCP
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
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
  AgentResult 
} from '../types/agent';

export class TavilyAgent extends BaseAgent {
  private reactAgent: any;

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      name: 'tavily_agent',
      description: 'Web search and information retrieval specialist using Tavily',
      capabilities: {
        webSearch: true,
        webScraping: false,
        screenCapture: false,
        dataAnalysis: false,
        toolExecution: true,
        canHandoff: true,
      },
      prompt: `You are a web search specialist using Tavily. Your role is to:
1. Search for relevant information on the web
2. Provide accurate and up-to-date information
3. Include sources and citations when available
4. Focus on factual, reliable information
5. Hand off to other agents when specialized help is needed

IMPORTANT: When executing a specific task:
- Focus on completing ONLY the requested task
- Include "COMPLETED" at the end of your response when the task is done
- This signals the system to move to the next step

When searching, be specific with your queries and use advanced search options when available.
Prefer recent information and authoritative sources.`,
      handoffTargets: ['playwright_agent'],
      llmConfig: {
        temperature: 0.3,
      },
    };

    super({ ...defaultConfig, ...config });
    this.initializeReactAgent();
  }

  /**
   * Initialize the React agent with Tavily tools
   */
  private initializeReactAgent(): void {
    // Get Tavily-specific tools from MCP tools
    const tavilyTools = this.mcpTools.filter((t: any) => {
      const name = String(t?.name || '').toLowerCase();
      return name.includes('tavily');
    });

    // Add handoff tools
    const allTools = [...tavilyTools, ...Array.from(this.handoffTools.values())];

    // Create React agent using LangGraph
    this.reactAgent = createReactAgent({
      llm: this.llm,
      tools: allTools,
      messageModifier: this.config.prompt,
    });
  }

  /**
   * Execute web search with Tavily
   */
  async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Check if we're executing a specific todo
      let taskContext = '';
      let isTodoExecution = false;
      
      // Look for todo execution context in the last AI message
      const lastAiMessage = state.messages.filter(m => m._getType() === 'ai').pop();
      if (lastAiMessage && typeof lastAiMessage.content === 'string') {
        const content = lastAiMessage.content;
        if (content.includes('Current Task:') && content.includes('COMPLETED')) {
          taskContext = content;
          isTodoExecution = true;
        }
      }
      
      // Extract the latest user message
      const userMessages = state.messages.filter(m => m._getType() === 'human');
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      if (!lastUserMessage) {
        return {
          messages: [new AIMessage('No user query provided for web search')],
          state: { currentStep: 'error' },
        };
      }

      const query = lastUserMessage.content;

      // Check if we should hand off to another agent
      if (this.shouldHandoff(String(query))) {
        const handoffInfo = this.determineHandoff(String(query));
        if (handoffInfo) {
          return {
            messages: [
              new AIMessage(`Handing off to ${handoffInfo.targetAgent} for specialized assistance`)
            ],
            command: this.createHandoff(handoffInfo),
          };
        }
      }

      // Find Tavily search tool
      const tavilySearchTool = this.mcpTools.find((t: any) => {
        const name = String(t?.name || '').toLowerCase();
        return name.includes('tavily') && name.includes('search');
      });

      if (!tavilySearchTool) {
        return {
          messages: [new AIMessage('Tavily search tool not available')],
          state: { errors: ['Tavily tool not found'] },
        };
      }

      // Prepare search parameters
      const searchParams = await this.prepareSearchParams(String(query), state);

      // Execute search
      const searchResult = await tavilySearchTool.invoke(searchParams);

      // Process and format results
      let formattedResult = this.formatSearchResults(searchResult);
      
      // Add COMPLETED token if this is a todo execution
      if (isTodoExecution) {
        formattedResult += '\n\nCOMPLETED';
      }

      return {
        messages: [
          new AIMessage({
            content: formattedResult,
            name: this.config.name,
          }),
        ],
        state: {
          currentStep: 'search_complete',
          progress: 100,
        },
        toolResults: [searchResult],
        metadata: {
          toolUsed: 'tavily_search',
          searchParams,
          todoCompleted: isTodoExecution,
        },
      };
    } catch (error) {
      console.error('TavilyAgent execution error:', error);
      return {
        messages: [
          new AIMessage(`Search failed: ${(error as Error).message}`)
        ],
        state: {
          errors: [(error as Error).message],
          currentStep: 'error',
        },
      };
    }
  }

  /**
   * Prepare search parameters based on query and context
   */
  private async prepareSearchParams(
    query: string, 
    state: AgentState
  ): Promise<any> {
    // Use LLM to optimize search parameters
    const systemPrompt = new SystemMessage(
      'You are configuring a Tavily web search. Return strict JSON with these fields: ' +
      '{"query": "optimized search query", "search_depth": "basic|advanced", ' +
      '"max_results": number (5-10), "include_answer": true|false, ' +
      '"include_raw_content": false, "include_images": false}'
    );

    const userPrompt = new HumanMessage(
      `Original query: ${query}\n` +
      `Context: ${JSON.stringify(state.metadata || {})}\n` +
      'Generate optimal search parameters.'
    );

    try {
      const response = await this.llm.invoke([systemPrompt, userPrompt]);
      const content = String((response as any)?.content || '{}');
      const params = JSON.parse(content);
      
      // Validate and set defaults
      return {
        query: params.query || query,
        search_depth: params.search_depth || 'advanced',
        max_results: Math.min(params.max_results || 8, 10),
        include_answer: params.include_answer !== false,
        include_raw_content: false,
        include_images: false,
      };
    } catch {
      // Fallback to default params
      return {
        query,
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
      };
    }
  }

  /**
   * Format search results for output
   */
  private formatSearchResults(searchResult: any): string {
    let formatted = '## Web Search Results\n\n';

    // Add answer if available
    if (searchResult.answer) {
      formatted += `**Summary:** ${searchResult.answer}\n\n`;
    }

    // Add individual results
    if (Array.isArray(searchResult.results)) {
      formatted += '### Sources:\n';
      searchResult.results.forEach((result: any, index: number) => {
        formatted += `\n${index + 1}. **[${result.title}](${result.url})**\n`;
        if (result.content) {
          formatted += `   ${result.content.substring(0, 200)}...\n`;
        }
      });
    }

    // Add raw content if it's a string
    if (typeof searchResult === 'string') {
      formatted = searchResult;
    }

    return formatted;
  }

  /**
   * Determine if we should hand off to another agent
   */
  private shouldHandoff(query: string): boolean {
    const text = query.toLowerCase();
    
    // Hand off to playwright for scraping needs
    if (text.includes('scrape') || text.includes('extract') || 
        text.includes('interact with') || text.includes('click') ||
        text.includes('fill form')) {
      return true;
    }

    // Hand off to screenpipe for local content
    if (text.includes('screen') || text.includes('local') || 
        text.includes('recent') || text.includes('clipboard')) {
      return true;
    }

    return false;
  }

  /**
   * Determine which agent to hand off to
   */
  private determineHandoff(query: string): { targetAgent: string; reason: string } | null {
    const text = query.toLowerCase();

    if (text.includes('scrape') || text.includes('extract') || 
        text.includes('interact')) {
      return {
        targetAgent: 'playwright_agent',
        reason: 'Web scraping or interaction required',
      };
    }


    return null;
  }
}

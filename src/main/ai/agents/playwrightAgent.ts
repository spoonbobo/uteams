/**
 * Playwright Agent
 * Specializes in web scraping and browser automation using Playwright MCP
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

export class PlaywrightAgent extends BaseAgent {
  private reactAgent: any;

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      name: 'playwright_agent',
      description: 'Web scraping and browser automation specialist using Playwright',
      capabilities: {
        webSearch: false,
        webScraping: true,
        screenCapture: false,
        dataAnalysis: false,
        toolExecution: true,
        canHandoff: true,
      },
      prompt: `You are a web scraping and browser automation specialist using Playwright. Your role is to:
1. Navigate to websites and extract structured data
2. Interact with web pages (click buttons, fill forms, etc.)
3. Take screenshots of web pages
4. Handle dynamic content and wait for elements
5. Extract data from complex web structures
6. Hand off to other agents when different expertise is needed

IMPORTANT: When executing a specific task:
- Focus on completing ONLY the requested task
- Include "COMPLETED" at the end of your response when the task is done
- This signals the system to move to the next step

When scraping:
- Be respectful of robots.txt and rate limits
- Use efficient selectors (CSS or XPath)
- Handle errors gracefully
- Return structured, clean data`,
      handoffTargets: ['tavily_agent'],
      llmConfig: {
        temperature: 0.2,
      },
    };

    super({ ...defaultConfig, ...config });
    this.initializeReactAgent();
  }

  /**
   * Initialize the React agent with Playwright tools
   */
  private initializeReactAgent(): void {
    // Get Playwright-specific tools from MCP tools
    const playwrightTools = this.mcpTools.filter((t: any) => {
      const name = String(t?.name || '').toLowerCase();
      return name.includes('playwright') ||
             name.includes('navigate') ||
             name.includes('screenshot') ||
             name.includes('click') ||
             name.includes('scrape');
    });

    // Add handoff tools
    const allTools = [...playwrightTools, ...Array.from(this.handoffTools.values())];

    // Create React agent using LangGraph
    this.reactAgent = createReactAgent({
      llm: this.llm,
      tools: allTools,
      messageModifier: this.config.prompt,
    });
  }

  /**
   * Execute web scraping with Playwright
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
          messages: [new AIMessage('No scraping request provided')],
          state: { currentStep: 'error' },
        };
      }

      const request = String(lastUserMessage.content);

      // Check if we should hand off to another agent
      if (this.shouldHandoff(request)) {
        const handoffInfo = this.determineHandoff(request);
        if (handoffInfo) {
          return {
            messages: [
              new AIMessage(`Handing off to ${handoffInfo.targetAgent} for specialized assistance`)
            ],
            command: this.createHandoff(handoffInfo),
          };
        }
      }

      // Parse the scraping request
      const scrapingPlan = await this.planScraping(request, state);

      // Execute the scraping plan
      const results = await this.executeScraping(scrapingPlan);

      // Format results
      let formattedResult = this.formatScrapingResults(results);

      // Add COMPLETED token if this is a todo execution
      if (isTodoExecution) {
        formattedResult += '\n\nCOMPLETED';
      }

      // Return results
      return {
        messages: [
          new AIMessage({
            content: formattedResult,
            name: this.config.name,
          }),
        ],
        state: {
          currentStep: 'scraping_complete',
          progress: 100,
        },
        toolResults: results,
        metadata: {
          toolUsed: 'playwright',
          scrapingPlan,
          todoCompleted: isTodoExecution,
        },
      };
    } catch (error) {
      console.error('PlaywrightAgent execution error:', error);
      return {
        messages: [
          new AIMessage(`Scraping failed: ${(error as Error).message}`)
        ],
        state: {
          errors: [(error as Error).message],
          currentStep: 'error',
        },
      };
    }
  }

  /**
   * Plan the scraping operation
   */
  private async planScraping(
    request: string,
    state: AgentState
  ): Promise<any> {
    const systemPrompt = new SystemMessage(
      'You are planning a web scraping operation. Analyze the request and return a JSON plan: ' +
      '{"url": "target URL", "actions": [{"type": "navigate|click|fill|scrape|screenshot", ' +
      '"selector": "CSS selector", "value": "for fill actions", "wait": milliseconds}], ' +
      '"extractData": {"selector": "CSS selector", "attribute": "text|href|src|etc"}, ' +
      '"returnFormat": "json|text|html"}'
    );

    const userPrompt = new HumanMessage(
      `Scraping request: ${request}\n` +
      `Context: ${JSON.stringify(state.metadata || {})}\n` +
      'Create a scraping plan.'
    );

    try {
      const response = await this.llm.invoke([systemPrompt, userPrompt], {
        signal: state.signal,  // Pass abort signal for cancellation
      });
      const content = String((response as any)?.content || '{}');
      return JSON.parse(content);
    } catch {
      // Simple fallback plan
      return {
        url: this.extractUrl(request) || 'https://example.com',
        actions: [{ type: 'navigate' }, { type: 'scrape' }],
        returnFormat: 'text',
      };
    }
  }

  /**
   * Execute the scraping plan using Playwright tools
   */
  private async executeScraping(plan: any): Promise<any[]> {
    const results: any[] = [];

    try {
      // Find navigate tool
      const navigateTool = this.mcpTools.find((t: any) => {
        const name = String(t?.name || '').toLowerCase();
        return name.includes('navigate') || name.includes('goto');
      });

      // Find scrape tool
      const scrapeTool = this.mcpTools.find((t: any) => {
        const name = String(t?.name || '').toLowerCase();
        return name.includes('scrape') || name.includes('extract');
      });

      // Find screenshot tool
      const screenshotTool = this.mcpTools.find((t: any) => {
        const name = String(t?.name || '').toLowerCase();
        return name.includes('screenshot');
      });

      // Navigate to URL
      if (navigateTool && plan.url) {
        const navResult = await navigateTool.invoke({ url: plan.url }, {
          signal: state.signal,  // Pass abort signal for cancellation
        });
        results.push({ type: 'navigation', result: navResult });
      }

      // Execute actions
      if (Array.isArray(plan.actions)) {
        for (const action of plan.actions) {
          switch (action.type) {
            case 'scrape':
              if (scrapeTool) {
                const scrapeResult = await scrapeTool.invoke({
                  selector: action.selector || 'body',
                  attribute: action.attribute || 'text',
                }, {
                  signal: state.signal,  // Pass abort signal for cancellation
                });
                results.push({ type: 'scrape', result: scrapeResult });
              }
              break;

            case 'screenshot':
              if (screenshotTool) {
                const screenshotResult = await screenshotTool.invoke({
                  selector: action.selector,
                }, {
                  signal: state.signal,  // Pass abort signal for cancellation
                });
                results.push({ type: 'screenshot', result: screenshotResult });
              }
              break;

            case 'click':
              const clickTool = this.mcpTools.find((t: any) =>
                String(t?.name || '').toLowerCase().includes('click')
              );
              if (clickTool) {
                const clickResult = await clickTool.invoke({
                  selector: action.selector,
                }, {
                  signal: state.signal,  // Pass abort signal for cancellation
                });
                results.push({ type: 'click', result: clickResult });
              }
              break;

            case 'fill':
              const fillTool = this.mcpTools.find((t: any) =>
                String(t?.name || '').toLowerCase().includes('fill')
              );
              if (fillTool) {
                const fillResult = await fillTool.invoke({
                  selector: action.selector,
                  value: action.value,
                }, {
                  signal: state.signal,  // Pass abort signal for cancellation
                });
                results.push({ type: 'fill', result: fillResult });
              }
              break;
          }

          // Wait if specified
          if (action.wait) {
            await new Promise(resolve => setTimeout(resolve, action.wait));
          }
        }
      }

      // Extract specific data if requested
      if (plan.extractData && scrapeTool) {
        const extractResult = await scrapeTool.invoke({
          selector: plan.extractData.selector,
          attribute: plan.extractData.attribute || 'text',
        }, {
          signal: state.signal,  // Pass abort signal for cancellation
        });
        results.push({ type: 'extract', result: extractResult });
      }

    } catch (error) {
      console.error('Scraping execution error:', error);
      results.push({ type: 'error', error: (error as Error).message });
    }

    return results;
  }

  /**
   * Format scraping results for output
   */
  private formatScrapingResults(results: any[]): string {
    let formatted = '## Web Scraping Results\n\n';

    for (const result of results) {
      switch (result.type) {
        case 'navigation':
          formatted += `✅ **Navigated to page**\n\n`;
          break;

        case 'scrape':
          formatted += `### Scraped Content:\n`;
          if (typeof result.result === 'string') {
            formatted += `${result.result.substring(0, 500)}...\n\n`;
          } else {
            formatted += `\`\`\`json\n${JSON.stringify(result.result, null, 2)}\n\`\`\`\n\n`;
          }
          break;

        case 'extract':
          formatted += `### Extracted Data:\n`;
          formatted += `\`\`\`json\n${JSON.stringify(result.result, null, 2)}\n\`\`\`\n\n`;
          break;

        case 'screenshot':
          formatted += `📸 **Screenshot captured**\n\n`;
          break;

        case 'click':
          formatted += `🖱️ **Clicked element**\n\n`;
          break;

        case 'fill':
          formatted += `✏️ **Filled form field**\n\n`;
          break;

        case 'error':
          formatted += `❌ **Error:** ${result.error}\n\n`;
          break;
      }
    }

    return formatted;
  }

  /**
   * Extract URL from request text
   */
  private extractUrl(text: string): string | null {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
  }

  /**
   * Determine if we should hand off to another agent
   */
  private shouldHandoff(request: string): boolean {
    const text = request.toLowerCase();

    // Hand off to tavily for general web search
    if (text.includes('search') && !text.includes('scrape')) {
      return true;
    }

    // Hand off to screenpipe for local content
    if (text.includes('screen') || text.includes('local') ||
        text.includes('clipboard')) {
      return true;
    }

    return false;
  }

  /**
   * Determine which agent to hand off to
   */
  private determineHandoff(request: string): { targetAgent: string; reason: string } | null {
    const text = request.toLowerCase();

    if (text.includes('search') && !text.includes('scrape')) {
      return {
        targetAgent: 'tavily_agent',
        reason: 'Web search required instead of scraping',
      };
    }


    return null;
  }
}

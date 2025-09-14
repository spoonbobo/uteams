/**
 * Multi-Agent Graph Builder
 * Creates LangGraph state graphs with multiple agents and handoff capabilities
 * Based on LangGraph's multi-agent patterns: https://langchain-ai.github.io/langgraphjs/agents/multi-agent/
 */

import { StateGraph, END, START, Command, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, ToolMessage, AIMessage } from '@langchain/core/messages';
import { AgentRegistry } from '../agents';

/**
 * Multi-agent state with message history and memory support
 */
export interface MultiAgentState {
  messages: BaseMessage[];
  activeAgent?: string;
  sessionId: string;
  metadata?: Record<string, any>;
  // Memory-related fields
  threadId?: string;
  userId?: string;
  userProfile?: {
    name?: string;
    language?: string;
    context?: Record<string, any>;
  };
  // Planning and reasoning fields
  plan?: {
    steps: string[];
    reasoning: string;
    requiresTools: boolean;
    selectedAgent?: string;
  };
  toolResults?: any[];
  needsSynthesis?: boolean;
}

/**
 * Multi-agent architecture type
 */
export enum MultiAgentArchitecture {
  SUPERVISOR = 'supervisor',  // Central supervisor coordinates agents
  SWARM = 'swarm',           // Agents hand off control dynamically
}

/**
 * Multi-agent graph configuration
 */
export interface MultiAgentConfig {
  architecture: MultiAgentArchitecture;
  agents: string[];  // Agent names to include
  defaultAgent?: string;  // Default/starting agent
  supervisorPrompt?: string;  // Custom supervisor prompt
  llm?: ChatOpenAI;
  enableMemory?: boolean;  // Enable memory features
}

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
   * Build the multi-agent graph based on architecture
   */
  buildGraph(): StateGraph<MultiAgentState> {
    switch (this.config.architecture) {
      case MultiAgentArchitecture.SUPERVISOR:
        return this.buildSupervisorGraph();
      case MultiAgentArchitecture.SWARM:
        return this.buildSwarmGraph();
      default:
        throw new Error(`Unknown architecture: ${this.config.architecture}`);
    }
  }

  /**
   * Build supervisor-based multi-agent graph
   * The supervisor decides which agent to invoke based on the task
   */
  private buildSupervisorGraph(): StateGraph<MultiAgentState> {
    const graph = new StateGraph<MultiAgentState>({
      channels: {
        messages: { 
          reducer: (x: BaseMessage[], y: BaseMessage[]) => [...x, ...y],
          default: () => [],
        },
        activeAgent: { reducer: (x: any, y: any) => y ?? x },
        sessionId: { reducer: (x: any, y: any) => y ?? x },
        metadata: { reducer: (x: any, y: any) => ({ ...(x ?? {}), ...(y ?? {}) }) },
        threadId: { reducer: (x: any, y: any) => y ?? x },
        userId: { reducer: (x: any, y: any) => y ?? x },
        userProfile: { reducer: (x: any, y: any) => ({ ...(x ?? {}), ...(y ?? {}) }) },
        plan: { reducer: (x: any, y: any) => y ?? x },
        toolResults: { 
          reducer: (x: any[], y: any[]) => [...(x || []), ...(y || [])],
          default: () => [],
        },
        needsSynthesis: { reducer: (x: any, y: any) => y ?? x },
      },
    } as any);

    // Add supervisor node with planning capabilities
    (graph as any).addNode('supervisor', async (state: MultiAgentState) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage) {
        return { activeAgent: this.config.defaultAgent || this.config.agents[0] };
      }
      
      const userQuery = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);

      // Use LLM to plan and decide which agent to invoke
      const agentDescriptions = this.config.agents.map(name => {
        const agent = this.registry.getAgent(name);
        return agent ? `- ${name}: ${agent.getDescription()}` : '';
      }).filter(Boolean).join('\n');

      // Extract course context if available
      const courseMemory = state.metadata?.courseMemory;
      if (courseMemory) {
        console.log(`[Supervisor] 📚 Using course context for planning: ${courseMemory.courseShortName}`);
      }
      const courseContextInfo = courseMemory ? `
Current Course Context:
- Course: ${courseMemory.courseShortName} - ${courseMemory.courseName}
- ${courseMemory.assignments?.length || 0} assignments
- ${courseMemory.students?.length || 0} students enrolled
- ${courseMemory.activities?.length || 0} activities
${courseMemory.summary ? `- Summary: ${courseMemory.summary}` : ''}
` : '';

      const prompt = this.config.supervisorPrompt || 
        `You are a supervisor managing multiple specialized agents. Analyze the request and create a user-friendly plan.
${courseContextInfo}        
Available agents:
${agentDescriptions}

User request: ${userQuery}

${state.userProfile ? `User Profile:\n- Name: ${state.userProfile.name || 'Unknown'}\n- Language: ${state.userProfile.language || 'English'}` : ''}

IMPORTANT: Use first-person language from the AI assistant's perspective when analyzing and describing tasks.
Do NOT mention specific agent names (like "memory_agent" or "tavily_agent"). Instead, describe what YOU will do directly.
For example: "I will search for stored information" instead of "I will use memory_agent to search".

Provide:
1. Brief reasoning about the request (in first person)
2. Whether tools/agents are needed
3. Which agent should handle this (or 'none' if no tools needed)

Format:
REASONING: [your analysis in first person - don't mention agent names]
REQUIRES_TOOLS: [yes/no]
AGENT: [agent_name or none]`;

      try {
        const response = await this.llm.invoke(prompt);
        const content = String(response.content);
        
        // Parse response
        const reasoningMatch = content.match(/REASONING:\s*(.+?)(?=\nREQUIRES_TOOLS:|$)/s);
        const requiresToolsMatch = content.match(/REQUIRES_TOOLS:\s*(yes|no)/i);
        const agentMatch = content.match(/AGENT:\s*(\w+(?:_agent)?|none)/i);
        
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Analyzing request...';
        const requiresTools = requiresToolsMatch ? requiresToolsMatch[1].toLowerCase() === 'yes' : true;
        const selectedAgent = agentMatch && agentMatch[1].toLowerCase() !== 'none'
          ? agentMatch[1].replace('_agent', '')
          : null;
        
        // Create plan with user-friendly steps
        const friendlyStep = selectedAgent 
          ? `I will ${selectedAgent === 'memory' ? 'search for and retrieve stored information' :
              selectedAgent === 'tavily' ? 'search the web for relevant information' :
              selectedAgent === 'playwright' ? 'gather information from web pages' :
              'process your request using specialized tools'}`
          : 'I will provide a direct response';
          
        const plan = {
          reasoning,
          requiresTools,
          selectedAgent: selectedAgent ? selectedAgent + '_agent' : null,
          steps: [friendlyStep],
        };
        
        // If no tools needed, go to synthesis for direct response
        if (!requiresTools) {
          return {
            plan,
            needsSynthesis: true,
            activeAgent: 'synthesis' as any,
          };
        }
        
        // Validate agent exists
        const agentName = this.config.agents.find(a => a.includes(selectedAgent || '')) || 
                         this.config.defaultAgent || 
                         this.config.agents[0];

        return { 
          activeAgent: agentName,
          plan,
        };
      } catch (error) {
        console.error('Supervisor error:', error);
        // Fallback to default
        return { activeAgent: this.config.defaultAgent || this.config.agents[0] };
      }
    });
    
    // Add synthesis node for supervisor architecture too
    (graph as any).addNode('synthesis', async (state: MultiAgentState) => {
      const lastUserMessage = state.messages.filter(m => m._getType() === 'human').pop();
      const agentMessages = state.messages.filter(m => m._getType() === 'ai');
      const lastAgentMessage = agentMessages[agentMessages.length - 1];
      
      // Synthesize tool results or provide direct response
      if (state.toolResults && state.toolResults.length > 0) {
        const synthesisPrompt = `You are a helpful assistant. The user asked: "${lastUserMessage?.content}"

${state.plan ? `Analysis: ${state.plan.reasoning}` : ''}

Results:
${JSON.stringify(state.toolResults, null, 2)}

Provide a clear, helpful response based on these results.
Do NOT mention tool names or technical details.
Focus on answering the user's question directly.`;
        
        try {
          const response = await this.llm.invoke(synthesisPrompt);
          return {
            messages: [new AIMessage(String(response.content))],
            needsSynthesis: false,
          };
        } catch (error) {
          console.error('Synthesis error:', error);
          return {
            messages: lastAgentMessage ? [lastAgentMessage] : [new AIMessage('I processed your request.')],
            needsSynthesis: false,
          };
        }
      }
      
      // Direct response without tools
      if (state.plan && !state.plan.requiresTools) {
        const directPrompt = `You are a helpful assistant. The user asked: "${lastUserMessage?.content}"

Based on analysis: ${state.plan.reasoning}

Provide a direct, helpful response.`;
        
        try {
          const response = await this.llm.invoke(directPrompt);
          return {
            messages: [new AIMessage(String(response.content))],
            needsSynthesis: false,
          };
        } catch (error) {
          console.error('Direct response error:', error);
          return {
            messages: [new AIMessage('I understand. ' + (state.plan?.reasoning || 'Let me help you.'))],
            needsSynthesis: false,
          };
        }
      }
      
      return {
        messages: lastAgentMessage ? [lastAgentMessage] : [new AIMessage('Request processed.')],
        needsSynthesis: false,
      };
    });

    // Add agent nodes with improved handling
    for (const agentName of this.config.agents) {
      const agent = this.registry.getAgent(agentName);
      if (!agent) continue;

      (graph as any).addNode(agentName, async (state: MultiAgentState) => {
        console.log(`🔧 Supervisor: Executing agent ${agentName}`);
        
        const result = await agent.execute({
          messages: state.messages,
          sessionId: state.sessionId,
          metadata: {
            ...state.metadata,
            plan: state.plan,
          },
        });

        // Handle handoff commands
        if (result.command) {
          return result.command;
        }
        
        // Collect tool results
        const toolResults = result.toolResults || [];
        
        // Check for raw tool output that needs synthesis
        const hasRawOutput = result.messages.some(m => {
          const content = typeof m.content === 'string' ? m.content : '';
          return content.includes('Title:') && content.includes('URL:') ||
                 content.includes('Detailed Results:') ||
                 content.length > 1000;
        });
        
        // Store tool results and mark for synthesis if needed
        return {
          messages: result.messages,
          metadata: result.metadata,
          toolResults: [...(state.toolResults || []), ...toolResults,
                       ...result.messages.filter(m => {
                         const content = typeof m.content === 'string' ? m.content : '';
                         return content.includes('Title:') || content.includes('Detailed Results:');
                       }).map(m => ({ type: 'raw_output', content: m.content }))],
          needsSynthesis: hasRawOutput || toolResults.length > 0,
        };
      });
    }

    // Add edges
    const g: any = graph;
    g.addEdge(START, 'supervisor');
    
    // Supervisor routes to agents or synthesis
    g.addConditionalEdges(
      'supervisor',
      (state: MultiAgentState) => {
        if (state.needsSynthesis) {
          return 'synthesis';
        }
        return state.activeAgent || this.config.agents[0];
      },
      Object.fromEntries([
        ...this.config.agents.map(a => [a, a]),
        ['synthesis', 'synthesis'],
      ])
    );

    // Agents route to synthesis if needed, otherwise back to supervisor
    for (const agentName of this.config.agents) {
      g.addConditionalEdges(
        agentName,
        (state: MultiAgentState) => {
          // If needs synthesis, go there
          if (state.needsSynthesis) {
            return 'synthesis';
          }
          
          // Check if we should continue or end
          const lastMessage = state.messages[state.messages.length - 1];
          const content = typeof lastMessage?.content === 'string' ? lastMessage.content :
                         typeof lastMessage?.content === 'object' ? JSON.stringify(lastMessage.content) : '';
          if (content.includes('DONE') || content.includes('Complete')) {
            return 'synthesis';
          }
          return 'supervisor';
        },
        { supervisor: 'supervisor', synthesis: 'synthesis', [END]: END }
      );
    }
    
    // Synthesis always ends
    g.addEdge('synthesis', END);

    return graph;
  }

  /**
   * Build swarm-based multi-agent graph
   * Agents can hand off control to each other dynamically
   */
  private buildSwarmGraph(): StateGraph<MultiAgentState> {
    const graph = new StateGraph<MultiAgentState>({
      channels: {
        messages: { 
          reducer: (x: BaseMessage[], y: BaseMessage[]) => [...x, ...y],
          default: () => [],
        },
        activeAgent: { reducer: (x: any, y: any) => y ?? x },
        sessionId: { reducer: (x: any, y: any) => y ?? x },
        metadata: { reducer: (x: any, y: any) => ({ ...(x ?? {}), ...(y ?? {}) }) },
        threadId: { reducer: (x: any, y: any) => y ?? x },
        userId: { reducer: (x: any, y: any) => y ?? x },
        userProfile: { reducer: (x: any, y: any) => ({ ...(x ?? {}), ...(y ?? {}) }) },
        plan: { reducer: (x: any, y: any) => y ?? x },
        toolResults: { 
          reducer: (x: any[], y: any[]) => [...(x || []), ...(y || [])],
          default: () => [],
        },
        needsSynthesis: { reducer: (x: any, y: any) => y ?? x },
      },
    } as any);
    
    // Add planning node
    (graph as any).addNode('planner', async (state: MultiAgentState) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage) {
        return { activeAgent: this.config.defaultAgent || this.config.agents[0] };
      }
      
      const userQuery = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);
      
      // Create planning prompt
      const planningPrompt = `You are a planning assistant. Analyze the user's request and create a plan with user-friendly task descriptions.

User Request: ${userQuery}

Available agents:
${this.config.agents.map(name => {
  const agent = this.registry.getAgent(name);
  return agent ? `- ${name}: ${agent.getDescription()}` : '';
}).filter(Boolean).join('\n')}

${state.userProfile ? `User Profile:\n- Name: ${state.userProfile.name || 'Unknown'}\n- Language: ${state.userProfile.language || 'English'}\n- Context: ${JSON.stringify(state.userProfile.context || {})}` : ''}

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

IMPORTANT: Use first-person language from the AI assistant's perspective throughout your response.
Write as if you are the AI explaining what you understand and what you plan to do.
Do NOT mention specific agent names (like "memory_agent", "tavily_agent", etc.). Instead, describe what YOU will do directly.
For example: "I will search for stored information" instead of "I will ask memory_agent to search".

Respond in this format:
REASONING: [your reasoning in first person - don't mention agent names]
REQUIRES_TOOLS: [yes/no]
SELECTED_AGENT: [agent_name or none]
STEPS:
- [action in first person - don't mention agent names]
- [next action in first person - don't mention agent names]
...`;
      
      try {
        console.log('🎯 [PLANNER] Invoking LLM with prompt...');
        const planResponse = await this.llm.invoke(planningPrompt);
        const planContent = String(planResponse.content);
        
        console.log('🎯 [PLANNER] Raw LLM response:', planContent.substring(0, 500));
        
        // Parse the plan
        const reasoningMatch = planContent.match(/REASONING:\s*(.+?)(?=\nREQUIRES_TOOLS:|$)/s);
        const requiresToolsMatch = planContent.match(/REQUIRES_TOOLS:\s*(yes|no)/i);
        const selectedAgentMatch = planContent.match(/SELECTED_AGENT:\s*(\w+(?:_agent)?|none)/i);
        const stepsMatch = planContent.match(/STEPS:\s*([\s\S]+?)(?=$)/s);
        
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Analyzing request...';
        const requiresTools = requiresToolsMatch ? requiresToolsMatch[1].toLowerCase() === 'yes' : false;
        const selectedAgent = selectedAgentMatch && selectedAgentMatch[1].toLowerCase() !== 'none' 
          ? selectedAgentMatch[1].replace('_agent', '') + '_agent'
          : null;
        const steps = stepsMatch 
          ? stepsMatch[1].split('\n').filter(s => s.trim().startsWith('-')).map(s => s.replace(/^-\s*/, '').trim())
          : ['Process user request'];
        
        const plan = {
          reasoning,
          requiresTools,
          selectedAgent,
          steps,
        };
        
        // Log the plan creation
        console.log('🎯 [PLANNER] Created plan:', {
          reasoning: plan.reasoning,
          requiresTools: plan.requiresTools,
          selectedAgent: plan.selectedAgent,
          stepsCount: plan.steps.length,
          steps: plan.steps,
        });
        
        // If no tools needed, go directly to synthesis
        if (!requiresTools) {
          console.log('🎯 [PLANNER] No tools required, routing to synthesis');
          const result = {
            plan,
            needsSynthesis: true,
            activeAgent: 'synthesis' as any,
          };
          console.log('🎯 [PLANNER] Returning:', Object.keys(result));
          return result;
        }
        
        // Route to selected agent
        const agentToUse = selectedAgent || this.selectBestAgent(userQuery);
        console.log(`🎯 [PLANNER] Tools required, routing to: ${agentToUse}`);
        const result = {
          plan,
          activeAgent: agentToUse,
        };
        console.log('🎯 [PLANNER] Returning:', Object.keys(result));
        return result;
      } catch (error) {
        console.error('Planning error:', error);
        // Fallback to default agent selection
        return {
          activeAgent: this.selectBestAgent(userQuery),
        };
      }
    });
    
    // Add synthesis node to format final responses
    (graph as any).addNode('synthesis', async (state: MultiAgentState) => {
      const lastUserMessage = state.messages.filter(m => m._getType() === 'human').pop();
      const agentMessages = state.messages.filter(m => m._getType() === 'ai');
      const lastAgentMessage = agentMessages[agentMessages.length - 1];
      
      // Synthesize any tool or agent results
      if (state.toolResults && state.toolResults.length > 0) {
        // Extract the actual content from tool results
        const resultsContent = state.toolResults.map(r => {
          if (typeof r === 'string') return r;
          if (r.type === 'agent_output' || r.type === 'raw_output') {
            return r.content;
          }
          return JSON.stringify(r);
        }).join('\n\n');
        
        const synthesisPrompt = `You are a helpful assistant. The user asked: "${lastUserMessage?.content}"

${state.plan ? `Context: ${state.plan.reasoning}` : ''}

Information gathered:
${resultsContent}

Based on this information, provide a clear, helpful, and natural response to the user.
IMPORTANT:
- Do NOT include raw URLs, technical details, or tool output formatting
- Do NOT mention "Title:", "URL:", "Content:", or similar technical markers
- Provide a natural, conversational response
- Focus on answering what the user actually asked
- If the information is search results, summarize the key points naturally`;
        
        try {
          const synthesisResponse = await this.llm.invoke(synthesisPrompt);
          return {
            messages: [new AIMessage(String(synthesisResponse.content))],
            needsSynthesis: false,
          };
        } catch (error) {
          console.error('Synthesis error:', error);
          // Fallback: try to extract key information
          const fallbackResponse = 'I found some information for you. ' + 
            (resultsContent.length > 500 ? resultsContent.substring(0, 500) + '...' : resultsContent);
          return {
            messages: [new AIMessage(fallbackResponse)],
            needsSynthesis: false,
          };
        }
      }
      
      // If no tools were needed, generate direct response
      if (state.plan && !state.plan.requiresTools) {
        const directPrompt = `You are a helpful assistant. The user asked: "${lastUserMessage?.content}"

Based on your analysis: ${state.plan.reasoning}

Please provide a direct, helpful response without using any tools.`;
        
        try {
          const directResponse = await this.llm.invoke(directPrompt);
          return {
            messages: [new AIMessage(String(directResponse.content))],
            needsSynthesis: false,
          };
        } catch (error) {
          console.error('Direct response error:', error);
          return {
            messages: [new AIMessage('I understand your request. ' + (state.plan?.reasoning || 'Let me help you with that.'))],
            needsSynthesis: false,
          };
        }
      }
      
      // Default: use the last agent message if available
      return {
        messages: lastAgentMessage ? [lastAgentMessage] : [new AIMessage('Request processed.')],
        needsSynthesis: false,
      };
    });

    // Add agent nodes with handoff capabilities
    for (const agentName of this.config.agents) {
      const agent = this.registry.getAgent(agentName);
      if (!agent) continue;

      // Create ends array for this agent (other agents it can hand off to)
      const otherAgents = this.config.agents.filter(a => a !== agentName);
      
      // Add node with ends configuration for handoff capabilities
      (graph as any).addNode(agentName, async (state: MultiAgentState) => {
        console.log(`🔧 Executing agent: ${agentName}`);
        
        const result = await agent.execute({
          messages: state.messages,
          sessionId: state.sessionId,
          metadata: {
            ...state.metadata,
            plan: state.plan,
          },
        });

        // Handle handoff commands
        if (result.command) {
          // Command includes goto and update fields
          return result.command;
        }
        
        // Collect tool results if any
        const toolResults = result.toolResults || [];
        
        // Check if we have raw tool output that needs synthesis
        const hasToolOutput = toolResults.length > 0 || 
          (result.messages.some(m => {
            const content = typeof m.content === 'string' ? m.content : '';
            // Detect raw tool output patterns
            return content.includes('Title:') && content.includes('URL:') && content.includes('Content:') ||
                   content.includes('Detailed Results:') ||
                   content.includes('```json') ||
                   (content.length > 1000 && content.includes('\n\n'));
          }));
        
        // ALWAYS mark for synthesis if we have ANY tool output or agent messages
        // This ensures synthesis node processes the results
        const hasAnyOutput = result.messages.length > 0 || toolResults.length > 0;
        
        if (hasAnyOutput) {
          return {
            messages: result.messages,
            metadata: result.metadata,
            toolResults: [...(state.toolResults || []), ...toolResults, 
                         // Capture all agent messages as tool results for synthesis
                         ...result.messages.map(m => ({ 
                           type: 'agent_output', 
                           content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                           agent: agentName
                         }))],
            needsSynthesis: true,
            activeAgent: 'synthesis' as any,
          };
        }

        // Check if agent wants to end
        const shouldEnd = result.messages.some(m => {
          const content = typeof m.content === 'string' ? m.content : 
                         typeof m.content === 'object' ? JSON.stringify(m.content) : '';
          return content.includes('DONE') || content.includes('Complete');
        });

        if (shouldEnd || !state.plan?.requiresTools) {
          return {
            messages: result.messages,
            metadata: result.metadata,
            toolResults: [...(state.toolResults || []), ...toolResults],
            needsSynthesis: true,
            activeAgent: 'synthesis' as any,
          };
        }

        return {
          messages: result.messages,
          metadata: result.metadata,
          toolResults: [...(state.toolResults || []), ...toolResults],
          activeAgent: agentName,
        };
      }, { ends: [...otherAgents, 'synthesis', END] });
    }

    // Add edges
    const g: any = graph;
    
    // Start with planner
    g.addEdge(START, 'planner');
    
    // Planner routes to agents or synthesis
    g.addConditionalEdges(
      'planner',
      (state: MultiAgentState) => {
        if (state.needsSynthesis) {
          return 'synthesis';
        }
        return state.activeAgent || this.config.agents[0];
      },
      Object.fromEntries([
        ...this.config.agents.map(a => [a, a]),
        ['synthesis', 'synthesis'],
      ])
    );
    
    // Each agent can route to synthesis or END
    for (const agentName of this.config.agents) {
      g.addConditionalEdges(
        agentName,
        (state: MultiAgentState) => {
          // Always go to synthesis if we have tool results or need synthesis
          if (state.needsSynthesis || (state.toolResults && state.toolResults.length > 0)) {
            return 'synthesis';
          }
          // If activeAgent is set to synthesis, go there
          if (state.activeAgent === 'synthesis') {
            return 'synthesis';
          }
          // Otherwise end
          return END;
        },
        {
          synthesis: 'synthesis',
          [END]: END,
        }
      );
    }
    
    // Synthesis always ends
    g.addEdge('synthesis', END);

    return graph;
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
   * Create a supervisor agent configuration
   */
  static createSupervisorConfig(
    agents: string[],
    defaultAgent?: string,
    supervisorPrompt?: string,
  ): MultiAgentConfig {
    return {
      architecture: MultiAgentArchitecture.SUPERVISOR,
      agents,
      defaultAgent,
      supervisorPrompt,
    };
  }

  /**
   * Create a swarm agent configuration
   */
  static createSwarmConfig(
    agents: string[],
    defaultAgent?: string,
  ): MultiAgentConfig {
    return {
      architecture: MultiAgentArchitecture.SWARM,
      agents,
      defaultAgent,
    };
  }
}

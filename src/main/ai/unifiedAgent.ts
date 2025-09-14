/**
 * Unified Multi-Agent System
 * Single entry point for all agent-based operations
 */

import { EventEmitter } from 'events';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { 
  HumanMessage, 
  SystemMessage, 
  AIMessage,
  BaseMessage 
} from '@langchain/core/messages';
import { 
  createGeneralMCPClient,
  MCPClient,
  MultiAgentGraphBuilder,
  MultiAgentArchitecture,
  MultiAgentState,
} from './utils';
import { AgentRegistry } from './agents';
import { memoryManager, MemoryManager, UserProfile, SessionMemory } from './memory';

/**
 * Unified request interface
 */
export interface UnifiedRequest {
  sessionId: string;
  prompt?: string;
  type?: 'general' | 'research' | 'auto';
  metadata?: Record<string, any>;
  userId?: string;  // User ID for memory management
  threadId?: string;  // Thread ID for conversation continuity
  useMemory?: boolean;  // Enable/disable memory for this request
}

/**
 * Todo item interface
 */
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

/**
 * Unified response interface
 */
export interface UnifiedResponse {
  requestId: string;
  sessionId: string;
  resultSummary: string;
  metadata?: Record<string, any>;
}

/**
 * Unified Multi-Agent System
 * Manages all agent interactions through a single interface
 */
export class UnifiedAgent extends EventEmitter {
  private llm: ChatOpenAI;
  private mcpClient: MCPClient;
  private agentRegistry: AgentRegistry;
  private memoryManager: MemoryManager;
  private graph: StateGraph<MultiAgentState> | null = null;
  private isInitialized = false;
  private enableMemory = true;

  constructor() {
    super();
    
    // Initialize LLM with streaming enabled
    this.llm = new ChatOpenAI({
      model: 'deepseek-chat',
      temperature: 0.3,
      streaming: true, // Enable streaming for token-by-token output
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });

    // Initialize MCP client with all capabilities
    this.mcpClient = createGeneralMCPClient();
    
    // Get agent registry instance
    this.agentRegistry = AgentRegistry.getInstance();
    
    // Initialize memory manager
    this.memoryManager = memoryManager;
  }

  /**
   * Initialize the unified agent system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize MCP client
      await this.mcpClient.initialize();
      console.log('🤖 Unified Agent: MCP client initialized');

      // Initialize agent registry with MCP tools
      await this.agentRegistry.initialize(this.mcpClient, this.llm);
      console.log('🤖 Unified Agent: Agent registry initialized');
      
      // Initialize memory manager
      await this.memoryManager.initialize();
      console.log('🤖 Unified Agent: Memory manager initialized');

      // Build the multi-agent graph
      this.graph = this.buildGraph();
      console.log('🤖 Unified Agent: Multi-agent graph built');

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize unified agent:', error);
      throw error;
    }
  }

  /**
   * Build the multi-agent graph
   */
  private buildGraph(): StateGraph<MultiAgentState> {
    // Get all available agents
    const availableAgents = Array.from(this.agentRegistry.getAllAgents().keys());
    
    if (availableAgents.length === 0) {
      throw new Error('No agents available in registry');
    }

    console.log('🤖 Available agents:', availableAgents);

    // Create swarm configuration for dynamic handoffs
    const config = MultiAgentGraphBuilder.createSwarmConfig(
      availableAgents,
      availableAgents[0], // Default to first available agent
    );

    // Build and compile the graph with memory support
    const builder = new MultiAgentGraphBuilder(this.agentRegistry, config);
    const graph = builder.buildGraph();
    
    return graph;
  }

  /**
   * Warm up MCP tools
   */
  async warmupMCP(timeoutMs: number = 30000): Promise<boolean> {
    return await this.mcpClient.warmup(timeoutMs);
  }

  /**
   * Run the unified agent with a request
   */
  async run(request: UnifiedRequest): Promise<UnifiedResponse> {
    await this.initialize();

    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const useMemory = request.useMemory !== false && this.enableMemory;
    const threadId = request.threadId || `thread_${Date.now()}`;
    const userId = request.userId || 'default_user';
    
    // Emit start event
    this.emit('progress', {
      sessionId: request.sessionId,
      update: 'Initializing...',
      progress: 0,
      step: 0,
    });

    try {
      // Load user profile if memory is enabled
      let userProfile: UserProfile | null = null;
      let previousMessages: BaseMessage[] = [];
      
      if (useMemory && request.userId) {
        // Get user profile
        userProfile = await this.memoryManager.getUserProfile(userId);
        
        // Apply user preferences to LLM if available
        if (userProfile?.preferences) {
          if (userProfile.preferences.temperature !== undefined) {
            this.llm.temperature = userProfile.preferences.temperature;
          }
          if (userProfile.preferences.maxTokens !== undefined) {
            this.llm.maxTokens = userProfile.preferences.maxTokens;
          }
        }
        
        // Load previous conversation if continuing a thread
        if (request.threadId) {
          const sessionMemory = await this.memoryManager.getSessionMemory(
            request.sessionId,
            threadId
          );
          if (sessionMemory) {
            previousMessages = sessionMemory.messages;
            console.log(`📚 Loaded ${previousMessages.length} previous messages from thread ${threadId}`);
          }
        }
      }
      
      // Prepare initial state with memory context
      const currentMessage = request.prompt ? new HumanMessage(request.prompt) : null;
      const allMessages = [
        ...previousMessages,
        ...(currentMessage ? [currentMessage] : [])
      ];
      
      const initialState: MultiAgentState = {
        messages: allMessages,
        sessionId: request.sessionId,
        metadata: {
          ...request.metadata,
          requestId,
          threadId,
          userId,
          type: request.type || userProfile?.preferences?.defaultAgent || 'auto',
          timestamp: new Date().toISOString(),
          userProfile: userProfile ? {
            name: userProfile.name,
            language: userProfile.language,
            context: userProfile.context,
          } : undefined,
        },
      };

      // Compile the graph with checkpointer if memory is enabled
      const checkpointer = useMemory ? this.memoryManager.getCheckpointer() : undefined;
      const compiledGraph = this.graph.compile({ 
        checkpointer,
      });
      
      // Prepare config with thread ID for memory
      const runConfig = useMemory ? {
        configurable: { 
          thread_id: threadId,
          store: this.memoryManager.getStore(),
        },
      } : undefined;
      
      try {
        // Use regular stream for now, handle tokens differently
        const stream = await compiledGraph.stream(initialState as any, runConfig);
        
        let finalMessages: BaseMessage[] = [];
        let stepCount = 0;
        let synthesisMessage: string | null = null;
        let currentStreamingNode: string | null = null;
        
        // Track which nodes we've seen
        const nodesVisited: string[] = [];
        
        // Track todos and their completion
        let currentTodos: TodoItem[] = [];
        let agentTodoIndex = 0; // Index for "Use the X agent" todo
        let synthesisTodoIndex = 1; // Index for "Retrieve and present" todo
        
        // Calculate real progress based on expected steps
        const expectedSteps = 3; // planner -> agent -> synthesis is the typical flow
        
        for await (const chunk of stream) {
          stepCount++;
          console.log(`🔄 Step ${stepCount}:`, Object.keys(chunk));
          
          // Calculate real progress based on actual steps
          const progress = Math.min(Math.round((stepCount / expectedSteps) * 90), 90);
          
          // Extract messages from chunk
          for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
            if (nodeOutput && typeof nodeOutput === 'object') {
              const output = nodeOutput as any;
              
              // Track visited nodes
              nodesVisited.push(nodeName);
              currentStreamingNode = nodeName;
              
              // Emit node-specific updates with real progress
              this.emit('progress', {
                sessionId: request.sessionId,
                update: `Processing: ${nodeName}`,
                progress,
                node: nodeName,
                step: stepCount,
                totalSteps: expectedSteps,
              });
              
              // Handle planner node first (it doesn't have messages)
              if (nodeName === 'planner') {
                // The planner returns the plan directly in the output
                console.log('📦 [UNIFIED] Raw planner output received:', JSON.stringify(output, null, 2));
                
                // Check if plan exists (it's returned directly, not in messages)
                const planData = output.plan || output;
                
                // Debug: Log what we have
                console.log('🔍 [UNIFIED] Planner output structure:', {
                  hasDirectPlan: !!output.plan,
                  outputKeys: Object.keys(output),
                  planKeys: planData ? Object.keys(planData) : [],
                  planData: planData,
                });
                
                // Extract and emit the plan if available
                if (planData && (planData.steps || planData.reasoning)) {
                  console.log('📋 Plan created:', planData);
                  // Emit the plan as a special type so UI can display it
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    type: 'plan',
                    plan: {
                      steps: planData.steps || [],
                      reasoning: planData.reasoning || '',
                      requiresTools: planData.requiresTools || false,
                      selectedAgent: planData.selectedAgent || null,
                    },
                    progress,
                    step: stepCount,
                    totalSteps: expectedSteps,
                  });
                  
                  // Also emit as todos for better task tracking
                  if (planData.steps && planData.steps.length > 0) {
                    const todos: TodoItem[] = planData.steps.map((step: string, index: number) => ({
                      id: `todo_${requestId}_${index}`,
                      text: step,
                      completed: false,
                      order: index,
                    }));
                    
                    // Store todos for tracking
                    currentTodos = todos;
                    
                    // Identify which todo is for agent execution (usually first one)
                    // Look for keywords like "search", "gather", "retrieve", "find", "look up", "analyze"
                    agentTodoIndex = todos.findIndex(todo => {
                      const text = todo.text.toLowerCase();
                      return text.includes('search') || 
                             text.includes('gather') ||
                             text.includes('retrieve') ||
                             text.includes('find') ||
                             text.includes('look up') ||
                             text.includes('analyze') ||
                             text.includes('process') ||
                             text.includes('collect') ||
                             text.includes('get') ||
                             text.includes('fetch');
                    });
                    if (agentTodoIndex === -1) agentTodoIndex = 0; // Default to first
                    
                    // Synthesis todo is usually about presenting/providing results (usually last)
                    synthesisTodoIndex = todos.findIndex(todo => {
                      const text = todo.text.toLowerCase();
                      return text.includes('present') || 
                             text.includes('provide') ||
                             text.includes('display') ||
                             text.includes('show') ||
                             text.includes('deliver') ||
                             text.includes('compile') ||
                             text.includes('summarize') ||
                             text.includes('format');
                    });
                    if (synthesisTodoIndex === -1) synthesisTodoIndex = todos.length - 1; // Default to last
                    
                    console.log(`📋 Emitting ${todos.length} todos for session ${request.sessionId}`);
                    console.log(`📋 Agent todo index: ${agentTodoIndex}, Synthesis todo index: ${synthesisTodoIndex}`);
                    this.emit('progress', {
                      sessionId: request.sessionId,
                      type: 'todos',
                      todos,
                      progress,
                      step: stepCount,
                      totalSteps: expectedSteps,
                    });
                  }
                } else {
                  // Fallback status if no plan - log what we got
                  console.log('⚠️ No plan found in planner output:', JSON.stringify(output).substring(0, 200));
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    update: `Analyzing request...`,
                    type: 'status',
                    progress,
                    step: stepCount,
                    totalSteps: expectedSteps,
                  });
                }
              } else if (nodeName.endsWith('_agent')) {
                // For tool agents (tavily_agent, playwright_agent, etc.)
                // These produce raw tool outputs that need synthesis
                if (output.toolResults) {
                  console.log(`📊 Collected ${output.toolResults.length} tool results from ${nodeName}`);
                }
                
                // Collect messages if available
                if (output.messages && Array.isArray(output.messages)) {
                  finalMessages.push(...output.messages);
                  
                  // Log a preview of what the agent produced (for debugging)
                  const agentMessage = output.messages?.find((m: any) => m instanceof AIMessage);
                  if (agentMessage) {
                    const content = typeof agentMessage.content === 'string' 
                      ? agentMessage.content 
                      : JSON.stringify(agentMessage.content);
                    const preview = content.substring(0, 100).replace(/\n/g, ' ');
                    console.log(`🔧 ${nodeName} output (not sent to UI): "${preview}..."`);
                  }
                }
                
                // Show a friendly status message instead of raw output
                this.emit('progress', {
                  sessionId: request.sessionId,
                  update: `Gathering information...`,
                  type: 'status',
                  progress,
                  step: stepCount,
                  totalSteps: expectedSteps,
                });
                
                // Emit todo update when an agent completes its task
                if (currentTodos.length > 0 && agentTodoIndex >= 0 && agentTodoIndex < currentTodos.length) {
                  console.log(`✅ Marking todo ${agentTodoIndex} ("${currentTodos[agentTodoIndex].text}") as completed for session ${request.sessionId}`);
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    type: 'todo-update',
                    todoIndex: agentTodoIndex,
                    completed: true,
                    progress,
                    step: stepCount,
                    totalSteps: expectedSteps,
                  });
                }
              } else if (nodeName === 'synthesis') {
                // Handle synthesis node - stream tokens if possible
                if (output.messages && Array.isArray(output.messages)) {
                  finalMessages.push(...output.messages);
                  
                  console.log(`📝 Synthesis starting...`);
                  
                  // Emit synthesis start event
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    type: 'synthesis-start',
                    progress,
                    step: stepCount,
                    totalSteps: expectedSteps,
                  });
                  
                  // Get the synthesis message
                  for (const msg of output.messages) {
                    if (msg instanceof AIMessage) {
                      synthesisMessage = typeof msg.content === 'string' 
                        ? msg.content 
                        : JSON.stringify(msg.content);
                      
                      // Stream the synthesis message word by word
                      if (synthesisMessage) {
                        const words = synthesisMessage.split(' ');
                        for (let i = 0; i < words.length; i++) {
                          const word = words[i];
                          const token = i === 0 ? word : ' ' + word;
                          
                          // Emit token
                          this.emit('progress', {
                            sessionId: request.sessionId,
                            type: 'token',
                            token: token,
                            node: 'synthesis',
                          });
                          
                          // Small delay to simulate streaming
                          await new Promise(resolve => setTimeout(resolve, 20));
                        }
                        
                        // Mark synthesis todo as complete after streaming
                        if (currentTodos.length > 0 && synthesisTodoIndex >= 0 && synthesisTodoIndex < currentTodos.length) {
                          console.log(`✅ Marking todo ${synthesisTodoIndex} ("${currentTodos[synthesisTodoIndex].text}") as completed for session ${request.sessionId}`);
                          this.emit('progress', {
                            sessionId: request.sessionId,
                            type: 'todo-update',
                            todoIndex: synthesisTodoIndex,
                            completed: true,
                            progress: 95, // Almost done
                            step: stepCount,
                            totalSteps: expectedSteps,
                          });
                        }
                      }
                    }
                  }
                }
              } else {
                // Handle any other nodes that have messages
                if (output.messages && Array.isArray(output.messages)) {
                  finalMessages.push(...output.messages);
                }
              }
            }
          }
        }
        
        // Log what we captured but don't emit it here - it will be sent in the 'done' event
        if (synthesisMessage) {
          const preview = synthesisMessage.substring(0, 60).replace(/\n/g, ' ');
          console.log(`📝 Synthesis message ready for done event: "${preview}..."`);
        } else if (!nodesVisited.includes('synthesis')) {
          // If no synthesis node was visited, prepare fallback message
          const lastAiMessage = finalMessages
            .filter(m => m instanceof AIMessage)
            .pop();
          
          if (lastAiMessage) {
            const content = typeof lastAiMessage.content === 'string'
              ? lastAiMessage.content
              : JSON.stringify(lastAiMessage.content);
            
            // Only use as synthesis if it's not raw tool output
            if (!content.includes('Detailed Results:') && 
                !content.includes('Title:') && 
                !content.includes('```json')) {
              synthesisMessage = content;
              console.log(`📝 Using last AI message as synthesis: "${content.substring(0, 60)}..."`);
            }
          }
        }
        
        // Save session memory if enabled
        if (useMemory && finalMessages.length > 0) {
          const sessionMemory: SessionMemory = {
            sessionId: request.sessionId,
            threadId,
            messages: finalMessages,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            metadata: {
              userId,
              requestType: request.type,
              stepCount,
              nodesVisited,
            },
          };
          
          await this.memoryManager.saveSessionMemory(sessionMemory);
          console.log(`💾 Saved session memory for thread ${threadId}`);
        }
        
        // Generate final summary (prefer synthesis message if available)
        const resultSummary = synthesisMessage || this.generateSummary(finalMessages);
        
        // Emit completion signal (without text content)
        this.emit('progress', {
          sessionId: request.sessionId,
          progress: 100,
          type: 'complete',
          // Don't include 'update' field to avoid displaying "Complete" in UI
        });
        
        return {
          requestId,
          sessionId: request.sessionId,
          resultSummary,
          metadata: {
            steps: stepCount,
            messageCount: finalMessages.length,
            threadId: useMemory ? threadId : undefined,
            memoryEnabled: useMemory,
          },
        };
      } finally {
        // No interval to clear anymore
      }
    } catch (error) {
      console.error('Unified agent execution error:', error);
      
      this.emit('progress', {
        sessionId: request.sessionId,
        update: `Error: ${(error as Error).message}`,
        type: 'error',
        progress: 100,
      });
      
      throw error;
    }
  }

  /**
   * Generate a summary from messages
   */
  private generateSummary(messages: BaseMessage[]): string {
    if (messages.length === 0) {
      return 'No response generated';
    }

    // Get the last AI message as the primary summary
    const aiMessages = messages.filter(m => m instanceof AIMessage);
    if (aiMessages.length > 0) {
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      const content = typeof lastAiMessage.content === 'string'
        ? lastAiMessage.content
        : JSON.stringify(lastAiMessage.content);
      return content;
    }

    // Fallback to concatenating all messages
    return messages
      .map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
        return content;
      })
      .join('\n\n');
  }

  /**
   * Enable or disable memory
   */
  setMemoryEnabled(enabled: boolean): void {
    this.enableMemory = enabled;
    console.log(`🧠 Memory ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get memory manager for direct access
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }
  
  /**
   * Update user profile
   */
  async updateUserProfile(profile: UserProfile): Promise<void> {
    await this.memoryManager.saveUserProfile(profile);
  }
  
  /**
   * Get user's recent sessions
   */
  async getUserSessions(userId: string, limit?: number): Promise<SessionMemory[]> {
    return await this.memoryManager.getRecentSessions(userId, limit);
  }
  
  /**
   * Search through memories
   */
  async searchMemories(query: string, userId?: string): Promise<{
    sessions: SessionMemory[];
    profiles: UserProfile[];
  }> {
    return await this.memoryManager.searchMemories(query, userId);
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.agentRegistry.cleanup();
      await this.mcpClient.cleanup();
      await this.memoryManager.cleanup();
      console.log('🛑 Unified agent cleaned up');
    } catch (error) {
      console.error('Error cleaning up unified agent:', error);
    }
  }
}

// Export singleton instance
export const unifiedAgent = new UnifiedAgent();
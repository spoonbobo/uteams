/**
 * Orchestrator
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
} from './tools';
import {
  MultiAgentGraphBuilder,
  MultiAgentState,
} from './graph';
import { AgentRegistry } from './agents';
import { memoryManager, MemoryManager, UserProfile, SessionMemory } from './memory';
import { abortManager } from './abort';

/**
 * Orchestrator request interface
 */
export interface OrchestratorRequest {
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
 * Orchestrator response interface
 */
export interface OrchestratorResponse {
  requestId: string;
  sessionId: string;
  resultSummary: string;
  metadata?: Record<string, any>;
}

/**
 * Orchestrator
 * Manages all agent interactions through a single interface
 */
export class Orchestrator extends EventEmitter {
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
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    if (!apiKey) {
      console.error('[Orchestrator] OPENAI_API_KEY is not set. Please check your .env.production file.');
      throw new Error('OpenAI API key is required but not found in environment variables. Please set OPENAI_API_KEY in your .env.production file.');
    }

    console.log('[Orchestrator] Creating LLM with baseURL:', baseURL || 'default OpenAI API');

    this.llm = new ChatOpenAI({
      model: 'deepseek-chat',
      temperature: 0.3,
      streaming: true, // Enable streaming for token-by-token output
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
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
   * Initialize the orchestrator system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize MCP client
      await this.mcpClient.initialize();
      console.log('🤖 Orchestrator: MCP client initialized');

      // Initialize agent registry with MCP tools
      await this.agentRegistry.initialize(this.mcpClient, this.llm);
      console.log('🤖 Orchestrator: Agent registry initialized');

      // Initialize memory manager
      await this.memoryManager.initialize();
      console.log('🤖 Orchestrator: Memory manager initialized');

      // Build the multi-agent graph
      this.graph = this.buildGraph();
      console.log('🤖 Orchestrator: Multi-agent graph built');

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize orchestrator:', error);
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
   * Run the orchestrator with a request
   */
  async run(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    await this.initialize();

    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const useMemory = request.useMemory !== false && this.enableMemory;
    const threadId = request.threadId || `thread_${Date.now()}`;
    const userId = request.userId || 'default_user';

    // Create abort controller for this session
    const abortController = abortManager.createController(request.sessionId);
    const abortSignal = abortController.signal;

    // Don't emit initializing as a chunk - UI will show thinking spinner instead
    console.log('🚀 Starting orchestrator run for session:', request.sessionId);

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
        signal: abortSignal,  // Pass abort signal to agents
      };

      // Compile the graph with checkpointer if memory is enabled
      const checkpointer = useMemory ? this.memoryManager.getCheckpointer() : undefined;
      const compiledGraph = this.graph.compile({
        checkpointer,
      });

      // Prepare config with thread ID for memory and abort signal
      const runConfig = {
        ...(useMemory ? {
          configurable: {
            thread_id: threadId,
            store: this.memoryManager.getStore(),
          },
        } : {}),
        // Pass the abort signal to LangChain for proper cancellation
        signal: abortSignal,
      };

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
        let initialTodos: TodoItem[] = []; // Keep track of initial todos state
        let currentTodoIndex = 0; // Track which todo we're currently executing
        let isExecutingTodos = false; // Flag to track if we've started executing todos

        // Calculate real progress based on expected steps
        const expectedSteps = 3; // planner -> agent -> synthesis is the typical flow

        for await (const chunk of stream) {
          // Check if aborted
          if (abortSignal.aborted) {
            console.log(`🛑 Session ${request.sessionId} aborted during streaming`);
            throw new Error('Operation aborted');
          }

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

              // Don't emit processing updates as chunks (they show as thinking)
              // Only emit for internal tracking, not for UI display
              console.log(`🔄 Processing node: ${nodeName}`);

              // Handle planner node
              if (nodeName === 'planner') {
                // Check if we have todos being created or updated
                if (output.todos) {
                  currentTodos = output.todos;
                  console.log(`📋 Todos created/updated: ${currentTodos.length} items`);

                  // Save initial todos state if this is the first time
                  if (initialTodos.length === 0) {
                    initialTodos = currentTodos.map(todo => ({ ...todo }));
                    console.log(`📋 Saved initial todos state (all should be incomplete)`);
                  }

                  // Convert todos to the format expected by UI
                  const uiTodos = currentTodos.map((todo, index) => ({
                    id: todo.id || `todo-${index}`,
                    text: todo.text,
                    completed: todo.completed === true, // Ensure boolean
                    order: todo.order !== undefined ? todo.order : index
                  }));

                  // Emit todos to UI
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    type: 'todos',
                    todos: uiTodos,
                    progress,
                    step: stepCount,
                    totalSteps: currentTodos.length + 1, // Update total steps based on todos
                  });
                }

                // Check if a todo was just completed
                if (output.completedTodos && currentTodos.length > 0) {
                  const completedIndices = output.completedTodos;
                  for (const index of completedIndices) {
                    if (!isExecutingTodos || currentTodoIndex <= index) {
                      console.log(`✅ Todo ${index} completed: "${currentTodos[index]?.text}"`);
                      this.emit('progress', {
                        sessionId: request.sessionId,
                        type: 'todo-update',
                        todoIndex: index,
                        completed: true,
                        progress: Math.round((index + 1) / currentTodos.length * 90),
                        step: index + 1,
                        totalSteps: currentTodos.length,
                      });
                      currentTodoIndex = index + 1;
                    }
                  }
                  isExecutingTodos = true;
                }

                // Emit plan if available
                if (output.plan) {
                  console.log('📋 Plan created:', output.plan);
                  this.emit('progress', {
                    sessionId: request.sessionId,
                    type: 'plan',
                    plan: output.plan,
                    progress,
                    step: stepCount,
                    totalSteps: output.todos?.length || expectedSteps,
                  });
                }

                // Update current todo index if provided
                if (output.currentTodoIndex !== undefined) {
                  const idx = output.currentTodoIndex;
                  if (idx < currentTodos.length) {
                    console.log(`📍 Processing todo ${idx + 1}/${currentTodos.length}: "${currentTodos[idx]?.text}"`);
                    // Don't emit status updates that would appear as chunks
                    // The PlanWidget will track progress through todo updates
                  }
                }
              } else if (nodeName.endsWith('_agent')) {
                // For all agents (tavily_agent, playwright_agent, general_agent, etc.)
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

                // Don't emit status messages that would appear as chunks
                console.log(`📊 Agent ${nodeName} is gathering information...`);

                // Update todos from state if they were modified
                if (output.todos && output.todos.length > 0) {
                  currentTodos = output.todos;
                  console.log(`📝 Agent ${nodeName} updated todos, checking for completions...`);
                  console.log(`📝 Initial todos:`, initialTodos.map((t, i) => `${i}: ${t.completed ? '✓' : '○'} ${t.text.substring(0, 50)}`));
                  console.log(`📝 Current todos:`, currentTodos.map((t, i) => `${i}: ${t.completed ? '✓' : '○'} ${t.text.substring(0, 50)}`));

                  // Check each todo against INITIAL state for completion changes
                  for (let i = 0; i < currentTodos.length; i++) {
                    const initialTodo = initialTodos[i];
                    const currTodo = currentTodos[i];

                    if (initialTodo && currTodo) {
                      const wasInitiallyCompleted = initialTodo.completed === true;
                      const isNowCompleted = currTodo.completed === true;

                      console.log(`📝 Checking todo ${i}: initial=${wasInitiallyCompleted}, now=${isNowCompleted}`);

                      // If this todo wasn't completed initially but is now completed, emit update
                      if (!wasInitiallyCompleted && isNowCompleted) {
                        console.log(`✅ Todo ${i} marked complete: "${currTodo.text.substring(0, 50)}..."`);
                        this.emit('progress', {
                          sessionId: request.sessionId,
                          type: 'todo-update',
                          todoIndex: i,
                          completed: true,
                          progress: Math.round((i + 1) / currentTodos.length * 90),
                          step: i + 1,
                          totalSteps: currentTodos.length,
                        });

                        // Update the initial todo to reflect this has been emitted
                        initialTodos[i].completed = true;
                      }
                    }
                  }
                }

                // Also check completedTodos array (backward compatibility)
                if (output.completedTodos && currentTodos.length > 0) {
                  for (const index of output.completedTodos) {
                    if (currentTodos[index] && !currentTodos[index].completed) {
                      console.log(`✅ Agent completed todo ${index} via completedTodos array: "${currentTodos[index].text}"`);
                      currentTodos[index].completed = true;
                      this.emit('progress', {
                        sessionId: request.sessionId,
                        type: 'todo-update',
                        todoIndex: index,
                        completed: true,
                        progress: Math.round((index + 1) / currentTodos.length * 90),
                        step: index + 1,
                        totalSteps: currentTodos.length,
                      });
                    }
                  }
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
                          // Check if aborted during token streaming
                          if (abortSignal.aborted) {
                            console.log(`🛑 Session ${request.sessionId} aborted during token streaming`);
                            throw new Error('Operation aborted');
                          }

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

                        // Check if synthesis marked a todo complete
                        if (output.completedTodos && currentTodos.length > 0) {
                          for (const index of output.completedTodos) {
                            if (currentTodos[index] && !currentTodos[index].completed) {
                              console.log(`✅ Synthesis completed todo ${index}: "${currentTodos[index].text}"`);
                              currentTodos[index].completed = true;
                              this.emit('progress', {
                                sessionId: request.sessionId,
                                type: 'todo-update',
                                todoIndex: index,
                                completed: true,
                                progress: Math.round((index + 1) / currentTodos.length * 90),
                                step: index + 1,
                                totalSteps: currentTodos.length,
                              });
                            }
                          }
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
      console.error('Orchestrator execution error:', error);

      // Don't emit error as update text, let the error handler in chat.ts handle it
      console.error(`❌ Error for session ${request.sessionId}:`, (error as Error).message);

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
   * Abort a running session
   */
  abort(sessionId: string, reason?: string): boolean {
    const aborted = abortManager.abort(sessionId, reason);
    if (aborted) {
      // Emit abort event
      this.emit('progress', {
        sessionId,
        type: 'aborted',
        reason: reason || 'User requested abort',
      });
    }
    return aborted;
  }

  /**
   * Abort all running sessions
   */
  abortAll(reason?: string): number {
    const sessions = abortManager.getActiveSessions();
    sessions.forEach(sessionId => {
      this.emit('progress', {
        sessionId,
        type: 'aborted',
        reason: reason || 'All sessions aborted',
      });
    });
    return abortManager.abortAll(reason);
  }

  /**
   * Check if a session is aborted
   */
  isAborted(sessionId: string): boolean {
    return abortManager.isAborted(sessionId);
  }

  /**
   * Get list of active sessions
   */
  getActiveSessions(): string[] {
    return abortManager.getActiveSessions();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Abort all running sessions
      this.abortAll('System cleanup');

      await this.agentRegistry.cleanup();
      await this.mcpClient.cleanup();
      await this.memoryManager.cleanup();
      abortManager.cleanupAll();

      console.log('🛑 Orchestrator cleaned up');
    } catch (error) {
      console.error('Error cleaning up orchestrator:', error);
    }
  }
}

// Export singleton instance
export const orchestrator = new Orchestrator();

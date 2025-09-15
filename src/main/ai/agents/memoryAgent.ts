/**
 * Memory Agent
 * Specialized agent for managing user memory, preferences, and conversation history
 * Uses memory tools to help users remember and recall information
 */

import { BaseAgent, AgentConfig, AgentState, AgentResult, HandoffInfo, AgentCapabilities } from '../types/agent';
import { ChatOpenAI } from '@langchain/openai';
import { 
  HumanMessage, 
  SystemMessage, 
  AIMessage,
  BaseMessage 
} from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { 
  getUserInfoTool,
  saveUserInfoTool,
  recallConversationTool,
  rememberTool,
  recallTool,
  forgetTool,
} from '../tools/memoryTools';
import { memoryManager } from '../memory';

/**
 * Memory Agent
 * Helps users manage their memory, preferences, and conversation history
 */
export class MemoryAgent extends BaseAgent {
  private memoryTools: any[];
  private agent: any; // LangChain agent for tool execution

  constructor(config: AgentConfig, llm: ChatOpenAI, tools: any[]) {
    // Initialize memory-specific tools
    const memoryTools = [
      getUserInfoTool,
      saveUserInfoTool,
      recallConversationTool,
      rememberTool,
      recallTool,
      forgetTool,
    ];

    // Combine with any additional tools
    const allTools = [...memoryTools, ...tools];
    
    // Update config with all tools
    const updatedConfig = {
      ...config,
      tools: allTools,
    };
    
    super(updatedConfig, llm);
    this.memoryTools = memoryTools;
    
    // Create agent for tool execution
    this.agent = this.createAgent();
  }
  
  /**
   * Create the LangChain agent
   */
  private createAgent(): any {
    return createReactAgent({
      llm: this.llm,
      tools: [...this.memoryTools, ...this.mcpTools],
    });
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Memory specialist that helps users remember information, manage preferences, and recall past conversations. Expert at storing and retrieving personalized information.';
  }

  /**
   * Get agent capabilities for handoff decisions
   */
  getCapabilities(): AgentCapabilities {
    return {
      ...this.config.capabilities,
      // Additional memory-specific capabilities can be tracked in metadata
    };
  }

  /**
   * Check if this agent should handle the request
   */
  shouldHandle(state: AgentState): boolean {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;

    const content = typeof lastMessage.content === 'string' 
      ? lastMessage.content.toLowerCase() 
      : '';

    // Keywords that indicate memory-related requests
    const memoryKeywords = [
      'remember', 'recall', 'forget', 'memory', 'memorize',
      'my name', 'my preference', 'my information', 'my profile',
      'what did i', 'what was', 'last time', 'previous conversation',
      'save this', 'store this', 'keep this', 'note this',
      'remind me', 'don\'t forget', 'take note',
      'my settings', 'my context', 'my history',
      'search conversation', 'find in history',
      'update my', 'change my preference',
      'what do you know about me',
      'clear memory', 'delete history',
    ];

    return memoryKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Get handoff information for other agents
   */
  getHandoffInfo(targetAgent: string, reason?: string): HandoffInfo {
    return {
      targetAgent,
      reason: reason || 'Memory agent handing off to specialized agent',
      context: {
        fromAgent: this.config.name,
        capabilities: this.getCapabilities(),
      },
    };
  }

  /**
   * Execute the memory agent
   */
  async execute(state: AgentState): Promise<AgentResult> {
    console.log(`🧠 Memory Agent executing for session ${state.sessionId}`);

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
          console.log(`🧠 Memory Agent: Executing todo task`);
        }
      }
      
      // Check if we should handle this request
      if (!this.shouldHandle(state) && !isTodoExecution) {
        // Suggest handoff to a more appropriate agent
        const handoffTarget = this.suggestHandoff(state);
        if (handoffTarget) {
          return {
            messages: [],
            command: new Command({
              goto: handoffTarget,
              update: {
                messages: state.messages,
                metadata: state.metadata,
              },
            }),
          };
        }
      }

      // Enhance the system prompt with memory context
      const userId = state.metadata?.userId || 'default_user';
      const userProfile = await memoryManager.getUserProfile(userId);
      
      let contextPrompt = '';
      
      // Add course context if available
      const courseMemory = state.metadata?.courseMemory;
      if (courseMemory) {
        console.log(`🧠 Memory Agent: Using course context for ${courseMemory.courseShortName}`);
        contextPrompt += `
Current Course Context (Full Raw Data):
${JSON.stringify(courseMemory, null, 2)}

`;
      }
      
      if (userProfile) {
        contextPrompt += `
Current user profile:
- Name: ${userProfile.name || 'Unknown'}
- Language: ${userProfile.language || 'Not specified'}
- Preferences: ${JSON.stringify(userProfile.preferences || {}, null, 2)}
- Context: ${JSON.stringify(userProfile.context || {}, null, 2)}
`;
      }

      // Get recent sessions for additional context
      const recentSessions = await memoryManager.getRecentSessions(userId, 3);
      if (recentSessions.length > 0) {
        contextPrompt += `\nRecent conversation topics:\n`;
        recentSessions.forEach(session => {
          if (session.topics && session.topics.length > 0) {
            contextPrompt += `- ${session.topics.join(', ')}\n`;
          }
        });
      }

      // Create enhanced system message
      const systemMessage = new SystemMessage(`
You are a Memory Agent, specialized in helping users manage their personal information, preferences, and conversation history.

Your capabilities include:
1. Storing and retrieving user information and preferences
2. Remembering specific facts, notes, or information the user wants to save
3. Recalling previous conversations and searching through history
4. Managing user profile and settings
5. Helping users organize and access their stored memories
${courseMemory ? '6. Answering questions about the current course context' : ''}

IMPORTANT: When executing a specific task:
- Focus on completing ONLY the requested task
- Include "COMPLETED" at the end of your response when the task is done
- This signals the system to move to the next step

${contextPrompt}

Available memory tools:
- get_user_info: Retrieve user profile and preferences
- save_user_info: Update user profile (name, language, preferences, context)
- recall_conversation: Search or retrieve previous conversations
- remember: Store a specific piece of information with a key
- recall: Retrieve a previously stored piece of information
- forget: Delete a stored memory

Guidelines:
${courseMemory ? '- IMPORTANT: You have the COMPLETE course data in JSON format above - use it to answer ALL course-related questions!' : ''}
${courseMemory ? '- The "Current Course Context" contains all students, assignments, activities, and course details' : ''}
${courseMemory ? '- Answer directly from this data - do NOT use memory tools for course information' : ''}
${courseMemory ? '- When describing the course, provide specific details from the JSON data above' : ''}
- Be proactive in offering to save important information
- When users mention personal details, offer to update their profile
- Help users find information from past conversations
- Suggest organizing memories with meaningful keys
- Respect privacy and only store what users explicitly want remembered
- Provide clear confirmations when storing or deleting information

Current session: ${state.sessionId}
User ID: ${userId}
`);

      // Prepare messages with system context
      const messagesWithContext = [
        systemMessage,
        ...state.messages,
      ];

      // Check if this is a memory search request
      const lastMessage = state.messages[state.messages.length - 1];
      const content = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
      
      console.log(`🧠 [Memory Agent] Processing query: "${content.substring(0, 100)}..."`);
      console.log(`🧠 [Memory Agent] Has course context: ${!!courseMemory}`);
      
      // Handle specific memory operations
      if (content.toLowerCase().includes('what do you know about me')) {
        console.log(`🧠 [Memory Agent] Handling "what do you know about me" query`);
        // Provide a comprehensive summary of user information
        const summary = await this.generateUserSummary(userId);
        return {
          messages: [new AIMessage(summary)],
          metadata: {
            ...state.metadata,
            memoryOperation: 'user_summary',
          },
        };
      }

      // Invoke the agent with memory tools
      console.log(`🧠 [Memory Agent] Invoking LangChain agent with ${this.memoryTools.length + this.mcpTools.length} available tools`);
      const result = await this.agent.invoke({
        messages: messagesWithContext,
      });

      // Debug: Log the raw result structure
      console.log(`🧠 [Memory Agent] Raw result keys:`, Object.keys(result));
      console.log(`🧠 [Memory Agent] Result messages count:`, result.messages?.length || 0);
      
      // Extract response messages - only get NEW messages (not the ones we passed in)
      const inputMessageCount = messagesWithContext.length;
      const allResultMessages = result.messages || [];
      let responseMessages: BaseMessage[] = allResultMessages.slice(inputMessageCount);
      
      console.log(`🧠 [Memory Agent] Input messages: ${inputMessageCount}, Total result messages: ${allResultMessages.length}, New messages: ${responseMessages.length}`);
      
      // If no new messages were generated, check if there's an AI message in the full result
      if (responseMessages.length === 0) {
        console.log(`🧠 [Memory Agent] No new messages found, checking for AI response in all messages...`);
        const lastAIMessage = allResultMessages.reverse().find((m: BaseMessage) => m instanceof AIMessage);
        if (lastAIMessage) {
          console.log(`🧠 [Memory Agent] Found AI message, using it as response`);
          responseMessages = [lastAIMessage];
        } else {
          // Generate a response based on the context
          console.log(`🧠 [Memory Agent] No AI message found, generating response from context`);
          if (courseMemory) {
            const courseDescription = `## ${courseMemory.courseShortName}: ${courseMemory.courseName}

**Course ID:** ${courseMemory.courseId}
${courseMemory.summary ? `**Summary:** ${courseMemory.summary}\n` : ''}
**Students Enrolled:** ${courseMemory.students?.length || 0}
**Assignments:** ${courseMemory.assignments?.length || 0}
**Activities:** ${courseMemory.activities?.length || 0}

### Assignments
${courseMemory.assignments && courseMemory.assignments.length > 0 
  ? courseMemory.assignments.map((a: any) => 
      `- ${a.name}${a.dueDate ? ` (Due: ${new Date(a.dueDate * 1000).toLocaleDateString()})` : ''}`
    ).join('\n')
  : 'No assignments available'}

### Students (${courseMemory.students?.length || 0} total)
${courseMemory.students && courseMemory.students.length > 0
  ? courseMemory.students.slice(0, 5).map((s: any) => `- ${s.name} (${s.email})`).join('\n') +
    (courseMemory.students.length > 5 ? `\n... and ${courseMemory.students.length - 5} more students` : '')
  : 'No student information available'}

### Activities
${courseMemory.activities && courseMemory.activities.length > 0
  ? courseMemory.activities.map((a: any) => `- ${a.name} (${a.type})`).join('\n')
  : 'No activities available'}

Last Updated: ${courseMemory.lastUpdated}`;
            
            responseMessages = [new AIMessage(courseDescription)];
            console.log(`🧠 [Memory Agent] Generated course description from context`);
          } else {
            responseMessages = [new AIMessage('I have access to course information through my memory system. Please ask me about specific courses or what information I have available.')];
          }
        }
      }
      
      // Log message types
      if (responseMessages.length > 0) {
        responseMessages.forEach((msg, idx) => {
          const msgType = msg._getType ? msg._getType() : msg.constructor.name;
          const preview = typeof msg.content === 'string' ? msg.content.substring(0, 100) : JSON.stringify(msg.content).substring(0, 100);
          console.log(`   Message ${idx}: Type=${msgType}, Content="${preview}..."`);
        });
      }
      
      // Log tool usage
      const toolMessages = responseMessages.filter((m: any) => m.constructor.name === 'ToolMessage');
      console.log(`🧠 [Memory Agent] Used ${toolMessages.length} tools`);
      if (toolMessages.length > 0) {
        toolMessages.forEach((tm: any, index: number) => {
          console.log(`   Tool ${index + 1}: ${tm.name || 'unknown'} - ${JSON.stringify(tm.content).substring(0, 100)}...`);
        });
      } else {
        console.log(`🧠 [Memory Agent] Answered directly from context without tools`);
      }

      // Check for handoff requests in the response
      const lastAiMessage = responseMessages.find(m => m instanceof AIMessage);
      if (lastAiMessage) {
        const aiContent = typeof lastAiMessage.content === 'string' 
          ? lastAiMessage.content 
          : '';
        
        // Check if we should hand off to another agent
        const handoffPattern = /hand(?:ing)?\s*off\s*to\s*(\w+)(?:_agent)?/i;
        const handoffMatch = aiContent.match(handoffPattern);
        
        if (handoffMatch) {
          const targetAgent = handoffMatch[1].toLowerCase();
          console.log(`🔄 Memory Agent handing off to ${targetAgent}`);
          
          return {
            messages: responseMessages,
            command: new Command({
              goto: `${targetAgent}_agent`,
              update: {
                ...state,
                messages: [...state.messages, ...responseMessages],
              },
            }),
          };
        }
      }

      // Update memory statistics in metadata
      const stats = memoryManager.getStats();
      
      // Log the final response
      if (responseMessages.length > 0) {
        const finalMessage = responseMessages[responseMessages.length - 1];
        const preview = typeof finalMessage.content === 'string' 
          ? finalMessage.content.substring(0, 200) 
          : JSON.stringify(finalMessage.content).substring(0, 200);
        console.log(`🧠 [Memory Agent] Final response preview: "${preview}..."`);
      }
      
      // Calculate tool results for reporting
      const toolResults = toolMessages.map((tm: any) => ({
        tool: tm.name || 'unknown',
        result: tm.content
      }));
      
      console.log(`🧠 [Memory Agent] Returning ${responseMessages.length} messages, ${toolResults.length} tool results`);
      
      // Add COMPLETED token if this is a todo execution
      if (isTodoExecution && responseMessages.length > 0) {
        const lastMessage = responseMessages[responseMessages.length - 1];
        if (lastMessage instanceof AIMessage && typeof lastMessage.content === 'string') {
          lastMessage.content += '\n\nCOMPLETED';
          console.log(`🧠 Memory Agent: Added COMPLETED token to response`);
        }
      }
      
      return {
        messages: responseMessages,
        toolResults, // Include tool results for proper reporting
        metadata: {
          ...state.metadata,
          memoryStats: stats,
          lastMemoryAccess: new Date().toISOString(),
          todoCompleted: isTodoExecution,
        },
      };
    } catch (error) {
      console.error('Memory Agent execution error:', error);
      
      return {
        messages: [
          new AIMessage(`I encountered an error while accessing memory: ${(error as Error).message}. Let me try to help you another way.`),
        ],
        metadata: {
          ...state.metadata,
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Generate a comprehensive user summary
   */
  private async generateUserSummary(userId: string): Promise<string> {
    const profile = await memoryManager.getUserProfile(userId);
    const recentSessions = await memoryManager.getRecentSessions(userId, 5);
    const stats = memoryManager.getStats();
    
    let summary = '📊 **Your Memory Profile**\n\n';
    
    // User information
    if (profile) {
      summary += '**Personal Information:**\n';
      if (profile.name) summary += `- Name: ${profile.name}\n`;
      if (profile.language) summary += `- Language: ${profile.language}\n`;
      
      if (profile.preferences && Object.keys(profile.preferences).length > 0) {
        summary += '\n**Preferences:**\n';
        if (profile.preferences.responseStyle) {
          summary += `- Response style: ${profile.preferences.responseStyle}\n`;
        }
        if (profile.preferences.defaultAgent) {
          summary += `- Preferred agent: ${profile.preferences.defaultAgent}\n`;
        }
        if (profile.preferences.temperature !== undefined) {
          summary += `- AI temperature: ${profile.preferences.temperature}\n`;
        }
      }
      
      if (profile.context && Object.keys(profile.context).length > 0) {
        summary += '\n**Context:**\n';
        if (profile.context.role) {
          summary += `- Role: ${profile.context.role}\n`;
        }
        if (profile.context.expertise && profile.context.expertise.length > 0) {
          summary += `- Expertise: ${profile.context.expertise.join(', ')}\n`;
        }
        if (profile.context.interests && profile.context.interests.length > 0) {
          summary += `- Interests: ${profile.context.interests.join(', ')}\n`;
        }
      }
    } else {
      summary += 'No personal profile found. You can tell me about yourself and I\'ll remember it!\n';
    }
    
    // Recent conversations
    if (recentSessions.length > 0) {
      summary += '\n**Recent Conversations:**\n';
      recentSessions.forEach((session, index) => {
        const date = new Date(session.lastAccessed).toLocaleDateString();
        const messageCount = session.messages.length;
        summary += `${index + 1}. Session on ${date} (${messageCount} messages)\n`;
        if (session.summary) {
          summary += `   Summary: ${session.summary}\n`;
        }
        if (session.topics && session.topics.length > 0) {
          summary += `   Topics: ${session.topics.join(', ')}\n`;
        }
      });
    }
    
    // Memory statistics
    summary += '\n**Memory Statistics:**\n';
    summary += `- Total conversations: ${stats.sessions}\n`;
    summary += `- Total messages: ${stats.totalMessages}\n`;
    summary += `- User profiles stored: ${stats.userProfiles}\n`;
    
    summary += '\n💡 **Tips:**\n';
    summary += '- Ask me to "remember" specific information with a key\n';
    summary += '- Tell me your preferences and I\'ll save them\n';
    summary += '- Search past conversations by asking about previous topics\n';
    summary += '- Update your profile anytime by telling me about changes\n';
    
    return summary;
  }

  /**
   * Suggest handoff to another agent if needed
   */
  private suggestHandoff(state: AgentState): string | null {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return null;

    const content = typeof lastMessage.content === 'string' 
      ? lastMessage.content.toLowerCase() 
      : '';

    // Suggest handoffs based on content
    if (content.includes('search') && content.includes('web')) {
      return 'tavily_agent';
    }
    if (content.includes('browse') || content.includes('website')) {
      return 'playwright_agent';
    }
    if (content.includes('screen') || content.includes('clipboard')) {
      return 'screenpipe_agent';
    }

    // Check configured handoff targets
    if (this.config.handoffTargets && this.config.handoffTargets.length > 0) {
      // Could implement more sophisticated handoff logic here
      return null;
    }

    return null;
  }
}

// Import ToolMessage if needed
import { ToolMessage } from '@langchain/core/messages';

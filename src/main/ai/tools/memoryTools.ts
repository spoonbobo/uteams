/**
 * Memory Tools for Agents
 * Provides tools that agents can use to interact with the memory system
 * Based on LangGraph patterns: https://langchain-ai.github.io/langgraphjs/agents/memory/
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { memoryManager, UserProfile, CourseMemory } from '../memory';

/**
 * Tool to get user information from memory
 */
export const getUserInfoTool = tool(
  async (
    input: { userId?: string },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    // Get store from config if available
    const store = config.store;
    const userId = input.userId || config.configurable?.userId || 'default_user';

    try {
      // Try to get from store first
      if (store) {
        const userInfo = await store.get(['users'], userId);
        if (userInfo) {
          return JSON.stringify(userInfo.value, null, 2);
        }
      }

      // Fallback to memory manager
      const profile = await memoryManager.getUserProfile(userId);
      if (profile) {
        return JSON.stringify(profile, null, 2);
      }

      return `No user information found for userId: ${userId}`;
    } catch (error) {
      return `Error retrieving user info: ${(error as Error).message}`;
    }
  },
  {
    name: 'get_user_info',
    description: 'Look up user information and preferences from memory',
    schema: z.object({
      userId: z.string().optional().describe('The user ID to look up (optional)'),
    }),
  }
);

/**
 * Tool to save/update user information
 */
export const saveUserInfoTool = tool(
  async (
    input: {
      name?: string;
      language?: string;
      preferences?: {
        defaultAgent?: string;
        temperature?: number;
        maxTokens?: number;
        responseStyle?: 'concise' | 'detailed' | 'technical' | 'casual';
      };
      context?: {
        role?: string;
        expertise?: string[];
        interests?: string[];
      };
    },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const store = config.store;
    const userId = config.configurable?.userId || 'default_user';

    try {
      // Get existing profile or create new one
      let profile: UserProfile = await memoryManager.getUserProfile(userId) || {
        userId,
        name: undefined,
        language: undefined,
        preferences: {},
        context: {},
        metadata: {},
      };

      // Update profile with new information
      if (input.name) profile.name = input.name;
      if (input.language) profile.language = input.language;
      if (input.preferences) {
        profile.preferences = {
          ...profile.preferences,
          ...input.preferences,
        };
      }
      if (input.context) {
        profile.context = {
          ...profile.context,
          ...input.context,
        };
      }

      // Save to memory manager
      await memoryManager.saveUserProfile(profile);

      // Also save to store if available
      if (store) {
        await store.put(['users'], userId, profile);
      }

      return `Successfully saved user information for ${userId}`;
    } catch (error) {
      return `Error saving user info: ${(error as Error).message}`;
    }
  },
  {
    name: 'save_user_info',
    description: 'Save or update user information and preferences',
    schema: z.object({
      name: z.string().optional().describe('User name'),
      language: z.string().optional().describe('Preferred language'),
      preferences: z.object({
        defaultAgent: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        responseStyle: z.enum(['concise', 'detailed', 'technical', 'casual']).optional(),
      }).optional().describe('User preferences'),
      context: z.object({
        role: z.string().optional(),
        expertise: z.array(z.string()).optional(),
        interests: z.array(z.string()).optional(),
      }).optional().describe('User context'),
    }),
  }
);

/**
 * Tool to recall previous conversations
 */
export const recallConversationTool = tool(
  async (
    input: {
      query?: string;
      sessionId?: string;
      limit?: number;
    },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const userId = config.configurable?.userId || 'default_user';

    try {
      if (input.query) {
        // Search through memories
        const results = await memoryManager.searchMemories(input.query, userId);
        
        if (results.sessions.length === 0) {
          return 'No matching conversations found';
        }

        // Format results
        const formatted = results.sessions
          .slice(0, input.limit || 5)
          .map(session => {
            const summary = session.summary || 'No summary available';
            const topics = session.topics?.join(', ') || 'No topics';
            const date = new Date(session.lastAccessed).toLocaleString();
            return `Session ${session.sessionId} (${date}):\n  Topics: ${topics}\n  Summary: ${summary}`;
          })
          .join('\n\n');

        return formatted;
      } else {
        // Get recent sessions
        const sessions = await memoryManager.getRecentSessions(userId, input.limit || 5);
        
        if (sessions.length === 0) {
          return 'No previous conversations found';
        }

        const formatted = sessions
          .map(session => {
            const messageCount = session.messages.length;
            const date = new Date(session.lastAccessed).toLocaleString();
            const lastMessage = session.messages[session.messages.length - 1];
            const preview = lastMessage ? 
              (typeof lastMessage.content === 'string' ? 
                lastMessage.content.substring(0, 100) : 
                'Complex message') : 
              'No messages';
            
            return `Session ${session.sessionId} (${date}):\n  Messages: ${messageCount}\n  Last: ${preview}...`;
          })
          .join('\n\n');

        return formatted;
      }
    } catch (error) {
      return `Error recalling conversations: ${(error as Error).message}`;
    }
  },
  {
    name: 'recall_conversation',
    description: 'Recall previous conversations or search through conversation history',
    schema: z.object({
      query: z.string().optional().describe('Search query to find specific conversations'),
      sessionId: z.string().optional().describe('Specific session ID to recall'),
      limit: z.number().optional().describe('Maximum number of results to return'),
    }),
  }
);

/**
 * Tool to remember something specific
 */
export const rememberTool = tool(
  async (
    input: {
      key: string;
      value: any;
      namespace?: string;
    },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const store = config.store;
    const userId = config.configurable?.userId || 'default_user';
    const namespace = input.namespace || 'memories';

    try {
      if (!store) {
        return 'Memory store not available';
      }

      // Save to store with user context
      await store.put(
        [namespace, userId],
        input.key,
        {
          value: input.value,
          timestamp: new Date().toISOString(),
          userId,
        }
      );

      return `Successfully remembered "${input.key}" in ${namespace}`;
    } catch (error) {
      return `Error remembering: ${(error as Error).message}`;
    }
  },
  {
    name: 'remember',
    description: 'Remember a specific piece of information for later recall',
    schema: z.object({
      key: z.string().describe('The key to identify this memory'),
      value: z.any().describe('The value to remember'),
      namespace: z.string().optional().describe('The namespace to store this in (default: memories)'),
    }),
  }
);

/**
 * Tool to recall something specific
 */
export const recallTool = tool(
  async (
    input: {
      key: string;
      namespace?: string;
    },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const store = config.store;
    const userId = config.configurable?.userId || 'default_user';
    const namespace = input.namespace || 'memories';

    try {
      if (!store) {
        return 'Memory store not available';
      }

      // Get from store
      const memory = await store.get([namespace, userId], input.key);
      
      if (memory) {
        const data = memory.value as any;
        return JSON.stringify(data.value, null, 2);
      }

      return `No memory found for key "${input.key}" in ${namespace}`;
    } catch (error) {
      return `Error recalling: ${(error as Error).message}`;
    }
  },
  {
    name: 'recall',
    description: 'Recall a specific piece of information that was previously remembered',
    schema: z.object({
      key: z.string().describe('The key to recall'),
      namespace: z.string().optional().describe('The namespace to recall from (default: memories)'),
    }),
  }
);

/**
 * Tool to forget/delete specific memory
 */
export const forgetTool = tool(
  async (
    input: {
      key: string;
      namespace?: string;
    },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const store = config.store;
    const userId = config.configurable?.userId || 'default_user';
    const namespace = input.namespace || 'memories';

    try {
      if (!store) {
        return 'Memory store not available';
      }

      // Delete from store
      await store.delete([namespace, userId], input.key);
      
      return `Successfully forgot "${input.key}" from ${namespace}`;
    } catch (error) {
      return `Error forgetting: ${(error as Error).message}`;
    }
  },
  {
    name: 'forget',
    description: 'Forget/delete a specific piece of information from memory',
    schema: z.object({
      key: z.string().describe('The key to forget'),
      namespace: z.string().optional().describe('The namespace to forget from (default: memories)'),
    }),
  }
);

/**
 * Tool to get course information from memory
 */
export const getCourseInfoTool = tool(
  async (
    input: { courseId: string },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    try {
      // First check if course memory is already in the metadata/context
      const metadataCourseMemory = (config as any)?.metadata?.courseMemory;
      if (metadataCourseMemory && metadataCourseMemory.courseId === input.courseId) {
        return JSON.stringify(metadataCourseMemory, null, 2);
      }

      // Otherwise fetch from memory manager
      const courseMemory = await memoryManager.getCourseMemory(input.courseId);
      if (courseMemory) {
        return JSON.stringify(courseMemory, null, 2);
      }

      return `No course information found for courseId: ${input.courseId}`;
    } catch (error) {
      return `Error retrieving course info: ${(error as Error).message}`;
    }
  },
  {
    name: 'get_course_info',
    description: 'Look up course information including students, assignments, and activities',
    schema: z.object({
      courseId: z.string().describe('The course ID to look up'),
    }),
  }
);

/**
 * Tool to search all course memories
 */
export const searchCoursesInMemoryTool = tool(
  async (
    input: { query?: string },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    try {
      const allCourses = await memoryManager.getAllCourseMemories();
      
      if (input.query) {
        const queryLower = input.query.toLowerCase();
        const filtered = allCourses.filter(course => 
          course.courseName.toLowerCase().includes(queryLower) ||
          course.courseShortName.toLowerCase().includes(queryLower) ||
          course.summary?.toLowerCase().includes(queryLower) ||
          course.assignments?.some(a => a.name.toLowerCase().includes(queryLower)) ||
          course.students?.some(s => s.name.toLowerCase().includes(queryLower))
        );
        
        if (filtered.length === 0) {
          return 'No courses found matching your query';
        }
        
        return filtered.map(c => 
          `${c.courseShortName}: ${c.courseName} (${c.students?.length || 0} students, ${c.assignments?.length || 0} assignments)`
        ).join('\n');
      }
      
      if (allCourses.length === 0) {
        return 'No courses found in memory';
      }
      
      return allCourses.map(c => 
        `${c.courseShortName}: ${c.courseName} (${c.students?.length || 0} students, ${c.assignments?.length || 0} assignments)`
      ).join('\n');
    } catch (error) {
      return `Error searching courses: ${(error as Error).message}`;
    }
  },
  {
    name: 'search_courses_in_memory',
    description: 'Search through all courses stored in memory',
    schema: z.object({
      query: z.string().optional().describe('Optional search query to filter courses'),
    }),
  }
);

/**
 * Tool to get comprehensive memory summary
 */
export const getMemorySummaryTool = tool(
  async (
    input: { includeStats?: boolean },
    config: LangGraphRunnableConfig
  ): Promise<string> => {
    const userId = config.configurable?.userId || 'default_user';
    
    try {
      const stats = memoryManager.getStats();
      const userProfile = await memoryManager.getUserProfile(userId);
      const recentSessions = await memoryManager.getRecentSessions(userId, 3);
      const allCourses = await memoryManager.getAllCourseMemories();
      
      let summary = '=== Memory System Summary ===\n\n';
      
      // User Profile
      if (userProfile) {
        summary += `User: ${userProfile.name || 'Unknown'} (${userId})\n`;
        summary += `Language: ${userProfile.language || 'Not set'}\n`;
        if (userProfile.preferences?.responseStyle) {
          summary += `Response Style: ${userProfile.preferences.responseStyle}\n`;
        }
      }
      
      // Statistics
      if (input.includeStats) {
        summary += `\nStatistics:\n`;
        summary += `- User Profiles: ${stats.userProfiles}\n`;
        summary += `- Sessions: ${stats.sessions}\n`;
        summary += `- Total Messages: ${stats.totalMessages}\n`;
        summary += `- Courses in Memory: ${allCourses.length}\n`;
      }
      
      // Recent Activity
      if (recentSessions.length > 0) {
        summary += `\nRecent Sessions:\n`;
        recentSessions.forEach(s => {
          summary += `- ${new Date(s.lastAccessed).toLocaleDateString()}: ${s.messages.length} messages\n`;
        });
      }
      
      // Courses
      if (allCourses.length > 0) {
        summary += `\nCourses Available:\n`;
        allCourses.forEach(c => {
          summary += `- ${c.courseShortName}: ${c.courseName}\n`;
        });
      }
      
      return summary;
    } catch (error) {
      return `Error generating memory summary: ${(error as Error).message}`;
    }
  },
  {
    name: 'get_memory_summary',
    description: 'Get a comprehensive summary of what is stored in memory',
    schema: z.object({
      includeStats: z.boolean().optional().describe('Include detailed statistics'),
    }),
  }
);

/**
 * Get all memory tools
 */
export function getMemoryTools() {
  return [
    getUserInfoTool,
    saveUserInfoTool,
    recallConversationTool,
    rememberTool,
    recallTool,
    forgetTool,
    getCourseInfoTool,
    searchCoursesInMemoryTool,
    getMemorySummaryTool,
  ];
}

/**
 * Get basic memory tools (read-only)
 */
export function getBasicMemoryTools() {
  return [
    getUserInfoTool,
    recallConversationTool,
    recallTool,
    getCourseInfoTool,
    searchCoursesInMemoryTool,
    getMemorySummaryTool,
  ];
}

/**
 * Get memory management tools (read/write)
 */
export function getMemoryManagementTools() {
  return [
    saveUserInfoTool,
    rememberTool,
    forgetTool,
  ];
}

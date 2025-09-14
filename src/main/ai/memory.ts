/**
 * Memory System for Unified Agent
 * Implements both short-term (thread-level) and long-term (cross-thread) memory
 * Based on LangGraph memory patterns: https://langchain-ai.github.io/langgraphjs/agents/memory/
 */

import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { InMemoryStore } from '@langchain/langgraph-checkpoint';
import { BaseMessage } from '@langchain/core/messages';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * Ensure directory exists
 */
const ensureDirectory = (dirPath: string): void => {
  // Use sync version for directory creation
  const fsSync = require('fs');
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Get default memory path in userData directory
 */
const getDefaultMemoryPath = (): string => {
  const userData = app?.isReady() ? app.getPath('userData') : process.cwd();
  const appName = app?.getName?.() || 'ezzzbet';
  const baseDir = path.join(userData, `${appName}-data`, 'memory');
  ensureDirectory(baseDir);
  return baseDir;
};

/**
 * User preferences and profile information
 */
export interface UserProfile {
  userId: string;
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
  metadata?: Record<string, any>;
  lastUpdated?: string;
}

/**
 * Session memory data
 */
export interface SessionMemory {
  sessionId: string;
  threadId: string;
  messages: BaseMessage[];
  summary?: string;
  topics?: string[];
  entities?: string[];
  createdAt: string;
  lastAccessed: string;
  metadata?: Record<string, any>;
}

/**
 * Course-specific episodic memory
 */
export interface CourseMemory {
  courseId: string;
  courseName: string;
  courseShortName: string;
  summary?: string;
  assignments: Array<{
    id: string;
    name: string;
    dueDate: number;
    description?: string;
  }>;
  students: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  activities: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  keyTopics?: string[];
  keyDates?: Array<{
    date: string;
    description: string;
  }>;
  lastUpdated: string;
  metadata?: Record<string, any>;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  enableShortTermMemory?: boolean;
  enableLongTermMemory?: boolean;
  persistencePath?: string;
  maxMessagesPerThread?: number;
  maxThreadsPerUser?: number;
  autoSummarize?: boolean;
  summarizeAfterMessages?: number;
}

/**
 * Memory Manager
 * Manages both short-term and long-term memory for the unified agent
 */
export class MemoryManager {
  private checkpointer: MemorySaver;
  private store: InMemoryStore;
  private config: MemoryConfig;
  private persistencePath: string;
  private sessionMemories: Map<string, SessionMemory>;
  private userProfiles: Map<string, UserProfile>;
  private courseMemories: Map<string, CourseMemory>;

  constructor(config?: MemoryConfig) {
    this.config = {
      enableShortTermMemory: true,
      enableLongTermMemory: true,
      persistencePath: undefined, // Will be set during initialize()
      maxMessagesPerThread: 100,
      maxThreadsPerUser: 10,
      autoSummarize: true,
      summarizeAfterMessages: 20,
      ...config,
    };

    // Initialize checkpointer for short-term memory
    this.checkpointer = new MemorySaver();

    // Initialize store for long-term memory
    this.store = new InMemoryStore();

    // Initialize local caches
    this.sessionMemories = new Map();
    this.userProfiles = new Map();
    this.courseMemories = new Map();

    // Persistence path will be set during initialize()
    this.persistencePath = '';
  }

  /**
   * Initialize the memory manager
   */
  async initialize(): Promise<void> {
    try {
      // Set persistence path now that app is ready
      this.persistencePath = this.config.persistencePath || getDefaultMemoryPath();
      
      // Create persistence directory if it doesn't exist
      await fs.mkdir(this.persistencePath, { recursive: true });

      // Load persisted memories
      await this.loadPersistedMemories();
      
      console.log('🧠 Memory Manager initialized');
      console.log('📁 Memory storage path:', this.persistencePath);
    } catch (error) {
      console.error('Failed to initialize memory manager:', error);
      throw error;
    }
  }

  /**
   * Get checkpointer for short-term memory
   */
  getCheckpointer(): MemorySaver {
    return this.checkpointer;
  }

  /**
   * Get store for long-term memory
   */
  getStore(): InMemoryStore {
    return this.store;
  }

  /**
   * Save or update user profile
   */
  async saveUserProfile(profile: UserProfile): Promise<void> {
    if (!this.config.enableLongTermMemory) return;

    try {
      profile.lastUpdated = new Date().toISOString();
      
      // Save to store
      await this.store.put(
        ['users'],
        profile.userId,
        profile
      );

      // Update local cache
      this.userProfiles.set(profile.userId, profile);

      // Persist to disk
      await this.persistUserProfile(profile);

      console.log(`💾 Saved user profile for ${profile.userId}`);
    } catch (error) {
      console.error('Failed to save user profile:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!this.config.enableLongTermMemory) return null;

    try {
      // Check local cache first
      if (this.userProfiles.has(userId)) {
        return this.userProfiles.get(userId)!;
      }

      // Try to get from store
      const stored = await this.store.get(['users'], userId);
      if (stored) {
        const profile = stored.value as UserProfile;
        this.userProfiles.set(userId, profile);
        return profile;
      }

      // Try to load from disk
      const persisted = await this.loadUserProfile(userId);
      if (persisted) {
        this.userProfiles.set(userId, persisted);
        await this.store.put(['users'], userId, persisted);
        return persisted;
      }

      return null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<UserProfile['preferences']>
  ): Promise<void> {
    const profile = await this.getUserProfile(userId) || {
      userId,
      preferences: {},
    };

    profile.preferences = {
      ...profile.preferences,
      ...preferences,
    };

    await this.saveUserProfile(profile);
  }

  /**
   * Save session memory
   */
  async saveSessionMemory(session: SessionMemory): Promise<void> {
    if (!this.config.enableShortTermMemory) return;

    try {
      session.lastAccessed = new Date().toISOString();

      // Save to store
      await this.store.put(
        ['sessions', session.sessionId],
        session.threadId,
        session
      );

      // Update local cache
      this.sessionMemories.set(`${session.sessionId}:${session.threadId}`, session);

      // Trim messages if needed
      if (this.config.maxMessagesPerThread && 
          session.messages.length > this.config.maxMessagesPerThread) {
        session.messages = session.messages.slice(-this.config.maxMessagesPerThread);
      }

      // Auto-summarize if needed
      if (this.config.autoSummarize && 
          this.config.summarizeAfterMessages &&
          session.messages.length >= this.config.summarizeAfterMessages &&
          !session.summary) {
        // Note: Summary generation would require LLM integration
        // This is a placeholder for the summarization logic
        session.summary = 'Session summary would be generated here';
      }

      // Persist to disk
      await this.persistSessionMemory(session);

      console.log(`💾 Saved session memory for ${session.sessionId}:${session.threadId}`);
    } catch (error) {
      console.error('Failed to save session memory:', error);
      throw error;
    }
  }

  /**
   * Get session memory
   */
  async getSessionMemory(sessionId: string, threadId: string): Promise<SessionMemory | null> {
    if (!this.config.enableShortTermMemory) return null;

    try {
      const key = `${sessionId}:${threadId}`;

      // Check local cache first
      if (this.sessionMemories.has(key)) {
        return this.sessionMemories.get(key)!;
      }

      // Try to get from store
      const stored = await this.store.get(['sessions', sessionId], threadId);
      if (stored) {
        const session = stored.value as SessionMemory;
        this.sessionMemories.set(key, session);
        return session;
      }

      // Try to load from disk
      const persisted = await this.loadSessionMemory(sessionId, threadId);
      if (persisted) {
        this.sessionMemories.set(key, persisted);
        await this.store.put(['sessions', sessionId], threadId, persisted);
        return persisted;
      }

      return null;
    } catch (error) {
      console.error('Failed to get session memory:', error);
      return null;
    }
  }

  /**
   * Get recent sessions for a user
   */
  async getRecentSessions(userId: string, limit: number = 5): Promise<SessionMemory[]> {
    const sessions: SessionMemory[] = [];
    
    try {
      // Get all sessions from store
      const allSessions = await this.store.search(['sessions']);
      
      for (const item of allSessions) {
        const session = item.value as SessionMemory;
        if (session.metadata?.userId === userId) {
          sessions.push(session);
        }
      }

      // Sort by last accessed and limit
      sessions.sort((a, b) => 
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
      );

      return sessions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get recent sessions:', error);
      return [];
    }
  }

  /**
   * Save or update course memory
   */
  async saveCourseMemory(courseMemory: CourseMemory): Promise<void> {
    if (!this.config.enableLongTermMemory) {
      console.log('⚠️ Long-term memory disabled, skipping course memory save');
      return;
    }

    try {
      console.log(`📝 Saving course memory for ${courseMemory.courseShortName} (${courseMemory.courseId})`);
      console.log(`   - Assignments: ${courseMemory.assignments.length}`);
      console.log(`   - Students: ${courseMemory.students.length}`);
      console.log(`   - Activities: ${courseMemory.activities.length}`);
      
      courseMemory.lastUpdated = new Date().toISOString();
      
      // Save to store with course namespace
      await this.store.put(
        ['courses'],
        courseMemory.courseId,
        courseMemory
      );
      console.log(`   ✓ Saved to in-memory store`);

      // Update local cache
      this.courseMemories.set(courseMemory.courseId, courseMemory);
      console.log(`   ✓ Updated local cache`);

      // Persist to disk
      await this.persistCourseMemory(courseMemory);
      console.log(`   ✓ Persisted to disk`);

      console.log(`💾 Successfully saved course memory for ${courseMemory.courseShortName}`);
    } catch (error) {
      console.error('❌ Failed to save course memory:', error);
      throw error;
    }
  }

  /**
   * Get course memory
   */
  async getCourseMemory(courseId: string): Promise<CourseMemory | null> {
    if (!this.config.enableLongTermMemory) {
      console.log('⚠️ Long-term memory disabled, returning null');
      return null;
    }

    console.log(`🔍 Looking for course memory: ${courseId}`);

    try {
      // Check local cache first
      if (this.courseMemories.has(courseId)) {
        const cached = this.courseMemories.get(courseId)!;
        console.log(`   ✓ Found in local cache (${cached.courseShortName})`);
        return cached;
      }
      console.log(`   - Not in local cache`);

      // Try to get from store
      const stored = await this.store.get(['courses'], courseId);
      if (stored) {
        const courseMemory = stored.value as CourseMemory;
        this.courseMemories.set(courseId, courseMemory);
        console.log(`   ✓ Found in store (${courseMemory.courseShortName})`);
        return courseMemory;
      }
      console.log(`   - Not in store`);

      // Try to load from disk
      const persisted = await this.loadCourseMemory(courseId);
      if (persisted) {
        this.courseMemories.set(courseId, persisted);
        await this.store.put(['courses'], courseId, persisted);
        console.log(`   ✓ Loaded from disk (${persisted.courseShortName})`);
        return persisted;
      }
      console.log(`   - Not found on disk`);

      console.log(`   ❌ Course memory not found for ${courseId}`);
      return null;
    } catch (error) {
      console.error('❌ Failed to get course memory:', error);
      return null;
    }
  }

  /**
   * Get all course memories for context
   */
  async getAllCourseMemories(): Promise<CourseMemory[]> {
    try {
      const courses: CourseMemory[] = [];
      
      // Get all courses from store
      const allCourses = await this.store.search(['courses']);
      
      for (const item of allCourses) {
        const course = item.value as CourseMemory;
        courses.push(course);
      }

      return courses;
    } catch (error) {
      console.error('Failed to get all course memories:', error);
      return [];
    }
  }

  /**
   * Search memories by query
   */
  async searchMemories(query: string, userId?: string): Promise<{
    sessions: SessionMemory[];
    profiles: UserProfile[];
    courses: CourseMemory[];
  }> {
    const results = {
      sessions: [] as SessionMemory[],
      profiles: [] as UserProfile[],
      courses: [] as CourseMemory[],
    };

    try {
      const queryLower = query.toLowerCase();

      // Search sessions
      for (const session of this.sessionMemories.values()) {
        if (userId && session.metadata?.userId !== userId) continue;

        const matchesQuery = 
          session.summary?.toLowerCase().includes(queryLower) ||
          session.topics?.some(t => t.toLowerCase().includes(queryLower)) ||
          session.entities?.some(e => e.toLowerCase().includes(queryLower));

        if (matchesQuery) {
          results.sessions.push(session);
        }
      }

      // Search profiles
      for (const profile of this.userProfiles.values()) {
        if (userId && profile.userId !== userId) continue;

        const matchesQuery = 
          profile.name?.toLowerCase().includes(queryLower) ||
          profile.context?.interests?.some(i => i.toLowerCase().includes(queryLower)) ||
          profile.context?.expertise?.some(e => e.toLowerCase().includes(queryLower));

        if (matchesQuery) {
          results.profiles.push(profile);
        }
      }

      // Search courses
      for (const course of this.courseMemories.values()) {
        const matchesQuery = 
          course.courseName.toLowerCase().includes(queryLower) ||
          course.courseShortName.toLowerCase().includes(queryLower) ||
          course.summary?.toLowerCase().includes(queryLower) ||
          course.keyTopics?.some(t => t.toLowerCase().includes(queryLower)) ||
          course.assignments.some(a => a.name.toLowerCase().includes(queryLower));

        if (matchesQuery) {
          results.courses.push(course);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to search memories:', error);
      return results;
    }
  }

  /**
   * Clear old sessions
   */
  async clearOldSessions(daysToKeep: number = 30): Promise<number> {
    let cleared = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      for (const [key, session] of this.sessionMemories.entries()) {
        if (new Date(session.lastAccessed) < cutoffDate) {
          this.sessionMemories.delete(key);
          await this.store.delete(['sessions', session.sessionId], session.threadId);
          cleared++;
        }
      }

      console.log(`🧹 Cleared ${cleared} old sessions`);
      return cleared;
    } catch (error) {
      console.error('Failed to clear old sessions:', error);
      return cleared;
    }
  }

  /**
   * Persist user profile to disk
   */
  private async persistUserProfile(profile: UserProfile): Promise<void> {
    try {
      const filePath = path.join(this.persistencePath, 'users', `${profile.userId}.json`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
    } catch (error) {
      console.error('Failed to persist user profile:', error);
    }
  }

  /**
   * Load user profile from disk
   */
  private async loadUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const filePath = path.join(this.persistencePath, 'users', `${userId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Persist course memory to disk
   */
  private async persistCourseMemory(courseMemory: CourseMemory): Promise<void> {
    try {
      const filePath = path.join(this.persistencePath, 'courses', `${courseMemory.courseId}.json`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(courseMemory, null, 2));
    } catch (error) {
      console.error('Failed to persist course memory:', error);
    }
  }

  /**
   * Load course memory from disk
   */
  private async loadCourseMemory(courseId: string): Promise<CourseMemory | null> {
    try {
      const filePath = path.join(this.persistencePath, 'courses', `${courseId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Persist session memory to disk
   */
  private async persistSessionMemory(session: SessionMemory): Promise<void> {
    try {
      const filePath = path.join(
        this.persistencePath, 
        'sessions', 
        session.sessionId,
        `${session.threadId}.json`
      );
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error('Failed to persist session memory:', error);
    }
  }

  /**
   * Load session memory from disk
   */
  private async loadSessionMemory(sessionId: string, threadId: string): Promise<SessionMemory | null> {
    try {
      const filePath = path.join(
        this.persistencePath,
        'sessions',
        sessionId,
        `${threadId}.json`
      );
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load all persisted memories on startup
   */
  private async loadPersistedMemories(): Promise<void> {
    try {
      // Load user profiles
      const usersDir = path.join(this.persistencePath, 'users');
      try {
        const userFiles = await fs.readdir(usersDir);
        for (const file of userFiles) {
          if (file.endsWith('.json')) {
            const userId = file.replace('.json', '');
            const profile = await this.loadUserProfile(userId);
            if (profile) {
              this.userProfiles.set(userId, profile);
              await this.store.put(['users'], userId, profile);
            }
          }
        }
      } catch (error) {
        // Users directory might not exist yet
      }

      // Load recent sessions (limit to recent ones for performance)
      const sessionsDir = path.join(this.persistencePath, 'sessions');
      try {
        const sessionDirs = await fs.readdir(sessionsDir);
        for (const sessionId of sessionDirs) {
          const threadDir = path.join(sessionsDir, sessionId);
          const threadFiles = await fs.readdir(threadDir);
          for (const file of threadFiles) {
            if (file.endsWith('.json')) {
              const threadId = file.replace('.json', '');
              const session = await this.loadSessionMemory(sessionId, threadId);
              if (session) {
                const key = `${sessionId}:${threadId}`;
                this.sessionMemories.set(key, session);
                await this.store.put(['sessions', sessionId], threadId, session);
              }
            }
          }
        }
      } catch (error) {
        // Sessions directory might not exist yet
      }

      // Load course memories
      const coursesDir = path.join(this.persistencePath, 'courses');
      try {
        const courseFiles = await fs.readdir(coursesDir);
        for (const file of courseFiles) {
          if (file.endsWith('.json')) {
            const courseId = file.replace('.json', '');
            const courseMemory = await this.loadCourseMemory(courseId);
            if (courseMemory) {
              this.courseMemories.set(courseId, courseMemory);
              await this.store.put(['courses'], courseId, courseMemory);
            }
          }
        }
      } catch (error) {
        // Courses directory might not exist yet
      }

      console.log(`📚 Loaded ${this.userProfiles.size} user profiles, ${this.sessionMemories.size} sessions, and ${this.courseMemories.size} courses`);
    } catch (error) {
      console.error('Failed to load persisted memories:', error);
    }
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    userProfiles: number;
    sessions: number;
    totalMessages: number;
  } {
    let totalMessages = 0;
    for (const session of this.sessionMemories.values()) {
      totalMessages += session.messages.length;
    }

    return {
      userProfiles: this.userProfiles.size,
      sessions: this.sessionMemories.size,
      totalMessages,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Persist all in-memory data
      for (const profile of this.userProfiles.values()) {
        await this.persistUserProfile(profile);
      }

      for (const session of this.sessionMemories.values()) {
        await this.persistSessionMemory(session);
      }

      for (const course of this.courseMemories.values()) {
        await this.persistCourseMemory(course);
      }

      // Clear caches
      this.userProfiles.clear();
      this.sessionMemories.clear();
      this.courseMemories.clear();

      console.log('🛑 Memory Manager cleaned up');
    } catch (error) {
      console.error('Error cleaning up memory manager:', error);
    }
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();

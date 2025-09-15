/**
 * Graph Types and Interfaces
 * Core types for the multi-agent graph system
 */

import { BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

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
  // Todo tracking fields
  todos?: Array<{
    id: string;
    text: string;
    completed: boolean;
    order: number;
  }>;
  currentTodoIndex?: number;
  completedTodos?: number[];
  // Execution fields
  toolResults?: any[];
  needsSynthesis?: boolean;
}

/**
 * Multi-agent graph configuration
 */
export interface MultiAgentConfig {
  agents: string[];  // Agent names to include
  defaultAgent?: string;  // Default/starting agent
  llm?: ChatOpenAI;
  enableMemory?: boolean;  // Enable memory features
}

/**
 * Graph channel configuration for state management
 */
export interface GraphChannels {
  messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[]) => BaseMessage[];
    default: () => BaseMessage[];
  };
  activeAgent: { reducer: (x: any, y: any) => any };
  sessionId: { reducer: (x: any, y: any) => any };
  metadata: { reducer: (x: any, y: any) => any };
  threadId: { reducer: (x: any, y: any) => any };
  userId: { reducer: (x: any, y: any) => any };
  userProfile: { reducer: (x: any, y: any) => any };
  plan: { reducer: (x: any, y: any) => any };
  todos: { reducer: (x: any, y: any) => any };
  currentTodoIndex: { reducer: (x: any, y: any) => any };
  completedTodos: {
    reducer: (x: any[], y: any[]) => any[];
    default: () => any[];
  };
  toolResults: {
    reducer: (x: any[], y: any[]) => any[];
    default: () => any[];
  };
  needsSynthesis: { reducer: (x: any, y: any) => any };
}


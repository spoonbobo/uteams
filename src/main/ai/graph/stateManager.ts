/**
 * State Manager
 * Handles state channel configuration and reducers
 */

import { BaseMessage } from '@langchain/core/messages';
import { GraphChannels } from './types';

/**
 * Creates the graph channels configuration with reducers
 */
export function createGraphChannels(): GraphChannels {
  return {
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
    todos: { reducer: (x: any, y: any) => y ?? x },
    currentTodoIndex: { reducer: (x: any, y: any) => y ?? x },
    completedTodos: { 
      reducer: (x: any[], y: any[]) => [...(x || []), ...(y || [])],
      default: () => [],
    },
    toolResults: { 
      reducer: (x: any[], y: any[]) => [...(x || []), ...(y || [])],
      default: () => [],
    },
    needsSynthesis: { reducer: (x: any, y: any) => y ?? x },
  };
}

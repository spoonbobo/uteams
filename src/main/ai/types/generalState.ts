/**
 * General Agent State Types
 * Minimal state for a simple three-node graph
 */

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';

export interface GeneralRequest {
  sessionId: string;
  prompt?: string;
}

export interface GeneralResponse {
  requestId: string;
  sessionId: string;
  resultSummary: string;
}

export interface GeneralState {
  request: GeneralRequest;
  sessionId: string;
  progress: number;
  messages: Array<HumanMessage | SystemMessage | AIMessage>;
  currentStep: string;
  errors: string[];
  response?: GeneralResponse;
  // Time/context
  nowIso?: string;
  timezone?: string;
  // Planning context
  goal?: string;
  toolPlan?: Array<{ toolName: string; params?: Record<string, any> }>;
  usedTavily?: boolean;
  // Planning outputs
  planText?: string;
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex';
  needsTools?: boolean;
  needsWeb?: boolean;
  directAnswerText?: string;
}

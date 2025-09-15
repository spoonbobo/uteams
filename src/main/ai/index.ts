/**
 * Agent entrypoint: registers IPC, initializes unified agent, and exposes cleanup.
 */

import { exec } from 'child_process';
import { orchestrator } from './orchestrator';

export async function initializeAgents(): Promise<void> {
  // Initialize Unified Agent
  try {
    console.log('🤖 Initializing Unified Agent system...');
    await orchestrator.initialize();
    
    try {
      await orchestrator.warmupMCP(30000);
    } catch (e) {
      console.warn('Unified Agent MCP warmup failed or timed out', e);
    }
    
    console.log('✅ Unified Agent system ready');
  } catch (e) {
    console.error('❌ Failed to initialize Unified Agent at startup:', e);
  }
}

export function registerAgentIpc(): void {
  // No IPC registration here. Research and chat IPC handlers are defined in
  // ./research and ./chat respectively to avoid duplicate registrations.
}

export async function cleanupAgents(): Promise<void> {
  // Clean up unified agent
  try {
    await orchestrator.cleanup();
    console.log('Unified agent cleaned up');
  } catch (error) {
    console.error('Error cleaning up unified agent:', error);
  }
  
}

// Export the unified agent as the primary interface
export { orchestrator };

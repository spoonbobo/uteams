/**
 * Abort Controller Manager
 * Manages abort controllers for cancellable operations
 */

export class AbortManager {
  private static instance: AbortManager;
  private controllers: Map<string, AbortController> = new Map();
  private listeners: Map<string, (() => void)[]> = new Map();

  private constructor() {}

  static getInstance(): AbortManager {
    if (!AbortManager.instance) {
      AbortManager.instance = new AbortManager();
    }
    return AbortManager.instance;
  }

  /**
   * Create a new abort controller for a session
   */
  createController(sessionId: string): AbortController {
    // Abort any existing controller for this session
    this.abort(sessionId);
    
    const controller = new AbortController();
    this.controllers.set(sessionId, controller);
    
    // Add listener for abort signal
    controller.signal.addEventListener('abort', () => {
      console.log(`[AbortManager] Session ${sessionId} aborted`);
      this.cleanup(sessionId);
    });
    
    return controller;
  }

  /**
   * Get abort controller for a session
   */
  getController(sessionId: string): AbortController | undefined {
    return this.controllers.get(sessionId);
  }

  /**
   * Get abort signal for a session
   */
  getSignal(sessionId: string): AbortSignal | undefined {
    return this.controllers.get(sessionId)?.signal;
  }

  /**
   * Check if a session is aborted
   */
  isAborted(sessionId: string): boolean {
    return this.controllers.get(sessionId)?.signal.aborted ?? false;
  }

  /**
   * Abort a specific session
   */
  abort(sessionId: string, reason?: string): boolean {
    const controller = this.controllers.get(sessionId);
    if (controller && !controller.signal.aborted) {
      console.log(`[AbortManager] Aborting session ${sessionId}${reason ? `: ${reason}` : ''}`);
      controller.abort(reason);
      
      // Notify listeners
      const callbacks = this.listeners.get(sessionId) || [];
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`[AbortManager] Error in abort listener:`, error);
        }
      });
      
      return true;
    }
    return false;
  }

  /**
   * Abort all active sessions
   */
  abortAll(reason?: string): number {
    let abortedCount = 0;
    for (const sessionId of this.controllers.keys()) {
      if (this.abort(sessionId, reason)) {
        abortedCount++;
      }
    }
    return abortedCount;
  }

  /**
   * Register a listener for when a session is aborted
   */
  onAbort(sessionId: string, callback: () => void): () => void {
    const callbacks = this.listeners.get(sessionId) || [];
    callbacks.push(callback);
    this.listeners.set(sessionId, callbacks);
    
    // Return cleanup function
    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup resources for a session
   */
  cleanup(sessionId: string): void {
    this.controllers.delete(sessionId);
    this.listeners.delete(sessionId);
  }

  /**
   * Cleanup all resources
   */
  cleanupAll(): void {
    this.controllers.clear();
    this.listeners.clear();
  }

  /**
   * Get list of active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.controllers.keys()).filter(
      sessionId => !this.isAborted(sessionId)
    );
  }

  /**
   * Check if a session has an active (non-aborted) controller
   */
  hasActiveController(sessionId: string): boolean {
    const controller = this.controllers.get(sessionId);
    return controller !== undefined && !controller.signal.aborted;
  }
}

// Export singleton instance
export const abortManager = AbortManager.getInstance();

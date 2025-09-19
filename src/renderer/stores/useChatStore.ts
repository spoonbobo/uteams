import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage } from '../types/message';
import type { AgentPlan, TodoItem } from '../types/plan';
import { useWorkStore } from './useWorkStore';

type ChatState = {
  messagesBySession: Record<string, ChatMessage[]>;
  isLoadingBySession: Record<string, boolean>;
  // Streaming state: in-progress assistant message by session
  streamingBySession: Record<string, { id: string; text: string } | undefined>;
  // Agent plan by session
  planBySession: Record<string, AgentPlan | undefined>;
  // Todos by session
  todosBySession: Record<string, TodoItem[] | undefined>;
  // Thinking state: whether agent is processing
  isThinkingBySession: Record<string, boolean>;
  // Token batching state with RAF support
  tokenBatchBySession: Record<string, {
    tokens: string[];
    timeoutId?: NodeJS.Timeout;
    rafId?: number;
    lastFlush?: number;
  } | undefined>;

  loadMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'chatId' | 'createdAt'>) => Promise<void>;
  sendUserMessage: (sessionId: string, text: string, courseId?: string, ocrText?: string, skipUserMessage?: boolean, workCategory?: string) => Promise<void>;
  sendCompanionMessage: (sessionId: string, text: string) => Promise<void>;
  deleteMessage: (sessionId: string, id: string) => Promise<void>;
  clearAllMessages: (sessionId: string) => Promise<void>;
  // Streaming controls
  beginStream: (sessionId: string) => string; // returns stream message id
  appendStream: (sessionId: string, chunk: string) => void;
  appendStreamBatched: (sessionId: string, token: string) => void; // New batched append
  flushTokenBatch: (sessionId: string) => void; // Force flush tokens
  endStream: (sessionId: string) => void;
  // Thinking messages
  addThinkingMessage: (sessionId: string, text: string) => void;
  clearThinkingMessages: (sessionId: string) => void;
  // Plan management
  setPlan: (sessionId: string, plan: AgentPlan) => void;
  updatePlanStep: (sessionId: string, stepIndex: number) => void;
  clearPlan: (sessionId: string) => void;
  // Todo management
  setTodos: (sessionId: string, todos: TodoItem[]) => void;
  updateTodo: (sessionId: string, todoId: string, updates: Partial<TodoItem>) => void;
  updateTodoByIndex: (sessionId: string, index: number, completed: boolean) => void;
  clearTodos: (sessionId: string) => void;
  // Thinking state management
  setThinking: (sessionId: string, isThinking: boolean) => void;
  // Abort management
  abortSession: (sessionId: string, reason?: string) => Promise<void>;
};

export const useChatStore = create<ChatState>()(
  devtools((set, get) => ({
    messagesBySession: {},
    isLoadingBySession: {},
    streamingBySession: {},
    planBySession: {},
    todosBySession: {},
    isThinkingBySession: {},
    tokenBatchBySession: {},

    loadMessages: async (sessionId) => {
      const state = get();
      if (state.isLoadingBySession[sessionId]) return;
      set(
        (s) => ({
          isLoadingBySession: { ...s.isLoadingBySession, [sessionId]: true },
        }),
        false,
        'chat:load:start',
      );
      try {
        const rows = await (window as any).electron?.ipcRenderer?.invoke(
          'chat:list',
          { chatId: sessionId },
        );
        const messages: ChatMessage[] = Array.isArray(rows)
          ? rows.map((r: any) => ({
              id: String(r.id),
              chatId: String(r.chat_id),
              text: String(r.text ?? ''),
              sender: (r.sender as 'user' | 'companion') ?? 'companion',
              createdAt: String(r.created_at ?? new Date().toISOString()),
              isRead: Boolean(r.is_read),
              type: 'normal',
            }))
          : [];
        set(
          (s) => ({
            messagesBySession: { ...s.messagesBySession, [sessionId]: messages },
          }),
          false,
          'chat:load:success',
        );
      } catch (e) {
        // ignore
      } finally {
        set(
          (s) => ({
            isLoadingBySession: { ...s.isLoadingBySession, [sessionId]: false },
          }),
          false,
          'chat:load:end',
        );
      }
    },

    addMessage: async (sessionId, message) => {
      const id = message.id || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
      const createdAt = new Date().toISOString();
      const record = {
        id,
        chatId: sessionId,
        text: message.text,
        sender: message.sender,
        createdAt,
        type: message.type ?? 'normal',
      };

      // optimistic update
      set(
        (s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: [...(s.messagesBySession[sessionId] ?? []), record],
          },
        }),
        false,
        'chat:add:optimistic',
      );

      try {
        await (window as any).electron?.ipcRenderer?.invoke('chat:add', {
          id,
          chatId: sessionId,
          text: message.text,
          sender: message.sender,
          createdAt,
        });
      } catch (e) {
        // rollback best-effort
      }
    },

    addThinkingMessage: (sessionId, text) => {
      const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      const createdAt = new Date().toISOString();
      const record: ChatMessage = {
        id,
        chatId: sessionId,
        text,
        sender: 'companion',
        createdAt,
        type: 'thinking',
      };
      set(
        (s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: [...(s.messagesBySession[sessionId] ?? []), record],
          },
        }),
        false,
        'chat:add:thinking',
      );
    },

    clearThinkingMessages: (sessionId) => {
      set(
        (s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] ?? []).filter(
              (m) => m.type !== 'thinking',
            ),
          },
        }),
        false,
        'chat:thinking:clear',
      );
    },

    sendUserMessage: async (sessionId, text, courseId?: string, ocrText?: string, skipUserMessage?: boolean, workCategory?: string) => {
      if (!text?.trim()) return;

      // Set thinking state immediately when user sends message
      get().setThinking(sessionId, true);

      // Start work tracking for this chat session
      try {
        const workStore = useWorkStore.getState();
        const description = text.length > 100 ? `${text.substring(0, 100)}...` : text;
        // Determine work category: if courseId is provided (Ask context), use 'ask', otherwise use provided category or 'general'
        const category = workCategory || (courseId ? 'ask' : 'general');
        // End any existing work first, then create new work
        await workStore.endWorkForSession(sessionId);
        const work = await workStore.createWork(description, category, sessionId);
        workStore.setActiveWork(work);
      } catch (error) {
        console.error('[chat] Failed to start work tracking:', error);
        // Don't block the chat if work tracking fails
      }

      // Enhance the prompt with available context
      let enhancedText = text;

      // Add OCR context if available
      if (ocrText && ocrText.trim()) {
        enhancedText = `${text}\n\n[Screen Content OCR]: ${ocrText.trim()}`;
      }

      // Add course context if available
      if (courseId) {
        enhancedText = `${enhancedText}\n\n[Context: Course ${courseId} data is available in memory]`;
      }

      // Store the original user message (without the hint) unless skipped
      if (!skipUserMessage) {
        await get().addMessage(sessionId, {
          id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
          text, // Original text without enhancement
          sender: 'user',
        });
      }

      // Defer starting stream until content (non-thinking) arrives
      try {
        // Subscribe to chunk/done/error events for this session
        const ipc = (window as any).electron?.ipcRenderer;
        const onChunk = (payload: { sessionId: string; chunk: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onChunk', { sessionId, preview: String(payload.chunk).slice(0, 60) });
          const chunk = String(payload.chunk ?? '');

          // We no longer show thinking messages, just track state
          // Start streaming immediately when we get chunks
          const current = get().streamingBySession[sessionId];
          if (!current) {
            const streamId = get().beginStream(sessionId);
            console.log('[chat] beginStream', { sessionId, streamId });
            // Clear thinking state when real content starts (only if it's still true)
            if (get().isThinkingBySession[sessionId]) {
              get().setThinking(sessionId, false);
            }
          }
          get().appendStream(sessionId, chunk);
        };
        const onDone = (payload: { sessionId: string; final?: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onDone', { sessionId });
          // Clear thinking state when done (only if still set)
          if (get().isThinkingBySession[sessionId]) {
            get().setThinking(sessionId, false);
          }
          get().clearThinkingMessages(sessionId);

          // End streaming if active (tokens were streamed)
          const current = get().streamingBySession[sessionId];
          if (current) {
            get().endStream(sessionId);
          }

          // Legacy: handle final text if provided (fallback for non-streaming)
          const final = String(payload?.final ?? '');
          if (final && !current) {
            void get().addMessage(sessionId, {
              id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
              text: final,
              sender: 'companion',
              type: 'normal',
            });
          }
          // Clear plan and todos when done as well (task completed)
          get().clearPlan(sessionId);
          get().clearTodos(sessionId);

          // End work tracking for this session
          try {
            const workStore = useWorkStore.getState();
            void workStore.endWorkForSession(sessionId);
          } catch (error) {
            console.error('[chat] Failed to end work tracking:', error);
          }

          try { offChunk?.(); } catch {}
          try { offDone?.(); } catch {}
          try { offError?.(); } catch {}
          try { offPlan?.(); } catch {}
          try { offTodos?.(); } catch {}
          try { offTodoUpdate?.(); } catch {}
          try { offToken?.(); } catch {}
          try { offSynthesisStart?.(); } catch {}
        };
        const onError = (payload: { sessionId: string; error: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onError', { sessionId, error: payload.error });
          get().appendStream(sessionId, `\n[error] ${payload.error}`);
          // Ensure we also clean up any thinking state on error (only if still set)
          if (get().isThinkingBySession[sessionId]) {
            get().setThinking(sessionId, false);
          }
          get().clearThinkingMessages(sessionId);
          get().clearPlan(sessionId);
          get().clearTodos(sessionId);
          get().endStream(sessionId);

          // End work tracking for this session on error
          try {
            const workStore = useWorkStore.getState();
            void workStore.endWorkForSession(sessionId);
          } catch (error) {
            console.error('[chat] Failed to end work tracking on error:', error);
          }

          try { offChunk?.(); } catch {}
          try { offDone?.(); } catch {}
          try { offError?.(); } catch {}
          try { offPlan?.(); } catch {}
          try { offTodos?.(); } catch {}
          try { offTodoUpdate?.(); } catch {}
          try { offToken?.(); } catch {}
          try { offSynthesisStart?.(); } catch {}
        };
        const onPlan = (payload: { sessionId: string; plan: AgentPlan }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onPlan', { sessionId, plan: payload.plan });
          get().setPlan(sessionId, payload.plan);
        };
        const onTodos = (payload: { sessionId: string; todos: TodoItem[] }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onTodos', { sessionId, todos: payload.todos });
          get().setTodos(sessionId, payload.todos);
        };
        const onTodoUpdate = (payload: { sessionId: string; todoIndex: number; completed: boolean }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onTodoUpdate', { sessionId, index: payload.todoIndex, completed: payload.completed });
          get().updateTodoByIndex(sessionId, payload.todoIndex, payload.completed);
        };
        const onToken = (payload: { sessionId: string; token: string; node: string }) => {
          if (payload?.sessionId !== sessionId) return;

          // Prevent processing if we're in a recursion loop
          const batch = get().tokenBatchBySession[sessionId];
          if (batch && batch.tokens.length > 100) {
            console.warn('[chat] Token batch overflow, skipping token to prevent recursion');
            return;
          }

          // Stream tokens using batched approach to prevent recursion limits
          const current = get().streamingBySession[sessionId];
          if (!current) {
            // Start streaming and clear thinking state in a single update
            const streamId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
            set(
              (s) => {
                const updates: any = {
                  streamingBySession: {
                    ...s.streamingBySession,
                    [sessionId]: { id: streamId, text: '' }, // Start with empty text, tokens will be batched
                  },
                };
                // Only update thinking if it's currently true
                if (s.isThinkingBySession[sessionId]) {
                  updates.isThinkingBySession = {
                    ...s.isThinkingBySession,
                    [sessionId]: false,
                  };
                }
                return updates;
              },
              false,
              'chat:token:firstToken',
            );
            console.log('[chat] beginStream for tokens', { sessionId, streamId });
            get().clearThinkingMessages(sessionId);
          }

          // Use batched streaming to prevent recursion limits with fast models
          get().appendStreamBatched(sessionId, payload.token);
        };
        const onSynthesisStart = (payload: { sessionId: string; progress: number }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] synthesis starting, preparing for token stream', { sessionId });
          // Clear thinking state when synthesis starts (only if still set)
          if (get().isThinkingBySession[sessionId]) {
            get().setThinking(sessionId, false);
          }
          get().clearThinkingMessages(sessionId);
        };

        const offChunk = ipc?.on?.('chat:agent:chunk' as any, onChunk as any);
        const offDone = ipc?.on?.('chat:agent:done' as any, onDone as any);
        const offError = ipc?.on?.('chat:agent:error' as any, onError as any);
        const offPlan = ipc?.on?.('chat:agent:plan' as any, onPlan as any);
        const offTodos = ipc?.on?.('chat:agent:todos' as any, onTodos as any);
        const offTodoUpdate = ipc?.on?.('chat:agent:todo-update' as any, onTodoUpdate as any);
        const offToken = ipc?.on?.('chat:agent:token' as any, onToken as any);
        const offSynthesisStart = ipc?.on?.('chat:agent:synthesis-start' as any, onSynthesisStart as any);

        console.log('[chat] invoke chat:agent:run', { sessionId, courseId });
        await ipc?.invoke?.('chat:agent:run', { sessionId, prompt: enhancedText, courseId });
      } catch (e) {
        console.error('[chat] streaming failed', e);
        get().appendStream(sessionId, '[streaming failed]');
        get().endStream(sessionId);
      }
    },

    sendCompanionMessage: async (sessionId, text) => {
      if (!text?.trim()) return;
      await get().addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text,
        sender: 'companion',
      });
    },

    deleteMessage: async (sessionId, id) => {
      // Optimistic remove from store
      set(
        (s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] ?? []).filter(
              (m) => m.id !== id,
            ),
          },
        }),
        false,
        'chat:delete:optimistic',
      );
      try {
        await (window as any).electron?.ipcRenderer?.invoke?.('chat:delete', {
          id,
        });
      } catch (e) {
        // best-effort; not restoring on failure to keep UI responsive
      }
    },

    clearAllMessages: async (sessionId) => {
      // Optimistic clear from store
      set(
        (s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: [],
          },
        }),
        false,
        'chat:clear:optimistic',
      );
      try {
        await (window as any).electron?.ipcRenderer?.invoke?.('chat:clear', {
          chatId: sessionId,
        });
      } catch (e) {
        // best-effort; not restoring on failure to keep UI responsive
      }
    },

    // Streaming controls
    beginStream: (sessionId: string) => {
      const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      set(
        (s) => ({
          streamingBySession: {
            ...s.streamingBySession,
            [sessionId]: { id, text: '' },
          },
        }),
        false,
        'chat:stream:begin',
      );
      return id;
    },
    appendStream: (sessionId: string, chunk: string) => {
      if (!chunk) return;
      set(
        (s) => {
          const current = s.streamingBySession[sessionId];
          if (!current) return {} as any;
          return {
            streamingBySession: {
              ...s.streamingBySession,
              [sessionId]: { ...current, text: current.text + chunk },
            },
          } as any;
        },
        false,
        'chat:stream:append',
      );
    },

    appendStreamBatched: (sessionId: string, token: string) => {
      if (!token) return;

      const state = get();
      const currentBatch = state.tokenBatchBySession[sessionId];
      const now = Date.now();

      // Clear existing schedulers
      if (currentBatch?.timeoutId) {
        clearTimeout(currentBatch.timeoutId);
      }
      if (currentBatch?.rafId) {
        cancelAnimationFrame(currentBatch.rafId);
      }

      // Add token to batch
      const tokens = [...(currentBatch?.tokens || []), token];

      // Check if we should force flush (adaptive throttling)
      const lastFlush = currentBatch?.lastFlush || now;
      const timeSinceFlush = now - lastFlush;
      const shouldForceFlush = tokens.length > 50 || timeSinceFlush > 100; // Force flush if too many tokens or 100ms passed

      if (shouldForceFlush) {
        // Immediate flush for large batches or time threshold
        set(
          (s) => ({
            tokenBatchBySession: {
              ...s.tokenBatchBySession,
              [sessionId]: { tokens: [], lastFlush: now },
            },
          }),
          false,
          'chat:stream:force-flush',
        );
        // Append immediately
        get().appendStream(sessionId, tokens.join(''));
      } else {
        // Use requestAnimationFrame for smooth updates aligned with browser rendering
        const rafId = requestAnimationFrame(() => {
          const batch = get().tokenBatchBySession[sessionId];
          if (batch && batch.tokens.length > 0) {
            get().flushTokenBatch(sessionId);
          }
        });

        // Fallback timeout in case RAF doesn't fire (e.g., tab not visible)
        const timeoutId = setTimeout(() => {
          get().flushTokenBatch(sessionId);
        }, 50); // Increased to 50ms for better batching

        // Update batch state
        set(
          (s) => ({
            tokenBatchBySession: {
              ...s.tokenBatchBySession,
              [sessionId]: { tokens, timeoutId, rafId, lastFlush },
            },
          }),
          false,
          'chat:stream:batch',
        );
      }
    },

    flushTokenBatch: (sessionId: string) => {
      const state = get();
      const batch = state.tokenBatchBySession[sessionId];

      if (!batch || batch.tokens.length === 0) return;

      // Clear all schedulers
      if (batch.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
      if (batch.rafId) {
        cancelAnimationFrame(batch.rafId);
      }

      // Join all tokens and append to stream
      const combinedTokens = batch.tokens.join('');

      // Throttle the actual append to prevent too frequent updates
      if (combinedTokens) {
        get().appendStream(sessionId, combinedTokens);
      }

      // Clear the batch but keep lastFlush time
      const now = Date.now();
      set(
        (s) => ({
          tokenBatchBySession: {
            ...s.tokenBatchBySession,
            [sessionId]: { tokens: [], lastFlush: now },
          },
        }),
        false,
        'chat:stream:flush',
      );
    },
    endStream: (sessionId: string) => {
      const state = get();

      // Flush any remaining tokens first
      get().flushTokenBatch(sessionId);

      const current = state.streamingBySession[sessionId];
      if (!current) return;
      const finalText = current.text;

      set(
        (s) => ({
          streamingBySession: { ...s.streamingBySession, [sessionId]: undefined },
          tokenBatchBySession: { ...s.tokenBatchBySession, [sessionId]: undefined }, // Clean up batch state
        }),
        false,
        'chat:stream:end:clear',
      );

      // persist the streamed message
      void state.addMessage(sessionId, {
        id: current.id,
        text: finalText,
        sender: 'companion',
        type: 'normal',
      });
    },

    // Plan management methods
    setPlan: (sessionId: string, plan: AgentPlan) => {
      set(
        (s) => ({
          planBySession: {
            ...s.planBySession,
            [sessionId]: { ...plan, currentStep: 0 },
          },
        }),
        false,
        'chat:plan:set',
      );
    },

    updatePlanStep: (sessionId: string, stepIndex: number) => {
      set(
        (s) => {
          const currentPlan = s.planBySession[sessionId];
          if (!currentPlan) return {} as any;
          return {
            planBySession: {
              ...s.planBySession,
              [sessionId]: { ...currentPlan, currentStep: stepIndex },
            },
          } as any;
        },
        false,
        'chat:plan:updateStep',
      );
    },

    clearPlan: (sessionId: string) => {
      set(
        (s) => ({
          planBySession: {
            ...s.planBySession,
            [sessionId]: undefined,
          },
        }),
        false,
        'chat:plan:clear',
      );
    },

    // Todo management methods
    setTodos: (sessionId: string, todos: TodoItem[]) => {
      set(
        (s) => ({
          todosBySession: {
            ...s.todosBySession,
            [sessionId]: todos,
          },
        }),
        false,
        'chat:todos:set',
      );
    },

    updateTodo: (sessionId: string, todoId: string, updates: Partial<TodoItem>) => {
      set(
        (s) => {
          const currentTodos = s.todosBySession[sessionId];
          if (!currentTodos) return {} as any;
          return {
            todosBySession: {
              ...s.todosBySession,
              [sessionId]: currentTodos.map(todo =>
                todo.id === todoId ? { ...todo, ...updates } : todo
              ),
            },
          } as any;
        },
        false,
        'chat:todos:update',
      );
    },

    updateTodoByIndex: (sessionId: string, index: number, completed: boolean) => {
      set(
        (s) => {
          const currentTodos = s.todosBySession[sessionId];
          if (!currentTodos || index >= currentTodos.length) return {} as any;
          return {
            todosBySession: {
              ...s.todosBySession,
              [sessionId]: currentTodos.map((todo, i) =>
                i === index ? { ...todo, completed } : todo
              ),
            },
          } as any;
        },
        false,
        'chat:todos:updateByIndex',
      );
    },

    clearTodos: (sessionId: string) => {
      set(
        (s) => ({
          todosBySession: {
            ...s.todosBySession,
            [sessionId]: undefined,
          },
        }),
        false,
        'chat:todos:clear',
      );
    },

    setThinking: (sessionId: string, isThinking: boolean) => {
      // Only update if the value actually changes to avoid unnecessary re-renders
      const currentThinking = get().isThinkingBySession[sessionId];
      if (currentThinking === isThinking) return;

      set(
        (s) => ({
          isThinkingBySession: {
            ...s.isThinkingBySession,
            [sessionId]: isThinking,
          },
        }),
        false,
        'chat:thinking:set',
      );
    },

    abortSession: async (sessionId: string, reason?: string) => {
      try {
        console.log(`[Chat] Aborting session ${sessionId}${reason ? `: ${reason}` : ''}`);

        // Call IPC to abort the session
        const result = await (window as any).electron?.ipcRenderer?.invoke('chat:agent:abort', {
          sessionId,
          reason: reason || 'User cancelled'
        });

        if (result?.success) {
          console.log(`[Chat] Session ${sessionId} aborted successfully`);

          // Clear any pending token batch first
          const batch = get().tokenBatchBySession[sessionId];
          if (batch?.timeoutId) {
            clearTimeout(batch.timeoutId);
          }
          if (batch?.rafId) {
            cancelAnimationFrame(batch.rafId);
          }

          // Clear local state immediately
          set(
            (s) => ({
              streamingBySession: { ...s.streamingBySession, [sessionId]: undefined },
              isThinkingBySession: { ...s.isThinkingBySession, [sessionId]: false },
              planBySession: { ...s.planBySession, [sessionId]: undefined },
              todosBySession: { ...s.todosBySession, [sessionId]: undefined },
              tokenBatchBySession: { ...s.tokenBatchBySession, [sessionId]: undefined },
            }),
            false,
            'chat:abort:cleanup',
          );

          // Clear thinking messages
          get().clearThinkingMessages(sessionId);

          // End work tracking for aborted session
          try {
            const workStore = useWorkStore.getState();
            void workStore.endWorkForSession(sessionId);
          } catch (error) {
            console.error('[chat] Failed to end work tracking on abort:', error);
          }
        } else {
          console.error(`[Chat] Failed to abort session ${sessionId}:`, result?.error);
        }
      } catch (error) {
        console.error(`[Chat] Error aborting session ${sessionId}:`, error);
      }
    },
  }))
);




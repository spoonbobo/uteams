import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type ChatMessage = {
  id: string;
  chatId: string; // betting session id
  text: string;
  sender: 'user' | 'companion';
  createdAt: string; // ISO string
  isRead?: boolean;
  type?: 'normal' | 'thinking';
};

export type AgentPlan = {
  steps: string[];
  reasoning: string;
  requiresTools: boolean;
  selectedAgent: string | null;
  currentStep?: number; // Track which step is currently being executed
};

export type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  order: number;
};

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

  loadMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'chatId' | 'createdAt'>) => Promise<void>;
  sendUserMessage: (sessionId: string, text: string, courseId?: string) => Promise<void>;
  sendCompanionMessage: (sessionId: string, text: string) => Promise<void>;
  deleteMessage: (sessionId: string, id: string) => Promise<void>;
  clearAllMessages: (sessionId: string) => Promise<void>;
  // Streaming controls
  beginStream: (sessionId: string) => string; // returns stream message id
  appendStream: (sessionId: string, chunk: string) => void;
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
};

export const useChatStore = create<ChatState>()(
  devtools((set, get) => ({
    messagesBySession: {},
    isLoadingBySession: {},
    streamingBySession: {},
    planBySession: {},
    todosBySession: {},
    isThinkingBySession: {},

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

    sendUserMessage: async (sessionId, text, courseId?: string) => {
      if (!text?.trim()) return;
      
      // Set thinking state immediately when user sends message
      get().setThinking(sessionId, true);
      
      // If courseId is available, enhance the prompt to encourage memory agent usage
      let enhancedText = text;
      if (courseId) {
        // Add a subtle hint to the prompt that course context is available
        enhancedText = `${text}\n\n[Context: Course ${courseId} data is available in memory]`;
      }
      
      // Store the original user message (without the hint)
      await get().addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text, // Original text without enhancement
        sender: 'user',
      });
      
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
            // Clear thinking state when real content starts
            get().setThinking(sessionId, false);
          }
          get().appendStream(sessionId, chunk);
        };
        const onDone = (payload: { sessionId: string; final?: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] onDone', { sessionId });
          // Clear thinking state when done
          get().setThinking(sessionId, false);
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
          // Ensure we also clean up any thinking state on error
          get().setThinking(sessionId, false);
          get().clearThinkingMessages(sessionId);
          get().clearPlan(sessionId);
          get().clearTodos(sessionId);
          get().endStream(sessionId);
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
          // Stream tokens directly to the chat
          const current = get().streamingBySession[sessionId];
          if (!current) {
            // Start streaming if not already started
            const streamId = get().beginStream(sessionId);
            console.log('[chat] beginStream for tokens', { sessionId, streamId });
            get().setThinking(sessionId, false);
            get().clearThinkingMessages(sessionId);
          }
          get().appendStream(sessionId, payload.token);
        };
        const onSynthesisStart = (payload: { sessionId: string; progress: number }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log('[chat] synthesis starting, preparing for token stream', { sessionId });
          // Clear thinking state when synthesis starts
          get().setThinking(sessionId, false);
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
    endStream: (sessionId: string) => {
      const state = get();
      const current = state.streamingBySession[sessionId];
      if (!current) return;
      const finalText = current.text;
      set(
        (s) => ({
          streamingBySession: { ...s.streamingBySession, [sessionId]: undefined },
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
  }))
);




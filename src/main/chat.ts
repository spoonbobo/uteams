import { ipcMain } from 'electron';
import { executeQuery } from './db';
import { orchestrator } from './ai';
import { UserProfile } from './ai/memory';

export const registerChatIpc = () => {
  // Abort IPC handler
  ipcMain.handle('chat:agent:abort', async (_event, { sessionId, reason }) => {
    try {
      console.log(`[Chat] Aborting session ${sessionId}: ${reason || 'User requested'}`);
      const aborted = orchestrator.abort(sessionId, reason);

      if (aborted) {
        // Send abort event to renderer
        _event.sender.send('chat:agent:aborted', {
          sessionId,
          reason: reason || 'User requested abort',
        });
      }

      return { success: aborted };
    } catch (error) {
      console.error(`[Chat] Error aborting session ${sessionId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Chat IPC handlers
  ipcMain.handle('chat:list', async (_event, { chatId }) => {
    try {
      const rows = executeQuery<any>(
        'select id, created_at, chat_id, sender, text, is_read from messages where chat_id = ? order by created_at asc',
        [chatId],
      ) as any[];
      return rows;
    } catch (e) {
      console.error('chat:list failed', e);
      return [];
    }
  });

  ipcMain.handle(
    'chat:add',
    async (
      _event,
      {
        id,
        chatId,
        text,
        sender,
        createdAt,
      }: { id: string; chatId: string; text: string; sender: string; createdAt: string },
    ) => {
      try {
        executeQuery(
          'insert into messages (id, chat_id, sender, text, created_at, is_read) values (?, ?, ?, ?, ?, ?)',
          [id, chatId, sender, text, createdAt, 1],
        );
        return { success: true };
      } catch (e) {
        console.error('chat:add failed', e);
        return { success: false };
      }
    },
  );

  ipcMain.handle('chat:delete', async (_event, { id }) => {
    try {
      executeQuery('delete from messages where id = ?', [id]);
      return { success: true };
    } catch (e) {
      console.error('chat:delete failed', e);
      return { success: false };
    }
  });

  ipcMain.handle('chat:clear', async (_event, { chatId }) => {
    try {
      executeQuery('delete from messages where chat_id = ?', [chatId]);
      console.log(`Cleared all messages for chat session: ${chatId}`);
      return { success: true };
    } catch (e) {
      console.error('chat:clear failed', e);
      return { success: false };
    }
  });

  // Chat agent streaming: run minimal general agent and forward streaming chunks to renderer
  ipcMain.handle(
    'chat:agent:run',
    async (event, {
      sessionId,
      prompt,
      userId,
      threadId,
      useMemory = true,
      courseId
    }: {
      sessionId: string;
      prompt?: string;
      userId?: string;
      threadId?: string;
      useMemory?: boolean;
      courseId?: string;
    }) => {
      try {
        console.log('🗣️ chat:agent:run received', { sessionId, courseId, promptPreview: String(prompt ?? '').slice(0, 60) });
        const onProgress = (payload: any) => {
          try {
            if (payload.sessionId === sessionId) {
              const chunk: string | undefined = payload?.update;

              // Debug: Check if event sender is valid
              if (!event?.sender) {
                console.warn(`⚠️ No event sender for session ${sessionId}!`);
                return;
              }

              // Log progress updates
              // if (payload.node || payload.type === 'message' || payload.type === 'complete' || payload.progress === 0) {
              //   console.log('📢 Agent progress:', {
              //     sessionId,
              //     node: payload.node,
              //     step: payload.step,
              //     totalSteps: payload.totalSteps,
              //     progress: payload.progress,
              //     type: payload.type,
              //     chunkPreview: chunk ? String(chunk).slice(0, 60) : undefined
              //   });
              // }

               // Handle different message types
               if (payload.type === 'plan') {
                 // Send plan information to renderer
                 console.log(`📋 Sending plan to UI for session ${sessionId}`);
                 if (!event?.sender?.send) {
                   console.error(`❌ Cannot send plan - event.sender.send not available!`);
                   return;
                 }

                 try {
                   event.sender.send('chat:agent:plan', {
                     sessionId,
                     plan: payload.plan,
                     progress: payload.progress,
                     step: payload.step,
                     totalSteps: payload.totalSteps,
                   });
                   console.log(`✅ Plan event sent successfully`);
                 } catch (error) {
                   console.error(`❌ Error sending plan event:`, error);
                 }
               } else if (payload.type === 'todos') {
                 // Send todos to renderer
                 console.log(`📋 Sending todos to UI for session ${sessionId}:`, payload.todos?.length || 0, 'items');
                 console.log(`📋 Todos content:`, payload.todos);
                 const todoEvent = {
                   sessionId,
                   todos: payload.todos,
                   progress: payload.progress,
                   step: payload.step,
                   totalSteps: payload.totalSteps,
                 };
                 console.log(`📋 Sending todo event:`, todoEvent);

                 // Check if sender is valid
                 if (!event?.sender?.send) {
                   console.error(`❌ Cannot send todos - event.sender.send not available!`);
                   return;
                 }

                 try {
                   event.sender.send('chat:agent:todos', todoEvent);
                   console.log(`✅ Todos event sent successfully`);
                 } catch (error) {
                   console.error(`❌ Error sending todos event:`, error);
                 }
              } else if (payload.type === 'todo-update') {
                // Send todo update to renderer
                console.log(`✅ Updating todo ${payload.todoIndex} for session ${sessionId}`);

                if (!event?.sender?.send) {
                  console.error(`❌ Cannot send todo-update - event.sender.send not available!`);
                  return;
                }

                try {
                  event.sender.send('chat:agent:todo-update', {
                    sessionId,
                    todoIndex: payload.todoIndex,
                    completed: payload.completed,
                    progress: payload.progress,
                    step: payload.step,
                    totalSteps: payload.totalSteps,
                  });
                  console.log(`✅ Todo-update event sent successfully for todo ${payload.todoIndex}`);
                } catch (error) {
                  console.error(`❌ Error sending todo-update event:`, error);
                }
              } else if (payload.type === 'token') {
                // Stream individual tokens from synthesis
                event?.sender?.send?.('chat:agent:token', {
                  sessionId,
                  token: payload.token,
                  node: payload.node,
                });
              } else if (payload.type === 'synthesis-start') {
                // Signal that synthesis streaming is starting
                event?.sender?.send?.('chat:agent:synthesis-start', {
                  sessionId,
                  progress: payload.progress,
                });
              } else if (chunk && payload.type !== 'complete' && payload.type !== 'status') {
                 // Only send actual content chunks, not status messages
                 // This should never happen now since we removed all update fields
                 console.warn('[chat] Unexpected chunk received:', { sessionId, chunk: chunk.substring(0, 50) });
                 // Don't send the chunk to avoid showing technical messages
               } else if (payload.type === 'complete') {
                // Send completion signal without chunk
                event?.sender?.send?.('chat:agent:progress', {
                  sessionId,
                  progress: 100,
                  type: 'complete'
                });
              } else if (payload.type === 'aborted') {
                // Handle abort event
                console.log(`[Chat] Session ${sessionId} aborted: ${payload.reason}`);
                event?.sender?.send?.('chat:agent:aborted', {
                  sessionId,
                  reason: payload.reason,
                });
              }
            }
          } catch {}
        };
        orchestrator.on('progress', onProgress);

        try {
          // Load course memory if courseId is provided
          let courseMemory = null;
          if (courseId) {
            console.log(`[Chat] Loading course memory for agent context (courseId: ${courseId})...`);
            const memoryManager = orchestrator.getMemoryManager();
            courseMemory = await memoryManager.getCourseMemory(courseId);
            if (courseMemory) {
              console.log(`[Chat] 📚 Successfully loaded course memory for ${courseMemory.courseShortName}`);
              console.log(`[Chat] Course context includes:`, {
                assignments: courseMemory.assignments?.length || 0,
                students: courseMemory.students?.length || 0,
                activities: courseMemory.activities?.length || 0,
                hasKeyTopics: !!courseMemory.keyTopics?.length
              });
            } else {
              console.log(`[Chat] ⚠️ No course memory found for courseId: ${courseId}`);
            }
          } else {
            console.log(`[Chat] No courseId provided, agent will run without course context`);
          }

          const res = await orchestrator.run({
            sessionId,
            prompt,
            userId,
            threadId,
            useMemory,
            metadata: {
              courseId,
              courseMemory,  // Pass the raw course memory object
              hasCourseContext: !!courseMemory
            }
          });
          // Don't send final text since we're streaming tokens
          console.log('✅ chat:agent:done', { sessionId, resultSummary: res?.resultSummary });
          event?.sender?.send?.('chat:agent:done', {
            sessionId,
            resultSummary: res?.resultSummary
          });
          return { success: true, resultSummary: res?.resultSummary };
        } finally {
          orchestrator.removeListener('progress', onProgress);
          console.log('🔚 Removed progress listener for session', sessionId);
        }
      } catch (e) {
        console.error('❌ chat:agent:error', e);
        event?.sender?.send?.('chat:agent:error', {
          sessionId,
          error: (e as Error)?.message ?? 'unknown error',
        });
        return { success: false };
      }
    },
  );

  // Memory management IPC handlers
  ipcMain.handle('chat:memory:getUserProfile', async (_event, { userId }: { userId: string }) => {
    try {
      const memoryManager = orchestrator.getMemoryManager();
      const profile = await memoryManager.getUserProfile(userId);
      return { success: true, profile };
    } catch (e) {
      console.error('chat:memory:getUserProfile failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:saveUserProfile', async (_event, { profile }: { profile: UserProfile }) => {
    try {
      await orchestrator.updateUserProfile(profile);
      return { success: true };
    } catch (e) {
      console.error('chat:memory:saveUserProfile failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:getRecentSessions', async (_event, { userId, limit = 5 }: { userId: string; limit?: number }) => {
    try {
      const sessions = await orchestrator.getUserSessions(userId, limit);
      return { success: true, sessions };
    } catch (e) {
      console.error('chat:memory:getRecentSessions failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:searchMemories', async (_event, { query, userId }: { query: string; userId?: string }) => {
    try {
      const results = await orchestrator.searchMemories(query, userId);
      return { success: true, results };
    } catch (e) {
      console.error('chat:memory:searchMemories failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:clearOldSessions', async (_event, { daysToKeep = 30 }: { daysToKeep?: number }) => {
    try {
      const memoryManager = orchestrator.getMemoryManager();
      const cleared = await memoryManager.clearOldSessions(daysToKeep);
      return { success: true, cleared };
    } catch (e) {
      console.error('chat:memory:clearOldSessions failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:getStats', async () => {
    try {
      const memoryManager = orchestrator.getMemoryManager();
      const stats = memoryManager.getStats();
      return { success: true, stats };
    } catch (e) {
      console.error('chat:memory:getStats failed', e);
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('chat:memory:setEnabled', async (_event, { enabled }: { enabled: boolean }) => {
    try {
      orchestrator.setMemoryEnabled(enabled);
      return { success: true };
    } catch (e) {
      console.error('chat:memory:setEnabled failed', e);
      return { success: false, error: (e as Error).message };
    }
  });
};

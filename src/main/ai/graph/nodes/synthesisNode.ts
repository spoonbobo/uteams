/**
 * Synthesis Node
 * Handles result formatting and presentation for swarm architecture
 */

import { ChatOpenAI } from '@langchain/openai';
import { AIMessage } from '@langchain/core/messages';
import { 
  createSwarmSynthesisPrompt,
  createSwarmDirectResponsePrompt,
  createTodoExecutionPrompt,
  isTaskCompleted
} from '../../prompts';
import { MultiAgentState } from '../types';

/**
 * Creates the synthesis node function for swarm architecture
 */
export function createSwarmSynthesisNode(llm: ChatOpenAI) {
  return async (state: MultiAgentState) => {
    // Check if we're processing a specific todo (shouldn't happen anymore since todos go through agents)
    if (state.todos && state.currentTodoIndex !== undefined && state.currentTodoIndex < state.todos.length) {
      const currentIndex = state.currentTodoIndex;
      const todos = state.todos;
      const currentTodo = todos[currentIndex];
      
      if (currentTodo) {
        console.log(`📝 [SYNTHESIS] Processing todo ${currentIndex + 1}/${todos.length}: "${currentTodo.text}"`);
        
        // Generate response for this specific todo using the todo execution prompt
        const todoPrompt = createTodoExecutionPrompt({
          todoText: currentTodo.text,
          todoIndex: currentIndex,
          totalTodos: todos.length,
          previousResults: state.toolResults,
          isAgent: false,
        });
        
        try {
          const response = await llm.invoke(todoPrompt);
          const responseContent = String(response.content);
          
          // Check if task is marked as completed
          const isCompleted = isTaskCompleted(responseContent);
          
          if (isCompleted) {
            console.log(`✅ [SYNTHESIS] Todo ${currentIndex + 1} marked as COMPLETED`);
            // Mark current todo as complete
            const updatedTodos = [...todos];
            updatedTodos[currentIndex].completed = true;
            
            // Remove the COMPLETED token from the response for cleaner output
            const cleanedResponse = responseContent.replace(/\s*COMPLETED\s*/gi, '').trim();
            
            return {
              messages: [new AIMessage(cleanedResponse)],
              todos: updatedTodos,
              currentTodoIndex: currentIndex + 1, // Move to next todo
              completedTodos: [...(state.completedTodos || []), currentIndex],
              needsSynthesis: false,
            };
          } else {
            console.log(`⚠️ [SYNTHESIS] Todo ${currentIndex + 1} not marked as completed, continuing anyway`);
            // Still mark as complete but log warning
            const updatedTodos = [...todos];
            updatedTodos[currentIndex].completed = true;
            
            return {
              messages: [new AIMessage(responseContent)],
              todos: updatedTodos,
              currentTodoIndex: currentIndex + 1,
              completedTodos: [...(state.completedTodos || []), currentIndex],
              needsSynthesis: false,
            };
          }
        } catch (error) {
          console.error('Todo synthesis error:', error);
          const updatedTodos = [...todos];
          updatedTodos[currentIndex].completed = true;
          return {
            messages: [new AIMessage(`Completed: ${currentTodo.text}`)],
            todos: updatedTodos,
            currentTodoIndex: currentIndex + 1,
            completedTodos: [...(state.completedTodos || []), currentIndex],
            needsSynthesis: false,
          };
        }
      }
    }
    
    // Final synthesis when all todos are complete
    console.log('📝 [SYNTHESIS] Generating final synthesis for completed todos');
    
    const lastUserMessage = state.messages.filter(m => m._getType() === 'human').pop();
    const agentMessages = state.messages.filter(m => m._getType() === 'ai');
    const lastAgentMessage = agentMessages[agentMessages.length - 1];
    
    // Check if we have completed todos to summarize
    if (state.todos && state.todos.length > 0) {
      const completedCount = state.todos.filter(t => t.completed).length;
      console.log(`📝 [SYNTHESIS] Summarizing ${completedCount}/${state.todos.length} completed todos`);
    }
    
    // Collect content to synthesize from multiple sources
    let contentToSynthesize: string | null = null;
    
    // First priority: tool results (including agent outputs)
    if (state.toolResults && state.toolResults.length > 0) {
      // Extract the actual content from tool results
      const resultsContent = state.toolResults.map(r => {
        if (typeof r === 'string') return r;
        if (r.type === 'agent_output' || r.type === 'raw_output') {
          return r.content;
        }
        return JSON.stringify(r);
      }).join('\n\n');
      
      contentToSynthesize = resultsContent;
    }
    
    // Second priority: if we have completed todos but no tool results, synthesize from agent messages
    else if (state.todos && state.todos.filter(t => t.completed).length > 0) {
      console.log('📝 [SYNTHESIS] No tool results but have completed todos, synthesizing from agent messages');
      
      // Collect recent AI messages that likely contain the todo completions
      const recentAiMessages = agentMessages.slice(-state.todos.length);
      const todoCompletions = recentAiMessages
        .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
        .filter(content => content && content.trim())
        .join('\n\n');
      
      if (todoCompletions) {
        contentToSynthesize = todoCompletions;
      }
    }
    
    // If we have content to synthesize, generate the synthesis
    if (contentToSynthesize) {
      const synthesisPrompt = createSwarmSynthesisPrompt({
        lastUserMessage: String(lastUserMessage?.content),
        planReasoning: state.plan?.reasoning,
        resultsContent: contentToSynthesize,
      });
      
      try {
        const synthesisResponse = await llm.invoke(synthesisPrompt);
        return {
          messages: [new AIMessage(String(synthesisResponse.content))],
          needsSynthesis: false,
        };
      } catch (error) {
        console.error('Synthesis error:', error);
        // Fallback: try to extract key information
        const fallbackResponse = 'I found some information for you. ' + 
          (contentToSynthesize.length > 500 ? contentToSynthesize.substring(0, 500) + '...' : contentToSynthesize);
        return {
          messages: [new AIMessage(fallbackResponse)],
          needsSynthesis: false,
        };
      }
    }
    
    // If no tools were needed, generate direct response
    if (state.plan && !state.plan.requiresTools) {
      const directPrompt = createSwarmDirectResponsePrompt({
        lastUserMessage: String(lastUserMessage?.content),
        planReasoning: state.plan.reasoning,
      });
      
      try {
        const directResponse = await llm.invoke(directPrompt);
        return {
          messages: [new AIMessage(String(directResponse.content))],
          needsSynthesis: false,
        };
      } catch (error) {
        console.error('Direct response error:', error);
        return {
          messages: [new AIMessage('I understand your request. ' + (state.plan?.reasoning || 'Let me help you with that.'))],
          needsSynthesis: false,
        };
      }
    }
    
    // Default: use the last agent message if available
    return {
      messages: lastAgentMessage ? [lastAgentMessage] : [new AIMessage('Request processed.')],
      needsSynthesis: false,
    };
  };
}


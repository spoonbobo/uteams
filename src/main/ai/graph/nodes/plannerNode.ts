/**
 * Planner Node
 * Handles task analysis and agent selection for swarm architecture
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentRegistry } from '../../agents';
import { createPlanningPrompt } from '../../prompts';
import { MultiAgentState, MultiAgentConfig } from '../types';

/**
 * Creates the planner node function
 */
export function createPlannerNode(
  registry: AgentRegistry,
  config: MultiAgentConfig,
  llm: ChatOpenAI,
  selectBestAgent: (query: string) => string
) {
  return async (state: MultiAgentState) => {
    // Check if we're continuing todo execution
    if (state.todos && state.currentTodoIndex !== undefined) {
      const currentIndex = state.currentTodoIndex;
      const todos = state.todos;
      
      // Check if all todos are complete
      if (currentIndex >= todos.length) {
        console.log('🎯 [PLANNER] All todos complete, routing to final synthesis');
        return {
          needsSynthesis: true,
          activeAgent: 'synthesis' as any,
        };
      }
      
      // Get current todo
      const currentTodo = todos[currentIndex];
      console.log(`🎯 [PLANNER] Processing todo ${currentIndex + 1}/${todos.length}: "${currentTodo.text}"`);
      
      // Determine which agent should handle this todo
      const todoText = currentTodo.text.toLowerCase();
      let selectedAgent = null;
      
      // Check if this todo needs a specialized agent
      if (todoText.includes('search') || todoText.includes('find') || 
          todoText.includes('look up') || todoText.includes('gather')) {
        selectedAgent = 'tavily_agent';
      } else if (todoText.includes('scrape') || todoText.includes('extract') || 
                 todoText.includes('navigate')) {
        selectedAgent = 'playwright_agent';
      } else if (todoText.includes('remember') || todoText.includes('recall') || 
                 todoText.includes('memory')) {
        selectedAgent = 'memory_agent';
      } else {
        // Default to general agent for synthesis/formatting tasks
        selectedAgent = 'general_agent';
      }
      
      // Always route to an agent (no direct synthesis)
      console.log(`🎯 [PLANNER] Todo will be handled by: ${selectedAgent}`);
      return {
        activeAgent: selectedAgent,
        currentTodoIndex: currentIndex,
      };
    }
    
    // Initial planning for new request
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) {
      return { activeAgent: config.defaultAgent || config.agents[0] };
    }
    
    const userQuery = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : JSON.stringify(lastMessage.content);
    
    // Create planning prompt
    const planningPrompt = createPlanningPrompt({
      userQuery,
      agentDescriptions: config.agents.map(name => {
        const agent = registry.getAgent(name);
        return agent ? `- ${name}: ${agent.getDescription()}` : '';
      }).filter(Boolean).join('\n'),
      userProfile: state.userProfile,
    });
    
    try {
      console.log('🎯 [PLANNER] Invoking LLM with prompt...');
      const planResponse = await llm.invoke(planningPrompt);
      const planContent = String(planResponse.content);
      
      console.log('🎯 [PLANNER] Raw LLM response:', planContent.substring(0, 500));
      
      // Parse the plan
      const reasoningMatch = planContent.match(/REASONING:\s*(.+?)(?=\nREQUIRES_TOOLS:|$)/s);
      const requiresToolsMatch = planContent.match(/REQUIRES_TOOLS:\s*(yes|no)/i);
      const selectedAgentMatch = planContent.match(/SELECTED_AGENT:\s*(\w+(?:_agent)?|none)/i);
      const stepsMatch = planContent.match(/STEPS:\s*([\s\S]+?)(?=$)/s);
      
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Analyzing request...';
      const requiresTools = requiresToolsMatch ? requiresToolsMatch[1].toLowerCase() === 'yes' : false;
      const selectedAgent = selectedAgentMatch && selectedAgentMatch[1].toLowerCase() !== 'none' 
        ? selectedAgentMatch[1].replace('_agent', '') + '_agent'
        : 'general_agent'; // Default to general_agent instead of null
      const steps = stepsMatch 
        ? stepsMatch[1].split('\n').filter(s => s.trim().startsWith('-')).map(s => s.replace(/^-\s*/, '').trim())
        : ['Process user request'];
      
      const plan = {
        reasoning,
        requiresTools,
        selectedAgent,
        steps,
      };
      
      // Create todos from plan steps
      const todos = steps.map((step, index) => ({
        id: `todo_${state.sessionId}_${index}`,
        text: step,
        completed: false,
        order: index,
      }));
      
      // Log the plan creation
      console.log('🎯 [PLANNER] Created plan with todos:', {
        reasoning: plan.reasoning,
        requiresTools: plan.requiresTools,
        selectedAgent: plan.selectedAgent,
        todosCount: todos.length,
        todos: todos.map(t => t.text),
      });
      
      // Start processing first todo
      return {
        plan,
        todos,
        currentTodoIndex: 0,
        completedTodos: [],
        // Re-run planner to process first todo
        activeAgent: 'planner' as any,
      };
    } catch (error) {
      console.error('Planning error:', error);
      // Fallback to default agent selection
      return {
        activeAgent: selectBestAgent(userQuery),
      };
    }
  };
}


/**
 * Swarm Graph Builder
 * Builds swarm-based multi-agent graphs
 */

import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { AgentRegistry } from '../../agents';
import { MultiAgentState, MultiAgentConfig } from '../types';
import { createGraphChannels } from '../stateManager';
import { 
  createPlannerNode,
  createSwarmSynthesisNode
} from '../nodes';
import { addSwarmEdges } from '../edges';
import { AIMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { createTodoExecutionPrompt, isTaskCompleted } from '../../prompts';

/**
 * Creates a swarm agent node that can execute and hand off to other agents
 */
function createSwarmAgentNode(registry: AgentRegistry, agentName: string) {
  return async (state: MultiAgentState) => {
    const agent = registry.getAgent(agentName);
    if (!agent) {
      console.error(`Agent ${agentName} not found in registry`);
      return {
        messages: [new AIMessage(`Agent ${agentName} not available`)],
        toolResults: [{
          type: 'error',
          content: `Agent ${agentName} not found`,
        }],
      };
    }

    try {
      // If we're processing a todo, add context to the agent
      let agentMessages = state.messages;
      if (state.todos && state.currentTodoIndex !== undefined) {
        const currentIndex = state.currentTodoIndex;
        const currentTodo = state.todos[currentIndex];
        if (currentTodo) {
          // Add todo context to messages
          const todoContext = createTodoExecutionPrompt({
            todoText: currentTodo.text,
            todoIndex: currentIndex,
            totalTodos: state.todos.length,
            previousResults: state.toolResults,
            isAgent: true,
          });
          agentMessages = [...state.messages, new AIMessage(todoContext)];
        }
      }
      
      // Execute the agent with current state
      const result = await agent.execute({
        messages: agentMessages,
        sessionId: state.sessionId,
        metadata: state.metadata,
      });

      // Handle agent handoffs using Command
      if (result.command) {
        console.log(`🔄 Agent ${agentName} requesting handoff to ${result.command.goto}`);
        return result.command;
      }

      // Collect tool results if available
      const toolResults = state.toolResults || [];
      if (result.toolResults) {
        toolResults.push(...result.toolResults);
      }
      
      // Also add agent's message output as a tool result for synthesis
      // This ensures synthesis node always has content to work with
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string' && lastMessage.content.trim()) {
          toolResults.push({
            type: 'agent_output',
            agent: agentName,
            content: lastMessage.content,
          });
        }
      }

      // Check if agent marked task as completed
      let taskCompleted = false;
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string') {
          taskCompleted = isTaskCompleted(lastMessage.content);
        }
      }

      // Mark current todo as complete if agent signals completion
      const updatedTodos = state.todos ? [...state.todos] : [];
      const currentIndex = state.currentTodoIndex ?? 0;
      let completedIndices = state.completedTodos || [];
      
      if (updatedTodos[currentIndex] && taskCompleted) {
        updatedTodos[currentIndex].completed = true;
        completedIndices = [...completedIndices, currentIndex];
        console.log(`✅ Agent ${agentName} marked todo ${currentIndex} as COMPLETED (1-based: ${currentIndex + 1})`);
        console.log(`✅ Updated todo: "${updatedTodos[currentIndex].text.substring(0, 50)}..."`);
      }
      
      return {
        messages: result.messages || [],
        toolResults,
        todos: updatedTodos,
        currentTodoIndex: taskCompleted ? currentIndex + 1 : currentIndex, // Only move if completed
        completedTodos: completedIndices,
        metadata: {
          ...state.metadata,
          ...result.metadata,
        },
      };
    } catch (error) {
      console.error(`Error executing agent ${agentName}:`, error);
      return {
        messages: [new AIMessage(`Error executing ${agentName}: ${(error as Error).message}`)],
        toolResults: [{
          type: 'error',
          content: `Agent execution failed: ${(error as Error).message}`,
        }],
        needsSynthesis: true,
      };
    }
  };
}

/**
 * Builds swarm-based multi-agent graph
 * Agents can hand off control to each other dynamically
 */
export function buildSwarmGraph(
  registry: AgentRegistry,
  config: MultiAgentConfig,
  llm: ChatOpenAI,
  selectBestAgent: (query: string) => string
): StateGraph<MultiAgentState> {
  const graph = new StateGraph<MultiAgentState>({
    channels: createGraphChannels(),
  } as any);
  
  // Add planning node
  const plannerNode = createPlannerNode(registry, config, llm, selectBestAgent);
  (graph as any).addNode('planner', plannerNode);
  
  // Add synthesis node for final response after todos complete
  const synthesisNode = createSwarmSynthesisNode(llm);
  (graph as any).addNode('synthesis', synthesisNode);

  // Add agent nodes with handoff capabilities
  for (const agentName of config.agents) {
    const agentNode = createSwarmAgentNode(registry, agentName);
    (graph as any).addNode(agentName, agentNode);
  }

  // Add edges
  addSwarmEdges(graph, config);

  return graph;
}


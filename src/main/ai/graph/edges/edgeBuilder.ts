/**
 * Edge Builder
 * Handles edge configuration for swarm architecture
 */

import { START, END } from '@langchain/langgraph';
import { MultiAgentState, MultiAgentConfig } from '../types';

/**
 * Adds edges for swarm architecture
 */
export function addSwarmEdges(
  graph: any,
  config: MultiAgentConfig
) {
  // Start with planner
  graph.addEdge(START, 'planner');
  
  // Planner routes to agents, synthesis, or loops back to itself
  graph.addConditionalEdges(
    'planner',
    (state: MultiAgentState) => {
      // Planner can route to itself when first creating todos
      if (state.activeAgent === 'planner') {
        return 'planner';
      }
      // Route to synthesis if explicitly requested (when all todos done)
      if (state.needsSynthesis) {
        return 'synthesis';
      }
      // Route to agent for todo processing
      return state.activeAgent || config.agents[0];
    },
    Object.fromEntries([
      ['planner', 'planner'],
      ...config.agents.map(a => [a, a]),
      ['synthesis', 'synthesis'],
    ])
  );
  
  // Each agent routes back to planner
  for (const agentName of config.agents) {
    graph.addConditionalEdges(
      agentName,
      (state: MultiAgentState) => {
        // Always go back to planner for next todo or final synthesis
        return 'planner';
      },
      {
        planner: 'planner',
      }
    );
  }
  
  // Synthesis node ends the flow
  graph.addEdge('synthesis', END);
}


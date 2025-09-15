# AI Agents Architecture

## Overview

This document describes the multi-agent architecture implemented for the LangGraph-based AI system. The architecture follows the patterns described in [LangGraph's multi-agent documentation](https://langchain-ai.github.io/langgraphjs/agents/multi-agent/).

## Architecture Components

### 1. Base Agent System (`types/agent.ts`)

- **BaseAgent**: Abstract base class for all agents
- **AgentCapabilities**: Defines what each agent can do
- **AgentConfig**: Configuration for agent initialization
- **AgentState/AgentResult**: State management and execution results
- **HandoffInfo**: Information for agent-to-agent handoffs

### 2. Specialized Agents (`agents/`)

#### TavilyAgent (`tavilyAgent.ts`)
- **Purpose**: Web search and information retrieval
- **Capabilities**: 
  - Web search using Tavily MCP
  - News and current information retrieval
  - Source citation and fact-checking
- **Handoff Targets**: PlaywrightAgent (for scraping)

#### PlaywrightAgent (`playwrightAgent.ts`)
- **Purpose**: Web scraping and browser automation
- **Capabilities**:
  - Navigate to websites
  - Extract structured data
  - Interact with web pages (click, fill forms)
  - Take screenshots
- **Handoff Targets**: TavilyAgent (for search)

#### MemoryAgent (`memoryAgent.ts`)
- **Purpose**: Memory and preference management
- **Capabilities**:
  - Store and retrieve user information
  - Manage user preferences and settings
  - Search conversation history
  - Remember specific facts and notes
  - Provide personalized context
- **Handoff Targets**: TavilyAgent (for web search), PlaywrightAgent (for scraping)

### 3. Agent Registry (`agents/index.ts`)

- **Singleton Pattern**: Manages all agent instances
- **Agent Discovery**: Automatically finds and registers agents based on available MCP tools
- **Best Agent Selection**: Scores agents based on request keywords and capabilities
- **Factory Methods**: Creates agents with appropriate MCP tools

### 4. Multi-Agent Graph System (`graph/`)

The graph system has been decomposed into a modular architecture:

#### Core Components

- **Main Builder** (`graph/multiAgentGraphBuilder.ts`): Orchestrates graph creation
- **Types** (`graph/types.ts`): Core interfaces and state definitions
- **State Manager** (`graph/stateManager.ts`): Graph channel configuration and reducers

#### Node Builders (`graph/nodes/`)
- **Planner Node** (`plannerNode.ts`): Task analysis and agent selection for swarm architecture
- **Synthesis Node** (`synthesisNode.ts`): Result formatting and presentation

#### Edge Configuration (`graph/edges/`)
- **Edge Builder** (`edgeBuilder.ts`): Routing logic between nodes

#### Graph Builders (`graph/builders/`)
- **Swarm Graph Builder** (`swarmGraphBuilder.ts`): Builds swarm-based graphs with dynamic agent handoffs

#### Architecture

**Swarm Architecture** (Current Implementation)
- Agents dynamically hand off control to each other
- No central coordinator - agents collaborate peer-to-peer
- Agents decide when to hand off based on their capabilities and task requirements
- Built using `buildSwarmGraph()`
- Flow: `planner` → `{selected_agent}` → `synthesis`

### 5. Memory System (`memory.ts`)

- **Short-term Memory**: Thread-level conversation continuity
- **Long-term Memory**: Cross-thread user profiles and preferences
- **Persistence**: File-based storage for durability
- **Integration**: Seamlessly integrated with Orchestrator
- **Memory Tools**: Specialized tools for memory operations

### 6. Integration with Unified Agent

The Orchestrator (`orchestrator.ts`) integrates all agents including MemoryAgent:
- Automatic memory context loading
- User preference application
- Thread-based conversation continuity
- Dynamic agent selection with memory awareness

## Agent Handoff Pattern

Agents can hand off control to other agents using the Command primitive:

```typescript
return new Command({
  goto: 'target_agent',
  update: {
    messages: [...],
    metadata: {...}
  },
  graph: Command.PARENT
});
```

This allows for:
- Dynamic routing based on task requirements
- Specialized handling by domain experts
- Seamless context passing between agents

## MCP Tools Integration

Each agent receives only the MCP tools relevant to its capabilities:
- **TavilyAgent**: Receives Tavily search tools
- **PlaywrightAgent**: Receives browser automation tools (Playwright MCP)
- **MemoryAgent**: Uses memory-specific tools (not MCP tools, but custom memory tools)

## Usage Examples

### Using Individual Agents
```typescript
// Initialize agent registry
const registry = AgentRegistry.getInstance();
await registry.initialize(mcpClient, llm);

// Find best agent for a request
const agent = registry.findBestAgent("search for latest news about...");

// Execute agent
const result = await agent.execute({
  messages: [new HumanMessage("search for latest news...")],
  sessionId: "session123"
});

// Handle handoffs if needed
if (result.command) {
  // Agent wants to hand off to another agent
  const targetAgent = result.command.goto;
  // Route to target agent...
}
```

### Using the Multi-Agent Graph System
```typescript
import { MultiAgentGraphBuilder } from './graph';

// Create a swarm configuration
const config = MultiAgentGraphBuilder.createSwarmConfig([
  'tavily_agent',
  'playwright_agent', 
  'memory_agent'
]);

// Build the graph
const builder = new MultiAgentGraphBuilder(registry, config);
const graph = builder.buildGraph();

// Compile and run
const compiledGraph = graph.compile();
const result = await compiledGraph.invoke({
  messages: [new HumanMessage("search for latest AI news")],
  sessionId: "session123"
});
```

### Using Modular Components
```typescript
import { 
  buildSwarmGraph, 
  createPlannerNode, 
  createSwarmSynthesisNode 
} from './graph';

// Use individual components for custom graphs
const customGraph = buildSwarmGraph(registry, config, llm, selectBestAgent);
```

## Benefits

### Agent System Benefits
1. **Modularity**: Each agent is self-contained and focused on specific capabilities
2. **Extensibility**: Easy to add new agents by extending BaseAgent
3. **Flexibility**: Supports both supervisor and swarm architectures
4. **Reusability**: Agents can be used across different graphs
5. **Dynamic Routing**: Agents can hand off to specialists when needed
6. **Tool Isolation**: Each agent only gets the tools it needs

### Graph System Benefits
1. **Modular Architecture**: Components are separated by responsibility
2. **Maintainability**: Easy to modify individual nodes, edges, or builders
3. **Testability**: Each component can be tested in isolation
4. **Composability**: Mix and match components for custom graphs
5. **Type Safety**: Strong TypeScript interfaces throughout
6. **Clean Separation**: Clear boundaries between state, nodes, and edges
7. **Backward Compatibility**: Legacy imports still work during migration

## Migration Guide

### Simplified Architecture

**Current System:**
```typescript
import { MultiAgentGraphBuilder } from './graph';
// Or import specific components:
import { buildSwarmGraph, createPlannerNode } from './graph/builders';
```

The system now uses a streamlined swarm architecture without the complexity of supervisor coordination.

### Directory Structure

```
ai/
├── graph/                          # Modular graph system
│   ├── multiAgentGraphBuilder.ts   # Main orchestrator
│   ├── types.ts                    # Core interfaces
│   ├── stateManager.ts             # State management
│   ├── nodes/                      # Node builders
│   │   ├── plannerNode.ts
│   │   └── synthesisNode.ts
│   ├── edges/                      # Edge configuration
│   │   └── edgeBuilder.ts
│   ├── builders/                   # Graph builders
│   │   └── swarmGraphBuilder.ts
│   └── index.ts                    # Central exports
├── tools/                          # MCP tools and utilities
└── agents/                         # Individual agent implementations
```

## Future Enhancements

### Agent System
- Add more specialized agents (e.g., ScreenpipeAgent for local content, DataAnalysisAgent, CodeAgent)
- Implement agent memory and learning
- Add agent collaboration patterns
- Implement agent performance monitoring
- Add agent versioning and rollback capabilities

### Graph System
- Add graph visualization and debugging tools
- Implement dynamic graph reconfiguration
- Add graph performance metrics and optimization
- Support for conditional node execution
- Add graph templates for common patterns

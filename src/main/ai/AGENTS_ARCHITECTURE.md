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

### 4. Multi-Agent Graph Builder (`utils/multiAgentGraphBuilder.ts`)

Supports two architectures:

#### Supervisor Architecture
- Central supervisor agent coordinates all other agents
- Supervisor decides which agent to invoke based on the task
- Agents report back to supervisor after completion

#### Swarm Architecture
- Agents dynamically hand off control to each other
- No central coordinator
- Agents decide when to hand off based on their capabilities

### 5. Memory System (`memory.ts`)

- **Short-term Memory**: Thread-level conversation continuity
- **Long-term Memory**: Cross-thread user profiles and preferences
- **Persistence**: File-based storage for durability
- **Integration**: Seamlessly integrated with UnifiedAgent
- **Memory Tools**: Specialized tools for memory operations

### 6. Integration with Unified Agent

The UnifiedAgent (`unifiedAgent.ts`) integrates all agents including MemoryAgent:
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

## Usage Example

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

## Benefits

1. **Modularity**: Each agent is self-contained and focused on specific capabilities
2. **Extensibility**: Easy to add new agents by extending BaseAgent
3. **Flexibility**: Supports both supervisor and swarm architectures
4. **Reusability**: Agents can be used across different graphs
5. **Dynamic Routing**: Agents can hand off to specialists when needed
6. **Tool Isolation**: Each agent only gets the tools it needs

## Future Enhancements

- Add more specialized agents (e.g., ScreenpipeAgent for local content, DataAnalysisAgent, CodeAgent)
- Implement agent memory and learning
- Add agent collaboration patterns
- Implement agent performance monitoring
- Add agent versioning and rollback capabilities

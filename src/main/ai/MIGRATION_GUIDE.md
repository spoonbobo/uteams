# Migration Guide: From Graph-Specific to Unified Agent System

## Overview

The AI system has been successfully migrated from separate graph implementations (general and research) to a unified multi-agent system. This migration is now **COMPLETE** and provides better modularity, reusability, and maintainability.

## What Changed

### Before (Graph-Specific Architecture)
```
src/main/ai/
├── graphs/
│   ├── general/
│   │   ├── generalAgent.ts
│   │   ├── nodes/
│   │   └── utils/
│   └── research/
│       ├── researchAgent.ts
│       ├── nodes/
│       └── utils/
```

### After (Unified Agent Architecture)
```
src/main/ai/
├── agents/           # Specialized agent implementations
│   ├── tavilyAgent.ts
│   ├── playwrightAgent.ts
│   └── screenpipeAgent.ts
├── types/           # Centralized types
│   ├── agent.ts
│   └── ...
├── utils/           # Centralized utilities
│   ├── mcpClient.ts
│   ├── graphBuilder.ts
│   └── multiAgentGraphBuilder.ts
└── unifiedAgent.ts  # Single entry point
```

## Migration Status: COMPLETED ✅

The migration has been successfully completed. The following changes have been implemented:

### 1. `graphs/` folder removal ✅
- **Status**: COMPLETED - The graphs folder has been removed
- **Result**: All functionality now uses the unified agent system
- **Replaced Components**:
  - `general/` - ✅ Now handled by unified agent with multi-agent capabilities
  - `research/` - ✅ Now handled by unified agent with research mode

## Migration Steps: COMPLETED ✅

### Step 1: Update Imports ✅
**Status**: COMPLETED - All imports have been updated

Current implementation uses backward-compatible exports:
```typescript
// Current implementation in src/main/ai/index.ts
export { unifiedAgent };
export { unifiedAgent as generalAgent };  // Backward compatibility
export { unifiedAgent as bettingResearchAgent };  // Backward compatibility
```

### Step 2: Update Usage ✅
**Status**: COMPLETED - All usage patterns have been migrated

Current unified agent usage:
```typescript
// Unified agent handles all request types
const response = await unifiedAgent.run({ 
  sessionId, 
  prompt, 
  type: 'general' | 'research' | 'auto',
  userId,        // For memory support
  threadId,      // For conversation continuity
  useMemory      // Memory enable/disable
});
```

### Step 3: Clean Up ✅
**Status**: COMPLETED - Cleanup has been performed

## Benefits of the New Architecture

1. **Single Entry Point**: One unified agent handles all requests
2. **Dynamic Agent Selection**: Automatically chooses the best agent for each task
3. **Agent Handoffs**: Agents can transfer control to specialists
4. **Better Modularity**: Each agent is self-contained
5. **Easier Maintenance**: Centralized utilities and types
6. **Extensibility**: Easy to add new agents

## Backward Compatibility

The system maintains backward compatibility through:
- Export aliases in `src/main/ai/index.ts`
- Wrapper functions in `research.ts` and `chat.ts`
- Compatible response structures

## What's Preserved

- All MCP tool integrations
- Progress event streaming
- Session management
- Error handling
- IPC communication patterns

## Testing Checklist: COMPLETED ✅

Migration verification completed:
- [x] Chat functionality works with unified agent
- [x] Research functionality works with unified agent
- [x] Progress events stream correctly
- [x] MCP tools are discovered and work
- [x] Agent handoffs function properly
- [x] No import errors in the codebase
- [x] Memory system integration working
- [x] Backward compatibility maintained

## Notes

- ✅ Migration completed successfully
- ✅ The unified system is more efficient and maintainable
- ✅ All original functionality is preserved or enhanced
- ✅ The new architecture follows LangGraph best practices
- ✅ Memory system integration added
- ✅ Multi-agent architecture with dynamic handoffs implemented

## Current Architecture Status

The system now includes:
- **3 Active Agents**: TavilyAgent, PlaywrightAgent, MemoryAgent
- **Memory System**: Full short-term and long-term memory support
- **Dynamic Handoffs**: Agents can transfer control to specialists
- **Unified Interface**: Single entry point for all AI operations
- **Backward Compatibility**: Legacy code continues to work

# Memory System Documentation

## Overview

The Memory System provides both short-term (thread-level) and long-term (cross-thread) memory capabilities for the Unified Agent, following [LangGraph's memory patterns](https://langchain-ai.github.io/langgraphjs/agents/memory/).

## Architecture

### Components

1. **MemoryManager** (`memory.ts`)
   - Central memory management system
   - Handles both short-term and long-term memory
   - Provides persistence to disk
   - Manages user profiles and session memories

2. **Memory Tools** (`tools/memoryTools.ts`)
   - Agent-accessible tools for memory operations
   - Includes tools for saving, retrieving, and searching memories
   - Supports user preference management

3. **Integration** (`unifiedAgent.ts`)
   - Seamlessly integrated into the UnifiedAgent
   - Automatic memory context loading
   - Thread-based conversation continuity

## Features

### Short-term Memory (Thread-level)
- **Conversation Continuity**: Maintains message history within a session
- **Thread Management**: Each conversation has a unique thread ID
- **Automatic Context**: Previous messages automatically loaded for context
- **Checkpointing**: Uses LangGraph's MemorySaver for state persistence

### Long-term Memory (Cross-thread)
- **User Profiles**: Stores user preferences and context
- **Session History**: Persists conversations across sessions
- **Search Capabilities**: Search through past conversations
- **Custom Memories**: Store arbitrary key-value pairs

## Usage

### Basic Usage in UnifiedAgent

```typescript
import { unifiedAgent } from './ai';

// Run with memory enabled (default)
const response = await unifiedAgent.run({
  sessionId: 'session_123',
  prompt: 'Hello, how are you?',
  userId: 'user_123',
  threadId: 'thread_456',  // Optional: continues existing thread
  useMemory: true,  // Optional: defaults to true
});

// The agent will automatically:
// 1. Load user profile and apply preferences
// 2. Load previous messages if continuing a thread
// 3. Save the conversation to memory
```

### User Profile Management

```typescript
// Save user profile
await unifiedAgent.updateUserProfile({
  userId: 'user_123',
  name: 'John Doe',
  language: 'English',
  preferences: {
    defaultAgent: 'tavily_agent',
    temperature: 0.7,
    maxTokens: 2000,
    responseStyle: 'detailed',
  },
  context: {
    role: 'Software Developer',
    expertise: ['JavaScript', 'Python'],
    interests: ['AI', 'Web Development'],
  },
});

// Get user profile
const memoryManager = unifiedAgent.getMemoryManager();
const profile = await memoryManager.getUserProfile('user_123');
```

### Session Management

```typescript
// Get recent sessions for a user
const sessions = await unifiedAgent.getUserSessions('user_123', 5);

// Search through memories
const results = await unifiedAgent.searchMemories('JavaScript', 'user_123');

// Clear old sessions (older than 30 days)
const memoryManager = unifiedAgent.getMemoryManager();
const cleared = await memoryManager.clearOldSessions(30);
```

### Course Memory Management

```typescript
// Save course memory
const courseMemory = {
  courseId: 'course_123',
  courseName: 'JavaScript Programming',
  courseShortName: 'JS101',
  assignments: [
    { id: 'assign1', name: 'Variables', dueDate: Date.now() }
  ],
  students: [
    { id: 'student1', name: 'John Doe', email: 'john@example.com' }
  ],
  activities: [
    { id: 'activity1', name: 'Quiz 1', type: 'quiz' }
  ],
  lastUpdated: new Date().toISOString()
};

const memoryManager = unifiedAgent.getMemoryManager();
await memoryManager.saveCourseMemory(courseMemory);

// Retrieve course memory
const course = await memoryManager.getCourseMemory('course_123');

// Get all courses
const allCourses = await memoryManager.getAllCourseMemories();
```

### Memory Tools for Agents

Agents can use memory tools to interact with the memory system:

```typescript
import { getMemoryTools } from './ai/tools/memoryTools';

// Add memory tools to an agent
const memoryTools = getMemoryTools();
// Tools include:
// - get_user_info: Retrieve user information
// - save_user_info: Update user preferences
// - recall_conversation: Search conversation history
// - remember: Store custom memories
// - recall: Retrieve custom memories
// - forget: Delete memories
```

## IPC Handlers

The memory system exposes several IPC handlers for the renderer process:

### Core Chat Handler with Memory
```typescript
// Run agent with memory support
await ipcRenderer.invoke('chat:agent:run', {
  sessionId: 'session_123',
  prompt: 'Hello',
  userId: 'user_123',
  threadId: 'thread_456',
  useMemory: true,
});
```

### Memory-specific Handlers

#### Chat Memory Handlers (chat.ts)
```typescript
// Get user profile
await ipcRenderer.invoke('chat:memory:getUserProfile', { userId: 'user_123' });

// Save user profile
await ipcRenderer.invoke('chat:memory:saveUserProfile', { 
  profile: { userId: 'user_123', name: 'John' } 
});

// Get recent sessions
await ipcRenderer.invoke('chat:memory:getRecentSessions', { 
  userId: 'user_123', 
  limit: 5 
});

// Search memories
await ipcRenderer.invoke('chat:memory:searchMemories', { 
  query: 'JavaScript', 
  userId: 'user_123' 
});

// Clear old sessions
await ipcRenderer.invoke('chat:memory:clearOldSessions', { 
  daysToKeep: 30 
});

// Get memory statistics
await ipcRenderer.invoke('chat:memory:getStats');

// Enable/disable memory
await ipcRenderer.invoke('chat:memory:setEnabled', { enabled: true });
```

#### Course Memory Handlers (memoryIpc.ts)
```typescript
// Save course memory
await ipcRenderer.invoke('memory:save-course', courseMemory);

// Get course memory
await ipcRenderer.invoke('memory:get-course', courseId);

// Get all course memories
await ipcRenderer.invoke('memory:get-all-courses');

// Search course memories
await ipcRenderer.invoke('memory:search-courses', { query: 'JavaScript' });

// Clear course memories
await ipcRenderer.invoke('memory:clear-courses');

// Get course memory statistics
await ipcRenderer.invoke('memory:get-course-stats');
```

## Configuration

### Memory Configuration Options

```typescript
interface MemoryConfig {
  enableShortTermMemory?: boolean;  // Default: true
  enableLongTermMemory?: boolean;   // Default: true
  persistencePath?: string;         // Default: './data/memory'
  maxMessagesPerThread?: number;    // Default: 100
  maxThreadsPerUser?: number;       // Default: 10
  autoSummarize?: boolean;          // Default: true
  summarizeAfterMessages?: number;  // Default: 20
}
```

### Persistence

Memory data is persisted to disk in the following structure:
```
data/memory/
├── users/
│   └── user_123.json       # User profiles
├── sessions/
│   └── session_123/
│       └── thread_456.json # Session memories
└── courses/
    └── course_123.json     # Course memories
```

## Best Practices

1. **User Identification**: Always provide a userId for proper memory isolation
2. **Thread Management**: Use consistent threadIds for conversation continuity
3. **Memory Cleanup**: Periodically clear old sessions to manage storage
4. **Profile Updates**: Keep user profiles updated with preferences
5. **Search Optimization**: Use specific search queries for better results

## Examples

### Example 1: Continuing a Conversation

```typescript
// First message
const response1 = await unifiedAgent.run({
  sessionId: 'session_123',
  prompt: 'My name is John and I like JavaScript',
  userId: 'user_123',
  threadId: 'thread_1',
});

// Later message in same thread
const response2 = await unifiedAgent.run({
  sessionId: 'session_123',
  prompt: 'What programming language do I like?',
  userId: 'user_123',
  threadId: 'thread_1',  // Same thread ID
});
// The agent will remember the context from the first message
```

### Example 2: User Preferences

```typescript
// Set user preference for detailed responses
await unifiedAgent.updateUserProfile({
  userId: 'user_123',
  preferences: {
    responseStyle: 'detailed',
    temperature: 0.8,
  },
});

// All future responses for this user will use these preferences
const response = await unifiedAgent.run({
  sessionId: 'session_123',
  prompt: 'Explain quantum computing',
  userId: 'user_123',
});
```

### Example 3: Memory Search

```typescript
// Search for past conversations about a topic
const results = await unifiedAgent.searchMemories('quantum computing', 'user_123');

// Use the results to provide context
const response = await unifiedAgent.run({
  sessionId: 'session_123',
  prompt: `Based on our previous discussions about quantum computing, 
           what else would you like to know?`,
  userId: 'user_123',
});
```

## Troubleshooting

### Memory Not Persisting
- Check that the persistence directory exists and is writable
- Verify that `useMemory` is not set to `false`
- Ensure proper userId and threadId are provided

### Performance Issues
- Limit the number of messages per thread using `maxMessagesPerThread`
- Clear old sessions regularly
- Consider disabling auto-summarization for better performance

### Memory Conflicts
- Each user has isolated memory space
- Thread IDs should be unique per conversation
- Use consistent userId across sessions

## Current Implementation Status

✅ **Implemented Features:**
- Short-term memory (thread-level conversation continuity)
- Long-term memory (user profiles and session history)
- Course memory system with full CRUD operations
- Memory persistence to disk
- IPC handlers for both chat and course memory
- Integration with UnifiedAgent
- Memory tools for agents
- Automatic memory context loading

## Future Enhancements

- [ ] Vector embeddings for semantic search
- [ ] Automatic conversation summarization with LLM
- [ ] Memory compression for long conversations
- [ ] Export/import memory data
- [ ] Memory analytics and insights
- [ ] Multi-user memory sharing (with permissions)

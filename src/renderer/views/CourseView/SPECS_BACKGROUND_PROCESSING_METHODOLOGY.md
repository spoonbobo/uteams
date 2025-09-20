# Background Processing Module Development Methodology

## Overview

This document outlines the proven methodology for building robust background-processing modules in our Electron app, based on successful implementations in the **Grading** and **Coursework Generator** modules.

## Core Architecture Pattern

### 1. Store-Centric State Management

#### Store Structure Template
```typescript
interface ModuleState {
  // Core data
  moduleData: Record<string, ModuleData>;
  
  // Background processing tracking
  processingInProgress: Set<string>; // Set of entity IDs currently processing
  activeProcessingEntity: string | null; // Which entity should show UI
  
  // Result persistence
  processResults: Record<string, ProcessResult>;
  
  // Actions
  startProcessing: (entityId: string) => void;
  finishProcessing: (entityId: string) => void;
  setProcessingError: (entityId: string, error?: string) => void;
  abortProcessing: (entityId: string) => void;
  isProcessingInProgress: (entityId: string) => boolean;
}
```

#### Key Store Principles
1. **Persistent Background State**: Use `Set<string>` for tracking active processes
2. **Entity-Based Tracking**: Track by unique entity ID (courseId, studentId, etc.)
3. **Active Entity Management**: Track which entity should display UI
4. **Result Persistence**: Store results with entity association
5. **Zustand Persistence**: Persist critical state across app restarts

### 2. Component Architecture

#### Component Structure Template
```typescript
function ProcessingComponent({ entityContext }: Props) {
  // 1. Store Integration
  const {
    startProcessing,
    finishProcessing,
    isProcessingInProgress,
    activeProcessingEntity,
    getLatestResult
  } = useModuleStore();
  
  // 2. Local UI State Only
  const [localError, setLocalError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string>('');
  
  // 3. Derived State from Store
  const processingInProgress = isProcessingInProgress(entityContext.id);
  const isActiveProcessing = activeProcessingEntity === entityContext.id;
  
  // 4. IPC Event Handling
  useEffect(() => {
    const handleStreamEnd = (event: any, data: any) => {
      if (data?.sessionId === sessionId) {
        finishProcessing(entityContext.id);
        if (data.resultSummary) {
          setResultSummary(data.resultSummary);
          updateRecord(entityContext.id, { resultSummary: data.resultSummary });
        }
      }
    };
    
    // Register listeners...
  }, []);
  
  // 5. Background State Awareness
  const existingResult = getLatestResult(entityContext.id);
}
```

## Implementation Checklist

### Phase 1: Store Setup
- [ ] Define processing state interface with `Set<string>` for active processes
- [ ] Add `activeProcessingEntity` for UI management
- [ ] Implement progress tracking actions (`start`, `finish`, `error`, `abort`)
- [ ] Add persistence configuration for background state
- [ ] Include `onRehydrateStorage` to restore Set from Array

### Phase 2: Component Integration
- [ ] Replace local processing state with store-derived state
- [ ] Use `isProcessingInProgress(entityId)` instead of local boolean
- [ ] Implement proper IPC event handling with entity filtering
- [ ] Add background state awareness for UI display
- [ ] Handle context switching gracefully

### Phase 3: IPC Event Patterns
- [ ] **Token Streaming**: Simple accumulation, delegate processing to store
- [ ] **Completion**: Call `finishProcessing()`, update records with `resultSummary`
- [ ] **Error Handling**: Call `setProcessingError()`, update error records
- [ ] **Plan/Todos**: Store ALL session data, filter by session prefix
- [ ] **Session Filtering**: Use consistent session ID patterns

### Phase 4: Background Persistence
- [ ] Persist processing state in store
- [ ] Handle app restarts gracefully
- [ ] Support context switching without losing state
- [ ] Maintain IPC connections across context changes

## Proven Patterns

### 1. Session ID Patterns
```typescript
// Consistent session ID generation
const sessionId = `${moduleType}-${entityId}`;
// Examples:
// `grading-${assignmentId}-${studentId}`
// `coursework-generation-${courseId}`
```

### 2. IPC Event Filtering
```typescript
// Pattern for handling multiple sessions
const handleEvent = (event: any, data: any) => {
  const eventData = data || event;
  
  // Exact match for specific sessions
  if (eventData?.sessionId === sessionId) {
    // Handle event
  }
  
  // Prefix match for related sessions
  if (eventData?.sessionId?.startsWith(`${moduleType}-${entityId}-`)) {
    // Handle related event
  }
};
```

### 3. Store State Management
```typescript
// Starting processing
startProcessing: (entityId: string) => {
  set(state => ({
    processingInProgress: new Set(state.processingInProgress).add(entityId),
    activeProcessingEntity: entityId
  }));
},

// Finishing processing
finishProcessing: (entityId: string) => {
  set(state => {
    const newSet = new Set(state.processingInProgress);
    newSet.delete(entityId);
    return {
      processingInProgress: newSet,
      activeProcessingEntity: state.activeProcessingEntity === entityId ? null : state.activeProcessingEntity
    };
  });
}
```

### 4. Persistence Configuration
```typescript
{
  name: 'module-store',
  partialize: (state) => ({
    moduleData: state.moduleData,
    processResults: state.processResults,
    // Convert Set to Array for serialization
    processingInProgress: Array.from(state.processingInProgress),
    activeProcessingEntity: state.activeProcessingEntity,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      // Convert Array back to Set
      if (Array.isArray(state.processingInProgress)) {
        state.processingInProgress = new Set(state.processingInProgress);
      } else {
        state.processingInProgress = new Set<string>();
      }
    }
  },
}
```

## Anti-Patterns to Avoid

### ❌ Don't Use Local Component State for Processing Status
```typescript
// BAD: Local state gets lost on context switch
const [isProcessing, setIsProcessing] = useState(false);
```

### ❌ Don't Handle All IPC Events in Components
```typescript
// BAD: Complex IPC logic in component
useEffect(() => {
  // 100+ lines of IPC handling
}, []);
```

### ❌ Don't Ignore Background State
```typescript
// BAD: Only showing current context state
{existingRecord ? showResult : showEmpty}

// GOOD: Show background processing awareness
{existingRecord ? showResult : 
 hasBackgroundProcessing ? showBackgroundStatus : showEmpty}
```

### ❌ Don't Use Inconsistent Session IDs
```typescript
// BAD: Different patterns
const sessionId1 = `grading_${id}`;
const sessionId2 = `grading-${id}-${subId}`;

// GOOD: Consistent patterns
const sessionId = `grading-${assignmentId}-${studentId}`;
```

## Testing Strategy

### 1. Background Processing Tests
- [ ] Start processing, switch context, return → Should show continued processing
- [ ] Multiple entities processing simultaneously → Should track all correctly
- [ ] App restart during processing → Should restore state properly
- [ ] IPC completion while in different context → Should update correct entity

### 2. State Persistence Tests
- [ ] Refresh app during processing → State should restore
- [ ] Switch between entities → Each should maintain independent state
- [ ] Clear data → Should properly clean up all related state

### 3. Error Handling Tests
- [ ] IPC errors during background processing → Should update correct entity
- [ ] Network errors → Should be properly tracked and displayed
- [ ] Abort operations → Should clean up properly

## Migration Guide

### Converting Existing Modules

1. **Identify Processing Operations**: Find async operations that should run in background
2. **Extract State to Store**: Move processing state from component to store
3. **Add Progress Tracking**: Implement `Set<string>` based tracking
4. **Update IPC Handling**: Ensure proper session filtering and delegation
5. **Add Persistence**: Configure Zustand persistence for critical state
6. **Test Background Behavior**: Verify context switching works properly

### Example Migration
```typescript
// BEFORE: Component-only state
const [isGrading, setIsGrading] = useState(false);

// AFTER: Store-based state
const {
  startGrading,
  finishGrading,
  isStudentBeingGraded,
  activeGradingStudent
} = useGradingStore();

const isGrading = isStudentBeingGraded(studentId);
const isActiveGrading = activeGradingStudent === studentId;
```

## Key Insights from Implementation

### 1. Store vs Component Responsibilities
- **Store**: Background state, persistence, progress tracking, result storage
- **Component**: UI state, event handling, user interactions, display logic

### 2. IPC Event Delegation
- **Components**: Listen to events, filter by session, delegate to store
- **Store**: Process events, update state, manage streams/buffers

### 3. Context Switching Support
- **Always check background state** when mounting components
- **Display background processing indicators** when appropriate
- **Maintain IPC connections** across context changes

### 4. Error Handling Strategy
- **Local UI errors**: Component state for immediate feedback
- **Persistent errors**: Store state for background error tracking
- **Recovery**: Graceful degradation and retry mechanisms

## Future Module Template

When creating new background-processing modules:

1. **Start with Store Design**: Define state interface with background tracking
2. **Implement Progress Actions**: Add start/finish/error/abort methods
3. **Add Persistence**: Configure Zustand persistence properly
4. **Build Component**: Focus on UI and event delegation
5. **Test Background Behavior**: Verify context switching works
6. **Add Error Handling**: Implement both local and persistent error states

This methodology ensures consistent, reliable background processing across all modules while maintaining clean separation of concerns and robust state management.

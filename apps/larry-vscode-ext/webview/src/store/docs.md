# Store Architecture Documentation

## Overview

The Larry VS Code extension uses a multi-webview architecture with state synchronization between:

- **Sidebar Webview** (PRIMARY) - The main UI, orchestrates the workflow
- **Artifact Editor Webview** (CONSUMER) - Rich editor for spec/architecture files
- **Extension (Node.js)** (RELAY/CACHE) - Message broker and state cache

Each webview runs in a **separate isolated browser context** and cannot share JavaScript memory directly. State synchronization is achieved via message passing through the extension.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Extension (Node.js)                      │
│                                                             │
│  ExtensionState {                                           │
│    larryState: LarryState      // Cached from sidebar       │
│    queryCache: string          // Dehydrated React Query    │
│    artifactEditorPanels: Set   // Active editor panels      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
        ▲                                    │
        │ larry_state_sync                   │ larry_state_update
        │ query_cache_sync                   │ query_cache_hydrate
        │                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│   Sidebar Webview   │            │  Artifact Editor    │
│   (PRIMARY)         │            │  (CONSUMER)         │
│                     │            │                     │
│  ┌───────────────┐  │            │  ┌───────────────┐  │
│  │ ExtensionStore│  │            │  │ Local State   │  │
│  │ (LarryState)  │  │            │  │ (LarryState)  │  │
│  └───────────────┘  │            │  └───────────────┘  │
│                     │            │                     │
│  ┌───────────────┐  │            │  ┌───────────────┐  │
│  │ QueryClient   │  │            │  │ QueryClient   │  │
│  │ (SSE updates) │  │            │  │ (hydrated)    │  │
│  └───────────────┘  │            │  └───────────────┘  │
│                     │            │                     │
│  ┌───────────────┐  │            │                     │
│  │LarryStateSync │  │            │                     │
│  │ (dehydrates)  │  │            │                     │
│  └───────────────┘  │            │                     │
└─────────────────────┘            └─────────────────────┘
```

## State Types

### LarryState (`larry-state.ts`)

The core shared state type used across all components:

```typescript
interface LarryState {
  // Thread/Machine context
  currentThreadId: string | undefined;
  apiUrl: string;

  // Current machine data (from SSE/API)
  machineData: MachineResponse | undefined;

  // Environment
  isInWorktree: boolean;
  worktreePort: number;
  mainPort: number;

  // Config
  agents: Record<string, string>;
  selectedAgent: string;
}
```

### ExtensionState (Node.js side)

The extension maintains a cached copy plus panel tracking:

```typescript
interface ExtensionState {
  // ... existing fields ...

  larryState: LarryState | undefined;
  queryCache: string | undefined; // JSON serialized
  artifactEditorPanels: Set<WebviewPanel>;
}
```

## Message Types

### Sidebar → Extension

| Message            | Purpose                      | Payload                      |
| ------------------ | ---------------------------- | ---------------------------- |
| `larry_state_sync` | Sync LarryState to extension | `{ larryState: LarryState }` |
| `query_cache_sync` | Sync dehydrated query cache  | `{ queryCache: string }`     |

### Extension → Artifact Editor

| Message               | Purpose                    | Payload                                         |
| --------------------- | -------------------------- | ----------------------------------------------- |
| `larry_state_update`  | Push LarryState to editor  | `{ larryState: LarryState }`                    |
| `query_cache_hydrate` | Push query cache to editor | `{ queryCache: string }`                        |
| `initialContent`      | Initial load with all data | `{ content, fileName, larryState, queryCache }` |

### Artifact Editor → Extension

| Message            | Purpose                    | Payload               |
| ------------------ | -------------------------- | --------------------- |
| `getEditorContent` | Request initial content    | `{}`                  |
| `edit`             | Save file content          | `{ content: string }` |
| `proceed_complete` | Notify proceed action done | `{}`                  |

### Extension → Sidebar

| Message           | Purpose                      | Payload |
| ----------------- | ---------------------------- | ------- |
| `refetch_machine` | Trigger machine data refetch | `{}`    |

## React Query Synchronization

React Query caches are separate per webview. To share cached data:

### Dehydration (Sidebar)

```typescript
import { dehydrateQueryCache } from './query-sync';

// When machine data changes
const serializedCache = dehydrateQueryCache();
postMessage({ type: 'query_cache_sync', queryCache: serializedCache });
```

### Hydration (Artifact Editor)

```typescript
import { hydrateQueryCache } from './query-sync';

// On receiving cached state
onMessage((msg) => {
  if (msg.type === 'query_cache_hydrate') {
    hydrateQueryCache(msg.queryCache);
  }
});
```

## Data Flows

### 1. Initial Editor Load

```
Artifact Editor                Extension                    Sidebar
     │                              │                          │
     │──getEditorContent──────────▶│                          │
     │                              │                          │
     │◀─initialContent─────────────│                          │
     │  (content, larryState,      │                          │
     │   queryCache)               │                          │
     │                              │                          │
     │ [hydrate query cache]       │                          │
     │ [store larryState]          │                          │
     │ [render with data]          │                          │
```

### 2. SSE Update Flow

```
Sidebar                        Extension                Artifact Editor
   │                              │                          │
   │ [SSE: machine updated]       │                          │
   │ [QueryClient updated]        │                          │
   │                              │                          │
   │──larry_state_sync──────────▶│                          │
   │──query_cache_sync──────────▶│                          │
   │                              │                          │
   │                              │──larry_state_update────▶│
   │                              │──query_cache_hydrate───▶│
   │                              │                          │
   │                              │            [hydrate cache]│
   │                              │            [update state] │
   │                              │            [re-render]    │
```

### 3. Proceed Action Flow

```
Artifact Editor                Extension                    Sidebar
     │                              │                          │
     │ [call fetchGetNextState]    │                          │
     │                              │                          │
     │──proceed_complete─────────▶│                          │
     │                              │                          │
     │                              │──refetch_machine───────▶│
     │                              │                          │
     │                              │            [invalidate]  │
     │                              │            [refetch]     │
     │                              │                          │
     │                              │◀─larry_state_sync───────│
     │                              │◀─query_cache_sync───────│
     │                              │                          │
     │◀─larry_state_update─────────│                          │
     │◀─query_cache_hydrate────────│                          │
```

## Components

### LarryStateSync (`views/LarryStateSync.tsx`)

Sidebar component that watches for state changes and syncs to extension:

- Subscribes to ExtensionStore changes
- Subscribes to machine query updates
- Dehydrates query cache on changes
- Posts sync messages to extension
- Debounced to avoid excessive messages

### EditorModule (`views/spec-editor/EditorModule.tsx`)

Artifact editor main component:

- Receives LarryState via messages
- Hydrates query cache on load
- Uses local useState for LarryState
- Calls API directly for fetchGetNextState

## Files

| File                                 | Purpose                                       |
| ------------------------------------ | --------------------------------------------- |
| `store/larry-state.ts`               | LarryState type and utilities                 |
| `store/query-sync.ts`                | Hydration/dehydration utilities               |
| `store/store.ts`                     | Sidebar ExtensionStore (uses LarryState)      |
| `store/docs.md`                      | This documentation                            |
| `views/LarryStateSync.tsx`           | State sync component for sidebar              |
| `views/BootChannel.tsx`              | Handles `refetch_machine` to invalidate query |
| `views/spec-editor/EditorModule.tsx` | Artifact editor component                     |

## Best Practices

1. **Always use LarryState type** for state that needs to be shared
2. **Sync on meaningful changes** - debounce to avoid message flooding
3. **Hydrate before render** - ensure cache is ready before components mount
4. **Handle missing state gracefully** - editor may load before sidebar syncs
5. **Keep queryCache serializable** - only successful queries are dehydrated

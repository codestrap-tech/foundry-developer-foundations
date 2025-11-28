# Larry VSCode Extension

A VSCode extension for AI-assisted development with worktree management.

## Requirements

### 1. Backend Express App

The extension requires a backend Express app that exposes Larry AI coding assistant agent endpoints. An example implementation can be found in `apps/cli-tools/src/larry-backend-app`.

The backend app:
- Runs on configurable ports (default: 4220 for worktree, 4210 for main)
- Exposes agent routes (e.g., `/larry/agents/google/v1`)
- Provides SSE (Server-Sent Events) for real-time updates
- Consumes the custom x-reason Larry AI coding assistant agent

Example backend structure:
```
apps/cli-tools/src/larry-backend-app/
├── src/
│   ├── app.ts              # Express app setup
│   ├── server.ts           # Server entry point
│   ├── routes/
│   │   └── google/         # Agent routes (threads, machines, events)
│   └── services/
│       └── sse.service.ts  # Server-Sent Events handling
```

### 2. Docker Setup

The extension uses Docker to run isolated backend instances for each worktree. You need a `Larry.Dockerfile` in your project root.

Example Dockerfile:
```dockerfile
FROM node:22.13.0-alpine
RUN apk add --no-cache git python3 make g++

WORKDIR /workspace

RUN addgroup -g 1001 -S nodejs && \
    adduser -S larry -u 1001 -G nodejs

USER larry

EXPOSE 4220 4210
ENV PORT=4220

ENTRYPOINT ["sh", "-c"]
CMD ["cd /workspace/apps/cli-tools && PORT=$PORT npm run server"]
```

### 3. larry.config.json

**This extension requires a `larry.config.json` file in your project root.** The extension will not work without it.

Create a `larry.config.json` file with the following structure:

```json
{
  "agents": {
    "google": "/larry/agents/google/v1"
  },
  "workspaceSetupCommand": ["npm install"],
  "larryEnvPath": "apps/cli-tools/.env"
}
```

### Configuration Options

#### `agents` (Required)
An object mapping agent keys to their API routes. At least one agent must be defined.

Example:
```json
{
  "agents": {
    "google": "/larry/agents/google/v1",
    "openSearch": "/larry/agents/open-search/v1"
  }
}
```

Agent names will be automatically formatted in the UI (e.g., `openSearch` → "Open Search").

#### `workspaceSetupCommand` (Required)
An array of shell commands to execute when setting up a new worktree. Commands are executed sequentially.

Examples:
```json
{
  "workspaceSetupCommand": ["npm install"]
}
```

```json
{
  "workspaceSetupCommand": ["pnpm install"]
}
```

```json
{
  "workspaceSetupCommand": ["npm install", "./scripts/pull-app-env.sh"]
}
```

#### `larryEnvPath` (Required)
Path to the environment file that should be copied to new worktrees, relative to the project root.

Example:
```json
{
  "larryEnvPath": "apps/cli-tools/.env"
}
```

## Installation

1. Set up your backend Express app (see `apps/cli-tools/src/larry-backend-app` for example)
2. Create a `Larry.Dockerfile` in your project root
3. Create a `larry.config.json` file in your project root
4. Build the Docker image: `docker build -f Larry.Dockerfile -t larry-server .`
5. Install the extension
6. Open the Larry panel in VSCode
7. Select an agent and start working!

## Usage

1. Open the Larry sidebar
2. Either select an existing working item or create a new one
3. Choose your preferred agent
4. Click "Start" to create a worktree and begin working

The extension will automatically:
- Create a git worktree
- Set up a Docker container
- Run your configured setup commands
- Copy environment files
- Open the worktree in a new VSCode window





## Larry stream extension bridge

Webview                    Extension                   Backend
   │                          │                           │
   │ start_larry_stream       │                           │
   │─────────────────────────>│                           │
   │                          │ SSEProxy connects         │
   │                          │──────────────────────────>│
   │                          │                           │
   │                          │    larry.update event     │
   │                          │<──────────────────────────│
   │  larry_stream_event      │                           │
   │<─────────────────────────│                           │
   │                          │                           │
   │ stop_larry_stream        │                           │
   │─────────────────────────>│                           │
   │                          │ proxy.stop()              │
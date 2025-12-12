---

name: Google OAuth Calendar Scheduler
overview: Build a Next.js App Router application under `apps/calendar-scheduler` that implements Google OAuth2 Authorization Code Flow for calendar access, stores tokens in a JSON file with promise-based abstraction, provides a CRON-triggered endpoint to reschedule events, and shows today’s calendar on the homepage if logged in using cookies to track login state.
todos:

* id: scaffold-app
  content: Scaffold Next.js app with Nx generator and configure port 3000
  status: pending
* id: token-storage
  content: Implement Promise-based token storage with JSON file (AsyncLocalStorage removed; simple promise wrapper)
  status: pending
* id: oauth-setup
  content: Create Google OAuth client setup and auth URL generator
  status: pending
* id: auth-routes
  content: Implement /api/auth/google and /api/auth/google/callback routes
  status: pending
* id: calendar-service
  content: Create calendar service for fetching/updating events and reading/updating counter in event description
  status: pending
* id: reschedule-endpoint
  content: Implement /api/reschedule CRON endpoint (open, no auth) with description counter logic
  status: pending
* id: frontend-ui
  content: Build homepage UI to:

  * If not logged in, show "Login with Google" button
  * If logged in, show today's calendar events in a simple list
  * Use cookie to track logged-in user
    status: pending

---

# Google OAuth Calendar Scheduler Implementation Plan

## Overview

Create `apps/calendar-scheduler`, a Next.js (App Router) application implementing Google OAuth2 Authorization Code Flow with token persistence, a CRON endpoint to reschedule calendar events, and a homepage showing today’s calendar if logged in.

## 1. Scaffold the Next.js App with Nx

Run the Nx generator to create the application:

```bash
npx nx generate @nx/next:application calendar-scheduler --directory=apps/calendar-scheduler --appDir=true --src=true --style=css
```

Update `apps/calendar-scheduler/project.json` to configure port 3000:

```json
{
  "serve": {
    "options": {
      "port": 3000
    }
  }
}
```

## 2. Folder Structure

```tree
apps/calendar-scheduler/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── google/
│   │   │   │       ├── route.ts          # Initiates OAuth redirect
│   │   │   │       └── callback/
│   │   │   │           └── route.ts      # Handles OAuth callback
│   │   │   └── reschedule/
│   │   │       └── route.ts              # CRON endpoint (no auth, description counter)
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Homepage with login / calendar display
│   │   └── globals.css
│   ├── lib/
│   │   ├── google-oauth.ts               # OAuth client setup
│   │   ├── calendar-service.ts           # Google Calendar API interactions, event counter
│   │   └── token-storage.ts              # Promise-based JSON token storage
│   └── types/
│       └── tokens.ts                     # Token type definitions
├── tokens.json                           # Persisted tokens (gitignored)
├── .env.local                            # Environment variables
├── next.config.js
├── project.json
└── tsconfig.json
```

## 3. Environment Variables

Create `.env.local` (and add to `.gitignore`):

```.env
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## 4. Token Storage (Promise-based)

**[`src/lib/token-storage.ts`](src/lib/token-storage.ts)** - Abstract storage layer for future database replacement:

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs/promises';
import path from 'path';

interface UserTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

interface TokenStore {
  users: Record<string, UserTokens>;
}

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');
const asyncLocalStorage = new AsyncLocalStorage<TokenStore>();

// Promise-wrapped read
export async function getTokenStore(): Promise<TokenStore> {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { users: {} };
  }
}

// Promise-wrapped write
export async function saveTokenStore(store: TokenStore): Promise<void> {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(store, null, 2));
}

export async function getUserTokens(userId: string): Promise<UserTokens | null> {
  const store = await getTokenStore();
  return store.users[userId] || null;
}

export async function saveUserTokens(tokens: UserTokens): Promise<void> {
  const store = await getTokenStore();
  store.users[tokens.userId] = tokens;
  await saveTokenStore(store);
}

export async function getAllUsers(): Promise<UserTokens[]> {
  const store = await getTokenStore();
  return Object.values(store.users);
}
```

## 5. Google OAuth Client Setup

**[`src/lib/google-oauth.ts`](src/lib/google-oauth.ts)**:

```typescript
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}
```

## 6. API Routes

### `/api/auth/google/route.ts` - Initiate OAuth

Redirects user to Google OAuth consent screen.

### `/api/auth/google/callback/route.ts` - Handle Callback

Exchanges authorization code for tokens, stores them via `token-storage.ts`.

### `/api/reschedule/route.ts` - CRON Endpoint (No Auth)

1. Fetches all stored users
2. For each user, gets today's events
3. Finds events named "test event"
4. Randomly shifts them +/- 15 minutes
5. Updates event description with counter (e.g., "Updated 3 times")
6. Calls Google Calendar API to update

## 7. Calendar Service

**[`src/lib/calendar-service.ts`](src/lib/calendar-service.ts)**:

- `getTodayEvents(oauth2Client)` - Fetch events for today
- `updateEvent(oauth2Client, eventId, updates)` - Update event time/description
- `getAuthenticatedClient(userId)` - Creates OAuth client with stored tokens, handles refresh

## 8. Frontend UI

**[`src/app/page.tsx`](src/app/page.tsx)**:

- "Login with Google" button (links to `/api/auth/google`)
- Display authentication status
- Show success message after OAuth callback

- Homepage detects cookie for login state

- If not logged in: show "Login with Google" button
- If logged in: fetch and display today’s events in a simple list
- Show success message after OAuth callback

## 9. Key Implementation Details

| Requirement   | Implementation                                                             |

|-------------|----------------|

| OAuth Flow    | Manual `googleapis` OAuth2 with `access_type=offline` and `prompt=consent` |

| Token Storage | JSON file with Promise-based async wrapper using `AsyncLocalStorage` context |

| Refresh Token | Handled by `googleapis` client automatically when credentials are set |

| CRON Endpoint | `/api/reschedule` - open, no auth required |

| Port | 3000 (matches Google redirect URI) |

## 10. Files to Create

1. `apps/calendar-scheduler/project.json` - Nx project config
2. `apps/calendar-scheduler/next.config.js` - Next.js config
3. `apps/calendar-scheduler/tsconfig.json` - TypeScript config
4. `apps/calendar-scheduler/.env.local` - Environment variables (template)
5. `apps/calendar-scheduler/src/lib/token-storage.ts`
6. `apps/calendar-scheduler/src/lib/google-oauth.ts`
7. `apps/calendar-scheduler/src/lib/calendar-service.ts`
8. `apps/calendar-scheduler/src/types/tokens.ts`
9. `apps/calendar-scheduler/src/app/api/auth/google/route.ts`
10. `apps/calendar-scheduler/src/app/api/auth/google/callback/route.ts`
11. `apps/calendar-scheduler/src/app/api/reschedule/route.ts`
12. `apps/calendar-scheduler/src/app/page.tsx`
13. `apps/calendar-scheduler/src/app/layout.tsx`
14. `apps/calendar-scheduler/src/app/globals.css`

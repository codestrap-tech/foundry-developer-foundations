# Calendar Scheduler

A demo calendar scheduling app that implements Google OAuth2 Authorization Code Flow to obtain Google Calendar API access and refresh tokens.

## Features

- **Google OAuth2 Authentication**: Secure login with Google using Authorization Code Flow
- **Calendar Events Display**: View today's calendar events on the homepage
- **CRON Reschedule Endpoint**: Automatically reschedule "test event" events ±15 minutes randomly
- **Token Persistence**: Store access and refresh tokens in a JSON file with promise-based abstraction

## Setup

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application type)
3. Add the authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Enable the Google Calendar API for your project
5. Configure the OAuth Consent Screen with the required scope: `https://www.googleapis.com/auth/calendar`

### 2. Environment Variables

Create a `.env.local` file in the `apps/calendar-scheduler` directory:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 3. Run the Application

```bash
# From the repository root
npx nx serve calendar-scheduler
```

The app will be available at `http://localhost:3000`.

## API Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/google` | GET | No | Initiates OAuth flow, redirects to Google |
| `/auth/google/callback` | GET | No | Handles OAuth callback from Google |
| `/api/events` | GET | Yes (cookie) | Returns today's calendar events |
| `/api/reschedule` | GET/POST | No | CRON endpoint - reschedules "test event" events |
| `/api/logout` | POST/GET | No | Clears authentication cookie |

## How It Works

### Authentication Flow

1. User clicks "Login with Google" button
2. App redirects to Google OAuth consent screen with:
   - `response_type=code`
   - `access_type=offline` (to get refresh token)
   - `prompt=consent` (to ensure refresh token is issued)
   - `scope=https://www.googleapis.com/auth/calendar`
3. User grants permission
4. Google redirects back with authorization code
5. Backend exchanges code for access and refresh tokens
6. Tokens are stored in `tokens.json` with user information
7. User is redirected to homepage with authentication cookie

### CRON Endpoint (`/api/reschedule`)

When triggered:
1. Fetches all stored users from the token store
2. For each user, gets today's calendar events
3. Finds events named "test event"
4. Randomly shifts each event ±15 minutes
5. Updates the event description with a counter (e.g., "Updated 3 times")
6. Returns a summary of processed events

## Token Storage

Tokens are stored in a JSON file (`tokens.json`) with a promise-based API that can be easily replaced with a database in the future:

```typescript
interface UserTokens {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}
```

## Project Structure

```
apps/calendar-scheduler/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/google/route.ts     # Initiates OAuth
│   │   │   ├── events/route.ts          # Get today's events
│   │   │   ├── logout/route.ts          # Clear auth
│   │   │   └── reschedule/route.ts      # CRON endpoint
│   │   ├── auth/google/callback/route.ts # OAuth callback
│   │   ├── ClientPage.tsx               # Client components
│   │   ├── page.tsx                     # Homepage (server)
│   │   └── layout.tsx                   # Root layout
│   ├── lib/
│   │   ├── calendar-service.ts          # Google Calendar API
│   │   ├── google-oauth.ts              # OAuth client setup
│   │   └── token-storage.ts             # Token persistence
│   └── types/
│       └── tokens.ts                    # Type definitions
├── tokens.json                          # Token storage (gitignored)
├── next.config.js
├── project.json
└── tsconfig.json
```

## Testing the Reschedule Feature

1. Create a calendar event named "test event" in your Google Calendar for today
2. Authenticate with the app
3. Call the reschedule endpoint: `curl http://localhost:3000/api/reschedule`
4. Check your calendar - the event should be moved ±15 minutes
5. Check the event description for the update counter


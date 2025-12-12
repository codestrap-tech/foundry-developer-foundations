# Google OAuth Calendar Demo

## Context

I need you to create a new web application under `@apps/calendar-scheduler` in the Nx monorepo. Use **Nx** to scaffold this application. The app must use **Next.js with the App Router**, since it requires both server-side and client-side functionality.

The goal is to create a **concrete implementation plan** for building this 'calendar-scheduler' app in the repository.

## Purpose

Build a simple **demo calendar scheduling app** that implements a **Google OAuth2 Authorization Code Flow** to obtain Google Calendar API access and refresh tokens for the user.

## Google OAuth Setup

* OAuth Consent Screen is already configured in Google Cloud Console.
* Required scope: `https://www.googleapis.com/auth/calendar`
* Authorized redirect URI: `http://localhost:3000/auth/google/callback`
* `CLIENT_ID` and `CLIENT_SECRET` must be loaded from environment variables.
* You must include `access_type=offline` and `prompt=consent` in the authorization URL to ensure a refresh token is issued.
* Prefer using the **googleapis** npm package for Google API communication (additional libraries may be added if helpful).

## Requirements

### 1. Authentication Flow

Implement the Google OAuth2 Authorization Code Flow:

1. User clicks **"Login with Google"**.
2. App redirects user to Google OAuth with:

   * `response_type=code`
   * `access_type=offline`
   * `prompt=consent`
   * `scope=https://www.googleapis.com/auth/calendar`
   * the configured redirect URI
3. Google redirects back to the app with a `code`.
4. The backend exchanges the `code` for:

   * `access_token`
   * `refresh_token`
5. Store the access & refresh tokens in a **JSON file**, but the storage access should be **extracted and wrapped in a Promise** to allow future async replacement (e.g., database). Use **Async Local Storage** for handling tokens.

### 2. Core App Behavior

Once the user is authenticated, the app should be able to call the Google Calendar API on the user's behalf using the stored refresh token.

### 3. Server-Side Scheduled Logic Endpoint

Create a backend route (e.g., `/api/reschedule` or `/api/cron`) with **no authorization requirement**. This endpoint will be executed externally by a CRON job.

When this endpoint is triggered:

1. Fetch the calendar events for **today** for the authenticated user(s).
2. Look for events named **"test event"** (assume this event will already exist).
3. Reschedule matching events **either 15 minutes into the future or 15 minutes back, chosen randomly, and update the event description to include a counter to track how many times this event was updated**.
4. Use the Google Calendar API to update those events.

### 4. Code Organization

* Place the application under `@apps/calendar-scheduler` in the Nx workspace.
* Use **Next.js App Router**.
* Use environment variables for secrets.
* Use the `googleapis` library for Calendar interactions.

## Additional Q&A Requirements

### Token Storage

* Store access & refresh tokens in a **JSON file**, wrapped in a **Promise-based API** using **Async Local Storage**, so it can be replaced with a DB in the future.

### Cron Endpoint Security

* The cron/reschedule endpoint should be **open (no authentication)**.

### Nx App Naming

* The Nx app should be named **`calendar-scheduler`** and live under `@apps/calendar-scheduler`.

### Auth Flow Preference

* Implement a **custom OAuth 2.0 Authorization Code flow** using `googleapis` with manual token handling.

### User Token Persistence

* Persist users and their tokens using a **custom-described storage approach** (JSON file with Async Local Storage and promise-wrapped access).

### Port Configuration

* This new app should run on **port 3000**, matching the Google redirect URI.

## Implementation Plan

Create a concrete step-by-step plan to build this 'calendar-scheduler' app in the repository, including folder structure, API routes, React components, and token management logic.

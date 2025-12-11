---
name: Meeting Conflict E2E Tests
overview: Add e2e tests for meeting conflict resolution functionality in `vickie.e2e.test.ts` with a separate describe section for meeting rescheduling success flows.
todos:
  - id: add-e2e-describe
    content: Add 'describe("meeting rescheduling", ...)' section with 4 success flow tests to vickie.e2e.test.ts
    status: pending
---

# Meeting Conflict Resolution E2E Tests

## Overview

Add a new `describe` section for meeting rescheduling e2e tests in `packages/agents/vickie-bennie/src/lib/tests/vickie.e2e.test.ts` that tests the success flow of `Vickie.resolveMeetingConflicts()`.

## Entry Points

- `Vickie.resolveMeetingConflicts()` in `packages/agents/vickie-bennie/src/lib/Vickie.ts:613-617`

## Method Signature

```typescript
resolveMeetingConflicts(
  users: string[],
  timeFrameFrom = new Date().toISOString(),      // defaults to now
  timeFrameTo = new Date(now + 24h).toISOString(), // defaults to +24h
  timezone = 'America/Los_Angeles'
): Promise<VickieResponse>
```

## Success Response

```typescript
{
  status: 200,
  executionId: string,
  message: 'Meeting conflicts resolved',
  taskList: 'SUCCESS'
}
```

## E2E Tests to Add

Add a new `describe('meeting rescheduling', ...)` section inside the existing e2e test structure with these tests:

1. **Basic success flow** - Resolve conflicts for test user with default 24h time range
2. **Custom time range** - Resolve conflicts for next 7 days (like the gsuiteClient.v3 example)

## Implementation Pattern (from gsuiteClient.v3.e2e.test.ts)

```typescript
// No mocking - real Vickie instance
const vickie = new Vickie();

// Real API calls with live environment
const result = await vickie.resolveMeetingConflicts(
  [process.env.FOUNDRY_TEST_USER],
  new Date().toISOString(),
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  'America/Los_Angeles'
);

// Flexible assertions for live data
expect(result).toEqual(
  expect.objectContaining({
    status: 200,
    executionId: expect.any(String),
    message: 'Meeting conflicts resolved',
    taskList: 'SUCCESS',
  })
);
```

## Key Points

- **No internal mocking** - tests run against real services
- Uses `process.env.FOUNDRY_TEST_USER` for test user email, default to igor@codestrap.me
- 60000ms timeout for each test (real API calls take time)
- Uses `expect.objectContaining` for flexible structure validation
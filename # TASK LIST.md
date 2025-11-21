# TASK LIST

## TASK 1: Implement Automatic Meeting Conflict Resolution Feature

1. **Client Generation:** Generate a new Google service client named `gsuiteClient.v3`. This client must be an extension of the existing `packages/services/google/src/lib/gsuiteClient.v2.ts` client to follow the CodeStrap pattern of client evolution. Similar as `packages/services/google/src/lib/gsuiteClient.v2.ts` is a extension of `packages/services/google/src/lib/gsuiteClient.ts`.
2. **New Method:** Add a public API method to `gsuiteClient.v3` for the scheduling solution, named `resolveMeetingConflicts`. This function should accept an array of user email addresses as input.
3. **Conflict Resolution Logic:** Inside `resolveMeetingConflicts`, implement the following algorithm:
    * Retrieve the calendars for all supplied email addresses using existing functions in the `google services package`.
    * Find all meetings within those calendars that are in conflict (overlapping times).
    * Implement a new **Data Access Object (DAO)** to retrieve plain-text conflict resolution rules for the user from **Foundry** to be used in the LLM. (exact API call should be mocked for now, but DAO to be implemented similar as here `packages/services/palantir/src/lib/doa/communications/communications/read.ts`. We can copy that file and modify it to pull the conflict resolution rules from Foundry.)
    * Use an LLM to process the conflicting meetings, the full daily calendar, and the plain-text user rules. Rules going to be like:
      * Prioritize Linda over John
      * Prioritize external meetings over internal meetings
    * Use LLM to generate the list of meetings to reschedule.
    * Check if the output is valid and meeting can be rescheduled.
    * If the output is valid and meeting can be rescheduled, reschedule the meetings.
    * If the output is not valid or meeting can not be rescheduled, return the error.

branch: resolve-meeting-conflicts

## TASK 2: Fix Production Bug

1. Locate the production bug related to an unawaited promise in the **`createClient`** function.
2. Add the necessary **`await`** to ensure the promise resolves before code spin-ups, which should fix the "client is not authorized" issue on hard navigation.

## TASK 3: Environment Management Preparation

1. **Close Pull Request:** Close the existing, in-progress Pull Request for environment variables to avoid conflicts with current TypeScript definitions for ENV.
2. **Design Phase:** Prepare a design for a full, consolidated, and secure environment management solution. The design must propose using an asynchronous factory method within a new, single package (`@environment/factory` pattern) to allow for seamless future integration with various secret stores (e.g., Vercel, AWS Secrets Manager) and to consolidate ENVs and prevent environment sprawl. This design must be structured for review by Chemeck.

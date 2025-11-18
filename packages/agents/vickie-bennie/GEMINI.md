# Project Overview

This project contains a set of AI agents built with TypeScript and Node.js. The agents are:

*   **Vickie**: An AI executive assistant that can handle tasks like scheduling meetings and managing email threads.
*   **Bennie**: An AI sales assistant that can manage RFP (Request for Proposal) workflows.
*   **Larry**: An AI coding assistant that helps with coding tasks related to Google services.

The agents are built on a common base class, `Text2Action`, which provides core functionalities for creating task lists, managing state machines, and interacting with Google's Gemini models. The project uses dependency injection with `inversify` and state management with `xstate`. It also integrates with Palantir Foundry.

# Building and Running

## Building the library

To build the library, run the following command:

```bash
nx build agents-vickie-bennie
```

## Running unit tests

To run the unit tests, use the following command:

```bash
nx test agents-vickie-bennie
```

## Running e2e tests

To run a specific e2e test file, use the following command:

```bash
E2E=true nx run agents-vickie-bennie:test --testFile=<test-file-name>.e2e.test.ts
```

For example:

```bash
E2E=true nx run agents-vickie-bennie:test --testFile=researchAssistant.e2e.test.ts
```

## Building a Docker image

To build a Docker image for the project, follow these steps:

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Build the `vickie-bennie` image:
    ```bash
    nx run agents-vickie-bennie:build
    ```
3.  Build the Docker image:
    ```bash
    docker build -t vickie-bennie:latest -f packages/agents/vickie-bennie/Dockerfile .
    ```

# Development Conventions

*   The project uses TypeScript for static typing.
*   Testing is done with Jest.
*   The project follows the Nx monorepo structure.
*   Dependency injection is managed by `inversify`.
*   State management is handled by `xstate`.
*   The agents use Google's Gemini models for natural language understanding and generation.
*   The project is integrated with Palantir Foundry.
*   Tracing is implemented using `@codestrap/developer-foundations.foundry-tracing-foundations`.

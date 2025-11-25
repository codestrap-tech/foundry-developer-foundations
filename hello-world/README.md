# Hello World

## Introduction

This hello world example application is a reference implementation of the **Foundry‑backed / GitHub‑native** collaboration pattern created by CodeStrap, LLC.
The goal: let any JavaScript / TypeScript engineer contribute business logic to a Palantir Foundry deployment **without needing direct Foundry expertise or access**.

## Getting Started

1. First download and install the [Hello World](https://drive.google.com/file/d/1haBL6bv1Cy8BRiKt7tqzDL2dsQe5Q2yq/view?usp=sharing) Marketplace application on your Foundry stack. We are working on mocks for Foundry but have not published them yet. Once the mocks are done you no longer will require a Foundry stack.
1. Run `npm install`
1. Create a `.env` file and set the following values

```
FOUNDRY_STACK_URL=<your stack url>
OSDK_CLIENT_SECRET=<your osdk client secret>
OSDK_CLIENT_ID=<your osdk client id>
OPEN_WEATHER_API_KEY=<an open wheahter API key https://home.openweathermap.org/>
LOG_PREFIX=foundry-developer-foundations-hello-world
ONTOLOGY_RID=<your ontology rid>
```

1. Update the code in `src/domain/worldDao.ts` replacing `${client.ontologyRid}` with your ID. You can find the ID in the OSDK documentation.
1. Run `npm run build` to verify you can build
1. Run `npm run lint` to verify your eslint setup
1. Run `npm run test` to test the code e2e
1. Run `npm run docker:build` to build the docker container
1. Create a compute module and follow the instructions to deploy your docker container. Update the content of `buildAndPublish.sh` with your deploy commands from the compute module dashboard in Foundry.

The rest of the README walks through the folder structure, DI wiring, Compute Module registration, and the build/deploy steps so you can copy‑paste the pattern into your own project and start shipping today.

## The Foundry Implementations

This pattern assumes you have created the OSDK app using the linked Marketplace installer above. The installer creates the following function in Foundry and published it in the included third party application:

```typescript
import {
  Function as Fn,
  OntologyEditFunction,
  Edits,
  String as FString,
  FunctionsMap,
} from '@foundry/functions-api';
import { Objects, World } from '@foundry/ontology-api';
// You will have to install foundry-tracing-foundations, otherwise delete it
import { Trace } from 'foundry-tracing-foundations';
import { Uuid } from '@foundry/functions-utils';

export class HelloWorldFunction {
  @Edits(World)
  @OntologyEditFunction()
  @Trace({
    resource: {
      service_name: 'hello-service',
      service_instance_id: 'prod',
    },
    operationName: 'helloWorld',
  })
  public async execute(parameters: { message: FString }): Promise<void> {
    const world = Objects.create().world(Uuid.random());
    world.greeting = parameters.message;
  }
}
```

This function is invoked by `src/domain/worldDao.ts` using a fetch API request to avoid introducing the SDK as a dependency. This ensures developers without access to a Foundry stack can contribute to the code.

## Directory layout

```
foundry-developer-foundations/
├─ .env
├─ .npmrc
├─ Dockerfile
├─ buildAndPublish.sh
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ writeGreeting.ts
   ├─ domain/
   │  └─ worldDao.ts
   │  └─ userDao.ts
   ├─ services/
   │  ├─ foundryClient.ts
   │  └─ weatherService.ts
   ├─ inversify.config.ts
   ├─ types.ts
```

### DAO contract `src/domain/worldDao.ts`

```ts
import type { FoundryClient, WorldDao } from '@hello/types';

export function makeWorldDao(client: FoundryClient): WorldDao {
  return async ({ message, userId }) => {
    console.log(`makeWorldDao userId: ${userId}`);

    const token = await client.auth.signIn();
    const apiKey = token.access_token;

    const url = `${client.url}/api/v2/ontologies/${client.ontologyRid}/actions/say-hello/apply`;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = JSON.stringify({
      parameters: {
        message,
      },
      options: {
        returnEdits: 'ALL',
      },
    });

    const apiResult = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    const result = (await apiResult.json()) as any;

    if (!result.edits || result.edits.edits.length === 0) {
      throw new Error('Failed to add hello message to the ontolgoy.');
    }

    console.log(`create world action returned: ${result?.edits?.edits?.[0]}`);

    const worldId = result.edits.edits[0].primaryKey as string;

    const getUrl = `${client.url}/api/v2/ontologies/${client.ontologyRid}/objects/World/${worldId}`;
    const worldFetchResults = await fetch(getUrl, {
      method: 'GET',
      headers: headers,
    });

    const world = (await worldFetchResults.json()) as any;
    console.log(`the world ontology returned: ${JSON.stringify(world)}`);

    return { id: 'singleton', greeting: world.message };
  };
}
```

---

### DAO contract `src/domain/userDao.ts`

```ts
import type { FoundryClient, UserDao } from '@hello/types';

export function makeUserDao(client: FoundryClient): UserDao {
  return async () => {
    const user = await client.getUser();
    console.log('OSDK makeUserDao returned:', user);

    return user;
  };
}
```

---

### Foundry client `src/services/foundryClient.ts`

```ts
import { createConfidentialOauthClient } from '@osdk/oauth';
import { createClient } from '@osdk/client';
import { User, Users } from '@osdk/foundry.admin';
import { FoundryClient } from '@hello/types';

export function createFoundryClient(): FoundryClient {
  // log ENV vars
  console.log('Environment variable keys:');
  Object.keys(process.env).forEach((key) => {
    if (key.indexOf('FOUNDRY') >= 0 || key.indexOf('OSDK') >= 0) {
      console.log(`- ${key}`);
    }
  });

  if (!process.env.OSDK_CLIENT_ID || !process.env.OSDK_CLIENT_SECRET) {
    throw new Error('missing required env vars');
  }

  // setup the OSDK
  const clientId: string = process.env.OSDK_CLIENT_ID;
  const url: string = process.env.FOUNDRY_STACK_URL;
  const ontologyRid: string = process.env.ONTOLOGY_RID;
  const clientSecret: string = process.env.OSDK_CLIENT_SECRET;
  const scopes: string[] = [
    'api:ontologies-read',
    'api:ontologies-write',
    'api:admin-read',
    'api:connectivity-read',
    'api:connectivity-write',
    'api:connectivity-execute',
    'api:mediasets-read',
    'api:mediasets-write',
  ];

  const auth = createConfidentialOauthClient(
    clientId,
    clientSecret,
    url,
    scopes,
  );
  const client = createClient(url, ontologyRid, auth);
  const getUser = async () => {
    const user: User = await Users.getCurrent(client);

    return user;
  };

  return { auth, ontologyRid, url, client, getUser };
}
```

---

### Weather service `src/services/weatherService.ts`

```ts
import { WeatherService } from '@hello/types';

export const openWeatherService: WeatherService = async (city) => {
  const key = process.env.OPEN_WEATHER_API_KEY!;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city,
    )}&appid=${key}&units=metric`,
  );
  const result = (await res.json()) as {
    weather: { description: string }[];
    main: { temp: string };
  };
  return `${result.weather[0].description}, ${result.main.temp} °C`;
};
```

---

### Type & DI tokens `src/types.ts`

```ts
import { ComputeModule } from '@palantir/compute-module';
import type { Client } from '@osdk/client';

export const TYPES = {
  FoundryClient: Symbol.for('FoundryClient'),
  WeatherService: Symbol.for('WeatherService'),
  WorldDao: Symbol.for('WorldDao'),
  UserDao: Symbol.for('UserDao'),
};

export interface Token {
  readonly access_token: string;
  readonly expires_in: number;
  readonly refresh_token?: string;
  readonly expires_at: number;
}

export interface BaseOauthClient {
  (): Promise<string>;
  getTokenOrUndefined: () => string | undefined;
  signIn: () => Promise<Token>;
  signOut: () => Promise<void>;
}

export interface FoundryClient {
  client: Client;
  auth: BaseOauthClient;
}

// Basic example of calling other services besides Foundry.
export interface WeatherService {
  (city: string): Promise<string>;
}

export interface APIError extends Error {
  response?: {
    data: any;
  };
}

export interface ModuleConfig {
  isTest?: boolean;
}

export interface TestModule {
  listeners: Record<string, any>;
  on(event: string, handler: Function): TestModule;
  register(operation: string, handler: Function): TestModule;
}

export type ComputeModuleType = TestModule | ComputeModule<any>;

export interface GreetingInput {
  message: string;
  userId: string;
}

export interface GreetingResult {
  id: string;
  greeting: string;
}

export interface User {
  id: string;
  username: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  organization?: string;
  attributes: Record<string, any>;
}

export type WorldDao = (input: GreetingInput) => Promise<GreetingResult>;
export type UserDao = () => Promise<User>;
```

---

### Inversify config `src/inversify.config.ts`

```ts
import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '@hello/types';
import { openWeatherService } from '@hello/services/weatherService';
import { createFoundryClient } from '@hello/services/foundryClient';
import { makeWorldDao } from '@hello/domain/worldDao';
import { makeUserDao } from '@hello/domain/userDao';

export const container = new Container();

container
  .bind(TYPES.FoundryClient)
  .toDynamicValue(createFoundryClient)
  .inSingletonScope();

container
  .bind(TYPES.WorldDao)
  .toDynamicValue((ctx) => makeWorldDao(ctx.get(TYPES.FoundryClient)));

container
  .bind(TYPES.UserDao)
  .toDynamicValue((ctx) => makeUserDao(ctx.get(TYPES.FoundryClient)));

container.bind(TYPES.WeatherService).toConstantValue(openWeatherService);
```

---

### Application service `src/writeGreeting.ts`

```ts
import { TYPES, WeatherService, UserDao } from '@hello/types';
import { container } from '@hello/inversify.config';

export async function writeGreeting(city: string): Promise<string> {
  // example of consuming an vanilla service
  const getWeather = container.get<WeatherService>(TYPES.WeatherService);
  const weather = await getWeather(city);

  // example dao usage
  const user = await container.get<UserDao>(TYPES.UserDao)();

  return `weather: ${weather}\nuser: ${user}`;
}
```

---

### Compute Module `src/index.ts`

```ts
import { ComputeModule } from '@palantir/compute-module';
import { Type } from '@sinclair/typebox';
import { writeGreeting } from './writeGreeting';
import dotenv from 'dotenv';
import { ComputeModuleType, ModuleConfig } from './types';

dotenv.config();

const Schemas = {
  WriteGreeting: {
    input: Type.Object({ city: Type.String() }),
    output: Type.Object({ status: Type.Literal('ok') }),
  },
};

// Unified configuration for all environments
function getModuleConfig(): ModuleConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'test':
      return { isTest: true };
    default: // development
      return { isTest: false };
  }
}

function createComputeModule(): ComputeModuleType {
  const config = getModuleConfig();

  if (config.isTest) {
    const mockModule = {
      listeners: {} as Record<string, any>,
      on: function (event: string, handler: Function) {
        this.listeners[event] = handler;
        handler();
        return this;
      },
      register: function (operation: string, handler: Function) {
        this.listeners[operation] = { type: 'response', listener: handler };
        return this;
      },
    };
    console.log('returning mock module');
    return mockModule;
  }

  const module = new ComputeModule({
    logger: console,
    sources: {},
    definitions: { WriteGreeting: Schemas.WriteGreeting },
  })
    .register('WriteGreeting', async ({ city }) => {
      await writeGreeting(city);
      return { status: 'ok' };
    })
    .on('responsive', () => console.log('Yellow‑World ready'));

  module.on('responsive', () => {
    console.log(`${process.env.LOG_PREFIX} Module is now responsive`);
  });

  return module;
}

const computeModule = createComputeModule();

export { computeModule };
```

---

### Try it locally

```bash
npm run ops:greet "Laguna Niguel"
```

---

## Pattern Recap

1. Foundry interactions isolated in **DAOs** under the `domain` directory.
2. Services injected with **Inversify** (no classes required).
3. Compute Module wires schemas → operations.
4. GitHub is the source‑of‑truth; Foundry provides the persistent data store and actions via the OSDK and Ontology.

---

## Building & Deploying as a Foundry Compute Module

### Dockerfile `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=20.10.0
FROM --platform=amd64 node:${NODE_VERSION}-alpine

ARG FOUNDRY_TOKEN=undefined

ENV FOUNDRY_TOKEN=$FOUNDRY_TOKEN

WORKDIR /app

# Copy package files
COPY package*.json /app/

# Install all dependencies for building
RUN npm ci

# Copy source files
COPY tsconfig.build.json /app/
COPY src/ /app/src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm ci --only=production

# Create a non-root numeric user (must be numeric for compute modules)
RUN adduser --uid 5001 --disabled-password --gecos "" user && \
    chown -R 5001:5001 /app

USER 5001

# Environment setup
ENV NODE_ENV=production

# Verify directory structure
RUN ls -la /app/src/domain && \
    ls -la /app/src/services

# Specify the entrypoint explicitly as required
ENTRYPOINT ["node", "dist/src/index.js"]
```

### Deploy script `buildAndPublish.sh` (notional)

```bash
#!/bin/zsh

docker build --platform linux/amd64 -t baryte-container-registry.palantirfoundry.com/gsuite-functions:1.0.20 .

export REPOSITORY=ri.artifacts.main.repository.3631f5ce-882c-4f9f-a61e-aae2263437f0
export TOKEN=$FOUNDRY_TOKEN
docker login -u "$REPOSITORY" -p "$TOKEN" baryte-container-registry.palantirfoundry.com
docker push baryte-container-registry.palantirfoundry.com/gsuite-functions:1.0.20
```

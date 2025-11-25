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
  auth: BaseOauthClient;
  ontologyRid: string;
  url: string;
  client: Client;
  getUser: () => Promise<User>;
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

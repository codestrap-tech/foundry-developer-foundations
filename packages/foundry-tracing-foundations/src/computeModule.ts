import { ComputeModule } from '@palantir/compute-module';
// Schema Definitions for compute module
// IMPORTANT:  @sinclair/typebox is required!!!
// https://github.com/palantir/typescript-compute-module?tab=readme-ov-file#schema-registration
import { Type } from '@sinclair/typebox';
import dotenv from 'dotenv';

import { collectTelemetryFetchWrapper } from './Tracing';
import {
  ComputeModuleType,
  ModuleConfig,
} from '@codestrap/developer-foundations-types';

dotenv.config();

const Schemas = {
  Trace: {
    input: Type.Object({ inputJSON: Type.String() }),
    output: Type.String(),
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
    definitions: { Trace: Schemas.Trace },
  })
    .register('Trace', async ({ inputJSON }) => {
      const result = await collectTelemetryFetchWrapper(inputJSON);
      return result;
    })
    .on('responsive', () =>
      console.log('Foundry Tracing Foundations is ready'),
    );

  module.on('responsive', () => {
    console.log(`${process.env.LOG_PREFIX} Module is now responsive`);
  });

  return module;
}

const computeModule = createComputeModule();

export { computeModule };

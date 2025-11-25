import { ComputeModule } from '@palantir/compute-module';
// Schema Definitions for compute module
// IMPORTANT:  @sinclair/typebox is required!!!
// https://github.com/palantir/typescript-compute-module?tab=readme-ov-file#schema-registration
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

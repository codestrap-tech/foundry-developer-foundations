/**
 * Generic Factory Template
 * ------------------------
 * This template defines a curried factory function that can be used to construct
 * configurable objects or modules dynamically based on a provided key.
 *
 * Each entry in the `providers` map corresponds to a specific implementation
 * (e.g., domain, subsystem, or engine). The factory ensures that only supported
 * keys can be instantiated and provides strong typing around the expected shape
 * of each module.
 */

import { curry } from 'ramda';

/**
 * Example: Enumeration of all supported modules.
 * This ensures that callers cannot pass arbitrary strings.
 */
export enum SupportedModules {
  MODULE_ALPHA = 'moduleAlpha',
  MODULE_BETA = 'moduleBeta',
  MODULE_GAMMA = 'moduleGamma',
}

/**
 * Defines the structure of a single module implementation.
 * You can replace the function signatures below with whatever
 * components your modules expose (e.g., services, actions, handlers).
 */
export interface ModuleInterface {
  initialize: (config: Record<string, unknown>) => void;
  execute: (...args: unknown[]) => unknown;
  shutdown?: () => void;
}

/**
 * Generic type for the function that builds a module instance
 * based on the provided configuration.
 */
export type ModuleFactory<T> = (config: Record<string, unknown>) => T;

/**
 * A map from supported module identifiers to their builders.
 * Extend this record as new modules are added.
 */
export const moduleRegistry: Record<SupportedModules, ModuleFactory<ModuleInterface>> = {
  [SupportedModules.MODULE_ALPHA]: (config) => ({
    initialize: () => console.log('Initializing Alpha with', config),
    execute: () => 'Alpha executed',
  }),
  [SupportedModules.MODULE_BETA]: (config) => ({
    initialize: () => console.log('Initializing Beta with', config),
    execute: () => 'Beta executed',
  }),
  [SupportedModules.MODULE_GAMMA]: (config) => ({
    initialize: () => console.log('Initializing Gamma with', config),
    execute: () => 'Gamma executed',
  }),
};

/**
 * Core curried factory function.
 *
 * Notes:
 * - We use `curry` from Ramda to enable partial application:
 *     const buildModule = factory(moduleRegistry);
 *     const alpha = buildModule(SupportedModules.MODULE_ALPHA, { ... });
 *
 * - Variadic generics (e.g., <T, Args extends any[]>) are not supported:
 *   https://github.com/microsoft/TypeScript/issues/5453
 *   We still retain the generic type parameter <T> for potential downstream narrowing.
 */
export const factory = curry(
  <T>(
    map: Record<string, (config: Record<string, unknown>) => unknown>,
    key: string,
    config: Record<string, unknown>
  ): T => {
    const supported = Object.values(SupportedModules);
    if (!supported.includes(key as SupportedModules)) {
      throw new Error(`Unsupported module key: ${key}`);
    }

    return map[key](config) as T;
  }
);

/**
 * Example: Create a factory bound to your registry
 * ------------------------------------------------
 * Consumers can import this and call:
 *   const createModule = buildModuleFactory();
 *   const alpha = createModule(SupportedModules.MODULE_ALPHA)({ some: 'config' });
 */
export const buildModuleFactory = () =>
  factory(moduleRegistry) as (key: SupportedModules) => ModuleFactory<ModuleInterface>;

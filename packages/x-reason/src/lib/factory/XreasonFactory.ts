import { curry } from 'ramda';

import {
  comsProgrammer,
  comsAiTrasition,
  comsEvaluate,
  comsFunctionCatalog,
  comsSolver,
  contextAiTrasition,
  contextEvaluate,
  contextFunctionCatalog,
  contextProgrammer,
  contextSolver,
  salesProgrammer,
  salesAiTrasition,
  salesEvaluate,
  salesFunctionCatalog,
  salesSolver,
  googleServicesSolver,
  googleServicesProgrammer,
  googleServicesAiTransition,
  googleServicesEvaluate,
  googleServicesFunctionCatalog,
} from '../reasoning';
import { ActionType, Task, SupportedEngines } from '@codestrap/developer-foundations-types';

// Define the shape of the clients map
export type XReasonEngine = (config: Record<string, any>) => {
  programmer: typeof comsProgrammer;
  aiTransition: typeof comsAiTrasition;
  evaluate: typeof comsEvaluate;
  functionCatalog: (dispatch: ((action: ActionType) => void) | ((action: ActionType) => Promise<void>)) => Map<string, Task>,
  solver: typeof comsSolver;
};


export enum SupportTrainingDataTypes {
  SOLVER = 'solver',
  PROGRAMMER = 'programmer',
}

// in your factor injectionb factory
const factory = curry((map, key, config) => {
  const supportedKeys = Object.keys(SupportedEngines).map((item) =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    SupportedEngines[item]
  );

  if (!supportedKeys.includes(key)) {
    throw new Error('unsupported key ${key}');
  }

  return map[key](config);
});

// in your config
const clients = {
  googleServicesCodeAssist: (config: Record<string, any>) => {
    console.log(`config for comms xreason is: ${config}`);

    return {
      programmer: googleServicesProgrammer,
      aiTransition: googleServicesAiTransition,
      evaluate: googleServicesEvaluate,
      functionCatalog: googleServicesFunctionCatalog,
      solver: googleServicesSolver,
    };
  },
  coms: (config: Record<string, any>) => {
    console.log(`config for comms xreason is: ${config}`);

    return {
      programmer: comsProgrammer,
      aiTransition: comsAiTrasition,
      evaluate: comsEvaluate,
      functionCatalog: comsFunctionCatalog,
      solver: comsSolver,
    };
  },
  context: (config: Record<string, any>) => {
    console.log(`config for context xreason is: ${config}`);

    return {
      programmer: contextProgrammer,
      aiTransition: contextAiTrasition,
      evaluate: contextEvaluate,
      functionCatalog: contextFunctionCatalog,
      solver: contextSolver,
    };
  },
  sales: (config: Record<string, any>) => {
    console.log(`config for sales xreason is: ${config}`);

    return {
      programmer: salesProgrammer,
      aiTransition: salesAiTrasition,
      evaluate: salesEvaluate,
      functionCatalog: salesFunctionCatalog,
      solver: salesSolver,
    };
  },
  // TODO add more implementations
};

export default factory(clients) as (key: SupportedEngines) => XReasonEngine;

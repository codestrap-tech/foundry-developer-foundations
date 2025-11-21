import { default as factory } from './XreasonFactory';
import { SupportedEngines } from '@codestrap/developer-foundations-types';
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
} from '../reasoning';

describe('Factory Function Tests', () => {
  it("should return the correct engine implementation for 'coms'", () => {
    const engine = factory(SupportedEngines.COMS)({});

    // Validate the structure of the returned object
    expect(engine).toHaveProperty('programmer', comsProgrammer);
    expect(engine).toHaveProperty('aiTransition', comsAiTrasition);
    expect(engine).toHaveProperty('evaluate', comsEvaluate);
    expect(engine).toHaveProperty('functionCatalog', comsFunctionCatalog);
    expect(engine).toHaveProperty('solver', comsSolver);
  });

  it("should return the correct engine implementation for 'context'", () => {
    const engine = factory(SupportedEngines.CONTEXT)({});

    // Validate the structure of the returned object
    expect(engine).toHaveProperty('programmer', contextProgrammer);
    expect(engine).toHaveProperty('aiTransition', contextAiTrasition);
    expect(engine).toHaveProperty('evaluate', contextEvaluate);
    expect(engine).toHaveProperty('functionCatalog', contextFunctionCatalog);
    expect(engine).toHaveProperty('solver', contextSolver);
  });

  it("should return the correct engine implementation for 'sales'", () => {
    const engine = factory(SupportedEngines.SALES)({});

    // Validate the structure of the returned object
    expect(engine).toHaveProperty('programmer', salesProgrammer);
    expect(engine).toHaveProperty('aiTransition', salesAiTrasition);
    expect(engine).toHaveProperty('evaluate', salesEvaluate);
    expect(engine).toHaveProperty('functionCatalog', salesFunctionCatalog);
    expect(engine).toHaveProperty('solver', salesSolver);
  });

  it('should throw an error if an unsupported engine is provided', () => {
    const invalidKey = 'invalid_engine' as SupportedEngines;

    // Wrap the call in a function to test errors
    expect(() => factory(invalidKey)({})).toThrowError();
  });
});

/**
 * Tests for nextStateContextBuilder.ts
 * 
 * Tests the 4 core scenarios for building context updates when clicking Proceed:
 * 1. specReview + dirty (modified content)
 * 2. specReview + clean (no modifications)
 * 3. architectureReview + dirty (modified content)
 * 4. architectureReview + clean (no modifications)
 */

import {
  buildContextUpdate,
  type ContextUpdateResult,
} from '../nextStateContextBuilder';

describe('buildContextUpdate - Proceed payload scenarios', () => {
  /**
   * Scenario 1: specReview with modifications (isDirty=true)
   * Expected: approved=false (user made changes, needs re-review)
   * Expected message: "I have reviewed and modified the specification. Please proceed."
   */
  it('should build correct payload for specReview + dirty', () => {
    const stateData = {
      messages: [{ system: 'Review required' }],
    };

    const result: ContextUpdateResult = buildContextUpdate(
      true,  // isDirty
      'specReview|123',
      stateData
    );

    expect(result).toEqual({
      approved: false,
      messages: [
        {
          system: 'Review required',
          user: 'I have reviewed and modified the specification. Please proceed.',
        },
      ],
    });
  });

  /**
   * Scenario 2: specReview without modifications (isDirty=false)
   * Expected: approved=true (user approved without changes)
   * Expected message: "Looks good, approved."
   */
  it('should build correct payload for specReview + clean', () => {
    const stateData = {
      messages: [{ system: 'Review required' }],
    };

    const result: ContextUpdateResult = buildContextUpdate(
      false,  // isDirty
      'specReview|123',
      stateData
    );

    expect(result).toEqual({
      approved: true,
      messages: [
        {
          system: 'Review required',
          user: 'Looks good, approved.',
        },
      ],
    });
  });

  /**
   * Scenario 3: architectureReview with modifications (isDirty=true)
   * Expected: approved=false (user made changes to architecture)
   * Expected message: "I have reviewed and modified the proposed code changes, please apply my comments."
   */
  it('should build correct payload for architectureReview + dirty', () => {
    const stateData = {
      messages: [{ system: 'Review required' }],
    };

    const result: ContextUpdateResult = buildContextUpdate(
      true,  // isDirty
      'architectureReview|123',
      stateData
    );


    expect(result).toEqual({
        approved: false,
        messages: [
          {
            system: 'Review required',
            user: 'I have reviewed and modified the proposed code changes, please apply my comments.',
          },
        ],
      });
  });

  /**
   * Scenario 4: architectureReview without modifications (isDirty=false)
   * Expected: approved=true (user approved without changes)
   * Expected message: "Looks good, approved."
   */
  it('should build correct payload for architectureReview + clean', () => {
    const stateData = {
      messages: [{ system: 'Review required' }],
    };

    const result: ContextUpdateResult = buildContextUpdate(
      false,  // isDirty
      'architectureReview|123',
      stateData
    );

    expect(result).toEqual({
      approved: true,
      messages: [
        {
          system: 'Review required',
          user: 'Looks good, approved.',
        },
      ],
    });
  });

  /**
   * Scenario 5: confirmUserIntent with modifications (isDirty=true)
   * Expected: approve undefined, userAnswered: true
   * Expected message: "Answered, continue."
   */
  it('should build correct payload for confirmUserIntent + dirty', () => {
    const stateData = {
      messages: [{ system: 'Review required' }],
    };

    const result: ContextUpdateResult = buildContextUpdate(
      true,  // isDirty
      'confirmUserIntent|123',
      stateData
    );

    expect(result).toEqual({
      userAnswered: true,
      messages: [
        {
          system: 'Review required',
          user: 'Answered, continue.',
        },
      ],
    });
  });
});

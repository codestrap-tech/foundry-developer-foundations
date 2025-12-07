export interface StateMessage {
  system?: string;
  user?: string;
}

export interface ContextUpdateResult {
  approved: boolean;
  messages: StateMessage[];
}

/**
 * Builds the context update for proceeding to next state
 * 
 * Handles two review types with different messaging:
 * 
 * **specReview** (specification review):
 * - If dirty: approved=false, message="I have reviewed and modified the specification. Please proceed."
 * - If clean: approved=true, message="Looks good, approved."
 * 
 * **architectureReview** (architecture/code review):
 * - If dirty: approved=false, message="I have reviewed and modified the proposed code changes, please apply my comments."
 * - If clean: approved=true, message="Looks good, approved."
 * 
 * @param isDirty - Whether the content has been modified since initialization
 * @param fullStateKey - Current state key (e.g., "specReview|123" or "architectureReview|456")
 * @param stateData - Current state data from machine context
 * @returns Context update with approved status and updated messages array
 * 
 * @example
 * ```typescript
 * // specReview with modifications
 * const result = buildContextUpdate(
 *   true,  // content was modified
 *   'specReview|123',
 *   { messages: [{ system: 'Review required' }] }
 * );
 * // => { approved: false, messages: [{ system: 'Review required', user: 'I have reviewed and modified the specification. Please proceed.' }] }
 * 
 * // architectureReview with modifications
 * const result = buildContextUpdate(
 *   true,  // content was modified
 *   'architectureReview|456',
 *   { messages: [{ system: 'Review required' }] }
 * );
 * // => { approved: false, messages: [{ system: 'Review required', user: 'I have reviewed and modified the proposed code changes, please apply my comments.' }] }
 * ```
 */
export function buildContextUpdate(
  isDirty: boolean,
  fullStateKey: string,
  stateData: Record<string, any> | undefined
): ContextUpdateResult {
  // Determine user message based on state type and dirty status
  let userMessage = '';
  
  if (isDirty) {
    const isSpecReview = fullStateKey?.includes('specReview');
    const isArchitectureReview = fullStateKey?.includes('architectureReview');
    
    if (isArchitectureReview) {
      userMessage = 'I have reviewed and modified the proposed code changes, please apply my comments.';
    } else if (isSpecReview) {
      userMessage = 'I have reviewed and modified the specification. Please proceed.';
    }
  } else {
    userMessage = 'Looks good, approved.';
  }

  // Copy messages array and find last message without user response
  const messages: StateMessage[] = stateData?.messages ? [...stateData.messages] : [];
  const lastMessage = messages
    .slice()
    .reverse()
    .find((item) => item.user === undefined);
  
  // Add user response to the last unanswered message
  if (lastMessage) {
    lastMessage.user = userMessage;
  }

  const isApproved = isDirty ? false : true;

  return {
    approved: isApproved,
    messages
  };
}

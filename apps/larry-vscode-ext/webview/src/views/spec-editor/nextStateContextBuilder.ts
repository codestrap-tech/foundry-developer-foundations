export interface StateMessage {
  system?: string;
  user?: string;
}

export interface ContextUpdateResult {
  approved?: boolean;
  userAnswered?: boolean;
  messages: StateMessage[];
}

/**
 * Builds the context update for proceeding to next state
 * 
 * Handles three state types with different messaging and response formats:
 * 
 * **specReview** (specification review):
 * - If dirty: approved=false, message="I have reviewed and modified the specification. Please proceed."
 * - If clean: approved=true, message="Looks good, approved."
 * 
 * **architectureReview** (architecture/code review):
 * - If dirty: approved=false, message="I have reviewed and modified the proposed code changes, please apply my comments."
 * - If clean: approved=true, message="Looks good, approved."
 * 
 * **confirmUserIntent** (user confirmation):
 * - If dirty: userAnswered=true, message="Answered, continue."
 * - If clean: no userAnswered property, message="Looks good, approved."
 * 
 * @param isDirty - Whether the content has been modified since initialization
 * @param fullStateKey - Current state key (e.g., "specReview|123", "architectureReview|456", or "confirmUserIntent|789")
 * @param stateData - Current state data from machine context
 * @returns Context update with approved/userAnswered status and updated messages array
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
 * // confirmUserIntent with modifications
 * const result = buildContextUpdate(
 *   true,  // content was modified
 *   'confirmUserIntent|789',
 *   { messages: [{ system: 'Review required' }] }
 * );
 * // => { userAnswered: true, messages: [{ system: 'Review required', user: 'Answered, continue.' }] }
 * ```
 */
export function buildContextUpdate(
  isDirty: boolean,
  fullStateKey: string,
  stateData: Record<string, any> | undefined
): ContextUpdateResult {
  // Determine user message based on state type and dirty status
  let userMessage = '';
  const isSpecReview = fullStateKey?.includes('specReview');
  const isArchitectureReview = fullStateKey?.includes('architectureReview');
  const isConfirmUserIntent = fullStateKey?.includes('confirmUserIntent');
  
  if (isDirty) {
    if (isArchitectureReview) {
      userMessage = 'I have reviewed and modified the proposed code changes, please apply my comments.';
    } else if (isSpecReview) {
      userMessage = 'I have reviewed and modified the specification. Please proceed.';
    } else if (isConfirmUserIntent) {
      userMessage = 'Answered, continue.';
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

  const result: ContextUpdateResult = {
    messages
  };

  if (isConfirmUserIntent) {
    if (isDirty) {
      result.userAnswered = true;
    }
  } else {
    result.approved = isDirty ? false : true;
  }

  return result;
}

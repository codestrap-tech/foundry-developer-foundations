/* JSX */
/* @jsxImportSource preact */
import { useState, useEffect, useRef } from "preact/hooks";
import { MachineResponse, MachineStatus, FetchNextStateFn, StateComponentProps } from "../../lib/backend-types";
import { ConfirmUserIntent2 } from "./states/ConfirmUserIntent2.tsx";
import { ChevronRight, RotateCcw } from "lucide-preact";
import { ChevronDown } from "lucide-preact";
import { useExtensionStore } from "../../store/store";
import { SpecReview2 } from "./states/SpecReview2.tsx";
import { useNextMachineState } from "../../hooks/useNextState.ts";
import { ArchitectureReview2 } from "./states/ArchitectureReview/ArchitectureReview2.tsx";
import { GeneralMessageBubble } from "./GeneralMessageBubble.tsx";
import { CodeReview2 } from "./states/CodeReview2.tsx";
import { GenerateEditMachine } from "./states/generateEditMachine.tsx";
import { LarryUpdateEvent, useLarryStream } from "../../hooks/useLarryStream.ts";
import WorkingIndicator from "./WorkingIndicator.tsx";

// ============================================================================
// State Component Registry
// ============================================================================

const SearchDocumentation = () => <div></div>;
const ApplyEdits = () => <div>Applied code changes...</div>;

/**
 * Registry of state components - each handles its own approve/reject/feedback logic
 */
const stateComponentMap: Record<string, React.ComponentType<StateComponentProps>> = {
  specReview: SpecReview2,
  confirmUserIntent: ConfirmUserIntent2,
  architectImplementation: ConfirmUserIntent2,
  architectureReview: ArchitectureReview2,
  searchDocumentation: SearchDocumentation,
  generateEditMachine: GenerateEditMachine,
  applyEdits: ApplyEdits,
  codeReview: CodeReview2,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses a state key into its components
 * Example: "specReview|abc123|prev-1" -> { stateName: "specReview", stateId: "abc123", isPrevious: true, previousNumber: "1" }
 */
function parseStateKey(stateKey: string) {
  const parts = stateKey.split('|');
  const stateName = parts[0];
  const stateId = parts[1];
  const isPrevious = parts.length > 2 && parts[2].startsWith('prev-');
  const previousNumber = isPrevious ? parts[2].replace('prev-', '') : null;
  return { stateName, stateId, isPrevious, previousNumber };
}

/**
 * Deduplicates the state stack, marking previous occurrences
 */
function getDeduplicatedStack(stack: string[] | undefined): string[] {
  if (!stack) return [];
  
  const processedStack: string[] = [];
  
  // First pass: count total occurrences
  const stateOccurrences = new Map<string, number>();
  for (const stateKey of stack) {
    const count = stateOccurrences.get(stateKey) || 0;
    stateOccurrences.set(stateKey, count + 1);
  }
  
  const seenStates = new Map<string, number>();
  
  for (const stateKey of stack) {
    const seenCount = seenStates.get(stateKey) || 0;
    const totalOccurrences = stateOccurrences.get(stateKey) || 0;
    seenStates.set(stateKey, seenCount + 1);
    
    // Check if this is the last occurrence of this state
    const isLastOccurrence = seenCount + 1 === totalOccurrences;
    
    if (!isLastOccurrence) {
      processedStack.push(`${stateKey}|prev-${seenCount + 1}`);
    } else {
      processedStack.push(stateKey);
    }
  }
  
  return processedStack;
}

// ============================================================================
// Main Component
// ============================================================================

interface StateVisualization2Props {
  data: MachineResponse;
}

export function StateVisualization2({ data }: StateVisualization2Props) {
  const { apiUrl, isGlobalWorking } = useExtensionStore();
  const { fetch: fetchGetNextState } = useNextMachineState(apiUrl);
  
  // Working indicator state
  const [workingStatus, setWorkingStatus] = useState<string>('Working on it');
  const [workingError, setWorkingError] = useState<string | undefined>(undefined);
  const [isWorking, setIsWorking] = useState(false);
  const [stateRetry, setStateRetry] = useState({
    actionButton: (
      <div className="flex items-center gap-1.5">
        <RotateCcw size={14} className="retry-icon" />
        <span>Retry</span>
      </div>
    ),
    action: () => null,
  });

  // Collapse state management
  const [collapsedStates, setCollapsedStates] = useState<Set<string>>(new Set());
  const currentStateRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Larry Stream (for working status updates)
  // ============================================================================

  const onLarryUpdate = (event: LarryUpdateEvent) => {
    if (event.payload.type === 'info') {
      setWorkingStatus(event.payload.message);
    } else if (event.payload.type === 'error') {
      setWorkingStatus(event.payload.message);
      setIsWorking(false);
      setWorkingError(JSON.stringify(event.payload.metadata.error));
    }
  };

  const { start: startLarryStream, stop: stopLarryStream } = useLarryStream(
    apiUrl,
    data.context?.machineExecutionId,
    { onUpdate: onLarryUpdate }
  );

  useEffect(() => {
    stopLarryStream();
    setTimeout(() => {
      startLarryStream();
    }, 100);
    return () => {
      stopLarryStream();
    };
  }, [data.context?.machineExecutionId, startLarryStream, stopLarryStream]);

  // Reset working state when machine status changes
  useEffect(() => {
    if (data.status !== 'running') {
      setIsWorking(false);
    }
  }, [data.status]);

  // ============================================================================
  // Collapse State Management
  // ============================================================================

  const deduplicatedStack = getDeduplicatedStack(data.context?.stack);

  // Initialize collapsed states - all previous states should be collapsed
  useEffect(() => {
    const currentStateKey = data.context?.currentState || data.context?.stateId;
    const newCollapsed = new Set<string>();
    
    deduplicatedStack.forEach((stateKey) => {
      if (stateKey !== currentStateKey) {
        newCollapsed.add(stateKey);
      }
    });
    
    setCollapsedStates(newCollapsed);
  }, [data.context?.stack, data.context?.currentState, data.context?.stateId]);

  // Scroll to current state when it changes
  useEffect(() => {
    if (currentStateRef.current) {
      currentStateRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [data.context?.currentState, data.context?.stateId]);

  const toggleCollapse = (stateKey: string) => {
    const newCollapsed = new Set(collapsedStates);
    if (newCollapsed.has(stateKey)) {
      newCollapsed.delete(stateKey);
    } else {
      newCollapsed.add(stateKey);
    }
    setCollapsedStates(newCollapsed);
  };

  // ============================================================================
  // State Rendering
  // ============================================================================

  const isCurrentState = (stateKey: string) => {
    const { isPrevious } = parseStateKey(stateKey);
    if (isPrevious) return false;
    return data.context?.currentState === stateKey || data.context?.stateId === stateKey;
  };

  const renderStateComponent = (stateKey: string) => {
    const { stateName, stateId, isPrevious } = parseStateKey(stateKey);
    const Component = stateComponentMap[stateName];
    
    if (!Component) {
      return (
        <div className="p-4 bg-red-50 rounded border">
          <p className="text-red-600">Unknown state type: {stateName}</p>
        </div>
      );
    }

    // For previous states, look up data using the original key (without |prev-01)
    const originalKey = isPrevious ? `${stateName}|${stateId}` : stateKey;
    const stateData = data.context?.[originalKey];

    // Pass all necessary props to state component
    const props: StateComponentProps = {
      data: stateData,
      stateKey: originalKey,
      machineId: data.id,
      fetchGetNextState,
      machineStatus: data.status,
      setIsWorking,
    };

    return <Component {...props} />;
  };

  // ============================================================================
  // Actions
  // ============================================================================

  const continueToNextState = () => {
    setIsWorking(true);
    fetchGetNextState({ machineId: data.id, contextUpdate: {} });
  };

  const finished = 
    data.currentState === 'applyEdits' || 
    data.currentState === 'success' || 
    deduplicatedStack.includes('success');

  const handleWorkingIndicatorAction = () => {
    setIsWorking(true);
    setWorkingError(undefined);
    setWorkingStatus('Retrying...');
    continueToNextState();
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '50px' }}>
        <div className="space-y-4">
          {/* Welcome message */}
          {data.context?.solution && (
            <GeneralMessageBubble
              content="Hello! I'm **Larry**, your AI Coding assistant. \n I'm working in organized, state based way. Below you will see the states I'm in and the actions I'm taking."
              topActions={null}
            />
          )}

          {/* State stack */}
          {deduplicatedStack.map((stateKey) => {
            const { stateName, isPrevious, previousNumber } = parseStateKey(stateKey);
            const formattedName = isPrevious ? `${stateName} (previous ${previousNumber})` : stateName;
            const isCurrent = isCurrentState(stateKey);
            const isCollapsed = collapsedStates.has(stateKey) && !isCurrent;

            return (
              <div className="mb-2" key={stateKey}>
                {/* State header */}
                <div
                  ref={isCurrent ? currentStateRef : null}
                  className="d-flex cursor-pointer"
                  style={{
                    alignItems: 'center',
                    cursor: 'pointer',
                    opacity: isCurrent ? '1' : '0.5',
                  }}
                  onClick={() => !isCurrent && toggleCollapse(stateKey)}
                >
                  <div>
                    <span className="text-xs">State: {formattedName}</span>
                  </div>
                  {!isCurrent && (
                    <div className="d-flex" style={{ opacity: '0.5' }}>
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </div>

                {/* State content */}
                {(isCurrent || !isCollapsed) && (
                  <div className="pb-3">{renderStateComponent(stateKey)}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Working indicator - show when running, global working, or error */}
        {(data.status === 'running' || isGlobalWorking || workingError) && !finished && (
          <div>
            <WorkingIndicator
              status={workingStatus}
              isWorking={isWorking}
              error={workingError}
              actionButton={!!workingError}
              actionNode={stateRetry.actionButton}
              onActionClick={handleWorkingIndicatorAction}
            />
          </div>
        )}

        {/* Finished indicator */}
        {finished && (
          <div>
            <WorkingIndicator disablePulse status="Code changes applied." />
          </div>
        )}

        {/* Pending state - manual continue */}
        {data.status === 'pending' && !finished && (
          <div>
            <div className="mb-2">
              Cannot automatically proceed to next state. Click "Continue" button to proceed.
            </div>
            <button onClick={continueToNextState} type="submit" className="btn btn-primary">
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


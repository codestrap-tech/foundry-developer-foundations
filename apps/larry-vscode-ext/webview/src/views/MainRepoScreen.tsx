/* JSX */
/* @jsxImportSource preact */
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useExtensionStore, useExtensionDispatch } from '../store/store';
import { postMessage } from '../lib/vscode';
import { CustomSelect } from './components/CustomSelect';
import { AnimatedEllipsis } from './components/AnimatedEllipsis';
import { WorktreeListItem } from './components/WorktreeListItem';
import { useLocalWorktrees } from '../hooks/useLocalWorktrees';
import { useWorktreeActions } from '../hooks/useWorktreeActions';

// TODO: Add support for REMOTE items from useThreadsQuery
// const { data, isLoading } = useThreadsQuery(apiUrl);
// For now, remote items are empty

function capitalizeAgentName(agentKey: string): string {
  return agentKey
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function MainRepoScreen() {
  const { currentThreadState, agents, selectedAgent } = useExtensionStore();
  const dispatch = useExtensionDispatch();
  const { worktrees, isLoading, error, refetch } = useLocalWorktrees();
  const {
    startContainer,
    stopContainer,
    deleteWorktree,
    processingWorktree,
    lastResult,
  } = useWorktreeActions();
  const [newLabel, setNewLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedAgent, setLocalSelectedAgent] = useState(selectedAgent);
  const [setupPhase, setSetupPhase] = useState<
    | 'idle'
    | 'creating_worktree'
    | 'creating_container'
    | 'setting_up_environment'
    | 'ready'
    | 'error'
  >('idle');

  useEffect(() => {
    setLocalSelectedAgent(selectedAgent);
  }, [selectedAgent]);

  const agentItems = useMemo(() => {
    return Object.keys(agents).map((agentKey) => ({
      id: agentKey,
      label: capitalizeAgentName(agentKey),
      worktreeName: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, [agents]);

  useEffect(() => {
    if (currentThreadState === 'ready') {
      // Reset all relevant states when setup is ready
      setTimeout(() => {
        setSetupPhase('idle');
        setNewLabel('');
        // Trigger worktrees list refresh
        refetch();
      }, 1500);
      return;
    }

    if (currentThreadState === 'error') {
      setSetupPhase('error');
      setNewLabel('');
      return;
    }

    setSetupPhase(currentThreadState);
  }, [currentThreadState, refetch]);

  // Handle action completion from useWorktreeActions
  useEffect(() => {
    if (lastResult && lastResult.success) {
      // Refetch worktrees list after successful action
      refetch();
    }
  }, [lastResult, refetch]);

  // Filter worktrees by search query
  const filteredWorktrees = useMemo(() => {
    return worktrees.filter((w) =>
      w.worktreeName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [worktrees, searchQuery]);

  function openWorktree(worktreeName: string) {
    postMessage({
      type: 'open_worktree',
      worktreeName,
      threadId: '',
      label: worktreeName,
    });

    // if only opening we can reset the setup phase
    setTimeout(() => {
      setSetupPhase('idle');
      setNewLabel('');
    }, 3000);
  }

  function openWorktreeNew() {
    if (!newLabel.trim()) return;
    postMessage({
      type: 'open_worktree',
      worktreeName: '',
      threadId: '',
      label: newLabel.trim(),
      agentKey: localSelectedAgent,
    });
    setSetupPhase('creating_worktree');
  }

  function handleAgentSelect(agentKey: string) {
    setLocalSelectedAgent(agentKey);
    dispatch({ type: 'SET_SELECTED_AGENT', payload: agentKey });
  }

  return (
    <div className="Box d-flex flex-column gap-3 p-3">
      {/* Existing Worktrees Section */}
      <div className="worktrees-section">
        <h6 className="section-title">Existing Worktrees</h6>

        {/* Search Input */}
        <input
          type="text"
          className="form-control width-full mb-2"
          placeholder="Search worktrees..."
          value={searchQuery}
          onInput={(e) =>
            setSearchQuery((e.currentTarget as HTMLInputElement).value)
          }
        />

        {/* Loading State */}
        {isLoading ? (
          <div className="color-fg-muted text-center py-3">
            Loading worktrees...
          </div>
        ) : error ? (
          <div className="text-danger">Error loading worktrees: {error}</div>
        ) : filteredWorktrees.length === 0 ? (
          <div className="color-fg-muted text-center py-3">
            {searchQuery
              ? 'No worktrees match your search'
              : 'No worktrees found'}
          </div>
        ) : (
          <div className="worktrees-list gap-2 d-flex flex-column">
            {filteredWorktrees.map((worktree, index) => (
              <WorktreeListItem
                isLastItem={index === filteredWorktrees.length - 1}
                key={worktree.worktreeName}
                worktreeName={worktree.worktreeName}
                branch={worktree.branch}
                onOpen={() => openWorktree(worktree.worktreeName)}
                onDelete={deleteWorktree}
                onStartContainer={startContainer}
                onStopContainer={stopContainer}
                isProcessing={processingWorktree === worktree.worktreeName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status Messages During Worktree Operations */}
      {setupPhase !== 'idle' && (
        <div className="pt-1 mt-2 mb-2">
          {setupPhase === 'creating_worktree' && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Creating git worktree
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          {setupPhase === 'creating_container' && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Creating docker container
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          {setupPhase === 'setting_up_environment' && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Setting up environment
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          {setupPhase === 'error' && (
            <div className="text-danger">Error setting up worktree</div>
          )}
        </div>
      )}

      {/* Create New Worktree Section */}
      <div className="border-top pt-3 mt-3" style={{ position: 'relative' }}>
        <h6
          style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--vscode-tab-activeBackground)',
            color: 'var(--vscode-foreground)',
            padding: '0 10px',
            fontSize: '12px',
          }}
        >
          OR
        </h6>
        <div className="width-full mb-2">
          <input
            className="form-control flex-1 width-full"
            placeholder="Create new working item..."
            value={newLabel}
            onInput={(e) =>
              setNewLabel((e.currentTarget as HTMLInputElement).value)
            }
          />
        </div>
        <div className="width-full mb-2">
          <CustomSelect
            items={agentItems}
            selectedId={localSelectedAgent}
            size="small"
            onSelect={handleAgentSelect}
            placeholder="Select agent..."
            searchPlaceholder="Select agent..."
            emptyMessage="No agents found"
          />
        </div>
        <div>
          <button
            className={`btn ${newLabel.trim() ? 'btn-primary' : ''}`}
            disabled={!newLabel.trim() || setupPhase !== 'idle'}
            onClick={openWorktreeNew}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

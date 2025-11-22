import React from 'react';
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useThreadsQuery } from '../hooks/useThreadsQuery';
import { useExtensionStore } from '../store/store';
import { postMessage } from '../lib/vscode';
import type { ThreadListItem } from '../lib/backend-types';
import { CustomSelect } from './components/CustomSelect';
import { AnimatedEllipsis } from './components/AnimatedEllipsis';

export function MainRepoScreen() {
  const { apiUrl, currentThreadState } = useExtensionStore();
  const { data, isLoading } = useThreadsQuery(apiUrl);
  const [newLabel, setNewLabel] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(
    undefined,
  );
  const [setupPhase, setSetupPhase] = useState<
    | 'idle'
    | 'creating_worktree'
    | 'creating_container'
    | 'setting_up_environment'
    | 'ready'
    | 'error'
  >('idle');

  useEffect(() => {
    if (currentThreadState === 'ready') {
      // Reset all relevant states when setup is ready
      setTimeout(() => {
        setSetupPhase('idle');
        setNewLabel('');
        setSelectedThreadId(undefined);
      }, 1500);
      return;
    }

    if (currentThreadState === 'error') {
      setSetupPhase('error');
      setNewLabel('');
      setSelectedThreadId(undefined);
      return;
    }

    setSetupPhase(currentThreadState);
  }, [currentThreadState]);

  const items = data?.items ?? [];

  const selected: ThreadListItem | undefined = useMemo(() => {
    if (!selectedThreadId) return undefined;
    return items.find((t) => t.id === selectedThreadId);
  }, [items, selectedThreadId]);

  function openWorktreeExisting() {
    if (!selected) return;
    postMessage({
      type: 'open_worktree',
      worktreeName: selected.worktreeName,
      threadId: selected.id,
      label: selected.label,
    });
    setSetupPhase('setting_up_environment');
  }

  function openWorktreeNew() {
    setSelectedThreadId(undefined);
    if (!newLabel.trim()) return;
    postMessage({
      type: 'open_worktree',
      worktreeName: '',
      threadId: '',
      label: newLabel.trim(),
    });
    setSetupPhase('creating_worktree');
  }

  return (
    <div className="Box d-flex flex-column gap-3 p-3">
      {isLoading ? (
        <div className="color-fg-muted">Loading items...</div>
      ) : (
        <CustomSelect
          items={items}
          selectedId={selectedThreadId}
          onSelect={(id) => setSelectedThreadId(id)}
          placeholder="Pick a working item..."
          searchPlaceholder="Pick a working item..."
          emptyMessage="No working items found"
        />
      )}

      {selectedThreadId ? (
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
          {setupPhase === 'idle' && (
            <button
              className="btn btn-primary"
              disabled={!selected || setupPhase !== 'idle'}
              onClick={openWorktreeExisting}
            >
              Start
            </button>
          )}
        </div>
      ) : null}

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
            items={[
              {
                id: '1',
                label: 'Google',
                worktreeName: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: '4',
                label: 'MS 365',
                worktreeName: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: '3',
                label: 'React Components',
                worktreeName: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]}
            selectedId={'1'}
            size="small"
            onSelect={() => undefined}
            placeholder="Select agent..."
            searchPlaceholder="Select agent..."
            emptyMessage="No agents found"
          />
        </div>
        <div>
          {setupPhase === 'creating_worktree' && !selectedThreadId && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Creating git worktree
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          {setupPhase === 'creating_container' && !selectedThreadId && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Creating docker container
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          {setupPhase === 'setting_up_environment' && !selectedThreadId && (
            <div>
              <span style={{ fontSize: '10px' }} className="shimmer-loading">
                Setting up environment
              </span>
              <AnimatedEllipsis />
            </div>
          )}
          <button
            className={`btn ${newLabel.trim() ? 'btn-primary' : ''}`}
            disabled={!newLabel.trim() || setupPhase !== 'idle'}
            onClick={openWorktreeNew}
          >
            Start
          </button>
        </div>
      </div>
      {setupPhase === 'error' ? (
        <div className="border-top pt-3 mt-2">
          <div className="text-danger">Error setting up worktree</div>
        </div>
      ) : null}
    </div>
  );
}

/* JSX */
/* @jsxImportSource preact */
import { useState, useEffect, useRef } from 'preact/hooks';
import { GitBranch, Loader2, Trash2 } from 'lucide-react';
import { DockerStatusBadge } from './DockerStatusBadge';

interface WorktreeListItemProps {
  worktreeName: string;
  branch: string;
  onOpen: () => void;
  onDelete: (worktreeName: string) => void;
  onStartContainer: (worktreeName: string) => void;
  onStopContainer: (worktreeName: string) => void;
  isProcessing: boolean;
  isLastItem: boolean;
}

export function WorktreeListItem({
  worktreeName,
  branch,
  onOpen,
  onDelete,
  onStartContainer,
  onStopContainer,
  isProcessing,
  isLastItem,
}: WorktreeListItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deletePopoverRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deletePopoverRef.current && !deletePopoverRef.current.contains(event.target as Node)) {
        setShowDeleteConfirm(false);
      }
    };

    if (showDeleteConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDeleteConfirm]);

  const handleDeleteClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(!showDeleteConfirm);
  };

  const stopPropagation = (e: any) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleConfirmDelete = () => {
    onDelete(worktreeName);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="worktree-list-item" onClick={onOpen}>
      <div className="worktree-item-row-1">
        <span className="worktree-name" style={{ cursor: 'pointer' }}>
          {worktreeName}
        </span>
        <div className="delete-button-container" ref={deletePopoverRef}>
          <button
            className="worktree-item-delete-btn"
            onClick={handleDeleteClick}
            disabled={isProcessing}
            title={isProcessing ? 'Deleting...' : 'Delete worktree'}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
          </button>
          {showDeleteConfirm && (
            <div className={`docker-status-popover delete-confirm-popover ${isLastItem ? 'popover-position-top' : ''}`} onClick={stopPropagation}>
              <div className="popover-content">
                <div className="popover-status">
                  Delete "{worktreeName}"?
                </div>
                <div className="popover-delete-message">
                  This will remove the git worktree and docker container.
                </div>
                <div className="popover-actions">
                  <button
                    className="btn btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false);
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmDelete();
                    }}
                    disabled={isProcessing}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="worktree-item-row-2">
        <span className="branch-info">
        <GitBranch className="branch-icon" size={16} /> {branch}
        </span>
        <DockerStatusBadge
          worktreeName={worktreeName}
          isLastItem={isLastItem}
          onStartContainer={onStartContainer}
          onStopContainer={onStopContainer}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}


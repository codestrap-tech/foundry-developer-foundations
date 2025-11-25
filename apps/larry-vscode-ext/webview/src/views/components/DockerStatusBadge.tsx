/* JSX */
/* @jsxImportSource preact */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useDockerStatus } from '../../hooks/useDockerStatus';

interface DockerStatusBadgeProps {
  worktreeName: string;
  isLastItem: boolean;
  onStartContainer: (worktreeName: string) => void;
  onStopContainer: (worktreeName: string) => void;
  isProcessing: boolean;
}

export function DockerStatusBadge({
  worktreeName,
  isLastItem,
  onStartContainer,
  onStopContainer,
  isProcessing,
}: DockerStatusBadgeProps) {
  const { isRunning, isLoading, refetch } = useDockerStatus(worktreeName);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const handleStartClick = () => {
    onStartContainer(worktreeName);
    setShowPopover(false);
  };

  const handleStopClick = () => {
    onStopContainer(worktreeName);
    setShowPopover(false);
  };

  if (isLoading) {
    return (
      <span className="docker-status-badge docker-status-loading">⏳</span>
    );
  }

  const handleClick = (e: any) => {
    e.stopPropagation();
    e.preventDefault();
    setShowPopover(!showPopover);
  };

  const stopPropagation = (e: any) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const statusColor = isRunning
    ? 'docker-status-running'
    : 'docker-status-stopped';
  const statusDot = isRunning ? '🟢' : '⚪';

  return (
    <div
      className="docker-status-container"
      ref={popoverRef}
      onClick={stopPropagation}
    >
      <button
        className={`docker-status-badge ${statusColor}`}
        onClick={handleClick}
        disabled={isProcessing}
        title={isRunning ? 'Docker: Running' : 'Docker: Stopped'}
      >
        {statusDot} Docker
      </button>
      {showPopover && (
        <div
          className={`docker-status-popover ${isLastItem ? 'popover-position-top' : ''}`}
        >
          <div className="popover-content">
            <div className="popover-status">
              {isRunning ? 'Container is running' : 'Container is stopped'}
            </div>
            <div className="popover-actions">
              {!isRunning && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleStartClick}
                  disabled={isProcessing}
                >
                  Start
                </button>
              )}
              {isRunning && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={handleStopClick}
                  disabled={isProcessing}
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

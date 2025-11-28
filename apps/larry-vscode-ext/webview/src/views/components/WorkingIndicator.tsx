/* JSX */
/* @jsxImportSource preact */
import { Loader2, Sparkles, Bug } from 'lucide-react';
import { useState, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';

type PropsType = {
  status: string;
  isWorking?: boolean;
  actionButton?: boolean;
  actionNode?: JSX.Element;
  onActionClick?: () => void;
  error?: string;
  disablePulse?: boolean;
};

export default function WorkStatusLoader({
  disablePulse = false,
  status,
  isWorking = false,
  actionButton = false,
  actionNode,
  onActionClick,
  error,
}: PropsType) {
  const [displayStatus, setDisplayStatus] = useState(status);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayError, setDisplayError] = useState(error);
  const [isErrorTransitioning, setIsErrorTransitioning] = useState(false);

  useEffect(() => {
    if (status !== displayStatus) {
      setIsTransitioning(true);
      const timeout = setTimeout(() => {
        setDisplayStatus(status);
        setIsTransitioning(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [status, displayStatus]);

  useEffect(() => {
    if (error !== displayError) {
      if (error) {
        setDisplayError(error);
        setIsErrorTransitioning(false);
      } else {
        setIsErrorTransitioning(true);
        const timeout = setTimeout(() => {
          setDisplayError(error);
          setIsErrorTransitioning(false);
        }, 200);
        return () => clearTimeout(timeout);
      }
    }
  }, [error, displayError]);

  return (
    <div className="work-status-loader">
      <div className="work-status-loader__icon">
        {error ? (
          <Bug size={16} className="work-status-loader__icon--error" />
        ) : isWorking ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Sparkles size={16} />
        )}
      </div>

      <div className="work-status-loader__status-container">
        {displayError ? (
          <div
            className={`work-status-loader__error ${
              isErrorTransitioning
                ? 'work-status-loader__error--exit'
                : 'work-status-loader__error--enter'
            }`}
          >
            {displayError}
          </div>
        ) : (
          <div
            className={`work-status-loader__status ${
              isTransitioning
                ? 'work-status-loader__status--exit'
                : 'work-status-loader__status--enter'
            }`}
          >
            <span className={disablePulse ? '' : 'shimmer-loading'}>{displayStatus}</span>
          </div>
        )}
      </div>

      {actionButton && onActionClick && (
        <button
          className="work-status-loader__action-btn"
          onClick={onActionClick}
          type="button"
        >
          {actionNode || 'Action'}
        </button>
      )}
    </div>
  );
}

/* JSX */
/* @jsxImportSource preact */
import { useState } from "preact/hooks";
import { postMessage } from "../../../lib/vscode";
import { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";
import { FileSymlink } from "lucide-preact";

type CodeReviewData = {
  approved: boolean;
  file: string;
  messages: { system?: string; user?: string }[];
  reviewRequired: boolean;
};

/**
 * CodeReview - Code Review State Component
 * 
 * User flow:
 * 1. View the code changes
 * 2. Approve or reject
 * 3. If rejected, provide feedback
 * 4. Submit
 * 
 * API call on approve: { approved: true, messages: [...] }
 * API call on reject: { approved: false, messages: [...with feedback...] }
 */
export function CodeReview({
  data,
  stateKey,
  machineId,
  fetchGetNextState,
  machineStatus,
  setIsWorking,
}: StateComponentProps<CodeReviewData>) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const file = data?.file;

  const openFile = () => {
    postMessage({
      type: 'openFile',
      file,
    });
  };

  const handleApprove = () => {
    setIsWorking(true);

    // Update the last message with user approval
    const messages = data?.messages ? [...data.messages] : [];
    const lastMessage = messages
      .slice()
      .reverse()
      .find((item) => item.user === undefined);

    if (lastMessage) {
      lastMessage.user = 'Looks good, approved.';
    }

    fetchGetNextState({
      machineId,
      contextUpdate: {
        [stateKey]: { approved: true, messages },
      },
    });
  };

  const handleRejectClick = () => {
    setShowRejectInput(true);
  };

  const handleRejectSubmit = () => {
    if (!rejectFeedback.trim()) return;

    setIsWorking(true);

    // Update the last message with rejection feedback
    const messages = data?.messages ? [...data.messages] : [];
    const lastMessage = messages
      .slice()
      .reverse()
      .find((item) => item.user === undefined);

    if (lastMessage) {
      lastMessage.user = rejectFeedback;
    }

    fetchGetNextState({
      machineId,
      contextUpdate: {
        [stateKey]: { approved: false, messages },
      },
    });

    setShowRejectInput(false);
    setRejectFeedback('');
  };

  const isAwaitingHuman = machineStatus === 'awaiting_human';

  const message = `Review ts-morph code edits.`;

  return (
    <div className="code-review">
      <GeneralMessageBubble
        content={message}
        topActions={
          <div className="text-button" onClick={openFile}>
            Open file <FileSymlink className="file-icon" />
          </div>
        }
        bottomActions={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {isAwaitingHuman && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={handleApprove}>
                      Approve
                    </button>
                    <button 
                      className={`btn ${showRejectInput ? 'btn-danger' : ''}`} 
                      onClick={handleRejectClick}
                    >
                      Reject
                    </button>
                  </div>
                  <div className="text-button" onClick={openFile}>
                    Open file <FileSymlink className="file-icon" />
                  </div>
                </div>

                {/* Rejection feedback input */}
                {showRejectInput && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className="form-control"
                      placeholder="Please provide feedback on what should be changed..."
                      value={rejectFeedback}
                      onChange={(e) => setRejectFeedback((e.target as HTMLTextAreaElement).value)}
                      style={{ padding: '8px', fontSize: '14px', minHeight: '80px' }}
                    />
                    <button
                      className={`btn ${rejectFeedback.trim() ? 'btn-primary' : ''}`}
                      disabled={!rejectFeedback.trim()}
                      onClick={handleRejectSubmit}
                    >
                      Submit Feedback
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        }
      />
    </div>
  );
}


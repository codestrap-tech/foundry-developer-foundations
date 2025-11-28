/* JSX */
/* @jsxImportSource preact */
import { useState, useRef } from "preact/hooks";
import { StateComponentProps } from "../../../../lib/backend-types";
import { useContentFromLocalFile } from "../../../../hooks/useContentFromLocalFile";
import { useParseCodeEdits } from "./useParseCodeEdits";
import { LucideFilePlus2, LucideFileDiff, LucideFileMinus2, LucideCopy, LucideCheck, LucideX, FileSymlink } from "lucide-preact";
import { GeneralMessageBubble } from "../../GeneralMessageBubble.tsx";
import { postMessage } from "../../../../lib/vscode";

type ArchitectureReviewData = {
  approved: boolean;
  file: string;
  messages: { system?: string; user?: string }[];
  reviewRequired: boolean;
};

/**
 * ArchitectureReview2 - Architecture Review State Component
 * 
 * User flow:
 * 1. View code edits parsed from the architecture markdown file
 * 2. Approve or reject each file individually
 * 3. If rejected, provide feedback for each file
 * 4. Click "Continue" to submit
 * 
 * API call on continue:
 * - If any rejections: { approved: false, messages: [...with rejection feedback...] }
 * - If all approved: { approved: true, messages: [...] }
 */
export function ArchitectureReview2({
  data,
  stateKey,
  machineId,
  fetchGetNextState,
  machineStatus,
  setIsWorking,
}: StateComponentProps<ArchitectureReviewData>) {
  const file = data?.file;
  
  const { content } = useContentFromLocalFile(file);
  const codeEdits = useParseCodeEdits(content);

  // State to track which code blocks have been copied
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Track individual file approvals
  const [fileApprovals, setFileApprovals] = useState<{ [key: string]: { filePath: string; approved: boolean } | null }>({});

  // Track rejection states with feedback
  const [rejectionStates, setRejectionStates] = useState<{
    [key: string]: {
      showInput: boolean;
      feedback: string;
      isSubmitted: boolean;
    };
  }>({});

  // Refs for each code block (for copy functionality)
  const codeBlockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // ============================================================================
  // Individual File Actions
  // ============================================================================

  const handleIndividualApprove = (filePath: string) => {
    setFileApprovals((prev) => ({
      ...prev,
      [filePath]: { filePath, approved: true },
    }));
    // Clear any rejection state for this file
    setRejectionStates((prev) => {
      const newState = { ...prev };
      delete newState[filePath];
      return newState;
    });
  };

  const handleRejectClick = (filePath: string) => {
    setFileApprovals((prev) => ({
      ...prev,
      [filePath]: { filePath, approved: false },
    }));
    setRejectionStates((prev) => ({
      ...prev,
      [filePath]: { showInput: true, feedback: '', isSubmitted: false },
    }));
  };

  const handleFeedbackChange = (filePath: string, feedback: string) => {
    setRejectionStates((prev) => ({
      ...prev,
      [filePath]: { ...prev[filePath], feedback, isSubmitted: false },
    }));
  };

  const handleRejectSubmit = (filePath: string) => {
    // Clear the approval state (mark as pending rejection)
    setFileApprovals((prev) => {
      const newState = { ...prev };
      delete newState[filePath];
      return newState;
    });

    // Mark rejection as submitted
    setRejectionStates((prev) => ({
      ...prev,
      [filePath]: { ...prev[filePath], isSubmitted: true },
    }));
  };

  // ============================================================================
  // Continue (Submit) Action
  // ============================================================================

  const handleContinueClick = () => {
    setIsWorking(true);

    const rejections = Object.keys(rejectionStates).filter(
      (key) => rejectionStates[key].isSubmitted
    );

    // Build the user message based on rejections
    let userMessage = 'Looks good, approved.';
    let isApproved = true;

    if (rejections.length > 0) {
      isApproved = false;
      userMessage = rejections.reduce((acc, rejectionKey) => {
        const rejection = rejectionStates[rejectionKey];
        return `${acc}\nRejected ${rejectionKey} with feedback: ${rejection.feedback}`;
      }, '');
    }

    // Update the last message with user response
    const messages = data?.messages ? [...data.messages] : [];
    const lastMessage = messages
      .slice()
      .reverse()
      .find((item) => item.user === undefined);

    if (lastMessage) {
      lastMessage.user = userMessage;
    }

    fetchGetNextState({
      machineId,
      contextUpdate: {
        [stateKey]: { approved: isApproved, messages },
      },
    });
  };

  // ============================================================================
  // Copy Functionality
  // ============================================================================

  const handleCopyClick = async (filePath: string, code: string) => {
    try {
      const codeBlockElement = codeBlockRefs.current[filePath];
      if (codeBlockElement) {
        const range = document.createRange();
        range.selectNodeContents(codeBlockElement);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      await navigator.clipboard.writeText(code);
      setCopiedStates((prev) => ({ ...prev, [filePath]: true }));

      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [filePath]: false }));
      }, 5000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // ============================================================================
  // File Open
  // ============================================================================

  const openFile = () => {
    postMessage({
      type: 'openFile',
      file,
    });
  };

  // ============================================================================
  // Icons
  // ============================================================================

  const lucideIconsMap: Record<string, JSX.Element> = {
    CREATE: <LucideFilePlus2 className="create-icon" />,
    MODIFY: <LucideFileDiff className="modify-icon" />,
    DELETE: <LucideFileMinus2 className="delete-icon" />,
  };

  const isAwaitingHuman = machineStatus === 'awaiting_human';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="ArchitectureReview">
      <GeneralMessageBubble
        topActions={
          <div className="text-button" onClick={openFile}>
            Open file <FileSymlink className="file-icon" />
          </div>
        }
        content={`Please **review the changes** file by file and approve ✅ or reject ❌. Or review and edit directly in the generated markdown file.\n Then press the **Continue** button to proceed.`}
      />

      {codeEdits.map((codeEdit) => {
        const approval = fileApprovals[codeEdit.filePath];
        const isApproved = approval?.approved === true;
        const isRejected = approval?.approved === false;
        const rejectionState = rejectionStates[codeEdit.filePath] || {
          showInput: false,
          feedback: '',
          isSubmitted: false,
        };

        return (
          <div key={codeEdit.filePath}>
            <GeneralMessageBubble
              codeFormattingEnabled
              topActions={
                <div className="codeBlockHeader">
                  {lucideIconsMap[codeEdit.type]}
                  <div>{codeEdit.filePath}</div>
                </div>
              }
              bottomActions={
                <div className="codeBlockFooter">
                  <div className="actionButtons">
                    <div
                      className={`d-flex text-button ${isApproved ? 'selected' : ''}`}
                      onClick={() => handleIndividualApprove(codeEdit.filePath)}
                      style={{ cursor: 'pointer' }}
                    >
                      <LucideCheck className="check-icon" />
                      Approve
                    </div>
                    <div
                      className={`d-flex text-button ${isRejected && rejectionState.showInput ? 'selected' : ''}`}
                      onClick={() => handleRejectClick(codeEdit.filePath)}
                      style={{ cursor: 'pointer' }}
                    >
                      <LucideX className="reject-icon" />
                      Reject
                    </div>
                  </div>
                  <div className="text-button">
                    {copiedStates[codeEdit.filePath] && (
                      <span
                        className="copied-indicator"
                        style={{ marginLeft: '8px', fontSize: '12px', color: '#28a745' }}
                      >
                        Copied
                      </span>
                    )}
                    <LucideCopy
                      className="copy-icon"
                      onClick={() => handleCopyClick(codeEdit.filePath, codeEdit.proposedChange)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                </div>
              }
              content={codeEdit.proposedChange}
              contentRef={(el: HTMLDivElement | null) => {
                codeBlockRefs.current[codeEdit.filePath] = el;
              }}
            />

            {/* Rejection feedback input */}
            {rejectionState.showInput && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px',
                  marginBottom: '8px',
                }}
              >
                <textarea
                  className="form-control"
                  placeholder="Provide feedback"
                  value={rejectionState.feedback}
                  onChange={(e) =>
                    handleFeedbackChange(codeEdit.filePath, (e.target as HTMLTextAreaElement).value)
                  }
                  style={{ padding: '4px 8px', fontSize: '14px' }}
                />
                <button
                  className={
                    rejectionState.feedback && !rejectionState.isSubmitted ? 'btn btn-primary' : 'btn'
                  }
                  disabled={!rejectionState.feedback || rejectionState.isSubmitted}
                  onClick={() => handleRejectSubmit(codeEdit.filePath)}
                >
                  {rejectionState.isSubmitted ? 'Rejected' : 'Reject'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Continue button */}
      {isAwaitingHuman && (
        <>
          <hr />
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <button className="btn btn-primary" onClick={handleContinueClick}>
              Continue
            </button>
            <small style={{ marginTop: '8px', fontSize: '10px' }}>
              By clicking continue you either did review the changes displayed above or you reviewed
              and edited the generated markdown file.
            </small>
          </div>
        </>
      )}
    </div>
  );
}


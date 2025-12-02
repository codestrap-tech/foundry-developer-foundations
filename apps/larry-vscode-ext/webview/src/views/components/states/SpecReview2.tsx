/* JSX */
/* @jsxImportSource preact */
import { useState } from "preact/hooks";
import { postMessage } from "../../../lib/vscode";
import { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";
import { useContentFromLocalFile } from "../../../hooks/useContentFromLocalFile";
import { FileSymlink } from "lucide-preact";

type SpecReviewData = {
  approved: boolean;
  file: string;
  messages: { system?: string; user?: string }[];
  reviewRequired: boolean;
};

/**
 * SpecReview2 - Specification Review State Component
 * 
 * User flow:
 * 1. View the generated specification (MD file content displayed inline)
 * 2. Optionally open and modify the file directly
 * 3. Check the confirmation checkbox
 * 4. Click "Continue" to proceed
 * 
 * API call on continue: { approved: true, messages: [...] }
 */
export function SpecReview2({
  data,
  stateKey,
  machineId,
  fetchGetNextState,
  machineStatus,
  setIsWorking,
}: StateComponentProps<SpecReviewData>) {
  const [isReviewed, setIsReviewed] = useState(false);
  const file = data?.file;

  const { content } = useContentFromLocalFile(file);

  const openFile = () => {
    postMessage({
      type: 'openFile',
      file,
    });
  };

  const handleContinue = () => {
    if (!isReviewed) return;
    
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

  const message = `I've generated a **design specification**.
You can **review it directly in the generated file**, modify and save it.

> Keep in mind: I will use **this same file** to generate the **next state**.

---
${content || ''}
`;

  const isAwaitingHuman = machineStatus === 'awaiting_human';

  return (
    <div className="design-spec-review">
      {content && (
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
                  {/* Checkbox confirmation */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isReviewed}
                      onChange={(e) => setIsReviewed((e.target as HTMLInputElement).checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px' }}>I have reviewed/modified the specification file</span>
                  </label>

                  {/* Continue button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      className={`btn ${isReviewed ? 'btn-primary' : ''}`}
                      onClick={handleContinue}
                      disabled={!isReviewed}
                    >
                      Continue
                    </button>
                    <div className="text-button" onClick={openFile}>
                      Open file <FileSymlink className="file-icon" />
                    </div>
                  </div>
                </>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}


/* JSX */
/* @jsxImportSource preact */
import { useState } from "preact/hooks";
import { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";
import TextareaAutosize from "react-textarea-autosize";
import { SendIcon } from "lucide-preact";

type ConfirmUserIntentData = {
  confirmationPrompt: string;
  userResponse?: string;
};

/**
 * ConfirmUserIntent2 - User Intent Confirmation State Component
 * 
 * User flow:
 * 1. View the confirmation prompt from Larry
 * 2. Type a response in the textarea
 * 3. Submit the response
 * 
 * API call on submit: { userResponse: "user's input" }
 */
export function ConfirmUserIntent2({
  data,
  stateKey,
  machineId,
  fetchGetNextState,
  machineStatus,
  setIsWorking,
}: StateComponentProps<ConfirmUserIntentData>) {
  const [userInput, setUserInput] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setIsWorking(true);

    fetchGetNextState({
      machineId,
      contextUpdate: {
        [stateKey]: { userResponse: userInput },
      },
    });

    setUserInput('');
  };

  const isAwaitingHuman = machineStatus === 'awaiting_human';

  return (
    <div className="confirm-user-intent">
      <GeneralMessageBubble
        content={data?.confirmationPrompt || ''}
        topActions={null}
      />

      {isAwaitingHuman && (
        <div style={{ marginTop: '12px' }}>
          <form onSubmit={handleSubmit} className="d-flex gap-2" style={{ position: 'relative' }}>
            <TextareaAutosize
              value={userInput}
              onInput={(e) => setUserInput((e.currentTarget as HTMLTextAreaElement).value)}
              placeholder="Tell me more..."
              minRows={2}
              maxRows={8}
              autoFocus
              className="form-control width-full pr-40"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!userInput.trim()}
              style={{
                borderRadius: '50% !important',
                width: '32px',
                paddingTop: '12px !important',
                height: '32px',
                position: 'absolute',
                right: '5px',
                bottom: '6px',
                lineHeight: '30px !important',
              }}
            >
              <SendIcon size={16} style={{ position: 'relative', top: '4px', left: '-2px' }} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}


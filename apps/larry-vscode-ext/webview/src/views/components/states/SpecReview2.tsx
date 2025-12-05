/* JSX */
/* @jsxImportSource preact */
import { useEffect } from "preact/hooks";
import { postMessage } from "../../../lib/vscode";
import { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";
import { useContentFromLocalFile } from "../../../hooks/useContentFromLocalFile";
import { FileSymlink, Sparkles } from "lucide-preact";

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
  const file = data?.file;

  const openFile = () => {
    postMessage({
      type: 'openFile',
      file,
    });
  };

  useEffect(() => {
    setTimeout(() => {
      openFile();
    }, 500);
  }, []);

  const message = `I've generated a **design specification**.
You can **review it directly in the generated file**, modify and click **Proceed** to continue.

> Keep in mind: I will use **this same file** to generate the **next state**.
`;

  return (
    <div className="design-spec-review">
        <GeneralMessageBubble
          content={message}
          icon={<Sparkles size={16} />}
          topActions={
            <div className="text-button" onClick={openFile}>
              Open file <FileSymlink className="file-icon" />
            </div>
          }
          bottomActions={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="text-button" onClick={openFile}>
                Open file <FileSymlink className="file-icon" />
              </div>
            </div>
          }
        />
    </div>
  );
}


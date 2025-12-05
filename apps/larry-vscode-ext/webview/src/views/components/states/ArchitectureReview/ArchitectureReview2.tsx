/* JSX */
/* @jsxImportSource preact */
import { useEffect } from "preact/hooks";
import { StateComponentProps } from "../../../../lib/backend-types";
import { FileSymlink, Sparkles } from "lucide-preact";
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




  // ============================================================================
  // File Open
  // ============================================================================

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
  }, [machineStatus]);


  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="ArchitectureReview">
      <GeneralMessageBubble
        icon={<Sparkles size={16} />}
        topActions={
          <div className="text-button" onClick={openFile}>
            Open file <FileSymlink className="file-icon" />
          </div>
        }
        bottomActions={
          <div className="text-button" onClick={openFile}>
            Open file <FileSymlink className="file-icon" />
          </div>
        }
        content={`Please **review the changes** file by file, modify, write comments, etc. Then click **Proceed** to continue.`}
      />

    </div>
  );
}


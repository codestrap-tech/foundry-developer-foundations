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

export function ArchitectureReview({
  data,
  machineStatus,
}: StateComponentProps<ArchitectureReviewData>) {
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
  }, [machineStatus]);

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


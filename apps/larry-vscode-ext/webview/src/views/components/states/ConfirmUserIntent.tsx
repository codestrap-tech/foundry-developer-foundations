/* JSX */
/* @jsxImportSource preact */
import { useEffect } from "preact/hooks";
import { postMessage } from "../../../lib/vscode";
import { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";
import { FileSymlink, Sparkles } from "lucide-preact";

type ConfirmUserIntentData = {
  approved: boolean;
  file: string;
  userAnswered?: boolean;
  reviewRequired?: boolean;
};

export function ConfirmUserIntent({
  data,
}: StateComponentProps<ConfirmUserIntentData>) {
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

  const message = `Before we can continue, I need you to answer the questions in the file.`;

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


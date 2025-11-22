/* JSX */
/* @jsxImportSource preact */
import { useEffect } from 'preact/hooks';
import { postMessage } from '../../../lib/vscode';
import type { MachineStatus } from '../../../lib/backend-types';
import { GeneralMessageBubble } from '../GeneralMessageBubble';
import { useContentFromLocalFile } from '../../../hooks/useContentFromLocalFile';
import { FileSymlink } from 'lucide-preact';

type DataType = {
  approved: boolean;
  file: string;
  messages: { system?: string; user?: string }[];
  reviewRequired: boolean;
};

export function CodeReview({
  data,
  onAction,
  machineStatus,
}: {
  data: DataType;
  onAction: (action: string) => void;
  machineStatus: MachineStatus;
}) {
  const file = data.file;

  const openFile = () => {
    // TODO send postMessage to extension to open file
    postMessage({
      type: 'openFile',
      file,
    });
  };

  const approveSpec = () => {
    onAction('approveCodeReview');
  };

  const rejectSpec = () => {
    onAction('rejectCodeReview');
  };

  const message = `Review ts-morph code edits.`;
  return (
    <div className="code-review">
      {
        <GeneralMessageBubble
          content={message}
          topActions={
            <div className="text-button" onClick={openFile}>
              Open file <FileSymlink className="file-icon" />
            </div>
          }
          bottomActions={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {machineStatus === 'awaiting_human' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" onClick={approveSpec}>
                    Approve
                  </button>
                  <button className="btn" onClick={rejectSpec}>
                    Reject
                  </button>
                </div>
              )}
              <div className="text-button" onClick={openFile}>
                Open file <FileSymlink className="file-icon" />
              </div>
            </div>
          }
        />
      }
    </div>
  );
}

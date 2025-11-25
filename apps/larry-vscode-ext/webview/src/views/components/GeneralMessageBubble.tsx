/* JSX */
/* @jsxImportSource preact */

import { useMarkdown } from '../../hooks/useMarkdown';

export function GeneralMessageBubble({
  content,
  topActions,
  bottomActions,
  contentRef,
  codeFormattingEnabled = false,
}: {
  content: string;
  topActions?: any;
  bottomActions?: any;
  contentRef?: any;
  codeFormattingEnabled?: boolean;
}) {
  const mark = useMarkdown();

  const formattedContent = mark(content, codeFormattingEnabled);
  return (
    <div className="mb-2 generalMessageBubbleWrapper">
      {topActions && <div className="topActions">{topActions}</div>}
      <div
        className={`generalMessageBubble markdown-content markdown-body ${topActions ? 'hasTopActions' : ''} ${bottomActions ? 'hasBottomActions' : ''}`}
        ref={contentRef}
      >
        <span dangerouslySetInnerHTML={{ __html: formattedContent }} />
      </div>
      {bottomActions && <div className="bottomActions">{bottomActions}</div>}
    </div>
  );
}

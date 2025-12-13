/* JSX */
/* @jsxImportSource preact */

import { useMarkdown } from '../../hooks/useMarkdown';

export function GeneralMessageBubble({
  icon,
  content,
  topActions,
  bottomActions,
  contentRef,
  codeFormattingEnabled = false,
}: {
  icon?: any;
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
      {icon && <div className="icon">{icon}</div>}
      <div
        className={`generalMessageBubble markdown-content markdown-body ${topActions ? 'hasTopActions' : ''} ${bottomActions ? 'hasBottomActions' : ''} ${icon ? 'hasIcon' : ''}`}
        ref={contentRef}
      >
        <span dangerouslySetInnerHTML={{ __html: formattedContent }} />
      </div>
      {bottomActions && <div className="bottomActions">{bottomActions}</div>}
    </div>
  );
}

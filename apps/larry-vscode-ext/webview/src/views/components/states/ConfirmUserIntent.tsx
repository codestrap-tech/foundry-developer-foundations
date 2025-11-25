/* JSX */
/* @jsxImportSource preact */

import { GeneralMessageBubble } from '../GeneralMessageBubble';

export function ConfirmUserIntent({
  data,
  id,
}: {
  data: { confirmationPrompt: string };
  id: string;
}) {
  return (
    <div className="confirm-user-intent">
      <GeneralMessageBubble
        key={id}
        content={data.confirmationPrompt}
        topActions={null}
      />
    </div>
  );
}

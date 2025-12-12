/* JSX */
/* @jsxImportSource preact */
import type { StateComponentProps } from "../../../lib/backend-types";
import { GeneralMessageBubble } from "../GeneralMessageBubble";

type ConfirmUserIntentData = {
  confirmationPrompt: string;
  userResponse?: string;
};

export function ConfirmUserIntent({
  data,
}: StateComponentProps<ConfirmUserIntentData>) {

  return (
    <div className="confirm-user-intent">
      <GeneralMessageBubble
        content={data?.confirmationPrompt || ''}
        topActions={null}
      />
    </div>
  );
}


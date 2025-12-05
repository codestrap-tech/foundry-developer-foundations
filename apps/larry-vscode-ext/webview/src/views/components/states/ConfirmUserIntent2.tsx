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


import { ThreadMessage } from "./backend-types";

const USER_QUESTION_PREFIX = '# User Question:';
export function findUserQuestionMessage(messages: ThreadMessage[]) {
    return messages.filter(message => message.user).find(message => message.user.startsWith(USER_QUESTION_PREFIX));
}

export function getUserQuestion(messages: ThreadMessage[]) {
    return findUserQuestionMessage(messages)?.user.replace(USER_QUESTION_PREFIX, '');
}
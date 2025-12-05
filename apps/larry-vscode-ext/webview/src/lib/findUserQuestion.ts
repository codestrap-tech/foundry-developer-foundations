import { ThreadMessage } from "./backend-types";

const USER_QUESTION_PREFIX = '# User Question:';
export function findUserQuestionMessage(messages: ThreadMessage[]) {
    return messages.filter(message => message.role === 'user').find(message => message.content.startsWith(USER_QUESTION_PREFIX));
}

export function getUserQuestion(messages: ThreadMessage[]) {
    return findUserQuestionMessage(messages)?.content.replace(USER_QUESTION_PREFIX, '');
}
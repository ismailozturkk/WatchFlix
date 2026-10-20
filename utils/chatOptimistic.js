export const createMessageClientId = (uid, now = Date.now, random = Math.random) =>
  `${uid || "user"}-${now()}-${random().toString(36).slice(2, 9)}`;

export const mergeServerMessages = (serverMessages, currentMessages, chatId) => {
  const optimisticClientIds = new Set(
    currentMessages
      .filter((message) => message._optimistic === true && message._chatId === chatId)
      .map((message) => message.clientId)
      .filter(Boolean),
  );
  const confirmedClientIds = new Set(
    serverMessages
      .filter((message) => message._pendingWrite !== true)
      .map((message) => message.clientId)
      .filter(Boolean),
  );
  const pending = currentMessages.filter(
    (message) =>
      message._optimistic === true &&
      message._chatId === chatId &&
      !confirmedClientIds.has(message.clientId),
  );
  const visibleServerMessages = serverMessages.filter(
    (message) =>
      !(
        message._pendingWrite === true &&
        message.clientId &&
        optimisticClientIds.has(message.clientId)
      ),
  );
  return [...pending, ...visibleServerMessages];
};

export const removeOptimisticMessage = (messages, clientId) =>
  messages.filter(
    (message) => !(message._optimistic === true && message.clientId === clientId),
  );

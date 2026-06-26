const sessions = new Map();

export const setGameSessionResult = (sessionId, result) => {
  if (!sessionId) return;
  sessions.set(sessionId, { ...result, updatedAt: Date.now() });
};

export const getGameSessionResult = (sessionId) => sessions.get(sessionId) || null;

export const deleteGameSessionResult = (sessionId) => {
  if (sessionId) sessions.delete(sessionId);
};

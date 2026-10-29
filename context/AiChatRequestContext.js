import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

// CineMatch sohbetini açma isteği için kalıcı kuyruk. Sekme çubuğundaki yapay
// zeka düğmesi isteği yazar, ChatModal mount olunca tüketir. ChatModal
// performans için gecikmeli mount edildiğinden EventEmitter kullanılamaz:
// ilk saniyelerdeki dokunuş, dinleyici kurulmadan yayınlanıp kaybolurdu.
const AiChatRequestContext = createContext(undefined);

export const AiChatRequestProvider = ({ children }) => {
  const [pendingAiRequest, setPendingAiRequest] = useState(null);

  const requestAiChat = useCallback((request = {}) => {
    setPendingAiRequest({
      ...request,
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }, []);

  const clearAiChatRequest = useCallback((requestId) => {
    setPendingAiRequest((current) => {
      if (!current || (requestId && current.requestId !== requestId)) return current;
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({ pendingAiRequest, requestAiChat, clearAiChatRequest }),
    [pendingAiRequest, requestAiChat, clearAiChatRequest],
  );

  return <AiChatRequestContext.Provider value={value}>{children}</AiChatRequestContext.Provider>;
};

export const useAiChatRequest = () => {
  const context = useContext(AiChatRequestContext);
  if (context === undefined) {
    throw new Error("useAiChatRequest must be used within an AiChatRequestProvider");
  }
  return context;
};

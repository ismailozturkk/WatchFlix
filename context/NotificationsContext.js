// context/NotificationsContext.js
//
// Bildirim listesi + okunmamış sayacı.
// UnreadCount UserProfileContext'ten geliyor (denormalize counter alanı) —
// burada da hesaplanabilir ama tek doğru kaynak Users dokümanı.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeToNotifications,
  markNotificationRead as markReadApi,
  markAllNotificationsRead as markAllApi,
  deleteNotification as deleteApi,
  respondToInvitation as respondApi,
} from "../services/notificationsService";
import { writeInviteResponse } from "../services/chatInviteService";
import { chatTargetOf } from "../utils/importantInvites";
import useStartupGate from "../hooks/useStartupGate";

const NotificationsContext = createContext();
export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [state, setState] = useState({ uid: null, items: [], loading: true });
  const [retryKey, setRetryKey] = useState(0);
  // Never expose the previous account's inbox during an auth transition.
  const current = state.uid === uid ? state : { items: [], loading: !!uid };
  const { items, loading, error = null, cursor = null, hasMore = false } = current;

  // Sekme çubuğunda rozet yok; items'ı yalnız bildirim ekranı ve
  // DeviceNotifications'ın uygulama-rozeti/ön-plan gösterimi tüketiyor. O
  // tüketici `loading` true iken zaten hiçbir şey yapmıyor; kapı açılıp İLK
  // snapshot gelince "mevcutları bilinen say" tohumlaması normal işliyor —
  // erteleme geriye dönük (backfill) bildirim ÜRETMEZ. Kademeler:
  // hooks/useStartupGate.js.
  const startupReady = useStartupGate(2800);

  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) {
      setState({ uid, items: [], loading: false });
      return;
    }
    let active = true;
    setState({ uid, items: [], loading: true });
    const unsub = subscribeToNotifications(uid, (list, page = {}) => {
      if (active) setState({ uid, items: list, loading: false, ...page });
    }, (error) => {
      if (active) setState((previous) => ({ ...previous, loading: false, error }));
    });
    return () => { active = false; unsub(); };
  }, [uid, startupReady, retryKey]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  const markRead = useCallback(
    async (notifId) => {
      if (!uid) return;
      const item = items.find((n) => n.id === notifId);
      if (item?.read) return;
      await markReadApi(uid, notifId);
    },
    [uid, items],
  );

  const markAll = useCallback(async () => {
    if (!uid) return 0;
    return markAllApi(uid);
  }, [uid]);

  const remove = useCallback(
    async (notifId) => {
      if (!uid) return;
      const item = items.find((n) => n.id === notifId);
      await deleteApi(uid, notifId, item && !item.read);
    },
    [uid, items],
  );

  // Davete yanıt (yüzen davet kartı, components/floatingNotice): önce bildirim kaydı (bir kez, cihazlar arası), sonra
  // aynı yanıt davetin sohbet kartına — iki tarafın kartı kabul/ret durumuna döner (utils/chatInvites).
  // Kayıtta mesaj kimliği yoksa (eski davet) kart değişmez; kart yazımı düşerse yanıt geri alınmaz.
  const respond = useCallback(async (notifId, decision) => {
    if (!uid) return false;
    const saved = await respondApi(uid, notifId, decision);
    const item = saved ? items.find((n) => n.id === notifId) : null;
    if (item) {
      writeInviteResponse({ uid, chat: chatTargetOf(item), messageId: item.messageId, response: decision })
        .catch((error) => {
          if (__DEV__) console.warn("inviteCardResponse:", error?.message);
        });
    }
    return saved;
  }, [uid, items]);

  const value = useMemo(
    () => ({ items, loading, error, cursor, hasMore, retry, markRead, markAll, remove, respond }),
    [items, loading, error, cursor, hasMore, retry, markRead, markAll, remove, respond],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

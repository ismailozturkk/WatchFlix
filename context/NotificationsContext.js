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
} from "../services/notificationsService";
import useStartupGate from "../hooks/useStartupGate";

const NotificationsContext = createContext();
export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sekme çubuğunda rozet yok; items'ı yalnız bildirim ekranı ve
  // DeviceNotifications'ın uygulama-rozeti/ön-plan gösterimi tüketiyor. O
  // tüketici `loading` true iken zaten hiçbir şey yapmıyor; kapı açılıp İLK
  // snapshot gelince "mevcutları bilinen say" tohumlaması normal işliyor —
  // erteleme geriye dönük (backfill) bildirim ÜRETMEZ. Kademeler:
  // hooks/useStartupGate.js.
  const startupReady = useStartupGate(3400);

  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToNotifications(uid, (list) => {
      setItems(list);
      setLoading(false);
    });
    return () => unsub();
  }, [uid, startupReady]);

  const markRead = useCallback(
    async (notifId) => {
      if (!uid) return;
      const item = items.find((n) => n.id === notifId);
      if (!item || item.read) return;
      await markReadApi(uid, notifId, item.read);
    },
    [uid, items],
  );

  const markAll = useCallback(async () => {
    if (!uid) return;
    await markAllApi(uid);
  }, [uid]);

  const remove = useCallback(
    async (notifId) => {
      if (!uid) return;
      const item = items.find((n) => n.id === notifId);
      await deleteApi(uid, notifId, item && !item.read);
    },
    [uid, items],
  );

  const value = useMemo(
    () => ({ items, loading, markRead, markAll, remove }),
    [items, loading, markRead, markAll, remove],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

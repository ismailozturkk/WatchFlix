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

const NotificationsContext = createContext();
export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [uid]);

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

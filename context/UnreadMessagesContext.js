// context/UnreadMessagesContext.js
//
// Okunmamış 1-1 ve grup mesajlarının toplamı, iki tüketici:
//   • Profildeki "Mesajlar" butonunun rozeti (screens/tabs/ProfileScreen.js)
//   • Uygulama simgesi rozeti (context/DeviceNotificationsContext.js)
//
// Eskiden sayıyı yalnız ProfileScreen kendi listener'ıyla okuyordu; profil
// ekranı mount olmadıkça (ya da uygulama arka plandayken) rozet hesaplanamıyor,
// sonunda OS rozeti "okunmamış bildirim dokümanı" sayısına bağlanmıştı ve hiç
// sıfırlanmıyordu. Artık sayı tek yerden, her yerde aynı.
//
// Kaynaklar: conversations.unreadCount, groupInbox.unread ve eski istemcilerin
// groups.unread haritası. Ayrılınan grup ile engellenen sohbet sayılmaz.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import useStartupGate from "../hooks/useStartupGate";
import { snapshotErrorHandler } from "../utils/firestoreError";
import { trackFirestoreRead } from "../services/usageTrackerService";
import { toCount } from "../utils/appBadge";

const UnreadMessagesContext = createContext({ unreadMessages: 0, ready: false });
export const useUnreadMessages = () => useContext(UnreadMessagesContext);

export function UnreadMessagesProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [state, setState] = useState({ direct: null, groupInbox: null, groups: null, blockedIds: null });

  // Açılış yolundaki hiçbir ekran bu sayıyı ilk karede okumuyor; listener'ı
  // boş bir kademe dilimine ertele (Notifications 2800 ile Device 3600
  // arası). Kademe tablosu: hooks/useStartupGate.js.
  const startupReady = useStartupGate(3000);

  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) {
      setState({ direct: null, groupInbox: null, groups: null, blockedIds: null });
      return undefined;
    }
    // Hesap değişiminde eski hesabın sayısı yeni hesapta görünmesin.
    setState({ direct: null, groupInbox: null, groups: null, blockedIds: null });
    let active = true;
    const unsubDirect = onSnapshot(
      collection(db, "Users", uid, "conversations"),
      (snap) => {
        if (!active) return;
        trackFirestoreRead("Users/conversations", snap.docs.length);
        const direct = new Map();
        snap.forEach((d) => {
          direct.set(d.id, toCount(d.data()?.unreadCount));
        });
        setState((prev) => ({ ...prev, direct }));
      },
      (err) => {
        if (!active) return;
        snapshotErrorHandler("conversationsUnread")(err);
        // Hata durumunda "0" göstermek rozeti yanlışlıkla silerdi: hazır
        // değil say, tüketiciler mevcut rozete dokunmasın.
        setState((prev) => ({ ...prev, direct: null }));
      },
    );
    const unsubInbox = onSnapshot(
      collection(db, "Users", uid, "groupInbox"),
      (snap) => {
        if (!active) return;
        trackFirestoreRead("Users/groupInbox", snap.docs.length);
        const groupInbox = {};
        snap.forEach((d) => { groupInbox[d.id] = toCount(d.data()?.unread); });
        setState((prev) => ({ ...prev, groupInbox }));
      },
      (err) => {
        if (!active) return;
        snapshotErrorHandler("groupInboxUnread")(err);
        setState((prev) => ({ ...prev, groupInbox: null }));
      },
    );
    const unsubGroups = onSnapshot(
      query(collection(db, "groups"), where("members", "array-contains", uid)),
      (snap) => {
        if (!active) return;
        trackFirestoreRead("groups/unreadMembership", snap.docs.length);
        const groups = new Map(snap.docs.map((d) => [d.id, toCount(d.data()?.unread?.[uid])]));
        setState((prev) => ({ ...prev, groups }));
      },
      (err) => {
        if (!active) return;
        snapshotErrorHandler("groupUnreadMembership")(err);
        setState((prev) => ({ ...prev, groups: null }));
      },
    );
    const unsubBlocked = onSnapshot(
      collection(db, "Users", uid, "blocked"),
      (snap) => {
        if (!active) return;
        trackFirestoreRead("Users/blockedUnread", snap.docs.length);
        setState((prev) => ({ ...prev, blockedIds: new Set(snap.docs.map((d) => d.id)) }));
      },
      (err) => {
        if (!active) return;
        snapshotErrorHandler("blockedUnread")(err);
        setState((prev) => ({ ...prev, blockedIds: null }));
      },
    );
    return () => {
      active = false;
      unsubDirect(); unsubInbox(); unsubGroups(); unsubBlocked();
    };
  }, [uid, startupReady]);

  const value = useMemo(
    () => {
      const ready = state.direct !== null && state.groupInbox !== null &&
        state.groups !== null && state.blockedIds !== null;
      let unreadMessages = 0;
      if (state.direct && state.blockedIds) {
        for (const [id, count] of state.direct) {
          if (!state.blockedIds.has(id)) unreadMessages += count;
        }
      }
      if (state.groupInbox && state.groups) {
        for (const [id, legacyUnread] of state.groups) {
          unreadMessages += (state.groupInbox[id] || 0) + legacyUnread;
        }
      }
      return { unreadMessages, ready };
    },
    [state.direct, state.groupInbox, state.groups, state.blockedIds],
  );

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

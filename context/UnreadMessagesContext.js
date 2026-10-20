// context/UnreadMessagesContext.js
//
// Okunmamış 1-1 mesajların toplamı — TEK listener, iki tüketici:
//   • Profildeki "Mesajlar" butonunun rozeti (screens/tabs/ProfileScreen.js)
//   • Uygulama simgesi rozeti (context/DeviceNotificationsContext.js)
//
// Eskiden sayıyı yalnız ProfileScreen kendi listener'ıyla okuyordu; profil
// ekranı mount olmadıkça (ya da uygulama arka plandayken) rozet hesaplanamıyor,
// sonunda OS rozeti "okunmamış bildirim dokümanı" sayısına bağlanmıştı ve hiç
// sıfırlanmıyordu. Artık sayı tek yerden, her yerde aynı.
//
// Kaynak: Users/{uid}/conversations/{otherUid}.unreadCount. Karşı taraf mesaj
// yazarken artırır, alıcının ChatScreen'i sohbet açılınca sıfırlar. Grup
// sohbetlerinin sayacı (groups/{id}.unread.{uid}) yalnız Mesajlar ekranındaki
// "Gruplar" sekmesinde gösterilir; buradaki toplama ve rozete GİRMEZ
// (bkz. utils/appBadge.js).

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { collection, onSnapshot } from "firebase/firestore";
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

  const [state, setState] = useState({ unreadMessages: 0, ready: false });

  // Açılış yolundaki hiçbir ekran bu sayıyı ilk karede okumuyor; listener'ı
  // boş bir kademe dilimine ertele (Notifications 2800 ile Device 3600
  // arası). Kademe tablosu: hooks/useStartupGate.js.
  const startupReady = useStartupGate(3000);

  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) {
      setState({ unreadMessages: 0, ready: false });
      return undefined;
    }
    // Hesap değişiminde eski hesabın sayısı yeni hesapta görünmesin.
    setState({ unreadMessages: 0, ready: false });
    const unsub = onSnapshot(
      collection(db, "Users", uid, "conversations"),
      (snap) => {
        trackFirestoreRead("Users/conversations", snap.docs.length);
        let total = 0;
        snap.forEach((d) => {
          total += toCount(d.data()?.unreadCount);
        });
        setState({ unreadMessages: total, ready: true });
      },
      (err) => {
        snapshotErrorHandler("conversationsUnread")(err);
        // Hata durumunda "0" göstermek rozeti yanlışlıkla silerdi: hazır
        // değil say, tüketiciler mevcut rozete dokunmasın.
        setState({ unreadMessages: 0, ready: false });
      },
    );
    return () => unsub();
  }, [uid, startupReady]);

  const value = useMemo(
    () => ({ unreadMessages: state.unreadMessages, ready: state.ready }),
    [state.unreadMessages, state.ready],
  );

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

// hooks/usePremiumUsage.js
//
// "Kullanım ve haklar" ekranının veri kaynağı: her premium kapının SAYDIĞI şeyi
// kapılarla aynı yerden okur, böylece ekranda görünen ile kapının uyguladığı
// ayrışmaz. Hiçbir sayaç burada yeniden hesaplanmaz — zaten bir sahibi olan
// değerler toplanır:
//
//   arkadaş / liste / ortak liste / not / yapılacak / film-dizi notu / hatırlatma
//       → ilgili context'lerin canlı verisi (kapılarla AYNI sayım kuralı)
//   günlük oyun / CineSwipe hakları → services/premiumUsage (cihaz sayacı)
//   AI mesajları                    → AiUsage/{uid} (sunucu yazar, istemci okur)
//   sahip olunan grup sayısı        → tek seferlik sorgu (ekran açılınca)
//
// Dönen `usage` utils/premiumUsageModel.js `buildUsageModel` girdisidir.
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFriends } from "../context/FriendsContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { useSharedLists } from "../context/SharedListsContext";
import { useProfileNotes } from "../context/ProfileNotesContext";
import { useMediaNotes } from "../context/MediaNotesContext";
import { usePremium } from "../context/PremiumContext";
import { countOwnedGroups } from "../services/groupsService";
import { useDailyUsed } from "../services/premiumUsage";
import { isAuthTransitionError } from "../utils/firestoreError";
import { readAiUsageDoc } from "../utils/premiumUsageModel";
import useReminderGate from "./useReminderGate";

export default function usePremiumUsage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { plan } = usePremium();
  const { friends = [], outgoingRequests = [] } = useFriends() || {};
  const { otherListKeys = [], combinedLists } = useListStatusContext() || {};
  const { sharedLists = [] } = useSharedLists() || {};
  const { noteCounts } = useProfileNotes() || {};
  const { mediaNoteCounts } = useMediaNotes() || {};
  const { movieCount, tvCount } = useReminderGate();

  const games = useDailyUsed("games");
  const cineRooms = useDailyUsed("cineswipe_rooms");
  const cineSwipes = useDailyUsed("cineswipe_swipes");

  // ── AI: sunucunun yazdığı sayaç, canlı ──
  const [aiDoc, setAiDoc] = useState(undefined); // undefined = henüz okunmadı, null = belge yok
  useEffect(() => {
    if (!uid) {
      setAiDoc(undefined);
      return undefined;
    }
    return onSnapshot(
      doc(db, "AiUsage", uid),
      (snap) => setAiDoc(snap.exists() ? snap.data() : null),
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__) {
          console.warn("[PremiumUsage] AiUsage:", err?.message);
        }
      },
    );
  }, [uid]);

  // ── Kurduğun grup sayısı: tek sorgu, ekran her açıldığında tazelenir ──
  const [ownedGroups, setOwnedGroups] = useState(null);
  useEffect(() => {
    if (!uid) return undefined;
    let active = true;
    countOwnedGroups(uid)
      .then((count) => {
        if (active) setOwnedGroups(count);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uid]);

  const ownedSharedLists = useMemo(
    () => sharedLists.filter((list) => list.ownerId === uid).length,
    [sharedLists, uid],
  );

  const watchlistSize = Array.isArray(combinedLists?.watchList)
    ? combinedLists.watchList.length
    : null;

  const usage = useMemo(
    () => ({
      // Kapıyla aynı sayım: arkadaşlar + bekleyen giden istekler (FriendsContext).
      friends: friends.length + outgoingRequests.length,
      chat_groups: ownedGroups,
      custom_lists: otherListKeys.length,
      shared_lists: ownedSharedLists,
      notes: noteCounts?.note ?? null,
      todos: noteCounts?.todo ?? null,
      movie_notes: mediaNoteCounts?.movie ?? null,
      tv_notes: mediaNoteCounts?.tv ?? null,
      movie_reminders: movieCount,
      tv_reminders: tvCount,
      games,
      cineswipe_rooms: cineRooms,
      cineswipe_swipes: cineSwipes,
      // Platform bildirimi: izleme listesinin son N yapımı takipte; "kullanılan"
      // listenin boyu (üst sınırı model uygular).
      streaming_alerts: watchlistSize,
      // aiDoc undefined iken (henüz okunmadı) sayaç "bilinmiyor" kalır: 0 göstermek
      // yanıltıcı olurdu.
      ai: aiDoc === undefined ? null : readAiUsageDoc(aiDoc),
    }),
    [
      friends.length,
      outgoingRequests.length,
      ownedGroups,
      otherListKeys.length,
      ownedSharedLists,
      noteCounts,
      mediaNoteCounts,
      movieCount,
      tvCount,
      games,
      cineRooms,
      cineSwipes,
      watchlistSize,
      aiDoc,
    ],
  );

  return { plan, usage };
}

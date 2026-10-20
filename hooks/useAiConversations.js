// hooks/useAiConversations.js
//
// CineMatch sohbet geçmişi (bulut yedekli, yerel-öncelikli) — React bağlayıcısı.
//
//   const { conversations, save, remove, clearAll, trim, refresh } = useAiConversations();
//
// `conversations` yerel kopyadan SENKRON gelir (ilk karede dolu), en yeni en üstte.
// Yazmalar yerelde + günlükte anında olur, buluta arka planda gider; hiçbiri ağı
// beklemez. Buluta DİNLEYİCİ açılmaz. Şema ve bütçe:
// services/userData/aiConversations.js.
//
//   ready      yerel kopya hazır mı
//   hydrating  tek seferlik indirme sürüyor mu (yalnız yeni telefon / yeniden kurulum)
//   waiting    kopya yok VE indirme sürmüyor (çevrimdışı yeni cihaz)
//   refresh()  başka cihazdaki değişiklikleri çeker (Promise<boolean>)

import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { getActiveUser } from "../services/storage";
import { aiConversations, aiConversationsDomain, flushUserData } from "../services/userData";
import useUserDataDomain from "./useUserDataDomain";

export default function useAiConversations() {
  const { user } = useAuth();
  // Oturum asenkron çözülür; ilk karede son aktif kullanıcının yerel kopyası.
  const uid = user?.uid ?? getActiveUser();
  const view = useUserDataDomain(aiConversationsDomain);

  const save = useCallback(
    (conversation, options) => aiConversations.save(uid, conversation, options),
    [uid],
  );
  const remove = useCallback((id) => aiConversations.remove(uid, id), [uid]);
  const clearAll = useCallback(() => aiConversations.clearAll(uid), [uid]);
  const trim = useCallback((limit) => aiConversations.trim(uid, limit), [uid]);
  // Önce bekleyen yazımları göndermeyi dene: indirme sırasında onaylanan bir
  // yazım bulut cevabında olmayıp günlükten de silinmiş olurdu (createDomain.js).
  // Çevrimdışıysa flush kısa sürede döner ve resync zaten hiçbir şey yapmaz.
  const refresh = useCallback(async () => {
    if (!user?.uid) return false;
    await flushUserData(user.uid, { timeoutMs: 3000 }).catch(() => {});
    return aiConversationsDomain.resync(user.uid);
  }, [user?.uid]);

  return useMemo(
    () => ({
      uid,
      conversations: view.lists.items,
      ready: view.ready,
      hydrating: view.hydrating,
      waiting: view.waiting,
      error: view.error,
      save,
      remove,
      clearAll,
      trim,
      refresh,
    }),
    [uid, view, save, remove, clearAll, trim, refresh],
  );
}

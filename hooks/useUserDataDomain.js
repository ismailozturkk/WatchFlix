// hooks/useUserDataDomain.js
//
// Yerel-öncelikli bir alanın (services/userData) görünümünü React'e bağlar.
//
//   const view = useUserDataDomain(notesDomain);
//   view.lists.items   → sıralı dizi (senkron, ilk karede dolu)
//   view.ready         → yerel kopya hazır mı
//   view.hydrating     → tek seferlik indirme sürüyor mu (yalnız yeni cihaz/sıfırlama)
//   view.waiting       → kopya yok VE indirme sürmüyor (çevrimdışı yeni cihaz)
//
// Görünüm referansı YALNIZ veri değiştiğinde değişir (useSyncExternalStore).
// Buluta dinleyici AÇMAZ.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "../context/AuthContext";
import { getActiveUser } from "../services/storage";

export default function useUserDataDomain(domain) {
  const { user } = useAuth();
  const authUid = user?.uid ?? null;
  // Firebase oturumu ASENKRON çözülür; ilk karede `user` null olabilir. Son aktif
  // kullanıcı depodan senkron okunabildiği için ilk kare onun yerel kopyasıyla
  // çizilir (çıkışta setActiveUser(null) yapıldığı için sızıntı yok).
  const uid = authUid ?? getActiveUser();

  const getSnapshot = useCallback(() => domain.getSnapshot(uid), [domain, uid]);
  const view = useSyncExternalStore(domain.subscribe, getSnapshot, getSnapshot);

  // Yerel kopya varsa bu çağrı ağa gitmez. Yoksa tek seferlik indirir.
  useEffect(() => {
    if (authUid) domain.ensureHydrated(authUid);
  }, [domain, authUid]);

  return view;
}

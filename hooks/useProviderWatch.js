// hooks/useProviderWatch.js
//
// Sunucunun yazdığı ProviderWatch/{uid} belgesini (hangi izleme listesi başlığı hangi platformda
// izlenebilir) dinler; istemci yalnız okur (firestore.rules). Karar mantığı utils/providerWatch.js'te.
//
// `active` false iken dinleyici açılmaz: yalnız izleme listesi ekranında gerekli, başka listelerde
// boşuna okuma yok (hooks/useAiQuota.js ile aynı kalıp). Belge küçük (≤100 başlık × birkaç sayı).
//
// Dönüş: { snapshot, loaded } — `snapshot` belge yoksa null; `loaded` ilk yanıt (ya da hata) geldi mi.
// Hata (ör. çevrimdışı, kural reddi) "belge yok" gibi davranır: süzgeç "no-data" açıklamasına düşer,
// ekran bozulmaz.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { isAuthTransitionError } from "../utils/firestoreError";
import { normalizeProviderWatch } from "../utils/providerWatch";

export default function useProviderWatch({ active = true } = {}) {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const [state, setState] = useState({ uid: null, snapshot: null, loaded: false });

  useEffect(() => {
    if (!uid || !active) return undefined;
    return onSnapshot(
      doc(db, "ProviderWatch", uid),
      (snap) =>
        setState({ uid, snapshot: snap.exists() ? normalizeProviderWatch(snap.data()) : null, loaded: true }),
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__) {
          console.warn("[useProviderWatch] ProviderWatch:", err?.message);
        }
        setState({ uid, snapshot: null, loaded: true });
      },
    );
  }, [uid, active]);

  // Hesap değişince eski kullanıcının belgesi yeni kullanıcıya sızmasın.
  if (!uid || !active || state.uid !== uid) return { snapshot: null, loaded: false };
  return { snapshot: state.snapshot, loaded: state.loaded };
}

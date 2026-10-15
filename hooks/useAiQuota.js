// hooks/useAiQuota.js
//
// AI mesaj hakkının canlı kullanımı: sunucunun yazdığı AiUsage/{uid} belgesini
// dinler (istemci yalnız okur). CineMatch üst çubuğundaki kota ölçeri, panel daha
// hiç mesaj göndermeden de gerçek kalan hakkı gösterebilsin diye.
//
// `active` false iken dinleyici açılmaz (panel kapalıyken boşuna okuma yok).
// Dönüş: { dailyUsed, monthlyUsed } ya da henüz okunmadıysa null — 0 göstermek
// yanıltıcı olurdu (bkz. usePremiumUsage'taki aynı karar).

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { isAuthTransitionError } from "../utils/firestoreError";
import { readAiUsageDoc } from "../utils/premiumUsageModel";

export default function useAiQuota({ active = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!uid || !active) return undefined;
    return onSnapshot(
      doc(db, "AiUsage", uid),
      (snap) => setUsage(readAiUsageDoc(snap.exists() ? snap.data() : null)),
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__) {
          console.warn("[useAiQuota] AiUsage:", err?.message);
        }
      },
    );
  }, [uid, active]);

  return uid ? usage : null;
}

// context/WatchProgressContext.js
//
// `useWatchProgress`u UYGULAMADA TEK KEZ çalıştıran sağlayıcı.
//
// NEDEN GEREKLİ: hook iki ekranda birden çağrılıyordu (ProfileScreen ve
// WatchBadgesScreen). React Navigation stack'inde profil, rozet ekranı
// açıldığında mount'ta KALDIĞI için ikisi aynı anda canlı oluyordu ve bu iki şeyi
// birden ikiye katlıyordu:
//
//   1. 512 film + 3.400 bölümlük TEK GEÇİŞ hesabı iki kez koşuyordu.
//   2. Daha önemlisi: İKİ defter mutabakatı effect'i aynı AsyncStorage anahtarı
//      üzerinde yarışıyordu. Sonuç şans eseri bozulmuyordu (birleştirme monoton,
//      gün damgası idempotent, kutlama yalnız ProfileScreen'de tüketiliyor) ama
//      her işaretlemede iki oku-değiştir-yaz döngüsü çalışıyordu ve tohumlama
//      GERİ ALINAMAZ olduğu için bu yarışın bir gün ısırması an meselesiydi.
//
// Sağlayıcı ProfileStatsProvider'ın İÇİNDE mount edilmeli: hook onun verisinden
// türüyor (yeni Firestore listener AÇMAZ, bu sistemin temel sözleşmesi).

import React, { createContext, useContext } from "react";
import useWatchProgress from "@hooks/useWatchProgress";

const WatchProgressContext = createContext(null);

export function WatchProgressProvider({ children }) {
  // Hook'un dönüşü zaten useMemo'lu; ekstra bir sarmalama gereksiz ve
  // tüketicilerdeki React.memo'yu boşa çıkarırdı.
  const deger = useWatchProgress();
  return (
    <WatchProgressContext.Provider value={deger}>
      {children}
    </WatchProgressContext.Provider>
  );
}

/**
 * Sağlayıcı yoksa `null` döner, ATMAZ. Tüketiciler zaten `progress || {}` ve
 * `loading` ile çalışıyor; bir ekran yanlışlıkla ağacın dışında render edilirse
 * çökmek yerine iskelet göstermesi doğru davranış.
 */
export function useWatchProgressContext() {
  return useContext(WatchProgressContext);
}

export default WatchProgressContext;

// hooks/useReduceMotion.js
//
// Sistemin "Hareketi Azalt" erişilebilirlik ayarı. Sürekli dönen dekoratif
// animasyonlar (kar efekti ve ayarlardaki önizlemesi) bu açıkken hiç
// çizilmemeli — kullanıcı bunu tam da bu tür hareketleri görmemek için açıyor.
//
// Ayrı dosya: aynı kontrolü iki yerde kopyalamak, birinde güncelleme dinleyicisi
// unutulduğunda ayarın yalnız bazı ekranlarda etkili olmasına yol açardı.

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export default function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}

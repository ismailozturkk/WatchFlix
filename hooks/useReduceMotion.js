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

// Son bilinen değer. Hook'un ilk kullanıcısı (kar/ambiyans, uygulama açılışında)
// değeri okuyunca sonraki ekranlar İLK karede doğru değerle başlar; yoksa
// "Hareketi Azalt" açık kullanıcıya giriş animasyonları ilk bağlanışta yine de
// oynardı (okuma asenkron, başlangıç değeri false).
let lastKnown = false;

export default function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(lastKnown);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        lastKnown = enabled;
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        lastKnown = enabled;
        setReduceMotion(enabled);
      },
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}

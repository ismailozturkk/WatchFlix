// hooks/useEntranceGate.js
//
// Izgara/liste ekranlarında "içerik ilk yüklenirken animasyonlu belirsin"
// kararını verir. Dönen `shouldAnimate()` çağrıldığı anda şunu söyler:
//   • sistem "Hareketi Azalt" açıksa → false (hiç animasyon yok)
//   • veri hazır olduktan sonraki kısa pencere içindeyse → true
//   • pencere kapandıysa (arama/filtre/kaydırmayla sonradan bağlananlar) → false
//
//   const shouldAnimate = useEntranceGate(itemsReady);
//   <StaggerItem index={i} animate={shouldAnimate()}>…</StaggerItem>
//
// `shouldAnimate` kararlı bir fonksiyondur ve render sırasında çağrılır; sonucu
// StaggerItem yalnız BAĞLANDIĞI anda okur, sonraki render'larda değişmesi
// zaten çizilmiş öğeleri etkilemez. Pencere mantığı utils/entranceGate.js'te.

import { useCallback, useEffect, useRef } from "react";
import useReduceMotion from "./useReduceMotion";
import { createEntranceGate } from "../utils/entranceGate";

export default function useEntranceGate(ready = true, windowMs) {
  const reduceMotion = useReduceMotion();
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = createEntranceGate(windowMs);

  useEffect(() => {
    if (ready) gateRef.current.start();
  }, [ready]);

  useEffect(() => () => gateRef.current.dispose(), []);

  return useCallback(() => !reduceRef.current && gateRef.current.isOpen(), []);
}

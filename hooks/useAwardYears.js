// hooks/useAwardYears.js
//
// Oscar / Emmy yıl seçicisinin yıl listesi. İlk çizim GÖMÜLÜ yapılandırmadan (senkron, boş
// liste yok); `active` olunca servisin önbellek-öncelikli `getConfig`i okunur ve uzak
// yapılandırmadaki yıllar (ör. yeni eklenen 2028) listeye yansır. Bağlam zaten rafı
// etkinleştirirken aynı yapılandırmayı okuduğu için bu çağrı çoğunlukla önbellekten döner.
import { useEffect, useMemo, useState } from "react";
import { buildAwardYears } from "../utils/awardYears";

export default function useAwardYears({ active, getConfig, fallbackItems }) {
  const [items, setItems] = useState(fallbackItems);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    Promise.resolve(getConfig())
      .then((config) => {
        if (!cancelled && Array.isArray(config?.items) && config.items.length > 0) {
          setItems(config.items);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, getConfig]);

  return useMemo(() => buildAwardYears(items), [items]);
}

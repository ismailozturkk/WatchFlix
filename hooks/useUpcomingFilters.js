// hooks/useUpcomingFilters.js
//
// "Yaklaşan Filmler" süzgecinin kalıcı durumu. Karar mantığı utils/upcomingFilters.js'te (saf, testli);
// burada yalnız depoya bağlama — hooks/useDiscoverFilterStore.js ile aynı kalıp.
//
// NEDEN DEPODA (bağlam state'inde değil): "Tümü" ekranı (screens/shared/SeeAllScreen.js) kendi
// MovieProvider örneğini kurar. Süzgeç bağlamda dursaydı "Tümü" hep varsayılanla açılırdı; depoda
// durunca iki örnek de aynı kayda abone olur, birinde yapılan değişiklik ötekine anında yansır.
import { useMemo } from "react";
import { Keys, remove, set, useStored } from "../services/storage";
import { isoDate } from "../utils/discoverFilters";
import { normalizeUpcomingFilters, toStoredUpcomingFilters } from "../utils/upcomingFilters";

/**
 * Normalize edilmiş süzgeç. Ham kayıt ve takvim günü değişmedikçe AYNI nesne döner (istek efektleri
 * buna bağlı). Gün değişince yeniden normalize edilir: geçmişte kalan ay/aralık varsayılana düşer.
 */
export function useUpcomingFilters() {
  const raw = useStored(Keys.upcomingFilters);
  const day = isoDate(new Date());
  // `day` bilerek bağımlılıkta: normalize "bugün"e göre karar veriyor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => normalizeUpcomingFilters(raw, new Date()), [raw, day]);
}

/** Süzgeci yazar; varsayılansa anahtar silinir (diskte boş kayıt dolaşmasın). */
export function writeUpcomingFilters(filters) {
  const stored = toStoredUpcomingFilters(filters);
  return stored === null ? remove(Keys.upcomingFilters) : set(Keys.upcomingFilters, stored);
}

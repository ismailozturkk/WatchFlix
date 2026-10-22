// hooks/useSectionVisibility.js
//
// Film / Dizi / Eğlence ("hub") / Kütüphane / Profil ekranlarının bölüm görünürlüğü
// (Ayarlar > Kişiselleştirme > Ekran bölümleri). Karar mantığı utils/sectionVisibility.js'te
// (saf, testli); burada yalnız depoya bağlama.
//
// NEDEN AppSettingsContext'te DEĞİL: değer yalnız bu ekranlara ve ayar sayfasına
// lazım, bağlamın iç içe sağlayıcı zincirine bir halka daha eklemek hiçbir şey
// kazandırmazdı. `useStored` (services/storage) değeri React'e senkron bağlar: ayar
// sayfasında bir anahtara basınca arkada duran Film/Profil ekranı da anında güncellenir.
//
// YAZMA SON KAYITTAN OKUR (kapanıştaki state'ten değil): arka arkaya iki hızlı
// dokunuş, ilk yazımın sonucunu ezmesin. Depo senkron olduğu için okuma-değiştir-yaz
// tek turda biter.
import { useMemo } from "react";
import { Keys, get, remove, set, useStored } from "../services/storage";
import {
  countHiddenSections,
  filterVisibleSections,
  isSectionVisible,
  normalizeSectionVisibility,
  setScreenSectionsVisible,
  setSectionVisible,
  storedSectionsOf,
  toStoredSectionVisibility,
} from "../utils/sectionVisibility";

/** Normalize edilmiş gizli bölüm haritası ({ tv: [...], movie: [...], hub: [...], library: [...], profile: [...] }). */
export function useSectionVisibilityMap() {
  const raw = useStored(Keys.sectionVisibility);
  return useMemo(() => normalizeSectionVisibility(raw), [raw]);
}

/**
 * Bir ekranın bölüm görünürlüğü. Dönen nesne `hidden` değişmedikçe AYNI kalır —
 * memo'lu çocuklara ve `useMemo` bağımlılıklarına güvenle verilebilir.
 *
 * @param {"tv"|"movie"|"hub"|"library"|"profile"} screen
 * @returns {{
 *   hidden: Record<string, string[]>,
 *   isVisible: (section: string) => boolean,
 *   filter: <T>(items: T[], idOf?: (item: T) => string) => T[],
 *   hiddenCount: number,
 *   allHidden: boolean,
 * }}
 */
export default function useScreenSections(screen) {
  const hidden = useSectionVisibilityMap();
  return useMemo(() => {
    const hiddenCount = countHiddenSections(hidden, screen);
    return {
      hidden,
      isVisible: (section) => isSectionVisible(hidden, screen, section),
      filter: (items, idOf) => filterVisibleSections(hidden, screen, items, idOf),
      hiddenCount,
      // Saklanan bölümlerin HEPSİ gizli (boş ekran bildirimi için). Eski tek anahtarlı
      // bölümler (Devam Edenler) sayılmaz; Film/Dizi boşluğu listeden ölçülür.
      allHidden: hiddenCount > 0 && hiddenCount >= storedSectionsOf(screen).length,
    };
  }, [hidden, screen]);
}

/**
 * Depoya yazar. Hiçbir şey gizli kalmadıysa anahtarı SİLER (yedekte ve diskte boş
 * nesne dolaşmasın). @returns {boolean} yazım başarılı mı
 */
function write(update) {
  const current = normalizeSectionVisibility(get(Keys.sectionVisibility));
  const stored = toStoredSectionVisibility(update(current));
  return stored === null ? remove(Keys.sectionVisibility) : set(Keys.sectionVisibility, stored);
}

/** Tek bir bölümü aç/kapat. */
export const setSectionShown = (screen, section, visible) =>
  write((hidden) => setSectionVisible(hidden, screen, section, !!visible));

/** Bir ekranın tüm bölümlerini aç/kapat. */
export const setScreenSectionsShown = (screen, visible) =>
  write((hidden) => setScreenSectionsVisible(hidden, screen, !!visible));

/** Her şeyi varsayılana (hepsi görünür) döndür. */
export const resetSectionVisibility = () => remove(Keys.sectionVisibility);

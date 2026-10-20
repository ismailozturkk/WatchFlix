// utils/deviceLanguage.js
//
// Cihaz dilinden uygulama dilini seçen SAF mantık.
//
// NEDEN: depoda kayıtlı dil yokken varsayılan "tr" idi, yani uygulamayı ilk kez
// açan HER yabancı kullanıcı Türkçe bir ekranla karşılaşıyordu. Seçim burada
// yapılıyor. Native modül henüz cihazdaki uygulama paketine eklenmemişse
// uygulamanın açılışta çökmesini önlemek için okuma güvenli bir sınır içinde
// yapılıyor.

import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGE_CODES,
} from "./appLanguages";

// Tek kaynak: utils/appLanguages.js. Yeni dil orada kayıt edilince cihaz dili
// seçimi de onu tanır (ör. İspanyolca cihaz → "es").
export const DESTEKLENEN_DILLER = SUPPORTED_LANGUAGE_CODES;

// Cihaz dili okunamadığında "tr" DEĞİL "en" seçilir: kayıtlı dili olmayan bir
// kullanıcının Türk olma ihtimali, dili hiç bildirmeyen bir cihazda düşük —
// Türkçe cihazlar dilini zaten bildiriyor. Yanlış tahminin bedeli asimetrik:
// İngilizce açılan Türk kullanıcı ayarı bulur, Türkçe açılan yabancı bulamaz.
export const YEDEK_DIL = FALLBACK_LANGUAGE;

/**
 * expo-localization native modülü eski bir development/preview uygulamasında
 * bulunmayabilir. Paketi dosya yüklenirken statik import etmek bu durumda JS
 * çalışmaya başlamadan uygulamayı çökertir. Gecikmeli require + güvenli yedek,
 * yeni native build kurulana kadar uygulamanın kayıtlı dil/yedek dil ile
 * açılabilmesini sağlar.
 *
 * Loader parametresi yalnız saf birim testinde native bağımlılığı ayırmak için
 * enjekte edilir.
 *
 * @param {() => {getLocales?: () => Array}|null} localizationLoader
 * @returns {Array}
 */
export function cihazDilleriniOku(
  localizationLoader = () => require("expo-localization"),
) {
  try {
    const getLocales = localizationLoader()?.getLocales;
    return typeof getLocales === "function" ? getLocales() : [];
  } catch {
    return [];
  }
}

/**
 * @param {Array<{languageCode?: string|null}>} locales
 *   expo-localization `getLocales()` çıktısı (tercih sırasına göre).
 * @returns {"tr"|"en"}
 */
export function cihazDilindenSec(locales) {
  if (!Array.isArray(locales)) return YEDEK_DIL;

  // Yalnız İLK geçerli dil bakılır — cihazın birinci tercihi budur. Listede
  // ilerideki "tr" kaydı kullanıcının ikincil dili demektir, birincisi değil.
  for (const locale of locales) {
    const kod = locale?.languageCode;
    if (typeof kod !== "string" || !kod) continue;
    const kisa = kod.trim().toLowerCase().split(/[-_]/)[0];
    if (!kisa) continue;
    return DESTEKLENEN_DILLER.includes(kisa) ? kisa : YEDEK_DIL;
  }

  return YEDEK_DIL;
}

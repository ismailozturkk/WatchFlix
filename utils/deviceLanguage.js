// utils/deviceLanguage.js
//
// Cihaz dilinden uygulama dilini seçen SAF mantık.
//
// NEDEN: depoda kayıtlı dil yokken varsayılan "tr" idi, yani uygulamayı ilk kez
// açan HER yabancı kullanıcı Türkçe bir ekranla karşılaşıyordu. Seçim burada
// yapılıyor; cihazdan okuma (expo-localization) çağıran tarafta kalıyor ki bu
// dosya native modül olmadan test edilebilsin.

export const DESTEKLENEN_DILLER = ["tr", "en"];

// Cihaz dili okunamadığında "tr" DEĞİL "en" seçilir: kayıtlı dili olmayan bir
// kullanıcının Türk olma ihtimali, dili hiç bildirmeyen bir cihazda düşük —
// Türkçe cihazlar dilini zaten bildiriyor. Yanlış tahminin bedeli asimetrik:
// İngilizce açılan Türk kullanıcı ayarı bulur, Türkçe açılan yabancı bulamaz.
export const YEDEK_DIL = "en";

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

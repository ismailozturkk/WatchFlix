// components/badges/badgeFormat.js
//
// Rozet yüzeylerinin ORTAK METİN BİÇİMLEYİCİLERİ — saf, React importu yok.
//
// Nadirlik adları ve tarih biçimi eskiden WatchBadgeDetailModal'ın içinde
// gömülüydü; kart, kayan raflar ve kutlama aynı adlara ihtiyaç duyunca ya
// kopyalanacak ya da modalden import edilecekti (ikisi de yanlış). Burada tek
// kaynak.
//
// TARİH ELLE BİÇİMLENİR, `toLocaleDateString` KULLANILMAZ: Hermes'in Intl desteği
// cihaz/sürüme göre değişiyor, ay adı bazı Android'lerde sayıya düşüyor. 12 ay ×
// iki dil = 24 kısa dize; belirleyici ve test edilebilir.

// Nadirlik adları katalog emsaliyle INLINE tutulur (81 rozet metni de öyle):
// beş kademe × iki dil = 10 dize için autoI18n anahtarı açmaya değmez.
import { copyLanguage } from "../../utils/appLanguages";

export const NADIRLIK_AD = Object.freeze({
  common: { tr: "Yaygın", en: "Common", es: "Común", pt: "Comum", de: "Gewöhnlich" },
  uncommon: { tr: "Az Bulunur", en: "Uncommon", es: "Poco común", pt: "Incomum", de: "Ungewöhnlich" },
  rare: { tr: "Nadir", en: "Rare", es: "Rara", pt: "Rara", de: "Selten" },
  epic: { tr: "Destansı", en: "Epic", es: "Épica", pt: "Épica", de: "Episch" },
  legendary: { tr: "Efsanevi", en: "Legendary", es: "Legendaria", pt: "Lendária", de: "Legendär" },
});

/** Bilinmeyen nadirlikte anahtarın kendisini döndürür (boş etiket çizmez). */
export const nadirlikAdi = (rarity, lang = "tr") =>
  NADIRLIK_AD[rarity]?.[copyLanguage(lang, ["tr", "en", "es", "pt", "de"])] || String(rarity || "");

const AYLAR = Object.freeze({
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
});

/**
 * "2026-10-15" → "15 Ekim 2026" / "Oct 15, 2026". Geçersiz girdide null (çağıran
 * etiketi hiç çizmez; "NaN Undefined" yazmaktan iyidir).
 */
export function formatTarih(gunAnahtari, lang = "tr") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(gunAnahtari || ""));
  if (!m) return null;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const gun = Number(m[3]);
  if (ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
  const code = copyLanguage(lang, ["tr", "en", "es", "pt", "de"]);
  if (code === "en") return `${AYLAR.en[ay - 1]} ${gun}, ${yil}`;
  if (code === "es") return `${gun} de ${AYLAR.es[ay - 1]} de ${yil}`;
  return `${gun} ${AYLAR.tr[ay - 1]} ${yil}`;
}

/**
 * Yüzdeyi tamsayıya çevirir ama 0 ve 100 UÇLARINI korur: 0,4% "0%" ve 99,6% "100%"
 * yazmak "başladım ama sıfır" / "bitti" yalanı olurdu. Küçük ilerleme en az %1,
 * eksik tamamlanma en çok %99 görünür.
 */
export function yuzde(oran) {
  const o = Number(oran);
  if (!Number.isFinite(o) || o <= 0) return 0;
  if (o >= 1) return 100;
  return Math.min(99, Math.max(1, Math.round(o * 100)));
}

/** Yüzde işareti dile göre: Türkçe "%47", diğerleri "47%". */
export const yuzdeMetni = (oran, lang = "tr") =>
  copyLanguage(lang, ["tr", "en", "es", "pt", "de"]) === "tr" ? `%${yuzde(oran)}` : `${yuzde(oran)}%`;

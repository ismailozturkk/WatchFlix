import i18n from "../translations";

export function i18nText(key, fallback, options) {
  // Varlık `exists` ile sorulur, dönen metnin anahtardan farklı olmasıyla değil:
  // çeviri anahtarla AYNI olabiliyor (en.json `"votes": "votes"`) ve eski
  // `value !== key` denetimi bunu eksik sayıp Türkçe yedeği gösteriyordu (T3 B5).
  if (!i18n.exists(key, options)) return fallback;
  const value = i18n.t(key, { defaultValue: fallback, ...options });
  return value || fallback;
}

/**
 * Yüzde metni dilin yazımıyla: Türkçe "%70", Almanca "70 %", diğerleri "70%".
 * Dil verilmezse uygulamanın o anki dili kullanılır.
 */
export function percentText(value, language = i18n.language) {
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  if (code === "tr") return `%${value}`;
  if (code === "de") return `${value} %`;
  return `${value}%`;
}

/**
 * Büyük harf, uygulama diliyle: argümansız `toLocaleUpperCase()` CİHAZ diline
 * bakar; Türkçe telefonda İngilizce arayüz "FİLM CHAİN" yazıyordu.
 */
export function upperText(text, language = i18n.language) {
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  return String(text ?? "").toLocaleUpperCase(code === "tr" ? "tr-TR" : code === "de" ? "de-DE" : code === "it" ? "it-IT" : "en-US");
}

/**
 * Sayılı metin: sayı 1 ise `${key}_tekil` (varsa), yoksa çoğul anahtar.
 * compatibilityJSON v3'ün çoğul kuralları dillerimizle tutarsız olduğu için
 * i18next çoğulu yerine açık tekil anahtar ("1 Freunde" → "1 Freund").
 */
export function i18nCount(key, fallback, n) {
  if (n === 1 && i18n.exists(`${key}_tekil`)) {
    return i18nText(`${key}_tekil`, fallback, { n });
  }
  return i18nText(key, fallback, { n });
}

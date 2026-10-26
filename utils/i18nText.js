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

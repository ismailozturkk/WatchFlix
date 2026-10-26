import i18n from "../translations";

export function i18nText(key, fallback, options) {
  // Varlık `exists` ile sorulur, dönen metnin anahtardan farklı olmasıyla değil:
  // çeviri anahtarla AYNI olabiliyor (en.json `"votes": "votes"`) ve eski
  // `value !== key` denetimi bunu eksik sayıp Türkçe yedeği gösteriyordu (T3 B5).
  if (!i18n.exists(key, options)) return fallback;
  const value = i18n.t(key, { defaultValue: fallback, ...options });
  return value || fallback;
}

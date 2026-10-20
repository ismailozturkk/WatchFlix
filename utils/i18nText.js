import i18n from "../translations";

export function i18nText(key, fallback, options) {
  const value = i18n.t(key, { defaultValue: fallback, ...options });
  return value && value !== key ? value : fallback;
}

// Ad / avatar bekleme süresi bildirimi — tek metin, iki giriş noktası (avatar seçimi ve
// Profili Düzenle) aynı şeyi söylesin. Karar mantığı utils/profileIdentityCooldown.js'te.
//
// Saat ve dakika AYRI tam cümleler: "{{wait}} sonra…" gibi iç içe değişken, çeviri anahtarı
// eksik kalırsa kullanıcıya ham "{{wait}}" olarak görünürdü (i18nText eksik anahtarda yedeği
// değişken çözmeden döndürür). Ayrıca sözcük sırası dile göre değişiyor.

import { cooldownParts } from "./profileIdentityCooldown";
import { i18nText } from "./i18nText";

/** @returns {{ type: "info", text1: string, text2: string }} Toast.show'a doğrudan verilir. */
export function identityCooldownToast(remainingMs) {
  const { unit, value } = cooldownParts(remainingMs);
  return {
    type: "info",
    text1: i18nText(
      "autoI18n.kimlik_bekleme_baslik",
      "Adını ve avatarını günde bir kez değiştirebilirsin",
    ),
    text2:
      unit === "hour"
        ? i18nText("autoI18n.kimlik_bekleme_saat", "{{n}} saat sonra tekrar deneyebilirsin", { n: value })
        : i18nText("autoI18n.kimlik_bekleme_dakika", "{{n}} dakika sonra tekrar deneyebilirsin", { n: value }),
  };
}

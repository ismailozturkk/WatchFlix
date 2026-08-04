// utils/deviceTier.js
//
// Cihaz sınıfı (tier) kararının SAF mantığı. Burada RN/Expo importu YOK —
// jest.config.js yalnızca saf JS modüllerini test edebiliyor (bkz. Part 23),
// bu yüzden karar tablosu burada, native sabitleri okuyan ince sarmalayıcı
// services/deviceTier.js içinde durur.
//
// NEDEN VAR: dekoratif efektlerin (ikon arka planı, sürekli sprite animasyonu,
// bulanıklaştırma) maliyeti düşük RAM'li Android cihazlarda orantısız. Efektleri
// tamamen kaldırmak yerine düşük katmanda hafifletiyoruz — üst katmanlarda
// görüntü birebir aynı kalır.

const GIB = 1024 * 1024 * 1024;

export const DEVICE_TIERS = ["low", "mid", "high"];

// ── EFEKT MODLARI (kullanıcı tercihi) ────────────────────────────────────────
//
// Cihaz sınıfı artık yalnızca VARSAYILANI seçer; son söz kullanıcınındır
// (Ayarlar → Kişiselleştirme → Efektler). Cihaz sessizce karar verdiğinde
// blur'ün "kaybolması" hata gibi görünüyordu; tercih görünür olunca hem sebebi
// belli olur hem de kullanıcı kendi dengesini kurar.
//
// Üç kaldıraç var ve modlar bunları farklı sırayla feda eder:
//   • blurEnabled          — her karede GPU'da yeniden çizilir (en pahalısı)
//   • iconBackgroundCols/Rows — desen öğe sayısı (mount maliyeti + bellek)
//   • spriteFpsScale       — sürekli çalışan animasyonun kare hızı
//
//   full     "Tam"    kısıtsız: üçü de tam. Görüntü odaklı.
//   balanced "Orta"   blur KALIR (arayüzün kimliği odur), sürekli/yığın
//                     maliyetler kısılır: desen yarıya iner, kare hızı düşer.
//   off      "Kapalı" performans odaklı: blur yok, desen seyrek, en düşük kare
//                     hızı. Fallback olarak yarı saydam düz katman çizilir
//                     (bkz. components/common/AdaptiveBlurView.js).
export const EFFECT_MODES = ["full", "balanced", "off"];

export const EFFECT_MODE_PRESETS = {
  full: {
    iconBackgroundCols: 5,
    iconBackgroundRows: 9,
    spriteFpsScale: 1,
    blurEnabled: true,
  },
  balanced: {
    // 4x7 = 28 desen öğesi (tam modun ~%60'ı)
    iconBackgroundCols: 4,
    iconBackgroundRows: 7,
    spriteFpsScale: 0.7,
    blurEnabled: true,
  },
  off: {
    // 3x5 = 15 desen öğesi (tam modun üçte biri)
    iconBackgroundCols: 3,
    iconBackgroundRows: 5,
    spriteFpsScale: 0.5,
    blurEnabled: false,
  },
};

// HER BASAMAK GÖRÜNÜR OLMALI. İlk denemede "orta" ile "kapalı" aynı desen
// yoğunluğunu paylaşıyordu; aradaki tek fark blur olunca "orta" seçeneği
// varsayılan kurulumda (desen zaten kapalı, pet yoksa) hiçbir şeyi
// değiştirmiyordu — yani kullanıcıya yalan söyleyen bir seçenekti. Şimdi üç
// mod da hem yoğunlukta hem kare hızında ayrışıyor: 45 → 28 → 15 öğe,
// %100 → %70 → %50 kare hızı, blur yalnız "kapalı"da gider.

/** Bilinmeyen mod güvenli ortaya ("balanced") düşer. */
export const getEffectPreset = (mode) =>
  EFFECT_MODE_PRESETS[mode] || EFFECT_MODE_PRESETS.balanced;

/**
 * Kullanıcı bir şey seçmediğinde hangi mod açılır.
 * Bugünkü davranış korunur: yalnız gerçekten zorlanan cihaz (low) kısıtlı
 * başlar, diğer herkes tam efektle. "Orta" bilinçli bir tercihtir — kimseye
 * sessizce dayatılmaz.
 */
export const defaultEffectMode = (tier) => (tier === "low" ? "off" : "full");

// Katman → performans bütçesi. Mod tablosundan TÜRETİLİR ki iki yerde ayrışmasın.
// NOT: "mid" bilerek "high" ile AYNI görsel yoğunlukta. Arka plan deseni
// varsayılan KAPALI bir tercih; açan kullanıcının cihazı yetiyorsa deseni
// seyreltmek görünür bir gerileme olurdu.
export const DEVICE_TIER_PRESETS = {
  low: EFFECT_MODE_PRESETS.off,
  mid: EFFECT_MODE_PRESETS.full,
  high: EFFECT_MODE_PRESETS.full,
};

/**
 * Cihaz sınıfını belirler.
 *
 * @param {object} info
 * @param {number|null} info.totalMemoryBytes  expo-device `totalMemory`
 * @param {number|null} info.deviceYearClass   expo-device `deviceYearClass` (Android)
 * @param {number|null} info.osMajorVersion    işletim sistemi ana sürümü
 * @param {string}      info.platform          "android" | "ios" | diğer
 * @param {boolean}     info.isDevice          gerçek cihaz mı (emülatör değil)
 * @returns {"low"|"mid"|"high"}
 */
export function resolveDeviceTier({
  totalMemoryBytes = null,
  deviceYearClass = null,
  osMajorVersion = null,
  platform = "android",
  isDevice = true,
} = {}) {
  // Emülatör/simülatör: geliştirme makinesinin RAM'i cihazı temsil etmez.
  // Görsel gerilemeyi geliştirmede görmemek için üst katman varsay.
  if (isDevice === false) return "high";

  const memGib =
    typeof totalMemoryBytes === "number" && totalMemoryBytes > 0
      ? totalMemoryBytes / GIB
      : null;

  if (platform === "ios") {
    // Eski iOS sürümleri = eski donanım (iPhone 8 ve öncesi ~2 GB).
    if (typeof osMajorVersion === "number" && osMajorVersion > 0 && osMajorVersion < 15) {
      return "low";
    }
    if (memGib === null) return "mid";
    if (memGib < 2.5) return "low";
    if (memGib < 3.5) return "mid";
    return "high";
  }

  // Android (ve bilinmeyen platformlar): yıl sınıfı varsa ilk sinyal odur.
  if (typeof deviceYearClass === "number" && deviceYearClass > 0 && deviceYearClass <= 2016) {
    return "low";
  }

  if (memGib === null) return "mid"; // bilgi yok → güvenli orta yol
  if (memGib < 3) return "low";
  if (memGib < 6) return "mid";
  return "high";
}

/** Katmanın performans bütçesini döndürür (bilinmeyen katmanda "mid"). */
export function getTierPreset(tier) {
  return DEVICE_TIER_PRESETS[tier] || DEVICE_TIER_PRESETS.mid;
}

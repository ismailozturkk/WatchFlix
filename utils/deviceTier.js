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

// Katman → performans bütçesi.
// NOT: "mid" bilerek "high" ile AYNI görsel yoğunluğa sahip. Arka plan deseni
// varsayılan KAPALI bir tercih; açan kullanıcının cihazı yetiyorsa deseni
// seyreltmek görünür bir gerileme olurdu. Yalnız gerçekten zorlanan (low)
// cihazlarda seyreltiyoruz.
export const DEVICE_TIER_PRESETS = {
  low: {
    // 4x6 = 24 desen öğesi (varsayılanın ~yarısı)
    iconBackgroundCols: 4,
    iconBackgroundRows: 6,
    // Sprite kare hızı çarpanı — daha az kare = daha az UI thread işi
    spriteFpsScale: 0.7,
    // BlurView her karede GPU'da yeniden çizilir; Android'de
    // (experimentalBlurMethod="dimezisBlurView") tüm arka planı offscreen
    // buffer'a alıp bulanıklaştırdığı için liste/detay ekranlarında kare
    // düşüşünün bilinen kaynağı. Kapatıldığında yerine yarı saydam düz bir
    // katman çizilir (bkz. components/common/AdaptiveBlurView.js).
    blurEnabled: false,
  },
  mid: {
    iconBackgroundCols: 5,
    iconBackgroundRows: 9,
    spriteFpsScale: 1,
    blurEnabled: true,
  },
  high: {
    iconBackgroundCols: 5,
    iconBackgroundRows: 9,
    spriteFpsScale: 1,
    blurEnabled: true,
  },
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

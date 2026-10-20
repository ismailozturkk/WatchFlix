// components/common/AdaptiveBlurView.js
//
// BlurView'ın cihaza, platforma ve kullanıcı tercihine duyarlı sarmalayıcısı.
// Uygulamada `expo-blur`ün `BlurView`ini doğrudan import eden TEK yer burası.
//
// NEDEN VAR: blur her karede GPU'da yeniden çizilir; maliyeti ekran alanıyla
// büyür ve düşük RAM'li cihazlarda liste kaydırmada kare düşüşünün bilinen
// kaynaklarından. Modu kullanıcı seçer (Ayarlar → Kişiselleştirme → Efektler);
// cihaz sınıfı yalnız varsayılanı belirler (bkz. services/effectSettings.js).
//
// ── NE ZAMAN GERÇEK BLUR ÇİZİLİR ─────────────────────────────────────────────
//
// Karar tablosu utils/blurSupport.js'te (saf, test edilebilir). Özeti:
//   iOS                          → her zaman gerçek blur
//   Android 12+ ve `blurTarget`  → gerçek blur
//   diğer her durum              → yarı saydam düz katman
//
// Android'de hedef zorunluluğu expo-blur 55'in kırıcı değişikliği; hedefi nasıl
// kuracağınız ve "blur hedefin KARDEŞİ olmalı" kuralı için
// components/common/BlurTarget.js'e bakın.
//
// ÖNEMLİ: blur çizilemeyecekse expo-blur'e HİÇ girmiyoruz. expo-blur'ün kendi
// Android "none" katmanı bizimkinden belirgin daha açık bir formül kullanıyor;
// ikisi yan yana çalışırken "Efektler: Kapalı" seçen kullanıcı açık bırakandan
// daha koyu bir arayüz görüyordu. Tek formül: blurFallbackAlpha.
//
// Çağrı yerleri BlurView'ı bire bir değiştirebilir: `tint`, `intensity`, `style`
// ve diğer props aynı adlarla geçer.
import React from "react";
import { Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import { alpha } from "../../theme/colors";
import { useEffectPreset } from "../../services/effectSettings";
import {
  blurFallbackAlpha,
  isUserDisabledBlur,
  resolveBlurPlan,
  unavailableBlurLayer,
} from "../../utils/blurSupport";

export { blurFallbackAlpha };

/**
 * @param {object}  props
 * @param {"dark"|"light"} [props.tint="dark"]   BlurView tint'i
 * @param {number}  [props.intensity=50]         BlurView yoğunluğu
 * @param {object}  [props.blurTarget]           `useBlurTargetRef()` sonucu.
 *   Android'de gerçek blur'ün ÖN KOŞULU; verilmezse düz katman çizilir.
 * @param {string}  [props.fallbackColor]        Düz katmanda kullanılacak taban
 *   renk (tema token'ı, ör. `theme.tab`). Verilmezse tint'e göre siyah/beyaz.
 * @param {number}  [props.fallbackAlpha]        Opaklığı elle sabitler; verilmezse
 *   `intensity`ten türetilir.
 */
const AdaptiveBlurView = ({
  tint = "dark",
  intensity = 50,
  blurTarget,
  fallbackColor,
  fallbackAlpha,
  style,
  children,
  ...rest
}) => {
  // Abonelik: kullanıcı Ayarlar'dan modu değiştirdiğinde açık ekrandaki blur
  // anında güncellenir (yeniden başlatma gerekmez).
  const { blurEnabled } = useEffectPreset();

  const plan = resolveBlurPlan({
    platform: Platform.OS,
    apiLevel: Platform.Version,
    blurEnabled,
    hasTarget: Boolean(blurTarget),
  });

  if (plan.native) {
    return (
      <BlurView
        tint={tint}
        intensity={intensity}
        blurMethod={plan.blurMethod}
        blurTarget={blurTarget}
        style={style}
        {...rest}
      >
        {children}
      </BlurView>
    );
  }

  // Blur'a özgü props düz View'a sızmasın; geri kalanı (pointerEvents,
  // accessibility*, testID …) View'ın da anladığı props.
  const {
    blurMethod,
    blurReductionFactor,
    // expo-blur 55'te kaldırıldı; çağrı yerlerinde kalmışsa yutulur.
    experimentalBlurMethod,
    ...viewProps
  } = rest;

  // Düşüşün SEBEBİ katmanın nasıl çizileceğini belirler:
  //
  //   • Kullanıcı efektleri KAPATTI → bilerek daha opak katman. Blur yokken
  //     arka planın detayı olduğu gibi kaldığı için üstteki metnin okunması
  //     buna bağlı; kullanıcı da bu görünümü kendi seçti.
  //
  //   • Blur KULLANILAMIYOR (Android'de hedef yok / API < 31) → kullanıcı
  //     hiçbir şey seçmedi, ekran değişmemeli. expo-blur bu durumda kendi yarı
  //     saydam katmanını çiziyordu; onu taklit ediyoruz.
  //
  // Bu ayrım ilk sürümde YOKTU ve iki durumda da opak eğri kullanılınca
  // Android'deki tüm cam yüzeyler mat panele döndü.
  const kullaniciKapatti = isUserDisabledBlur(plan.reason);
  const katman = kullaniciKapatti
    ? {
        color: fallbackColor || (tint === "light" ? "#FFFFFF" : "#000000"),
        alpha: blurFallbackAlpha(intensity),
      }
    : unavailableBlurLayer(intensity, tint);

  // Çağrı yerinin açık tercihi her iki durumda da kazanır (ör. sekme çubuğu
  // etiketlerinin okunabilmesi için sabitlenen opaklık).
  const a = typeof fallbackAlpha === "number" ? fallbackAlpha : katman.alpha;
  const base = fallbackColor || katman.color;

  return (
    <View style={[style, { backgroundColor: alpha(base, a) }]} {...viewProps}>
      {children}
    </View>
  );
};

export default AdaptiveBlurView;

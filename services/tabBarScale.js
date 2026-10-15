// services/tabBarScale.js
//
// iOS 26+ yerel sekme çubuğunu kaydırmayla %20 küçültüp büyüten yerel modülün
// (modules/tab-bar-scale) JS yüzü.
//
// NEDEN VAR: iOS'ta alt çubuk sistemin kendi UIKit çubuğu; `react-native-screens`
// ona ölçek vermiyor, yalnız küçülme MODU seçtiriyor (iOS 26'da sistemin kendi
// "minimize"ı: oranı ayarlanamaz, iOS 18–25'te hiç yok). Görünümü hiç değiştirmeden
// yalnız boyutu sürmek için gerçek UITabBar'ın `transform`u yerel tarafta ayarlanır.
//
// Modül `requireOptionalNativeModule` ile alınır: modül çok eski bir binary'de
// (OTA ile yeni JS gelmiş ama native build yenilenmemiş), Expo Go'da ve Android'de
// YOK. O durumda `nativeTabBarScaleAvailable` false olur ve kabuk ESKİ davranışta
// kalır (`tabBarMinimizeBehavior: "onScrollDown"`) — uygulama çökmez.
//
// Geri almak için: utils/tabBarCollapse.js → TAB_BAR_NATIVE_SCALE_ENABLED = false.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  TAB_BAR_MIN_SCALE,
  TAB_BAR_NATIVE_SCALE_ENABLED,
} from "../utils/tabBarCollapse";

const NativeTabBarScale =
  Platform.OS === "ios" ? requireOptionalNativeModule("SeelogdTabBarScale") : null;

function probeSupport() {
  if (!NativeTabBarScale) return false;
  try {
    // Yerel taraf iOS sürümüne bakar: çubuk yalnız iOS 26+'ta yüzen kapsül;
    // 18–25'te kenardan kenara şerit, ölçeklemek kenarlarda boşluk bırakırdı.
    return NativeTabBarScale.isSupported() === true;
  } catch {
    return false;
  }
}

/** Bu binary'de ve bu iOS sürümünde yerel çubuk ölçeklenebilir mi? */
export const nativeTabBarScaleAvailable =
  TAB_BAR_NATIVE_SCALE_ENABLED && probeSupport();

/** `progress`: 0 (tam boyut) … 1 (tam küçük). Hata yutulur: görsel bir ayrıntı. */
export function setNativeTabBarProgress(progress) {
  if (!nativeTabBarScaleAvailable) return;
  try {
    NativeTabBarScale.setProgress(progress, TAB_BAR_MIN_SCALE);
  } catch {
    // Köprü hatası sekme çubuğunu bozmamalı.
  }
}

/** Çubuğu tam boyuta bırakır (mod değişimi / kabuk kapanışı). */
export function resetNativeTabBarScale() {
  if (!nativeTabBarScaleAvailable) return;
  try {
    NativeTabBarScale.reset();
  } catch {
    // yukarıdaki gibi
  }
}

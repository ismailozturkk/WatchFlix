// components/game/BlurPoster.js
//
// Bulanık Afiş'in afişi: %70 bulanık başlar, tur süresince DOĞRUSAL netleşir (utils/quickGames.js blurAmount).
//
// NEDEN KATMANLI: `blurRadius`ı her karede değiştirmek görüntüyü her seferinde yeniden bulanıklaştırır (Android'de
// Glide dönüşümü, iOS'ta CIFilter) — JS thread'den kare başına native iş. Bunun yerine aynı afiş, sabit yarıçaplı
// birkaç katman olarak BİR KEZ bulanıklaştırılır; en netin üstüne dizilir ve tek sürücü değer (`progress` 0→1)
// native thread'de üstten alta doğru katmanları söndürür. Ara bulanıklıklar komşu iki katmanın karışımıdır.
//
// YARIÇAP ÖLÇEĞİ: "%100 bulanık" = FULL_BLUR_RADIUS. Android'de expo-image yarıçapı 25'te keser ve görüntüyü 4 kat
// küçültüp bulanıklaştırır (etkisi iOS'takinin ~4 katı) — iki platformda benzer görünsün diye tavan farklı.
// Cihazda GÖRÜLMEDİ: başlangıçta başlık okunuyorsa FULL_BLUR_RADIUS'u büyüt.
//
// Saat bu bileşende değil: `running` hook'un saatiyle (arm) birlikte açılır. Cevaplanınca kalan bulanıklık
// yumuşakça kalkar (`revealed`).
//
// HİLE KAPISI: katmanlar ayrı ayrı yüklenir/bulanıklaşır; net katman önce gelirse afiş bir an NET görünürdü.
// Bu yüzden TÜM katmanlar yüklenene (ya da hata verene) kadar üstte opak bir örtü durur, `onReady` de ancak
// o zaman çağrılır (saat o an başlar).

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { BLUR_START } from "@utils/quickGames";

const FULL_BLUR_RADIUS = Platform.OS === "android" ? 25 : 60;
// Bulanıklık oranları: en üstteki başlangıç (BLUR_START), en alttaki 0 (net afiş, her zaman opak).
const LEVELS = [1, 0.75, 0.5, 0.25].map((share) => share * BLUR_START);
const radiusOf = (amount) => Math.max(1, Math.round(amount * FULL_BLUR_RADIUS));
const LAYER_COUNT = LEVELS.length + 1; // + net afiş

export default function BlurPoster({ uri, durationMs, running, revealed, resetKey, theme, borderColor, borderWidth = 1, onReady, children }) {
  const progress = useRef(new Animated.Value(0)).current;
  const cover = useRef(new Animated.Value(1)).current;
  const pausedAt = useRef(0);
  const settled = useRef(new Set());
  const [loaded, setLoaded] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    pausedAt.current = 0;
    cover.setValue(1);
    settled.current = new Set();
    setLoaded(false);
  }, [cover, progress, resetKey, uri]);

  const settle = (layer) => () => {
    if (settled.current.has(layer)) return;
    settled.current.add(layer);
    if (settled.current.size < LAYER_COUNT) return;
    setLoaded(true);
    onReadyRef.current?.();
  };

  useEffect(() => {
    if (!running) {
      progress.stopAnimation((value) => { pausedAt.current = value; });
      return undefined;
    }
    const from = pausedAt.current;
    progress.setValue(from);
    Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, (1 - from) * durationMs),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    return () => progress.stopAnimation((value) => { pausedAt.current = value; });
  }, [durationMs, progress, running]);

  useEffect(() => {
    if (!revealed) return;
    Animated.timing(cover, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [cover, revealed]);

  const span = 1 / LEVELS.length;
  return (
    <View style={[styles.frame, { borderColor: borderColor || theme.border, borderWidth, backgroundColor: theme.secondary }]}>
      {/* En alttaki net afiş: yüklenince saat başlar. */}
      <Image key={`sharp-${uri}`} source={{ uri }} style={styles.fill} contentFit="cover" onLoad={settle("sharp")} onError={settle("sharp")} />
      <Animated.View pointerEvents="none" style={[styles.fill, { opacity: cover }]}>
        {LEVELS.map((amount, index) => (
          // Ters sıra: dizideki ilk (en bulanık) katman en üstte çizilsin.
          <Animated.View
            key={amount}
            // Sönme yalnız saydamlık: katman bir kez dokuya çizilir, her karede yeniden çizilmez (saat çubuğuyla
            // aynı karelerde GPU/UI iş yükü yarışmasın).
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.fill,
              {
                zIndex: LEVELS.length - index,
                opacity: progress.interpolate({
                  inputRange: [index * span, (index + 1) * span],
                  outputRange: [1, 0],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <Image
              key={`${amount}-${uri}`}
              source={{ uri }}
              style={styles.fill}
              contentFit="cover"
              blurRadius={radiusOf(amount)}
              onLoad={settle(amount)}
              onError={settle(amount)}
            />
          </Animated.View>
        ))}
      </Animated.View>
      {!loaded && !revealed ? (
        <View style={[styles.fill, styles.center, { backgroundColor: theme.secondary }]} pointerEvents="none">
          <ActivityIndicator color={theme.text.muted} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 2 / 3, borderRadius: 18, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject },
  center: { zIndex: 10, alignItems: "center", justifyContent: "center" },
});

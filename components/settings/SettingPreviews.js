// components/settings/SettingPreviews.js
//
// Ayar SATIRININ ARKASINDA çalışan küçük önizlemeler. Amaç, "Kar efekti" ve
// "İkon arka planı" ayarlarının ne yaptığını anlatmak yerine GÖSTERMEK:
// kullanıcı açmadan önce satırın zemininde efektin küçültülmüş halini görür.
//
// İkisi de yalnız dekor: pointerEvents="none" ile dokunmayı geçirir, satırın
// kendi metin/anahtar katmanı üstte kalır. Kırpma satırda yapılır (bkz.
// settingsUi.SettingRow → background verildiğinde overflow:"hidden").

import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";

import useAppActive from "../../hooks/useAppActive";
import useReduceMotion from "../../hooks/useReduceMotion";
import {
  getIconBackgroundSource,
  ICON_BACKGROUND_COUNT,
} from "../IconBacground";

/**
 * Kar önizlemesi: satırın zemininde dönen küçük Lottie.
 *
 * Ayar AÇIKKEN kullanılmaz — o durumda kar zaten tüm ekranda yağıyor, satırda
 * ikinci bir Lottie kurmak boşuna maliyet olurdu (bkz. PersonalizationScreen).
 */
// Opaklıklar bilerek düşük: önizleme satırın METNİNİN ARKASINDA duruyor,
// başlık/alt başlık her temada okunur kalmalı.
export function SnowPreview({ opacity = 0.6 }) {
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const lottieRef = useRef(null);

  // Arka planda dönen animasyon çizilmez ama zamanlayıcısı çalışır; durdur.
  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    if (appActive) lottie.resume?.();
    else lottie.pause?.();
  }, [appActive]);

  // "Hareketi Azalt" açıkken hiç çizilmez: önizleme de bir animasyondur.
  if (reduceMotion) return null;

  return (
    <View style={[styles.fill, { opacity }]} pointerEvents="none">
      <LottieView
        ref={lottieRef}
        style={styles.fill}
        source={require("@lottie/snow.json")}
        autoPlay
        loop
        // Kompozisyon tam ekran oranında: "contain" olsaydı 60px'lik şeride
        // sığdırmak için ortada dar bir sütuna büzülürdü. "cover" satırın
        // genişliğini doldurup dikeyde kırpıyor.
        resizeMode="cover"
        // Tam ekran karla aynı hızda akınca dar şeritte telaşlı görünüyor.
        speed={0.6}
      />
    </View>
  );
}

// Önizleme düzeni SABİT TOHUMLU üretiliyor: Math.random ile üretilseydi satır
// her yeniden çizimde başka bir dizilime atlar, ayar ekranı huzursuz görünürdü.
// Aynı sebeple modül seviyesinde bir kez hesaplanır.
const PREVIEW_ITEM_COUNT = 16;

const buildPreviewItems = () => {
  let seed = 20260804;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: PREVIEW_ITEM_COUNT }, (_, index) => ({
    // Yatayda eşit aralıklı taban + küçük sapma: kümelenme olmadan dağınık durur.
    left: `${(index / PREVIEW_ITEM_COUNT) * 100 + rnd() * 3}%`,
    top: 2 + rnd() * 42,
    size: 15 + rnd() * 13,
    rotate: `${Math.round(rnd() * 44 - 22)}deg`,
    source: Math.floor(rnd() * ICON_BACKGROUND_COUNT),
  }));
};

const PREVIEW_ITEMS = buildPreviewItems();

/**
 * İkon deseni önizlemesi: satırın zemininde küçük, eğik duran desen ikonları.
 *
 * Kaynaklar IconBacground'ın lazy listesinden geliyor; 174 asset kaydı ancak
 * kullanıcı bu ekrana geldiğinde yükleniyor (desen hiç açılmamışsa açılışta
 * ödenmiyor — bkz. IconBacground.getSources).
 */
export function IconPatternPreview({ opacity = 0.5 }) {
  const items = useMemo(
    () =>
      PREVIEW_ITEMS.map((item) => ({
        ...item,
        image: getIconBackgroundSource(item.source),
      })).filter((item) => item.image),
    [],
  );

  return (
    <View style={styles.fill} pointerEvents="none">
      {items.map((item, index) => (
        <Image
          key={index}
          source={item.image}
          contentFit="contain"
          style={[
            styles.patternIcon,
            {
              left: item.left,
              top: item.top,
              width: item.size,
              height: item.size,
              opacity,
              transform: [{ rotate: item.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  patternIcon: { position: "absolute" },
});

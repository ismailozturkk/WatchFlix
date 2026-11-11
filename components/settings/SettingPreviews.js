// components/settings/SettingPreviews.js
//
// Ayar SATIRININ ARKASINDA çalışan küçük önizlemeler. Amaç, "Kar efekti",
// "Ambiyans arka planı" ve "İkon arka planı" ayarlarının ne yaptığını anlatmak
// yerine GÖSTERMEK: kullanıcı açmadan önce satırın zemininde efektin
// küçültülmüş halini görür.
//
// Hepsi yalnız dekor: pointerEvents="none" ile dokunmayı geçirir, satırın
// kendi metin/anahtar katmanı üstte kalır. Kırpma satırda yapılır (bkz.
// settingsUi.SettingRow → background verildiğinde overflow:"hidden").

import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";
import WeatherLayer from "../decor/WeatherLayer";

import useAppActive from "../../hooks/useAppActive";
import useReduceMotion from "../../hooks/useReduceMotion";
import useScreenFocused from "../../hooks/useScreenFocused";
import { useDecorSeed } from "../../services/decorSeed";
import {
  AmbientBlobs,
  getSharedAmbientBlobs,
  useAmbientPlaying,
} from "../AmbientBackground";
import {
  getIconBackgroundSource,
  ICON_BACKGROUND_COUNT,
} from "../IconBacground";

/**
 * Hava efekti önizlemesi: satırın zemininde, SEÇİLİ türün (kar/yaprak/...)
 * küçültülmüş hali. Satır ölçülür, parçacık sayısı alanla orantılıdır.
 *
 * Ayar AÇIKKEN kullanılmaz — o durumda efekt zaten tüm ekranda, satırda ikinci
 * bir katman kurmak boşuna maliyet olurdu (bkz. PersonalizationScreen).
 */
// Opaklıklar bilerek düşük: önizleme satırın METNİNİN ARKASINDA duruyor,
// başlık/alt başlık her temada okunur kalmalı.
export function SnowPreview({ opacity = 0.6 }) {
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  // Kişiselleştirme'den daha derine geçilince bu ekran yığında bağlı kalıyor;
  // odak yokken önizleme durmalı (eskiden arkada 60 fps çizmeye devam ediyordu).
  const focused = useScreenFocused();
  const [size, setSize] = useState(null);

  // "Hareketi Azalt" açıkken hiç çizilmez: önizleme de bir animasyondur.
  if (reduceMotion) return null;

  return (
    <View
      style={[styles.fill, { opacity }]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
    >
      {size ? (
        <WeatherLayer
          preview
          width={size.width}
          height={size.height}
          playing={appActive && focused}
          // Tam ekranla aynı hızda akınca dar şeritte telaşlı görünüyor.
          speedScale={0.6}
        />
      ) : null}
    </View>
  );
}

/**
 * Ambiyans önizlemesi: satırın zemininde, gerçek arka planla AYNI renklerde
 * (oturumun ortak leke seti) yavaşça süzülen ışık lekeleri.
 *
 * Ayar AÇIKKEN kullanılmaz — o durumda ışık zaten tüm ekranın arkasında, satırda
 * ikinci bir katman kurmak boşuna olurdu (bkz. PersonalizationScreen). Satırın
 * boyutu ölçülür; lekeler alanın uzun kenarına göre ölçeklenir.
 */
// Opaklık bilerek düşük: önizleme satırın METNİNİN ARKASINDA duruyor.
export function AmbientPreview({ intensity = 0.7 }) {
  const [size, setSize] = useState(null);
  const playing = useAmbientPlaying(true);
  const seed = useDecorSeed();
  const blobs = useMemo(() => getSharedAmbientBlobs(seed).slice(0, 4), [seed]);

  return (
    <View
      style={styles.fill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }}
    >
      {size ? (
        <AmbientBlobs
          width={size.width}
          height={size.height}
          blobs={blobs}
          playing={playing}
          intensity={intensity}
        />
      ) : null}
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
/**
 * `fadeColor` verilirse desenin üstüne, yazının durduğu sol taraftan sağa
 * solan bir perde çizilir: açık temada koyu desen ikonları başlık/alt yazının
 * ÜSTÜNE biniyor, okunmuyordu (T3 B11). Desen sağda (anahtar tarafında) görünür kalır.
 */
export function IconPatternPreview({ opacity = 0.5, fadeColor }) {
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
      {fadeColor ? (
        <LinearGradient
          pointerEvents="none"
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={[alpha(fadeColor, 0.94), alpha(fadeColor, 0.7), alpha(fadeColor, 0)]}
          locations={[0, 0.5, 0.85]}
          style={styles.fill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  patternIcon: { position: "absolute" },
});

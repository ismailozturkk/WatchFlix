import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useIconBackgroundSettings } from "../context/AppSettingsContext";
import { useEffectPreset } from "../services/effectSettings";
import { useDecorSeed } from "../services/decorSeed";
import {
  ICON_SEED_SALT,
  buildIconLayout,
  deriveSeed,
  resolveIconGrid,
  seededRandom,
} from "../utils/decorLayout";

// Desen görselleri ayrı modülde ve LAZY yükleniyor (bkz. iconBackgroundSources.js).
// Bu dosya 10 ekrandan import edildiği için listeyi burada tutmak, ikon arka
// planını hiç açmayan kullanıcıya da 174 asset kaydını açılışta ödetiyordu.
export const ICON_BACKGROUND_COUNT = 174;

let cachedSources = null;
function getSources() {
  if (!cachedSources) {
    // eslint-disable-next-line global-require
    cachedSources = require("./iconBackgroundSources").default;
  }
  return cachedSources;
}

export function getIconBackgroundSource(index) {
  return Number.isInteger(index) && index >= 0
    ? getSources()[index] || null
    : null;
}

// Izgara yoğunluğu kullanıcının "İçerik yoğunluğu" seçiminden gelir; "auto"
// efekt modunu izler (Tam 4x7 = 28, Orta 3x6 = 18, Kapalı 3x4 = 12 — bkz.
// utils/deviceTier.js). Saf yerleşim mantığı utils/decorLayout.js'te.
//
// PERFORMANS NOTLARI
//   • Paylaşımlı modda yerleşim cihazda saklanan TOHUMDAN türer: ilk açılışta
//     bir kez rastgele üretilir, sonra her ekranda ve her açılışta aynı desen.
//     Yerleşim + element ağacı (tohum, ızgara, opaklık) anahtarıyla modül
//     önbelleğinde tek kez kurulur, her ekran aynı referansı kullanır.
//   • Öğe başına sarmalayıcı View YOK: konum/boyut/opaklık doğrudan görselde.
//     Ekran başına native görünüm sayısı yarıya indi (45 öğe = 90 → 45 görünüm).
//   • Katman RASTERLEŞTİRİLMEZ (renderToHardwareTextureAndroid/shouldRasterizeIOS):
//     tam ekran doku her karede ~2,6 MP harmanlar, 28 küçük ikon ~0,4 MP
//     (hesap, cihazda ölçülmedi). Aynı sebeple "deseni tek bitmap'e çiz" fikri
//     ancak bitmap ekran çözünürlüğünün altında tutulursa kazandırır.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("screen");

function buildItems(rand, cols, rows) {
  return buildIconLayout(rand, {
    cols,
    rows,
    width: SCREEN_W,
    height: SCREEN_H,
    iconCount: ICON_BACKGROUND_COUNT,
  });
}

// Verilen öğe listesini desen görsellerine dönüştürür.
function renderItems(items, opacity) {
  const sources = getSources();
  return (
    <View style={styles.background} pointerEvents="none">
      {items.map((item, index) => (
        <Image
          key={index}
          source={sources[item.imgIndex]}
          contentFit="contain"
          style={{
            position: "absolute",
            width: item.size,
            height: item.size,
            top: item.top,
            left: item.left,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

// ── Paylaşımlı ("shared") mod ────────────────────────────────────────────────
// Önbellekler küçük tutulur: tohum değişince (Yeniden oluştur) eskiler boşaltılır.
const sharedItems = new Map();
const sharedElements = new Map();
let cachedSeed = 0;

export function getSharedIconLayout(seed, cols, rows) {
  if (seed !== cachedSeed) {
    sharedItems.clear();
    sharedElements.clear();
    cachedSeed = seed;
  }
  const key = `${cols}x${rows}`;
  if (!sharedItems.has(key)) {
    sharedItems.set(key, buildItems(seededRandom(deriveSeed(seed, ICON_SEED_SALT)), cols, rows));
  }
  return sharedItems.get(key);
}

function getSharedElement(seed, cols, rows, opacity) {
  const items = getSharedIconLayout(seed, cols, rows);
  // Saydamlığı 2 ondalığa yuvarla: sürüklenirken sonsuz farklı float değeriyle
  // önbelleğin şişmesini engeller (fark görsel olarak belirsiz).
  const yuvarlak = Math.round(opacity * 100) / 100;
  const key = `${cols}x${rows}@${yuvarlak}`;
  if (!sharedElements.has(key)) {
    // Kaydırıcı sürüklenirken birikmesin: en fazla birkaç opaklık tutulur.
    if (sharedElements.size > 8) sharedElements.clear();
    sharedElements.set(key, renderItems(items, yuvarlak));
  }
  return sharedElements.get(key);
}

// Ayarlar > Atmosfer'in telefon önizlemesi bunu genel anahtardan bağımsız
// doğrudan çizer (desen aynı tohumdan, ekran boyutunda; önizleme ölçekler).
export function IconPattern({ opacity }) {
  const {
    iconBackgroundMode,
    iconBackgroundOpacity = 1,
    iconBackgroundDensity,
  } = useIconBackgroundSettings();
  const preset = useEffectPreset();
  const seed = useDecorSeed();
  const { cols, rows } = resolveIconGrid(iconBackgroundDensity, preset);

  // Ekranın kendi opaklığı, kullanıcının saydamlık çarpanıyla ölçeklenir (çarpan 1 = değişiklik yok).
  const effectiveOpacity = opacity * iconBackgroundOpacity;

  // Rastgele mod: bu ekran örneğine özel düzen (mount başına bir kez, Math.random).
  const randomItems = useMemo(
    () => (iconBackgroundMode === "random" ? buildItems(Math.random, cols, rows) : null),
    [iconBackgroundMode, cols, rows],
  );

  if (randomItems) return renderItems(randomItems, effectiveOpacity);
  return getSharedElement(seed, cols, rows, effectiveOpacity);
}

// Ayar KAPALIYKEN tohum/efekt modu abonelikleri hiç kurulmaz (57 ekran).
const IconBacground = React.memo(({ opacity = 0.5 }) => {
  const { showIconBackground } = useIconBackgroundSettings();
  if (!showIconBackground) return null;
  return <IconPattern opacity={opacity} />;
});

export default IconBacground;

const styles = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

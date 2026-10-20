// components/AmbientBackground.js
//
// Kişiselleştirme "ambiyans arka planı": ekranın arkasında yavaşça süzülen,
// bulanık görünümlü rengârenk ışık lekeleri. Kar ve ikon deseni gibi
// <ScreenDecor /> üzerinden monte edilir; ekranlara DOĞRUDAN eklenmez.
// Katman sırası: ekran rengi → AMBİYANS → ikon deseni → kar → içerik.
//
// TASARIM KARARLARI
//
//   • Leke = radyal degrade (SVG), blur filtresi YOK. Gerçek blur Android'de
//     BlurTargetView ister, hedefsizse sessizce düz katmana düşer ve her karede
//     yeniden çizilir (bkz. blur-android-target). Yumuşak kenarlı degrade aynı
//     görünümü bedavaya verir ve statik kalır.
//   • Hareket JS'te DEĞİL: tek bir Animated.Value 0→1 turu native sürücüyle
//     döner, her lekenin konumu bu değerden native interpolasyonla türer. Kare
//     başına JS işi yok.
//   • Saat MODÜL SEVİYESİNDE ve ortak. Ekranlar arası geçişte her ekranın kendi
//     animasyonu sıfırdan başlasaydı lekeler her sayfada başka yerde olurdu;
//     ortak saatle geçiş sırasında bile aynı kare görünür (tıpkı paylaşımlı ikon
//     deseni gibi). Renkler/yerleşim de oturum başına bir kez üretilir.
//   • Saat yalnız ekran odakta + uygulama ön planda + "Hareketi Azalt" kapalıyken
//     çalışır; sayacı sıfırlanınca durur. Duran ekranın lekeleri dondurulmuş
//     karede kalır (Hareketi Azalt açıkken de statik bir ışıma görünür — hareket
//     yok, renk var).
//   • Lekeler id'li degrade kullanıyor: react-native-svg'de Defs ad alanı
//     Android'de doküman genelinde global; her örneğe ayrı id (bkz. AuthKit).

import React, { useEffect, useId, useMemo, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useAmbientBackgroundSettings } from "../context/AppSettingsContext";
import { useEffectPreset } from "../services/effectSettings";
import useAppActive from "../hooks/useAppActive";
import useReduceMotion from "../hooks/useReduceMotion";
import useScreenFocused from "../hooks/useScreenFocused";
import {
  AMBIENT_LOOP_MS,
  AMBIENT_MAX_BLOBS,
  ambientLoopMs,
  ambientStops,
  buildAmbientBlobs,
  sampleAmbientPath,
} from "../utils/ambientBackground";

// ── Ortak saat ───────────────────────────────────────────────────────────────

const progress = new Animated.Value(0);
let users = 0;
let generation = 0;
let loopMs = AMBIENT_LOOP_MS;

function runLoop(from, gen) {
  if (gen !== generation) return;
  Animated.timing(progress, {
    toValue: 1,
    duration: Math.max(1, loopMs * (1 - from)),
    easing: Easing.linear,
    useNativeDriver: true,
  }).start(({ finished }) => {
    if (!finished || gen !== generation) return;
    // Yol periyodik: 1'deki konum 0'dakiyle aynı, sıfırlama görünmez.
    progress.setValue(0);
    runLoop(0, gen);
  });
}

function startClock() {
  generation += 1;
  const gen = generation;
  // Değeri native taraftan oku: duran saat kaldığı yerden sürsün, başa sarmasın.
  progress.stopAnimation((value) => runLoop(value >= 1 ? 0 : value, gen));
}

function stopClock() {
  generation += 1;
  progress.stopAnimation();
}

/** Saati kullanıma alır; dönen fonksiyon bırakır. Son kullanıcı bırakınca saat durur. */
function acquireClock(ms) {
  users += 1;
  if (users === 1 || ms !== loopMs) {
    loopMs = ms;
    startClock();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0) stopClock();
  };
}

// ── Ortak yerleşim ───────────────────────────────────────────────────────────

let sharedBlobs = null;
/** Oturum başına bir kez üretilir: ekranlar ve ayar önizlemesi aynı renkleri gösterir. */
export function getSharedAmbientBlobs() {
  if (!sharedBlobs) sharedBlobs = buildAmbientBlobs(Math.random, AMBIENT_MAX_BLOBS);
  return sharedBlobs;
}

/**
 * Saat çalışmalı mı? Dekor yalnız görünürken ve hareket istenirken dönsün.
 * `enabled` false ise (ayar kapalı) hiçbir abonelik kurulmaz.
 */
export function useAmbientPlaying(enabled = true) {
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  return enabled && focused && appActive && !reduceMotion;
}

// ── Leke katmanı ─────────────────────────────────────────────────────────────

/**
 * Verilen alanı (width × height) leke katmanıyla doldurur. Ekranda ve ayar
 * satırının önizlemesinde aynı bileşen kullanılır; leke boyutu alanın uzun
 * kenarına göre ölçeklenir.
 *
 * @param {object[]} blobs     buildAmbientBlobs çıktısı (ön dilim)
 * @param {boolean}  playing   saat bu katman için çalışsın mı
 * @param {number}   speed     efekt modunun hız çarpanı (1 = tam hız)
 * @param {number}   intensity opaklık çarpanı (önizleme daha silik)
 */
export function AmbientBlobs({ width, height, blobs, playing, speed = 1, intensity = 1 }) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (!playing) return undefined;
    return acquireClock(ambientLoopMs(speed));
  }, [playing, speed]);

  const layers = useMemo(() => {
    const unit = Math.max(width, height) * 0.5;
    return blobs.map((blob, index) => {
      const d = Math.round(unit * blob.size);
      const path = sampleAmbientPath(blob);
      return {
        id: `amb${rid}${index}`,
        color: blob.color,
        d,
        left: blob.cx * width - d / 2,
        top: blob.cy * height - d / 2,
        stops: ambientStops(blob.alpha * intensity),
        translateX: progress.interpolate({
          inputRange: path.input,
          outputRange: path.x.map((v) => v * width),
        }),
        translateY: progress.interpolate({
          inputRange: path.input,
          outputRange: path.y.map((v) => v * height),
        }),
        scale: progress.interpolate({
          inputRange: path.input,
          outputRange: path.scale,
        }),
      };
    });
  }, [blobs, width, height, intensity, rid]);

  if (!(width > 0) || !(height > 0)) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {layers.map((layer) => (
        <Animated.View
          key={layer.id}
          style={{
            position: "absolute",
            left: layer.left,
            top: layer.top,
            width: layer.d,
            height: layer.d,
            transform: [
              { translateX: layer.translateX },
              { translateY: layer.translateY },
              { scale: layer.scale },
            ],
          }}
        >
          <Svg width={layer.d} height={layer.d}>
            <Defs>
              <RadialGradient
                id={layer.id}
                cx="50%"
                cy="50%"
                fx="50%"
                fy="50%"
                rx="50%"
                ry="50%"
              >
                {layer.stops.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={layer.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={layer.d} height={layer.d} fill={`url(#${layer.id})`} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Ekran katmanı ────────────────────────────────────────────────────────────

// Ayar açıkken monte edilen iç parça: odak/uygulama durumu/hareket azaltma
// abonelikleri yalnız burada kurulur. Ayar KAPALIYKEN 46 ekranın hiçbiri bu
// abonelikleri taşımaz.
function AmbientLayer() {
  const { ambientBlobCount, spriteFpsScale } = useEffectPreset();
  const playing = useAmbientPlaying(true);
  // Ekran boyutu bir kez alınır, pencere değil `screen`: klavye açılınca pencere
  // küçülüyor (softwareKeyboardLayoutMode: resize) ve lekeler her seferinde
  // yeniden yerleşip zıplardı. Uygulama dikey kilitli; dönmeyi dinlemek gerekmez.
  const [{ width, height }] = useState(() => Dimensions.get("screen"));
  const blobs = useMemo(
    () => getSharedAmbientBlobs().slice(0, ambientBlobCount),
    [ambientBlobCount],
  );

  return (
    <AmbientBlobs
      width={width}
      height={height}
      blobs={blobs}
      playing={playing}
      speed={spriteFpsScale}
    />
  );
}

function AmbientBackground() {
  const { showAmbientBackground } = useAmbientBackgroundSettings();
  if (!showAmbientBackground) return null;
  return <AmbientLayer />;
}

// memo: ebeveyn yeniden çizildiğinde (ayar değişmedikçe) katmanı yeniden kurmaz.
export default React.memo(AmbientBackground);

const styles = StyleSheet.create({
  // overflow:hidden: ekran dışına taşan lekeler durum çubuğuna / komşu satıra
  // sızmasın (Android'de varsayılan görünür).
  layer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
});

// components/ScreenSnow.js
//
// Kişiselleştirme "hava efekti" (kar, yaprak, yağmur, sakura, ateş böceği)
// için TEK, tüm ekranlarda tutarlı katman. Dosya adı ve `snow` dekor kimliği
// tarihsel: ekran bazında seçimler, yedekler ve Premium kapısı (`snow_effect`)
// bu adla kayıtlı, bozulmasın diye değiştirilmedi.
//
//   • Sabit tam ekran katman (scroll'dan bağımsız — parçacık akıp kaybolmaz).
//   • İÇERİĞİN ARKASINDA durur: posterler, kartlar ve tıklanabilir yapılar
//     efektin üstünde kalır; efekt sadece aralardaki boşluklarda görünür.
//   • pointerEvents="none": üstündeki içeriğin dokunmalarını engellemez.
//   • InteractionManager ile geçiş/animasyon bitince render edilir → ekran
//     açılışında ve sekme geçişinde ilk-kare düşmesi (jank) olmaz.
//   • Ekran odaktan çıkınca / uygulama arka plana geçince saat DURUR →
//     görünmeyen katman boşuna kare çizmez; 4 sn içinde dönülmezse tuval
//     bırakılır (GPU belleği).
//   • Sistem "Hareketi Azalt" ayarı açıksa hiç render edilmez.
//   • `showSnow` ayarını kendi içinde okur → ekranların ayrı state'i olmasına
//     gerek yok.
//
// Çizim: components/decor/WeatherLayer → ParticleField (Skia Atlas, tek GPU
// çizimi). Eskiden tam ekran Lottie'ydi (sabit döngü, Android'de CPU çizimi).
//
// Kullanım: ekranlara DOĞRUDAN eklenmez, <ScreenDecor /> üzerinden monte edilir.
// `genres` (detay ekranları): yapımın TMDB türleri → türe göre atmosfer.
// Katman sırası: ekran arka plan rengi → ikon deseni → hava efekti → içerik.

import React, { useEffect, useState } from "react";
import { View, StyleSheet, InteractionManager } from "react-native";
import { useSnowSettings } from "../context/AppSettingsContext";
import useReduceMotion from "../hooks/useReduceMotion";
import useScreenFocused from "../hooks/useScreenFocused";
import useAppActive from "../hooks/useAppActive";
import WeatherLayer from "./decor/WeatherLayer";

const PARK_AFTER_MS = 4000;

function ScreenSnow({ genres }) {
  const { showSnow } = useSnowSettings();
  const focused = useScreenFocused();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const [ready, setReady] = useState(false);
  const [parked, setParked] = useState(false);

  const enabled = showSnow && !reduceMotion;

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return undefined;
    }
    // Ekran yerleşene / geçiş animasyonu bitene kadar bekle.
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel?.();
  }, [enabled]);

  // Odaktan çıkan ekran: önce yalnız saat durur (hızlı geri dönüşte efekt
  // olduğu gibi orada). PARK_AFTER_MS boyunca odak dönmezse tuval tamamen
  // bırakılır — her Skia tuvali tam ekran bir GPU yüzeyi tutar (1080p'de
  // ~10 MB) ve yığında 5-6 ekran birikebiliyor. Geri dönünce
  // geçiş bittikten sonra yeniden kurulur: doku paylaşımlı, parçacıklar
  // tohumdan ve konum saatten → efekt kaldığı yerden yumuşakça belirir.
  useEffect(() => {
    if (!enabled) return undefined;
    if (focused) {
      if (!parked) return undefined;
      const task = InteractionManager.runAfterInteractions(() => setParked(false));
      return () => task.cancel?.();
    }
    if (parked) return undefined;
    const id = setTimeout(() => setParked(true), PARK_AFTER_MS);
    return () => clearTimeout(id);
  }, [enabled, focused, parked]);

  if (!enabled || !ready || parked) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <WeatherLayer playing={focused && appActive} genres={genres} />
    </View>
  );
}

// memo: parent yeniden render olduğunda (showSnow değişmedikçe) katmanı
// gereksiz yere yeniden kurmaz.
export default React.memo(ScreenSnow);

const styles = StyleSheet.create({
  // zIndex 0: kardeş sırası belirleyici olsun — efekt, kendinden SONRA gelen
  // içeriğin (kartlar, posterler) altında kalır.
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
});

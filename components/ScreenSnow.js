// components/ScreenSnow.js
//
// Kişiselleştirme "kar efekti" için TEK, optimize edilmiş ve tüm ekranlarda
// tutarlı bileşen. Daha önce her ekran kendi LottieView overlay'ini (kimi
// scroll'un içinde, kimi dışında) elle kuruyordu; bu bileşen o kalıbı toplar:
//
//   • Sabit tam ekran katman (scroll'dan bağımsız — kar akıp kaybolmaz).
//   • İÇERİĞİN ARKASINDA durur: posterler, kartlar ve tıklanabilir yapılar
//     karın üstünde kalır; kar sadece aralardaki boşluklarda görünür.
//   • pointerEvents="none": üstündeki içeriğin dokunmalarını engellemez.
//   • InteractionManager ile geçiş/animasyon bitince render edilir → ekran
//     açılışında ve sekme geçişinde ilk-kare düşmesi (jank) olmaz.
//   • Ekran odaktan çıkınca / uygulama arka plana geçince animasyon DURUR →
//     görünmeyen kar boşuna 30 fps tam ekran redraw yaptırmaz. (enableFreeze
//     çoğu durumda zaten hallediyor ama iki platformda da garanti değil.)
//   • Sistem "Hareketi Azalt" ayarı açıksa hiç render edilmez.
//   • `showSnow` ayarını kendi içinde okur → ekranların ayrı state'i olmasına
//     gerek yok.
//
// Kullanım: ekranlara DOĞRUDAN eklenmez, <ScreenDecor /> üzerinden monte edilir.
// Katman sırası: ekran arka plan rengi → ikon deseni → kar → içerik.

import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  InteractionManager,
  AppState,
  AccessibilityInfo,
} from "react-native";
import { NavigationContext } from "@react-navigation/native";
import LottieView from "lottie-react-native";
import { useSnowSettings } from "../context/AppSettingsContext";

// useIsFocused yerine manuel abonelik: useIsFocused navigator dışında (modal,
// portal vb.) throw ediyor. Burada context yoksa ekran hep "odakta" sayılır,
// yani bileşen her yerde güvenle kullanılabilir.
function useScreenFocused() {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(
    () => navigation?.isFocused?.() ?? true,
  );

  useEffect(() => {
    if (!navigation) return undefined;
    setFocused(navigation.isFocused());
    const unsubFocus = navigation.addListener("focus", () => setFocused(true));
    const unsubBlur = navigation.addListener("blur", () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  return focused;
}

// Sistem "Hareketi Azalt" ayarı — açıkken kar efekti tamamen kapanır.
function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}

// Uygulama ön planda mı — arka planda kar dönmesin.
function useAppActive() {
  const [active, setActive] = useState(() => AppState.currentState !== "background");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);

  return active;
}

function ScreenSnow() {
  const { showSnow } = useSnowSettings();
  const focused = useScreenFocused();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const [ready, setReady] = useState(false);
  const lottieRef = useRef(null);

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

  // Görünmeyen kar dönmesin. Unmount etmek yerine duraklat: composition
  // yeniden parse edilmez, sekmeye dönünce kaldığı yerden devam eder.
  const playing = enabled && ready && focused && appActive;
  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    if (playing) lottie.resume?.();
    else lottie.pause?.();
  }, [playing]);

  if (!enabled || !ready) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        ref={lottieRef}
        style={styles.fill}
        source={require("@lottie/snow.json")}
        autoPlay
        loop
      />
    </View>
  );
}

// memo: parent yeniden render olduğunda (showSnow değişmedikçe) Lottie'yi
// gereksiz yere yeniden kurmaz.
export default React.memo(ScreenSnow);

const styles = StyleSheet.create({
  // zIndex 0: kardeş sırası belirleyici olsun — kar, kendinden SONRA gelen
  // içeriğin (kartlar, posterler) altında kalır.
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  fill: { flex: 1 },
});

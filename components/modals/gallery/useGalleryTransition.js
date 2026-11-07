// components/modals/gallery/useGalleryTransition.js
//
// Galeri modalının açılış/kapanış durumu makinesi (paylaşılan öğe geçişi).
//
//   closed ──visible──▶ opening ──iniş──▶ open ──!visible──▶ closing ──▶ closed
//
// Açılış: Modal bağlanır; uçan kopya kaynak yuvanın TAM üstünde, SAYDAM kurulur.
// Üç koşul birlikte sağlanınca (pencere sunuldu `onShow`, kök TAM EKRAN yerleşti,
// kopyanın görseli çizildi) uçuş başlar. Kopya yuvanın üstünde belirerek kalkar;
// tam örttüğü karede yuva gizlenir (`onFlierCover`). Kopya ortaya iner; liste
// (aynı görseli aynı yerde, aynı alt katmanla çiziyor) AYNI anda görünür olur,
// kopya sökülür.
//
// Kapanış: ekrandaki görsel kaynak görselse kopya hedefte yeniden bağlanır;
// görseli çizilince liste gizlenir, blur kopyanın dönüşüyle aynı sürede solar.
// Yuvaya yaklaşınca yuva görünür olur ve kopya onun üstünde solarak kaybolur;
// modal bir kare sonra kalkar. Değilse blur + içerik yerinde solar. Açılış
// uçuşu sürerken kapatılırsa kopya bulunduğu yerden geri döner (sıçramaz).
//
// Animasyonlar: uçuş Reanimated (UI iş parçacığı, transform); blur ve içerik
// opaklığı RN Animated native sürücü. Hiçbiri yerleşim (layout) animasyonlamaz.
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Platform } from "react-native";
import { measureWindowRect, relativeRect } from "@utils/measureWindowRect";
import {
  cancelAnimation,
  Easing as REasing,
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const FLIGHT_SPRING = Object.freeze({
  damping: 20,
  stiffness: 190,
  mass: 0.9,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.01,
});
export const FLIGHT_CLOSE_MS = 280;
const BACKDROP_IN_MS = 240;
const BACKDROP_OUT_MS = 220;
const FADE_IN_MS = 200;
// `onShow` bazı Android sürümlerinde gelmeyebiliyor; gelmezse bu kadar sonra başla.
const SHOW_FALLBACK_MS = 260;
// İlk süre yalnız React'in uçan kopyayı bağlamasını bekler. Görsel çözme süresi
// kopya bağlandıktan sonra başlar; büyük arka planlar 600 ms'de yetişmeyebilir.
const FLIER_MOUNT_WAIT_MS = 2000;
const FLIER_LOAD_WAIT_MS = 3000;
// Android'de Modal penceresi ÖNCE durum + gezinme çubuğu kadar küçük (ve durum
// çubuğu kadar aşağıda) yerleşir, `statusBarTranslucent` bir an sonra uygulanıp
// tam ekrana büyür. Kök bu ara yerleşimde kendini (0,0) ölçer ama gerçekte ekranın
// 24 dp aşağısındadır: o anda kurulan kopya yuvanın altından başlar, pencere
// büyüyünce de hedef kayar ("sekme"). Bu yüzden tam ekran yerleşim beklenir;
// gelmezse bu kadar sonra eldeki yerleşimle devam edilir.
const SETTLE_FALLBACK_MS = 320;

// Kök yerleşimi son hâlinde mi (Android: pencere tam ekran oldu mu).
function isSettledLayout(layout) {
  if (Platform.OS !== "android") return true;
  const screen = Dimensions.get("screen");
  return (
    Math.abs(layout.height - screen.height) < 2 && Math.abs(layout.width - screen.width) < 2
  ) || (
    // Yatay/döndürülmüş ekran
    Math.abs(layout.height - screen.width) < 2 && Math.abs(layout.width - screen.height) < 2
  );
}

const raf = (cb) =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(cb, 16);

/**
 * @param {object} p
 * @param {boolean} p.visible
 * @param {{x,y,width,height}|null} p.origin   kaynak yuva (pencere koordinatı)
 * @param {string|null} p.originUri             kaynakta çizilen URL
 * @param {number} p.originRadius
 * @param {Animated.Value|null} p.originOpacity kaynak yuvanın opaklığı
 * @param {() => boolean} p.shouldReturnToSlot  kapanışta ekrandaki görsel kaynak mı
 * @param {() => void} [p.onOpened]             açılış bitti (ağır güncellemeler için)
 */
export default function useGalleryTransition({
  visible,
  origin,
  originUri,
  originRadius = 0,
  originOpacity = null,
  shouldReturnToSlot,
  onOpened,
}) {
  const [mounted, setMounted] = useState(visible);
  const [interactive, setInteractive] = useState(false);
  const [page, setPage] = useState(() => {
    const d = Dimensions.get("window");
    return { width: d.width, height: d.height };
  });
  // { id, mode: "open"|"close", rect, uri, radius } — yalnız uçuş boyunca dolu.
  const [flight, setFlight] = useState(null);

  const progress = useSharedValue(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const phase = useRef("closed");
  const gate = useRef({ shown: false, laidOut: false, wantsFlight: false, flierReady: false, started: false });
  const rootRef = useRef(null);
  const flierTimer = useRef(null);
  const flightRef = useRef(null);
  flightRef.current = flight;
  const flightSeq = useRef(0);
  const showTimer = useRef(null);
  const settleTimer = useRef(null);
  const layoutProbeStartedAt = useRef(0);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  // Pencere (Modal) şu an sunulu mu ve kökün PENCERE konumu. Kaynak yuva da aynı
  // `measureInWindow` ile ölçülür; ikisinin farkı alınınca platformun koordinat
  // sapması (Android'de durum çubuğu kadar kayma) kendiliğinden düşer.
  // Yeniden açılışta tekrar beklenmez.
  const presented = useRef({ shown: false, offset: null });

  const latest = useRef({});
  latest.current = {
    canFly: Boolean(origin && originUri),
    origin,
    originUri,
    originRadius,
    originOpacity,
    shouldReturnToSlot,
    onOpened,
  };

  const setOriginShown = (shown) => latest.current.originOpacity?.setValue(shown ? 1 : 0);
  const clearShowTimer = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = null;
  };
  const clearFlierTimer = () => {
    if (flierTimer.current) clearTimeout(flierTimer.current);
    flierTimer.current = null;
  };

  // Kaynak yuvanın KÖK görünüme göre dikdörtgeni (kök ölçülmeden çağrılmaz).
  const makeFlight = (mode) => {
    const L = latest.current;
    flightSeq.current += 1;
    return {
      id: flightSeq.current,
      mode,
      rect: relativeRect(L.origin, presented.current.offset),
      uri: L.originUri,
      radius: L.originRadius,
    };
  };

  const fallbackOpenFlight = (id) => {
    if (phase.current !== "opening" || flightRef.current?.id !== id ||
        gate.current.started || gate.current.flierReady) return;
    gate.current.wantsFlight = false;
    flightRef.current = null;
    setFlight(null);
    tryStartOpen();
  };

  const fallbackCloseFlight = (id) => {
    const current = flightRef.current;
    if (phase.current !== "closing" || current?.id !== id || current.started) return;
    current.started = true;
    flightRef.current = null;
    setFlight(null);
    setOriginShown(true);
    fadeBackdropOut();
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: BACKDROP_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => finished && finishClose());
  };

  // Açılış uçuşunun kopyasını kur (kök ölçüldükten sonra) ve hazır olmasını bekle.
  const mountOpenFlight = () => {
    if (phase.current !== "opening" || !gate.current.wantsFlight || flightRef.current) return;
    if (!presented.current.offset) return;
    const next = makeFlight("open");
    flightRef.current = next;
    setFlight(next);
    clearFlierTimer();
    flierTimer.current = setTimeout(() => fallbackOpenFlight(next.id), FLIER_MOUNT_WAIT_MS);
  };
  const stopAll = () => {
    cancelAnimation(progress);
    backdropOpacity.stopAnimation();
    contentOpacity.stopAnimation();
  };

  const finishOpen = () => {
    if (phase.current !== "opening") return;
    phase.current = "open";
    // Liste aynı görseli aynı yerde çiziyor: önce o görünür, sonra kopya sökülür.
    contentOpacity.setValue(1);
    // Örtme eşiği tepkisi kaçtıysa bile yuva açıkken gizli kalsın.
    if (gate.current.wantsFlight) setOriginShown(false);
    setFlight(null);
    setInteractive(true);
    latest.current.onOpened?.();
  };

  const finishClose = () => {
    if (phase.current !== "closing") return;
    phase.current = "closed";
    // Kopya yuvanın tam üstünde duruyor: önce yuva görünür, bir kare sonra modal kalkar.
    setOriginShown(true);
    raf(() => {
      if (phase.current !== "closed") return;
      setFlight(null);
      presented.current = { shown: false, offset: null };
      setMounted(false);
    });
  };

  const tryStartOpen = () => {
    const g = gate.current;
    if (phase.current !== "opening" || g.started || !g.shown || !g.laidOut) return;
    const flying = g.wantsFlight;
    if (flying && !g.flierReady) return;
    g.started = true;
    clearShowTimer();
    clearFlierTimer();
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: BACKDROP_IN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (!flying) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start(({ finished }) => finished && finishOpen());
      return;
    }
    // Kopya yuvanın üstünde belirerek kalkar; tam örttüğü karede yuva gizlenir
    // (`onFlierCover`). Önceden gizlemek yuvada bir kare boşluk bırakırdı.
    progress.value = withSpring(1, FLIGHT_SPRING, (finished) => {
      if (finished) runOnJS(finishOpen)();
    });
  };

  // Blur + başlık kopyanın dönüşüyle AYNI anda ve aynı sürede solar; kopya hazır
  // olana dek beklerse blur önden kaybolup kopya boşlukta asılı kalmaz.
  const fadeBackdropOut = (duration = BACKDROP_OUT_MS) => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const runCloseFlight = () => {
    progress.value = withTiming(
      0,
      { duration: FLIGHT_CLOSE_MS, easing: REasing.inOut(REasing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  };

  const prepareOpen = () => {
    clearShowTimer();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    layoutProbeStartedAt.current = Date.now();
    stopAll();
    // Kapanış bitmeden yeniden açıldıysa pencere zaten sunulu: blur/kopya bulunduğu
    // yerden devam eder, sıfırdan başlamaz.
    clearFlierTimer();
    const reopen = presented.current.shown || Boolean(presented.current.offset);
    const L = latest.current;
    phase.current = "opening";
    gate.current = {
      shown: presented.current.shown,
      laidOut: Boolean(presented.current.offset),
      wantsFlight: L.canFly,
      flierReady: false,
      started: false,
    };
    setInteractive(false);
    if (!reopen) backdropOpacity.setValue(0);
    flightRef.current = null;
    setFlight(null);
    if (L.canFly) {
      if (!reopen) progress.value = 0;
      contentOpacity.setValue(0);
      // Kök zaten ölçülüyse (yeniden açılış) kopya hemen kurulur; değilse ölçümde.
      mountOpenFlight();
    } else if (!reopen) {
      contentOpacity.setValue(0);
    }
    showTimer.current = setTimeout(() => {
      presented.current.shown = true;
      gate.current.shown = true;
      // onShow / onLayout yeniden açılan bir Modal'da tekrar gelmeyebilir.
      // Kökü doğrudan ölçerek geçiş kapısının sonsuza dek beklemesini önle.
      if (!gate.current.laidOut) acceptLayout(null);
      tryStartOpen();
    }, SHOW_FALLBACK_MS);
  };

  const beginClose = () => {
    const was = phase.current;
    if (was === "closed" || was === "closing") return;
    phase.current = "closing";
    clearShowTimer();
    clearFlierTimer();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setInteractive(false);
    const L = latest.current;

    if (!gate.current.started) {
      // Hiç başlamadı (pencere daha sunulmadan kapandı): sessizce kaldır.
      stopAll();
      setOriginShown(true);
      setFlight(null);
      finishClose();
      return;
    }

    if (was === "opening" && gate.current.wantsFlight && flightRef.current) {
      // Uçuş sürerken kapatıldı: kopya bulunduğu yerden geri döner.
      fadeBackdropOut(FLIGHT_CLOSE_MS);
      runCloseFlight();
      return;
    }

    const backToSlot = L.canFly && Boolean(L.shouldReturnToSlot?.());
    if (!backToSlot) {
      cancelAnimation(progress);
      setFlight(null);
      setOriginShown(true);
      fadeBackdropOut();
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: BACKDROP_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => finished && finishClose());
      return;
    }

    // Kopya hedefte (progress=1) yeniden bağlanır; görseli çizilince liste gizlenir
    // ve döner. Görsel gelmezse uçuşsuz solmaya düşülür (liste hiç gizlenmez).
    cancelAnimation(progress);
    progress.value = 1;
    const next = makeFlight("close");
    flightRef.current = next;
    setFlight(next);
    flierTimer.current = setTimeout(() => fallbackCloseFlight(next.id), FLIER_MOUNT_WAIT_MS);
  };

  const onFlierMounted = (id) => {
    const current = flightRef.current;
    if (!current || current.id !== id || current.started ||
        (current.mode === "open" && gate.current.flierReady)) return;
    clearFlierTimer();
    flierTimer.current = setTimeout(
      () => current.mode === "open" ? fallbackOpenFlight(id) : fallbackCloseFlight(id),
      FLIER_LOAD_WAIT_MS,
    );
  };

  const onFlierFailed = (id) => {
    if (flightRef.current?.id !== id) return;
    clearFlierTimer();
    if (flightRef.current?.mode === "open") fallbackOpenFlight(id);
    else fallbackCloseFlight(id);
  };

  // Kopyanın GÖRSELİ çizildi (yalnız yerleşmesi yetmez: önbellekteki görsel bile
  // yeni boyutta yeniden çözülür, arada kopya boş kalır).
  const onFlierReady = (id) => {
    const current = flightRef.current;
    if (!current || (id != null && current.id !== id)) return;
    if (current.mode === "open") {
      gate.current.flierReady = true;
      tryStartOpen();
    } else if (phase.current === "closing" && !current.started) {
      current.started = true;
      clearFlierTimer();
      contentOpacity.setValue(0);
      fadeBackdropOut(FLIGHT_CLOSE_MS);
      runCloseFlight();
    }
  };

  // Kopya yuvayı tam örtüyor mu (UI iş parçacığındaki eşik tepkisinden).
  // Örtüyorsa yuva gizlenir; kapanışta eşiğin altına inince yuva görünür olur ve
  // kopya onun üstünde solarak kaybolur.
  const onFlierCover = (id, covering) => {
    const current = flightRef.current;
    if (!current || current.id !== id) return;
    if (covering) {
      if (phase.current === "opening" || phase.current === "open") setOriginShown(false);
    } else {
      setOriginShown(true);
    }
  };

  useEffect(() => {
    if (visible) {
      prepareOpen();
      if (!mountedRef.current) setMounted(true);
      else tryStartOpen();
    } else if (mountedRef.current) {
      beginClose();
    }
    // Yalnız görünürlük değişince; güncel değerler `latest` ref'inden okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      clearShowTimer();
      clearFlierTimer();
      if (settleTimer.current) clearTimeout(settleTimer.current);
      cancelAnimation(progress);
      latest.current.originOpacity?.setValue(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const acceptLayout = (layout) => {
    if (phase.current !== "opening" && phase.current !== "open") return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    // Kökün pencere konumu: kaynak yuva bununla aynı API'den ölçüldü.
    measureWindowRect(rootRef.current, (rect) => {
      if (phase.current !== "opening" && phase.current !== "open") return;
      const size = rect || layout;
      const settled = size && isSettledLayout(size);
      if (
        phase.current === "opening" &&
        !gate.current.started &&
        (!rect || !settled) &&
        Date.now() - layoutProbeStartedAt.current < SETTLE_FALLBACK_MS
      ) {
        settleTimer.current = setTimeout(() => acceptLayout(null), 32);
        return;
      }
      if (size) {
        setPage((prev) =>
          Math.abs(prev.width - size.width) < 0.5 && Math.abs(prev.height - size.height) < 0.5
            ? prev
            : { width: size.width, height: size.height },
        );
      }
      // Ölçüm yoksa uçuşun başlangıç noktası bilinmiyor; solma yine açılmalı.
      if (!rect) gate.current.wantsFlight = false;
      presented.current.offset = rect ? { x: rect.x, y: rect.y } : { x: 0, y: 0 };
      gate.current.laidOut = true;
      mountOpenFlight();
      tryStartOpen();
    });
  };

  const onRootLayout = (e) => {
    const layout = e?.nativeEvent?.layout;
    const valid = layout && layout.width > 0 && layout.height > 0 ? layout : null;
    acceptLayout(valid);
  };

  const onModalShow = () => {
    presented.current.shown = true;
    gate.current.shown = true;
    // Görünürlük değişince aynı boyuttaki kök yeniden onLayout üretmeyebilir.
    // onShow, mevcut native görünümü ölçmek için güvenilir ikinci fırsattır.
    if (!gate.current.laidOut) raf(() => acceptLayout(null));
    tryStartOpen();
  };

  return {
    rootRef,
    mounted,
    interactive,
    page,
    flight,
    progress,
    backdropOpacity,
    contentOpacity,
    onRootLayout,
    onModalShow,
    onFlierMounted,
    onFlierReady,
    onFlierFailed,
    onFlierCover,
    isOpening: () => phase.current === "opening",
  };
}

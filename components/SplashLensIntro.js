// components/SplashLensIntro.js
//
// Açılış ekranı (JS splash): Lens logo animasyonunun uygulama sürümü
// (marketing/marka/yeni-logo, "yıldız" animasyonu). Yerel splash yalnız mürekkep
// zemindir; ilk kare (saat 0'da) onunla birebir aynıdır, sonra:
//
//   1. yıldız alanı belirir, camgöbeği ve kırmızı iki yıldız birbirinin çevresinde
//      sarmal çizerek yaklaşır (yaklaştıkça hızlanır, büyür, ışık izi bırakır),
//   2. çarpışırlar: parlama, şok halkaları, kıvılcımlar; dönüş söner ve iki daire
//      dikey konumda Lens işaretine oturur, kesişimde göz açılır,
//   3. göz bebeği yaylanarak belirir, işaret yukarı kayar, "seelogd" harf harf yükselir,
//   4. veri gelene kadar göz arada bir yana bakar ve kırpar,
//   5. `exiting` olunca içerik hafif büyüyerek solar, zemin en son açılır (`onExited`).
//
// Splash marka hikâyesidir: kullanıcının seçtiği uygulama simgesini İZLEMEZ (diğer
// uygulama içi logoların aksine) — Lens hep aynı biçimde oluşur.
//
// TEMA: yerel splash temayı bilemez, sahne her temada mürekkep uzayda başlar.
// Çarpışmanın şok dalgası ekranı merkezden temanın zeminine (`background`) boyar;
// açık temada yıldızlar söner, yazı ve beyaz süsler mürekkebe döner, durum çubuğu
// koyu simgeye geçer. Çıkışta zemin, altındaki uygulamayla aynı renktedir.
// Renk kararları utils/splashPlan.js → splashPaletteFor.
//
// Hareketin tamamı tek bir saat sürücüsünden (saniye) native tarafta interpolate ile
// türer: süreler/eğriler utils/splashMotion.js'te, ne kadar iş yapılacağı (kalite
// kademesi, yerleşim) utils/splashPlan.js'te (ikisi de saf, test edilir). Tüm
// zamanlayıcılar native ve isInteraction:false.
//
// KASMA BÜTÇESİ: daireler düz View (borderRadius), haleler küçük hazır bitmap
// (assets/splash), göz ve harfler react-native-svg yolu (yazı tipi yüklenmez).
// Konumlar `left/top: 50%` + kenar boşluğuyla ekran merkezine göre: onLayout yok.
// "Kapalı" kademede yıldız alanı, iz, kıvılcım ve bekleme döngüsü çalışmaz;
// Hareketi Azalt'ta işaret ve yazı yerinde solarak belirir.
//
// SAĞLAMLIK: sahne çökerse statik yedek (zemin + Lens işareti) çizilir; çıkışın
// "bitti" haberi kaybolsa bile overlay bir süre sonra zorla sökülür.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { getAppLogoSources } from "./appLogoSources";
import { WORDMARK_LETTERS } from "../data/splashWordmark";
import useReduceMotion from "../hooks/useReduceMotion";
import { captureError } from "../services/crashReporting";
import { getEffectMode } from "../services/effectSettings";
import { DEFAULT_APP_ICON_ID } from "../utils/appIcons";
import {
  DRIFT_DEG,
  DRIFT_MS,
  EXIT_GUARD_MS,
  EXIT_MS,
  EYE_LENGTH,
  EYE_WIDTH,
  FLASH_MAX,
  FLASH_S,
  IDLE_MS,
  INTRO_MS,
  INTRO_S,
  INTRO_TO_FINAL,
  LENS,
  LENS_COLORS,
  SHOCK_MIN,
  SHOCK_RINGS,
  SHOCK_S,
  STILL_WIPE_S,
  T,
  TWINKLE_MS,
  WIPE_S,
  WOBBLE_S,
  blinkFadeAt,
  blinkSepAt,
  clamp01,
  ease,
  exitBackdropOpacityAt,
  exitContentOpacityAt,
  exitContentScaleAt,
  eyeScaleForSep,
  flashOpacityAt,
  flashRadiusAt,
  glintOpacityAt,
  glowAt,
  letterAt,
  lookAt,
  markScaleAt,
  pupilAt,
  riseAt,
  sampleTable,
  sepAt,
  shockOpacityAt,
  shockRadiusAt,
  sizeAt,
  sparkDistanceAt,
  sparkOpacityAt,
  starsInAt,
  stillWipeAt,
  thetaAt,
  toDeg,
  trailAt,
  twinkleAt,
  wipeAt,
  wipeOpacityAt,
} from "../utils/splashMotion";
import { TWINKLE_GROUPS, planSplash, splashPaletteFor, splashQualityFor } from "../utils/splashPlan";

const GLOW = {
  cyan: require("../assets/splash/glow-cyan.png"),
  red: require("../assets/splash/glow-red.png"),
  paper: require("../assets/splash/glow-paper.png"),
};

const CLAMP = { extrapolate: "clamp" };
const lerp = (driver, table) => driver.interpolate({ ...table, ...CLAMP });
const EPS = 0.0001; // sıfır ölçek yerine (tekil dönüşüm matrisi olmasın)

// Ekran (ya da kap) merkezine göre konum: ölçüsüz, onLayout gerektirmez.
const centered = (dx, dy, width, height) => ({
  position: "absolute",
  left: "50%",
  top: "50%",
  marginLeft: dx - width / 2,
  marginTop: dy - height / 2,
  width,
  height,
});

// Göz: iki dairenin kesişimi, ekseni yatay çizilir (dönüşle hizalanır).
const EYE_VIEWBOX = `${-EYE_LENGTH / 2} ${-EYE_WIDTH / 2} ${EYE_LENGTH} ${EYE_WIDTH}`;
const EYE_PATH = `M0 ${-EYE_WIDTH / 2}A${LENS.r} ${LENS.r} 0 0 1 0 ${EYE_WIDTH / 2}A${LENS.r} ${LENS.r} 0 0 1 0 ${-EYE_WIDTH / 2}Z`;

// Hareketi Azalt: işaret ve yazı yerinde solar (dönme/uçma/büyüme yok).
const stillMarkAt = (t) => ease.out(clamp01((t - 0.1) / 0.5));
const stillLetterAt = (t, i) => ease.out(clamp01((t - 0.35 - i * 0.03) / 0.4));

const SPARK_LEN = 12;
const RING_BORDER = 2.5;
const TRAIL_LAG_S = 0.022;
const TRAIL_PEAK = 0.16;
const HALO_PEAK = 0.55;

function buildNodes({ plan, quality, screenW, drivers }) {
  const { clock, exit, idle, twinkle, drift } = drivers;
  const { layout } = plan;
  const u = layout.unit;
  const neg = (node) => Animated.multiply(node, -1);

  const exitOpacity = lerp(exit, sampleTable(exitContentOpacityAt, { from: 0, to: 1, step: 1 / 30 }));
  const nodes = {
    backdropOpacity: lerp(exit, sampleTable(exitBackdropOpacityAt, { from: 0, to: 1, step: 1 / 30 })),
    exitOpacity,
    contentScale: quality.spiral
      ? lerp(exit, sampleTable(exitContentScaleAt, { from: 0, to: 1, step: 1 / 30 }))
      : null,
  };

  // Tema zemini: çarpışma dalgası (Hareketi Azalt'ta kısa geçiş). Açık zeminde
  // yıldızlar dalgayla birlikte söner.
  const { palette } = plan;
  const wipeLevel = quality.spiral ? wipeAt : stillWipeAt;
  if (palette.wipe) {
    if (quality.spiral) {
      const win = { from: T.collide, to: T.collide + WIPE_S };
      nodes.wipeScale = lerp(clock, sampleTable((t) => Math.max(EPS, wipeAt(t)), win));
      nodes.wipeOpacity = lerp(clock, sampleTable(wipeOpacityAt, win));
    } else {
      nodes.wipeOpacity = lerp(clock, sampleTable(stillWipeAt, { to: STILL_WIPE_S }));
    }
  }

  // Yıldız alanı: belirir, işaret yukarı kayarken biraz söner (açık zeminde dalgayla tamamen).
  const starsIn = (t) =>
    starsInAt(t) * (quality.spiral ? 1 - 0.45 * riseAt(t) : 1) * (palette.starsStay ? 1 : 1 - wipeLevel(t));
  nodes.starsOpacity = Animated.multiply(lerp(clock, sampleTable(starsIn, { to: T.riseAt + T.riseDur })), exitOpacity);
  nodes.twinkle = quality.twinkle
    ? Array.from({ length: TWINKLE_GROUPS }, (_, g) =>
        lerp(twinkle, sampleTable((x) => twinkleAt(x, g / TWINKLE_GROUPS), { from: 0, to: 1, step: 1 / 48 })),
      )
    : null;
  nodes.drift = quality.drift
    ? lerp(drift, sampleTable((x) => ease.out(x) * DRIFT_DEG, { from: 0, to: 1, step: 1 / 40, map: (v) => `${v}deg` }))
    : null;

  // İşaret.
  if (!quality.spiral) {
    nodes.markOpacity = Animated.multiply(lerp(clock, sampleTable(stillMarkAt, { to: 0.6 })), exitOpacity);
    nodes.letters = WORDMARK_LETTERS.map((_, i) => ({
      opacity: Animated.multiply(lerp(clock, sampleTable((t) => stillLetterAt(t, i), { to: 1 })), exitOpacity),
      translateY: null,
    }));
    return nodes;
  }

  const spin = { from: T.appear, to: T.settle + WOBBLE_S };
  nodes.rotate = lerp(clock, sampleTable(thetaAt, { ...spin, map: toDeg }));
  const half = lerp(clock, sampleTable((t) => (sepAt(t) / 2) * u, { from: T.appear, to: T.settle }));
  nodes.half = quality.blink
    ? Animated.add(half, lerp(idle, sampleTable((b) => (blinkSepAt(b) / 2) * u, { from: 0, to: 1, step: 1 / 120 })))
    : half;
  nodes.halfNeg = neg(nodes.half);
  nodes.orbScale = lerp(clock, sampleTable((t) => Math.max(EPS, sizeAt(t)), { to: T.collide }));
  nodes.markOpacity = exitOpacity;
  nodes.markScale = lerp(
    clock,
    sampleTable((t) => (quality.punch ? markScaleAt(t) : 1 + (INTRO_TO_FINAL - 1) * riseAt(t)), {
      from: T.collide,
      to: T.riseAt + T.riseDur,
    }),
  );
  nodes.markDy = lerp(clock, sampleTable((t) => riseAt(t) * layout.markDy, { from: T.riseAt, to: T.riseAt + T.riseDur }));

  // Göz: ayrılığa göre kesişim ölçeği; kırpışta daireler ayrılır, göz kapanır.
  const eyeIntro = (k) =>
    lerp(clock, sampleTable((t) => Math.max(EPS, eyeScaleForSep(sepAt(t))[k]), { from: T.collide, to: T.settle }));
  const eyeBlink = (k) =>
    lerp(idle, sampleTable((b) => Math.max(EPS, eyeScaleForSep(LENS.d + blinkSepAt(b))[k]), { from: 0, to: 1, step: 1 / 120 }));
  nodes.eyeAlong = quality.blink ? Animated.multiply(eyeIntro(0), eyeBlink(0)) : eyeIntro(0);
  nodes.eyeAcross = quality.blink ? Animated.multiply(eyeIntro(1), eyeBlink(1)) : eyeIntro(1);

  nodes.pupilScale = lerp(clock, sampleTable((t) => Math.max(EPS, pupilAt(t)), { from: T.pupilAt, to: T.pupilAt + T.pupilDur }));
  nodes.pupilOpacity = quality.blink
    ? lerp(idle, sampleTable((b) => 1 - blinkFadeAt(b), { from: 0, to: 1, step: 1 / 120 }))
    : null;
  nodes.look = quality.look ? lerp(idle, sampleTable((b) => lookAt(b) * u, { from: 0, to: 1, step: 1 / 90 })) : null;
  nodes.glintOpacity = lerp(clock, sampleTable(glintOpacityAt, { from: T.glintAt, to: T.glintAt + T.glintDur }));

  // Hale + iz.
  const trailWindow = { from: T.appear, to: T.collide + 0.6 };
  nodes.haloOpacity = quality.halo
    ? Animated.multiply(lerp(clock, sampleTable((t) => HALO_PEAK * glowAt(t), trailWindow)), exitOpacity)
    : null;
  nodes.trail = Array.from({ length: plan.trail }, (_, i) => {
    const k = i + 1;
    const lag = k * TRAIL_LAG_S;
    const f = 1 - k / (plan.trail + 1);
    const at = (fn) => (t) => fn(Math.max(0, t - lag));
    const window = { from: T.appear, to: T.collide + 0.25 };
    const halfK = lerp(clock, sampleTable(at((t) => (sepAt(t) / 2) * u), window));
    return {
      rotate: lerp(clock, sampleTable(at(thetaAt), { ...window, map: toDeg })),
      half: halfK,
      halfNeg: neg(halfK),
      scale: lerp(clock, sampleTable(at((t) => Math.max(EPS, sizeAt(t) * (0.55 + 0.45 * f))), window)),
      opacity: lerp(clock, sampleTable((t) => (t - lag < T.appear ? 0 : TRAIL_PEAK * f * trailAt(t)), window)),
    };
  });

  // Çarpışma efektleri.
  if (quality.flash) {
    const win = { from: T.collide, to: T.collide + FLASH_S };
    nodes.flashScale = lerp(clock, sampleTable((t) => flashRadiusAt(t) / FLASH_MAX, win));
    nodes.flashOpacity = lerp(clock, sampleTable(flashOpacityAt, win));
  }
  nodes.rings = Array.from({ length: plan.rings }, (_, i) => {
    const [delay, , max] = SHOCK_RINGS[i];
    const win = { from: T.collide, to: T.collide + delay + SHOCK_S };
    return {
      scale: lerp(clock, sampleTable((t) => shockRadiusAt(t, i) / (SHOCK_MIN + max), win)),
      opacity: lerp(clock, sampleTable((t) => shockOpacityAt(t, i), win)),
    };
  });
  nodes.sparks = plan.sparks.map((s) => {
    const win = { from: T.collide, to: T.collide + s.life };
    return {
      distance: lerp(clock, sampleTable((t) => sparkDistanceAt(t, s.speed) * screenW, win)),
      opacity: lerp(clock, sampleTable((t) => sparkOpacityAt(t, s.life), win)),
    };
  });

  // Yazı.
  nodes.letters = WORDMARK_LETTERS.map((_, i) => {
    const win = { from: T.lettersAt + i * T.letterStep, to: T.lettersAt + i * T.letterStep + T.letterDur };
    return {
      opacity: Animated.multiply(lerp(clock, sampleTable((t) => letterAt(t, i), win)), exitOpacity),
      translateY: quality.rise
        ? lerp(clock, sampleTable((t) => (1 - letterAt(t, i)) * layout.word.rise, win))
        : null,
    };
  });
  return nodes;
}

// Çarpışma sırasında durum çubuğu değişir. Zamanlayıcı yalnız bu küçük bileşeni
// yenilesin; yıldızlar, SVG harfler ve efekt katmanları yeniden çizilmesin.
function SplashStatusBar({ paletteStyle, still }) {
  const [barStyle, setBarStyle] = useState("light");
  useEffect(() => {
    if (paletteStyle === "light") {
      setBarStyle("light");
      return undefined;
    }
    const at = still ? STILL_WIPE_S / 2 : T.collide + WIPE_S * 0.3;
    const timer = setTimeout(() => setBarStyle(paletteStyle), at * 1000);
    return () => clearTimeout(timer);
  }, [paletteStyle, still]);
  return <StatusBar style={barStyle} />;
}

function SplashStage({ exiting = false, onExited, onIntroStart, background, children }) {
  const reduced = useReduceMotion();
  // Efekt modu splash ömrü boyunca değişmez (ayar ekranına erişilemez); abonelik yok.
  const [mode] = useState(getEffectMode);
  const quality = useMemo(() => splashQualityFor(mode, reduced), [mode, reduced]);
  const [screen] = useState(() => Dimensions.get("screen"));
  const plan = useMemo(
    () => planSplash({ width: screen.width, height: screen.height, quality, background }),
    [quality, screen.width, screen.height, background],
  );
  const { layout, palette } = plan;
  const u = layout.unit;

  // Sürücüler: saat saniye cinsinden (0 → INTRO_S), diğerleri [0,1].
  const clock = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  const nodes = useMemo(
    () => buildNodes({ plan, quality, screenW: screen.width, drivers: { clock, exit, idle, twinkle, drift } }),
    [plan, quality, screen.width, clock, exit, idle, twinkle, drift],
  );

  // Giriş: mount anında bir kez. Bekleyecek ağ/afiş yok; App.js'in en kısa görünme
  // sayacı hemen başlar.
  const [introDone, setIntroDone] = useState(false);
  const onIntroStartRef = useRef(onIntroStart);
  onIntroStartRef.current = onIntroStart;
  useEffect(() => {
    onIntroStartRef.current?.();
    const anim = Animated.timing(clock, {
      toValue: INTRO_S,
      duration: INTRO_MS,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    anim.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });
    return () => anim.stop();
  }, [clock]);

  const still = !quality.spiral;

  // Süs döngüleri: tek timing'li Animated.loop yinelemeyi tamamen native yürütür.
  useEffect(() => {
    const anims = [];
    if (quality.twinkle) {
      anims.push(
        Animated.loop(
          Animated.timing(twinkle, {
            toValue: 1,
            duration: TWINKLE_MS,
            easing: Easing.linear,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ),
      );
    }
    // Yıldız alanının dönüşü döngü değil: yavaşlayıp durur.
    if (quality.drift) {
      anims.push(
        Animated.timing(drift, {
          toValue: 1,
          duration: DRIFT_MS,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
      );
    }
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [quality, twinkle, drift]);

  // Bekleme döngüsü (bakış + kırpma): giriş bitince, çıkışa kadar.
  const idleOn = introDone && !exiting && quality.spiral && (quality.look || quality.blink);
  useEffect(() => {
    if (!idleOn) return undefined;
    const anim = Animated.loop(
      Animated.timing(idle, {
        toValue: 1,
        duration: IDLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [idleOn, idle]);

  // Çıkış. Saat sürücüsüne DOKUNMAZ: giriş bitmeden çıkış başlasa da geçiş kesintisizdir.
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  useEffect(() => {
    if (!exiting) return undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExitedRef.current?.();
    };
    const anim = Animated.timing(exit, {
      toValue: 1,
      duration: EXIT_MS,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    anim.start(({ finished }) => {
      if (finished) finish();
    });
    // Native "bitti" geri çağrısı kaybolursa overlay sonsuza dek ekranda kalmasın.
    const guard = setTimeout(finish, EXIT_MS + EXIT_GUARD_MS);
    return () => {
      clearTimeout(guard);
      anim.stop();
    };
  }, [exiting, exit]);

  // Statik parçalar yalnız plan/düğüm değişince kurulur (üst bileşen tema/kar
  // yüzünden yeniden çizilse de onlarca view yeniden kurulmaz).
  const stars = useMemo(
    () =>
      plan.stars.map((s, i) => {
        const dot = [
          styles.dot,
          centered(s.dx, s.dy, s.size, s.size),
          { borderRadius: s.size / 2, backgroundColor: `rgba(245, 242, 235, ${s.alpha})` },
        ];
        return nodes.twinkle ? (
          <Animated.View key={i} style={[dot, { opacity: nodes.twinkle[s.group] }]} />
        ) : (
          <View key={i} style={dot} />
        );
      }),
    [plan, nodes],
  );

  const orbSize = 2 * LENS.r * u;
  const haloSize = 2 * 2.6 * LENS.r * u;
  const orbStyle = (color) => [centered(0, 0, orbSize, orbSize), { borderRadius: orbSize / 2, backgroundColor: color }];

  const trail = useMemo(
    () =>
      nodes.trail?.flatMap((g, i) => [
        <Animated.View
          key={`c${i}`}
          testID="splash-trail"
          style={[
            ...orbStyle(LENS_COLORS.cyan),
            { opacity: g.opacity, transform: [{ rotate: g.rotate }, { translateX: g.half }, { scale: g.scale }] },
          ]}
        />,
        <Animated.View
          key={`r${i}`}
          testID="splash-trail"
          style={[
            ...orbStyle(LENS_COLORS.red),
            { opacity: g.opacity, transform: [{ rotate: g.rotate }, { translateX: g.halfNeg }, { scale: g.scale }] },
          ]}
        />,
      ]) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, orbSize],
  );

  const fx = useMemo(() => {
    if (!quality.spiral) return null;
    const flashSize = 2 * FLASH_MAX * screen.width;
    return (
      <>
        {nodes.flashOpacity ? (
          <Animated.Image
            testID="splash-flash"
            source={GLOW.paper}
            resizeMode="stretch"
            fadeDuration={0}
            style={[
              centered(0, 0, flashSize, flashSize),
              { opacity: nodes.flashOpacity, transform: [{ scale: nodes.flashScale }] },
            ]}
          />
        ) : null}
        {nodes.rings.map((ring, i) => {
          const size = 2 * (SHOCK_MIN + SHOCK_RINGS[i][2]) * screen.width;
          return (
            <Animated.View
              key={`ring${i}`}
              testID="splash-ring"
              style={[
                centered(0, 0, size, size),
                {
                  borderRadius: size / 2,
                  borderWidth: RING_BORDER,
                  borderColor: SHOCK_RINGS[i][1] === LENS_COLORS.paper ? palette.contrast : SHOCK_RINGS[i][1],
                  opacity: ring.opacity,
                  transform: [{ scale: ring.scale }],
                },
              ]}
            />
          );
        })}
        {plan.sparks.map((s, i) => (
          <Animated.View
            key={`spark${i}`}
            testID="splash-spark"
            style={[
              centered(0, 0, SPARK_LEN, s.thickness),
              {
                borderRadius: s.thickness / 2,
                backgroundColor: s.color === "paper" ? palette.contrast : LENS_COLORS[s.color],
                opacity: nodes.sparks[i].opacity,
                transform: [{ rotate: `${s.angle}deg` }, { translateX: nodes.sparks[i].distance }],
              },
            ]}
          />
        ))}
      </>
    );
  }, [quality.spiral, nodes, plan, palette, screen.width]);

  // Hareketi Azalt: daireler son yerinde (dikey, d aralıklı), kap son ölçek ve konumda.
  const orbTransform = (sign) =>
    still
      ? [{ rotate: "-90deg" }, { translateX: (sign * LENS.d * u) / 2 }]
      : [{ rotate: nodes.rotate }, { translateX: sign > 0 ? nodes.half : nodes.halfNeg }, { scale: nodes.orbScale }];
  const markTransform = still
    ? [{ translateY: layout.markDy }, { scale: INTRO_TO_FINAL }]
    : [{ translateY: nodes.markDy }, { scale: nodes.markScale }];
  const eyeTransform = still
    ? [{ rotate: "-90deg" }]
    : [{ rotate: nodes.rotate }, { scaleX: nodes.eyeAlong }, { scaleY: nodes.eyeAcross }];
  const pupilTransform = still
    ? undefined
    : [...(nodes.look ? [{ translateX: nodes.look }] : []), { scale: nodes.pupilScale }];
  const pupilSize = 2 * LENS.pupil * u;
  const glintSize = 2 * LENS.glint * u;
  const glintOff = LENS.glintOff * u;
  const { word } = layout;
  // Dalga çemberi ekranın köşelerine kadar uzanır (merkezden köşeye = yarı köşegen).
  const wipeSize = Math.hypot(screen.width, screen.height) + 8;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        testID="splash-backdrop"
        style={[StyleSheet.absoluteFill, { backgroundColor: LENS_COLORS.ink, opacity: nodes.backdropOpacity }]}
      >
        {palette.wipe ? (
          <Animated.View
            testID="splash-wipe"
            style={
              still
                ? [StyleSheet.absoluteFill, { backgroundColor: palette.background, opacity: nodes.wipeOpacity }]
                : [
                    centered(0, 0, wipeSize, wipeSize),
                    {
                      borderRadius: wipeSize / 2,
                      backgroundColor: palette.background,
                      opacity: nodes.wipeOpacity,
                      transform: [{ scale: nodes.wipeScale }],
                    },
                  ]
            }
          />
        ) : null}
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, nodes.contentScale && { transform: [{ scale: nodes.contentScale }] }]}
      >
        {stars.length ? (
          <Animated.View
            testID="splash-stars"
            style={[
              StyleSheet.absoluteFill,
              { opacity: nodes.starsOpacity },
              nodes.drift && { transform: [{ rotate: nodes.drift }] },
            ]}
          >
            {stars}
          </Animated.View>
        ) : null}

        {!still ? (
          <Animated.View style={StyleSheet.absoluteFill}>
            {trail}
            {nodes.haloOpacity
              ? [
                  ["cyan", 1],
                  ["red", -1],
                ].map(([color, sign]) => (
                  <Animated.Image
                    key={color}
                    testID={`splash-halo-${color}`}
                    source={GLOW[color]}
                    resizeMode="stretch"
                    fadeDuration={0}
                    style={[
                      centered(0, 0, haloSize, haloSize),
                      { opacity: nodes.haloOpacity, transform: orbTransform(sign) },
                    ]}
                  />
                ))
              : null}
            {fx}
          </Animated.View>
        ) : null}

        {/* İşaret: çıkışta veya Hareketi Azalt girişinde saydamlaşırken üst üste
            binen daireler tek katmanda birleştirilir. Opak girişte buna gerek yok. */}
        <Animated.View
          testID="splash-mark"
          needsOffscreenAlphaCompositing={still || exiting}
          style={[
            centered(0, 0, layout.markBox, layout.markBox),
            { opacity: nodes.markOpacity, transform: markTransform },
          ]}
        >
          <Animated.View testID="splash-orb-cyan" style={[...orbStyle(LENS_COLORS.cyan), { transform: orbTransform(1) }]} />
          <Animated.View testID="splash-orb-red" style={[...orbStyle(LENS_COLORS.red), { transform: orbTransform(-1) }]} />
          <Animated.View
            testID="splash-eye"
            style={[centered(0, 0, EYE_LENGTH * u, EYE_WIDTH * u), { transform: eyeTransform }]}
          >
            <Svg width="100%" height="100%" viewBox={EYE_VIEWBOX}>
              <Path d={EYE_PATH} fill={LENS_COLORS.ink} />
            </Svg>
          </Animated.View>
          <Animated.View
            testID="splash-pupil"
            style={[
              centered(0, 0, pupilSize, pupilSize),
              { borderRadius: pupilSize / 2, backgroundColor: LENS_COLORS.paper },
              nodes.pupilOpacity && { opacity: nodes.pupilOpacity },
              pupilTransform && { transform: pupilTransform },
            ]}
          >
            <Animated.View
              testID="splash-glint"
              style={[
                centered(glintOff, -glintOff, glintSize, glintSize),
                { borderRadius: glintSize / 2, backgroundColor: LENS_COLORS.ink },
                !still && { opacity: nodes.glintOpacity },
              ]}
            />
          </Animated.View>
        </Animated.View>

        {WORDMARK_LETTERS.map((d, i) => (
          <Animated.View
            key={i}
            testID={`splash-letter-${i}`}
            style={[
              centered(word.left + word.width / 2, word.top + word.height / 2, word.width, word.height),
              {
                opacity: nodes.letters[i].opacity,
                transform: nodes.letters[i].translateY ? [{ translateY: nodes.letters[i].translateY }] : undefined,
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox={word.viewBox}>
              <Path d={d} fill={palette.word} />
            </Svg>
          </Animated.View>
        ))}

        {children ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: nodes.exitOpacity }]}>{children}</Animated.View>
        ) : null}
      </Animated.View>
      <SplashStatusBar paletteStyle={palette.statusBar} still={still} />
    </View>
  );
}

// Animasyonlu sahne düşerse: statik zemin + Lens işareti. Çıkış isteğine kısa bir
// bekleyişle yanıt verir ki overlay yine sökülsün.
const STATIC_LOGO_SIZE = 288;
function StaticSplash({ exiting, onExited, onIntroStart, background, children }) {
  const palette = splashPaletteFor(background);
  // Beklenecek giriş yok; App.js'in en kısa görünme sayacı hemen başlasın.
  useEffect(() => {
    onIntroStart?.();
  }, [onIntroStart]);
  useEffect(() => {
    if (!exiting) return undefined;
    const timer = setTimeout(() => onExited?.(), 160);
    return () => clearTimeout(timer);
  }, [exiting, onExited]);
  return (
    <View
      testID="splash-static"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}
      pointerEvents="none"
    >
      <Image
        source={getAppLogoSources(DEFAULT_APP_ICON_ID).logo}
        resizeMode="contain"
        style={centered(0, 0, STATIC_LOGO_SIZE, STATIC_LOGO_SIZE)}
      />
      {children}
      <StatusBar style={palette.statusBar} />
    </View>
  );
}

class SplashBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    captureError(error, {
      tags: { boundary: "splash" },
      extra: { componentStack: info?.componentStack },
    });
  }

  render() {
    // Yedek AYRI prop: `children` çöken sahnenin kendisi, onu tekrar çizmek hatayı tekrarlar.
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * @param {boolean}  exiting       true olunca çıkış animasyonu başlar
 * @param {function} onExited      çıkış bitince çağrılır (overlay'i söküp atmak için)
 * @param {function} onIntroStart  giriş başlayınca (mount, bir kez) çağrılır
 * @param {string}   background    temanın zemini (theme.primary); sahne buna varır
 * @param {node}     children      sahnenin üstünde çizilir (kar), çıkışla solar
 */
export default function SplashLensIntro(props) {
  return (
    <SplashBoundary fallback={<StaticSplash {...props} />}>
      <SplashStage {...props} />
    </SplashBoundary>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
  },
});

// components/SplashPosterWave.js
//
// Açılış ekranı (JS splash). Yerel splash'in (koyu zemin + ortada logo) BİREBİR
// devamı olarak başlar; sonra:
//
//   1. zemin yerel splash grisinden tema rengine yumuşakça geçer,
//   2. logonun renklerinde (mor/mavi/turkuaz) bir ışıma belirir,
//   3. logo bir kez nabız atar ve posterlerden oluşan eş merkezli halkalar
//      merkezden dışa doğru çiçeklenir (halka halka, hafif aşımlı),
//   4. halkalar yavaşça süzülüp durur (posterler dik kalır) ve üzerlerinden
//      merkezden dışa süzülen bir "Meksika dalgası" geçer,
//   5. veri hazır olunca (`exiting`) logo/ışıma/halkalar dışa süzülüp solar, zemin
//      en son açılır ve altındaki uygulama belirir (`onExited` ile haber verir).
//
// Hareketin tamamı TEK bir [0,1] sürücüden (giriş, çıkış, her döngü için birer
// tane) native tarafta interpolate ile türer — süreler, eğriler ve geometri
// utils/splashMotion.js'te, ne kadar iş yapılacağı (kalite kademesi) utils/
// splashPlan.js'te (saf, test edilir). Açılışta JS thread'i bloklansa da hareket
// kesilmez; ilk kare de (sürücüler 0'da) yerel splash'le aynı görünür.
//
// "KASMA" BÜTÇESİ — splash, uygulama ağacının mount olduğu en yoğun anda çalışır:
//   • Poster başına TEK native view: `Animated.Image` doğrudan opaklık + dönüşü
//     taşır, köşe yuvarlama resmin kendisinde. (Eskiden sarmalayıcı View + expo-image
//     idi: poster başına iki view ve ayrı bir köşe-maskesi katmanı.)
//   • Konumlar `left/top: 50%` + kenar boşluğuyla, ekran MERKEZİNE göre: onLayout,
//     state ve ölçü gelince yeniden render yok (Android'de "window" ile gerçek
//     overlay ölçüsü farkı yüzünden poster kaymaları da yok).
//   • Opaklık yalnız POSTER seviyesinde, halka kabına değil: yarı saydam bir kap
//     60+ posteri ekran dışı katmana çizdirirdi. Kaplar yalnız dönüş + ölçek taşır.
//   • Işıma SVG değil hazır bitmap (assets/splash-glow.png).
//   • Efektler ayarı (Tam/Orta/Kapalı) + Hareketi Azalt kaliteyi kısar; "Kapalı"da
//     (zayıf cihaz varsayılanı) süreklilik arz eden HİÇBİR animasyon çalışmaz.
//   • Yörünge sonsuz değil: ~7 sn'de süzülüp durur. Tüm zamanlayıcılar
//     isInteraction:false (aksi halde InteractionManager'ı tutar ve
//     runAfterInteractions'a bağlı açılış işleri başlamaz).
//
// SAĞLAMLIK: splash çökerse uygulama açılmaz → bileşen kendi hata sınırına sahip,
// düşerse statik (zemin + logo) bir yedeğe geçer. Çıkışın "bitti" haberi kaybolsa
// bile overlay bir süre sonra zorla sökülür.
//
// Poster kaynağı: oy sayısı en yüksek film/dizilerden hazırlanmış yerel katalog.
// Görseller JS bundle ile gelir; splash ağ veya disk cache beklemez. Ancak her
// afiş yine de asenkron çözülür: giriş, kullanılan afişlerin hepsi yüklenene kadar
// (en fazla POSTER_WAIT_MS) bekler, sonra `onIntroStart` ile haber verir — App.js
// en kısa görünme süresini o andan sayar.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";
import { SPLASH_POSTER_CATALOG } from "../data/splashPosterCatalog";
import useAppLogo from "../hooks/useAppLogo";
import useReduceMotion from "../hooks/useReduceMotion";
import { captureError } from "../services/crashReporting";
import { getEffectMode } from "../services/effectSettings";
import {
  BREATH_MS,
  EXIT_GUARD_MS,
  EXIT_MS,
  GLOW_SIZE,
  GLOW_SPIN_MS,
  INTRO_MS,
  LOGO_SIZE,
  NATIVE_SPLASH_BG,
  ORBIT_MS,
  POSTER_WAIT_MS,
  STATIC_LEVEL,
  TILE_H,
  TILE_W,
  WAVE_PERIOD_MS,
  bloomOpacityTable,
  bloomScaleTable,
  breathTable,
  exitBackdropTable,
  exitGlowOpacityTable,
  exitGlowScaleTable,
  exitLogoOpacityTable,
  exitLogoScaleTable,
  exitRingOpacityTable,
  exitRingScaleTable,
  glowOpacityTable,
  glowPeakAlpha,
  glowScaleTable,
  logoPulseTable,
  orbitDirection,
  orbitTable,
  veilTable,
  waveOpacityTable,
  waveScaleTable,
} from "../utils/splashMotion";
import { planSplash, splashQualityFor } from "../utils/splashPlan";

const GLOW_SOURCE = require("../assets/splash-glow.png");

const CLAMP = { extrapolate: "clamp" };

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const lerp = (driver, table, options) => driver.interpolate({ ...table, ...options });

// Çarpım zinciri (native'de desteklenir); boş/tek elemanlı zincir de güvenli.
const product = (nodes) => nodes.reduce((acc, node) => Animated.multiply(acc, node));

// Yalnız tanımlı dönüşleri taşıyan transform dizisi; hiçbiri yoksa `undefined`
// (boş transform dizisi bile her karede gereksiz iş demek).
const transformOf = (parts) => {
  const list = parts.filter(Boolean);
  return list.length ? list : undefined;
};

// Ekran merkezine göre konum (ölçüsüz): `left/top: 50%` ebeveyn ölçüsüne çözülür.
const centered = (dx, dy, width, height) => ({
  left: "50%",
  top: "50%",
  marginLeft: dx - width / 2,
  marginTop: dy - height / 2,
});

const LOGO_PLACE = centered(0, 0, LOGO_SIZE, LOGO_SIZE);
const GLOW_PLACE = centered(0, 0, GLOW_SIZE, GLOW_SIZE);

function SplashStage({
  backgroundColor,
  light = false,
  exiting = false,
  onExited,
  onIntroStart,
  children,
}) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const reduced = useReduceMotion();
  // Efekt modu splash ömrü boyunca değişmez (ayar ekranına erişilemez); abonelik yok.
  const [mode] = useState(getEffectMode);
  const quality = useMemo(() => splashQualityFor(mode, reduced), [mode, reduced]);

  // Poster kümesi yalnız mod + ekran boyutuna bağlı; `reduced` onu değiştirmez.
  const [screen] = useState(() => Dimensions.get("screen"));
  const plan = useMemo(
    () => planSplash({ width: screen.width, height: screen.height, quality: splashQualityFor(mode) }),
    [mode, screen.width, screen.height],
  );
  // Sıra yalnız bu mount için karıştırılır. Kaynakların tamamı statik require
  // olduğu için ilk karede hazırdır ve çevrimdışı açılışta da aynı davranır.
  const posterSources = useMemo(
    () =>
      shuffle(SPLASH_POSTER_CATALOG.map((item) => item.source)).slice(
        0,
        splashQualityFor(mode).posterPool,
      ),
    [mode],
  );
  // Her halkanın poster dizisindeki başlangıç sırası: sıra halkalar boyunca
  // sürekli artar, komşu halkalar aynı afişi yan yana göstermez.
  const tileBases = useMemo(() => {
    let n = 0;
    return plan.rings.map(({ tiles }) => {
      const base = n;
      n += tiles.length;
      return base;
    });
  }, [plan]);

  // Afiş hazırlığı: plan'ın gerçekten kullandığı her farklı kaynak bir kez
  // yüklendiğinde (ya da hata verdiğinde) giriş başlar. Aynı kaynağın diğer
  // karoları native bellek önbelleğinden gelir; onları beklemek gerekmez.
  const [postersReady, setPostersReady] = useState(false);
  const pendingPosters = useRef(null);
  if (pendingPosters.current === null) {
    const used = new Set();
    plan.rings.forEach(({ tiles }, ringIndex) =>
      tiles.forEach((_, s) => used.add((tileBases[ringIndex] + s) % posterSources.length)),
    );
    pendingPosters.current = used;
  }
  const onPosterSettled = useRef((index) => {
    const pending = pendingPosters.current;
    if (!pending.delete(index) || pending.size > 0) return;
    setPostersReady(true);
  }).current;
  useEffect(() => {
    if (postersReady) return undefined;
    if (pendingPosters.current.size === 0) {
      setPostersReady(true);
      return undefined;
    }
    const cap = setTimeout(() => setPostersReady(true), POSTER_WAIT_MS);
    return () => clearTimeout(cap);
  }, [postersReady]);

  // Sürücüler (hepsi [0,1], hepsi native).
  const intro = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const glowSpin = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  // Tüm interpolate düğümleri bir kez kurulur; yalnız plan ya da kalite değişince
  // yeniden hesaplanır. Kapalı özelliğin düğümü HİÇ kurulmaz.
  const nodes = useMemo(() => {
    const flat = !quality.bloomScale;
    const ringCount = plan.ringCount;
    const rings = plan.rings.map(({ ring }) => {
      const dir = orbitDirection(ring);
      const phase = ring / ringCount;
      return {
        containerTransform: transformOf([
          quality.bloomScale && {
            scale: Animated.multiply(
              lerp(intro, bloomScaleTable(ring), CLAMP),
              lerp(exit, exitRingScaleTable(ring), CLAMP),
            ),
          },
          quality.orbit && { rotate: lerp(orbit, orbitTable(dir)) },
        ]),
        tileOpacity: product([
          ...(quality.waveLoop ? [lerp(wave, waveOpacityTable(phase))] : []),
          lerp(intro, bloomOpacityTable(ring, quality.waveLoop ? 1 : STATIC_LEVEL), CLAMP),
          lerp(exit, exitRingOpacityTable(ring), CLAMP),
        ]),
        tileTransform: transformOf([
          quality.orbit && { rotate: lerp(orbit, orbitTable(dir, true)) },
          quality.waveScale && { scale: lerp(wave, waveScaleTable(phase)) },
        ]),
      };
    });

    // Ölçek çarpanları: yalnız açık özelliklerin düğümü kurulur (boşsa dönüşte ölçek yok).
    const glowScaleParts = [
      ...(flat ? [] : [lerp(intro, glowScaleTable(), CLAMP)]),
      ...(quality.glowMotion ? [lerp(breath, breathTable(0.1))] : []),
      ...(flat ? [] : [lerp(exit, exitGlowScaleTable(), CLAMP)]),
    ];
    const logoScaleParts = [
      ...(quality.pulse ? [lerp(intro, logoPulseTable(), CLAMP)] : []),
      ...(quality.breath ? [lerp(breath, breathTable(0.035))] : []),
      ...(flat ? [] : [lerp(exit, exitLogoScaleTable(), CLAMP)]),
    ];

    return {
      rings,
      backdropOpacity: lerp(exit, exitBackdropTable(), CLAMP),
      veilOpacity: lerp(intro, veilTable(), CLAMP),
      glowOpacity: Animated.multiply(
        lerp(intro, glowOpacityTable(glowPeakAlpha(light)), CLAMP),
        lerp(exit, exitGlowOpacityTable(), CLAMP),
      ),
      glowTransform: transformOf([
        glowScaleParts.length && { scale: product(glowScaleParts) },
        quality.glowMotion && {
          rotate: glowSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }),
        },
      ]),
      logoTransform: transformOf([logoScaleParts.length && { scale: product(logoScaleParts) }]),
      logoOpacity: lerp(exit, exitLogoOpacityTable(), CLAMP),
      // Kar/ek içerik logoyla birlikte çözülür.
      childOpacity: lerp(exit, exitLogoOpacityTable(), CLAMP),
    };
  }, [plan, quality, light, intro, exit, wave, breath, glowSpin, orbit]);

  // Giriş: afişler hazır olunca (ya da tavan dolunca) bir kez.
  const onIntroStartRef = useRef(onIntroStart);
  onIntroStartRef.current = onIntroStart;
  useEffect(() => {
    if (!postersReady) return undefined;
    onIntroStartRef.current?.();
    const anim = Animated.timing(intro, {
      toValue: 1,
      duration: INTRO_MS,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    anim.start();
    return () => anim.stop();
  }, [intro, postersReady]);

  // Döngüler: tek timing'li Animated.loop yinelemeyi tamamen native tarafta
  // yürütür (sequence'li kurgunun aksine yarım döngüde JS'e uğramaz) → açılış
  // jankları dalgayı donduramaz. Yalnız kalitenin istediği döngüler başlar.
  useEffect(() => {
    const loops = [
      quality.waveLoop && [wave, WAVE_PERIOD_MS],
      quality.breath || quality.glowMotion ? [breath, BREATH_MS] : null,
      quality.glowMotion && [glowSpin, GLOW_SPIN_MS],
    ]
      .filter(Boolean)
      .map(([value, duration]) =>
        Animated.loop(
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ),
      );
    // Yörünge döngü değil: süzülüp durur (bkz. ORBIT_MS).
    if (quality.orbit) {
      loops.push(
        Animated.timing(orbit, {
          toValue: 1,
          duration: ORBIT_MS,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
      );
    }
    loops.forEach((anim) => anim.start());
    return () => loops.forEach((anim) => anim.stop());
  }, [quality, wave, breath, glowSpin, orbit]);

  // Çıkış. Giriş sürücüsüne DOKUNMAZ: her katmanın değeri giriş × çıkış çarpımı
  // olduğundan, giriş bitmeden çıkış başlasa bile geçiş kesintisiz olur.
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
    // Native "bitti" geri çağrısı kaybolursa (ör. sürücü arka planda iptal oldu)
    // overlay sonsuza dek ekranda kalmasın.
    const guard = setTimeout(finish, EXIT_MS + EXIT_GUARD_MS);
    return () => {
      clearTimeout(guard);
      anim.stop();
    };
  }, [exiting, exit]);

  // Poster elemanları yalnız plan/düğüm değişince yeniden kurulur: üst bileşen
  // (tema/kar bağlamı) yeniden çizilince 60+ posterin hepsi yeniden çizilmez.
  const ringViews = useMemo(
    () =>
      plan.rings.map(({ ring, tiles }, ringIndex) => {
        const node = nodes.rings[ringIndex];
        const tileStyle = [
          styles.tile,
          { opacity: node.tileOpacity },
          node.tileTransform && { transform: node.tileTransform },
        ];
        return (
          <Animated.View
            key={ring}
            collapsable={false}
            style={[StyleSheet.absoluteFill, node.containerTransform && { transform: node.containerTransform }]}
          >
            {tiles.map((tile, s) => {
              const sourceIndex = (tileBases[ringIndex] + s) % posterSources.length;
              return (
                <Animated.Image
                  key={s}
                  source={posterSources[sourceIndex]}
                  onLoadEnd={() => onPosterSettled(sourceIndex)}
                  style={[...tileStyle, centered(tile.dx, tile.dy, TILE_W, TILE_H)]}
                  resizeMode="cover"
                  // Android (Fresco): bitmap'i görünüm boyutuna indirger ve yüklenirken
                  // 300 ms'lik solma uygulamaz (aksi halde posterler iki kez solardı).
                  resizeMethod="resize"
                  fadeDuration={0}
                />
              );
            })}
          </Animated.View>
        );
      }),
    [plan, nodes, posterSources, tileBases, onPosterSettled],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Zemin: opak yerel-splash grisi + üstüne tema rengi. İkisi birlikte çıkışta
          solar (altındaki uygulama o zaman görünür). */}
      <Animated.View
        collapsable={false}
        style={[StyleSheet.absoluteFill, { opacity: nodes.backdropOpacity }]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: NATIVE_SPLASH_BG }]} />
        <Animated.View
          collapsable={false}
          style={[StyleSheet.absoluteFill, { backgroundColor, opacity: nodes.veilOpacity }]}
        />
      </Animated.View>

      <Animated.Image
        source={GLOW_SOURCE}
        resizeMode="stretch"
        fadeDuration={0}
        style={[
          styles.glow,
          GLOW_PLACE,
          { opacity: nodes.glowOpacity },
          nodes.glowTransform && { transform: nodes.glowTransform },
        ]}
      />

      {ringViews}

      {/* Adaptive icon foreground'u şeffaf zeminli — halkaların ortası zaten boş
          olduğundan arkasına ayrıca zemin konmaz. Halkalarla AYNI merkezden
          konumlanır (yüzde + kenar boşluğu, flex-center değil). */}
      <Animated.Image
        source={appLogo}
        resizeMode="contain"
        fadeDuration={0}
        style={[
          styles.logo,
          LOGO_PLACE,
          { opacity: nodes.logoOpacity },
          nodes.logoTransform && { transform: nodes.logoTransform },
        ]}
      />

      {children ? (
        <Animated.View
          collapsable={false}
          style={[StyleSheet.absoluteFill, { opacity: nodes.childOpacity }]}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

// Animasyonlu sahne düşerse: statik zemin + logo. Çıkış isteğine kısa bir bekleyişle
// yanıt verir ki overlay yine sökülsün.
function StaticSplash({ backgroundColor, exiting, onExited, onIntroStart, children }) {
  const { logo } = useAppLogo();
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor }]} pointerEvents="none">
      <Image source={logo} resizeMode="contain" style={[styles.logo, LOGO_PLACE]} />
      {children}
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
 * @param {string}   backgroundColor  tema zemin rengi (yerel splash grisinden buna geçilir)
 * @param {boolean}  light            zemin açık mı (ışıma açık zeminde daha silik)
 * @param {boolean}  exiting          true olunca çıkış animasyonu başlar
 * @param {function} onExited         çıkış bitince çağrılır (overlay'i söküp atmak için)
 * @param {function} onIntroStart     afişler hazır olup giriş başlayınca (bir kez) çağrılır
 * @param {node}     children         halka/logonun üstünde çizilir, çıkışla birlikte solar
 */
export default function SplashPosterWave(props) {
  return (
    <SplashBoundary fallback={<StaticSplash {...props} />}>
      <SplashStage {...props} />
    </SplashBoundary>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  tile: {
    position: "absolute",
    width: TILE_W,
    height: TILE_H,
    borderRadius: 10,
    backgroundColor: "rgba(127, 127, 127, 0.14)",
  },
  logo: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});

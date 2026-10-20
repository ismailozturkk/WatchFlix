// components/premium/PremiumUpsellSheet.js
//
// Premium'a özel bir özelliğe ya da dolmuş bir limite dokunulduğunda açılan
// YÜKSELTME SAYFASI. Özelliğe özel konuşan, hareketli bir alt sayfa:
//
//   ┌ hero: özelliğin renginde ışık küreleri + parıldayan yıldızlar, tıklanınca
//   │       sallanan madalyon (nabız halkalı), etiket, başlık, tek cümle
//   ├ gösterge: "5 / 5 liste" — küçük limitlerde parça parça dolan dilimler,
//   │       büyüklerde parlayan çubuk; sayı 0'dan sayar
//   ├ plan kartları: Free · Premium · Max; önerilen kart taç + nefes alan çerçeve
//   ├ "Premium ile ayrıca": gerçek kapılardan 2 kazanç satırı (sağdan kayarak girer)
//   ├ güvence notu ("Gelen istekleri kabul etmek her zaman serbest")
//   └ sabit alt alan: mağaza fiyatı (+ giriş teklifi), parıltılı birincil düğme, vazgeç
//
// İçeriğin tamamı utils/premiumUpsellContent.js'ten (saf, testli) gelir ve
// kayıttaki (utils/premiumFeatures.js) gerçek limitlere dayanır; burada elle
// yazılmış vaat YOK. Fiyat yalnız mağaza paketleri yüklüyse görünür.
//
// Hareket kuralları (components/hub/HubWrappedModule.js ile aynı):
//   • Hepsi Reanimated (UI thread). Giriş animasyonları ReduceMotion.System ile
//     sistemin "Hareketi azalt" ayarına uyar; sürekli dönenler (küreler, yıldızlar,
//     halkalar, parıltı) o ayar açıkken hiç başlamaz.
//   • İçerik Modal'ın içinde: sayfa her açıldığında yeniden bağlanır, böylece
//     giriş sahnesi her seferinde baştan oynar. Gecikmeler sayfanın kayarak
//     gelişine (~350 ms) denk gelecek şekilde seçildi.
//
// Açılış: services/premiumUpsell.showPremiumLimitAlert → services/premiumUpsellHost
// (imperatif köprü) → bu bileşendeki <PremiumUpsellHost /> (App.js'te bir kez).
// Kabuk BottomSheetModal'dır: blur yerinde solar, sayfa tam opaklıkta kayar
// (bkz. components/common/BottomSheetModal.js).
//
// DİKKAT — iOS iki Modal'ı AYNI ANDA sunamaz: kapanmakta olan bir Modal'ın üstüne
// ikincisini açmak kilitlenmeye yol açar. Bu yüzden host, sırada bekleyen istekleri
// ve kapanış sonrası callback'leri BottomSheetModal `onDismissed` ile (pencere
// gerçekten kalktıktan sonra) çalıştırır; üstteki bir Modal'ı kapatıp ardından bu
// sayfayı açmak isteyen çağıran da kapanışı bekletmeli (bkz. HubWrappedModule).

import { intlLocaleOf, normalizeAppLanguage } from "../../utils/appLanguages";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@services/hapticsService";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { usePremium } from "@context/PremiumContext";
import useReduceMotion from "@hooks/useReduceMotion";
import { alpha } from "@theme/colors";
import { createCloseGate, registerUpsellHost } from "@services/premiumUpsellHost";
import { openPremiumScreen } from "@services/premiumUpsell";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { buildPriceHint, buildUpsellContent, planTierTypography } from "@utils/premiumUpsellContent";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassPressable from "../common/GlassPressable";

const RM = ReduceMotion.System;
const PRESS_SPRING = { mass: 0.4, damping: 12, stiffness: 180 };

const GOLD = "#F59E0B";
const GOLD_SOFT = "#FCD34D";
const OFFER_COLOR = "#EC4899";
// Sayılı limitlerde bu değere kadar çubuk yerine parça parça dilimler çizilir
// (5 liste → 5 dilim; 60 kart → sürekli çubuk).
const MAX_SEGMENTS = 12;
// Plan satırı yerleşimi (stillerle aynı değerler): sayfa içerik yan dolgusu 2×20, sütun arası 8.
const TIERS_SIDE_PADDING = 40;
const TIERS_GAP = 8;
// Kapanış sinyali gelmezse (beklenmedik bir durumda) host'un kilitli kalmaması
// için en geç bu sürede devam edilir. Normalde `onDismissed` ≈350 ms'de gelir.
const CLOSE_FALLBACK_MS = 900;

const ambientEase = Easing.inOut(Easing.sin);

// ── Küçük yapı taşları ───────────────────────────────────────────────────────

function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => {
    scale.value = withSpring(to, PRESS_SPRING);
  }, [scale, to]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);
  return { style, onPressIn, onPressOut };
}

/** Aşağıdan (ya da yandan) süzülüp beliren sarmalayıcı; `delay` ile kademeli. */
const Rise = memo(function Rise({ delay = 0, dy = 16, dx = 0, from = 1, style, children }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withSpring(1, { damping: 16, stiffness: 150, mass: 0.9, reduceMotion: RM }),
      RM,
    );
  }, [delay, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.5),
    transform: [
      { translateX: (1 - p.value) * dx },
      { translateY: (1 - p.value) * dy },
      { scale: from + (1 - from) * p.value },
    ],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
});

/**
 * 0'dan hedef sayıya sayan metin. Durum bu bileşende tutulur → her karede yalnız
 * bu küçük <Text> yeniden çizilir. Hareketi azalt açıkken doğrudan son değer.
 */
const CountUp = memo(function CountUp({
  value,
  reduceMotion,
  language,
  delay = 0,
  duration = 800,
  style,
}) {
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion || value <= 0) {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, reduceMotion, delay, duration]);
  return (
    <Text allowFontScaling={false} style={style}>
      {shown.toLocaleString(intlLocaleOf(language))}
    </Text>
  );
});

/** Yumuşak, yavaşça süzülen ışık küresi (iç içe 3 halka = sahte radyal). */
const GlowOrb = memo(function GlowOrb({
  size,
  color,
  style,
  dx = 14,
  dy = 10,
  duration = 6800,
  delay = 0,
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration, easing: ambientEase, reduceMotion: RM };
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, cfg), withTiming(0, cfg)), -1, false, undefined, RM),
      RM,
    );
  }, [duration, delay, t]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * dx },
      { translateY: t.value * dy },
      { scale: 1 + t.value * 0.1 },
    ],
  }));
  const ring = (inset, opacity) => ({
    position: "absolute",
    top: size * inset,
    left: size * inset,
    width: size * (1 - inset * 2),
    height: size * (1 - inset * 2),
    borderRadius: size,
    backgroundColor: color,
    opacity,
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size }, style, a]}
    >
      <View style={ring(0, 0.1)} />
      <View style={ring(0.2, 0.14)} />
      <View style={ring(0.36, 0.2)} />
    </Animated.View>
  );
});

/** Yanıp sönen küçük dört köşeli yıldız. */
const Sparkle = memo(function Sparkle({ left, top, size, color, delay, duration }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration, easing: ambientEase, reduceMotion: RM };
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, cfg), withTiming(0, cfg)), -1, false, undefined, RM),
      RM,
    );
  }, [duration, delay, t]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.12 + t.value * 0.88,
    transform: [{ scale: 0.55 + t.value * 0.6 }, { rotate: `${t.value * 50}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, { left, top }, a]}>
      <MaterialCommunityIcons name="star-four-points" size={size} color={color} />
    </Animated.View>
  );
});

/** Madalyonun arkasında genişleyip sönen nabız halkası. */
const PulseRing = memo(function PulseRing({ color, size, delay }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad), reduceMotion: RM }),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [delay, t]);
  const a = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.55,
    transform: [{ scale: 0.78 + t.value * 0.95 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        a,
      ]}
    />
  );
});

/** Bir yüzeyin üzerinden periyodik geçen çapraz parıltı bandı. */
const Sheen = memo(function Sheen({ width, delay = 1400, rest = 3200, strength = 0.34 }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
          // Bant sağda beklerken değer 1'de kalır; sonra sıfırlanır.
          withDelay(rest, withTiming(0, { duration: 0, reduceMotion: RM }), RM),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [delay, rest, t]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: -90 + t.value * (width + 180) }, { skewX: "-18deg" }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, a]}>
      <LinearGradient
        colors={["transparent", `rgba(255,255,255,${strength})`, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

// ── Hero ─────────────────────────────────────────────────────────────────────

// Konumlar hero arka planının yüzdesi/pikseli; madalyonun çevresine serpiştirildi.
const SPARKLES = [
  { left: "13%", top: 58, size: 11, delay: 0, duration: 1500, tone: 0 },
  { left: "83%", top: 50, size: 15, delay: 420, duration: 1900, tone: 1 },
  { left: "24%", top: 138, size: 8, delay: 900, duration: 1700, tone: 1 },
  { left: "72%", top: 148, size: 10, delay: 260, duration: 1400, tone: 0 },
  { left: "6%", top: 190, size: 9, delay: 1200, duration: 2000, tone: 0 },
  { left: "92%", top: 196, size: 8, delay: 700, duration: 1600, tone: 1 },
];

/** Hero'nun arkasındaki ışık: üstten süzülen renk + küreler + yıldızlar. */
const HeroBackdrop = memo(function HeroBackdrop({ color, accent, ambient }) {
  return (
    <View pointerEvents="none" style={styles.heroBackdrop}>
      <LinearGradient
        colors={[alpha(color, 0.3), alpha(color, 0.08), alpha(color, 0)]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {ambient ? (
        <>
          <GlowOrb size={210} color={color} style={{ top: -90, left: -70 }} />
          <GlowOrb
            size={180}
            color={accent}
            dx={-14}
            dy={8}
            duration={7600}
            delay={600}
            style={{ top: -60, right: -60 }}
          />
          {SPARKLES.map((s, i) => (
            <Sparkle
              key={i}
              left={s.left}
              top={s.top}
              size={s.size}
              delay={s.delay}
              duration={s.duration}
              color={s.tone ? GOLD_SOFT : color}
            />
          ))}
        </>
      ) : null}
    </View>
  );
});

/**
 * Özelliğin simgesi: yaylanarak girer, nabız halkalarıyla süzülür; dokununca
 * sallanır (süs — hiçbir şeyi tetiklemez).
 */
const Medallion = memo(function Medallion({ content, backdrop, ambient }) {
  const { color } = content;
  const lockIcon = content.state === "locked" ? "lock-closed" : "diamond";
  const enter = useSharedValue(0);
  const float = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    enter.value = withDelay(
      90,
      withSpring(1, { damping: 10, stiffness: 120, mass: 0.8, reduceMotion: RM }),
      RM,
    );
  }, [enter]);

  useEffect(() => {
    if (!ambient) return;
    const cfg = { duration: 1900, easing: ambientEase, reduceMotion: RM };
    float.value = withDelay(
      800,
      withRepeat(withSequence(withTiming(1, cfg), withTiming(0, cfg)), -1, false, undefined, RM),
      RM,
    );
  }, [ambient, float]);

  const onPress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const tap = { reduceMotion: RM };
    wiggle.value = withSequence(
      withTiming(-1, { duration: 70, ...tap }),
      withTiming(1, { duration: 120, ...tap }),
      withTiming(-0.6, { duration: 110, ...tap }),
      withTiming(0.3, { duration: 100, ...tap }),
      withSpring(0, { damping: 8, stiffness: 220, ...tap }),
    );
    pop.value = withSequence(
      withTiming(1.14, { duration: 110, ...tap }),
      withSpring(1, { damping: 6, stiffness: 220, ...tap }),
    );
  }, [pop, wiggle]);

  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 2),
    transform: [
      { translateY: -4 * float.value + (1 - enter.value) * 20 },
      { scale: (0.45 + enter.value * 0.55) * pop.value },
      { rotate: `${(1 - enter.value) * -18 + wiggle.value * 11}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.medalWrap}
    >
      {ambient ? (
        <>
          <PulseRing color={color} size={96} delay={500} />
          <PulseRing color={color} size={96} delay={1800} />
        </>
      ) : null}
      <Animated.View style={[styles.medalShadow, { shadowColor: color, backgroundColor: color }, a]}>
        <LinearGradient
          colors={[alpha(color, 0.78), color]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.medal}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.42)", "rgba(255,255,255,0)"]}
            style={styles.medalGloss}
          />
          <Ionicons name={content.icon} size={34} color="#FFFFFF" />
        </LinearGradient>
        <View style={[styles.lockBadge, { backgroundColor: backdrop, borderColor: backdrop }]}>
          <View style={styles.lockInner}>
            <Ionicons name={lockIcon} size={11} color="#FFFFFF" />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// ── Gösterge ─────────────────────────────────────────────────────────────────

/** Tek dilim: sırayla yaylanarak dolar. */
const Segment = memo(function Segment({ filled, index, color, track }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!filled) return;
    p.value = withDelay(
      300 + index * 85,
      withSpring(1, { damping: 11, stiffness: 170, mass: 0.7, reduceMotion: RM }),
      RM,
    );
  }, [filled, index, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.8),
    transform: [{ scale: 0.35 + p.value * 0.65 }],
  }));
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      {filled ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.segmentFill, { backgroundColor: color }, a]} />
      ) : null}
    </View>
  );
});

/** Sürekli çubuk (büyük limitler): soldan dolar, uçta parıltı. */
const FillBar = memo(function FillBar({ ratio, color, track, ambient }) {
  const [width, setWidth] = useState(240);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      280,
      withTiming(ratio, { duration: 800, easing: Easing.out(Easing.cubic), reduceMotion: RM }),
      RM,
    );
  }, [ratio, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      style={[styles.bar, { backgroundColor: track }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.barFill, fill]}>
        <LinearGradient
          colors={[alpha(color, 0.7), color]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {ambient && ratio >= 1 ? <Sheen width={width} delay={1300} rest={2600} strength={0.4} /> : null}
    </View>
  );
});

/** Dolu gösterge. Dilimli ya da çubuk; sayı 0'dan sayar. */
const MeterCard = memo(function MeterCard({ content, theme, language, reduceMotion, ambient, delay }) {
  const { meter } = content;
  const full = meter.ratio >= 1;
  // Dolu çubuk "limit" hissi verir: tam doluysa uyarı rengi, değilse özelliğin rengi.
  const barColor = full ? GOLD : content.color;
  const track = alpha(theme.text.muted, 0.18);
  const segmented = meter.cap <= MAX_SEGMENTS;
  const filledCount = Math.min(meter.cap, meter.used);

  return (
    <Rise delay={delay} dy={18} style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.meterHead}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[styles.meterTitle, { color: theme.text.primary }]}
        >
          {content.featureTitle}
        </Text>
        <Text allowFontScaling={false} style={[styles.meterValue, { color: barColor }]}>
          <CountUp
            value={meter.used}
            reduceMotion={reduceMotion}
            language={language}
            delay={delay + 260}
            style={[styles.meterValue, { color: barColor }]}
          />
          <Text style={[styles.meterValue, { color: theme.text.muted }]}>{` / ${meter.cap}`}</Text>
          {meter.unit ? (
            <Text style={[styles.meterUnit, { color: theme.text.muted }]}>{` ${meter.unit}`}</Text>
          ) : null}
        </Text>
      </View>

      {segmented ? (
        <View style={styles.segments}>
          {Array.from({ length: meter.cap }, (_, i) => (
            <Segment key={i} index={i} filled={i < filledCount} color={barColor} track={track} />
          ))}
        </View>
      ) : (
        <FillBar ratio={meter.ratio} color={barColor} track={track} ambient={ambient} />
      )}

      {content.renew ? (
        <View style={styles.inlineRow}>
          <Ionicons name="time-outline" size={13} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[styles.inlineText, { color: theme.text.muted }]}>
            {content.renew}
          </Text>
        </View>
      ) : null}
    </Rise>
  );
});

// ── Plan kartları ────────────────────────────────────────────────────────────

/**
 * Plan kartı: bu özellikte o planın değeri. Önerilen kart taçlı, nefes alan çerçeveli.
 *
 * Kart YERLEŞİMİ üç kartta birebir aynıdır (çerçeve, dolgu, etiket konumu); önerilen
 * kart yalnız renkle (gradyan çerçeve, hale, taç, aksan rengi ad) ayrışır. Puntolar
 * `typo`dan gelir (utils/premiumUpsellContent.planTierTypography): satırın en uzun
 * parçasına ve ekran genişliğine göre hesaplanır, üç kartta AYNIDIR. Cihazın "sığana
 * dek küçült" davranışına (adjustsFontSizeToFit) yalnız tek satırlık metinlerde ve
 * yalnız güvenlik ağı olarak yaslanılır; çok satırlıda hiç kullanılmaz.
 *
 * Her metne `fontRole` AÇIKÇA verilir: rol otomatik seçilirse "2"/"150" gibi saf
 * rakamlar kullanıcının RAKAM fontuna, "Sınırsız" ise BAŞLIK fontuna düşüp aynı
 * satırda iki farklı yazı tipi çıkıyordu (bkz. components/typography/AppText.js).
 * Satır yüksekliği de elle verilir: özel yazı tiplerinin doğal satır yüksekliği
 * etiket ve kart ölçülerini kaydırmasın.
 */
const TierCard = memo(function TierCard({ tier, theme, tr, es, pt, de, color, ambient, delay, typo }) {
  const target = tier.isTarget;
  const flag = target ? (tr ? "Önerilen" : es ? "La mejor opción" : pt ? "A melhor escolha" : de ? "Beste Wahl" : "Best pick") : tier.isCurrent ? (tr ? "Şu an" : es ? "Ahora" : pt ? "Agora" : de ? "Jetzt" : "Now") : null;
  const figure = typo.mode === "figure";

  // Hale yalnız opaklıkla nefes alır: ölçekleyen halenin kenarı komşu karta ve
  // etiketlere doğru ileri geri kayıyordu.
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!target || !ambient) return;
    const cfg = { duration: 1500, easing: ambientEase, reduceMotion: RM };
    breathe.value = withDelay(
      delay + 600,
      withRepeat(withSequence(withTiming(1, cfg), withTiming(0, cfg)), -1, false, undefined, RM),
      RM,
    );
  }, [target, ambient, delay, breathe]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 + breathe.value * 0.5 }));

  const inner = (
    <View style={[styles.tierInner, { backgroundColor: theme.secondary }]}>
      {target ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.accent, 0.12) }]}
        />
      ) : null}
      <Text
        fontRole="body"
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[
          styles.tierName,
          { fontSize: typo.name, lineHeight: Math.round(typo.name * 1.35), color: target ? theme.accent : theme.text.muted },
        ]}
      >
        {tier.name}
      </Text>
      <View style={styles.tierBody}>
        {figure ? (
          <>
            <Text
              fontRole="heading"
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[
                styles.tierFigure,
                { fontSize: typo.text, lineHeight: Math.round(typo.text * 1.3), color: theme.text.primary },
              ]}
            >
              {tier.main}
            </Text>
            {tier.sub ? (
              <Text
                fontRole="body"
                allowFontScaling={false}
                numberOfLines={2}
                style={[styles.tierSub, { fontSize: typo.sub, lineHeight: Math.round(typo.sub * 1.3), color: theme.text.muted }]}
              >
                {tier.sub}
              </Text>
            ) : null}
          </>
        ) : (
          <Text
            fontRole="body"
            allowFontScaling={false}
            numberOfLines={3}
            style={[
              styles.tierPhrase,
              { fontSize: typo.text, lineHeight: Math.round(typo.text * 1.3), color: theme.text.primary },
            ]}
          >
            {tier.value}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={`${tier.name}: ${tier.value}${flag ? `, ${flag}` : ""}`}
      style={styles.tierCell}
    >
      {target ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.tierHalo, halo]}>
            <LinearGradient
              colors={[alpha(theme.accent, 0.4), alpha(color, 0.22)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <LinearGradient
            colors={[theme.accent, color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tierBorder}
          >
            {inner}
          </LinearGradient>
        </>
      ) : (
        <View style={[styles.tierBorder, { backgroundColor: theme.border }]}>{inner}</View>
      )}
      {flag ? (
        <View
          pointerEvents="none"
          style={[
            styles.tierFlag,
            { backgroundColor: target ? theme.accent : theme.primary, borderColor: target ? theme.accent : theme.border },
          ]}
        >
          {target ? <MaterialCommunityIcons name="crown" size={11} color="#FFFFFF" /> : null}
          <Text
            fontRole="body"
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.tierFlagText, { color: target ? "#FFFFFF" : theme.text.secondary }]}
          >
            {flag}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

// ── Kazanç satırları ─────────────────────────────────────────────────────────

/** "Premium ile ayrıca": gerçek kapılardan kazanç satırları, sağdan kayarak girer. */
const PerksCard = memo(function PerksCard({ content, theme, tr, es, pt, de, delay }) {
  return (
    <Rise delay={delay} dy={18} style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.perksHead}>
        <MaterialCommunityIcons name="star-four-points" size={12} color={GOLD} />
        <Text allowFontScaling={false} style={[styles.perksHeading, { color: theme.text.muted }]}>
          {tr ? `${content.targetName} ile ayrıca` : es ? `También con ${content.targetName}` : pt ? `Também com ${content.targetName}` : de ? `Auch mit ${content.targetName}` : `Also with ${content.targetName}`}
        </Text>
      </View>
      {content.perks.map((perk, index) => (
        <Rise
          key={perk.id}
          delay={delay + 140 + index * 110}
          dy={0}
          dx={22}
          style={[
            styles.perkRow,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}
        >
          <View style={[styles.perkIcon, { backgroundColor: alpha(perk.color, 0.16) }]}>
            <Ionicons name={perk.icon} size={15} color={perk.color} />
          </View>
          {/* Başlık ve değer 2 satıra kadar sarılır: tek satıra zorlamak "CineMatch AI
              me…" gibi kesik başlıklar üretiyordu. Günlük/aylık çift değer ("20/gün ·
              300/ay") ayırıcı noktadan iki satıra bölünür; nokta satır sonunda kalmaz. */}
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.perkTitle, { color: theme.text.secondary }]}
          >
            {perk.title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.perkValue, { color: theme.text.primary }]}
          >
            {perk.value.replace(" · ", "\n")}
          </Text>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
        </Rise>
      ))}
    </Rise>
  );
});

// ── Alt alan ─────────────────────────────────────────────────────────────────

/** Birincil düğme: basınca yaylanır, parıltı geçer, ok hafifçe iter. */
const UpgradeButton = memo(function UpgradeButton({ label, accent, accentEnd, ambient, onPress }) {
  const press = usePressScale(0.97);
  const [width, setWidth] = useState(300);
  const nudge = useSharedValue(0);
  useEffect(() => {
    if (!ambient) return;
    const cfg = { duration: 600, easing: Easing.inOut(Easing.quad), reduceMotion: RM };
    nudge.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(1, cfg),
          withTiming(0, cfg),
          withDelay(1500, withTiming(0, { duration: 0, reduceMotion: RM }), RM),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [ambient, nudge]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value * 4 }] }));

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.ctaWrap, { shadowColor: accent, backgroundColor: accent }]}
      >
        <LinearGradient
          colors={[accent, accentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cta}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
            style={styles.ctaGloss}
          />
          {ambient ? <Sheen width={width} /> : null}
          <MaterialCommunityIcons name="crown" size={18} color="#FFFFFF" />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.ctaText, styles.ctaLabel]}
          >
            {label}
          </Text>
          <Animated.View style={arrow}>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
});

// ── Sayfa ────────────────────────────────────────────────────────────────────

/**
 * Sunum bileşeni: içerik modeli + fiyat ipucu verilir, kararları geri bildirir.
 * (Host dışında da kullanılabilir; yalnız görünüm.)
 */
export const PremiumUpsellSheet = memo(function PremiumUpsellSheet({
  visible,
  content,
  priceHint,
  tr,
  es,
  pt, de,
  onPrimary,
  onSecondary,
  onDismissed,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  // Sürekli dönen süsler: "Hareketi azalt" açıkken hiç çizilmez.
  const ambient = !reduceMotion;

  if (!content) return null;
  const { color } = content;
  const accentEnd = theme.bold || theme.accent;

  // Giriş sahnesinin zamanlaması (ms): hero → gösterge → kartlar → kazançlar → düğme.
  const meterDelay = 360;
  const tiersDelay = content.meter ? 520 : 380;
  const perksDelay = tiersDelay + 360;
  const noteDelay = perksDelay + 260;

  // Plan satırının ortak tipografisi: sütun genişliği = (ekran − sayfa yan dolgusu
  // − sütun araları) / sütun sayısı. Üç kartın puntosu buradan, AYNI gelir.
  const tierCount = Math.max(1, content.tiers.length);
  const tierColumnWidth =
    (windowWidth - TIERS_SIDE_PADDING - TIERS_GAP * (tierCount - 1)) / tierCount;
  const tierTypo = planTierTypography(content.tiers, tierColumnWidth);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onSecondary}
      onDismissed={onDismissed}
      intensity={34}
      dimColor="rgba(0,0,0,0.22)"
      liftWithKeyboard={false}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <HeroBackdrop color={color} accent={theme.accent} ambient={ambient} />

        {/* HERO */}
        <View style={styles.hero}>
          <Medallion content={content} backdrop={theme.primary} ambient={ambient} />
          <Rise delay={240} dy={12}>
            <View style={[styles.eyebrow, { backgroundColor: alpha(color, 0.16) }]}>
              <Text allowFontScaling={false} style={[styles.eyebrowText, { color }]}>
                {content.eyebrow}
              </Text>
            </View>
          </Rise>
          <Rise delay={290} dy={14}>
            <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
              {content.title}
            </Text>
          </Rise>
          {content.message ? (
            <Rise delay={340} dy={14}>
              <Text allowFontScaling={false} style={[styles.message, { color: theme.text.secondary }]}>
                {content.message}
              </Text>
            </Rise>
          ) : null}
        </View>

        {content.meter ? (
          <MeterCard
            content={content}
            theme={theme}
            language={language}
            reduceMotion={reduceMotion}
            ambient={ambient}
            delay={meterDelay}
          />
        ) : null}

        {content.tiers.length > 0 ? (
          // Üç kart TEK parça olarak girer: kartların tek tek, farklı anlarda
          // süzülüp ölçeklenmesi geçiş boyunca hizasız görünüyordu.
          <Rise delay={tiersDelay} dy={18} style={styles.tiers}>
            {content.tiers.map((tier) => (
              <TierCard
                key={tier.plan}
                tier={tier}
                theme={theme}
                tr={tr}
                es={es}
                pt={pt} de={de}
                color={color}
                ambient={ambient}
                delay={tiersDelay}
                typo={tierTypo}
              />
            ))}
          </Rise>
        ) : null}

        {content.perks.length > 0 ? (
          <PerksCard content={content} theme={theme} tr={tr} es={es} pt={pt} de={de} delay={perksDelay} />
        ) : null}

        {content.note ? (
          <Rise delay={noteDelay} dy={10} style={styles.inlineRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.text.muted} />
            <Text
              allowFontScaling={false}
              style={[styles.inlineText, styles.noteText, { color: theme.text.muted }]}
            >
              {content.note}
            </Text>
          </Rise>
        ) : null}
      </ScrollView>

      {/* SABİT ALT ALAN: kaydırmadan düğme her zaman erişilebilir. */}
      <View
        style={[
          styles.footer,
          { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        {priceHint ? (
          <Rise delay={perksDelay + 80} dy={10} style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text allowFontScaling={false} style={[styles.priceName, { color: theme.text.secondary }]}>
                {priceHint.name}
              </Text>
              {priceHint.offer ? (
                <View style={[styles.offerPill, { backgroundColor: alpha(OFFER_COLOR, 0.16) }]}>
                  <Ionicons name="pricetag" size={10} color={OFFER_COLOR} />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[styles.offerText, { color: OFFER_COLOR }]}
                  >
                    {priceHint.offer}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.price, { color: theme.text.primary }]}
            >
              {priceHint.price}
              <Text style={[styles.pricePeriod, { color: theme.text.muted }]}>
                {priceHint.period ? ` ${priceHint.period}` : ""}
              </Text>
            </Text>
          </Rise>
        ) : null}

        <Rise delay={perksDelay + 160} dy={22}>
          {content.canUpgrade ? (
            <UpgradeButton
              label={content.cta.primary}
              accent={theme.accent}
              accentEnd={accentEnd}
              ambient={ambient}
              onPress={onPrimary}
            />
          ) : (
            <GlassPressable
              accessibilityRole="button"
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.cta,
                styles.ctaPlain,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.ctaText, { color: theme.text.primary }]}>
                {content.cta.primary}
              </Text>
            </GlassPressable>
          )}
        </Rise>

        {content.cta.secondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondary}
            hitSlop={8}
            style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text allowFontScaling={false} style={[styles.secondaryText, { color: theme.text.muted }]}>
              {content.cta.secondary}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheetModal>
  );
});

// ── Host ─────────────────────────────────────────────────────────────────────

/**
 * App.js'te BİR KEZ asılır (AppAlertHost'un yanında). Köprüden gelen istekleri
 * sırayla gösterir; görünür bir sayfa varken gelenler bekler ve kapanınca açılır.
 *
 * Kapanış: `close(callback)` sayfayı indirir; callback ve sıradaki istek, sayfa
 * GERÇEKTEN kalktığında (BottomSheetModal `onDismissed`) çalışır — iOS kapanmakta
 * olan Modal'ın üstüne yenisini sunamaz. Sinyal hiç gelmezse CLOSE_FALLBACK_MS
 * sonra aynı devam eder, host kilitli kalmaz. İçerik ve callback'ler o süre
 * boyunca korunur.
 */
export function PremiumUpsellHost() {
  const { language } = useLanguage();
  const { packages, introEligibleIds, usingTestStore } = usePremium();
  const lang = normalizeAppLanguage(language);

  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState(null);

  const pendingRef = useRef([]);
  const visibleRef = useRef(false);
  const closingRef = useRef(false);
  const closeGateRef = useRef(null);
  if (!closeGateRef.current) closeGateRef.current = createCloseGate(CLOSE_FALLBACK_MS);
  const closeGate = closeGateRef.current;

  const showNow = useCallback((next) => {
    setRequest(next);
    setVisible(true);
    visibleRef.current = true;
    closingRef.current = false;
    try {
      Haptics.selectionAsync();
    } catch {
      /* dokunsal geri bildirim isteğe bağlı */
    }
  }, []);

  useEffect(() => {
    const unregister = registerUpsellHost((next) => {
      if (visibleRef.current) pendingRef.current.push(next);
      else showNow(next);
    });
    return () => {
      unregister();
      closeGate.cancel();
    };
  }, [closeGate, showNow]);

  const close = useCallback(
    (callback) => {
      if (closingRef.current) return;
      closingRef.current = true;
      closeGate.begin(() => {
        visibleRef.current = false;
        if (typeof callback === "function") callback();
        const next = pendingRef.current.shift();
        if (next) showNow(next);
        else closingRef.current = false;
      });
      setVisible(false);
    },
    [closeGate, showNow],
  );

  const content = useMemo(
    () =>
      request ? buildUpsellContent(request.featureId, request.plan, lang, { used: request.used }) : null,
    [request, lang],
  );

  const priceHint = useMemo(
    () =>
      content?.canUpgrade
        ? buildPriceHint({
            packages,
            tier: content.targetPlan,
            language: lang,
            usingTestStore,
            introEligibleIds,
          })
        : null,
    [content, packages, lang, usingTestStore, introEligibleIds],
  );

  const onPrimary = useCallback(() => {
    if (!request || !content) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* isteğe bağlı */
    }
    if (!content.canUpgrade) {
      close(request.onDismiss);
      return;
    }
    trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_ACTION, {
      feature: request.featureId,
      plan: request.plan,
      action: "upgrade",
    });
    // Eski akışla aynı sıra: sayfa kapanır, sonra çağıranın onUpgrade'i
    // (ör. üstteki modalı kapat) ve ödeme ekranı.
    close(() => {
      request.onUpgrade?.();
      openPremiumScreen(request.featureId);
    });
  }, [close, content, request]);

  const onSecondary = useCallback(() => {
    if (!request) return;
    if (content?.canUpgrade) {
      trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_ACTION, {
        feature: request.featureId,
        plan: request.plan,
        action: "dismiss",
      });
    }
    close(request.onDismiss);
  }, [close, content, request]);

  return (
    <PremiumUpsellSheet
      visible={visible}
      content={content}
      priceHint={priceHint}
      tr={lang === "tr"}
      es={lang === "es"}
      pt={lang === "pt"} de={lang === "de"}
      onPrimary={onPrimary}
      onSecondary={onSecondary}
      onDismissed={closeGate.finish}
    />
  );
}

export default PremiumUpsellHost;

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 28,
  },
  handle: {
    position: "absolute",
    top: 9,
    alignSelf: "center",
    zIndex: 2,
    width: 42,
    height: 5,
    borderRadius: 3,
    opacity: 0.65,
  },
  // Köşeleri kendisi yuvarlar ve kırpar: hero ışığı sayfanın yuvarlak üst
  // kenarını taşırmasın (sayfanın kendisi iOS gölgesi için `overflow` kırpmıyor).
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  content: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 14, gap: 12 },

  // hero
  // Kendi köşelerini yuvarlayıp kırpar: kürelerin ışığı sayfanın yuvarlak üst
  // kenarından dışarı taşmasın (Android'de ScrollView kırpması tek başına yetmez).
  heroBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sparkle: { position: "absolute" },
  hero: { alignItems: "center", paddingBottom: 2 },
  medalWrap: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pulseRing: { position: "absolute", borderWidth: 1.5 },
  medalShadow: {
    width: 68,
    height: 68,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  medal: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  medalGloss: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
  lockBadge: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  lockInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginBottom: 9 },
  eyebrowText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 23, fontWeight: "900", letterSpacing: -0.5, textAlign: "center" },
  message: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 8,
  },

  // kartlar
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  meterHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  meterTitle: { flex: 1, fontSize: 13.5, fontWeight: "800" },
  meterValue: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  meterUnit: { fontSize: 12, fontWeight: "600" },
  segments: { flexDirection: "row", gap: 6, marginTop: 11 },
  segment: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  segmentFill: { borderRadius: 5 },
  bar: { height: 10, borderRadius: 5, overflow: "hidden", marginTop: 11 },
  barFill: { height: "100%", borderRadius: 5, overflow: "hidden" },
  sheen: { position: "absolute", top: -10, bottom: -10, width: 70 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  inlineText: { fontSize: 12, fontWeight: "600" },
  noteText: { flex: 1, lineHeight: 17, marginTop: 0 },

  // plan kartları
  // Üç hücre aynı yüksekliğe gerilir (`alignItems: stretch`, varsayılan): kart
  // içeriği ne kadar sarılırsa sarılsın alt kenarlar hizalı kalır. Hücrenin çocukları
  // (`tierBorder` → `tierInner` → `tierBody`) bunun için `flexGrow: 1` alır.
  //
  // DİKKAT — `flex: 1` KULLANMA: yüksekliği belirsiz bir kapta (ScrollView içeriği)
  // `flex: 1` = flexBasis 0 olduğundan çocuk SIFIRA ÇÖKER; satır ~13 dp'ye iner,
  // kartların içi altındaki karta bindirilip kaybolur (cihazda görüldü, 14 Eki).
  // Web/CSS bunu yutar, Yoga yutmaz — önizlemede GÖRÜNMEZ. `flexGrow: 1` basis'i
  // içerikten alıp artanı doldurur. (`tierCell` satırın YATAY ekseninde esnediği için
  // `flex: 1` kalabilir: genişlik tanımlı.)
  tiers: { flexDirection: "row", gap: TIERS_GAP, paddingTop: 10 },
  tierCell: { flex: 1, minWidth: 0 },
  tierHalo: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 22,
    overflow: "hidden",
  },
  // Çerçeve: önerilen kartta gradyan, diğerlerinde düz kenar rengi — İKİSİ de aynı
  // 1.5 dp kalınlıkta, böylece iç içerik üç kartta aynı noktadan başlar.
  tierBorder: { flexGrow: 1, borderRadius: 18, padding: 1.5 },
  tierInner: {
    flexGrow: 1,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingTop: 18,
    paddingBottom: 11,
    overflow: "hidden",
  },
  // Punto ve satır yüksekliği satır içi gelir (planTierTypography); burada yalnız
  // punto-bağımsız özellikler durur.
  tierName: { alignSelf: "stretch", textAlign: "center", fontWeight: "800", marginBottom: 6 },
  // Değer bölgesi kalan yüksekliği doldurup içeriği ortalar: bir kartta figür +
  // birim, komşusunda tek satırlık "—" olsa da gövdeler aynı eksende durur.
  tierBody: { flexGrow: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", minHeight: 44 },
  tierFigure: { alignSelf: "stretch", textAlign: "center", fontWeight: "900", letterSpacing: -0.3 },
  tierSub: { textAlign: "center", fontWeight: "700" },
  tierPhrase: { alignSelf: "stretch", textAlign: "center", fontWeight: "800" },
  tierFlag: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierFlagText: { flexShrink: 1, fontSize: 10.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.2 },

  // kazanç satırları
  perksHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  perksHeading: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  perkIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  perkTitle: { flex: 1, fontSize: 13.5, lineHeight: 18, fontWeight: "600" },
  perkValue: { fontSize: 13.5, lineHeight: 18, fontWeight: "800", maxWidth: "46%", textAlign: "right" },

  // alt alan
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  // Ad + teklif rozeti sığmazsa rozet alt satıra iner (uzun teklif metni, "Premium
  // Max", geniş yazı tipi); fiyat ise hep tek satır ve sağda kalır.
  priceLeft: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 4, flexShrink: 1 },
  priceName: { fontSize: 13.5, fontWeight: "700" },
  offerPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  offerText: { flexShrink: 1, fontSize: 11, fontWeight: "800" },
  price: { flexShrink: 0, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  pricePeriod: { fontSize: 12, fontWeight: "600" },
  // Gölge yalnız dış sarmalayıcıda (düğme `overflow: hidden`, gölgeyi keserdi).
  ctaWrap: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  cta: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    overflow: "hidden",
  },
  ctaGloss: { position: "absolute", top: 0, left: 0, right: 0, height: "52%" },
  ctaPlain: { borderWidth: 1 },
  ctaText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "900", letterSpacing: -0.1 },
  // Düğme yazısı simge ile ok arasında esner; uzun etiket/geniş yazı tipinde
  // okun üstüne binmek yerine küçülür.
  ctaLabel: { flexShrink: 1 },
  secondary: { alignSelf: "center", paddingTop: 11, paddingBottom: 2 },
  secondaryText: { fontSize: 13.5, fontWeight: "700" },
});

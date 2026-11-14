// components/decor/UniversePosterFlip.js
//
// Detay posterindeki gizli evren "easter egg"i (gizli evrenler: utils/universeUnlocks.js).
// Eskiden zevk uyumu düğmesinin yanında duran telefon önizlemesi (UniversePreviewCard) buraya taşındı:
//   • Posterin sağ alt köşesinde küçük, ara ara parıldayan bir işaret. Basınca poster Y ekseninde
//     DÖNER; arkasında aynı boyutta atmosfer yüzü vardır.
//   • Evren kilitli: arka yüz "?" kapısıdır; dokununca evrenin kapı sorusu (UniverseRiddleSheet).
//     Doğru cevap evreni açar ve arka yüz kendiliğinden önizlemeye döner.
//   • Evren açık: arka yüzde sahne oynar. Sahneye dokunmak evreni ARKA PLANDA etkinleştirir; yeniden
//     dokunmak kaldırır (önceki atmosfere döner). Alttaki hap durumu gösterir.
//   • Çevir işaretleri aynı köşede (sağ alt): öndeki işaret arkaya, arkadaki işaret aynı animasyonla öne.
// Görünürlük kuralı UniversePreviewCard ile aynı: evren kilitli + yapım İZLENMEMİŞ ise işaret hiç
// çizilmez (evrenin varlığı sızmaz). Sahne yalnız arka yüz açıkken kurulur; ekran odakta değilken
// ya da uygulama arka plandayken durur, "Hareketi Azalt" açıkken çizilmez ve dönüş anlık olur.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import GlassPressable from "../common/GlassPressable";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { showToast } from "../AppToast";
import WeatherLayer from "./WeatherLayer";
import UniverseRiddleSheet from "./UniverseRiddleSheet";
import { effectLabel } from "../settings/AtmosphereControls";
import { useSnowSettings } from "../../context/AppSettingsContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import useWeatherSettings from "../../hooks/useWeatherSettings";
import useUniverseUnlocks from "../../hooks/useUniverseUnlocks";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import useReduceMotion from "../../hooks/useReduceMotion";
import useScreenFocused from "../../hooks/useScreenFocused";
import useAppActive from "../../hooks/useAppActive";
import { haptic } from "../../services/hapticsService";
import { i18nText } from "../../utils/i18nText";
import { universeFor } from "../../utils/weatherUniverses";
import { isTitleWatched } from "../../utils/universeUnlocks";

export const FLIP_MS = 620;
const EGG = 22;


/**
 * @param {object} props
 * @param {"movie"|"tv"} props.titleType
 * @param {number} props.titleId
 * @param {number} [props.collectionId]
 * @param {object} props.theme
 * @param {number} props.width   poster genişliği
 * @param {number} props.height  poster yüksekliği
 * @param {number} props.radius  poster köşe yarıçapı
 * @param {React.ReactNode} props.children ön yüz (mevcut poster dokunuşu dahil)
 */
export default function UniversePosterFlip({ titleType, titleId, collectionId, theme, width, height, radius, children }) {
  const universe = useMemo(
    () => (titleId != null ? universeFor({ type: titleType, id: titleId, collectionId }) : null),
    [titleType, titleId, collectionId],
  );
  // isSolved: evren günü (geçici açık) kapıyı açmaz; kalıcı açılış yine kapı sorusuyla.
  const { isSolved } = useUniverseUnlocks();
  const ctx = useListStatusContext() || {};
  const watched = isTitleWatched(ctx, titleType, titleId);
  const solved = !!universe && isSolved(universe);
  const visible = !!universe && (solved || watched);

  if (!visible) return children;
  return (
    <Flipper universe={universe} solved={solved} theme={theme} width={width} height={height} radius={radius}>
      {children}
    </Flipper>
  );
}

function Flipper({ universe, solved, theme, width, height, radius, children }) {
  const reduceMotion = useReduceMotion();
  const flip = useRef(new Animated.Value(0)).current;
  const [side, setSide] = useState("front"); // front | back (hedef yüz)
  const [backMounted, setBackMounted] = useState(false);
  const [riddleOpen, setRiddleOpen] = useState(false);

  // Başka yapıma geçilince postere dön.
  useEffect(() => {
    flip.setValue(0);
    setSide("front");
    setBackMounted(false);
  }, [universe, flip]);

  const turn = useCallback(
    (to) => {
      haptic("tap");
      setSide(to);
      if (to === "back") setBackMounted(true);
      const done = () => {
        if (to === "front") setBackMounted(false);
      };
      if (reduceMotion) {
        flip.setValue(to === "back" ? 1 : 0);
        done();
        return;
      }
      Animated.timing(flip, {
        toValue: to === "back" ? 1 : 0,
        duration: FLIP_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) done();
      });
    },
    [flip, reduceMotion],
  );

  // Dönüşün ortasında hafif geri çekilme (kart havaya kalkıyor hissi) + karşı yüzün opaklık kesmesi
  // (Android'de backfaceVisibility her görünümde güvenilir değil).
  const lift = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1] });
  const frontStyle = {
    opacity: flip.interpolate({ inputRange: [0, 0.499, 0.5, 1], outputRange: [1, 1, 0, 0] }),
    transform: [
      { perspective: 900 },
      { scale: lift },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) },
    ],
  };
  const backStyle = {
    opacity: flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }),
    transform: [
      { perspective: 900 },
      { scale: lift },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] }) },
    ],
  };

  return (
    <View style={{ width, height }}>
      <Animated.View
        pointerEvents={side === "front" ? "auto" : "none"}
        style={[styles.face, frontStyle]}
        importantForAccessibility={side === "front" ? "auto" : "no-hide-descendants"}
        accessibilityElementsHidden={side !== "front"}
      >
        {children}
        <Egg solved={solved} theme={theme} onPress={() => turn("back")} />
      </Animated.View>

      {backMounted ? (
        <Animated.View
          pointerEvents={side === "back" ? "auto" : "none"}
          style={[styles.face, styles.back, { width, height, borderRadius: radius, borderColor: theme.accent + "66" }, backStyle]}
        >
          {solved ? (
            <SceneFace universe={universe} theme={theme} width={width} height={height} active={side === "back"} />
          ) : (
            <LockedFace theme={theme} onOpen={() => setRiddleOpen(true)} />
          )}
          <GlassPressable
            hitSlop={10}
            onPress={() => turn("front")}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.evren_poster_cevir", "Postere dön")}
            style={styles.flipBack}
          >
            <Ionicons name="sync" size={14} color="#FFFFFF" />
          </GlassPressable>
        </Animated.View>
      ) : null}

      {!solved ? (
        <UniverseRiddleSheet
          visible={riddleOpen}
          universe={universe}
          theme={theme}
          onClose={() => setRiddleOpen(false)}
          onSolved={(id) => {
            setRiddleOpen(false);
            haptic("celebrate");
            showToast({
              kind: "success",
              title: i18nText("autoI18n.evren_kesfedildi", "Yeni evren keşfettin: {{name}}").replace("{{name}}", effectLabel(id)),
              message: i18nText("autoI18n.evren_kesfedildi_alt", "Artık Atmosfer'de seni bekliyor."),
            });
          }}
        />
      ) : null}
    </View>
  );
}

/** Köşedeki küçük işaret: çoğu zaman sönük, birkaç saniyede bir parıldar. */
function Egg({ solved, theme, onPress }) {
  const twinkle = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (reduceMotion) return undefined;
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(2800),
        Animated.timing(twinkle, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [twinkle, reduceMotion]);
  return (
    <Pressable
      hitSlop={12}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={solved ? i18nText("autoI18n.evren_poster_arkasi", "Posterin arkasına bak") : i18nText("autoI18n.evren_gizli_baslik", "Gizli bir evren buldun")}
      style={styles.eggSlot}
    >
      <Animated.View
        style={[
          styles.egg,
          {
            borderColor: theme.accent + "99",
            opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }),
            transform: [
              { scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
              { rotate: twinkle.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "25deg"] }) },
            ],
          },
        ]}
      >
        <Ionicons name={solved ? "planet" : "sparkles"} size={12} color="#FFFFFF" />
      </Animated.View>
    </Pressable>
  );
}

/** Kilitli arka yüz: "?" kapısı; dokununca kapı sorusu. */
function LockedFace({ theme, onOpen }) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.evren_gizli_baslik", "Gizli bir evren buldun")}. ${i18nText("autoI18n.evren_poster_kapi", "Kapıyı açmak için dokun")}`}
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient colors={["#14121f", "#07070c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.lockRing, { borderColor: theme.accent + "77" }]} />
      <View style={styles.lockCenter}>
        <Text allowFontScaling={false} style={[styles.lockMark, { color: theme.accent }]}>
          ?
        </Text>
        <Text allowFontScaling={false} numberOfLines={2} style={styles.lockTitle}>
          {i18nText("autoI18n.evren_gizli_baslik", "Gizli bir evren buldun")}
        </Text>
        <View style={[styles.lockCta, { backgroundColor: theme.accent }]}>
          <Ionicons name="key" size={10} color="#FFFFFF" />
          <Text allowFontScaling={false} numberOfLines={1} style={styles.lockCtaText}>
            {i18nText("autoI18n.evren_poster_kapi_kisa", "Kapıyı aç")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// Arka yüzden açılan evren kapatılınca ÖNCEKİ atmosfere dönülür (oturum boyunca hatırlanır);
// önceki bilinmiyorsa (evren başka yerden seçilmişti) atmosfer kapatılır.
const previousAtmosphere = new Map();

/** Açık arka yüz: poster boyutunda canlı sahne; dokunuş evreni arka planda etkinleştirir / kaldırır. */
function SceneFace({ universe, theme, width, height, active }) {
  const reduceMotion = useReduceMotion();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const { choice, changeChoice } = useWeatherSettings();
  const { showSnow, snowAllowed, changeShowSnow } = useSnowSettings();
  const gate = usePremiumGate("snow_effect");
  const name = effectLabel(universe);
  const inAtmosphere = choice === universe && showSnow;
  const canAnimate = !reduceMotion;
  const playing = canAnimate && active && focused && appActive;

  const toggle = () => {
    if (inAtmosphere) {
      haptic("removed");
      const prev = previousAtmosphere.get(universe);
      previousAtmosphere.delete(universe);
      if (prev && prev.choice !== universe) {
        changeChoice(prev.choice);
        if (!prev.showSnow) changeShowSnow(false);
      } else {
        changeShowSnow(false);
      }
      showToast({
        kind: "info",
        title: i18nText("autoI18n.evren_cikarildi", "{{name}} arka plandan kaldırıldı").replace("{{name}}", name),
      });
      return;
    }
    haptic("added");
    if (choice !== universe) previousAtmosphere.set(universe, { choice, showSnow });
    changeChoice(universe);
    if (!snowAllowed) {
      gate.showUpsell();
      return;
    }
    if (!showSnow) changeShowSnow(true);
    showToast({
      kind: "success",
      title: i18nText("autoI18n.evren_eklendi", "{{name}} atmosferine eklendi").replace("{{name}}", name),
    });
  };

  const status = inAtmosphere
    ? i18nText("autoI18n.evren_atmosferde", "Atmosferinde")
    : i18nText("autoI18n.evren_atmosfere_ekle", "Atmosfere ekle");
  return (
    <>
      <Pressable
        onPress={toggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: inAtmosphere }}
        accessibilityLabel={`${name}. ${
          inAtmosphere
            ? i18nText("autoI18n.evren_poster_kaldir", "Arka plandan kaldır")
            : i18nText("autoI18n.evren_poster_etkinlestir", "Arka planda etkinleştir")
        }`}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary }]}
      >
        {canAnimate ? (
          <WeatherLayer preview width={width} height={height} playing={playing} speedScale={0.85} effectOverride={universe} />
        ) : (
          <LinearGradient colors={["#1a1830", "#0a0a12"]} style={StyleSheet.absoluteFill} />
        )}
      </Pressable>
      {inAtmosphere ? <View pointerEvents="none" style={[styles.activeFrame, { borderColor: theme.accent }]} /> : null}
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.78)"]} style={styles.backShade} />
      <View style={styles.backFoot} pointerEvents="none">
        <Text allowFontScaling={false} numberOfLines={1} style={styles.backName}>
          {name}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: inAtmosphere ? theme.accent : "rgba(255,255,255,0.18)" }]}>
          <Ionicons name={inAtmosphere ? "checkmark" : "add"} size={11} color="#FFFFFF" />
          <Text allowFontScaling={false} numberOfLines={1} style={styles.statusText}>
            {status}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  face: { position: "absolute", left: 0, top: 0, backfaceVisibility: "hidden" },
  back: { overflow: "hidden", borderWidth: 1.5, backgroundColor: "#07070c" },
  eggSlot: { position: "absolute", right: 6, bottom: 6 },
  egg: {
    width: EGG,
    height: EGG,
    borderRadius: EGG / 2,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Ön yüzdeki işaretle AYNI köşe (sağ alt, merkezler üst üste): çevir/geri çevir tek yerde.
  flipBack: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockRing: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    bottom: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  lockCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, gap: 6 },
  lockMark: { fontSize: 44, fontWeight: "900", lineHeight: 48 },
  lockTitle: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800", textAlign: "center", lineHeight: 13 },
  lockCta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  lockCtaText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  backShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 58 },
  backFoot: { position: "absolute", left: 7, right: 36, bottom: 7, gap: 5 },
  activeFrame: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderRadius: 12 },
  backName: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: -0.1 },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 9,
    maxWidth: "100%",
  },
  statusText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "800", flexShrink: 1 },
});

// Test: çevir işaretlerinin aynı köşede durduğunu doğrulamak için.
export const __styles = styles;

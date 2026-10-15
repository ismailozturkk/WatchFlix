// components/hub/CineSwipeWidget.js
//
// Hub'daki CineSwipe ("Birlikte Ne İzlesek?") kartı. İki parça:
//   • Sol  — rozetler, başlık, tek cümlelik açıklama.
//   • Sağ  — üç gerçek afişten yelpaze: ön afiş sağa yatık ve kalp rozetli, yani
//            "sağa kaydır = beğen" jesti kartın kendisinde anlatılır. Afişler
//            uygulamayla paketlenen splash havuzundan, günün tohumuyla seçilir
//            (her gün farklı üçlü, ağ gerekmez). Yelpaze çok hafif süzülür;
//            sistemin "Hareketi azalt" ayarına uyar.
// Altta iki eşit düğme: "Tek başına" / "Arkadaşınla". Kartın geri kalanına
// basmak da solo'yu açar (eskisi gibi).
//
// Dış kart `accessible={false}`: VoiceOver iç düğmeleri tek tek okuyabilsin
// (erişilebilir bir üst öğe çocuklarını yutar).

import React, { memo, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill } from "@components/hub/HubCard";
import { PressableScale } from "@components/game/ui";
import PremiumPill from "@components/premium/PremiumPill";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { i18nText } from "@utils/i18nText";
import { hashString } from "@utils/seededRandom";
import { triggerHaptic } from "@services/hapticsService";
import { SPLASH_POSTER_CATALOG } from "../../data/splashPosterCatalog";

const COLORS = ["#E11D48", "#9F1239", "#25091A"];
const ROSE = "#E11D48";
const GOLD = "#FFD76A";
const RM = ReduceMotion.System;

// Üç afişin yelpaze yerleşimi (soldan sağa; sonuncusu öne gelir).
const FAN = [
  { left: 0, top: 22, rotate: "-13deg", scale: 0.92, opacity: 0.78 },
  { left: 19, top: 8, rotate: "-3deg", scale: 0.97, opacity: 0.92 },
  { left: 40, top: 24, rotate: "9deg", scale: 1, opacity: 1 },
];

function pickPosters(dayKey) {
  const total = SPLASH_POSTER_CATALOG.length;
  const picked = [];
  let salt = 0;
  while (picked.length < FAN.length && salt < 30) {
    const index = hashString(`${dayKey}|cine|${salt}`) % total;
    if (!picked.includes(index)) picked.push(index);
    salt += 1;
  }
  return picked.map((index) => SPLASH_POSTER_CATALOG[index]);
}

// Yelpazenin yavaş süzülmesi: UI thread'de, sonsuz ama çok ucuz.
function useFloat() {
  const t = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration: 2800, easing: Easing.inOut(Easing.sin), reduceMotion: RM };
    t.value = withRepeat(
      withSequence(withTiming(1, cfg), withTiming(0, cfg)),
      -1,
      false,
      undefined,
      RM,
    );
    return () => cancelAnimation(t);
  }, [t]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * t.value }, { rotate: `${t.value * 1.6}deg` }],
  }));
}

function CineSwipeWidget({ navigation }) {
  const floatStyle = useFloat();
  const posters = useMemo(() => {
    const d = new Date();
    return pickPosters(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }, []);

  // CineSwipe Premium'da (tek başına + arkadaşla oda). Free kullanıcıda kart
  // görünür kalır, her iki giriş de yükseltme sayfasını açar. Günlük hakkı biten
  // Premium kullanıcı kilitli SAYILMAZ (allows(0) yalnız planda hiç hak yoksa
  // false); hak bitişini ekranın içindeki kapılar söyler.
  const swipesGate = usePremiumGate("cineswipe_swipes");
  const roomsGate = usePremiumGate("cineswipe_rooms");
  const soloLocked = !swipesGate.allows(0);
  const duoLocked = !roomsGate.allows(0);

  const open = (initialMode) => {
    triggerHaptic("impact");
    const gate = initialMode === "duo" ? roomsGate : swipesGate;
    if (!gate.allows(0)) {
      gate.showUpsell();
      return;
    }
    navigation.navigate("CineSwipeScreen", { initialMode });
  };

  const title = i18nText("autoI18n.hub_cine_title", "Birlikte Ne İzlesek?");
  const solo = i18nText("autoI18n.hub_cine_solo", "Tek başına");
  const duo = i18nText("autoI18n.hub_cine_duo", "Arkadaşınla");

  return (
    <HubCard
      colors={COLORS}
      shadowColor={ROSE}
      onPress={() => open("solo")}
      accessible={false}
      cardStyle={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.copy}>
          <View style={styles.badges}>
            <GlassPill icon="film" text="CINESWIPE" tone="dark" />
            {soloLocked && duoLocked ? <PremiumPill tone="onDark" /> : null}
            <GlassPill
              icon="sparkles"
              iconColor={GOLD}
              text={i18nText("autoI18n.hub_cine_new", "Yeni")}
              style={styles.newPill}
              textStyle={styles.newPillText}
            />
          </View>
          <Text style={styles.title} allowFontScaling={false}>
            {title}
          </Text>
          <Text style={styles.subtitle} allowFontScaling={false}>
            {i18nText(
              "autoI18n.hub_cine_subtitle",
              "Kartları kaydır, arkadaşınla eşleş, bu akşamki filmi seç.",
            )}
          </Text>
        </View>

        <Animated.View pointerEvents="none" style={[styles.fan, floatStyle]}>
          {posters.map((poster, index) => {
            const layout = FAN[index];
            const front = index === FAN.length - 1;
            return (
              <View
                key={`${poster.mediaType}-${poster.id}`}
                style={[
                  styles.posterWrap,
                  {
                    left: layout.left,
                    top: layout.top,
                    opacity: layout.opacity,
                    transform: [{ rotate: layout.rotate }, { scale: layout.scale }],
                  },
                ]}
              >
                <View style={styles.poster}>
                  <Image source={poster.source} style={styles.posterImage} contentFit="cover" />
                </View>
                {front && (
                  <View style={styles.heart}>
                    <AppIcon family="Ionicons" name="heart" size={15} color={ROSE} />
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${solo}`}
          onPress={() => open("solo")}
          scaleTo={0.96}
          style={[styles.btn, styles.btnGlass]}
        >
          <AppIcon family="Ionicons" name={soloLocked ? "lock-closed" : "person"} size={15} color="#FFFFFF" />
          <Text style={styles.btnGlassText} allowFontScaling={false} numberOfLines={1}>
            {solo}
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${duo}`}
          onPress={() => open("duo")}
          scaleTo={0.96}
          style={[styles.btn, styles.btnWhite]}
        >
          <AppIcon family="Ionicons" name={duoLocked ? "lock-closed" : "people"} size={17} color={ROSE} />
          <Text style={styles.btnWhiteText} allowFontScaling={false} numberOfLines={1}>
            {duo}
          </Text>
        </PressableScale>
      </View>
    </HubCard>
  );
}

export default memo(CineSwipeWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  top: { flexDirection: "row", alignItems: "center", gap: 4 },
  copy: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  newPill: { backgroundColor: "rgba(255,215,0,0.16)", borderColor: "rgba(255,215,0,0.38)" },
  newPillText: { color: GOLD, letterSpacing: 0.4 },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 10,
  },
  subtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 4,
  },

  fan: { width: 104, height: 132 },
  posterWrap: { position: "absolute", width: 62, height: 93 },
  poster: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  posterImage: { width: "100%", height: "100%" },
  heart: {
    position: "absolute",
    left: -9,
    bottom: -9,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  btnGlass: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  btnWhite: { backgroundColor: "#FFFFFF" },
  btnGlassText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", flexShrink: 1 },
  btnWhiteText: { color: ROSE, fontSize: 13, fontWeight: "900", flexShrink: 1 },
});

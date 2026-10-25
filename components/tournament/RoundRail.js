// components/tournament/RoundRail.js
//
// Tur seçici: Son 32 → Son 16 → Çeyrek → Yarı → Final. Eski düz çiplerin yerine
// her tur küçük bir KART: tur adı + durum ikonu (✓ bitti / kilit / canlı nokta),
// durum yazısı ve altta KENDİ oy ilerlemen (oy verdiğin maç / toplam maç).
//
// Durum yazısı: oylanan turda "3/16", bitenlerde "Tamamlandı", henüz açılmamışta
// "Yakında". İlerleme çubuğu her kartta aynı yerde durur ki kart yükseklikleri
// farklılaşmasın; yalnız doluluğu değişir.
//
// Seçili kart accent dolgulu; oylanan tur accent çerçeveli + nabızlı noktalıdır.
// Seçim değişince (ör. aşama çizelgesinden atlayınca) ray seçili karta kayar.

import React, { memo, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, ReduceMotion,
} from "react-native-reanimated";
import AppIcon from "@components/AppIcon";
import { roundLabel } from "@services/tournamentEngine";
import { i18nText } from "@utils/i18nText";
import GlassPressable from "../common/GlassPressable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

// Uygulamanın onay/başarı yeşili (TournamentScreen / MatchCard ile aynı değer).
const DONE_GREEN = "#22C55E";
const LIVE_RED = "#EF4444";

// Canlı tur noktası: ortada sabit nokta, çevresinde genişleyip sönen halka.
const LiveDot = memo(function LiveDot() {
  const p = useSharedValue(0);
  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System };
    p.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100, ...cfg }), withTiming(0, { duration: 0, ...cfg })),
      -1,
    );
  }, [p]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - p.value),
    transform: [{ scale: 1 + p.value * 1.2 }],
  }));
  return (
    <View style={styles.liveWrap}>
      <Animated.View pointerEvents="none" style={[styles.liveRing, ring]} />
      <View style={styles.liveDot} />
    </View>
  );
});

const RoundItem = memo(function RoundItem({
  def, index, selected, live, decided, locked, myCount, total, theme, lang, onSelect, onLayoutItem,
}) {
  const fg = selected ? "#fff" : locked ? theme.text.muted : theme.text.primary;
  const sub = selected ? "rgba(255,255,255,0.82)" : theme.text.muted;

  const statusText = live
    ? `${myCount}/${total}`
    : decided
      ? i18nText("autoI18n.tournament_state_done", "Tamamlandı")
      : i18nText("autoI18n.tournament_state_soon", "Yakında");

  const fill = total > 0 ? Math.min(100, Math.round((myCount / total) * 100)) : 0;

  return (
    <GlassPressable
      onPress={() => onSelect(index)}
      onLayout={(e) => onLayoutItem(index, e.nativeEvent.layout.x)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${roundLabel(def, lang)}, ${statusText}`}
      style={({ pressed }) => [
        styles.item,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : {
              backgroundColor: theme.secondary,
              borderColor: live ? theme.accent + "99" : theme.border,
            },
        locked && !selected && styles.itemLocked,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={styles.itemTop}>
        <Text numberOfLines={1} style={[styles.itemLabel, { color: fg }]}>
          {roundLabel(def, lang)}
        </Text>
        {live ? (
          <LiveDot />
        ) : decided ? (
          <AppIcon family="Ionicons" name="checkmark-circle" size={14} color={selected ? "#fff" : DONE_GREEN} />
        ) : (
          <AppIcon family="Ionicons" name="lock-closed" size={12} color={selected ? "#fff" : theme.text.muted} />
        )}
      </View>

      <Text numberOfLines={1} style={[styles.itemSub, { color: sub }]}>{statusText}</Text>

      <View style={[styles.track, { backgroundColor: selected ? "rgba(255,255,255,0.28)" : theme.border }]}>
        <View
          style={[
            styles.trackFill,
            { width: `${fill}%`, backgroundColor: selected ? "#fff" : theme.accent },
          ]}
        />
      </View>
    </GlassPressable>
  );
});

function RoundRail({ rounds = [], phase, activeRound, selected, onSelect, myPicks = {}, theme, lang = "tr" }) {
  const scrollRef = useRef(null);
  const offsets = useRef({});
  // Ölçüm callback'i kararlı kalsın (memo'lu kartlar her seçimde yeniden çizilmesin).
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const scrollToSelected = useCallback((idx) => {
    const x = offsets.current[idx];
    if (x == null) return;
    // x, içerik kabının sol dolgusunu (GLASS_PRESS_ROOM) içerir; kart eskisi gibi 16 pt içeride dursun.
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 16 - GLASS_PRESS_ROOM), animated: true });
  }, []);

  // Seçim dışarıdan (aşama çizelgesi) değişince seçili kart görünür kalsın.
  useEffect(() => { if (selected != null) scrollToSelected(selected); }, [selected, scrollToSelected]);

  // Düzen ölçülünce (ilk açılış) seçili kart henüz kaydırılmamış olabilir.
  const onLayoutItem = useCallback((idx, x) => {
    offsets.current[idx] = x;
    if (idx === selectedRef.current) scrollToSelected(idx);
  }, [scrollToSelected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {rounds.map((round, i) => {
        const decided = !!round?.decided;
        const live = phase === "voting" && i === activeRound && !decided;
        const locked = !decided && !round?.votable && phase !== "results";
        const matches = round?.matches || [];
        const myCount = matches.reduce((n, m) => n + (myPicks[m.matchId] ? 1 : 0), 0);
        return (
          <RoundItem
            key={round?.key || i}
            def={round?.def}
            index={i}
            selected={selected === i}
            live={live}
            decided={decided}
            locked={locked}
            myCount={myCount}
            total={matches.length}
            theme={theme}
            lang={lang}
            onSelect={onSelect}
            onLayoutItem={onLayoutItem}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Soldaki ilk kart basılınca kırpma sınırında kesilmesin: GLASS_PRESS_ROOM dolgu + eşit
  // negatif dış boşluk (dikeyde 14 pt zaten yeterli).
  scroll: { marginLeft: -GLASS_PRESS_ROOM },
  row: { gap: 10, paddingVertical: 14, paddingLeft: GLASS_PRESS_ROOM, paddingRight: 8 },
  item: {
    minWidth: 108, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 11,
    borderRadius: 16, borderWidth: 1,
  },
  itemLocked: { opacity: 0.7 },
  itemPressed: { transform: [{ scale: 0.97 }] },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemLabel: { flexShrink: 1, fontSize: 13, fontWeight: "900" },
  itemSub: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  track: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 2 },

  liveWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_RED },
  liveRing: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_RED },
});

export default memo(RoundRail);

// components/streak/StreakFlameBadge.js
//
// Profilde adın yanındaki seri rozeti: "12 🔥" — sayı BAŞARILI HAFTA sayısıdır.
// Seri yokken HİÇ çizilmez (null döner).
//
// Bu hafta henüz kazanılmadıysa alev solar ve yanında bir durum simgesi çıkar:
// ⌛ risk (bu hafta x/2 gün), 🩹 telafi (geçen hafta kaçtı, bu hafta 4 günle kurtar),
// 🛡 kalkan (geçen hafta kaçtı, kalkan koruyacak), ⏸ mola (gri alev). Telafi/kalkan
// beklerken sayı KURTARILACAK seridir. Alttaki ince çubuk bu haftanın ilerlemesidir.
//
// Dokununca ayrıntı sayfası (StreakFlameSheet) açılır. Sayfa açıkken rozetin
// saati durur: aynı anda iki alev çizmeye gerek yok, rozet bulanık perdenin
// arkasında kalıyor.
//
// KADEME ATLAYINCA "PATLAR": yeni hafta ya da ay kademesinde hap bir kez büyüyüp
// yerine oturur. Ölçeğin dinlenme değeri 1 (görünür) — bkz. StreakFlame.js başı.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import AppIcon from "@components/AppIcon";
import { alpha } from "@theme/colors";
import { streakFlameState } from "@utils/streakFlame";
import { getStreakFlameCopy } from "@utils/streakFlameCopy";
import { intlLocaleOf } from "@utils/appLanguages";
import StreakFlame from "./StreakFlame";
import StreakFlameSheet from "./StreakFlameSheet";
import useStreakFlameMotion from "./useStreakFlameMotion";
import useScreenFocused from "../../hooks/useScreenFocused";
import useStreakActions from "../../hooks/useStreakActions";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Durum simgesi: risk ⌛, telafi 🩹, kalkan 🛡, mola ⏸. Yandıysa simge yok.
const STATUS_ICON = Object.freeze({
  risk: "hourglass", repair: "bandage", shield: "shield-checkmark", paused: "pause-circle",
});

function StreakFlameBadge({ seriler, theme, language, size = 20 }) {
  const state = useMemo(() => streakFlameState(seriler), [seriler]);
  // Profil sekmesi arka planda bağlı kalır: odakta değilken alev döngüsü durur.
  const focused = useScreenFocused();
  const motion = useStreakFlameMotion() && focused;
  const [sheetOpen, setSheetOpen] = useState(false);
  const actions = useStreakActions();
  const open = useCallback(() => setSheetOpen(true), []);
  const close = useCallback(() => setSheetOpen(false), []);

  const pop = useSharedValue(1);
  // Kademe = başarılı hafta sayısı (streakLevel.index): her yeni haftada patlar.
  const levelIndex = state.visible ? state.level.index : -1;
  const lastLevel = useRef(levelIndex);
  useEffect(() => {
    const prev = lastLevel.current;
    lastLevel.current = levelIndex;
    if (levelIndex < 0 || prev < 0 || levelIndex <= prev || !motion) return;
    pop.value = withSequence(
      withTiming(1.32, { duration: 180 }),
      withSpring(1, { damping: 9, stiffness: 180 }),
    );
  }, [levelIndex, motion, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // Ayrıntı açıkken seri eşik altına düşerse sheet'i bir anda unmount etme; kapanış
  // animasyonu ve son geçerli içerik StreakFlameSheet içinde korunur.
  if (!state.visible && !sheetOpen) return null;
  const copy = getStreakFlameCopy(language);
  const palette = state.look.palette;
  const quiet = state.dimmed;
  const count = state.weeks.toLocaleString(intlLocaleOf(language));
  const statusIcon = STATUS_ICON[state.status];
  // Bu haftanın ilerlemesi: kazanılana kadar x/2, sonra ihtişam x/7.
  const milestoneRatio = state.week.won ? state.week.days / 7 : state.week.days / state.week.need;
  const repairing = state.status === "repair" || state.status === "shield";

  return (
    <>
      {state.visible ? (
        <AnimatedPressable
          testID="profile-streak-flame"
          accessibilityRole="button"
          accessibilityLabel={copy.a11y[state.status](state.weeks)}
          accessibilityState={{ expanded: sheetOpen }}
          hitSlop={8}
          onPress={open}
          style={[
            styles.pill,
            {
              backgroundColor: alpha(palette.glow, quiet ? 0.08 : 0.15),
              borderColor: alpha(palette.glow, quiet ? 0.22 : 0.42),
            },
            popStyle,
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.count, { color: quiet ? theme.text.secondary : theme.text.primary }]}
          >
            {count}
          </Text>
          <StreakFlame
            look={state.look}
            size={size}
            animated={motion && !sheetOpen}
            dimmed={quiet}
          />
          {statusIcon ? (
            <AppIcon
              family="Ionicons"
              name={statusIcon}
              size={11}
              color={state.status === "risk" ? theme.text.muted : palette.text}
            />
          ) : null}
          {/* Telafi (x/4) ya da bu haftanın (x/2) ilerlemesi: ilk işaretleme de rozette görünür. */}
          {repairing ? (
            <Text allowFontScaling={false} style={[styles.progress, { color: palette.text }]}>
              {`${Math.min(state.protection.repairHave, state.protection.repairNeed)}/${state.protection.repairNeed}`}
            </Text>
          ) : state.status === "risk" ? (
            <Text allowFontScaling={false} style={[styles.progress, { color: theme.text.muted }]}>
              {`${Math.min(state.week.days, state.week.need)}/${state.week.need}`}
            </Text>
          ) : null}
          <Animated.View testID="streak-milestone-progress" pointerEvents="none" style={styles.milestoneTrack}>
            <Animated.View
              style={[
                styles.milestoneFill,
                {
                  backgroundColor: palette.glow,
                  width: `${Math.max(8, Math.round(Math.max(0, Math.min(1, milestoneRatio)) * 100))}%`,
                },
              ]}
            />
          </Animated.View>
        </AnimatedPressable>
      ) : null}
      <StreakFlameSheet
        visible={sheetOpen}
        onClose={close}
        state={state}
        theme={theme}
        language={language}
        animated={motion}
        onTakeBreak={actions.takeBreak}
        breakBusy={actions.breakBusy}
        reminderOn={actions.reminderOn}
        onToggleReminder={actions.toggleReminder}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 0,
    paddingLeft: 8,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  count: {
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
  progress: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  milestoneTrack: { position: "absolute", left: 7, right: 6, bottom: 1, height: 2, borderRadius: 1, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.18)" },
  milestoneFill: { height: "100%", borderRadius: 1 },
});

export default memo(StreakFlameBadge);

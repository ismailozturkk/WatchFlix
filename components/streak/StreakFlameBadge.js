// components/streak/StreakFlameBadge.js
//
// Profilde adın yanındaki seri rozeti: "12 🔥" — Snapchat'teki sayaç gibi önce
// sayı, sonra alev. Art arda 3 günün altında HİÇ çizilmez (null döner).
//
// Bugün henüz işaretleme yoksa alev solar ve yanında bir durum simgesi çıkar:
// ⌛ risk (gün bitince kopar ya da kalkan korur), 🩹 telafi (dün kaçtı, bugün 2
// içerikle kurtar), 🛡 kalkan (dün kaçtı, kalkan koruyacak). Telafi/kalkan
// beklerken sayı KURTARILACAK seridir.
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Durum simgesi: risk ⌛ (bugün bir şey yok), telafi 🩹 (bugün 2 içerikle kurtar),
// kalkan 🛡 (gün sonunda kalkan koruyacak). Yandıysa simge yok.
const STATUS_ICON = Object.freeze({ risk: "hourglass", repair: "bandage", shield: "shield-checkmark" });

function StreakFlameBadge({ seriler, theme, language, size = 20 }) {
  const state = useMemo(() => streakFlameState(seriler), [seriler]);
  const motion = useStreakFlameMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = useCallback(() => setSheetOpen(true), []);
  const close = useCallback(() => setSheetOpen(false), []);

  const pop = useSharedValue(1);
  // Kademe = ay × 5 + hafta (streakLevel.index): yeni hafta ya da ay kademesinde patlar.
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

  if (!state.visible) return null;
  const copy = getStreakFlameCopy(language);
  const palette = state.look.palette;
  const quiet = state.dimmed;
  const count = state.days.toLocaleString(intlLocaleOf(language));
  const statusIcon = STATUS_ICON[state.status];

  return (
    <>
      <AnimatedPressable
        testID="profile-streak-flame"
        accessibilityRole="button"
        accessibilityLabel={copy.a11y[state.status](state.days)}
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
      </AnimatedPressable>
      <StreakFlameSheet
        visible={sheetOpen}
        onClose={close}
        state={state}
        theme={theme}
        language={language}
        animated={motion}
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
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  count: {
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
});

export default memo(StreakFlameBadge);

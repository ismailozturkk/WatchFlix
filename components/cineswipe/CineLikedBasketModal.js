// components/cineswipe/CineLikedBasketModal.js
//
// Solo modda sağa kaydırılanların toplandığı "Beğeni sepeti".
// Eski sürümde sepetteki bir içerik çıkarılamıyor, açılamıyordu ve "rastgele seç"
// sonucu anında beliriyordu. Şimdi:
//   • poster dokununca ayrıntı açılır, köşedeki × ile tek tek çıkarılır,
//   • "Rastgele seç" posterler üzerinde yavaşlayan bir rulet oynar,
//   • "Temizle" onay ister (yanlış dokunuş tüm seçimleri silmesin),
//   • çıkarma/giriş yeniden dizilimi animasyonludur.
import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Toast from "@components/AppToast";
import AppIcon from "../AppIcon";
import GlassCloseButton from "../common/GlassCloseButton";
import CineSheet from "./CineSheet";
import PressableScale from "./PressableScale";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { cineMediaKey, fillText, posterUrl } from "../../services/cineswipe/deckModel";

function BasketPoster({ item, highlighted, dimmed, busy, onOpen, onRemove, copy, colors }) {
  const pulse = useSharedValue(0);
  const dim = useSharedValue(1);

  useEffect(() => {
    pulse.value = withTiming(highlighted ? 1 : 0, { duration: 110 });
  }, [highlighted, pulse]);
  useEffect(() => {
    dim.value = withTiming(dimmed ? 0.4 : 1, { duration: 170 });
  }, [dimmed, dim]);

  const body = useAnimatedStyle(() => ({
    opacity: dim.value,
    transform: [{ scale: 1 + 0.08 * pulse.value }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const uri = posterUrl(item.poster_path || item.poster, "w342");
  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "";
  const title = item.title || item.name || "";

  return (
    // Giriş/çıkış/yeniden dizilim dış sarmalayıcıda: iç görünümün animasyonlu
    // transform'u ile çakışmasın.
    <Animated.View
      entering={ZoomIn.duration(220)}
      exiting={ZoomOut.duration(160)}
      layout={LinearTransition.duration(220)}
      style={styles.itemWrap}
    >
      <Animated.View style={[styles.item, { backgroundColor: alpha(colors.surface, 0.6) }, body]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${copy.basket.openDetails}`}
          disabled={busy}
          onPress={() => onOpen(item)}
          style={StyleSheet.absoluteFill}
        >
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: colors.between }]}>
              <AppIcon family="Ionicons" name="film-outline" size={28} color={colors.muted} />
            </View>
          )}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.gradient} />
          {rating && rating !== "0.0" ? (
            <View style={styles.rating}>
              <AppIcon family="Ionicons" name="star" size={9} color="#FFC83D" />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          ) : null}
        </Pressable>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${copy.basket.remove}`}
          disabled={busy}
          hitSlop={6}
          onPress={() => {
            triggerHaptic("selection");
            onRemove(item);
          }}
          style={styles.remove}
        >
          <AppIcon family="Ionicons" name="close" size={13} color="#FFFFFF" />
        </PressableScale>

        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: colors.heart }, ring]}
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * @param {Array<object>} items
 * @param {(media) => void} onRandomPick
 * @param {(items) => void} onSecondRound
 * @param {(items) => void} onSaveList
 * @param {(items) => void} onAddWatchlist
 * @param {() => void} onClear
 * @param {(media) => void} onRemove
 * @param {(media) => void} onOpenDetails
 */
export default function CineLikedBasketModal({
  visible,
  onClose,
  items = [],
  onRandomPick,
  onSecondRound,
  onSaveList,
  onAddWatchlist,
  onClear,
  onRemove,
  onOpenDetails,
}) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();
  const [highlightKey, setHighlightKey] = useState(null);
  const [rolling, setRolling] = useState(false);
  const timers = useRef([]);

  const stopRolling = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => stopRolling, []);
  useEffect(() => {
    if (visible) return;
    stopRolling();
    setRolling(false);
    setHighlightKey(null);
  }, [visible]);

  const handleRandom = () => {
    if (rolling || items.length === 0) return;
    const count = items.length;
    const pickedIndex = Math.floor(Math.random() * count);
    const picked = items[pickedIndex];
    const finish = () => {
      triggerHaptic("notification");
      onRandomPick?.(picked);
      onClose();
    };
    if (count === 1) {
      finish();
      return;
    }
    // Rulet: yavaşlayan ritimle posterleri sırayla vurgular, tam seçilene durur.
    setRolling(true);
    const steps = 14 + Math.floor(Math.random() * 5);
    const start = (((pickedIndex - (steps - 1)) % count) + count) % count;
    let elapsed = 0;
    for (let step = 0; step < steps; step += 1) {
      elapsed += 60 + step * step * 0.8;
      const item = items[(start + step) % count];
      timers.current.push(
        setTimeout(() => {
          setHighlightKey(cineMediaKey(item));
          triggerHaptic("selection");
        }, elapsed),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setRolling(false);
        finish();
      }, elapsed + 520),
    );
  };

  const handleSecondRound = () => {
    if (items.length < 2) {
      Toast.show({ type: "info", text1: copy.basket.needTwoTitle, text2: copy.basket.needTwoBody });
      return;
    }
    onSecondRound?.(items);
    onClose();
  };

  const handleSaveList = () => {
    if (!items.length) return;
    onSaveList?.(items);
    onClose();
  };

  const handleAddWatchlist = () => {
    if (!items.length) return;
    onAddWatchlist?.(items);
    onClose();
  };

  const handleClear = () => {
    triggerHaptic("selection");
    Alert.alert(copy.basket.clearTitle, copy.basket.clearBody, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.basket.clear, style: "destructive", onPress: () => onClear?.() },
    ]);
  };

  const handleOpen = (media) => {
    onClose();
    // Sayfa kapanırken ekran değişmesin: çıkış animasyonu bitsin.
    setTimeout(() => onOpenDetails?.(media), 280);
  };

  const hasItems = items.length > 0;

  return (
    <CineSheet
      visible={visible}
      onClose={onClose}
      icon="heart"
      iconColor={colors.heart}
      title={copy.basket.title}
      subtitle={fillText(copy.basket.count, { n: items.length })}
      headerRight={
        <View style={styles.headerActions}>
          {hasItems ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.basket.clear}
              disabled={rolling}
              onPress={handleClear}
              style={[styles.clear, { backgroundColor: alpha(colors.pass, 0.13) }]}
            >
              <AppIcon family="Ionicons" name="trash-outline" size={15} color={colors.pass} />
              <Text style={[styles.clearText, { color: colors.pass }]}>{copy.basket.clear}</Text>
            </PressableScale>
          ) : null}
          <GlassCloseButton
            size={34}
            fallbackRadius={17}
            iconSize={19}
            color={colors.textSecondary}
            backgroundColor={alpha(colors.text, 0.07)}
            accessibilityLabel={copy.close}
            onPress={onClose}
          />
        </View>
      }
      footer={
        hasItems ? (
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.basket.random}
              disabled={rolling}
              onPress={handleRandom}
              style={styles.primary}
            >
              <LinearGradient
                colors={[colors.heart, "#E01E43"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <AppIcon family="Ionicons" name={rolling ? "sync" : "dice-outline"} size={21} color="#FFFFFF" />
                <Text style={styles.primaryText}>{rolling ? copy.basket.rolling : copy.basket.random}</Text>
              </LinearGradient>
            </PressableScale>

            <View style={styles.secondaryRow}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={copy.basket.secondRound}
                disabled={rolling}
                onPress={handleSecondRound}
                style={[
                  styles.secondary,
                  {
                    backgroundColor: alpha(colors.accent, 0.15),
                    borderColor: alpha(colors.accent, 0.4),
                  },
                ]}
              >
                <AppIcon family="Ionicons" name="repeat" size={16} color={colors.accent} />
                <Text style={[styles.secondaryText, { color: colors.accent }]} numberOfLines={1}>
                  {copy.basket.secondRound}
                </Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={copy.basket.makeList}
                disabled={rolling}
                onPress={handleSaveList}
                style={[
                  styles.secondary,
                  { backgroundColor: alpha(colors.surface, 0.7), borderColor: colors.border },
                ]}
              >
                <AppIcon family="Ionicons" name="list" size={16} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]} numberOfLines={1}>
                  {copy.basket.makeList}
                </Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={copy.basket.watchlist}
                disabled={rolling}
                onPress={handleAddWatchlist}
                style={[
                  styles.secondary,
                  { backgroundColor: alpha(colors.surface, 0.7), borderColor: colors.border },
                ]}
              >
                <AppIcon family="Ionicons" name="bookmark" size={16} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]} numberOfLines={1}>
                  {copy.basket.watchlist}
                </Text>
              </PressableScale>
            </View>
          </View>
        ) : null
      }
    >
      {hasItems ? (
        <View style={styles.grid}>
          {items.map((item) => {
            const key = cineMediaKey(item);
            return (
              <BasketPoster
                key={key}
                item={item}
                highlighted={rolling && highlightKey === key}
                dimmed={rolling && highlightKey !== null && highlightKey !== key}
                busy={rolling}
                onOpen={handleOpen}
                onRemove={onRemove}
                copy={copy}
                colors={colors}
              />
            );
          })}
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(260)} style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.heart, 0.12) }]}>
            <AppIcon family="Ionicons" name="heart-dislike-outline" size={40} color={colors.heart} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{copy.basket.emptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{copy.basket.emptyBody}</Text>
        </Animated.View>
      )}
    </CineSheet>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 17,
  },
  clearText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemWrap: {
    width: "31%",
    aspectRatio: 1 / 1.5,
  },
  item: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  rating: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,200,61,0.3)",
  },
  ratingText: {
    color: "#FFC83D",
    fontSize: 10,
    fontWeight: "900",
  },
  remove: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 3,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 44,
    gap: 8,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 270,
  },
  actions: {
    paddingTop: 10,
    gap: 10,
  },
  primary: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#FF3B5C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 52,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 46,
    paddingHorizontal: 6,
    borderRadius: 13,
    borderWidth: 1,
  },
  secondaryText: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: "800",
  },
});

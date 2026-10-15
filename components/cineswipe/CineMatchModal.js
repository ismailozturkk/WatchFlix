// components/cineswipe/CineMatchModal.js
//
// Seçim / kazanan / eşleşme kutlama sayfası. Poster yaylanarak belirir, halka ve
// kıvılcımlar nefes alır, açılışta titreşim verir.
//
// Eski sürümden farklar: `matchedMedia` boşken `matchedMedia.title` okuyup
// çöküyordu (artık gövde yalnız medya varken çizilir); "İzleme listesine ekle"
// basıldığında hiçbir görsel geri bildirim yoktu (artık "Eklendi ✓"); rastgele
// seçimde "Başka birini seç" eklendi.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import CineSheet from "./CineSheet";
import PressableScale from "./PressableScale";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { cardGenreNames, cineMediaKey, fillText, posterUrl } from "../../services/cineswipe/deckModel";

function Sparkle({ glow, phase, style, color, size }) {
  const animated = useAnimatedStyle(() => {
    const wave = Math.abs(Math.sin((glow.value + phase) * Math.PI));
    return { opacity: 0.25 + 0.75 * wave, transform: [{ scale: 0.7 + 0.5 * wave }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, style, animated]}>
      <AppIcon family="Ionicons" name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

function MatchBody({
  media,
  partnerName,
  isWinner,
  onClose,
  onViewDetails,
  onAddToWatchlist,
  onReroll,
  copy,
  colors,
}) {
  const pop = useSharedValue(0);
  const glow = useSharedValue(0);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    triggerHaptic("notification");
    pop.value = withSpring(1, { damping: 11, stiffness: 120, mass: 0.9 });
    glow.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(glow);
  }, [pop, glow]);

  const posterStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [
      { scale: interpolate(pop.value, [0, 1], [0.6, 1]) },
      { rotate: `${interpolate(pop.value, [0, 1], [-8, 0])}deg` },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.32 * glow.value,
    transform: [{ scale: 1 + 0.07 * glow.value }],
  }));

  const uri = posterUrl(media.poster_path);
  const year = media.release_date ? media.release_date.split("-")[0] : "";
  const rating = media.vote_average ? Number(media.vote_average).toFixed(1) : "";
  const genres = cardGenreNames(media, copy.genreNames, 3);
  const title = partnerName ? copy.match.titleDuo : isWinner ? copy.match.winnerTitle : copy.match.titleSolo;
  const subtitle = partnerName
    ? fillText(copy.match.subDuo, { name: partnerName })
    : isWinner
      ? copy.match.subWinner
      : copy.match.subSolo;

  const handleDetails = () => {
    onClose();
    setTimeout(() => onViewDetails?.(media), 280);
  };

  const handleAdd = async () => {
    if (adding || added) return;
    setAdding(true);
    try {
      const ok = await onAddToWatchlist?.(media);
      if (ok !== false) setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.sparkleBadge, { backgroundColor: alpha(colors.accent, 0.15) }]}>
          <AppIcon family="Ionicons" name={isWinner ? "trophy" : "sparkles"} size={25} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.accent }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>

      <View style={[styles.mediaCard, { backgroundColor: alpha(colors.surface, 0.6) }]}>
        <View style={styles.posterWrap}>
          <Animated.View style={[styles.halo, { backgroundColor: colors.accent }, haloStyle]} />
          <Animated.View style={[styles.poster, { backgroundColor: colors.between }, posterStyle]}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.posterEmpty]}>
                <AppIcon family="Ionicons" name="film-outline" size={34} color={colors.muted} />
              </View>
            )}
          </Animated.View>
          <Sparkle glow={glow} phase={0} color={colors.gold} size={20} style={styles.sparkleA} />
          <Sparkle glow={glow} phase={0.35} color={colors.accent} size={15} style={styles.sparkleB} />
          <Sparkle glow={glow} phase={0.7} color={colors.gold} size={13} style={styles.sparkleC} />
        </View>

        <View style={styles.details}>
          <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={3}>
            {media.title || media.name}
          </Text>
          <View style={styles.metaRow}>
            {year ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{year}</Text> : null}
            {rating && rating !== "0.0" ? (
              <View style={styles.ratingRow}>
                <AppIcon family="Ionicons" name="star" size={13} color={colors.gold} />
                <Text style={[styles.rating, { color: colors.gold }]}>{rating}</Text>
              </View>
            ) : null}
          </View>
          {genres.length ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
              {genres.join(" · ")}
            </Text>
          ) : null}
          {media.overview ? (
            <Text style={[styles.overview, { color: colors.textSecondary }]} numberOfLines={5}>
              {media.overview}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.buttons}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.match.details}
          onPress={handleDetails}
          style={[styles.primary, { backgroundColor: colors.accent }]}
        >
          <AppIcon family="Ionicons" name="information-circle-outline" size={21} color={colors.onAccent} />
          <Text style={[styles.primaryText, { color: colors.onAccent }]}>{copy.match.details}</Text>
        </PressableScale>

        <View style={styles.row}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={added ? copy.match.added : copy.match.addWatchlist}
            disabled={added}
            onPress={handleAdd}
            style={[
              styles.secondary,
              {
                flex: 1,
                backgroundColor: added ? alpha(colors.like, 0.16) : alpha(colors.surface, 0.8),
                borderColor: added ? colors.like : colors.border,
              },
            ]}
          >
            {adding ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <AppIcon
                family="Ionicons"
                name={added ? "checkmark-circle" : "bookmark-outline"}
                size={18}
                color={added ? colors.like : colors.text}
              />
            )}
            <Text style={[styles.secondaryText, { color: added ? colors.like : colors.text }]} numberOfLines={1}>
              {added ? copy.match.added : copy.match.addWatchlist}
            </Text>
          </PressableScale>

          {onReroll ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.match.reroll}
              onPress={() => {
                triggerHaptic("selection");
                onReroll();
              }}
              style={[styles.secondary, { backgroundColor: alpha(colors.surface, 0.8), borderColor: colors.border }]}
            >
              <AppIcon family="Ionicons" name="dice-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>{copy.match.reroll}</Text>
            </PressableScale>
          ) : null}
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.close}
          onPress={onClose}
          style={styles.closeLink}
        >
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>{copy.close}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * @param {object|null} matchedMedia
 * @param {string|null} partnerName   Doluysa duo eşleşmesi metni.
 * @param {boolean} isWinner          2. tur sonunda tek kalan içerik.
 * @param {(media) => Promise<boolean>|boolean|void} onAddToWatchlist
 * @param {() => void} [onReroll]     Verilirse "Başka birini seç" görünür.
 */
export default function CineMatchModal({
  visible,
  matchedMedia,
  partnerName,
  isWinner = false,
  onClose,
  onViewDetails,
  onAddToWatchlist,
  onReroll,
}) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();

  return (
    <CineSheet visible={visible} onClose={onClose} intensity={40} maxHeight="92%">
      {matchedMedia ? (
        <MatchBody
          // Yeniden seçimde gövde baştan kurulur: poster animasyonu tekrar oynar.
          key={cineMediaKey(matchedMedia)}
          media={matchedMedia}
          partnerName={partnerName}
          isWinner={isWinner}
          onClose={onClose}
          onViewDetails={onViewDetails}
          onAddToWatchlist={onAddToWatchlist}
          onReroll={onReroll}
          copy={copy}
          colors={colors}
        />
      ) : null}
    </CineSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  sparkleBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  mediaCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
    gap: 16,
  },
  posterWrap: {
    width: 104,
    height: 154,
  },
  halo: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 20,
  },
  poster: {
    flex: 1,
    borderRadius: 13,
    overflow: "hidden",
  },
  posterEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: {
    position: "absolute",
  },
  sparkleA: {
    top: -12,
    right: -10,
  },
  sparkleB: {
    bottom: 22,
    left: -14,
  },
  sparkleC: {
    bottom: -10,
    right: -6,
  },
  details: {
    flex: 1,
    justifyContent: "center",
    gap: 5,
  },
  mediaTitle: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  meta: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  overview: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  buttons: {
    gap: 10,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 17,
  },
  primaryText: {
    fontSize: 15.5,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  closeLink: {
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  closeText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});

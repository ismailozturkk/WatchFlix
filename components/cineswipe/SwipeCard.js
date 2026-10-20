// components/cineswipe/SwipeCard.js
//
// Kaydırılabilir film/dizi kartı (Reanimated 4 + RNGH Pan).
//
// Eski sürüme göre:
//  • Düğmeyle verilen oy da AYNI fırlatma animasyonunu oynatır (`ref.swipe`);
//    önceden kart olduğu yerde anında kayboluyordu.
//  • Hızlı fırlatma (flick) kısa mesafede de oy sayılır.
//  • Arkadaki kartlar derinliğe göre küçük/aşağıda durur ve üstteki kart
//    sürüklendikçe öne yükselir (`dragX` yığın tarafından paylaşılır).
//  • Eşik aşılınca tek seferlik titreşim, renkli sürükleme yıkaması, kenetli
//    (clamp) damga animasyonu — eski interpolasyon sınırsızdı, damga şişiyordu.
//  • Kart boyutu ekrandan değil yığının ölçülen alanından gelir.
//  • Özet genişleme animasyonu Reanimated layout geçişi; LayoutAnimation /
//    UIManager deneysel bayrağı kalktı.
//  • Günlük kaydırma hakkı bitmişse kart hiç fırlamaz, yerine döner.
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  LinearTransition,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AppIcon from "../AppIcon";
import ListBadges from "../ListBadges";
import PressableScale from "./PressableScale";
import { ON_POSTER } from "./cineTheme";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { cardGenreNames, posterUrl } from "../../services/cineswipe/deckModel";

const FLICK_VELOCITY = 900;
const STACK_OFFSET = 14; // her derinlik basamağında aşağı kayma (px)
const STACK_SCALE_STEP = 0.055; // her derinlik basamağında küçülme
const STACK_SPRING = { damping: 18, stiffness: 190, mass: 0.8 };
const SETTLE_SPRING = { damping: 16, stiffness: 220, mass: 0.7 };

const SwipeCard = forwardRef(function SwipeCard(
  {
    media,
    depth,
    dragX,
    width,
    height,
    disabled = false,
    swipesAllowed = true,
    onSwipe,
    onBlocked,
    onOpenDetails,
    copy,
    colors,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const isTop = depth === 0;
  const threshold = width * 0.32;
  const flingDistance = width * 1.6;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const busy = useSharedValue(0); // 1: fırlatıldı, yeni dokunuş yok sayılır
  const crossed = useSharedValue(0); // eşik titreşimi mandalı
  const allowed = useSharedValue(swipesAllowed ? 1 : 0);
  const depthAnim = useSharedValue(depth);
  const entrance = useSharedValue(0);
  const expandAnim = useSharedValue(0);

  // Üst bileşenin işleyicileri her render değişir; kart bunları ref ile okur ki
  // fırlatma animasyonu bitişinde bayat bir kapanış çağrılmasın.
  const onSwipeRef = useRef(onSwipe);
  const onBlockedRef = useRef(onBlocked);
  onSwipeRef.current = onSwipe;
  onBlockedRef.current = onBlocked;
  const live = useRef({ isTop, disabled, swipesAllowed });
  live.current = { isTop, disabled, swipesAllowed };

  useEffect(() => {
    allowed.value = swipesAllowed ? 1 : 0;
  }, [swipesAllowed, allowed]);

  useEffect(() => {
    depthAnim.value = withSpring(depth, STACK_SPRING);
  }, [depth, depthAnim]);

  useEffect(() => {
    entrance.value = withSpring(1, { damping: 16, stiffness: 150, mass: 0.9 });
  }, [entrance]);

  useEffect(() => {
    expandAnim.value = withTiming(expanded ? 1 : 0, { duration: 220 });
  }, [expanded, expandAnim]);

  // JS tarafı geri çağrıları (worklet'ten runOnJS ile çağrılır).
  const commit = useCallback(
    (direction) => onSwipeRef.current?.(direction === 1 ? "like" : "pass", media),
    [media],
  );
  const blocked = useCallback(() => onBlockedRef.current?.(), []);
  const tick = useCallback(() => triggerHaptic("selection"), []);
  const thump = useCallback((direction) => triggerHaptic(direction === 1 ? "impact" : "selection"), []);

  const settle = () => {
    "worklet";
    translateX.value = withSpring(0, SETTLE_SPRING);
    translateY.value = withSpring(0, SETTLE_SPRING);
    dragX.value = withSpring(0, SETTLE_SPRING);
  };

  const flingTo = (direction) => {
    "worklet";
    busy.value = 1;
    translateY.value = withTiming(translateY.value - 26, { duration: 240 });
    dragX.value = withTiming(direction * threshold * 1.2, { duration: 240 });
    translateX.value = withTiming(
      direction * flingDistance,
      { duration: 240, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(commit)(direction);
      },
    );
  };

  const shake = () => {
    translateX.value = withSequence(
      withTiming(-14, { duration: 60 }),
      withTiming(14, { duration: 80 }),
      withTiming(-8, { duration: 70 }),
      withTiming(0, { duration: 60 }),
    );
  };

  // Düğmeler: aynı fırlatma animasyonu, aynı kapılar.
  useImperativeHandle(
    ref,
    () => ({
      swipe: (action) => {
        const state = live.current;
        if (!state.isTop || state.disabled || busy.value === 1) return false;
        if (!state.swipesAllowed) {
          triggerHaptic("error");
          shake();
          onBlockedRef.current?.();
          return false;
        }
        const direction = action === "like" ? 1 : -1;
        triggerHaptic(direction === 1 ? "impact" : "selection");
        flingTo(direction);
        return true;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threshold, flingDistance, commit],
  );

  const pan = Gesture.Pan()
    .enabled(isTop && !disabled)
    .minDistance(4)
    .onUpdate((event) => {
      if (busy.value === 1) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.55;
      dragX.value = event.translationX;
      const over = Math.abs(event.translationX) > threshold;
      if (over && crossed.value === 0) {
        crossed.value = 1;
        runOnJS(tick)();
      } else if (!over && crossed.value === 1) {
        crossed.value = 0;
      }
    })
    .onEnd((event) => {
      if (busy.value === 1) return;
      const x = translateX.value;
      const right = x > threshold || (event.velocityX > FLICK_VELOCITY && x > 24);
      const left = x < -threshold || (event.velocityX < -FLICK_VELOCITY && x < -24);
      if (!right && !left) {
        settle();
        return;
      }
      if (allowed.value === 0) {
        settle();
        runOnJS(blocked)();
        return;
      }
      runOnJS(thump)(right ? 1 : -1);
      flingTo(right ? 1 : -1);
    })
    .onFinalize((_event, success) => {
      crossed.value = 0;
      // Hareket iptal edildiyse (ör. kart pasifleşti) kart ortada kalmasın.
      if (!success && busy.value === 0) settle();
    });

  const cardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(dragX.value) / threshold, 1);
    const depthNow = depthAnim.value > 0 ? Math.max(0, depthAnim.value - progress) : 0;
    const rotate = interpolate(translateX.value, [-width, 0, width], [-14, 0, 14], "clamp");
    const enter = entrance.value;
    return {
      opacity: enter,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + depthNow * STACK_OFFSET + (1 - enter) * 18 },
        { rotate: `${rotate}deg` },
        { scale: (1 - depthNow * STACK_SCALE_STEP) * (0.94 + 0.06 * enter) },
      ],
    };
  });

  const dimStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(dragX.value) / threshold, 1);
    const depthNow = depthAnim.value > 0 ? Math.max(0, depthAnim.value - progress) : 0;
    return { opacity: Math.min(0.5, depthNow * 0.3) };
  });

  const likeStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, threshold * 0.55, threshold], [0, 0.85, 1], "clamp"),
    transform: [
      { rotate: "-14deg" },
      { scale: interpolate(translateX.value, [0, threshold], [0.7, 1.05], "clamp") },
    ],
  }));
  const passStamp = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-threshold, -threshold * 0.55, 0], [1, 0.85, 0], "clamp"),
    transform: [
      { rotate: "14deg" },
      { scale: interpolate(translateX.value, [-threshold, 0], [1.05, 0.7], "clamp") },
    ],
  }));
  const likeWash = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, threshold], [0, 0.34], "clamp"),
  }));
  const passWash = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-threshold, 0], [0.34, 0], "clamp"),
  }));
  const gradientStyle = useAnimatedStyle(() => ({
    height: height * (0.6 + 0.16 * expandAnim.value),
  }));

  const uri = posterUrl(media?.poster_path);
  const year = media?.release_date ? media.release_date.split("-")[0] : "";
  const rating = media?.vote_average ? Number(media.vote_average).toFixed(1) : "";
  const typeLabel = media?.mediaType === "tv" ? copy.tv : copy.movie;
  const genres = cardGenreNames(media, copy.genreNames);
  const title = media?.title || media?.name || "";

  const toggleExpand = () => {
    triggerHaptic("selection");
    setExpanded((value) => !value);
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={isTop ? "auto" : "none"}
        style={[styles.card, { width, height, backgroundColor: colors.between }, cardStyle]}
      >
        {uri && !posterFailed ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            priority={isTop ? "high" : "normal"}
            cachePolicy="memory-disk"
            onError={() => setPosterFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noPoster, { backgroundColor: colors.between }]}>
            <AppIcon family="MaterialCommunityIcons" name="movie-open-outline" size={64} color={colors.muted} />
            <Text style={[styles.noPosterText, { color: colors.muted }]}>{copy.posterMissing}</Text>
          </View>
        )}

        <Animated.View pointerEvents="none" style={[styles.gradientWrap, gradientStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.96)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Sürükleme yıkaması: yön rengi kartın tamamına yayılır. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.like }, likeWash]}
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.pass }, passWash]}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />

        <View style={styles.topRow} pointerEvents="box-none">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.detailsAction}
            hitSlop={8}
            onPress={() => onOpenDetails?.(media)}
            style={styles.infoButton}
          >
            <AppIcon family="Ionicons" name="information" size={19} color={ON_POSTER.text} />
          </PressableScale>
          {media?.id ? (
            <View pointerEvents="none">
              <ListBadges
                mediaId={media.id}
                mediaType={media.mediaType || "movie"}
                variant="chip"
                vertical={false}
                chipSize={24}
                iconSize={13}
              />
            </View>
          ) : null}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.stamp, styles.likeStamp, { borderColor: colors.like }, likeStamp]}
        >
          <Text style={[styles.stampText, { color: colors.like }]}>{copy.like}</Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.stamp, styles.passStamp, { borderColor: colors.pass }, passStamp]}
        >
          <Text style={[styles.stampText, { color: colors.pass }]}>{copy.pass}</Text>
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(220)} style={styles.info}>
          <Text style={styles.title} numberOfLines={expanded ? 3 : 2}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            {year ? (
              <View style={styles.pill}>
                <AppIcon family="Ionicons" name="calendar-outline" size={12} color={ON_POSTER.text} />
                <Text style={styles.pillText}>{year}</Text>
              </View>
            ) : null}
            {rating && rating !== "0.0" ? (
              <View style={[styles.pill, styles.ratingPill]}>
                <AppIcon family="Ionicons" name="star" size={12} color={ON_POSTER.gold} />
                <Text style={[styles.pillText, { color: ON_POSTER.gold }]}>{rating}</Text>
              </View>
            ) : null}
            <View style={styles.pill}>
              <AppIcon
                family="Ionicons"
                name={media?.mediaType === "tv" ? "tv-outline" : "film-outline"}
                size={12}
                color={ON_POSTER.text}
              />
              <Text style={styles.pillText}>{typeLabel}</Text>
            </View>
          </View>

          {genres.length ? (
            <Text style={styles.genres} numberOfLines={1}>
              {genres.join(" · ")}
            </Text>
          ) : null}

          {media?.overview ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expanded ? copy.hideOverview : copy.readOverview}
              onPress={toggleExpand}
              style={[styles.overviewBox, { backgroundColor: alpha("#000000", 0.38) }]}
            >
              <Text style={styles.overview} numberOfLines={expanded ? 9 : 2}>
                {media.overview}
              </Text>
              <View style={styles.expandHint}>
                <Text style={styles.expandHintText}>{expanded ? copy.hideOverview : copy.readOverview}</Text>
                <AppIcon
                  family="Ionicons"
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={ON_POSTER.textMuted}
                />
              </View>
            </Pressable>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

export default SwipeCard;

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 14,
  },
  noPoster: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noPosterText: {
    fontSize: 13,
    fontWeight: "700",
  },
  gradientWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dim: {
    backgroundColor: "#000",
  },
  topRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: ON_POSTER.chipBorder,
  },
  stamp: {
    position: "absolute",
    top: 70,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 3.5,
    backgroundColor: "rgba(0,0,0,0.28)",
    zIndex: 12,
  },
  likeStamp: {
    left: 22,
  },
  passStamp: {
    right: 22,
  },
  stampText: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  info: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    zIndex: 5,
  },
  title: {
    color: ON_POSTER.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.4,
    marginBottom: 9,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ON_POSTER.chip,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: ON_POSTER.chipBorder,
  },
  ratingPill: {
    backgroundColor: "rgba(255,200,61,0.16)",
    borderColor: "rgba(255,200,61,0.34)",
  },
  pillText: {
    color: ON_POSTER.text,
    fontSize: 12,
    fontWeight: "800",
  },
  genres: {
    color: ON_POSTER.textSoft,
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 8,
  },
  overviewBox: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overview: {
    color: ON_POSTER.textSoft,
    fontSize: 12.5,
    lineHeight: 18,
  },
  expandHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 5,
  },
  expandHintText: {
    color: ON_POSTER.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
});

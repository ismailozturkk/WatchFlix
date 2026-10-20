import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileReminders } from "../../../context/ProfileRemindersContext";
import { useImageQualitySettings, useListLayoutSettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import GlassIconButton from "../../../components/common/GlassIconButton";
import { parseAirDate, startOfDay } from "../../../utils/airDate";
import GlassTouchable from "../../../components/common/GlassTouchable";


const H_MARGIN = 16;
const CARD_H = 96;
const PEEK = 9; // alttaki kartların aşağıdan göründüğü pay
const THRESHOLD = 62; // yavaş sürüklemede bu mesafeden sonra karta geçer
const VELOCITY_PROJECTION = 0.12; // kısa ve kararlı flick hareketlerini de yakala
const SNAP_SPRING = {
  damping: 23,
  stiffness: 245,
  mass: 0.72,
  overshootClamping: true,
};
const ENTER_SPRING = {
  damping: 20,
  stiffness: 210,
  mass: 0.78,
  overshootClamping: true,
};

// Kalan güne göre renk/ikon (ProfileReminders'taki mantığın kompakt hâli)
function countdownStyle(diff, c) {
  if (!diff || !diff.isRemaining)
    return { color: c.green, bg: c.greenBackground, icon: "checkmark-circle" };
  const d = diff.days ?? 0;
  const m = diff.months ?? 0;
  if (d < 4) return { color: c.green, bg: c.greenBackground, icon: "flash" };
  if (d < 7) return { color: c.blue, bg: c.blueBackground, icon: "time-outline" };
  if (m < 1) return { color: c.orange, bg: c.orangeBackground, icon: "calendar" };
  if (m < 3) return { color: c.red, bg: c.redBackground, icon: "hourglass" };
  return { color: c.purple, bg: c.purpleBackground, icon: "ellipse" };
}

function buildItems(reminders, limit = 5) {
  const movies = (reminders.movieReminders || []).map((m) => ({
    key: `m-${m.movieId}`,
    type: "movie",
    poster: m.posterPath,
    title: m.movieName,
    subtitle: m.movieMinutes > 0 ? `${m.movieMinutes} dk` : null,
    date: m.releaseDate,
  }));
  const eps = (reminders.tvReminders || []).flatMap((show) =>
    (show.seasons || []).flatMap((season) =>
      (season.episodes || []).map((ep) => ({
        key: `e-${ep.episodeId || `${show.showId}-${season.seasonNumber}-${ep.episodeNumber}`}`,
        type: "tv",
        poster: season.seasonPosterPath || show.showPosterPath,
        title: show.showName,
        subtitle: i18nText("autoI18n.season_episode_short", "S{{season}} · {{episode}}. Bölüm", {
          season: season.seasonNumber,
          episode: ep.episodeNumber,
        }),
        date: ep.airDate,
      })),
    ),
  );
  const all = [...movies, ...eps].filter((x) => startOfDay(x.date) !== null);
  const timeOf = (x) => parseAirDate(x.date).getTime();
  const now = Date.now();
  // Profil önizlemesi yalnız yaklaşanları gösterir. Limit bir üst sınırdır;
  // 20 seçilip 15 yaklaşan kayıt varsa geçmiş/yayınlanmış içerikle doldurulmaz.
  const upcoming = all
    .filter((x) => timeOf(x) > now)
    .sort((a, b) => timeOf(a) - timeOf(b));
  return {
    items: upcoming.slice(0, limit),
    total: upcoming.length,
    movieCount: upcoming.filter((item) => item.type === "movie").length,
    tvCount: upcoming.filter((item) => item.type === "tv").length,
  };
}

/**
 * Her kart kendi gesture değerlerini taşır. Böylece arkadaki kart öne geçtiğinde
 * çıkan kartın son translate değerini devralmaz. Gesture ve dönüş animasyonları
 * Reanimated ile UI thread'de çalışır; sürükleme sırasında React render edilmez.
 */
function ReminderStackCard({
  isFront,
  depth,
  canAdvance,
  onAdvance,
  onOpen,
  colors,
  cardWidth,
  children,
}) {
  const swipeOut = cardWidth * 1.1;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Arkadaki kart öne geçmeden önce giriş konumunda hazır bekler.
  const enter = useSharedValue(1);

  useEffect(() => {
    if (isFront) {
      enter.value = withSpring(0, ENTER_SPRING);
      return;
    }

    // Çıkan kart arkaya dönerse bir sonraki tur için görünmeden sıfırlanır.
    translateX.value = 0;
    translateY.value = 0;
    enter.value = 1;
  }, [enter, isFront, translateX, translateY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isFront)
        // Profilin dikey ScrollView hareketini ele geçirmeden yalnızca belirgin
        // yatay sürüklemeyi etkinleştir.
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          translateX.value = event.translationX;
          // Parmaktaki küçük dikey sapmayı hissettir ama kartı aşağı/yukarı
          // kaçırma; bırakma anındaki görsel sıçramanın ana nedeni buydu.
          translateY.value = Math.max(-7, Math.min(7, event.translationY * 0.1));
        })
        .onEnd((event) => {
          const projectedX =
            event.translationX + event.velocityX * VELOCITY_PROJECTION;
          if (Math.abs(projectedX) > THRESHOLD && canAdvance) {
            const direction = projectedX > 0 ? 1 : -1;
            translateY.value = withTiming(0, { duration: 160 });
            translateX.value = withTiming(
              direction * swipeOut,
              { duration: 190 },
              (finished) => {
                if (finished) runOnJS(onAdvance)();
              },
            );
            return;
          }

          translateX.value = withSpring(0, SNAP_SPRING);
          translateY.value = withSpring(0, SNAP_SPRING);
        })
        .onFinalize((_event, success) => {
          if (!success) {
            translateX.value = withSpring(0, SNAP_SPRING);
            translateY.value = withSpring(0, SNAP_SPRING);
          }
        }),
    [canAdvance, isFront, onAdvance, swipeOut, translateX, translateY],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(isFront)
        .maxDistance(6)
        .onEnd((_event, success) => {
          if (success) runOnJS(onOpen)();
        }),
    [isFront, onOpen],
  );

  const gesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const frontStyle = useAnimatedStyle(() => {
    const enterOffset = interpolate(enter.value, [0, 1], [0, PEEK]);
    const enterScale = interpolate(enter.value, [0, 1], [1, 0.95]);
    const rotation = interpolate(
      translateX.value,
      [-cardWidth, 0, cardWidth],
      [-6, 0, 6],
      Extrapolation.CLAMP,
    );
    const swipeOpacity = interpolate(
      translateX.value,
      [-swipeOut, -THRESHOLD, 0, THRESHOLD, swipeOut],
      [0, 1, 1, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity: swipeOpacity,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + enterOffset },
        { scale: enterScale },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const backStyle =
    depth === 1
      ? styles.secondCard
      : depth === 2
        ? styles.thirdCard
        : null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          { width: cardWidth },
          colors,
          isFront ? styles.frontCard : backStyle,
          isFront ? frontStyle : null,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function ReminderDot({ active, activeColor, inactiveColor }) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 190 });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [6, 16]),
    opacity: interpolate(progress.value, [0, 1], [0.65, 1]),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.92, 1]) },
    ],
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export default function RemindersPreviewButton({ navigation }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, width - H_MARGIN * 2);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const { posterBadges, reminderPreviewLimit } = useListLayoutSettings();
  const { reminders, calculateDateDifference, formatDate } =
    useProfileReminders();

  const { items, movieCount, tvCount } = useMemo(
    () => buildItems(reminders, reminderPreviewLimit),
    [reminders, reminderPreviewLimit],
  );
  const n = items.length;
  const [top, setTop] = useState(0);

  const label = t.profileScreen?.ProfileReminder?.reminder ?? i18nText("autoI18n.hatirlatmalar", "Hatırlatmalar");

  // Liste gesture sırasında güncellense bile callback güncel eleman sayısını okur.
  const nRef = useRef(n);
  nRef.current = n;
  const advance = useCallback(() => {
    setTop((tp) => (nRef.current ? (tp + 1) % nRef.current : 0));
  }, []);
  const returnToStart = useCallback(() => setTop(0), []);
  const goAll = useCallback(
    () => navigation.navigate("RemindersScreen"),
    [navigation],
  );
  const goCalendar = useCallback(
    () => navigation.navigate("CalendarScreen"),
    [navigation],
  );
  const cardColors = useMemo(
    () => ({
      backgroundColor: theme.secondary,
      borderColor: theme.border,
      shadowColor: theme.shadow,
    }),
    [theme.border, theme.secondary, theme.shadow],
  );

  // ── Boş durum ──
  if (n === 0) {
    return (
      <View style={styles.section}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, styles.emptyTitle, { color: theme.text.muted }]}
        >
          {label}
        </Text>
        <GlassTouchable
          activeOpacity={0.85}
          onPress={() => navigation.navigate("RemindersScreen")}
          style={[
            styles.emptyBtn,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.text.muted}
            />
          </View>
          <Text
            allowFontScaling={false}
            style={[styles.emptySub, { color: theme.text.muted }]}
          >{i18nText("autoI18n.henuz_hatirlatma_yok", "Henüz hatırlatma yok")}</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
        </GlassTouchable>
      </View>
    );
  }

  const visibleCount = Math.min(n, 3);
  const start = ((top % n) + n) % n;

  const renderCardContent = (item, isFront) => {
    const diff = calculateDateDifference(item.date);
    const cs = countdownStyle(diff, theme.notesColor);
    const isMovie = item.type === "movie";
    const accent = isMovie ? theme.accent : "#8b5cf6";

    return (
      <>
        {/* Poster */}
        <View style={[styles.posterBox, { backgroundColor: theme.primary }]}>
          {item.poster ? (
            <Image
              source={{ uri: getTmdbUrl(item.poster, "poster", 200) }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
              // Öne geçen kart rol anahtarı nedeniyle yeniden mount edilir.
              // Cache'deki posterin fade geçişini tekrar çalıştırmak bir anlık
              // kararma yaratıyordu; ön kartta görsel doğrudan gösterilir.
              transition={isFront ? 0 : 120}
            />
          ) : (
            <Ionicons name="image-outline" size={18} color={theme.text.muted} />
          )}
        </View>

        {/* Bilgi */}
        <View style={styles.info}>
          <View
            style={[
              styles.typeChip,
              { backgroundColor: accent + "22", borderColor: accent + "66" },
            ]}
          >
            <Ionicons
              name={isMovie ? "film" : "tv"}
              size={9}
              color={accent}
            />
            <Text
              allowFontScaling={false}
              style={[styles.typeChipText, { color: accent }]}
            >
              {isMovie ? i18nText("autoI18n.film_upper", "FİLM") : i18nText("autoI18n.dizi_upper", "DİZİ")}
            </Text>
          </View>

          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>

          {item.subtitle ? (
            <Text
              allowFontScaling={false}
              style={[styles.subtitle, { color: theme.text.secondary }]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
          ) : null}

          {posterBadges?.releaseDate !== false && (
            <View style={styles.dateRow}>
              <Ionicons
                name="calendar-outline"
                size={10}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.dateText, { color: theme.text.muted }]}
                numberOfLines={1}
              >
                {formatDate(item.date)}
              </Text>
            </View>
          )}
        </View>

        {/* Kalan gün */}
        {posterBadges?.countdown !== false && (
          <View
            style={[styles.daysBox, { backgroundColor: cs.bg, borderColor: cs.color }]}
          >
            <Ionicons name={cs.icon} size={14} color={cs.color} />
            {!diff || !diff.isRemaining ? (
              <Text
                allowFontScaling={false}
                style={[styles.daysLabel, { color: cs.color }]}
                numberOfLines={1}
              >{i18nText("autoI18n.yayinda", "Yayında")}</Text>
            ) : diff.days === 0 ? (
              <Text
                allowFontScaling={false}
                style={[styles.daysNum, { color: cs.color }]}
              >{i18nText("autoI18n.bugun", "Bugün")}</Text>
            ) : diff.days <= 99 ? (
              <>
                <Text
                  allowFontScaling={false}
                  style={[styles.daysNum, { color: cs.color }]}
                >
                  {diff.days}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.daysLabel, { color: cs.color }]}
                >{i18nText("autoI18n.gun", "gün")}</Text>
              </>
            ) : (
              <Text
                allowFontScaling={false}
                style={[styles.daysLabel, { color: cs.color }]}
                numberOfLines={1}
              >
                {diff.text}
              </Text>
            )}
          </View>
        )}
      </>
    );
  };

  const cards = Array.from({ length: visibleCount }).map((_, p) => {
    const item = items[(start + p) % n];
    const isFront = p === 0;

    return (
      <ReminderStackCard
        // İçerik anahtarı tek başına kullanılırsa çıkan kartın Animated
        // instance'ı React tarafından arkadaki role taşınır. Translate değeri
        // sıfırlanınca kart bir kareliğine yeniden görünür. Rolü de anahtara
        // dahil ederek her yığın konumunun animasyon yaşam döngüsünü ayırıyoruz.
        key={`${p}-${item.key}`}
        isFront={isFront}
        depth={p}
        canAdvance={n > 1}
        onAdvance={advance}
        onOpen={goAll}
        colors={cardColors}
        cardWidth={cardWidth}
      >
        {renderCardContent(item, isFront)}
      </ReminderStackCard>
    );
  });

  return (
    <View style={styles.section}>
      {/* Başlık + tümü */}
      <View style={styles.headerRow}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          {label}
        </Text>
        <View style={styles.headerRight}>
          {/* Film/dizi sayıları — yalnızca henüz yayınlanmamış kayıtlar */}
          {movieCount > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: theme.notesColor.blueBackground,
                  borderColor: theme.notesColor.blue,
                },
              ]}
            >
              <Ionicons
                name="film-outline"
                size={10}
                color={theme.notesColor.blue}
              />
              <Text
                allowFontScaling={false}
                style={[styles.countBadgeText, { color: theme.notesColor.blue }]}
              >
                {movieCount}
              </Text>
            </View>
          )}
          {tvCount > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: theme.notesColor.purpleBackground,
                  borderColor: theme.notesColor.purple,
                },
              ]}
            >
              <Ionicons
                name="tv-outline"
                size={10}
                color={theme.notesColor.purple}
              />
              <Text
                allowFontScaling={false}
                style={[
                  styles.countBadgeText,
                  { color: theme.notesColor.purple },
                ]}
              >
                {tvCount}
              </Text>
            </View>
          )}

          {/* Takvim butonu — "Tümü" bağlantısının yerinde; hatırlatmaların
              tümü ön karta dokununca açılır. */}
          <GlassIconButton
            icon="calendar"
            iconSize={15}
            size={28}
            fallbackRadius={14}
            color={theme.accent}
            tint={theme.accent + "55"}
            fallbackStyle={{ backgroundColor: theme.accent + "22" }}
            accessibilityLabel={i18nText("autoI18n.takvimi_ac", "Takvimi Aç")}
            onPress={goCalendar}
          />
        </View>
      </View>

      {/* Kaydırılabilir kart yığını (arkadan öne render) */}
      <View style={[styles.stack, { width: cardWidth }]}>{cards.reverse()}</View>

      {/* Nokta göstergesi */}
      {n > 1 && (
        <View style={styles.paginationRow}>
          <View style={styles.paginationSide} />
          <View style={[styles.dots, n > 15 && styles.dotsCompact]}>
            {items.map((it, i) => (
              <ReminderDot
                key={it.key}
                active={i === start}
                activeColor={theme.accent}
                inactiveColor={theme.border}
              />
            ))}
          </View>
          <View style={styles.paginationSide}>
            {start !== 0 && (
              <GlassTouchable
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.basa_don", "Başa dön")}
                activeOpacity={0.72}
                onPress={returnToStart}
                style={[
                  styles.returnToStartButton,
                  {
                    backgroundColor: `${theme.accent}18`,
                    borderColor: `${theme.accent}44`,
                  },
                ]}
              >
                <Ionicons name="return-up-back" size={14} color={theme.accent} />
              </GlassTouchable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 14 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  // Boş durumda başlık dolu durumdaki headerRow ile aynı hizada dursun
  // (yoksa liste boşaldığında "Hatırlatmalar" yazısı sola kayıyor).
  emptyTitle: { paddingHorizontal: 20, marginBottom: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  // ProfileReminders başlığındaki countBadge ile aynı görünüm
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700" },

  stack: {
    height: CARD_H + 2 * PEEK + 2,
    marginHorizontal: H_MARGIN,
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    height: CARD_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  frontCard: { zIndex: 30 },
  secondCard: {
    zIndex: 20,
    transform: [{ translateY: PEEK }, { scale: 0.95 }],
    opacity: 0.82,
  },
  thirdCard: {
    zIndex: 10,
    transform: [{ translateY: 2 * PEEK }, { scale: 0.9 }],
    opacity: 0.5,
  },

  posterBox: {
    width: 46,
    height: 68,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  poster: { width: "100%", height: "100%" },

  info: { flex: 1, gap: 3 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  typeChipText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: "700" },
  subtitle: { fontSize: 11, fontWeight: "500" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 10 },

  daysBox: {
    width: 56,
    height: 66,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
  },
  daysNum: { fontSize: 14, fontWeight: "700" },
  daysLabel: { fontSize: 9, fontWeight: "700" },

  paginationRow: {
    minHeight: 28,
    marginTop: 7,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  paginationSide: { width: 32, alignItems: "center" },
  dots: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dotsCompact: { gap: 3 },
  dot: { height: 6, borderRadius: 3 },
  returnToStartButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Boş durum */
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H_MARGIN,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  emptyIcon: {
    width: 40,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySub: { flex: 1, fontSize: 13, fontWeight: "600" },
});

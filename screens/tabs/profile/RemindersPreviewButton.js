import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
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
import { parseAirDate, startOfDay } from "../../../utils/airDate";


const { width } = Dimensions.get("window");
const H_MARGIN = 16;
const CARD_W = width - H_MARGIN * 2;
const CARD_H = 96;
const PEEK = 9; // alttaki kartların aşağıdan göründüğü pay
const THRESHOLD = 70; // bu kadar kaydırınca sonraki karta geçer
const SWIPE_OUT = CARD_W * 1.1;
const SNAP_SPRING = { damping: 18, stiffness: 190, mass: 0.75 };
const ENTER_SPRING = { damping: 17, stiffness: 175, mass: 0.72 };

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

function buildItems(reminders) {
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
  // Sınır "şu an" değil "bugünün başlangıcı": bugün yayınlanan bir bölüm gün
  // boyu yaklaşanlarda kalmalı, saat geçti diye geçmişe düşmemeli. Widget'ın
  // filtresiyle de aynı sınır (bkz. reminderWidgetService).
  const todayStart = startOfDay(new Date()).getTime();
  const dayOf = (x) => startOfDay(x.date).getTime();
  // Eleme gün bazında, sıralama tam zaman bazında: aynı güne düşen iki kayıt
  // saatine göre sıralı kalsın.
  const timeOf = (x) => parseAirDate(x.date).getTime();
  const upcoming = all
    .filter((x) => dayOf(x) >= todayStart)
    .sort((a, b) => timeOf(a) - timeOf(b));
  const past = all
    .filter((x) => dayOf(x) < todayStart)
    .sort((a, b) => timeOf(b) - timeOf(a));
  return {
    items: [...upcoming, ...past].slice(0, 5),
    total: all.length,
    // Başlık rozetleri — ProfileReminders ile aynı sayım (tarih filtresi yok)
    movieCount: movies.length,
    tvCount: eps.length,
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
  children,
}) {
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
        .minDistance(6)
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          if (Math.abs(event.translationX) > THRESHOLD && canAdvance) {
            const direction = event.translationX > 0 ? 1 : -1;
            translateX.value = withTiming(
              direction * SWIPE_OUT,
              { duration: 200 },
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
    [canAdvance, isFront, onAdvance, translateX, translateY],
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
      [-CARD_W, 0, CARD_W],
      [-6, 0, 6],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_OUT, -THRESHOLD, 0, THRESHOLD, SWIPE_OUT],
      [0, 1, 1, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
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

export default function RemindersPreviewButton({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const { posterBadges } = useListLayoutSettings();
  const { reminders, calculateDateDifference, formatDate } =
    useProfileReminders();

  const { items, movieCount, tvCount } = useMemo(
    () => buildItems(reminders),
    [reminders],
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
  const goAll = useCallback(
    () => navigation.navigate("RemindersScreen"),
    [navigation],
  );
  // Gizlenen CalendarWidget'ın yerine takvime giriş buradan yapılır.
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
        <TouchableOpacity
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
        </TouchableOpacity>
      </View>
    );
  }

  const visibleCount = Math.min(n, 3);
  const start = ((top % n) + n) % n;

  const renderCardContent = (item) => {
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
              transition={120}
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
        key={item.key}
        isFront={isFront}
        depth={p}
        canAdvance={n > 1}
        onAdvance={advance}
        onOpen={goAll}
        colors={cardColors}
      >
        {renderCardContent(item)}
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
          {/* Film/dizi sayıları — ProfileReminders başlığındaki rozetlerle aynı */}
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
          <TouchableOpacity
            style={[styles.calendarBtn, { backgroundColor: theme.accent + "22" }]}
            onPress={goCalendar}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="calendar" size={15} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Kaydırılabilir kart yığını (arkadan öne render) */}
      <View style={styles.stack}>{cards.reverse()}</View>

      {/* Nokta göstergesi */}
      {n > 1 && (
        <View style={styles.dots}>
          {items.map((it, i) => (
            <View
              key={it.key}
              style={[
                styles.dot,
                {
                  width: i === start ? 16 : 6,
                  backgroundColor: i === start ? theme.accent : theme.border,
                },
              ]}
            />
          ))}
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
  calendarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  stack: {
    width: CARD_W,
    height: CARD_H + 2 * PEEK + 2,
    marginHorizontal: H_MARGIN,
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CARD_W,
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

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  dot: { height: 6, borderRadius: 3 },

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

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileReminders } from "../../../context/ProfileRemindersContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";


const { width } = Dimensions.get("window");
const H_MARGIN = 16;
const CARD_W = width - H_MARGIN * 2;
const CARD_H = 96;
const PEEK = 9; // alttaki kartların aşağıdan göründüğü pay
const THRESHOLD = 70; // bu kadar kaydırınca sonraki karta geçer
const SWIPE_OUT = CARD_W * 1.1;

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
  const all = [...movies, ...eps].filter(
    (x) => x.date && !isNaN(new Date(x.date)),
  );
  const now = Date.now();
  const upcoming = all
    .filter((x) => new Date(x.date).getTime() >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = all
    .filter((x) => new Date(x.date).getTime() < now)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return { items: [...upcoming, ...past].slice(0, 5), total: all.length };
}

export default function RemindersPreviewButton({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const { reminders, calculateDateDifference, formatDate } =
    useProfileReminders();

  const { items, total } = useMemo(() => buildItems(reminders), [reminders]);
  const n = items.length;
  const [top, setTop] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const enter = useRef(new Animated.Value(0)).current;

  const label = t.profileScreen?.ProfileReminder?.reminder ?? i18nText("autoI18n.hatirlatmalar", "Hatırlatmalar");

  // Stale closure'ı önlemek için panResponder ref'lerden okur
  const nRef = useRef(n);
  nRef.current = n;
  const advanceRef = useRef(() => {});
  advanceRef.current = () =>
    setTop((tp) => (nRef.current ? (tp + 1) % nRef.current : 0));
  const goAllRef = useRef(() => {});
  goAllRef.current = () => navigation.navigate("RemindersScreen");

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        // Neredeyse hiç hareket yoksa → dokunma kabul et, sayfaya git
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          pan.setValue({ x: 0, y: 0 });
          goAllRef.current();
          return;
        }
        if (Math.abs(g.dx) > THRESHOLD && nRef.current > 1) {
          const dir = g.dx > 0 ? 1 : -1;
          Animated.timing(pan, {
            toValue: { x: dir * SWIPE_OUT, y: g.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            advanceRef.current();
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  // Sıradaki karta geçince: pan'i sıfırla ve yeni ön kartı peek konumundan
  // (enter=1) merkeze (enter=0) yumuşakça getir. Arka kartlar pan'e bağlı
  // olmadığından geçişte ortada "hayalet" kart oluşmaz.
  useLayoutEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    enter.setValue(1);
    Animated.spring(enter, {
      toValue: 0,
      friction: 7,
      tension: 70,
      useNativeDriver: false,
    }).start();
  }, [top]);

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
        </View>

        {/* Kalan gün */}
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
      </>
    );
  };

  const cards = Array.from({ length: visibleCount }).map((_, p) => {
    const item = items[(start + p) % n];
    const isFront = p === 0;

    let animStyle;
    if (isFront) {
      animStyle = {
        zIndex: 30,
        transform: [
          { translateX: pan.x },
          {
            translateY: Animated.add(
              pan.y,
              enter.interpolate({ inputRange: [0, 1], outputRange: [0, PEEK] }),
            ),
          },
          {
            scale: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.95],
            }),
          },
          {
            rotate: pan.x.interpolate({
              inputRange: [-CARD_W, 0, CARD_W],
              outputRange: ["-6deg", "0deg", "6deg"],
              extrapolate: "clamp",
            }),
          },
        ],
        opacity: pan.x.interpolate({
          inputRange: [-SWIPE_OUT, -THRESHOLD, 0, THRESHOLD, SWIPE_OUT],
          outputRange: [0, 1, 1, 1, 0],
          extrapolate: "clamp",
        }),
      };
    } else if (p === 1) {
      // Sabit peek — pan'e bağlı DEĞİL (geçişte hayalet kartı önler)
      animStyle = {
        zIndex: 20,
        transform: [{ translateY: PEEK }, { scale: 0.95 }],
        opacity: 0.82,
      };
    } else {
      animStyle = {
        zIndex: 10,
        transform: [{ translateY: 2 * PEEK }, { scale: 0.9 }],
        opacity: 0.5,
      };
    }

    return (
      <Animated.View
        key={item.key}
        {...(isFront ? panResponder.panHandlers : {})}
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
          animStyle,
        ]}
      >
        {renderCardContent(item)}
      </Animated.View>
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
        <TouchableOpacity
          style={styles.allBtn}
          onPress={() => navigation.navigate("RemindersScreen")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            allowFontScaling={false}
            style={[styles.allText, { color: theme.accent }]}
          >
            {total}{i18nText("autoI18n.tumu_2", "· Tümü")}</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.accent} />
        </TouchableOpacity>
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
  allBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  allText: { fontSize: 12, fontWeight: "700" },

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
  daysNum: { fontSize: 18, fontWeight: "800" },
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

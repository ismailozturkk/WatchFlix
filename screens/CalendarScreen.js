import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useTheme } from "../context/ThemeContext";
import { useCalendar } from "../context/CalendarContext";
import { useLanguage } from "../context/LanguageContext";
import { RANGE_OPTIONS } from "../context/CalendarContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

const TODAY = new Date().toISOString().split("T")[0];

const FILTER_OPTIONS = [
  { key: "all", label: "Tümü", icon: "calendar-outline" },
  { key: "note", label: "Notlar", icon: "document-text-outline" },
  { key: "movie", label: "Film", icon: "film-outline" },
  { key: "tv", label: "Dizi", icon: "tv-outline" },
];

/* ── Tarih formatlama ── */
function formatDisplayDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff < 0) return `${Math.abs(diff)} gün önce`;
  return `${diff} gün sonra`;
}

/* ── Note Event Item ── */
const NoteItem = ({ item, theme, onPress }) => {
  const isNote = item.type !== "todo";
  return (
    <TouchableOpacity
      style={[
        styles.eventCard,
        {
          backgroundColor: item.backgroundColor || theme.secondary,
          borderLeftColor: item.color || theme.accent,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.eventIconBox,
          { backgroundColor: (item.color || theme.accent) + "22" },
        ]}
      >
        <Ionicons
          name={isNote ? "document-text" : "checkmark-circle"}
          size={20}
          color={item.color || theme.accent}
        />
      </View>
      <View style={styles.eventInfo}>
        <Text
          style={[styles.eventTitle, { color: theme.text.primary }]}
          numberOfLines={1}
        >
          {item.title || item.content || "Not"}
        </Text>
        {item.type === "todo" && item.todos?.length > 0 && (
          <Text
            allowFontScaling={false}
            style={[styles.eventSub, { color: theme.text.muted }]}
          >
            {item.todos.filter((t) => t.done).length}/{item.todos.length}{" "}
            tamamlandı
          </Text>
        )}
        {item.content && item.type !== "todo" && (
          <Text
            style={[styles.eventSub, { color: theme.text.muted }]}
            numberOfLines={1}
          >
            {item.content}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.typeBadge,
          { backgroundColor: (item.color || theme.accent) + "33" },
        ]}
      >
        <Text
          style={[styles.typeBadgeText, { color: item.color || theme.accent }]}
        >
          {isNote ? "Not" : "Todo"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/* ── Media Event Item ── */
const MediaItem = ({ item, theme, onPress }) => {
  const isMovie = item.type === "movie";
  const accentColor = isMovie ? "rgb(255, 124, 37)" : "rgb(175, 0, 175)";
  const backgroundColor = isMovie
    ? "rgba(255, 124, 37, 0.3)"
    : "rgba(175, 0, 175, 0.3)";

  return (
    <TouchableOpacity
      style={[
        styles.eventCard,
        { backgroundColor: theme.secondary, borderLeftColor: accentColor },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={styles.poster} />
      ) : (
        <View
          style={[styles.posterFallback, { backgroundColor: backgroundColor }]}
        >
          <Ionicons
            name={isMovie ? "film" : "tv"}
            size={22}
            color={accentColor}
          />
        </View>
      )}
      <View style={styles.eventInfo}>
        <Text
          style={[styles.eventTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.rating > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={11} color="#FFD700" />
            <Text
              allowFontScaling={false}
              style={[styles.eventSub, { color: theme.text.muted }]}
            >
              {item.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.typeBadge, { backgroundColor: backgroundColor }]}>
        <Text
          allowFontScaling={false}
          style={[styles.typeBadgeText, { color: accentColor }]}
        >
          {isMovie ? "Film" : "Dizi"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/* ── Ana bileşen ── */
export default function CalendarScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const {
    markedDates,
    getEventsForDate,
    isLoadingEvents,
    refreshEvents,
    rangeDays,
    changeRange,
  } = useCalendar();

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [activeFilter, setActiveFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(TODAY.substring(0, 7));

  const events = useMemo(
    () => getEventsForDate(selectedDate),
    [getEventsForDate, selectedDate],
  );

  const filteredNotes =
    activeFilter === "all" || activeFilter === "note" ? events.notes : [];
  const filteredMovies =
    activeFilter === "all" || activeFilter === "movie" ? events.movies : [];
  const filteredTvs =
    activeFilter === "all" || activeFilter === "tv" ? events.tvs : [];

  const totalCount =
    filteredNotes.length + filteredMovies.length + filteredTvs.length;

  /* ── Takvim theme overrides ── */
  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "transparent",
      backgroundColor: "transparent",
      textSectionTitleColor: theme.text.muted,
      selectedDayBackgroundColor: theme.accent,
      selectedDayTextColor: "#fff",
      todayTextColor: theme.accent,
      dayTextColor: theme.text.primary,
      textDisabledColor: theme.text.muted + "55",
      dotColor: theme.accent,
      arrowColor: theme.accent,
      monthTextColor: theme.text.primary,
      indicatorColor: theme.accent,
      textDayFontWeight: "500",
      textMonthFontWeight: "700",
      textMonthFontSize: 16,
      textDayHeaderFontSize: 11,
    }),
    [theme],
  );

  /* ── markedDates + seçili gün ── */
  const combinedMarked = useMemo(() => {
    const base = { ...markedDates };
    if (base[selectedDate]) {
      base[selectedDate] = {
        ...base[selectedDate],
        selected: true,
        selectedColor: theme.accent,
      };
    } else {
      base[selectedDate] = { selected: true, selectedColor: theme.accent };
    }
    return base;
  }, [markedDates, selectedDate, theme.accent]);

  const onDayPress = useCallback((day) => setSelectedDate(day.dateString), []);

  const handleNotePress = useCallback(() => {
    navigation.navigate("TabScreen", { screen: "Profile" });
  }, [navigation]);

  const handleMoviePress = useCallback(
    (item) => {
      navigation.navigate("MovieDetails", { id: item.id });
    },
    [navigation],
  );

  const handleTvPress = useCallback(
    (item) => {
      navigation.navigate("TvShowsDetails", { id: item.id });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[theme.accent + "33", "transparent"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text
          allowFontScaling={false}
          style={[styles.headerTitle, { color: theme.text.primary }]}
        >
          Takvim
        </Text>
        <TouchableOpacity onPress={refreshEvents} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={theme.accent} />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Takvim */}
        <View
          style={[
            styles.calendarWrapper,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          {isLoadingEvents && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={theme.accent} />
            </View>
          )}
          <Calendar
            current={selectedDate}
            onDayPress={onDayPress}
            onMonthChange={(m) => setCurrentMonth(m.dateString.substring(0, 7))}
            markingType="multi-dot"
            markedDates={combinedMarked}
            theme={calendarTheme}
            enableSwipeMonths
            style={styles.calendar}
          />
          {/* Dot legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: "rgb(19, 141, 240)" },
                ]}
              />
              <Text
                allowFontScaling={false}
                style={[styles.legendText, { color: theme.text.muted }]}
              >
                Not - Hatırlatıcı
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: "rgb(255, 124, 37)" },
                ]}
              />
              <Text
                allowFontScaling={false}
                style={[styles.legendText, { color: theme.text.muted }]}
              >
                Film
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: "rgb(128, 0, 128)" },
                ]}
              />
              <Text
                allowFontScaling={false}
                style={[styles.legendText, { color: theme.text.muted }]}
              >
                Dizi
              </Text>
            </View>
          </View>

          {/* Tarih aralığı seçici */}
          <View style={[styles.rangeBar, { borderTopColor: "#ffffff11" }]}>
            <Text
              allowFontScaling={false}
              style={[styles.rangeLabel, { color: theme.text.muted }]}
            >
              TMDB Aralığı:
            </Text>
            {RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.days}
                onPress={() => changeRange(opt.days)}
                style={[
                  styles.rangeBtn,
                  rangeDays === opt.days
                    ? {
                        backgroundColor: theme.accent,
                        borderColor: theme.accent,
                      }
                    : {
                        backgroundColor: "transparent",
                        borderColor: theme.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.rangeBtnText,
                    {
                      color: rangeDays === opt.days ? "#fff" : theme.text.muted,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filtre (sticky) */}
        <View style={[styles.filterBar, { backgroundColor: theme.primary }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTER_OPTIONS.map((f) => {
              const active = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={[
                    styles.filterBtn,
                    active
                      ? {
                          backgroundColor: theme.accent,
                          borderColor: theme.accent,
                        }
                      : {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={f.icon}
                    size={13}
                    color={active ? "#fff" : theme.text.muted}
                  />
                  <Text
                    style={[
                      styles.filterText,
                      { color: active ? "#fff" : theme.text.muted },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Seçili gün başlığı */}
        <View style={styles.dateHeader}>
          <Text
            allowFontScaling={false}
            style={[styles.dateTitle, { color: theme.text.primary }]}
          >
            {formatDisplayDate(selectedDate, language)}
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: theme.accent + "22",
                borderColor: theme.accent + "55",
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.countText, { color: theme.accent }]}
            >
              {totalCount}
            </Text>
          </View>
        </View>

        {/* Event listesi */}
        <View style={styles.eventList}>
          {totalCount === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.emptyText, { color: theme.text.muted }]}
              >
                Bu gün için etkinlik yok
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.emptySubText, { color: theme.text.muted }]}
              >
                Notlarınıza tarih ekleyerek burada görebilirsiniz
              </Text>
            </View>
          ) : (
            <>
              {filteredNotes.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons
                      name="document-text"
                      size={14}
                      color="rgb(19, 141, 240)"
                    />
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: "rgb(19, 141, 240)" },
                      ]}
                    >
                      Notlar & Todo ({filteredNotes.length})
                    </Text>
                  </View>
                  {filteredNotes.map((n, idx) => (
                    <NoteItem
                      key={`note-${n.id}-${idx}`}
                      item={n}
                      theme={theme}
                      onPress={handleNotePress}
                    />
                  ))}
                </>
              )}

              {filteredMovies.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="film" size={14} color="rgb(255, 124, 37)" />
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: "rgb(255, 124, 37)" },
                      ]}
                    >
                      Filmler ({filteredMovies.length})
                    </Text>
                  </View>
                  {filteredMovies.map((m, idx) => (
                    <MediaItem
                      key={`movie-${m.id}-${idx}`}
                      item={m}
                      theme={theme}
                      onPress={() => handleMoviePress(m)}
                    />
                  ))}
                </>
              )}

              {filteredTvs.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="tv" size={14} color="rgb(128, 0, 128)" />
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: "rgb(128, 0, 128)" },
                      ]}
                    >
                      Diziler ({filteredTvs.length})
                    </Text>
                  </View>
                  {filteredTvs.map((t, idx) => (
                    <MediaItem
                      key={`tv-${t.id}-${idx}`}
                      item={t}
                      theme={theme}
                      onPress={() => handleTvPress(t)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.5 },

  calendarWrapper: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  calendar: { borderRadius: 20 },
  loadingOverlay: {
    position: "absolute",
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00000033",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#ffffff11",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10 },

  rangeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    flexWrap: "wrap",
  },
  rangeLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  rangeBtnText: { fontSize: 10, fontWeight: "700" },

  filterBar: { paddingVertical: 10 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: "600" },

  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countText: { fontSize: 12, fontWeight: "700" },

  eventList: { paddingHorizontal: 16, gap: 8 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  eventIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  poster: { width: 40, height: 60, borderRadius: 6, flexShrink: 0 },
  posterFallback: {
    width: 40,
    height: 60,
    borderRadius: 6,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  eventSub: { fontSize: 11 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  typeBadgeText: { fontSize: 10, fontWeight: "700" },

  emptyState: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubText: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

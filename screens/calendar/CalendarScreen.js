import { Image } from "expo-image";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useTheme } from "@context/ThemeContext";
import { useCalendar } from "@context/CalendarContext";
import { useLanguage } from "@context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { i18nText } from "@utils/i18nText";

import {
  buildEventKey,
  loadSavedKeysSet,
  saveEventToPhoneCalendar,
  saveManyEventsToPhoneCalendar,
  removeEventFromPhoneCalendar,
  removeManyEventsFromPhoneCalendar,
} from "@utils/phoneCalendar";

const TODAY = new Date().toISOString().split("T")[0];

const FILTER_OPTIONS = [
  { key: "all",   label: i18nText("autoI18n.tumu", "Tümü"),  icon: "calendar-outline" },
  { key: "note",  label: "Notlar", icon: "document-text-outline" },
  { key: "movie", label: i18nText("autoI18n.film", "Film"),  icon: "film-outline" },
  { key: "tv",    label: i18nText("autoI18n.dizi", "Dizi"),  icon: "tv-outline" },
];

const RANGE_PRESETS = [
  { value: 1,    label: "1 Ay"  },
  { value: 3,    label: "3 Ay"  },
  { value: 6,    label: "6 Ay"  },
  { value: 12,   label: i18nText("autoI18n.1_yil", "1 Yıl") },
  { value: "all", label: i18nText("autoI18n.tumu", "Tümü") },
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

function dayRelativeLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0)  return i18nText("autoI18n.bugun", "Bugün");
  if (diff === 1)  return i18nText("autoI18n.yarin", "Yarın");
  if (diff === -1) return i18nText("autoI18n.dun", "Dün");
  if (diff > 0)    return i18nText("autoI18n.days_after", "{{count}} gün sonra", { count: diff });
  return i18nText("autoI18n.days_before", "{{count}} gün önce", { count: Math.abs(diff) });
}

/* ── Tarih tile parçaları (gün / ay / gün adı) ── */
function dateTileParts(dateStr, lang) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return { day: "", month: "", weekday: "" };
  const loc = lang === "tr" ? "tr-TR" : "en-US";
  return {
    day: d.getDate(),
    month: d.toLocaleDateString(loc, { month: "short" }).replace(".", ""),
    weekday: d.toLocaleDateString(loc, { weekday: "long" }),
  };
}

function urgencyColor(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if (diff < 0)   return "#94a3b8";  // geçmiş
  if (diff === 0) return "#ef4444";  // bugün
  if (diff <= 3)  return "#f97316";  // 3 gün
  if (diff <= 7)  return "#eab308";  // hafta
  return null;                       // normal
}

function rangeTitle(viewMode, rangeMonths) {
  const rangeLabel =
    rangeMonths === "all"
      ? i18nText("autoI18n.all_time", "tüm zaman")
      : rangeMonths === 12
        ? i18nText("autoI18n.one_year", "1 yıl")
        : i18nText("autoI18n.month_count", "{{count}} ay", { count: rangeMonths });

  return viewMode === "future"
    ? i18nText("autoI18n.upcoming_range", "Önümüzdeki {{range}}", { range: rangeLabel })
    : i18nText("autoI18n.past_range", "Geçmiş {{range}}", { range: rangeLabel });
}

/* ── Küçük badge (poster üstü) — moda göre + / ✓ / 🗑 ── */
const SaveBadge = ({ item, savedSet, onSavedChange, accentColor, viewMode }) => {
  const key = buildEventKey(item);
  const isSaved = savedSet.has(key);
  const isPast = viewMode === "past";

  // Geçmiş + telefonda yok → rozet gösterme (silinecek bir şey yok)
  if (isPast && !isSaved) return null;

  if (isPast) {
    // Geçmiş + kayıtlı → kırmızı çöp
    return (
      <TouchableOpacity
        onPress={async (e) => {
          e.stopPropagation?.();
          const res = await removeEventFromPhoneCalendar(item);
          if (res.ok) onSavedChange(key, false);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[
          styles.saveBadge,
          { backgroundColor: "#ef4444", borderColor: "#ef4444" },
        ]}
      >
        <Ionicons name="trash" size={11} color="#fff" />
      </TouchableOpacity>
    );
  }

  // Gelecek mod: kayıtlı → yeşil ✓, değil → + (kaydet)
  return (
    <TouchableOpacity
      onPress={async (e) => {
        e.stopPropagation?.();
        if (isSaved) return;
        const res = await saveEventToPhoneCalendar(item);
        if (res.ok || res.alreadySaved) onSavedChange(key, true);
      }}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[
        styles.saveBadge,
        {
          backgroundColor: isSaved ? "#22c55e" : "#00000088",
          borderColor: isSaved ? "#22c55e" : accentColor + "88",
        },
      ]}
    >
      <Ionicons name={isSaved ? "checkmark" : "add"} size={12} color="#fff" />
    </TouchableOpacity>
  );
};

/* ── Note poster kart ── */
const PosterNoteCard = ({ item, theme, onPress, savedSet, onSavedChange, viewMode }) => {
  const isNote = item.type !== "todo";
  const color = item.color || "rgb(19, 141, 240)";
  return (
    <TouchableOpacity
      style={[styles.posterCard, { borderColor: color + "55" }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.posterTop,
          { backgroundColor: item.backgroundColor || color + "33" },
        ]}
      >
        <Ionicons
          name={isNote ? "document-text" : "checkmark-done"}
          size={32}
          color={color}
        />
        {item.type === "todo" && item.todos?.length > 0 && (
          <Text
            allowFontScaling={false}
            style={[styles.posterTodoCount, { color }]}
          >
            {item.todos.filter((t) => t.done).length}/{item.todos.length}
          </Text>
        )}
        <SaveBadge
          item={item}
          savedSet={savedSet}
          onSavedChange={onSavedChange}
          accentColor={color}
          viewMode={viewMode}
        />
      </View>
      <View
        style={[
          styles.posterBottom,
          { backgroundColor: theme.secondary, borderTopColor: color + "33" },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.posterTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.title || item.content || i18nText("autoI18n.not", "Not")}
        </Text>
        <View style={[styles.posterTagDot, { backgroundColor: color }]} />
      </View>
    </TouchableOpacity>
  );
};

/* ── Media poster kart ── */
const PosterMediaCard = ({ item, theme, onPress, savedSet, onSavedChange, viewMode }) => {
  const isMovie = item.type === "movie";
  const accentColor = isMovie ? "rgb(255, 124, 37)" : "rgb(175, 0, 175)";
  const fallbackBg = isMovie ? "rgba(255, 124, 37, 0.25)" : "rgba(175, 0, 175, 0.25)";

  return (
    <TouchableOpacity
      style={[styles.posterCard, { borderColor: accentColor + "55" }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.posterTop}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.posterImage} />
        ) : (
          <View style={[styles.posterImage, { backgroundColor: fallbackBg, justifyContent: "center", alignItems: "center" }]}>
            <Ionicons
              name={isMovie ? "film" : "tv"}
              size={32}
              color={accentColor}
            />
          </View>
        )}
        <View style={[styles.posterTypeChip, { backgroundColor: accentColor }]}>
          <Ionicons name={isMovie ? "film" : "tv"} size={9} color="#fff" />
        </View>
        <SaveBadge
          item={item}
          savedSet={savedSet}
          onSavedChange={onSavedChange}
          accentColor={accentColor}
          viewMode={viewMode}
        />
      </View>
      <View
        style={[
          styles.posterBottom,
          { backgroundColor: theme.secondary, borderTopColor: accentColor + "33" },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.posterTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={[styles.posterTagDot, { backgroundColor: accentColor }]} />
      </View>
    </TouchableOpacity>
  );
};

/* ── Ana bileşen ── */
export default function CalendarScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const {
    noteEvents,
    reminderEvents,
    markedDates,
    getEventsForDate,
    isLoadingEvents,
    refreshEvents,
  } = useCalendar();

  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState("future");   // "future" | "past"
  const [rangeMonths, setRangeMonths] = useState(1);    // 1, 3, 6, 12, "all"
  const [focusDate, setFocusDate] = useState(null);     // tıklanmış gün (varsa)
  const [savedSet, setSavedSet] = useState(new Set());
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Telefon takvimine eklenmiş eventleri başta oku
  useEffect(() => {
    loadSavedKeysSet().then(setSavedSet);
  }, []);

  const onSavedChange = useCallback((key, saved) => {
    setSavedSet((prev) => {
      const next = new Set(prev);
      if (saved) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /* ── Aralık başlangıç/bitiş tarihleri ── */
  const { startDate, endDate } = useMemo(() => {
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    const todayStr = todayD.toISOString().split("T")[0];

    if (rangeMonths === "all") {
      return viewMode === "future"
        ? { startDate: todayStr, endDate: "9999-12-31" }
        : { startDate: "0000-01-01", endDate: todayStr };
    }
    const d = new Date(todayD);
    if (viewMode === "future") {
      d.setMonth(d.getMonth() + rangeMonths);
      return { startDate: todayStr, endDate: d.toISOString().split("T")[0] };
    }
    d.setMonth(d.getMonth() - rangeMonths);
    return { startDate: d.toISOString().split("T")[0], endDate: todayStr };
  }, [viewMode, rangeMonths]);

  /* ── Aralıktaki tüm event'leri tarihe göre grupla ── */
  const dateGroups = useMemo(() => {
    if (focusDate) {
      return { [focusDate]: getEventsForDate(focusDate) };
    }
    const result = {};
    const allDates = new Set([
      ...Object.keys(noteEvents),
      ...Object.keys(reminderEvents),
    ]);
    allDates.forEach((d) => {
      if (d >= startDate && d <= endDate) {
        const evs = getEventsForDate(d);
        if (evs.notes.length || evs.movies.length || evs.tvs.length) {
          result[d] = evs;
        }
      }
    });
    return result;
  }, [focusDate, getEventsForDate, noteEvents, reminderEvents, startDate, endDate]);

  /* ── Sıralı tarih anahtarları ── */
  const sortedDateKeys = useMemo(() => {
    const keys = Object.keys(dateGroups).sort();
    if (focusDate) return keys;
    return viewMode === "past" ? keys.reverse() : keys;
  }, [dateGroups, focusDate, viewMode]);

  /* ── Toplam sayım ── */
  const totalCount = useMemo(() => {
    let n = 0;
    Object.values(dateGroups).forEach((e) => {
      if (activeFilter === "all" || activeFilter === "note")  n += e.notes.length;
      if (activeFilter === "all" || activeFilter === "movie") n += e.movies.length;
      if (activeFilter === "all" || activeFilter === "tv")    n += e.tvs.length;
    });
    return n;
  }, [dateGroups, activeFilter]);

  // Range tetikleyicileri focus modunu temizler
  const changeViewMode = useCallback((m) => {
    setViewMode(m);
    setFocusDate(null);
  }, []);
  const changeRangeMonths = useCallback((r) => {
    setRangeMonths(r);
    setFocusDate(null);
  }, []);

  // Aralıktaki filtrelenmiş tüm öğelerin düz listesi
  const flatRangeItems = useMemo(() => {
    const items = [];
    sortedDateKeys.forEach((d) => {
      const g = dateGroups[d];
      if (!g) return;
      if (activeFilter === "all" || activeFilter === "note")  items.push(...g.notes);
      if (activeFilter === "all" || activeFilter === "movie") items.push(...g.movies);
      if (activeFilter === "all" || activeFilter === "tv")    items.push(...g.tvs);
    });
    return items;
  }, [sortedDateKeys, dateGroups, activeFilter]);

  // Yeni aktarılabilecek (henüz kaydedilmemiş) öğe sayısı (Gelecek modu için)
  const pendingTransferCount = useMemo(
    () => flatRangeItems.filter((it) => !savedSet.has(buildEventKey(it))).length,
    [flatRangeItems, savedSet],
  );

  // Telefonda kayıtlı olan aralık öğelerinin sayısı (Geçmiş modu için)
  const savedInRangeCount = useMemo(
    () => flatRangeItems.filter((it) => savedSet.has(buildEventKey(it))).length,
    [flatRangeItems, savedSet],
  );

  // Mode'a göre buton aksiyonu
  const bulkActionCount =
    viewMode === "future" ? pendingTransferCount : savedInRangeCount;

  // Toplu aktarım / toplu silme
  const handleBulkAction = useCallback(async () => {
    if (isBulkLoading) return;
    if (flatRangeItems.length === 0) return;

    setIsBulkLoading(true);
    try {
      if (viewMode === "future") {
        const res = await saveManyEventsToPhoneCalendar(flatRangeItems);
        if (res.addedKeys && res.addedKeys.length > 0) {
          setSavedSet((prev) => {
            const next = new Set(prev);
            res.addedKeys.forEach((k) => next.add(k));
            return next;
          });
        }
      } else {
        // past mode → kayıtlı olanları sil
        const itemsToDelete = flatRangeItems.filter((it) =>
          savedSet.has(buildEventKey(it)),
        );
        if (itemsToDelete.length === 0) return;
        const res = await removeManyEventsFromPhoneCalendar(itemsToDelete);
        if (res.removedKeys && res.removedKeys.length > 0) {
          setSavedSet((prev) => {
            const next = new Set(prev);
            res.removedKeys.forEach((k) => next.delete(k));
            return next;
          });
        }
      }
    } finally {
      setIsBulkLoading(false);
    }
  }, [flatRangeItems, isBulkLoading, viewMode, savedSet]);

  const currentRangeLabel = useMemo(
    () => RANGE_PRESETS.find((r) => r.value === rangeMonths)?.label || "1 Ay",
    [rangeMonths],
  );

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

  /* ── markedDates + odak gün ── */
  const combinedMarked = useMemo(() => {
    const base = { ...markedDates };
    const sel = focusDate || TODAY;
    if (base[sel]) {
      base[sel] = {
        ...base[sel],
        selected: true,
        selectedColor: theme.accent,
      };
    } else {
      base[sel] = { selected: true, selectedColor: theme.accent };
    }
    return base;
  }, [markedDates, focusDate, theme.accent]);

  const onDayPress = useCallback(
    (day) => {
      setFocusDate((prev) => (prev === day.dateString ? null : day.dateString));
    },
    [],
  );

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
          style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            allowFontScaling={false}
            style={[styles.headerTitle, { color: theme.text.primary }]}
          >
            Takvim
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.headerSub, { color: theme.text.muted }]}
          >
            {i18nText("autoI18n.n_etkinlik", "{{count}} etkinlik", { count: totalCount })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={refreshEvents}
          style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color={theme.accent} />
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
            current={focusDate || TODAY}
            onDayPress={onDayPress}
            markingType="multi-dot"
            markedDates={combinedMarked}
            theme={calendarTheme}
            enableSwipeMonths
            style={styles.calendar}
          />
          {/* Renk açıklaması */}
          <View style={[styles.legend, { borderTopColor: theme.border }]}>
            {[
              { c: "#138DF0", label: i18nText("autoI18n.not", "Not") },
              { c: "#FF7C25", label: i18nText("autoI18n.film", "Film") },
              { c: "#AF00AF", label: i18nText("autoI18n.dizi", "Dizi") },
            ].map((l) => (
              <View key={l.label} style={[styles.legendChip, { backgroundColor: l.c + "1A" }]}>
                <View style={[styles.legendDot, { backgroundColor: l.c }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { color: l.c }]}>
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Filtre paneli (sticky) */}
        <View
          style={[
            styles.filterPanel,
            { backgroundColor: theme.primary, borderBottomColor: theme.border },
          ]}
        >
          {/* Gelecek / Geçmiş tabları + Aralık chip */}
          <View style={styles.modeAndRangeRow}>
            <View
              style={[
                styles.modeTabs,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => changeViewMode("future")}
                style={[
                  styles.modeTab,
                  viewMode === "future" && { backgroundColor: theme.accent },
                ]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="arrow-forward-circle"
                  size={13}
                  color={viewMode === "future" ? "#fff" : theme.text.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.modeTabText,
                    { color: viewMode === "future" ? "#fff" : theme.text.muted },
                  ]}
                >
                  Gelecek
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => changeViewMode("past")}
                style={[
                  styles.modeTab,
                  viewMode === "past" && { backgroundColor: theme.accent },
                ]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="arrow-back-circle"
                  size={13}
                  color={viewMode === "past" ? "#fff" : theme.text.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.modeTabText,
                    { color: viewMode === "past" ? "#fff" : theme.text.muted },
                  ]}
                >{i18nText("autoI18n.gecmis", "Geçmiş")}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowRangeDropdown(true)}
              style={[
                styles.rangeChip,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.accent + "66",
                },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar" size={13} color={theme.accent} />
              <Text
                allowFontScaling={false}
                style={[styles.rangeChipText, { color: theme.accent }]}
              >
                {currentRangeLabel}
              </Text>
              <Ionicons name="chevron-down" size={12} color={theme.accent} />
            </TouchableOpacity>
          </View>

          {/* Tip filtresi + Toplu aktar */}
          <View style={styles.typeFilterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
              style={{ flex: 1 }}
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

            {(() => {
              const isFuture     = viewMode === "future";
              const actionLabel  = isFuture ? "Aktar"          : "Sil";
              const actionIcon   = isFuture ? "phone-portrait" : "trash";
              const activeColor  = isFuture ? theme.accent     : "#ef4444";
              const disabled     = isBulkLoading || bulkActionCount === 0;

              return (
                <TouchableOpacity
                  onPress={handleBulkAction}
                  disabled={disabled}
                  style={[
                    styles.bulkBtn,
                    {
                      backgroundColor:
                        bulkActionCount === 0 ? theme.secondary : activeColor,
                      borderColor:
                        bulkActionCount === 0 ? theme.border : activeColor,
                      opacity: bulkActionCount === 0 ? 0.6 : 1,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  {isBulkLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={bulkActionCount === 0 ? theme.text.muted : "#fff"}
                    />
                  ) : (
                    <Ionicons
                      name={actionIcon}
                      size={13}
                      color={bulkActionCount === 0 ? theme.text.muted : "#fff"}
                    />
                  )}
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.bulkBtnText,
                      {
                        color:
                          bulkActionCount === 0 ? theme.text.muted : "#fff",
                      },
                    ]}
                  >
                    {actionLabel}
                  </Text>
                  {bulkActionCount > 0 && (
                    <View style={styles.bulkBadge}>
                      <Text
                        allowFontScaling={false}
                        style={styles.bulkBadgeText}
                      >
                        {bulkActionCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        {/* Aralık özeti / Odak gün başlığı */}
        <View style={styles.dateHeader}>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              style={[styles.dateTitle, { color: theme.text.primary }]}
            >
              {focusDate
                ? formatDisplayDate(focusDate, language)
                : rangeTitle(viewMode, rangeMonths)}
            </Text>
            {focusDate && (
              <Text
                allowFontScaling={false}
                style={[styles.dateSubTitle, { color: theme.text.muted }]}
              >
                {dayRelativeLabel(focusDate)}
              </Text>
            )}
          </View>
          {focusDate && (
            <TouchableOpacity
              onPress={() => setFocusDate(null)}
              style={[
                styles.clearFocusBtn,
                { borderColor: theme.border, backgroundColor: theme.secondary },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={12} color={theme.text.muted} />
              <Text
                allowFontScaling={false}
                style={[styles.clearFocusText, { color: theme.text.muted }]}
              >{i18nText("autoI18n.araliga_don", "Aralığa dön")}</Text>
            </TouchableOpacity>
          )}
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

        {/* Tarih gruplu event listesi */}
        <View style={styles.eventList}>
          {totalCount === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Ionicons
                  name="calendar-outline"
                  size={36}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.emptyText, { color: theme.text.primary }]}
              >
                {focusDate
                  ? i18nText("autoI18n.bugun_icin_hatirlatma_yok", "Bu gün için hatırlatma yok")
                  : viewMode === "future"
                    ? i18nText("autoI18n.aralikta_yaklasan_hatirlatma_yok", "Bu aralıkta yaklaşan hatırlatma yok")
                    : i18nText("autoI18n.aralikta_gecmis_hatirlatma_yok", "Bu aralıkta geçmiş hatırlatma yok")}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.emptySubText, { color: theme.text.muted }]}
              >{i18nText("autoI18n.notlariniza_tarih_ekleyerek_veya_film_dizi_hatirla", "Notlarınıza tarih ekleyerek veya film/dizi hatırlatması kurarak burada görebilirsiniz")}</Text>
            </View>
          ) : (
            sortedDateKeys.map((dateStr) => {
              const grp = dateGroups[dateStr];
              const dayNotes  = activeFilter === "all" || activeFilter === "note"  ? grp.notes  : [];
              const dayMovies = activeFilter === "all" || activeFilter === "movie" ? grp.movies : [];
              const dayTvs    = activeFilter === "all" || activeFilter === "tv"    ? grp.tvs    : [];
              const dayCount  = dayNotes.length + dayMovies.length + dayTvs.length;
              if (dayCount === 0) return null;

              const uColor = urgencyColor(dateStr);
              const headerColor = uColor || theme.accent;
              const parts = dateTileParts(dateStr, language);

              return (
                <View key={`grp-${dateStr}`} style={styles.dateGroup}>
                  <TouchableOpacity
                    onPress={() => setFocusDate(dateStr)}
                    activeOpacity={0.7}
                    style={styles.groupHeader}
                  >
                    <View
                      style={[
                        styles.groupTile,
                        { backgroundColor: headerColor + "1A", borderColor: headerColor + "33" },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.groupTileDay, { color: headerColor }]}
                      >
                        {parts.day}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={[styles.groupTileMonth, { color: headerColor }]}
                      >
                        {parts.month}
                      </Text>
                    </View>
                    <View style={styles.groupInfo}>
                      <Text
                        allowFontScaling={false}
                        style={[styles.groupWeekday, { color: theme.text.primary }]}
                        numberOfLines={1}
                      >
                        {parts.weekday}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={[styles.groupRel, { color: headerColor }]}
                      >
                        {dayRelativeLabel(dateStr)}
                      </Text>
                    </View>
                    <View style={[styles.groupCount, { backgroundColor: headerColor + "1A" }]}>
                      <Text
                        allowFontScaling={false}
                        style={[styles.groupCountText, { color: headerColor }]}
                      >
                        {dayCount}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.posterScrollContent}
                  >
                    {dayNotes.map((n, idx) => (
                      <PosterNoteCard
                        key={`note-${dateStr}-${n.id}-${idx}`}
                        item={n}
                        theme={theme}
                        onPress={handleNotePress}
                        savedSet={savedSet}
                        onSavedChange={onSavedChange}
                        viewMode={viewMode}
                      />
                    ))}
                    {dayMovies.map((m, idx) => (
                      <PosterMediaCard
                        key={`movie-${dateStr}-${m.id}-${idx}`}
                        item={m}
                        theme={theme}
                        onPress={() => handleMoviePress(m)}
                        savedSet={savedSet}
                        onSavedChange={onSavedChange}
                        viewMode={viewMode}
                      />
                    ))}
                    {dayTvs.map((t, idx) => (
                      <PosterMediaCard
                        key={`tv-${dateStr}-${t.id}-${t.episodeNumber || idx}-${idx}`}
                        item={t}
                        theme={theme}
                        onPress={() => handleTvPress(t)}
                        savedSet={savedSet}
                        onSavedChange={onSavedChange}
                        viewMode={viewMode}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Aralık dropdown modal */}
      <Modal
        visible={showRangeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRangeDropdown(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowRangeDropdown(false)}
        >
          <View
            style={[
              styles.dropdownPanel,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={styles.dropdownHandle} />
            <Text
              allowFontScaling={false}
              style={[styles.dropdownTitle, { color: theme.text.muted }]}
            >{i18nText("autoI18n.aralik_sec", "ARALIK SEÇ")}</Text>
            {RANGE_PRESETS.map((r) => {
              const active = rangeMonths === r.value;
              return (
                <TouchableOpacity
                  key={String(r.value)}
                  onPress={() => {
                    changeRangeMonths(r.value);
                    setShowRangeDropdown(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    active && {
                      backgroundColor: theme.accent + "22",
                      borderColor: theme.accent + "55",
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={16}
                    color={active ? theme.accent : theme.text.muted}
                  />
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.dropdownItemText,
                      {
                        color: active ? theme.accent : theme.text.primary,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1, fontWeight: "500" },

  calendarWrapper: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
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
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#ffffff11",
    flexWrap: "wrap",
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: "700" },

  filterPanel: {
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  modeAndRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  modeTabs: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 22,
    borderWidth: 1,
    padding: 3,
    gap: 4,
    overflow: "hidden",
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 18,
  },
  modeTabText: { fontSize: 12, fontWeight: "700" },
  rangeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 86,
  },
  rangeChipText: { fontSize: 12, fontWeight: "700" },

  typeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 16,
  },
  filterScroll: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: { fontSize: 11, fontWeight: "600" },

  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 96,
  },
  bulkBtnText: { fontSize: 11, fontWeight: "700" },
  bulkBadge: {
    backgroundColor: "#ffffff44",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  bulkBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dateTitle: { fontSize: 15, fontWeight: "700" },
  dateSubTitle: { fontSize: 11, marginTop: 2 },
  clearFocusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearFocusText: { fontSize: 11, fontWeight: "600" },
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

  eventList: { paddingHorizontal: 0, paddingTop: 2 },

  dateGroup: { marginBottom: 14 },

  /* Tarih grubu başlığı (ajanda tile) */
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupTile: {
    width: 42,
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  groupTileDay: { fontSize: 17, fontWeight: "800", lineHeight: 19 },
  groupTileMonth: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupInfo: { flex: 1, gap: 2 },
  groupWeekday: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  groupRel: { fontSize: 11, fontWeight: "600" },
  groupCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  groupCountText: { fontSize: 12, fontWeight: "800" },

  /* Poster kartlar */
  posterScrollContent: { paddingHorizontal: 16, paddingVertical: 4, gap: 10 },
  posterCard: {
    width: 106,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  posterTop: {
    width: "100%",
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  posterImage: { width: "100%", height: "100%" },
  posterBottom: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  posterTitle: { fontSize: 11, fontWeight: "700", lineHeight: 13, flex: 1 },
  posterTagDot: { width: 6, height: 6, borderRadius: 3 },
  posterTypeChip: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  posterTodoCount: {
    position: "absolute",
    bottom: 8,
    left: 8,
    fontSize: 10,
    fontWeight: "800",
  },
  saveBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyState: { alignItems: "center", paddingTop: 40, gap: 12, paddingHorizontal: 16 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  emptyText: { fontSize: 15, fontWeight: "700" },
  emptySubText: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  /* Dropdown modal */
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  dropdownPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 6,
  },
  dropdownHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff44",
    alignSelf: "center",
    marginBottom: 12,
  },
  dropdownTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dropdownItemText: { fontSize: 14 },
});

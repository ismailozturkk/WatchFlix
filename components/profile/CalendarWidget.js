import { Image } from "expo-image";
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useCalendar } from "../../context/CalendarContext";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { i18nText } from "../../utils/i18nText";

// ─── Tarih yardımcıları ───────────────────────────────────────────────────────

function locale(language) {
  return language === "tr" ? "tr-TR" : "en-US";
}

/** Tarih tile'ı için { day, month } parçaları. */
function dateParts(dateStr, language) {
  if (!dateStr) return { day: "", month: "" };
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return { day: "", month: "" };
  return {
    day: d.getDate(),
    month: d
      .toLocaleDateString(locale(language), { month: "short" })
      .replace(".", ""),
  };
}

/** Meta satırı için "Cum · 12 Haz" gibi okunur tarih. */
function formatLongDate(dateStr, language) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d
    .toLocaleDateString(locale(language), {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .replace(".", "");
}

/** Geri sayım rozeti bilgisi. */
function countdownInfo(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  let label;
  if (diff === 0) label = i18nText("autoI18n.bugun", "Bugün");
  else if (diff === 1) label = i18nText("autoI18n.yarin", "Yarın");
  else if (diff < 0) label = i18nText("autoI18n.past_short", "Geçti");
  else label = i18nText("autoI18n.day_count_short", "{{count}} gün", { count: diff });
  return { label, isToday: diff === 0, isPast: diff < 0 };
}

// ─── Tür yardımcıları ─────────────────────────────────────────────────────────

function getItemColor(item) {
  if (item.eventType === "note" || item.type === "todo") return "#138DF0";
  if (item.eventType === "reminder_movie") return "#FF7C25";
  if (item.eventType === "reminder_tv") return "#AF00AF";
  return "#138DF0";
}

function getItemIcon(item) {
  if (item.eventType === "reminder_movie") return "film";
  if (item.eventType === "reminder_tv") return "tv";
  if (item.type === "todo") return "checkmark-circle";
  return "document-text";
}

function getItemTitle(item) {
  if (item.eventType === "note")
    return item.title || item.content || i18nText("autoI18n.not", "Not");
  return item.title;
}

function getTypeBadge(item) {
  if (item.eventType === "reminder_movie") return i18nText("autoI18n.film", "Film");
  if (item.eventType === "reminder_tv") return "Dizi";
  if (item.type === "todo") return "Todo";
  return i18nText("autoI18n.not", "Not");
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export default function CalendarWidget({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { upcomingItems } = useCalendar();

  const displayItems = useMemo(() => upcomingItems.slice(0, 3), [upcomingItems]);
  const total = upcomingItems.length;

  const openCalendar = () => navigation.navigate("CalendarScreen");

  return (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.takvim_upper", "TAKVİM")}
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.secondary, borderColor: theme.border, shadowColor: theme.shadow },
        ]}
      >
        <LinearGradient
          colors={[theme.accent + "1F", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.7 }}
        />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconTile, { backgroundColor: theme.accent + "22" }]}>
              <Ionicons name="calendar" size={18} color={theme.accent} />
            </View>
            <View>
              <Text allowFontScaling={false} style={[styles.headerTitle, { color: theme.text.primary }]}>
                {i18nText("autoI18n.yaklasan_etkinlikler_title", "Yaklaşan Etkinlikler")}
              </Text>
              <Text allowFontScaling={false} style={[styles.headerSub, { color: theme.text.muted }]}>
                {total > 0
                  ? i18nText("autoI18n.n_etkinlik", "{{count}} etkinlik", { count: total })
                  : i18nText("autoI18n.bos_takvim", "Planlı bir şey yok")}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.allBtn, { backgroundColor: theme.accent }]}
            onPress={openCalendar}
            activeOpacity={0.85}
          >
            <Text allowFontScaling={false} style={styles.allBtnText}>
              {i18nText("autoI18n.tumu", "Tümü")}
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── İçerik ── */}
        {displayItems.length === 0 ? (
          <TouchableOpacity style={styles.empty} onPress={openCalendar} activeOpacity={0.8}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[styles.emptyText, { color: theme.text.primary }]}>
                {i18nText("autoI18n.yaklasan_etkinlik_yok", "Yaklaşan etkinlik yok")}
              </Text>
              <Text allowFontScaling={false} style={[styles.emptySubText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.not_veya_hatirlatici_ekleyerek_baslayin", "Not veya hatırlatıcı ekleyerek başlayın")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.itemList}>
            {displayItems.map((item, idx) => {
              const color = getItemColor(item);
              const icon = getItemIcon(item);
              const title = getItemTitle(item);
              const badge = getTypeBadge(item);
              const { day, month } = dateParts(item.date, language);
              const { label, isToday, isPast } = countdownInfo(item.date);
              const hasPoster = !!item.poster;

              return (
                <TouchableOpacity
                  key={`cal-${item.id || idx}-${idx}`}
                  style={[styles.itemRow, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    if (item.eventType === "reminder_movie") {
                      navigation.navigate("MovieDetails", { id: item.id });
                    } else if (item.eventType === "reminder_tv") {
                      navigation.navigate("TvShowsDetails", { id: item.id });
                    } else {
                      openCalendar();
                    }
                  }}
                  activeOpacity={0.75}
                >
                  {/* Renk şeridi */}
                  <View style={[styles.accentStrip, { backgroundColor: color }]} />

                  {/* Sol: poster veya tarih tile'ı */}
                  {hasPoster ? (
                    <Image source={{ uri: item.poster }} style={styles.poster} contentFit="cover" transition={120} />
                  ) : (
                    <View style={[styles.dateTile, { backgroundColor: color + "1A", borderColor: color + "33" }]}>
                      <Text allowFontScaling={false} style={[styles.dateDay, { color }]}>
                        {day}
                      </Text>
                      <Text allowFontScaling={false} style={[styles.dateMonth, { color }]}>
                        {month}
                      </Text>
                    </View>
                  )}

                  {/* Orta: başlık + meta */}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: theme.text.primary }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <View style={styles.itemMeta}>
                      <View style={[styles.typeChip, { backgroundColor: color + "1F" }]}>
                        <Ionicons name={icon} size={10} color={color} />
                        <Text allowFontScaling={false} style={[styles.typeChipText, { color }]}>
                          {badge}
                        </Text>
                      </View>
                      <Text allowFontScaling={false} style={[styles.itemDate, { color: theme.text.muted }]} numberOfLines={1}>
                        {formatLongDate(item.date, language)}
                      </Text>
                    </View>
                  </View>

                  {/* Sağ: geri sayım */}
                  <View
                    style={[
                      styles.countdown,
                      isToday
                        ? { backgroundColor: color }
                        : { backgroundColor: color + "14", borderColor: color + "44", borderWidth: 1 },
                      isPast && !isToday && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.countdownText, { color: isToday ? "#fff" : color }]}
                    >
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "90%", marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1, fontWeight: "500" },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 999,
  },
  allBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Empty
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 13, fontWeight: "700" },
  emptySubText: { fontSize: 11, marginTop: 2 },

  // List
  itemList: { gap: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 8,
    paddingRight: 10,
    paddingLeft: 12,
    gap: 10,
    overflow: "hidden",
  },
  accentStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  dateTile: {
    width: 42,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dateDay: { fontSize: 18, fontWeight: "800", lineHeight: 20 },
  dateMonth: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  poster: { width: 42, height: 48, borderRadius: 10 },

  itemInfo: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: "700" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  typeChipText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.2 },
  itemDate: { fontSize: 10, fontWeight: "500", flexShrink: 1 },

  countdown: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  countdownText: { fontSize: 11, fontWeight: "800" },
});

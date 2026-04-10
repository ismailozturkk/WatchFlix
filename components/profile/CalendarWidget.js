import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useCalendar } from "../../context/CalendarContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff < 0) return "Geçti";
  return `${diff} gün`;
}

function getItemColor(item, theme) {
  if (item.eventType === "note" || item.type === "todo")
    return "rgb(19, 141, 240)";
  if (item.eventType === "reminder_movie") return "rgb(255, 124, 37)";
  if (item.eventType === "reminder_tv") return "rgba(175, 0, 175, 1)";
  return theme.accent;
}
function getItemBackgroundColor(item, theme) {
  if (item.eventType === "note" || item.type === "todo")
    return "rgba(19, 141, 240, 0.3)";
  if (item.eventType === "reminder_movie") return "rgba(255, 124, 37, 0.3)";
  if (item.eventType === "reminder_tv") return "rgba(175, 0, 175, 0.3)";
  return theme.accent;
}

function getItemIcon(item) {
  if (item.eventType === "reminder_movie") return "film";
  if (item.eventType === "reminder_tv") return "tv";
  if (item.type === "todo") return "checkmark-circle";
  return "document-text";
}

function getItemTitle(item) {
  if (item.eventType === "note") return item.title || item.content || "Not";
  return item.title;
}

function getTypeBadge(item) {
  if (item.eventType === "reminder_movie") return "Film";
  if (item.eventType === "reminder_tv") return "Dizi";
  if (item.type === "todo") return "Todo";
  return "Not";
}

export default function CalendarWidget({ navigation }) {
  const { theme } = useTheme();
  const { upcomingItems } = useCalendar();

  const displayItems = useMemo(
    () => upcomingItems.slice(0, 3),
    [upcomingItems],
  );

  return (
    <View style={{ width: "90%" }}>
      <Text
        style={{
          color: theme.text.secondary,
          marginVertical: 15,
        }}
      >
        TAKVIM
      </Text>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {/* Arkaplan gradient */}
        <LinearGradient
          colors={[theme.accent + "18", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="calendar" size={16} color={theme.accent} />
            <Text
              allowFontScaling={false}
              style={[styles.headerTitle, { color: theme.text.muted }]}
            >
              YAKLAŞAN ETKİNLİKLER
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.openBtn,
              {
                backgroundColor: theme.primary,
                borderColor: theme.accent + "44",
              },
            ]}
            onPress={() => navigation.navigate("CalendarScreen")}
            activeOpacity={0.8}
          >
            <Text
              allowFontScaling={false}
              style={[styles.openBtnText, { color: theme.text.primary }]}
            >
              Takvimi Aç{" "}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={theme.text.primary}
            />
          </TouchableOpacity>
        </View>

        {/* İçerik */}
        {displayItems.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={theme.text.muted}
            />
            <View style={{ flex: 1 }}>
              <Text
                allowFontScaling={false}
                style={[styles.emptyText, { color: theme.text.muted }]}
              >
                Yaklaşan etkinlik yok
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.emptySubText, { color: theme.text.muted }]}
              >
                Not veya hatırlatıcı ekleyerek başlayın
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.itemList}>
            {displayItems.map((item, idx) => {
              const color = getItemColor(item, theme);
              const backgroundColor = getItemBackgroundColor(item, theme);
              const icon = getItemIcon(item);
              const title = getItemTitle(item);
              const dateLabel = formatShortDate(item.date);
              const badge = getTypeBadge(item);

              return (
                <TouchableOpacity
                  key={`widget-${item.id || idx}-${idx}`}
                  style={[
                    styles.itemRow,
                    {
                      borderBottomColor: theme.border,
                      borderBottomWidth: idx < displayItems.length - 1 ? 1 : 0,
                    },
                  ]}
                  onPress={() => {
                    if (item.eventType === "reminder_movie") {
                      navigation.navigate("MovieDetails", { id: item.id });
                    } else if (item.eventType === "reminder_tv") {
                      navigation.navigate("TvShowsDetails", { id: item.id });
                    } else {
                      navigation.navigate("CalendarScreen");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* İkon veya poster */}
                  {item.poster ? (
                    <Image
                      source={{ uri: item.poster }}
                      style={styles.miniPoster}
                    />
                  ) : (
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: backgroundColor },
                      ]}
                    >
                      <Ionicons name={icon} size={16} color={color} />
                    </View>
                  )}

                  {/* Bilgi */}
                  <View style={styles.itemInfo}>
                    <Text
                      style={[styles.itemTitle, { color: theme.text.primary }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text
                        style={[styles.itemDate, { color: theme.text.muted }]}
                      >
                        {item.date}
                      </Text>
                      <View
                        style={[
                          styles.typePill,
                          { backgroundColor: backgroundColor },
                        ]}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[styles.typePillText, { color }]}
                        >
                          {badge}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Gün sayacı */}
                  <View
                    style={[
                      styles.dayBadge,
                      {
                        backgroundColor: backgroundColor,
                        borderColor: color + "55",
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.dayBadgeText, { color }]}
                    >
                      {dateLabel}
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
  container: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff10",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  openBtnText: { fontSize: 11, fontWeight: "600" },

  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  emptyText: { fontSize: 12, fontWeight: "600" },
  emptySubText: { fontSize: 10, marginTop: 2 },

  itemList: { paddingVertical: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  miniPoster: { width: 28, height: 42, borderRadius: 4, flexShrink: 0 },
  itemInfo: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13, fontWeight: "600" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemDate: { fontSize: 10 },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  typePillText: { fontSize: 9, fontWeight: "700" },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  dayBadgeText: { fontSize: 10, fontWeight: "700" },
});

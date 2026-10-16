// components/calendar/CalendarAgendaDay.js
//
// Takvim ajandasının bir günlük bölümü: tarih başlığı + o günün etkinlik
// satırları. Önceki sürümde her gün için yatay bir poster rayı vardı; 11 puntoluk
// iki satırlık başlıklar kesiliyor, dizi bölümü/film çıkışı ayrımı okunmuyordu.
// Satır düzeni başlığı tam gösteriyor, ne tür bir etkinlik olduğunu yazıyor ve
// telefon takvimine ekleme düğmesini her satırın SAĞINDA, sabit yerde tutuyor.

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { memo, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { EVENT_COLORS } from "@context/CalendarContext";
import {
  buildEventKey,
  removeEventFromPhoneCalendar,
  saveEventToPhoneCalendar,
} from "@utils/phoneCalendar";
import { dayDiff, formatEpisodeCode, urgencyTone } from "@utils/calendarAgenda";
import { i18nText } from "@utils/i18nText";

const THUMB_W = 46;
const THUMB_H = 68;

const TONE_COLORS = {
  past: "#94a3b8",
  today: "#ef4444",
  soon: "#f97316",
  week: "#eab308",
};

function dayRelativeLabel(diff) {
  if (diff == null) return "";
  if (diff === 0) return i18nText("autoI18n.bugun", "Bugün");
  if (diff === 1) return i18nText("autoI18n.yarin", "Yarın");
  if (diff === -1) return i18nText("autoI18n.dun", "Dün");
  if (diff > 0) {
    return i18nText("autoI18n.days_after", "{{count}} gün sonra", { count: diff });
  }
  return i18nText("autoI18n.days_before", "{{count}} gün önce", { count: Math.abs(diff) });
}

function dateTileParts(dateStr, language) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: "", month: "", weekday: "" };
  const locale = intlLocaleOf(language);
  return {
    day: date.getDate(),
    month: date.toLocaleDateString(locale, { month: "short" }).replace(".", ""),
    weekday: date.toLocaleDateString(locale, { weekday: "long" }),
  };
}

/* ── Telefon takvimine ekle / kaldır düğmesi ─────────────────────────────── */
const SaveButton = ({ item, savedSet, onSavedChange, viewMode, theme }) => {
  const key = buildEventKey(item);
  const isSaved = savedSet.has(key);
  const isPast = viewMode === "past";

  // Geçmiş + telefonda yok → silinecek bir şey yok, düğme gösterme.
  if (isPast && !isSaved) return <View style={styles.actionSlot} />;

  if (isPast) {
    return (
      <TouchableOpacity
        onPress={async () => {
          const res = await removeEventFromPhoneCalendar(item);
          if (res.ok) onSavedChange(key, false);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={i18nText(
          "autoI18n.telefon_takviminden_kaldir",
          "Telefon takviminden kaldır",
        )}
        style={[styles.actionBtn, { backgroundColor: "#ef444418", borderColor: "#ef444444" }]}
      >
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={async () => {
        if (isSaved) return;
        const res = await saveEventToPhoneCalendar(item);
        if (res.ok || res.alreadySaved) onSavedChange(key, true);
      }}
      activeOpacity={0.7}
      disabled={isSaved}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSaved }}
      accessibilityLabel={
        isSaved
          ? i18nText("autoI18n.telefon_takviminde", "Telefon takviminde")
          : i18nText("autoI18n.takvim_telefona_ekle", "Telefon takvimine ekle")
      }
      style={[
        styles.actionBtn,
        isSaved
          ? { backgroundColor: "#22c55e22", borderColor: "#22c55e66" }
          : { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <Ionicons
        name={isSaved ? "checkmark" : "add"}
        size={isSaved ? 17 : 19}
        color={isSaved ? "#22c55e" : theme.text.secondary}
      />
    </TouchableOpacity>
  );
};

/* ── Tek etkinlik satırı ─────────────────────────────────────────────────── */
const EventRow = memo(function EventRow({
  entry,
  theme,
  language,
  savedSet,
  onSavedChange,
  viewMode,
  onItemPress,
  isLast,
}) {
  const { kind, item } = entry;
  const isNote = kind === "note";
  const isTodo = isNote && item.type === "todo";

  const color = isNote ? item.color || EVENT_COLORS.note : EVENT_COLORS[kind];
  const icon = isNote ? (isTodo ? "checkmark-done" : "document-text") : kind === "movie" ? "film" : "tv";

  let title;
  let meta;
  if (isNote) {
    title = item.title || item.content || i18nText("autoI18n.not", "Not");
    const todos = Array.isArray(item.todos) ? item.todos : [];
    meta = isTodo && todos.length
      ? i18nText("autoI18n.takvim_gorev_ilerleme", "{{done}}/{{total}} görev", {
          done: todos.filter((todo) => todo.done).length,
          total: todos.length,
        })
      : i18nText("autoI18n.not", "Not");
  } else if (kind === "movie") {
    title = item.title;
    meta = i18nText("autoI18n.takvim_film_cikisi", "Film çıkışı");
  } else {
    title = item.showName || item.title;
    const code = formatEpisodeCode(item.seasonNumber, item.episodeNumber, language);
    const label = i18nText("autoI18n.takvim_yeni_bolum", "Yeni bölüm");
    meta = code ? `${label} · ${code}` : label;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onItemPress(entry)}
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      {!isNote && item.poster ? (
        <Image
          source={{ uri: item.poster }}
          style={[styles.thumb, { backgroundColor: color + "22" }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbFallback,
            { backgroundColor: (isNote && item.backgroundColor) || color + "22" },
          ]}
        >
          <Ionicons name={icon} size={22} color={color} />
        </View>
      )}

      <View style={styles.rowCopy}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[styles.rowTitle, { color: theme.text.primary }]}
        >
          {title}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: color + "1F" }]}>
            <Ionicons name={icon} size={10} color={color} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.metaText, { color }]}
            >
              {meta}
            </Text>
          </View>
        </View>
      </View>

      <SaveButton
        item={item}
        savedSet={savedSet}
        onSavedChange={onSavedChange}
        viewMode={viewMode}
        theme={theme}
      />
    </TouchableOpacity>
  );
});

/* ── Günün bölümü ────────────────────────────────────────────────────────── */
export const AgendaDay = memo(function AgendaDay({
  group,
  todayStr,
  language,
  theme,
  savedSet,
  onSavedChange,
  viewMode,
  onFocus,
  onItemPress,
}) {
  const { dateStr, notes, movies, tvs, count } = group;
  const diff = dayDiff(dateStr, todayStr);
  const tone = urgencyTone(diff);
  const headerColor = TONE_COLORS[tone] || theme.accent;
  const parts = dateTileParts(dateStr, language);

  const entries = useMemo(
    () => [
      ...notes.map((item, index) => ({ key: `note-${item.id}-${index}`, kind: "note", item })),
      ...movies.map((item, index) => ({ key: `movie-${item.id}-${index}`, kind: "movie", item })),
      ...tvs.map((item, index) => ({
        key: `tv-${item.id}-${item.episodeNumber ?? index}-${index}`,
        kind: "tv",
        item,
      })),
    ],
    [movies, notes, tvs],
  );

  return (
    <View style={styles.day}>
      <TouchableOpacity
        onPress={() => onFocus(dateStr)}
        activeOpacity={0.75}
        style={styles.dayHeader}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.tile,
            { backgroundColor: headerColor + "1A", borderColor: headerColor + "40" },
          ]}
        >
          <Text allowFontScaling={false} style={[styles.tileDay, { color: headerColor }]}>
            {parts.day}
          </Text>
          <Text allowFontScaling={false} style={[styles.tileMonth, { color: headerColor }]}>
            {parts.month}
          </Text>
        </View>
        <View style={styles.dayInfo}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.dayWeekday, { color: theme.text.primary }]}
          >
            {parts.weekday}
          </Text>
          <Text allowFontScaling={false} style={[styles.dayRel, { color: headerColor }]}>
            {dayRelativeLabel(diff)}
          </Text>
        </View>
        <View style={[styles.dayCount, { backgroundColor: headerColor + "1F" }]}>
          <Text allowFontScaling={false} style={[styles.dayCountText, { color: headerColor }]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {entries.map((entry, index) => (
          <EventRow
            key={entry.key}
            entry={entry}
            theme={theme}
            language={language}
            savedSet={savedSet}
            onSavedChange={onSavedChange}
            viewMode={viewMode}
            onItemPress={onItemPress}
            isLast={index === entries.length - 1}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  day: { marginBottom: 18, paddingHorizontal: 16 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
  },
  tile: {
    width: 46,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tileDay: { fontSize: 19, fontWeight: "800", lineHeight: 21 },
  tileMonth: {
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dayInfo: { flex: 1, gap: 2 },
  dayWeekday: { fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  dayRel: { fontSize: 12, fontWeight: "700" },
  dayCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCountText: { fontSize: 13, fontWeight: "800" },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 10 },
  thumbFallback: { justifyContent: "center", alignItems: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontSize: 14.5, fontWeight: "700", lineHeight: 19, letterSpacing: -0.1 },
  metaRow: { flexDirection: "row" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: "100%",
  },
  metaText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  actionSlot: { width: 36, height: 36 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

// components/profile/ResetScopeList.js
//
// "Hesabı sıfırla" onay sayfasında NE SİLİNECEĞİNİ gösteren özet: her kalem
// simge + ad + (biliniyorsa) kullanıcının kendi sayısı; altta "Kalacaklar".
// Sayılar bellekteki bağlamlardan gelir (ek okuma yok); sayısı bilinmeyen
// kalemlerde rozet yoktur. Kalemlerin kapsamı services/accountResetService.js
// ile aynı tutulmalıdır — yeni silinen veri eklenirse buraya da kalem ekle.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";

const fill = (template, values) =>
  String(template || "").replace(/\{(\w+)\}/g, (_, key) => (key in values ? values[key] : ""));

/**
 * Saf: sayılar + metin tablosundan satır listesi. Sıfır olan sayı rozeti
 * gösterilmez (kalem yine listelenir: silinecek veri türünü anlatır).
 *
 * @param {object} counts { movies, shows, episodes, minutes, listItems, notes, reminders }
 * @param {object} copy   resetAccountCopy `scope` tablosu
 * @param {(n:number)=>string} format sayı biçimlendirici (yerel ayar)
 */
export function buildResetScopeRows(counts = {}, copy, format = String) {
  const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const movies = n(counts.movies);
  const shows = n(counts.shows);
  const episodes = n(counts.episodes);
  const hours = Math.round(n(counts.minutes) / 60);
  const listItems = n(counts.listItems);
  const notes = n(counts.notes);
  const reminders = n(counts.reminders);
  return [
    { key: "movies", icon: "film-outline", label: copy.movies,
      count: movies ? fill(copy.countMovies, { n: format(movies) }) : null },
    { key: "shows", icon: "tv-outline", label: copy.shows,
      count: shows || episodes ? fill(copy.countShows, { n: format(shows), e: format(episodes) }) : null },
    { key: "time", icon: "stats-chart-outline", label: copy.time,
      count: hours ? fill(copy.countHours, { n: format(hours) }) : null },
    { key: "lists", icon: "albums-outline", label: copy.lists,
      count: listItems ? fill(copy.countItems, { n: format(listItems) }) : null },
    { key: "activity", icon: "chatbubbles-outline", label: copy.activity, count: null },
    { key: "badges", icon: "ribbon-outline", label: copy.badges, count: null },
    { key: "notes", icon: "document-text-outline", label: copy.notes,
      count: notes || reminders ? fill(copy.countNotes, { n: format(notes), r: format(reminders) }) : null },
    { key: "games", icon: "game-controller-outline", label: copy.games, count: null },
    { key: "ai", icon: "sparkles-outline", label: copy.ai, count: null },
  ];
}

export default function ResetScopeList({ theme, copy, rows }) {
  const red = theme.colors.red;
  const green = theme.colors.green;
  return (
    <View style={styles.root}>
      <View style={[styles.card, { borderColor: alpha(red, 0.22), backgroundColor: alpha(red, 0.05) }]}>
        <Text allowFontScaling={false} style={[styles.caption, { color: red }]}>
          {copy.removeTitle}
        </Text>
        {rows.map((row) => (
          <View key={row.key} style={styles.row} accessible accessibilityLabel={row.count ? `${row.label}, ${row.count}` : row.label}>
            <View style={[styles.iconWrap, { backgroundColor: alpha(red, 0.12) }]}>
              <Ionicons name={row.icon} size={15} color={red} />
            </View>
            <Text style={[styles.label, { color: theme.text.primary }]} numberOfLines={2}>
              {row.label}
            </Text>
            {row.count ? (
              <View style={[styles.chip, { backgroundColor: theme.between, borderColor: theme.border }]}>
                <Text allowFontScaling={false} style={[styles.chipText, { color: theme.text.secondary }]} numberOfLines={1}>
                  {row.count}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.keepCard, { borderColor: alpha(green, 0.25), backgroundColor: alpha(green, 0.06) }]}>
        <View style={[styles.iconWrap, { backgroundColor: alpha(green, 0.14) }]}>
          <Ionicons name="shield-checkmark-outline" size={15} color={green} />
        </View>
        <View style={styles.keepText}>
          <Text allowFontScaling={false} style={[styles.caption, { color: green, marginBottom: 2 }]}>
            {copy.keepTitle}
          </Text>
          <Text style={[styles.label, { color: theme.text.primary }]}>{copy.keep}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  caption: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 18 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 150 },
  chipText: { fontSize: 12, fontWeight: "700" },
  keepCard: { flexDirection: "row", alignItems: "center", gap: 10 },
  keepText: { flex: 1 },
});

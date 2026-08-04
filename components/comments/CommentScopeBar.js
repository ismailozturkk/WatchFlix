// components/comments/CommentScopeBar.js
//
// Dizi yorumlarının üst filtre çubuğu.
//
//   satır 1 → [Tümü] [Dizi] [S1] [S2] …            + tam kapsam sayfası butonu
//   satır 2 → (bir sezon seçiliyken) [Tümü] [Sezon geneli] [B1] [B4] … [Bölüm seç]
//
// Çipler "var olanı" gösterir: satır 2'de yalnız YORUMU BULUNAN bölümler
// listelenir (24 bölümlük bir sezonda çip yığını olmasın); bütün bölüm ağacı
// CommentScopeSheet'tedir.

import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import {
  SCOPE_FILTER,
  ALL_SCOPE_FILTER,
  makeScopeFilter,
  seasonBucket,
} from "../../utils/commentScope";
import { i18nText } from "../../utils/i18nText";
import { scopeShortLabels, scopeFilterLabel } from "./scopeTexts";

const Chip = ({ theme, label, count, active, dimmed, icon, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={[
      styles.chip,
      { borderColor: theme.border, backgroundColor: theme.secondary },
      active && {
        borderColor: alpha(theme.accent, 0.55),
        backgroundColor: alpha(theme.accent, 0.16),
      },
      dimmed && !active && styles.chipDimmed,
    ]}
  >
    {icon ? (
      <Ionicons
        name={icon}
        size={12}
        color={active ? theme.text.primary : theme.text.muted}
      />
    ) : null}
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        styles.chipText,
        { color: active ? theme.text.primary : theme.text.muted },
      ]}
    >
      {label}
    </Text>
    {count != null && (
      <View
        style={[
          styles.chipCount,
          { backgroundColor: theme.primary },
          active && { backgroundColor: alpha(theme.accent, 0.3) },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.chipCountText,
            { color: active ? theme.text.primary : theme.text.muted },
          ]}
        >
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

export default function CommentScopeBar({
  theme,
  seasons = [],
  summary,
  value = ALL_SCOPE_FILTER,
  onChange,
  onOpenPicker,
}) {
  const short = scopeShortLabels();
  const activeSeason = value?.seasonNumber ?? null;
  const bucket = useMemo(
    () => seasonBucket(summary, activeSeason),
    [summary, activeSeason],
  );

  // Çipler yorumu OLAN bölümleri gösterir; seçili bölümün yorumu yoksa bile
  // çipi eklenir, yoksa aktif seçim satırda hiç görünmezdi.
  const episodeChips = useMemo(() => {
    const list = [...bucket.episodes];
    const selected = value?.type === SCOPE_FILTER.EPISODE ? value.episodeNumber : null;
    if (selected != null && !list.some((e) => e.episodeNumber === selected)) {
      list.push({ episodeNumber: selected, count: 0, title: null });
    }
    return list.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }, [bucket, value]);

  const seasonLabel = (seasonNumber) =>
    seasonNumber === 0
      ? i18nText("autoI18n.ozel_kisa", "Özel")
      : `${short.seasonPrefix}${seasonNumber}`;

  const select = (filter) => onChange?.(filter);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.rowContent}
        >
          <Chip
            theme={theme}
            label={i18nText("autoI18n.tumu", "Tümü")}
            count={summary?.total ?? 0}
            active={value?.type === SCOPE_FILTER.ALL}
            onPress={() => select({ ...ALL_SCOPE_FILTER })}
          />
          <Chip
            theme={theme}
            icon="tv"
            label={short.show}
            count={summary?.show ?? 0}
            active={value?.type === SCOPE_FILTER.SHOW}
            onPress={() => select(makeScopeFilter(SCOPE_FILTER.SHOW))}
          />
          {seasons.map((season) => {
            const b = seasonBucket(summary, season.seasonNumber);
            return (
              <Chip
                key={`scope-season-${season.seasonNumber}`}
                theme={theme}
                label={seasonLabel(season.seasonNumber)}
                count={b.total}
                dimmed={b.total === 0}
                active={activeSeason === season.seasonNumber}
                onPress={() =>
                  select(makeScopeFilter(SCOPE_FILTER.SEASON, season.seasonNumber))
                }
              />
            );
          })}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenPicker}
          style={[
            styles.pickerButton,
            { borderColor: theme.border, backgroundColor: theme.secondary },
          ]}
          hitSlop={6}
        >
          <Ionicons name="options-outline" size={16} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      {activeSeason != null && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.rowContent, styles.subRowContent]}
        >
          <Chip
            theme={theme}
            label={i18nText("autoI18n.tumu", "Tümü")}
            count={bucket.total}
            active={value?.type === SCOPE_FILTER.SEASON}
            onPress={() =>
              select(makeScopeFilter(SCOPE_FILTER.SEASON, activeSeason))
            }
          />
          <Chip
            theme={theme}
            icon="albums"
            label={i18nText("autoI18n.sezon_geneli", "Sezon geneli")}
            count={bucket.seasonOnly}
            active={value?.type === SCOPE_FILTER.SEASON_ONLY}
            onPress={() =>
              select(makeScopeFilter(SCOPE_FILTER.SEASON_ONLY, activeSeason))
            }
          />
          {episodeChips.map((episode) => (
            <Chip
              key={`scope-episode-${activeSeason}-${episode.episodeNumber}`}
              theme={theme}
              label={`${short.episodePrefix}${episode.episodeNumber}`}
              count={episode.count}
              dimmed={episode.count === 0}
              active={
                value?.type === SCOPE_FILTER.EPISODE &&
                value?.episodeNumber === episode.episodeNumber
              }
              onPress={() =>
                select(
                  makeScopeFilter(
                    SCOPE_FILTER.EPISODE,
                    activeSeason,
                    episode.episodeNumber,
                  ),
                )
              }
            />
          ))}
          <Chip
            theme={theme}
            icon="search"
            label={i18nText("autoI18n.bolum_sec", "Bölüm seç")}
            onPress={onOpenPicker}
          />
        </ScrollView>
      )}

      {/* Seçili kapsamın tam adı — "S3" çipinin ne olduğu okunur kalsın. */}
      {value?.type !== SCOPE_FILTER.ALL && (
        <View style={styles.activeRow}>
          <Ionicons name="funnel" size={11} color={theme.accent} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.activeText, { color: theme.text.secondary }]}
          >
            {scopeFilterLabel(value)}
          </Text>
          <TouchableOpacity
            onPress={() => select({ ...ALL_SCOPE_FILTER })}
            hitSlop={8}
            style={styles.clearButton}
          >
            <Text
              allowFontScaling={false}
              style={[styles.clearText, { color: theme.accent }]}
            >
              {i18nText("autoI18n.filtreyi_temizle", "Filtreyi temizle")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 10, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 15 },
  rowContent: { gap: 8, paddingHorizontal: 15, alignItems: "center" },
  subRowContent: { paddingRight: 15 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipDimmed: { opacity: 0.45 },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountText: { fontSize: 10, fontWeight: "800" },

  pickerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
  },
  activeText: { flex: 1, fontSize: 11, fontWeight: "600" },
  clearButton: { paddingVertical: 2, paddingHorizontal: 4 },
  clearText: { fontSize: 11, fontWeight: "800" },
});

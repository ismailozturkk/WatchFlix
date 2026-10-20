// components/cineswipe/CineFilterSheet.js
//
// Solo deste filtreleme sayfası: kaynak, içerik türü, tür.
//
// Eski sürümdeki tutarsızlıklar giderildi:
//  • Tek türlü kaynak (Popüler Diziler…) içerik türünü kilitler; önceden
//    "Filmler" seçili görünürken diziler geliyordu.
//  • Tür filtresi artık TÜM kaynaklarda çalışır (önceden "hazır uç" kaynaklarda
//    sessizce yok sayılıyordu); diziyle uyumsuz türler pasif gösterilir.
//  • Taslak her açılışta geçerli filtrelerden başlar; eski sürümde uygulanmadan
//    kapatılan seçimler state'te kalıp sonraki açılışta uygulanmış gibi görünüyordu.
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import CineSheet from "./CineSheet";
import CineSegmented from "./CineSegmented";
import PressableScale from "./PressableScale";
import { CategoryGrid, GenreChips, Hint, SectionLabel } from "./CineFilterFields";
import { describeFilters, typeIcon, typeLabel } from "./filterLabels";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useTheme } from "../../context/ThemeContext";
import { triggerHaptic } from "../../services/hapticsService";
import {
  DEFAULT_FILTERS,
  MEDIA_TYPE_OPTIONS,
  SWIPE_CATEGORIES,
  categoryOf,
  normalizeFilters,
} from "../../services/cineswipe/deckModel";

export default function CineFilterSheet({ visible, onClose, filters, onApply }) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();
  const [draft, setDraft] = useState(() => normalizeFilters(filters));

  useEffect(() => {
    if (visible) setDraft(normalizeFilters(filters));
  }, [visible, filters]);

  const category = categoryOf(draft.category);
  const typeLocked = !!category.mediaType;
  const genresAvailable = category.genres !== false;

  const change = (patch) => setDraft((current) => normalizeFilters({ ...current, ...patch }));
  const selectCategory = (id) => change(id === "watchlist" ? { category: id, mediaType: "all" } : { category: id });

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    triggerHaptic("selection");
    setDraft(normalizeFilters(DEFAULT_FILTERS));
  };

  const summary = describeFilters(draft, copy)
    .map((part) => part.label)
    .join(" · ");

  const typeOptions = MEDIA_TYPE_OPTIONS.map((option) => ({
    id: option.id,
    icon: typeIcon(option.id),
    label: typeLabel(option.id, copy),
  }));

  return (
    <CineSheet
      visible={visible}
      onClose={onClose}
      icon="options-outline"
      title={copy.filters.title}
      subtitle={copy.filters.subtitle}
      headerRight={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.filters.reset}
          hitSlop={8}
          onPress={handleReset}
          style={styles.reset}
        >
          <Text style={[styles.resetText, { color: colors.accent }]}>{copy.filters.reset}</Text>
        </PressableScale>
      }
      footer={
        <View style={styles.footer}>
          <Text numberOfLines={1} style={[styles.summary, { color: colors.textSecondary }]}>
            {summary}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.filters.apply}
            onPress={handleApply}
            style={[styles.apply, { backgroundColor: colors.accent }]}
          >
            <AppIcon family="Ionicons" name="checkmark-circle" size={20} color={colors.onAccent} />
            <Text style={[styles.applyText, { color: colors.onAccent }]}>{copy.filters.apply}</Text>
          </PressableScale>
        </View>
      }
    >
      <SectionLabel colors={colors} style={styles.firstSection}>
        {copy.filters.source}
      </SectionLabel>
      <CategoryGrid
        categories={SWIPE_CATEGORIES}
        value={draft.category}
        onChange={selectCategory}
        copy={copy}
        colors={colors}
      />

      <SectionLabel colors={colors}>{copy.filters.contentType}</SectionLabel>
      <CineSegmented
        options={typeOptions}
        value={draft.mediaType}
        onChange={(id) => change({ mediaType: id })}
        disabled={typeLocked}
        colors={colors}
      />
      {typeLocked ? <Hint colors={colors}>{copy.filters.typeLocked}</Hint> : null}

      <SectionLabel colors={colors}>{copy.filters.genre}</SectionLabel>
      <GenreChips
        value={draft.genreId}
        onChange={(id) => change({ genreId: id })}
        mediaType={draft.mediaType}
        disabled={!genresAvailable}
        copy={copy}
        colors={colors}
      />
      {!genresAvailable ? (
        <Hint colors={colors}>{copy.filters.genreUnavailableSource}</Hint>
      ) : draft.mediaType === "tv" ? (
        <Hint colors={colors}>{copy.filters.genreUnavailableTv}</Hint>
      ) : null}
    </CineSheet>
  );
}

const styles = StyleSheet.create({
  firstSection: {
    marginTop: 2,
  },
  reset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  footer: {
    paddingTop: 10,
    gap: 8,
  },
  summary: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  apply: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 17,
  },
  applyText: {
    fontSize: 15.5,
    fontWeight: "900",
  },
});

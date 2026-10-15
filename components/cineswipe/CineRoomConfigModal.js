// components/cineswipe/CineRoomConfigModal.js
//
// Duo oda kurulumu: kart sayısı, içerik havuzu, içerik türü ve tür.
// Eski sürüm yalnız sayı + kaynak soruyordu; içerik türü ve tür seçimi de eklendi
// (servis zaten `mediaType`/`genreId` alanlarını belgeliyordu ama hiç iletilmiyordu).
// Son seçim oturum boyunca hatırlanır: bileşen sürekli bağlı, taslak state'te kalır.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import CineSheet from "./CineSheet";
import CineSegmented from "./CineSegmented";
import PressableScale from "./PressableScale";
import { CategoryGrid, CountChips, GenreChips, Hint, SectionLabel } from "./CineFilterFields";
import { describeFilters, typeIcon, typeLabel } from "./filterLabels";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useTheme } from "../../context/ThemeContext";
import { triggerHaptic } from "../../services/hapticsService";
import {
  CARD_COUNT_OPTIONS,
  MEDIA_TYPE_OPTIONS,
  SWIPE_CATEGORIES,
  categoryOf,
  fillText,
  normalizeFilters,
} from "../../services/cineswipe/deckModel";

// Odada izleme listesi kaynağı yok: iki kişinin ortak destesi ev sahibinin listesi olamaz.
const ROOM_CATEGORIES = SWIPE_CATEGORIES.filter((category) => category.id !== "watchlist");
const INITIAL_FILTERS = { category: "trending", mediaType: "all", genreId: null };

export default function CineRoomConfigModal({ visible, onClose, onConfirmCreate }) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();
  const [count, setCount] = useState(20);
  const [draft, setDraft] = useState(INITIAL_FILTERS);

  const category = categoryOf(draft.category);
  const typeLocked = !!category.mediaType;
  const change = (patch) => setDraft((current) => normalizeFilters({ ...current, ...patch }));

  const handleCreate = () => {
    triggerHaptic("impact");
    onConfirmCreate({ targetCardsCount: count, ...draft });
    onClose();
  };

  const typeOptions = MEDIA_TYPE_OPTIONS.map((option) => ({
    id: option.id,
    icon: typeIcon(option.id),
    label: typeLabel(option.id, copy),
  }));
  const summary = describeFilters(draft, copy)
    .map((part) => part.label)
    .join(" · ");

  return (
    <CineSheet
      visible={visible}
      onClose={onClose}
      icon="people"
      title={copy.roomConfig.title}
      subtitle={copy.roomConfig.subtitle}
      maxHeight="90%"
      footer={
        <View style={styles.footer}>
          <Text numberOfLines={1} style={[styles.summary, { color: colors.textSecondary }]}>
            {fillText(copy.roomConfig.summary, { count, filters: summary })}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.roomConfig.create}
            onPress={handleCreate}
            style={[styles.create, { backgroundColor: colors.accent }]}
          >
            <AppIcon family="Ionicons" name="arrow-forward-circle" size={21} color={colors.onAccent} />
            <Text style={[styles.createText, { color: colors.onAccent }]}>{copy.roomConfig.create}</Text>
          </PressableScale>
        </View>
      }
    >
      <SectionLabel colors={colors} style={styles.firstSection}>
        {copy.roomConfig.cardCount}
      </SectionLabel>
      <CountChips
        options={CARD_COUNT_OPTIONS}
        value={count}
        onChange={setCount}
        format={(option) => fillText(copy.roomConfig.cardsUnit, { n: option })}
        colors={colors}
      />

      <SectionLabel colors={colors}>{copy.roomConfig.source}</SectionLabel>
      <CategoryGrid
        categories={ROOM_CATEGORIES}
        value={draft.category}
        onChange={(id) => change({ category: id })}
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
        copy={copy}
        colors={colors}
      />
      {draft.mediaType === "tv" ? <Hint colors={colors}>{copy.filters.genreUnavailableTv}</Hint> : null}
    </CineSheet>
  );
}

const styles = StyleSheet.create({
  firstSection: {
    marginTop: 2,
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
  create: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 17,
  },
  createText: {
    fontSize: 15.5,
    fontWeight: "900",
  },
});

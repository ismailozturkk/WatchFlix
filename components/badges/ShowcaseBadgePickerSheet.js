// components/badges/ShowcaseBadgePickerSheet.js
//
// Profil düzenleme modunda vitrin rozeti seçici: kazanılmış (açık) rozetler
// ızgarası. Dokunmak vitrine ekler / vitrindeyse çıkarır; vitrin doluyken seçili
// olmayanlar söner. Seçimler ANINDA taslağa yazılır ve sayfa açık kalır (dört
// rozet arka arkaya seçilebilsin) — kalıcılık Kaydet'te (hooks/useOwnProfileEditor).
//
// Rozet ekranındaki (WatchBadgesScreen) vitrin seçim kipinin profil içi eşi; o
// ekran rozet kataloğunun tamamını gösterir, burası yalnız seçmek içindir.

import React, { memo, useCallback, useMemo } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassPressable from "@components/common/GlassPressable";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import { RARITY_ORDER, kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { alpha } from "@theme/colors";
import { copyLanguage } from "@utils/appLanguages";
import {
  MAX_SHOWCASE_BADGES,
  isBadgeInShowcase,
  sortUnlockedWithShowcaseFirst,
  toggleShowcaseBadge,
} from "@utils/badgeShowcase";
import { getBadgeShowcaseCopy } from "@utils/badgeShowcaseCopy";
import { i18nText } from "@utils/i18nText";
import * as Haptics from "@services/hapticsService";
import { badgeAd } from "./watchBadgeCatalog";
import { nadirlikAdi } from "./badgeFormat";

const COLUMNS = 4;

const BadgeCell = memo(function BadgeCell({ badge, selected, dimmed, lang, theme, onPress }) {
  const nadirlik = rarityStyle(badge.rarity, theme);
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || nadirlik.color;
  const ad = badgeAd(badge, lang);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: dimmed }}
      accessibilityLabel={`${ad}, ${nadirlikAdi(badge.rarity, lang)}`}
      onPress={() => onPress(badge)}
      style={[
        styles.cell,
        {
          opacity: dimmed ? 0.38 : 1,
          backgroundColor: selected ? alpha(vurgu, 0.16) : alpha(theme.secondary, 0.9),
          borderColor: selected ? vurgu : alpha(theme.border, 0.9),
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {selected ? (
        <View style={[styles.check, { backgroundColor: vurgu }]}>
          <Ionicons name="checkmark" size={11} color="#fff" />
        </View>
      ) : null}
      <AppBadge
        glyph={badge.icon}
        glyphSolid={badge.iconSolid}
        rarity={badge.rarity}
        unlocked
        size={40}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[styles.cellTitle, { color: theme.text.primary }]}
      >
        {ad}
      </Text>
    </TouchableOpacity>
  );
});

export default function ShowcaseBadgePickerSheet({ visible, value, onChange, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);
  const copy = getBadgeShowcaseCopy(lang);
  const kartlar = useWatchProgressContext()?.kartlar;
  const ids = Array.isArray(value) ? value : [];
  const full = ids.length >= MAX_SHOWCASE_BADGES;

  // Sıra sayfa açıkken sabit: seçtikçe kartlar yer değiştirmesin.
  const unlocked = useMemo(
    () =>
      sortUnlockedWithShowcaseFirst(
        (Array.isArray(kartlar) ? kartlar : []).filter((k) => k?.acik),
        [],
        RARITY_ORDER,
      ),
    [kartlar],
  );

  const onPress = useCallback(
    (badge) => {
      const res = toggleShowcaseBadge(ids, badge);
      if (res.action === "added" || res.action === "removed") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onChange(res.next);
      }
    },
    [ids, onChange],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const selected = isBadgeInShowcase(ids, item);
      return (
        <View style={styles.cellWrap}>
          <BadgeCell
            badge={item}
            selected={selected}
            dimmed={full && !selected}
            lang={lang}
            theme={theme}
            onPress={onPress}
          />
        </View>
      );
    },
    [ids, full, lang, theme, onPress],
  );

  const doneLabel = copy.done;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name="ribbon-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.headerTitle, { color: theme.text.primary }]}>
            {copy.cardTitle}
          </Text>
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.headerSub, { color: full ? theme.accent : theme.text.muted }]}>
            {full ? copy.showcaseFullTitle : `${ids.length}/${MAX_SHOWCASE_BADGES} · ${copy.cardSubtitle}`}
          </Text>
        </View>
        <GlassPressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={doneLabel}
          style={[styles.done, { backgroundColor: theme.accent }]}
        >
          <Text allowFontScaling={false} style={styles.doneText}>{doneLabel}</Text>
        </GlassPressable>
      </View>

      <FlatList
        data={unlocked}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        renderItem={renderItem}
        extraData={ids}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={unlocked.length ? styles.list : styles.emptyList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="ribbon-outline" size={30} color={theme.text.muted} />
            <Text allowFontScaling={false} style={[styles.emptyText, { color: theme.text.muted }]}>
              {i18nText("autoI18n.vitrin_rozet_yok", "Henüz kazanılmış rozetin yok. İzledikçe açılacaklar.")}
            </Text>
          </View>
        }
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "86%",
    minHeight: "50%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSub: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  done: { paddingHorizontal: 16, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  list: { paddingBottom: 24, gap: 8 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  columns: { gap: 8 },
  cellWrap: { flex: 1 / COLUMNS },
  cell: {
    borderRadius: 16,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    minHeight: 104,
    overflow: "hidden",
  },
  check: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cellTitle: { marginTop: 6, fontSize: 10.5, lineHeight: 13, fontWeight: "800", textAlign: "center" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 30, paddingHorizontal: 20 },
  emptyText: { fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18 },
});

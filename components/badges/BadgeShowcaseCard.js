// components/badges/BadgeShowcaseCard.js
//
// 6 rozetlik "Profil Vitrini" bileşenleri:
//   1. BadgeShowcaseEditorCard → Rozetler ekranında (WatchBadgesScreen) 6 yuvayı
//      gösterir, boş yuvaya dokununca seçim kipini açar, dolu yuvadan çıkarmaya
//      veya detaya gitmeye izin verir.
//   2. FriendBadgeShowcase     → Arkadaş profilinde (FriendProfileScreen) kullanıcının
//      seçtiği 1–6 rozeti sergiler; dokununca detay sayfası açılır.
//      `editing` (kendi profil önizlemesinin düzenleme modu): 6 yuva —
//      dolu yuvanın köşesinde "×", boş yuvada "+" (dokununca seçici açılır).

import React, { memo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import GlassTouchable from "@components/common/GlassTouchable";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { withAlpha } from "@components/profile/StatsComponents";
import { copyLanguage } from "@utils/appLanguages";
import { MAX_SHOWCASE_BADGES } from "@utils/badgeShowcase";
import { getBadgeShowcaseCopy } from "@utils/badgeShowcaseCopy";
import { badgeAd } from "./watchBadgeCatalog";
import { nadirlikAdi } from "./badgeFormat";

function ShowcaseSlot({
  badge,
  lang,
  theme,
  editing = false,
  onPressBadge,
  onRemove,
  onPressEmpty,
  copy,
}) {
  if (!badge) {
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={copy.emptySlot}
        onPress={onPressEmpty}
        style={[
          styles.slot,
          styles.emptySlot,
          {
            backgroundColor: withAlpha(theme.primary, 0.45),
            borderColor: editing ? withAlpha(theme.accent, 0.55) : withAlpha(theme.border, 0.9),
          },
        ]}
      >
        <View
          style={[
            styles.emptyHex,
            {
              backgroundColor: withAlpha(theme.accent, editing ? 0.16 : 0.09),
              borderColor: withAlpha(theme.accent, editing ? 0.48 : 0.26),
            },
          ]}
        >
          <AppIcon
            family="Ionicons"
            name="add"
            size={20}
            color={editing ? theme.accent : theme.text.muted}
          />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[
            styles.emptyLabel,
            { color: editing ? theme.accent : theme.text.muted },
          ]}
        >
          {copy.emptySlot}
        </Text>
      </TouchableOpacity>
    );
  }

  const nadirlik = rarityStyle(badge.rarity, theme);
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || nadirlik.color;
  const ad = badgeAd(badge, lang);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${ad}, ${nadirlikAdi(badge.rarity, lang)}`}
      onPress={() => onPressBadge?.(badge)}
      style={[
        styles.slot,
        {
          backgroundColor: withAlpha(theme.primary, 0.58),
          borderColor: withAlpha(vurgu, 0.48),
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(vurgu, 0.22), withAlpha(vurgu, 0)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.slotWash}
      />

      {onRemove ? (
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={copy.removeSlotA11y(ad)}
          onPress={() => onRemove(badge)}
          style={[
            styles.removeBtn,
            {
              backgroundColor: theme.secondary,
              borderColor: withAlpha(theme.border, 0.95),
            },
          ]}
        >
          <AppIcon family="Ionicons" name="close" size={11} color={theme.text.muted} />
        </TouchableOpacity>
      ) : null}

      <AppBadge
        glyph={badge.icon}
        glyphSolid={badge.iconSolid}
        rarity={badge.rarity}
        unlocked
        size={46}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate}
      />

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[styles.slotTitle, { color: theme.text.primary }]}
      >
        {ad}
      </Text>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.slotSub, { color: vurgu }]}
      >
        {nadirlikAdi(badge.rarity, lang)}
      </Text>
    </TouchableOpacity>
  );
}

export const BadgeShowcaseEditorCard = memo(function BadgeShowcaseEditorCard({
  badges = [],
  editing = false,
  onToggleEditing,
  onPressBadge,
  onRemoveBadge,
  onPressEmptySlot,
  style,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de", "it", "fr", "ja"]);
  const copy = getBadgeShowcaseCopy(lang);

  const slots = Array.from({ length: MAX_SHOWCASE_BADGES }, (_, i) => badges[i] || null);

  return (
    <View
      style={[
        styles.editorCard,
        {
          backgroundColor: theme.secondary,
          borderColor: editing ? withAlpha(theme.accent, 0.65) : theme.border,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: withAlpha(theme.accent, 0.15) }]}>
              <AppIcon family="Ionicons" name="sparkles" size={14} color={theme.accent} />
            </View>
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: theme.text.primary }]}>
              {copy.cardTitle}
            </Text>
            <View
              style={[
                styles.countPill,
                {
                  backgroundColor: withAlpha(theme.accent, 0.14),
                  borderColor: withAlpha(theme.accent, 0.35),
                },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.countPillText, { color: theme.accent }]}>
                {badges.length}/{MAX_SHOWCASE_BADGES}
              </Text>
            </View>
          </View>
          <Text allowFontScaling={false} style={[styles.cardSubtitle, { color: theme.text.muted }]}>
            {editing ? copy.selectingHint : copy.cardSubtitle}
          </Text>
        </View>

        {onToggleEditing ? (
          <GlassTouchable
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ selected: editing }}
            onPress={onToggleEditing}
            style={[
              styles.editBtn,
              {
                backgroundColor: editing ? theme.accent : withAlpha(theme.accent, 0.14),
                borderColor: editing ? theme.accent : withAlpha(theme.accent, 0.38),
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={editing ? "checkmark" : "options-outline"}
              size={13}
              color={editing ? "#FFFFFF" : theme.accent}
            />
            <Text
              allowFontScaling={false}
              style={[styles.editBtnText, { color: editing ? "#FFFFFF" : theme.accent }]}
            >
              {editing ? copy.done : copy.edit}
            </Text>
          </GlassTouchable>
        ) : null}
      </View>

      <View style={styles.slotsRow}>
        {slots.map((badge, idx) => (
          <ShowcaseSlot
            key={badge?.id || `empty_${idx}`}
            badge={badge}
            lang={lang}
            theme={theme}
            editing={editing}
            onPressBadge={onPressBadge}
            onRemove={onRemoveBadge}
            onPressEmpty={onPressEmptySlot}
            copy={copy}
          />
        ))}
      </View>
    </View>
  );
});

export const FriendBadgeShowcase = memo(function FriendBadgeShowcase({
  badges = [],
  onPressBadge,
  editing = false,
  onRemoveBadge,
  onPressEmpty,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de", "it", "fr", "ja"]);
  const copy = getBadgeShowcaseCopy(lang);
  const list = Array.isArray(badges) ? badges.slice(0, MAX_SHOWCASE_BADGES) : [];
  const [rowWidth, setRowWidth] = useState(0);

  if (!editing && list.length === 0) return null;
  const emptyCount = editing ? MAX_SHOWCASE_BADGES - list.length : 0;
  const visibleCount = list.length + emptyCount;
  const tileSize = Math.min(58, Math.floor(((rowWidth || 300) - (visibleCount - 1) * 7) / visibleCount));
  const badgeSize = Math.min(42, tileSize - 8);

  return (
    <View style={styles.friendCard}>
      <View
        style={styles.friendRow}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          setRowWidth((current) => current === next ? current : next);
        }}
      >
        {list.map((badge) => {
          const nadirlik = rarityStyle(badge.rarity, theme);
          const sekil = kademeSekli(badge.tier, badge.aileToplam);
          const kadRenk = kademeRengi(sekil.kademe, theme);
          const vurgu = kadRenk || nadirlik.color;
          const ad = badgeAd(badge, lang);

          return (
            <TouchableOpacity
              key={badge.id}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${ad}, ${nadirlikAdi(badge.rarity, lang)}`}
              onPress={() => onPressBadge?.(badge)}
              style={[styles.friendTile, { width: tileSize, height: tileSize }]}
            >
              <View pointerEvents="none" style={[styles.friendHalo, { width: tileSize - 4, height: tileSize - 4, backgroundColor: withAlpha(vurgu, 0.11) }]} />
              {editing && onRemoveBadge ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={copy.removeSlotA11y(ad)}
                  onPress={() => onRemoveBadge(badge)}
                  style={[
                    styles.removeBtn,
                    styles.friendRemoveBtn,
                    { backgroundColor: theme.secondary, borderColor: withAlpha(theme.border, 0.95) },
                  ]}
                >
                  <AppIcon family="Ionicons" name="close" size={13} color={theme.text.primary} />
                </TouchableOpacity>
              ) : null}

              <AppBadge
                glyph={badge.icon}
                glyphSolid={badge.iconSolid}
                rarity={badge.rarity}
                unlocked
                size={badgeSize}
                sides={sekil.kenar}
                color={kadRenk}
                ornate={sekil.ornate}
              />
            </TouchableOpacity>
          );
        })}
        {Array.from({ length: emptyCount }, (_, idx) => (
          <TouchableOpacity
            key={`empty_${idx}`}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={copy.emptySlot}
            onPress={onPressEmpty}
              style={[styles.friendTile, { width: tileSize, height: tileSize }]}
          >
            <View
              style={[
                  styles.friendEmptyShape,
                {
                    width: badgeSize + 4,
                    height: badgeSize + 4,
                    backgroundColor: withAlpha(theme.accent, idx === 0 ? 0.11 : 0.05),
                    borderColor: withAlpha(theme.accent, idx === 0 ? 0.36 : 0.2),
                },
              ]}
            >
              <AppIcon
                family="Ionicons"
                name="add"
                size={20}
                color={idx === 0 ? theme.accent : theme.text.muted}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  editorCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  countPillText: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: "650",
    lineHeight: 16,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "850",
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slot: {
    width: "31%",
    flexGrow: 1,
    minWidth: 0,
    height: 108,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 8,
  },
  emptySlot: {
    borderStyle: "dashed",
    gap: 7,
  },
  emptyHex: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
  },
  slotWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "70%",
  },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  slotTitle: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: "850",
    textAlign: "center",
    alignSelf: "stretch",
  },
  slotSub: {
    marginTop: 1.5,
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
  },
  friendCard: {
    marginBottom: 8,
  },
  friendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  friendTile: {
    alignItems: "center",
    justifyContent: "center",
  },
  friendHalo: { position: "absolute", width: 54, height: 54, borderRadius: 18 },
  friendEmptyShape: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    borderStyle: "dashed",
    justifyContent: "center",
  },
  friendRemoveBtn: { width: 22, height: 22, borderRadius: 11 },
});

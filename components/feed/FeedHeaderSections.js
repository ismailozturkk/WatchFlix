// components/feed/FeedHeaderSections.js
//
// Paylaşım akışının (ShareContentScreen) ÜST bölümü: composer kartı, "Postlarım"
// bağlantısı, trend rayı, filtre ve sıralama çubukları. Hepsi saf sunum —
// veri/durum ekranda kalır, buraya yalnız prop gelir. Yüzeyler tema
// token'larından (secondary/primary/border/accent) kurulur; sabit renk yok,
// bu yüzden açık ve koyu temalarda aynı kompozisyon çalışır.

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import UserAvatar from "../common/UserAvatar";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { postTypeMeta } from "./postTypeMeta";
import GlassPressable from "../common/GlassPressable";

export const FEED_FILTERS = {
  ALL: "all",
  REVIEW: "review",
  LIST: "list",
  TEXT: "text",
  POLL: "poll",
  FOLLOWING: "following",
};

// Composer'daki hızlı tip kutularının sırası + kısa etiketleri (Hub'daki
// paylaşım widget'ıyla aynı anahtarlar).
const COMPOSE_TYPES = [
  { key: "review", labelKey: "autoI18n.inceleme", fallback: "İnceleme" },
  { key: "list", labelKey: "autoI18n.liste_2", fallback: "Liste" },
  { key: "text", labelKey: "autoI18n.sohbet", fallback: "Sohbet" },
  { key: "poll", labelKey: "autoI18n.anket", fallback: "Anket" },
];

// ─── Composer kartı ──────────────────────────────────────────────────────────

export const FeedComposerCard = memo(function FeedComposerCard({
  theme,
  avatar,
  placeholder,
  onOpen,
  onCompose,
}) {
  const accent = theme.accent;

  return (
    <View
      style={[
        s.shadow,
        { shadowColor: theme.shadow || "#000", backgroundColor: theme.secondary },
      ]}
    >
      <View
        style={[
          s.composerCard,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeholder}
          onPress={onOpen}
          style={s.composerRow}
        >
          {avatar ? (
            <UserAvatar
              source={avatar}
              size={42}
              borderWidth={2}
              borderColor={alpha(accent, 0.45)}
            />
          ) : (
            <View
              style={[
                s.avatarFallback,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              <AppIcon
                family="Ionicons"
                name="person"
                size={20}
                color={theme.text.muted}
              />
            </View>
          )}

          <View
            style={[
              s.promptPill,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            <Text
              style={[s.promptText, { color: theme.text.muted }]}
              numberOfLines={1}
            >
              {placeholder}
            </Text>
          </View>

          <LinearGradient
            colors={[accent, alpha(accent, 0.72)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.plusBtn}
          >
            <AppIcon family="Ionicons" name="add" size={24} color="#fff" />
          </LinearGradient>
        </Pressable>

        <View style={s.tileRow}>
          {COMPOSE_TYPES.map((item) => {
            const meta = postTypeMeta(item.key, theme.colors);
            return (
              <GlassPressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => onCompose(item.key)}
                style={({ pressed }) => [
                  s.tile,
                  {
                    backgroundColor: alpha(meta.color, pressed ? 0.18 : 0.09),
                    borderColor: alpha(meta.color, 0.24),
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    s.tileIcon,
                    { backgroundColor: alpha(meta.color, 0.18) },
                  ]}
                >
                  <AppIcon
                    family="Ionicons"
                    name={meta.icon}
                    size={16}
                    color={meta.color}
                  />
                </View>
                <Text
                  style={[s.tileText, { color: theme.text.primary }]}
                  numberOfLines={1}
                >
                  {i18nText(item.labelKey, item.fallback)}
                </Text>
              </GlassPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
});

// ─── Postlarım bağlantısı ────────────────────────────────────────────────────

export const MyPostsLink = memo(function MyPostsLink({
  theme,
  title,
  subtitle,
  onPress,
}) {
  const accent = theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        s.linkCard,
        {
          backgroundColor: pressed ? alpha(accent, 0.1) : theme.secondary,
          borderColor: pressed ? alpha(accent, 0.4) : theme.border,
        },
      ]}
    >
      <LinearGradient
        colors={[accent, alpha(accent, 0.7)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.linkIcon}
      >
        <AppIcon family="Ionicons" name="albums" size={19} color="#fff" />
      </LinearGradient>
      <View style={s.linkCopy}>
        <Text style={[s.linkTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[s.linkSub, { color: theme.text.secondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={[s.linkChevron, { backgroundColor: theme.primary }]}>
        <AppIcon
          family="Ionicons"
          name="chevron-forward"
          size={16}
          color={theme.text.secondary}
        />
      </View>
    </Pressable>
  );
});

// ─── Trend rayı ──────────────────────────────────────────────────────────────

const TREND_CARD_WIDTH = 124;
const TREND_GAP = 12;

export const FeedTrendingRail = memo(function FeedTrendingRail({
  theme,
  label,
  data,
  onPressItem,
}) {
  const fire = theme.colors?.orange || "#F97316";
  const accent = theme.accent;

  const renderItem = useCallback(
    ({ item, index }) => {
      const top = index < 3;
      return (
        <Pressable
          onPress={() => onPressItem?.(item)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={({ pressed }) => [
            s.trendCard,
            {
              borderColor: theme.border,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Image
            source={{ uri: item.poster }}
            style={s.trendPoster}
            contentFit="cover"
            recyclingKey={`trending-${item.id}`}
            cachePolicy="memory-disk"
            transition={120}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.38)", "transparent"]}
            style={s.trendTopFade}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.9)"]}
            style={s.trendBottomFade}
            pointerEvents="none"
          />
          <View
            style={[
              s.trendRank,
              { backgroundColor: top ? accent : "rgba(0,0,0,0.55)" },
            ]}
          >
            <Text style={s.trendRankText}>{index + 1}</Text>
          </View>
          <View style={s.trendKind}>
            <AppIcon
              family="Ionicons"
              name={item.media_type === "tv" ? "tv" : "film"}
              size={11}
              color="#fff"
            />
          </View>
          <Text style={s.trendTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </Pressable>
      );
    },
    [theme.border, accent, onPressItem],
  );

  if (!data || data.length === 0) return null;

  return (
    <View style={s.trendWrap}>
      <View style={s.trendHeader}>
        <View style={[s.trendFire, { backgroundColor: alpha(fire, 0.16) }]}>
          <AppIcon
            family="MaterialCommunityIcons"
            name="fire"
            size={18}
            color={fire}
          />
        </View>
        <Text style={[s.trendLabel, { color: theme.text.primary }]} numberOfLines={1}>
          {label}
        </Text>
        <View
          style={[
            s.trendCaption,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Text style={[s.trendCaptionText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.feed_bu_hafta", "Bu hafta")}
          </Text>
        </View>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        decelerationRate="fast"
        snapToInterval={TREND_CARD_WIDTH + TREND_GAP}
        contentContainerStyle={{ paddingHorizontal: 16, gap: TREND_GAP }}
      />
    </View>
  );
});

// ─── Filtre çubuğu (tek satır, yatay kaydırılır) ─────────────────────────────

export const FeedFilterBar = memo(function FeedFilterBar({
  theme,
  t,
  active,
  onChange,
}) {
  const items = [
    { key: FEED_FILTERS.ALL, label: t.filters.all, icon: "apps" },
    { key: FEED_FILTERS.REVIEW, label: t.filters.reviews, icon: "star" },
    { key: FEED_FILTERS.LIST, label: t.filters.lists, icon: "list" },
    { key: FEED_FILTERS.TEXT, label: t.filters.texts, icon: "chatbubble-ellipses" },
    { key: FEED_FILTERS.POLL, label: t.filters.polls, icon: "stats-chart" },
    { key: FEED_FILTERS.FOLLOWING, label: t.filters.following, icon: "people" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.filterContent}
      style={s.filterScroll}
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <GlassPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              s.filterPill,
              {
                backgroundColor: isActive ? theme.accent : theme.secondary,
                borderColor: isActive ? theme.accent : theme.border,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
              isActive && {
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
                elevation: 3,
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={item.icon}
              size={14}
              color={isActive ? "#fff" : theme.text.secondary}
            />
            <Text
              style={[
                s.filterText,
                {
                  color: isActive ? "#fff" : theme.text.secondary,
                  fontWeight: isActive ? "800" : "600",
                },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </GlassPressable>
        );
      })}
    </ScrollView>
  );
});

// ─── Sıralama çubuğu (segmentli kontrol) ─────────────────────────────────────

export const FeedSortBar = memo(function FeedSortBar({
  theme,
  t,
  active,
  onChange,
}) {
  const items = [
    { key: "recent", label: t.sort?.recent || "Tarih", icon: "time" },
    { key: "likes", label: t.sort?.likes || "Beğeni", icon: "heart" },
    { key: "comments", label: t.sort?.comments || "Yorum", icon: "chatbubble" },
  ];

  return (
    <View style={s.sortRow}>
      <View style={s.sortLabelWrap}>
        <AppIcon
          family="Ionicons"
          name="swap-vertical"
          size={15}
          color={theme.text.muted}
        />
        <Text style={[s.sortLabel, { color: theme.text.muted }]} numberOfLines={1}>
          {t.sort?.label || "Sırala"}
        </Text>
      </View>
      <View
        style={[
          s.segTrack,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <GlassPressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(item.key)}
              style={[
                s.seg,
                isActive && {
                  backgroundColor: alpha(theme.accent, 0.16),
                  borderColor: alpha(theme.accent, 0.5),
                },
              ]}
            >
              <AppIcon
                family="Ionicons"
                name={item.icon}
                size={13}
                color={isActive ? theme.accent : theme.text.muted}
              />
              <Text
                style={[
                  s.segText,
                  {
                    color: isActive ? theme.accent : theme.text.secondary,
                    fontWeight: isActive ? "800" : "600",
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </GlassPressable>
          );
        })}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  // Composer
  shadow: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  composerCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  promptPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  promptText: { fontSize: 14, fontWeight: "600" },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tileRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontSize: 11.5, fontWeight: "700" },

  // Postlarım
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 14,
    marginBottom: 18,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCopy: { flex: 1, minWidth: 0 },
  linkTitle: { fontSize: 15, fontWeight: "800" },
  linkSub: { fontSize: 12, marginTop: 1 },
  linkChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Trend rayı
  trendWrap: { marginBottom: 18 },
  trendHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  trendFire: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendLabel: { flex: 1, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  trendCaption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendCaptionText: { fontSize: 11, fontWeight: "700" },
  trendCard: {
    width: TREND_CARD_WIDTH,
    height: 184,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendPoster: { width: "100%", height: "100%" },
  trendTopFade: { position: "absolute", left: 0, right: 0, top: 0, height: 56 },
  trendBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  trendRank: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  trendRankText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  trendKind: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  trendTitle: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    color: "#fff",
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "800",
  },

  // Filtre
  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterContent: { paddingHorizontal: 14, gap: 8, paddingVertical: 4 },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },

  // Sıralama
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  sortLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segTrack: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  seg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segText: { fontSize: 12 },
});

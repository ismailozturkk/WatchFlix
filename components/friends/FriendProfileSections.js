// components/friends/FriendProfileSections.js
//
// Arkadaş profil ekranının (screens/tabs/profile/FriendProfileScreen.js) görsel
// parçaları. Ekran veriyi ve mantığı yönetir (Firestore dinleyicileri, gizlilik,
// liste modalı); burası yalnız ÇİZER. Hepsi sunum bileşeni: veri hazır gelir.
//
// Tasarım dili (friendsTokens + PillButton ile aynı set):
//   • Ortalanmış büyük "hero" — halkalı avatar, durum çipi, rozetler, bio. Üstte
//     kaydırmayla yukarı kayıp solan accent gradyanı; kartın çerçevesi yok.
//   • Üst çubukta isim tekrarı yok: isim yalnız hero'da büyük durur, aşağı
//     kaydırınca üst çubuğa süzülür.
//   • Sayaçlar tek parça şerit, istatistikler kendi renkli ikon karoları ve
//     çubuklarıyla: her şey aynı yüzey/yarıçap ritminde.

import React, { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import BackButton from "@components/BackButton";
import UserAvatar from "@components/common/UserAvatar";
import GlassIconButton from "@components/common/GlassIconButton";
import IdentityBadgesRow from "@components/badges/IdentityBadgesRow";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import { FRIEND_GREEN } from "./friendsTokens";

const AVATAR_SIZE = 100;
// UserAvatar squircle yarıçapı `round(size * 0.33)`; halka onun etrafında
// padding + çerçeve kadar büyür ki iç içe köşeler paralel dursun.
const RING_PADDING = 5;
const RING_BORDER = 2;
const RING_RADIUS = Math.round(AVATAR_SIZE * 0.33) + RING_PADDING + RING_BORDER;

// Backdrop'un kaydırmayla sönme / yukarı kayma mesafesi.
const BACKDROP_HEIGHT = 340;
const BACKDROP_FADE_AT = 260;
// Üst çubuk başlığı hero'daki isim ekrandan çıkarken belirir.
const TITLE_FADE_FROM = 96;
const TITLE_FADE_TO = 150;

const ListIcon = ({ name, iconLib, color, size = 16 }) => {
  if (iconLib === "mci") return <MaterialCommunityIcons name={name} size={size} color={color} />;
  if (iconLib === "feather") return <Feather name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

// ── Arka plan gradyanı ───────────────────────────────────────────────────────
// Ekranın en üstünden (durum çubuğu dahil) başlar; kaydırınca yarı hızda yukarı
// kayıp söner. `scrollY` native sürücüyle bağlı: JS iş parçacığına yük bindirmez.
export function ProfileBackdrop({ scrollY }) {
  const { theme } = useTheme();
  const motion = scrollY
    ? {
        opacity: scrollY.interpolate({
          inputRange: [0, BACKDROP_FADE_AT],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, BACKDROP_FADE_AT],
              outputRange: [0, -70],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : null;

  return (
    <Animated.View pointerEvents="none" style={[styles.backdrop, motion]}>
      <LinearGradient
        colors={[alpha(theme.accent, 0.34), alpha(theme.accent, 0.1), alpha(theme.accent, 0)]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── Üst çubuk ────────────────────────────────────────────────────────────────
// Geri · (kaydırınca beliren isim) · ⋯. `scrollY` verilmezse başlık hep görünür
// (yükleniyor / bulunamadı durumlarında hero yok, isim üst çubukta kalmalı).
export function ProfileTopBar({ title, scrollY, onMore, moreLabel }) {
  const { theme } = useTheme();
  const titleOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [TITLE_FADE_FROM, TITLE_FADE_TO],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  return (
    <View style={styles.topBar}>
      <BackButton absolute={false} />
      <Animated.View style={[styles.topTitleWrap, { opacity: titleOpacity }]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.topTitle, { color: theme.text?.primary ?? "#fff" }]}
        >
          {title}
        </Text>
      </Animated.View>
      {onMore ? (
        <GlassIconButton
          icon="ellipsis-horizontal"
          iconSize={18}
          size={40}
          fallbackRadius={12}
          color={theme.text?.primary ?? "#fff"}
          accessibilityLabel={moreLabel}
          onPress={onMore}
        />
      ) : (
        <View style={styles.topButton} />
      )}
    </View>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
// `presence` = { online, text } | null. null → durum çipi çizilmez (gizlilik
// ayarı yüzünden çevrimiçi bilgisi bu izleyiciye gösterilmiyor).
export const ProfileHero = memo(function ProfileHero({
  avatarIndex,
  photoURL,
  onAvatarPress,
  onAvatarLongPress,
  name,
  username,
  online,
  presence,
  badges,
  language,
  bio,
  memberSince,
}) {
  const { theme } = useTheme();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  const presenceColor = presence?.online ? FRIEND_GREEN : theme.text?.muted ?? "#888";

  return (
    <Animated.View
      style={[
        styles.hero,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.avatarRing,
          {
            borderColor: alpha(theme.accent, 0.5),
            backgroundColor: alpha(theme.accent, 0.1),
          },
        ]}
      >
        <UserAvatar
          avatarIndex={avatarIndex}
          photoURL={photoURL}
          size={AVATAR_SIZE}
          shape="squircle"
          iconRatio={0.794}
          onPress={onAvatarPress}
          onLongPress={onAvatarLongPress}
          delayLongPress={220}
        />
        {/* Çevrimiçi noktası avatarın DIŞINDA: UserAvatar kabı taşanı kırpar,
            squircle köşesinde nokta yarım görünürdü. */}
        {online ? (
          <View
            pointerEvents="none"
            style={[
              styles.onlineDot,
              { backgroundColor: FRIEND_GREEN, borderColor: theme.primary },
            ]}
          />
        ) : null}
      </View>

      <Text
        allowFontScaling={false}
        // Kullanıcının kendi yazdığı ad — ProfileScreen'deki eşiyle aynı
        // gerekçeyle başlık fontuna girmez (bkz. utils/typographyRoles.js).
        fontRole="body"
        numberOfLines={2}
        style={[styles.name, { color: theme.text?.primary ?? "#fff" }]}
      >
        {name}
      </Text>

      {username || presence ? (
        <View style={styles.identityRow}>
          {username ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.username, { color: theme.text?.secondary ?? "#aaa" }]}
            >
              @{username}
            </Text>
          ) : null}
          {presence ? (
            <View style={[styles.presenceChip, { backgroundColor: alpha(presenceColor, 0.14) }]}>
              <View style={[styles.presenceDot, { backgroundColor: presenceColor }]} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.presenceText, { color: presenceColor }]}
              >
                {presence.text}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <IdentityBadgesRow
        badges={badges}
        theme={theme}
        language={language}
        style={styles.badgesRow}
      />

      {bio ? (
        <Text
          numberOfLines={3}
          style={[styles.bio, { color: theme.text?.secondary ?? "#aaa" }]}
        >
          {bio}
        </Text>
      ) : null}

      {memberSince ? (
        <View style={styles.memberSince}>
          <Ionicons name="calendar-outline" size={12} color={theme.text?.muted ?? "#666"} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.memberSinceText, { color: theme.text?.muted ?? "#666" }]}
          >
            {memberSince}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

// ── Sayaç şeridi ─────────────────────────────────────────────────────────────
// items: [{ key, icon, label, value, color }]. Tek kap, aralarında ince ayraç
// (profil ekranındaki FriendsActionBar ile aynı ritim).
export const ProfileStatStrip = memo(function ProfileStatStrip({ items }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.statStrip,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? (
            <View style={[styles.statDivider, { backgroundColor: alpha(theme.border, 0.8) }]} />
          ) : null}
          <View
            style={styles.statCell}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              fontRole="numeric"
              style={[styles.statValue, { color: theme.text?.primary ?? "#fff" }]}
            >
              {item.value}
            </Text>
            <View style={styles.statLabelRow}>
              <Ionicons name={item.icon} size={12} color={item.color} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statLabel, { color: theme.text?.muted ?? "#666" }]}
              >
                {item.label}
              </Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
});

// ── Bölüm başlığı ────────────────────────────────────────────────────────────
export function SectionHeader({ title, trailing }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}
      >
        {title}
      </Text>
      {trailing || null}
    </View>
  );
}

// Başlığın sağındaki küçük sayı çipi (ör. "5 ⊞").
export function CountChip({ value, icon }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.countChip,
        { backgroundColor: alpha(theme.accent, 0.14) },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.countChipText, { color: theme.accent }]}>
        {value}
      </Text>
      {icon ? <Ionicons name={icon} size={13} color={theme.accent} /> : null}
    </View>
  );
}

// ── Toplam izleme süresi kartı ───────────────────────────────────────────────
export const WatchSummaryCard = memo(function WatchSummaryCard({
  caption,
  totalLabel,
  minutesLabel,
  movie,
  tv,
}) {
  const { theme } = useTheme();
  // movie/tv = { label, minutes, share, color }
  const hasSplit = movie.minutes + tv.minutes > 0;

  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.accent, 0.2), alpha(theme.accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.summaryTop}>
        <View style={styles.summaryCopy}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.summaryCaption, { color: theme.text?.secondary ?? "#aaa" }]}
          >
            {caption}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            fontRole="numeric"
            style={[styles.summaryValue, { color: theme.text?.primary ?? "#fff" }]}
          >
            {totalLabel}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.summaryMinutes, { color: theme.text?.muted ?? "#666" }]}
          >
            {minutesLabel}
          </Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: alpha(theme.accent, 0.18) }]}>
          <Ionicons name="time-outline" size={28} color={theme.accent} />
        </View>
      </View>

      <View style={[styles.splitTrack, { backgroundColor: theme.primary ?? "#111" }]}>
        {hasSplit && movie.minutes > 0 ? (
          <View style={[styles.splitSegment, { flexGrow: movie.minutes, backgroundColor: movie.color }]} />
        ) : null}
        {hasSplit && tv.minutes > 0 ? (
          <View style={[styles.splitSegment, { flexGrow: tv.minutes, backgroundColor: tv.color }]} />
        ) : null}
      </View>

      <View style={styles.splitLegend}>
        {[movie, tv].map((part) => (
          <View key={part.label} style={styles.splitItem}>
            <View style={[styles.splitDot, { backgroundColor: part.color }]} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.splitLabel, { color: theme.text?.secondary ?? "#aaa" }]}
            >
              {part.label}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.splitShare, { color: theme.text?.primary ?? "#fff" }]}
            >
              {part.share}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// ── 2×2 metrik karoları ──────────────────────────────────────────────────────
// items: [{ key, icon, iconLib, label, value, detail, color }]
export const WatchMetricGrid = memo(function WatchMetricGrid({ items }) {
  const { theme } = useTheme();
  return (
    <View style={styles.metricGrid}>
      {items.map((item) => (
        <View
          key={item.key}
          style={[
            styles.metricTile,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.metricTop}>
            <View style={[styles.metricIcon, { backgroundColor: alpha(item.color, 0.15) }]}>
              <ListIcon name={item.icon} iconLib={item.iconLib} color={item.color} size={17} />
            </View>
            {item.detail ? (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.metricDetail, { color: theme.text?.muted ?? "#666" }]}
              >
                {item.detail}
              </Text>
            ) : null}
          </View>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            fontRole="numeric"
            style={[styles.metricValue, { color: theme.text?.primary ?? "#fff" }]}
          >
            {item.value}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.metricLabel, { color: theme.text?.secondary ?? "#aaa" }]}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

// ── En çok izlenen türler ────────────────────────────────────────────────────
// genres: [[ad, adet], ...] azalan sırada. Her satırın çubuğu en kalabalık
// türe göre ölçeklenir (toplama göre değil): 5 tür yan yana kıyaslanabilsin.
export const TopGenresCard = memo(function TopGenresCard({ title, genres, colors }) {
  const { theme } = useTheme();
  const max = genres[0]?.[1] || 1;

  return (
    <View
      style={[
        styles.genresCard,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.genresTitle, { color: theme.text?.primary ?? "#fff" }]}
      >
        {title}
      </Text>
      {genres.map(([genre, count], index) => {
        const color = colors[index % colors.length];
        return (
          <View key={genre} style={styles.genreRow}>
            <View style={[styles.genreRank, { backgroundColor: alpha(color, 0.16) }]}>
              <Text allowFontScaling={false} style={[styles.genreRankText, { color }]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.genreBody}>
              <View style={styles.genreLine}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.genreName, { color: theme.text?.primary ?? "#fff" }]}
                >
                  {genre}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.genreCount, { color: theme.text?.muted ?? "#666" }]}
                >
                  {count}
                </Text>
              </View>
              <View style={[styles.genreTrack, { backgroundColor: theme.primary ?? "#111" }]}>
                <View
                  style={[
                    styles.genreFill,
                    { width: `${Math.max(6, (count / max) * 100)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
});

// ── Bildirim kartı (gizli profil / paylaşılan liste yok) ─────────────────────
export const ProfileNoticeCard = memo(function ProfileNoticeCard({ icon, title }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.noticeMedallion, { backgroundColor: alpha(theme.accent, 0.13) }]}>
        <Ionicons name={icon} size={26} color={theme.accent} />
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.noticeText, { color: theme.text?.secondary ?? "#aaa" }]}
      >
        {title}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // ── Arka plan + üst çubuk ──────────────────────────────────────────────────
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 2,
  },
  topTitleWrap: { flex: 1, minWidth: 0 },
  topTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  // BackButton ile aynı ölçü/köşe: iki uç dengeli, başlık tam ortada kalsın.
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: { alignItems: "center", marginTop: 6, marginBottom: 20 },
  avatarRing: {
    padding: RING_PADDING,
    borderWidth: RING_BORDER,
    borderRadius: RING_RADIUS,
  },
  onlineDot: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
  },
  name: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 31,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  identityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  username: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  presenceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  presenceDot: { width: 6, height: 6, borderRadius: 3 },
  presenceText: { fontSize: 11.5, fontWeight: "800", flexShrink: 1 },
  badgesRow: { justifyContent: "center", marginTop: 8, marginBottom: 0 },
  bio: {
    marginTop: 12,
    maxWidth: 330,
    paddingHorizontal: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  memberSince: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
  },
  memberSinceText: { fontSize: 12, fontWeight: "700" },

  // ── Sayaç şeridi ───────────────────────────────────────────────────────────
  statStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
  },
  statCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingHorizontal: 6 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, marginVertical: 4 },
  statValue: { fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  statLabel: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },

  // ── Bölüm başlığı ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: { flex: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countChipText: { fontSize: 12.5, fontWeight: "900" },

  // ── Toplam izleme süresi ───────────────────────────────────────────────────
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryCaption: { fontSize: 12.5, fontWeight: "700" },
  summaryValue: { fontSize: 32, fontWeight: "900", letterSpacing: -0.8, marginTop: 2 },
  summaryMinutes: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  splitTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    flexDirection: "row",
    gap: 3,
    marginTop: 18,
  },
  splitSegment: { flexBasis: 0, height: "100%", borderRadius: 5 },
  splitLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 12,
  },
  splitItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  splitShare: { fontSize: 12.5, fontWeight: "900", marginLeft: "auto" },

  // ── Metrik karoları ────────────────────────────────────────────────────────
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  // flexBasis 45% + flexGrow: bir satıra iki karo sığar, üçüncü sığmaz; artan
  // boşluğu karolar paylaşır (sabit %48 + gap, dar ekranda taşabiliyordu).
  metricTile: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  metricDetail: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  metricValue: { fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  metricLabel: { fontSize: 12.5, fontWeight: "700", marginTop: 1 },

  // ── Türler ─────────────────────────────────────────────────────────────────
  genresCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 6,
  },
  genresTitle: { fontSize: 15, fontWeight: "800", marginBottom: 14 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 },
  genreRank: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  genreRankText: { fontSize: 12.5, fontWeight: "900" },
  genreBody: { flex: 1, minWidth: 0 },
  genreLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  genreName: { flex: 1, fontSize: 13.5, fontWeight: "700" },
  genreCount: { fontSize: 12.5, fontWeight: "800" },
  genreTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  genreFill: { height: "100%", borderRadius: 3 },

  // ── Bildirim kartı ─────────────────────────────────────────────────────────
  notice: {
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 28,
  },
  noticeMedallion: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
});

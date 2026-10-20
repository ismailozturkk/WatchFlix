// components/video/TrailerVideoList.js
//
// Fragman SAYFASININ (TrailerModal) video listesi: ilk video geniş "öne çıkan"
// kart, kalanlar yan yana küçük resim + başlık satırı. Film/Dizi detayındaki yatay
// kaydırmalı şerit (MovieVideoItem) aynen kalır — bu liste yalnız
// `<TrailerSection variant="sheet" />` için.
//
// Yükleme ve boş durum da burada: sayfa, içerik gelene dek aynı yükseklikte
// iskelet gösterir (sayfa önce küçük açılıp sonra zıplamasın).
//
// YERLEŞİM: liste sayfanın KÜÇÜLEBİLEN bölgesi (`flexGrow: 0 / flexShrink: 1`).
// Sığıyorsa içerik kadar yer kaplar, sığmıyorsa kayar; başlık ve dil çipleri
// ekranda kalır (bkz. components/common/BottomSheetModal.js → SheetScroll).
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

export const SHEET_GUTTER = 16;

// `maxresdefault` her videoda yok (404 döner) — bulunamazsa `hqdefault`a düşülür.
// hqdefault 4:3 çerçevede üst/alt siyah şeritli gelir; 16:9 kutuya `cover` ile
// yerleşince şeritler kırpılır.
const thumbUri = (key, quality) => `https://i.ytimg.com/vi/${key}/${quality}.jpg`;

function VideoThumb({ videoKey, hero = false, style, children }) {
  const [heroFailed, setHeroFailed] = useState(false);
  const quality = hero && !heroFailed ? "maxresdefault" : "hqdefault";
  return (
    <View style={[styles.thumb, style]}>
      <Image
        source={{ uri: thumbUri(videoKey, quality) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={160}
        cachePolicy="memory-disk"
        recyclingKey={videoKey}
        onError={hero ? () => setHeroFailed(true) : undefined}
      />
      {children}
    </View>
  );
}

const FeaturedCard = memo(function FeaturedCard({ item, onPress }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
    >
      <VideoThumb videoKey={item.key} hero style={styles.featuredThumb}>
        <LinearGradient
          colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.8)"]}
          locations={[0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featuredCenter} pointerEvents="none">
          <AdaptiveBlurView tint="dark" intensity={45} style={styles.playDisc}>
            <Ionicons name="play" size={26} color="#fff" style={styles.playGlyph} />
          </AdaptiveBlurView>
        </View>
        <View style={styles.typeBadge} pointerEvents="none">
          <Text allowFontScaling={false} style={styles.typeBadgeText}>
            {item.type}
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={styles.featuredTitle}
        >
          {item.name}
        </Text>
      </VideoThumb>
    </Pressable>
  );
});

const VideoRow = memo(function VideoRow({ item, theme, onPress }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.between, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <VideoThumb videoKey={item.key} style={styles.rowThumb}>
        <View style={styles.rowPlayWrap} pointerEvents="none">
          <View style={styles.rowPlay}>
            <Ionicons name="play" size={13} color="#fff" style={styles.rowPlayGlyph} />
          </View>
        </View>
      </VideoThumb>
      <View style={styles.rowCopy}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.rowKicker, { color: theme.accent }]}
        >
          {item.type}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.rowTitle, { color: theme.text.primary }]}
        >
          {item.name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
    </Pressable>
  );
});

function VideoSkeleton({ theme }) {
  const block = { backgroundColor: theme.between, borderColor: theme.border };
  return (
    <View style={styles.skeleton}>
      <View style={[styles.featuredThumb, styles.skeletonHero, block]}>
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
      {[0, 1].map((index) => (
        <View key={index} style={[styles.row, styles.skeletonRow, block]} />
      ))}
    </View>
  );
}

function VideoEmpty({ theme }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
        <Ionicons name="videocam-off-outline" size={26} color={theme.accent} />
      </View>
      <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
        {i18nText("autoI18n.bu_dilde_video_yok", "Bu dilde video bulunamadı")}
      </Text>
    </View>
  );
}

/**
 * @param {object}   props
 * @param {object[]} props.videos     TMDB /videos sonuçları (YouTube, sıralı).
 * @param {boolean}  props.loading
 * @param {object}   props.theme
 * @param {(video: object) => void} props.onPress
 * @param {number}   [props.bottomInset=0]  Liste sonuna eklenen boşluk (güvenli alan).
 */
export default function TrailerVideoList({
  videos,
  loading,
  theme,
  onPress,
  bottomInset = 0,
}) {
  const renderItem = useCallback(
    ({ item, index }) =>
      index === 0 ? (
        <FeaturedCard item={item} onPress={onPress} />
      ) : (
        <VideoRow item={item} theme={theme} onPress={onPress} />
      ),
    [onPress, theme],
  );

  if (loading) return <VideoSkeleton theme={theme} />;
  if (!videos.length) return <VideoEmpty theme={theme} />;

  return (
    <FlatList
      data={videos}
      keyExtractor={(video) => video.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: 6 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingHorizontal: SHEET_GUTTER, gap: 8 },

  thumb: { overflow: "hidden", backgroundColor: "#000" },
  pressed: { transform: [{ scale: 0.985 }] },

  // Öne çıkan kart
  featured: { marginBottom: 4 },
  featuredThumb: { width: "100%", aspectRatio: 16 / 9, borderRadius: 20 },
  featuredCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  // Üçgenin görsel ağırlık merkezi kutunun biraz solunda kalır.
  playGlyph: { marginLeft: 3 },
  typeBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  featuredTitle: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    color: "#fff",
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "800",
  },

  // Küçük satır
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowThumb: { width: 118, aspectRatio: 16 / 9, borderRadius: 12 },
  rowPlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  rowPlay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  rowPlayGlyph: { marginLeft: 1.5 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  rowTitle: { fontSize: 13, lineHeight: 18, fontWeight: "600" },

  // Yükleme iskeleti — yüklenmiş listeyle aynı ölçüler.
  skeleton: { paddingHorizontal: SHEET_GUTTER, gap: 8, paddingBottom: 6 },
  skeletonHero: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  skeletonRow: { height: 74 },

  // Boş durum
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 44,
    paddingHorizontal: SHEET_GUTTER,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 13.5, fontWeight: "600", textAlign: "center" },
});

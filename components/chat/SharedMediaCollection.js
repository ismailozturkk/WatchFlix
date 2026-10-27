// components/chat/SharedMediaCollection.js
//
// Sohbette paylaşılan ÇOKLU içerik (koleksiyon/liste) balonunun gövdesi —
// sohbetteki "#" aramasından 2+ içerik seçilip "Listeyi gönder" denince gelir.
//
// Görünüm: üstte ikon karolu başlık (liste adı ya da "Paylaşılan liste") ve
// altında içerik dağılımı ("2 film · 3 dizi"); ortada afiş ızgarası (afiş +
// ad + yıl/tür satırı); altta 2+ dizi/filmde "Rastgele Seç". Rastgele seçim her
// izleyende YEREL çalışır (yazma yok), "bu akşam ne izlesek?" kararını
// eğlenceli hale getirir.
//
// BOY SINIRI: 12 öğelik liste eskiden 4 sıra tam ızgara olup balonu ekran
// boyu yapıyordu. Artık en çok 6 kare görünür; fazlası 6. karede "+N" olarak
// katlanır, dokununca açılır ("Daha az göster" ile geri katlanır). Rastgele
// seçim katlıyken başlarsa önce açılır — vurgu gizli karede kaybolmasın.
//
// AFİŞ KENARI: çerçeve görselin ÜSTÜNDE ayrı katman (shareKit.PosterEdge);
// kutuya borderWidth vermek afişi 2:3'ten saptırıp kırpıyordu.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { countByType, resultMeta } from "../../utils/chatMediaSearch";
import { PosterEdge, easeLayout, sharePalette } from "./shareKit";

const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 8;
const POSTER_RADIUS = 10;
// Katlıyken görünen en çok kare (fazlası son karede "+N").
const COLLAPSED_SLOTS = 6;
// Balon içeriğinin hedef genişliği (PosterStrip / SharedListMessage ile yakın).
const ROW_W = Math.min(Math.round(SCREEN_W * 0.7), 288);

// İçerik sayısına göre sütun + kart genişliği: 2 → 2'li, 4 → 2x2, diğerleri 3'lü.
// Genişlik ÇİFT tutulur (yükseklik = 1,5 x tam sayı; tek genişlik yukarı
// yuvarlanıp afişi yarım dp kırpıyordu).
export const computeLayout = (n) => {
  const cols = n <= 2 ? Math.max(1, n) : n === 4 ? 2 : 3;
  let cardW = Math.floor((ROW_W - GAP * (cols - 1)) / cols);
  cardW = Math.max(64, Math.min(cardW, 124));
  cardW -= cardW % 2;
  return { cols, cardW, gridWidth: cardW * cols + GAP * (cols - 1) };
};

// Kişide bölüm etiketi; dizi/filmde "2021 · Dizi". Sohbet araması da kullanır.
const DEPARTMENT_LABEL = {
  Acting: () => i18nText("autoI18n.oyuncu", "Oyuncu"),
  Directing: () => i18nText("autoI18n.yonetmen", "Yönetmen"),
};
export const mediaMetaLabel = (item) => {
  const { mediaType, year, department } = resultMeta(item);
  if (mediaType === "person") {
    return (DEPARTMENT_LABEL[department] || (() => i18nText("autoI18n.kisi", "Kişi")))();
  }
  const typeLabel =
    mediaType === "tv" ? i18nText("autoI18n.dizi", "Dizi") : i18nText("autoI18n.film", "Film");
  return year ? `${year} · ${typeLabel}` : typeLabel;
};

/** "2 film · 3 dizi" / "5 oyuncu" — listenin ne içerdiği tek bakışta. */
export const compositionLabel = (items) => {
  const counts = countByType(items);
  const parts = [];
  if (counts.movie) parts.push(i18nText("autoI18n.n_film", "{{n}} film", { n: counts.movie }));
  if (counts.tv) parts.push(i18nText("autoI18n.n_dizi", "{{n}} dizi", { n: counts.tv }));
  if (counts.person) parts.push(i18nText("autoI18n.n_oyuncu", "{{n}} oyuncu", { n: counts.person }));
  return parts.length
    ? parts.join(" · ")
    : i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: items.length });
};

// ─── Tek afiş kartı ──────────────────────────────────────────────────────────
function MiniCard({ item, getTmdbUrl, palette, accent, highlighted, picked, dimmed, onPress, cardW, isOutgoing }) {
  const poster = item.poster_path || item.profile_path;
  const ring = isOutgoing ? "#fff" : accent;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${mediaMetaLabel(item)}`}
      style={{
        width: cardW,
        opacity: dimmed ? 0.4 : 1,
        transform: [{ scale: highlighted ? 1.05 : 1 }],
      }}
    >
      <View
        style={[
          styles.posterBox,
          { width: cardW, height: cardW * 1.5, backgroundColor: palette.posterBg },
        ]}
      >
        {poster ? (
          <Image
            source={{ uri: getTmdbUrl(poster, "poster", 200) }}
            style={styles.poster}
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Ionicons
              name={item.media_type === "person" ? "person" : "film-outline"}
              size={20}
              color={palette.muted}
            />
          </View>
        )}

        {item.media_type !== "person" && item.vote_average > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color="#FFD54F" />
            <Text allowFontScaling={false} style={styles.ratingText}>
              {Number(item.vote_average).toFixed(1)}
            </Text>
          </View>
        )}

        {picked && (
          <View style={[styles.pickedOverlay, { backgroundColor: accent + "b3" }]}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
          </View>
        )}
        <PosterEdge
          radius={POSTER_RADIUS}
          color={highlighted || picked ? ring : palette.posterEdge}
          width={highlighted || picked ? 2 : 1}
        />
      </View>
      <Text style={[styles.cardTitle, { color: palette.primary }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.cardMeta, { color: palette.muted }]} numberOfLines={1}>
        {mediaMetaLabel(item)}
      </Text>
    </TouchableOpacity>
  );
}

// Katlıyken son kare: arkada bir sonraki afiş, üstünde "+N".
function OverflowCard({ item, hiddenCount, getTmdbUrl, palette, cardW, onPress }) {
  const poster = item?.poster_path || item?.profile_path;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={i18nText("autoI18n.n_icerik_daha", "{{n}} içerik daha", { n: hiddenCount })}
      style={{ width: cardW }}
    >
      <View
        style={[
          styles.posterBox,
          { width: cardW, height: cardW * 1.5, backgroundColor: palette.posterBg },
        ]}
      >
        {poster ? (
          <Image
            source={{ uri: getTmdbUrl(poster, "poster", 200) }}
            style={styles.poster}
            cachePolicy="memory-disk"
            blurRadius={6}
          />
        ) : null}
        <View style={styles.overflowVeil}>
          <Text allowFontScaling={false} style={styles.overflowCount}>
            +{hiddenCount}
          </Text>
          <Text allowFontScaling={false} style={styles.overflowLabel}>
            {i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}
          </Text>
        </View>
        <PosterEdge radius={POSTER_RADIUS} color={palette.posterEdge} />
      </View>
    </TouchableOpacity>
  );
}

export default function SharedMediaCollection({
  items = [],
  listTitle,
  accent: propAccent,
  getTmdbUrl,
  isOutgoing = false,
  onOpenItem,
}) {
  const { theme } = useTheme();
  const accent = propAccent || theme.accent || "#6C63FF";
  const palette = sharePalette({ theme, isOutgoing, accent });
  // Liste tek tip (homojen): ya dizi/film ya oyuncu. Oyuncu listesinde
  // "rastgele seç" anlamsız — yalnızca dizi/film listelerinde göster.
  const isPersonList = items[0]?.media_type === "person";
  const canRandom = items.length >= 2 && !isPersonList;
  const { cardW, gridWidth } = computeLayout(items.length);
  const collapsible = items.length > COLLAPSED_SLOTS;
  const [expanded, setExpanded] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [picked, setPicked] = useState(-1);
  const timerRef = useRef(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const composition = useMemo(() => compositionLabel(items), [items]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const toggleExpanded = useCallback(() => {
    easeLayout();
    setExpanded((v) => !v);
  }, []);

  const spin = useCallback(() => {
    if (spinning || !canRandom) return;
    if (collapsible && !expanded) {
      easeLayout();
      setExpanded(true);
    }
    setPicked(-1);
    bannerAnim.setValue(0);
    setSpinning(true);
    const target = Math.floor(Math.random() * items.length);
    const totalSteps = 16 + Math.floor(Math.random() * items.length);
    let step = 0;

    const tick = () => {
      step += 1;
      if (step >= totalSteps) {
        setHighlight(target);
        setPicked(target);
        setSpinning(false);
        Animated.spring(bannerAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
        return;
      }
      setHighlight((prev) => (prev + 1) % items.length);
      const delay = 55 + Math.floor((step / totalSteps) * 190);
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  }, [spinning, canRandom, collapsible, expanded, items.length, bannerAnim]);

  const pickedItem = picked >= 0 ? items[picked] : null;
  const showAll = !collapsible || expanded;
  const visible = showAll ? items : items.slice(0, COLLAPSED_SLOTS - 1);

  return (
    <View style={[styles.wrap, { width: gridWidth }]}>
      {/* Başlık: ikon karosu + liste adı + içerik dağılımı */}
      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: palette.tile }]}>
          <Ionicons
            name={isPersonList ? "people-outline" : listTitle ? "list" : "albums-outline"}
            size={16}
            color={palette.tileInk}
          />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.headerTitle, { color: palette.primary }]} numberOfLines={2}>
            {listTitle || i18nText("autoI18n.paylasilan_liste", "Paylaşılan liste")}
          </Text>
          <Text style={[styles.headerSub, { color: palette.muted }]} numberOfLines={1}>
            {composition}
          </Text>
        </View>
      </View>

      {/* Afiş ızgarası — genişlik içerik sayısına göre (computeLayout) */}
      <View style={styles.grid}>
        {visible.map((item, idx) => (
          <MiniCard
            key={(item.media_type || "x") + "-" + item.id + "-" + idx}
            item={item}
            getTmdbUrl={getTmdbUrl}
            palette={palette}
            accent={accent}
            cardW={cardW}
            isOutgoing={isOutgoing}
            highlighted={spinning && highlight === idx}
            picked={picked === idx}
            dimmed={picked >= 0 && picked !== idx && !spinning}
            onPress={onOpenItem}
          />
        ))}
        {!showAll && (
          <OverflowCard
            item={items[COLLAPSED_SLOTS - 1]}
            hiddenCount={items.length - (COLLAPSED_SLOTS - 1)}
            getTmdbUrl={getTmdbUrl}
            palette={palette}
            cardW={cardW}
            onPress={toggleExpanded}
          />
        )}
      </View>

      {collapsible && expanded && !spinning && (
        <TouchableOpacity
          onPress={toggleExpanded}
          style={styles.collapseLink}
          hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
          accessibilityRole="button"
        >
          <Text style={[styles.collapseLinkText, { color: palette.secondary }]}>
            {i18nText("autoI18n.daha_az_goster", "Daha az göster")}
          </Text>
          <Ionicons name="chevron-up" size={13} color={palette.secondary} />
        </TouchableOpacity>
      )}

      {/* Seçilen sonuç bandı */}
      {pickedItem && (
        <Animated.View
          style={[
            styles.pickedBanner,
            {
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
              opacity: bannerAnim,
              transform: [
                {
                  scale: bannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="sparkles" size={14} color={palette.tileInk} />
          <Text
            style={[styles.pickedBannerText, { color: palette.secondary }]}
            numberOfLines={2}
          >
            {i18nText("autoI18n.secilen", "Seçilen")}:{" "}
            <Text style={{ fontWeight: "900", color: palette.primary }}>
              {pickedItem.title}
            </Text>
          </Text>
        </Animated.View>
      )}

      {/* Rastgele seç (2+ dizi/film): ızgara genişliğinde düğme */}
      {canRandom && (
        <TouchableOpacity
          onPress={spin}
          disabled={spinning}
          activeOpacity={0.85}
          style={[
            styles.randomBtn,
            {
              backgroundColor: palette.buttonBg,
              opacity: spinning ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="dice-outline" size={16} color={palette.buttonInk} />
          <Text style={[styles.randomBtnText, { color: palette.buttonInk }]}>
            {spinning
              ? i18nText("autoI18n.seciliyor", "Seçiliyor...")
              : pickedItem
                ? i18nText("autoI18n.yeniden_sec", "Yeniden seç")
                : i18nText("autoI18n.rastgele_sec", "Rastgele Seç")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 2, alignSelf: "flex-start" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  headerTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14.5, fontWeight: "800", lineHeight: 19 },
  headerSub: { fontSize: 11.5, fontWeight: "600", marginTop: 1 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },

  posterBox: {
    borderRadius: POSTER_RADIUS,
    overflow: "hidden",
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  posterPlaceholder: { justifyContent: "center", alignItems: "center" },
  ratingBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.68)",
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  ratingText: { color: "#fff", fontSize: 8.5, fontWeight: "800" },
  pickedOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  overflowVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  overflowCount: { color: "#fff", fontSize: 22, fontWeight: "900" },
  overflowLabel: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700" },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 5,
  },
  cardMeta: { fontSize: 9.5, fontWeight: "600", marginTop: 1 },

  collapseLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    marginTop: 8,
  },
  collapseLinkText: { fontSize: 12, fontWeight: "700" },

  randomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 38,
    marginTop: 10,
    borderRadius: 19,
  },
  randomBtnText: { fontSize: 13, fontWeight: "800" },

  pickedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickedBannerText: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
});

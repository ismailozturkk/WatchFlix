// components/chat/SharedMediaCollection.js
//
// Sohbette paylaşılan ÇOKLU içerik (koleksiyon/liste) balonunun gövdesi —
// sohbetteki "#" aramasından 2+ içerik seçilip "Listeyi gönder" denince gelir.
//
// Görünüm: üstte ikon karolu başlık (liste adı ya da "Paylaşılan liste") ve
// altında içerik dağılımı ("2 film · 3 dizi"); ortada küçük afişlerin yatay rayı
// (afiş + ad + yıl/tür satırı); altta 2+ dizi/filmde "Rastgele Seç". Rastgele seçim her
// izleyende YEREL çalışır (yazma yok), "bu akşam ne izlesek?" kararını
// eğlenceli hale getirir.
//
// BOY SINIRI: liste kaç öğe olursa olsun tek satırdır; içerik yana kayar. Rastgele
// seçim sırasında ray vurgulanan afişi görünür tutacak şekilde ilerler.
//
// AFİŞ KENARI: çerçeve görselin ÜSTÜNDE ayrı katman (shareKit.PosterEdge);
// kutuya borderWidth vermek afişi 2:3'ten saptırıp kırpıyordu.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { countByType, resultMeta } from "../../utils/chatMediaSearch";
import { PosterEdge, sharePalette } from "./shareKit";

const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 8;
const POSTER_RADIUS = 10;
// Balon içeriğinin hedef genişliği (PosterStrip / SharedListMessage ile yakın).
const ROW_W = Math.min(Math.round(SCREEN_W * 0.7), 288);
const COMPACT_CARD_W = 58;

// Sohbet listesindeki posterler içerik sayısından bağımsız aynı küçük ölçüyü
// kullanır. `gridWidth` rayın ekrandaki penceresi, `contentWidth` kaydırılan alan.
export const computeLayout = (n, viewportWidth = ROW_W) => {
  const cols = Math.max(1, n);
  const contentWidth = COMPACT_CARD_W * cols + GAP * (cols - 1);
  return { cols, cardW: COMPACT_CARD_W, gridWidth: viewportWidth, contentWidth };
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
  const focusAnim = useRef(new Animated.Value(highlighted || picked ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(dimmed ? 0.42 : 1)).current;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: highlighted || picked ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 170,
    }).start();
    Animated.timing(opacityAnim, {
      toValue: dimmed ? 0.42 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dimmed, focusAnim, highlighted, opacityAnim, picked]);

  return (
    <Animated.View
      style={{
        width: cardW,
        opacity: opacityAnim,
        transform: [
          {
            scale: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.06],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress?.(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${mediaMetaLabel(item)}`}
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
    </Animated.View>
  );
}

export default function SharedMediaCollection({
  items = [],
  listTitle,
  accent: propAccent,
  getTmdbUrl,
  isOutgoing = false,
  cardWidth = ROW_W,
  onOpenItem,
}) {
  const { theme } = useTheme();
  const accent = propAccent || theme.accent || "#6C63FF";
  const palette = sharePalette({ theme, isOutgoing, accent });
  // Liste tek tip (homojen): ya dizi/film ya oyuncu. Oyuncu listesinde
  // "rastgele seç" anlamsız — yalnızca dizi/film listelerinde göster.
  const isPersonList = items[0]?.media_type === "person";
  const canRandom = items.length >= 2 && !isPersonList;
  const { cardW, gridWidth, contentWidth } = computeLayout(items.length, cardWidth);
  const [spinning, setSpinning] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [picked, setPicked] = useState(-1);
  const timerRef = useRef(null);
  const railRef = useRef(null);
  const railX = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const composition = useMemo(() => compositionLabel(items), [items]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // ScrollView'un art arda gelen `animated: true` komutları birbirini kesip
  // zıplamasın: tek Animated.Value rayı kesintisiz ilerletir.
  useEffect(() => {
    if (typeof railX.addListener !== "function") return undefined;
    const listenerId = railX.addListener(({ value }) => {
      railRef.current?.scrollTo?.({ x: value, animated: false });
    });
    return () => railX.removeListener?.(listenerId);
  }, [railX]);

  const moveRailTo = useCallback(
    (index, duration = 150) => {
      const centered = index * (cardW + GAP) - (gridWidth - cardW) / 2;
      const x = Math.max(0, Math.min(centered, Math.max(0, contentWidth - gridWidth)));
      if (typeof railX.addListener !== "function") {
        railRef.current?.scrollTo?.({ x, animated: true });
        return;
      }
      railX.stopAnimation?.();
      Animated.timing(railX, {
        toValue: x,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [cardW, contentWidth, gridWidth, railX],
  );

  const spin = useCallback(() => {
    if (spinning || !canRandom) return;
    setPicked(-1);
    bannerAnim.setValue(0);
    setSpinning(true);
    const target = Math.floor(Math.random() * items.length);
    const start = highlight >= 0 ? highlight : -1;
    const distanceToTarget = (target - start + items.length) % items.length || items.length;
    // En az iki tam tur; adım sayısı hedefte TAM biter, sonda sert sıçrama olmaz.
    const totalSteps = items.length * 2 + distanceToTarget;
    let step = 0;
    let cursor = start;

    const tick = () => {
      step += 1;
      cursor = (cursor + 1) % items.length;
      setHighlight(cursor);
      const progress = step / totalSteps;
      // Başta canlı, hedefe yaklaşırken doğal biçimde yavaşlayan seçim ruleti.
      const delay = 48 + Math.round(Math.pow(progress, 2.2) * 230);
      moveRailTo(cursor, Math.min(190, delay + 45));

      if (step >= totalSteps) {
        timerRef.current = setTimeout(() => {
          setPicked(target);
          setSpinning(false);
          Animated.spring(bannerAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start();
        }, 150);
        return;
      }
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  }, [spinning, canRandom, items.length, bannerAnim, highlight, moveRailTo]);

  const pickedItem = picked >= 0 ? items[picked] : null;
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

      {/* Küçük afiş rayı — tüm içerikler tek satırda yana kayar. */}
      <ScrollView
        ref={railRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardW + GAP}
        contentContainerStyle={styles.railContent}
      >
        {items.map((item, idx) => (
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
      </ScrollView>

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

  railContent: {
    flexDirection: "row",
    gap: GAP,
    paddingRight: 2,
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
  cardTitle: {
    fontSize: 9.5,
    fontWeight: "700",
    lineHeight: 12,
    marginTop: 3,
  },
  cardMeta: { fontSize: 8.5, fontWeight: "600", marginTop: 1 },

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

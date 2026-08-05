// components/chat/SharedMediaCollection.js
//
// Sohbette paylaşılan ÇOKLU içerik (koleksiyon/liste) balonunun gövdesi.
// Tek bir mesaj içinde N adet dizi/film/kişi posterini grid olarak gösterir.
// Opsiyonel başlık (listTitle) ve 2+ öğede "🎲 Rastgele Seç" butonu sunar —
// rastgele seçim her izleyende YEREL çalışır (yazma yok), "bu akşam ne izlesek?"
// kararını eğlenceli hale getirir.
//
// İLERİYE DÖNÜK: aynı items yapısı poll/anket için temel; oylama eklendiğinde
// her poster bir oy seçeneği olur (kind:"poll" + votes map). Bu bileşen variant
// prop'u ile o yöne genişletilebilir.

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { i18nText } from "../../utils/i18nText";

const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 8;

// İçerik sayısına göre sütun + kart genişliği: az içerikte büyük, çok içerikte
// küçülüp sığar. 2→2'li, 3→3'lü, 4→2x2, 5+→3'lü grid.
const computeLayout = (n) => {
  const cols = n <= 3 ? Math.max(1, n) : n === 4 ? 2 : 3;
  const targetRow = Math.min(SCREEN_W * 0.7, 320);
  let cardW = Math.floor((targetRow - GAP * (cols - 1)) / cols);
  cardW = Math.max(64, Math.min(cardW, 120));
  return { cols, cardW, gridWidth: cardW * cols + GAP * (cols - 1) };
};

const typeMeta = (mt) =>
  mt === "movie"
    ? { label: i18nText("autoI18n.film_upper", "FİLM"), color: "#FF8A65" }
    : mt === "tv"
      ? { label: i18nText("autoI18n.dizi_upper", "DİZİ"), color: "#64B5F6" }
      : { label: i18nText("autoI18n.kisi_upper", "KİŞİ"), color: "#CE93D8" };

// ─── Tek mini poster kartı ───────────────────────────────────────────────────
function MiniCard({ item, getTmdbUrl, accent, highlighted, picked, onPress, cardW }) {
  const poster = item.poster_path || item.profile_path;
  const meta = typeMeta(item.media_type);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(item)}
      style={{ width: cardW }}
    >
      <View
        style={[
          styles.posterBox,
          { width: cardW, height: Math.round(cardW * 1.5) },
          // Border genişliği SABİT (2) — yalnızca renk değişir; spin sırasında
          // layout kayması/titreme olmaz.
          (highlighted || picked) && { borderColor: accent },
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
              color="rgba(255,255,255,0.35)"
            />
          </View>
        )}

        <View style={[styles.typeBadge, { backgroundColor: meta.color + "22", borderColor: meta.color + "55" }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {item.vote_average > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color="#FFD54F" />
            <Text allowFontScaling={false} style={styles.ratingText}>
              {Number(item.vote_average).toFixed(1)}
            </Text>
          </View>
        )}

        {picked && (
          <View style={[styles.pickedOverlay, { backgroundColor: accent + "cc" }]}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
}

export default function SharedMediaCollection({
  items = [],
  listTitle,
  accent = "#6C63FF",
  getTmdbUrl,
  isOutgoing = false,
  onOpenItem,
}) {
  // Liste tek tip (homojen): ya dizi/film ya oyuncu. Oyuncu listesinde
  // "rastgele seç" anlamsız — yalnızca dizi/film listelerinde göster.
  const isPersonList = items[0]?.media_type === "person";
  const canRandom = items.length >= 2 && !isPersonList;
  const { cardW, gridWidth } = computeLayout(items.length);
  const [spinning, setSpinning] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [picked, setPicked] = useState(-1);
  const timerRef = useRef(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const spin = useCallback(() => {
    if (spinning || !canRandom) return;
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
      // Yavaşlayan "çark" hissi: adım ilerledikçe gecikme artar.
      const delay = 55 + Math.floor((step / totalSteps) * 190);
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  }, [spinning, canRandom, items.length, bannerAnim]);

  const pickedItem = picked >= 0 ? items[picked] : null;

  return (
    <View style={styles.wrap}>
      {/* Başlık (opsiyonel) */}
      <View style={[styles.header, isOutgoing && styles.headerOutgoing]}>
        <Ionicons
          name={isPersonList ? "people-outline" : listTitle ? "list" : "albums-outline"}
          size={14}
          color={accent}
        />
        <Text style={styles.headerText} numberOfLines={2}>
          {listTitle ||
            (isPersonList
              ? i18nText("autoI18n.n_oyuncu", "{{n}} oyuncu", { n: items.length })
              : i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: items.length }))}
        </Text>
      </View>

      {/* Poster grid — genişlik içerik sayısına göre (computeLayout) */}
      <View
        style={[styles.grid, { width: gridWidth }, isOutgoing && styles.gridOutgoing]}
      >
        {items.map((item, idx) => (
          <MiniCard
            key={(item.media_type || "x") + "-" + item.id + "-" + idx}
            item={item}
            getTmdbUrl={getTmdbUrl}
            accent={accent}
            cardW={cardW}
            highlighted={spinning && highlight === idx}
            picked={picked === idx}
            onPress={onOpenItem}
          />
        ))}
      </View>

      {/* Rastgele seç (2+ öğe) */}
      {canRandom && (
        <View style={[styles.actionsRow, isOutgoing && styles.actionsRowOutgoing]}>
          <TouchableOpacity
            onPress={spin}
            disabled={spinning}
            activeOpacity={0.85}
            style={[styles.randomBtn, { backgroundColor: accent, opacity: spinning ? 0.7 : 1 }]}
          >
            <Ionicons name="dice-outline" size={15} color="#fff" />
            <Text style={styles.randomBtnText}>
              {spinning
                ? i18nText("autoI18n.seciliyor", "Seçiliyor...")
                : i18nText("autoI18n.rastgele_sec", "Rastgele Seç")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Seçilen sonuç bandı */}
      {pickedItem && (
        <Animated.View
          style={[
            styles.pickedBanner,
            {
              borderColor: accent + "66",
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
          <Ionicons name="sparkles" size={14} color={accent} />
          <Text style={styles.pickedBannerText} numberOfLines={2}>
            {i18nText("autoI18n.secilen", "Seçilen")}: <Text style={{ fontWeight: "900", color: "#fff" }}>{pickedItem.title}</Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 9, alignSelf: "flex-start" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  headerOutgoing: { justifyContent: "flex-end" },
  headerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridOutgoing: { justifyContent: "flex-end" },

  posterBox: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  posterPlaceholder: { justifyContent: "center", alignItems: "center" },
  typeBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 7, fontWeight: "800", letterSpacing: 0.3 },
  ratingBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ratingText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  pickedOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10.5,
    fontWeight: "600",
    lineHeight: 13,
    marginTop: 4,
  },

  actionsRow: { flexDirection: "row", marginTop: 10 },
  actionsRowOutgoing: { justifyContent: "flex-end" },
  randomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  randomBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },

  pickedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pickedBannerText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
});

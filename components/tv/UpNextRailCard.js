// components/tv/UpNextRailCard.js
//
// Kütüphane sekmesindeki "Devam Edenler" rayının kartı (9 Kas yenilemesi,
// aynı gün kompaktlaştırıldı).
//
// Yayın uygulamalarındaki "izlemeye devam et" kartı gibi yatay ama KISA:
//
//   ┌──────── bölüm karesi (2:1) ─────────┐
//   │ [S2·B5]                     [12/24] │
//   │ ▄ [afiş] Dizi adı  %50              │
//   └═════════ ilerleme çubuğu ═══════════┘
//     Bölüm adı                   (📅) (✓)
//     S2 · B5 · 3 Kas
//
// Bölüm karesi (TMDB still) yoksa dizinin afişi bulanıklaştırılıp zemin yapılır;
// küçük afiş küçük resmi her durumda diziyi tanıtır.
//
// Düğmeler kartın dokunma alanının İÇİNDE olduğundan basış olayı ayrıca
// durduruluyor (bkz. stopPropagation): düğmeye dokunmak diziyi açmasın.
//
// Üç uç durum bilinçlidir:
//   • item === undefined → henüz çözülmedi (iskelet)
//   • item === null      → çözüldü, sıradaki bölüm yok (yeni sezon bekleniyor)
//   • item.isAired false → bölüm var ama yayınlanmadı (işaretlenemez)
//
// "İzledim" kartı beklemeden sıradaki bölüme ilerletir (useUpNextQueue). Bölüm
// değişimi sessiz bir metin değişimi gibi görünmesin diye bölüm içeriği sağdan
// kayarak, bölüm numarası rozeti zıplayarak gelir. İlk çizimde ve iskeletten
// çözülmeye geçişte oynamaz — yalnız gösterilen bölüm BAŞKA bir bölüme
// döndüğünde (izlendi, geri alındı ya da arka plan tazelemesi ilerletti).

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import PosterImage from "../PosterImage";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import usePosterUri from "../../hooks/usePosterUri";
import useReduceMotion from "../../hooks/useReduceMotion";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { getWatchedShowProgress } from "../../utils/watchState";

const RADIUS = 16;
const THUMB_W = 32;
const THUMB_H = 48;
const ACTION = 34;
// "İzledim" onayının bekleme süresi (göz → tik → göz).
const CONFIRM_MS = 3000;

const formatAirDate = (value, language) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(intlLocaleOf(language), {
    day: "numeric",
    month: "short",
  }).format(date);
};

function UpNextRailCard({
  show,
  item,
  resolved,
  cardWidth,
  theme,
  language,
  scaleValue,
  onPressIn,
  onPressOut,
  onOpen,
  onWatched,
  onChooseDate,
  onQuickActions,
}) {
  const { getTmdbUrl } = useImageQualitySettings();
  // Bulanık zemin de kullanıcının özel afiş seçimine uysun (küçük resimle aynı afiş).
  const posterUri = usePosterUri();
  const { watched, total, progress } = getWatchedShowProgress(show);
  const accent = theme.accent;
  const upcomingColor = theme.colors?.orange || "#FF9500";
  const textPrimary = theme.text?.primary || "#fff";
  const textMuted = theme.text?.muted || theme.text?.between || "#888";
  const reduceMotion = useReduceMotion();

  // ── İki adımlı "İzledim" onayı ──
  // İlk dokunuş göz simgesini tik'e çevirir; tik CONFIRM_MS boyunca bekler,
  // ikinci dokunuş bölümü işaretler. Süre dolarsa ya da bölüm değişirse göze döner.
  const [confirmArmed, setConfirmArmed] = useState(false);
  const confirmTimer = useRef(null);
  const confirmPop = useRef(new Animated.Value(1)).current;
  const disarmConfirm = useCallback(() => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmArmed(false);
  }, []);
  const armConfirm = useCallback(() => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmArmed(true);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirmArmed(false);
    }, CONFIRM_MS);
    if (!reduceMotion) {
      confirmPop.setValue(0.5);
      Animated.spring(confirmPop, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [confirmPop, reduceMotion]);
  useEffect(() => () => confirmTimer.current && clearTimeout(confirmTimer.current), []);

  // 2:1 — 16:9'dan biraz basık; kare yine tanınır, kart kısa kalır.
  const heroHeight = Math.round(cardWidth / 2);
  const posterPath = item?.showPosterPath || show.imagePath;
  const stillPath = item?.episodePosterPath || null;
  const showName = item?.showName || show.name || "";

  // 1 = durgun. Bölüm değişince 0'a çekilip yaya bırakılır; yay hafif aşar,
  // kayma bu yüzden yerine "oturur".
  const swap = useRef(new Animated.Value(1)).current;
  // undefined iskelet demek; oradan ilk çözülme animasyonsuz.
  const shownId = resolved ? item?.id ?? null : undefined;
  const lastShownId = useRef(shownId);
  useEffect(() => {
    const previous = lastShownId.current;
    lastShownId.current = shownId;
    if (previous === undefined || previous === shownId || reduceMotion) return;
    swap.setValue(0);
    Animated.spring(swap, {
      toValue: 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [shownId, reduceMotion, swap]);

  // Gösterilen bölüm değişti (izlendi, geri alındı, tazelendi): bekleyen onay
  // yeni bölüme geçmesin.
  useEffect(() => {
    disarmConfirm();
  }, [shownId, disarmConfirm]);

  const contentSwapStyle = {
    opacity: swap.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
    transform: [
      { translateX: swap.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
    ],
  };
  const pillSwapStyle = {
    transform: [
      { scale: swap.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
    ],
  };

  const airDateLabel = item ? formatAirDate(item.airDate, language) : null;

  // Kompakt alt satır: solda bölüm adı + küçük durum satırı, sağda yuvarlak
  // eylem düğmeleri. Tek satır olduğu için kart yüksekliği her durumda aynı.
  const infoColumn = (title, meta, metaColor, metaIcon, titleColor = textPrimary) => (
    <View style={styles.flex}>
      <Text numberOfLines={1} style={[styles.episodeTitle, { color: titleColor }]}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        {metaIcon ? <Ionicons name={metaIcon} size={11} color={metaColor} /> : null}
        <Text numberOfLines={1} allowFontScaling={false} style={[styles.metaText, { color: metaColor }]}>
          {meta}
        </Text>
      </View>
    </View>
  );

  let body;
  if (!resolved) {
    body = (
      <>
        <View style={styles.flex}>
          <View style={[styles.skeletonLine, { width: "75%", backgroundColor: alpha(textMuted, 0.18) }]} />
          <View style={[styles.skeletonLine, { width: "40%", marginTop: 6, backgroundColor: alpha(textMuted, 0.12) }]} />
        </View>
        <View style={[styles.roundAction, { backgroundColor: alpha(textMuted, 0.12) }]} />
      </>
    );
  } else if (!item) {
    body = infoColumn(
      i18nText("autoI18n.up_next_ray_bekleniyor", "Yeni bölüm yok"),
      i18nText("autoI18n.up_next_ray_yeni_sezon", "Sezon bekleniyor"),
      textMuted,
      "hourglass-outline",
      textMuted
    );
  } else if (!item.isAired) {
    body = infoColumn(
      item.episodeName || i18nText("autoI18n.up_next_ray_bolum", "Sıradaki bölüm"),
      airDateLabel || i18nText("autoI18n.up_next_ray_yakinda", "Yakında"),
      upcomingColor,
      "time-outline"
    );
  } else {
    body = (
      <>
        {infoColumn(
          item.episodeName || i18nText("autoI18n.up_next_ray_bolum", "Sıradaki bölüm"),
          `S${item.seasonNumber} · B${item.episodeNumber}${airDateLabel ? ` · ${airDateLabel}` : ""}`,
          textMuted
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.up_next_ray_tarih_sec", "Tarih seç")}
          hitSlop={4}
          onPress={(event) => {
            event.stopPropagation?.();
            onChooseDate(item);
          }}
          style={({ pressed }) => [
            styles.roundAction,
            { backgroundColor: alpha(accent, pressed ? 0.26 : 0.14) },
          ]}
        >
          <Ionicons name="calendar-outline" size={15} color={accent} />
        </Pressable>
        {/* İki adımlı İzledim: göz → (3 sn) tik → işaretle. Yanlışlıkla
            dokunma bölümü ilerletmesin diye. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            confirmArmed
              ? i18nText("autoI18n.onayla", "Onayla")
              : i18nText("autoI18n.up_next_ray_izledim", "İzledim")
          }
          hitSlop={4}
          onPress={(event) => {
            event.stopPropagation?.();
            if (!confirmArmed) {
              armConfirm();
              return;
            }
            disarmConfirm();
            onWatched(item);
          }}
          style={({ pressed }) => [
            styles.roundAction,
            confirmArmed
              ? { backgroundColor: pressed ? alpha(accent, 0.72) : accent }
              : { backgroundColor: alpha(accent, pressed ? 0.26 : 0.14) },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: confirmPop }] }}>
            <Ionicons
              name={confirmArmed ? "checkmark" : "eye-outline"}
              size={confirmArmed ? 18 : 16}
              color={confirmArmed ? "#fff" : accent}
            />
          </Animated.View>
        </Pressable>
      </>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={() => onPressIn(show.id)}
      onPressOut={() => onPressOut(show.id)}
      onPress={() => onOpen(show)}
      onLongPress={onQuickActions ? () => onQuickActions(show) : undefined}
      delayLongPress={350}
      style={[styles.cell, { width: cardWidth }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleValue }],
            backgroundColor: theme.secondary,
            borderColor: alpha(theme.border || "#888", 0.6),
            shadowColor: theme.shadow,
          },
        ]}
      >
        {/* ── Üst: bölüm karesi ── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          {stillPath ? (
            <Image
              source={{ uri: getTmdbUrl(stillPath, "still", 300) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={`upnext-still-${show.id}`}
              transition={160}
            />
          ) : posterPath ? (
            // Kare yoksa: afişin bulanık hali zemin olur (16:9'a kırpılmış afiş
            // yerine renk ve doku verir).
            <Image
              source={{ uri: posterUri("tv", show.id, posterPath, 92) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={18}
              cachePolicy="memory-disk"
              recyclingKey={`upnext-blur-${show.id}`}
              transition={160}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(accent, 0.25) }]} />
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.85)"]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Sıradaki bölüm numarası — sol üst */}
          {item ? (
            <Animated.View
              style={[
                styles.episodePill,
                {
                  backgroundColor: item.isAired
                    ? alpha(accent, 0.95)
                    : alpha(upcomingColor, 0.95),
                },
                pillSwapStyle,
              ]}
            >
              <Ionicons
                name={item.isAired ? "play" : "time"}
                size={10}
                color="#fff"
              />
              <Text allowFontScaling={false} style={styles.episodePillText}>
                S{item.seasonNumber} · B{item.episodeNumber}
              </Text>
            </Animated.View>
          ) : null}

          {/* İzlenen/toplam bölüm — sağ üst */}
          {total > 0 || watched > 0 ? (
            <View style={styles.countBadge}>
              <Text allowFontScaling={false} style={styles.countText}>
                {total > 0 ? `${watched}/${total}` : watched}
              </Text>
            </View>
          ) : null}

          {/* Afiş küçük resmi + dizi adı — alt */}
          <View style={styles.heroFooter}>
            <View style={styles.thumbWrap}>
              <PosterImage
                path={posterPath}
                type="tv"
                mediaId={show.id}
                size={92}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`upnext-thumb-${show.id}`}
                transition={120}
              />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.showName}>
                {showName}
              </Text>
              {progress > 0 ? (
                <Text allowFontScaling={false} style={styles.progressText}>
                  {new Intl.NumberFormat(intlLocaleOf(language), {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(Math.max(0, Math.min(1, progress)))}
                </Text>
              ) : null}
            </View>
          </View>

          {/* İlerleme çubuğu — karenin altına yapışık */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
        </View>

        {/* ── Alt: sıradaki bölüm ── */}
        <Animated.View style={[styles.body, contentSwapStyle]}>{body}</Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cell: { marginRight: 10, marginBottom: 6 },
  card: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  hero: { width: "100%", overflow: "hidden" },
  episodePill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  episodePillText: { color: "#fff", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.2 },
  countBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  countText: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
  heroFooter: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 9,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  thumbWrap: {
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  showName: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressText: {
    marginTop: 2,
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  progressFill: { height: "100%", borderTopRightRadius: 2, borderBottomRightRadius: 2 },

  // ── Alt içerik (tek satır) ──
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  episodeTitle: { fontSize: 13, lineHeight: 17, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  metaText: { fontSize: 11, fontWeight: "600" },
  roundAction: {
    width: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonLine: { height: 11, borderRadius: 6 },
});

export default memo(UpNextRailCard);

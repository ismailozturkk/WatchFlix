// components/lists/WatchPickerSheet.js
//
// "Ne izlesem?" seçim sayfası (eski tam ekran "kasa açma" modalının yerine). Ortak alt sayfa kabuğu
// (BottomSheetModal: blur yerinde solar, sayfa kayar) + tema renkleri.
//
//   üst     : başlık + "N yapım arasından" + kapat
//   tür     : Karışık · Film · Dizi (sayılı çipler; boş tür kapalı) — eskiden gizli kaydırma hareketiydi
//   sahne   : afiş + (karıştırırken) kısa, yavaşlayan kare dizisi, (bitince) tür/yıl/puan, ad, süre, türler,
//             "neden bu?" gerekçesi ve özet. Karıştırma ≈ 1 sn, DOKUNARAK atlanır, "Hareketi azalt"ta yok.
//   şerit   : bu oturumda çıkanlar (dokununca geri gelir)
//   eylem   : Başka biri (tekrarsız) · Detaylara git
//
// Kararlar utils/watchPicker.js'te (saf, testli). Özet/yıl/puan TMDB'den yalnız SEÇİLEN yapım için çekilir
// (önbellekli); cevap gelmezse sayfa onsuz da eksiksiz çalışır. Detaya gitme sayfa KAPANDIKTAN sonra
// (`onDismissed`) yapılır: kapanan Modal üstüne push iOS'ta takılır (bkz. components/common/BottomSheetModal).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import PosterImage from "@components/PosterImage";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings } from "@context/AppSettingsContext";
import useReduceMotion from "@hooks/useReduceMotion";
import usePosterUri from "@hooks/usePosterUri";
import * as Haptics from "@services/hapticsService";
import { readTmdb } from "@services/favoriteRecommendations";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { alpha } from "@theme/colors";
import { readableTextOn } from "@utils/colorUtils";
import { buildGenreMap } from "@utils/genreLabels";
import {
  PICK_TYPES,
  countsOf,
  defaultTypeFor,
  factParts,
  frameDelays,
  keyOf,
  pickNext,
  poolFor,
  reasonOf,
  releaseInfoOf,
  shuffleFrames,
} from "@utils/watchPicker";
import { fillPickerCopy, getWatchPickerCopy, reasonText } from "@utils/watchPickerCopy";
import GlassPressable from "../common/GlassPressable";

const HISTORY_MAX = 6;
const OPEN_SETTLE_MS = 260; // sayfa kayarken başlamasın

function genreNamesOf(item, genreMap) {
  const raw = item?.genres || item?.genre_ids || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      if (typeof g === "number") return genreMap[g] || null;
      if (typeof g === "string") {
        const num = Number(g);
        return !Number.isNaN(num) && genreMap[num] ? genreMap[num] : g;
      }
      return g && g.name ? g.name : null;
    })
    .filter(Boolean);
}

export default function WatchPickerSheet({ visible, onClose, items, filtered = false, initialType, onOpen }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const posterUri = usePosterUri();
  const reduceMotion = useReduceMotion();
  const copy = useMemo(() => getWatchPickerCopy(language), [language]);
  const genreMap = useMemo(() => buildGenreMap(), [language]);

  const accent = theme.accent;
  const onAccent = readableTextOn(accent);

  const [type, setType] = useState("mixed");
  const [phase, setPhase] = useState("idle"); // idle | shuffling | settled
  const [shown, setShown] = useState(null);
  const [history, setHistory] = useState([]);
  const [cycled, setCycled] = useState(false);
  const [details, setDetails] = useState(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const seenRef = useRef([]);
  const timersRef = useRef([]);
  const winnerRef = useRef(null);
  const rollsRef = useRef(0);
  const pendingOpenRef = useRef(null);
  const pop = useRef(new Animated.Value(1)).current;

  const counts = useMemo(() => countsOf(items), [items]);
  const pool = useMemo(() => poolFor(items, type), [items, type]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const settle = useCallback(
    (item, { record = true, celebrate = true } = {}) => {
      clearTimers();
      winnerRef.current = item;
      setShown(item);
      setPhase("settled");
      if (record) {
        setHistory((current) =>
          [item, ...current.filter((entry) => keyOf(entry) !== keyOf(item))].slice(0, HISTORY_MAX),
        );
      }
      if (celebrate) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      pop.stopAnimation();
      if (reduceMotion) {
        pop.setValue(1);
      } else {
        pop.setValue(0.9);
        Animated.spring(pop, { toValue: 1, damping: 12, stiffness: 190, mass: 0.7, useNativeDriver: true }).start();
      }
    },
    [clearTimers, pop, reduceMotion],
  );

  const roll = useCallback(
    (nextType) => {
      clearTimers();
      const nextPool = poolFor(itemsRef.current, nextType);
      const { item, seen, cycled: didCycle } = pickNext({
        pool: nextPool,
        seen: seenRef.current,
        current: winnerRef.current,
      });
      if (!item) {
        winnerRef.current = null;
        setShown(null);
        setPhase("idle");
        return;
      }
      seenRef.current = seen;
      setCycled(didCycle);
      rollsRef.current += 1;
      trackEvent(ANALYTICS_EVENTS.WATCH_PICK_ROLLED, {
        media_type: nextType,
        pool_size: nextPool.length,
        reroll: rollsRef.current > 1,
      });

      const frames = reduceMotion ? [item] : shuffleFrames({ pool: nextPool, winner: item });
      if (frames.length <= 1) {
        settle(item);
        return;
      }
      winnerRef.current = item;
      setPhase("shuffling");
      const delays = frameDelays(frames.length);
      let index = 0;
      const step = () => {
        setShown(frames[index]);
        if (index >= frames.length - 1) {
          settle(item);
          return;
        }
        Haptics.selectionAsync().catch(() => {});
        const timer = setTimeout(() => {
          index += 1;
          step();
        }, delays[index]);
        timersRef.current.push(timer);
      };
      step();
    },
    [clearTimers, reduceMotion, settle],
  );

  // Açılış: türü seç, durumu sıfırla, sayfa yerine oturunca ilk seçimi yap. Kapanışta durum KORUNUR
  // (çıkış animasyonunda içerik boşalıp zıplamasın); zamanlayıcılar durur.
  useEffect(() => {
    if (!visible) {
      clearTimers();
      return undefined;
    }
    // İstenen tür (giriş satırındaki Film / Dizi düğmeleri) varsa ve havuzu doluysa o; yoksa varsayılan.
    const available = countsOf(itemsRef.current);
    const start = initialType && available[initialType] > 0 ? initialType : defaultTypeFor(available);
    seenRef.current = [];
    winnerRef.current = null;
    rollsRef.current = 0;
    setType(start);
    setHistory([]);
    setCycled(false);
    setDetails(null);
    setShown(null);
    setPhase("idle");
    const timer = setTimeout(() => roll(start), OPEN_SETTLE_MS);
    return () => clearTimeout(timer);
    // roll/clearTimers kararlı; yalnız açılış anı tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => clearTimers, [clearTimers]);

  // Seçilen yapımın yıl / puan / özeti.
  const shownKey = shown ? keyOf(shown) : null;
  useEffect(() => {
    setDetails(null);
    if (phase !== "settled" || !shown || !API_KEY) return undefined;
    let cancelled = false;
    readTmdb(`/${shown.type}/${shown.id}`, { apiKey: API_KEY, language, type: shown.type })
      .then((data) => {
        if (!cancelled) setDetails(releaseInfoOf(data, shown.type));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // shown nesnesi yerine anahtarı: aynı yapım için yeniden istek atma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shownKey, API_KEY, language]);

  const changeType = useCallback(
    (next) => {
      if (next === type || counts[next] === 0) return;
      Haptics.selectionAsync().catch(() => {});
      setType(next);
      seenRef.current = [];
      winnerRef.current = null;
      setHistory([]);
      roll(next);
    },
    [counts, roll, type],
  );

  const skipShuffle = useCallback(() => {
    if (phase === "shuffling" && winnerRef.current) settle(winnerRef.current, { celebrate: false });
  }, [phase, settle]);

  const openShown = useCallback(() => {
    if (!shown || phase === "shuffling") return;
    pendingOpenRef.current = shown;
    trackEvent(ANALYTICS_EVENTS.WATCH_PICK_OPENED, {
      media_type: shown.type,
      rerolls: Math.max(0, rollsRef.current - 1),
    });
    onClose();
  }, [onClose, phase, shown]);

  const handleDismissed = useCallback(() => {
    const target = pendingOpenRef.current;
    pendingOpenRef.current = null;
    if (target) onOpen?.(target);
  }, [onOpen]);

  const shuffling = phase === "shuffling";
  const genres = useMemo(() => genreNamesOf(shown, genreMap).slice(0, 3), [shown, genreMap]);
  const facts = useMemo(() => factParts(shown, copy.sheet.units), [shown, copy]);
  const reason = useMemo(() => reasonText(copy, reasonOf(shown)), [shown, copy]);
  const metaLine = [
    shown ? copy.sheet.kind[shown.type] : null,
    details?.year || null,
    ...facts,
  ].filter(Boolean);

  // Arka plan bulanığı öndeki afişle aynı görsel (özel afiş dahil).
  const backdropUri = shuffling ? null : posterUri(shown?.type, shown?.id, shown?.imagePath, 500);
  const backdrop = backdropUri ? { uri: backdropUri } : null;
  const poolLine = fillPickerCopy(filtered ? copy.sheet.poolFiltered : copy.sheet.pool, pool.length);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={handleDismissed}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: alpha(accent, 0.16) }]}>
          <Ionicons name="dice" size={20} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: theme.text.primary }]}>
            {copy.sheet.title}
          </Text>
          <Text
            testID="watch-picker-pool"
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.text.muted }]}
          >
            {poolLine}
          </Text>
        </View>
        <GlassCloseButton
          size={34}
          fallbackRadius={11}
          onPress={onClose}
          accessibilityLabel={copy.sheet.close}
        />
      </View>

      <View style={[styles.segment, { backgroundColor: theme.primary, borderColor: theme.border }]}>
        {PICK_TYPES.map((id) => {
          const selected = id === type;
          const empty = counts[id] === 0;
          return (
            <GlassPressable
              key={id}
              testID={`watch-picker-type-${id}`}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: empty }}
              disabled={empty}
              onPress={() => changeType(id)}
              style={[styles.segmentItem, selected && { backgroundColor: accent }, empty && styles.segmentEmpty]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.segmentText, { color: selected ? onAccent : theme.text.secondary }]}
              >
                {copy.sheet.types[id]}
              </Text>
              <View
                style={[
                  styles.segmentCount,
                  { backgroundColor: selected ? alpha(onAccent, 0.2) : alpha(theme.text.muted, 0.16) },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.segmentCountText, { color: selected ? onAccent : theme.text.muted }]}
                >
                  {counts[id] > 999 ? "999+" : counts[id]}
                </Text>
              </View>
            </GlassPressable>
          );
        })}
      </View>

      <SheetScroll>
        <Pressable
          testID="watch-picker-stage"
          onPress={skipShuffle}
          disabled={!shuffling}
          accessibilityLabel={shuffling ? copy.sheet.shuffling : undefined}
          style={[styles.stage, { backgroundColor: theme.primary, borderColor: theme.border }]}
        >
          {backdrop ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} />
              <LinearGradient
                colors={[alpha(theme.primary, 0.55), alpha(theme.primary, 0.96)]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : null}

          {shown ? (
            <>
              <Animated.View style={[styles.posterWrap, { transform: [{ scale: pop }] }]}>
                <PosterImage
                  path={shown.imagePath}
                  type={shown.type}
                  mediaId={shown.id}
                  size={300}
                  style={styles.poster}
                  contentFit="cover"
                  transition={0}
                />
                <View style={[styles.posterAccent, { backgroundColor: accent }]} />
              </Animated.View>

              <View style={styles.info}>
                {shuffling ? (
                  <View style={styles.shuffleRow}>
                    <Ionicons name="shuffle" size={14} color={accent} />
                    <Text allowFontScaling={false} style={[styles.shuffleText, { color: accent }]}>
                      {copy.sheet.shuffling}
                    </Text>
                  </View>
                ) : (
                  <Text
                    testID="watch-picker-meta"
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[styles.meta, { color: theme.text.muted }]}
                  >
                    {metaLine.join("  ·  ")}
                  </Text>
                )}

                <Text
                  testID="watch-picker-title"
                  numberOfLines={3}
                  style={[styles.name, { color: shuffling ? theme.text.secondary : theme.text.primary }]}
                >
                  {shown.name}
                </Text>

                {!shuffling ? (
                  <>
                    {details?.rating ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={13} color="#FBBF24" />
                        <Text allowFontScaling={false} style={[styles.ratingText, { color: theme.text.primary }]}>
                          {details.rating.toFixed(1)}
                        </Text>
                      </View>
                    ) : null}

                    {genres.length > 0 ? (
                      <View style={styles.genreRow}>
                        {genres.map((genre) => (
                          <View
                            key={genre}
                            style={[styles.genreChip, { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.3) }]}
                          >
                            <Text
                              allowFontScaling={false}
                              numberOfLines={1}
                              style={[styles.genreText, { color: theme.text.primary }]}
                            >
                              {genre}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {reason ? (
                      <View style={styles.reasonRow}>
                        <Ionicons name="sparkles" size={12} color={accent} />
                        <Text testID="watch-picker-reason" style={[styles.reasonText, { color: theme.text.secondary }]}>
                          {reason}
                        </Text>
                      </View>
                    ) : null}

                    {details?.overview ? (
                      <Text numberOfLines={3} style={[styles.overview, { color: theme.text.muted }]}>
                        {details.overview}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            </>
          ) : pool.length === 0 ? (
            <View style={styles.emptyStage}>
              <Ionicons name="albums-outline" size={34} color={theme.text.muted} />
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>{copy.sheet.emptyType}</Text>
            </View>
          ) : (
            // Sayfa yerine otururken (ilk seçimden önce) boş-durum metni titremesin: afiş yer tutucusu.
            <View style={[styles.posterWrap, { backgroundColor: theme.secondary }]} />
          )}
        </Pressable>

        {details?.unreleased && !shuffling ? (
          <View
            testID="watch-picker-unreleased"
            style={[styles.notice, { backgroundColor: alpha("#F59E0B", 0.14), borderColor: alpha("#F59E0B", 0.4) }]}
          >
            <Ionicons name="time-outline" size={15} color="#F59E0B" />
            <Text style={[styles.noticeText, { color: theme.text.primary }]}>{copy.sheet.unreleased}</Text>
          </View>
        ) : null}

        {cycled && !shuffling ? (
          <Text testID="watch-picker-cycled" style={[styles.cycled, { color: theme.text.muted }]}>
            {copy.sheet.cycled}
          </Text>
        ) : null}

        {history.length > 1 ? (
          <View style={styles.history}>
            <Text allowFontScaling={false} style={[styles.historyLabel, { color: theme.text.muted }]}>
              {copy.sheet.history}
            </Text>
            <View style={styles.historyRow}>
              {history.map((entry) => {
                const current = shown && keyOf(entry) === keyOf(shown);
                return (
                  <Pressable
                    key={keyOf(entry)}
                    testID={`watch-picker-history-${entry.type}-${entry.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={entry.name}
                    disabled={shuffling}
                    onPress={() => settle(entry, { record: false, celebrate: false })}
                    style={[
                      styles.historyItem,
                      { borderColor: current ? accent : "transparent" },
                    ]}
                  >
                    <PosterImage
                      path={entry.imagePath}
                      type={entry.type}
                      mediaId={entry.id}
                      size={92}
                      contentFit="cover"
                      style={styles.historyPoster}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </SheetScroll>

      <View style={styles.actions}>
        <GlassPressable
          testID="watch-picker-reroll"
          accessibilityRole="button"
          disabled={shuffling || pool.length === 0}
          onPress={() => roll(type)}
          style={[
            styles.secondaryButton,
            { backgroundColor: theme.primary, borderColor: theme.border },
            (shuffling || pool.length === 0) && styles.dim,
          ]}
        >
          <Ionicons name="shuffle" size={18} color={theme.text.primary} />
          <Text allowFontScaling={false} style={[styles.secondaryText, { color: theme.text.primary }]}>
            {copy.sheet.reroll}
          </Text>
        </GlassPressable>
        <GlassPressable
          testID="watch-picker-open"
          accessibilityRole="button"
          disabled={!shown || shuffling}
          onPress={openShown}
          style={[styles.primaryButton, { backgroundColor: accent }, (!shown || shuffling) && styles.dim]}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.primaryText, { color: onAccent }]}>
            {copy.sheet.open}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={onAccent} />
        </GlassPressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 },
  headerTile: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "600" },

  segment: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentEmpty: { opacity: 0.4 },
  segmentText: { fontSize: 13, fontWeight: "800" },
  segmentCount: { minWidth: 18, height: 16, borderRadius: 8, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  segmentCountText: { fontSize: 10, fontWeight: "800" },

  stage: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    minHeight: 204,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  posterWrap: {
    width: 120,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    alignSelf: "center",
  },
  poster: { width: "100%", height: "100%" },
  posterAccent: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4 },
  info: { flex: 1, minWidth: 0, justifyContent: "center", gap: 7 },
  meta: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  shuffleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  shuffleText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  name: { fontSize: 20, lineHeight: 24, fontWeight: "800", letterSpacing: -0.3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingText: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genreChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, maxWidth: "100%" },
  genreText: { fontSize: 11, fontWeight: "700" },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reasonText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  overview: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  emptyStage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  cycled: { marginTop: 10, fontSize: 12, fontWeight: "600", textAlign: "center" },

  history: { marginTop: 14, gap: 8 },
  historyLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  historyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyItem: { borderWidth: 2, borderRadius: 9, padding: 1 },
  historyPoster: { width: 38, height: 57, borderRadius: 7 },

  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 14, fontWeight: "800" },
  primaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { fontSize: 15, fontWeight: "800" },
  dim: { opacity: 0.45 },
});

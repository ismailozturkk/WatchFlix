// components/challenges/ChallengeSheet.js
//
// Meydan okumanın ayrıntı sayfası (screens/fun/ChallengesScreen.js'ten açılır): madalya + ad + açıklama + pencere,
// ilerleme (etkinse), sayılanlar ve katıl / bırak.
//
// Sayılanlar kurala göre çizilir:
//   • yönetmen  → filmografinin TAMAMI ızgarada; izlenenler işaretli, izlenmeyenler soluk (ne kaldığı görünsün)
//   • on yıl    → 8 yuva (1950'ler…2020'ler); dolan yuvada o on yılı dolduran film
//   • bölüm     → dizi başına bölüm sayısı
//   • diğerleri → sayılan filmlerin afişleri (ülke görevinde bayraklı)
//
// "Bırak" ONAYI sayfanın İÇİNDE (iki adımlı düğme): iOS'ta açık bir Modal'ın üstüne uyarı penceresi sunulamaz
// (bkz. utils/premiumUpsell iOS iki Modal kuralı). Afişe dokunmak sayfayı kapatır, ayrıntı ekranı sayfa tamamen
// kalktıktan SONRA açılır (`onDismissed`).

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import SheetScroll from "@components/common/SheetScroll";
import { formatTarih } from "@components/badges/badgeFormat";
import { useTheme } from "@context/ThemeContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { fetchPersonTitles } from "@services/watchChallengeMeta";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { flagOf } from "../../utils/watchChallenges";
import { ChallengeBar, ChallengeMedal, ChallengePoster } from "./ChallengeParts";

const COLUMNS = 4;
const GAP = 8;
const SIDE = 16;

export default function ChallengeSheet({
  item,
  visible,
  copy,
  language,
  onClose,
  onDismissed,
  onJoin,
  onLeave,
  onOpenMedia,
}) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pendingOpen = useRef(null);

  // Başka bir göreve geçilince / sayfa kapanınca onay sıfırlansın.
  useEffect(() => setConfirmLeave(false), [item?.challenge?.id, visible]);

  // Yönetmen filmlerinin seçili dildeki başlıkları; çevirisi olmayan film İngilizce kalır.
  const { API_KEY } = useApiSettings();
  const personId = visible ? item?.challenge?.person?.id : null;
  const personRole = item?.challenge?.person?.role || "director";
  const [titles, setTitles] = useState({ key: null, map: {} });
  useEffect(() => {
    if (!personId) return undefined;
    const key = `${personId}:${language}`;
    let alive = true;
    fetchPersonTitles({ personId, role: personRole, apiKey: API_KEY, language }).then((map) => {
      if (alive) setTitles({ key, map });
    });
    return () => {
      alive = false;
    };
  }, [personId, personRole, language, API_KEY]);
  const titleMap = titles.key === `${personId}:${language}` ? titles.map : {};

  const challenge = item?.challenge;
  if (!challenge) return null;
  const { progress, run, daysLeft, pace, blocker } = item;
  const color = challenge.colors[0];
  const isActive = run?.status === "active";
  const isDone = run?.status === "done";
  const posterWidth = Math.floor((Math.min(screenWidth, 520) - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const openMedia = (media) => {
    pendingOpen.current = media;
    onClose();
  };

  const statusLine = isDone
    ? copy.doneOn(formatTarih(run.endedAt, language))
    : run?.status === "expired"
      ? copy.expiredOn(formatTarih(run.endedAt, language))
      : null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      onDismissed={() => {
        const media = pendingOpen.current;
        pendingOpen.current = null;
        onDismissed?.();
        if (media) onOpenMedia(media);
      }}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <SheetScroll style={styles.scrollRoom} contentContainerStyle={styles.scrollRoomContent}>
        <View style={styles.header}>
          <ChallengeMedal challenge={challenge} size={56} />
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{copy.titleOf(challenge)}</Text>
            <Text style={[styles.window, { color }]}>{copy.windowOf(challenge)}</Text>
          </View>
          <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
        </View>
        <Text style={[styles.desc, { color: theme.text.secondary }]}>{copy.descOf(challenge)}</Text>

        {isActive || isDone || run?.status === "expired" ? (
          <View style={[styles.progressCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <View style={styles.progressTop}>
              <Text style={[styles.progressCount, { color: theme.text.primary }]}>
                {copy.count(Math.min(progress.count, progress.target), progress.target)}
              </Text>
              <Text style={[styles.progressMeta, { color: theme.text.muted }]} numberOfLines={1}>
                {statusLine || (daysLeft == null ? copy.noDeadline : copy.daysLeft(daysLeft))}
              </Text>
            </View>
            <ChallengeBar ratio={isDone ? 1 : progress.ratio} color={color} height={8} />
            {isActive && pace ? (
              <Text style={[styles.pace, { color: pace.ahead ? "#22C55E" : theme.text.muted }]}>
                {pace.ahead ? copy.paceAhead : copy.paceBehind(pace.expected)}
              </Text>
            ) : null}
          </View>
        ) : progress.count > 0 ? (
          <Text style={[styles.preview, { color }]}>{copy.previewNote(progress.count)}</Text>
        ) : null}

        <Counted
          challenge={challenge}
          progress={progress}
          copy={copy}
          theme={theme}
          color={color}
          posterWidth={posterWidth}
          titles={titleMap}
          onOpen={openMedia}
        />

        {isActive ? (
          confirmLeave ? (
            <View style={[styles.confirm, { borderColor: theme.border, backgroundColor: theme.primary }]}>
              <Text style={[styles.confirmTitle, { color: theme.text.primary }]}>{copy.leaveTitle}</Text>
              <Text style={[styles.confirmBody, { color: theme.text.secondary }]}>{copy.leaveBody}</Text>
              <View style={styles.confirmRow}>
                <GlassTouchable
                  glass={false}
                  onPress={() => setConfirmLeave(false)}
                  accessibilityRole="button"
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                >
                  <Text style={[styles.secondaryText, { color: theme.text.primary }]}>{copy.cancel}</Text>
                </GlassTouchable>
                <GlassTouchable
                  glass={false}
                  onPress={() => onLeave(challenge.id)}
                  accessibilityRole="button"
                  style={[styles.secondaryBtn, styles.dangerBtn]}
                >
                  <Text style={styles.dangerText}>{copy.leave}</Text>
                </GlassTouchable>
              </View>
            </View>
          ) : (
            <GlassTouchable
              glass={false}
              onPress={() => setConfirmLeave(true)}
              accessibilityRole="button"
              style={styles.leaveLink}
            >
              <Text style={[styles.leaveText, { color: theme.text.muted }]}>{copy.leave}</Text>
            </GlassTouchable>
          )
        ) : blocker === "ok" ? (
          <GlassTouchable
            glass={false}
            onPress={() => onJoin(challenge.id)}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: color }]}
          >
            <AppIcon family="Ionicons" name="flag" size={16} color="#FFFFFF" />
            <Text style={styles.ctaText}>{copy.join}</Text>
          </GlassTouchable>
        ) : blocker && blocker !== "active" ? (
          <Text style={[styles.blocker, { color: theme.text.muted }]}>
            {blocker === "full" ? copy.full(item.maxActive) : blocker === "season" ? copy.seasonOnly : copy.alreadyDone}
          </Text>
        ) : null}
      </SheetScroll>
    </BottomSheetModal>
  );
}

function Counted({ challenge, progress, copy, theme, color, posterWidth, titles, onOpen }) {
  const kind = challenge.rule.kind;
  const header = (
    <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{copy.counted.toLocaleUpperCase()}</Text>
  );
  const pending = progress.pending?.length ? (
    <Text style={[styles.pending, { color: theme.text.muted }]}>{copy.pending}</Text>
  ) : null;

  if (kind === "person") {
    return (
      <View style={styles.section}>
        {header}
        <View style={styles.grid}>
          {progress.slots.map((film) => {
            const title = titles[film.key] || film.title;
            return (
              <GlassTouchable
                key={film.key}
                glass={false}
                onPress={() => onOpen({ type: "movie", id: film.id })}
                accessibilityRole="button"
                accessibilityLabel={`${title} (${film.year})${film.watched ? `, ${copy.watched}` : ""}`}
                style={{ width: posterWidth }}
              >
                <ChallengePoster id={film.id} path={film.posterPath} width={posterWidth} watched={film.watched} color={color} />
                <Text style={[styles.cellTitle, { color: film.watched ? theme.text.primary : theme.text.muted }]} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={[styles.cellSub, { color: theme.text.muted }]}>{film.year}</Text>
              </GlassTouchable>
            );
          })}
        </View>
      </View>
    );
  }

  if (kind === "decades") {
    return (
      <View style={styles.section}>
        {header}
        {pending}
        <View style={styles.grid}>
          {progress.slots.map((slot) => (
            <GlassTouchable
              key={slot.key}
              glass={false}
              disabled={!slot.film}
              onPress={() => slot.film && onOpen({ type: "movie", id: slot.film.id })}
              accessibilityLabel={`${copy.decade(slot.decade)}${slot.film ? `: ${slot.film.name}` : ""}`}
              style={{ width: posterWidth }}
            >
              {slot.film ? (
                <ChallengePoster id={slot.film.id} path={slot.film.imagePath} width={posterWidth} color={color} />
              ) : (
                <View style={[styles.emptySlot, { width: posterWidth, height: posterWidth * 1.5, borderColor: theme.border }]}>
                  <AppIcon family="Ionicons" name="add" size={18} color={theme.text.muted} />
                </View>
              )}
              <Text style={[styles.cellTitle, { color: slot.film ? color : theme.text.muted }]} numberOfLines={1}>
                {copy.decade(slot.decade)}
              </Text>
            </GlassTouchable>
          ))}
        </View>
      </View>
    );
  }

  if (!progress.matches.length) {
    return (
      <View style={styles.section}>
        {header}
        {pending}
        <Text style={[styles.empty, { color: theme.text.muted }]}>{copy.countedEmpty}</Text>
      </View>
    );
  }

  if (kind === "episodes" || kind === "shows" || kind === "episodeDay") {
    return (
      <View style={styles.section}>
        {header}
        {progress.matches.map((show) => (
          <GlassTouchable
            key={show.key}
            glass={false}
            onPress={() => onOpen({ type: "tv", id: show.id })}
            accessibilityRole="button"
            style={[styles.showRow, { borderColor: theme.border }]}
          >
            <ChallengePoster type="tv" id={show.id} path={show.imagePath} width={36} check={false} />
            <Text style={[styles.showName, { color: theme.text.primary }]} numberOfLines={1}>
              {show.name}
            </Text>
            <Text style={[styles.showCount, { color }]}>{copy.episodes(show.episodes)}</Text>
          </GlassTouchable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {header}
      {pending}
      <View style={styles.grid}>
        {progress.matches.map((film) => (
          <GlassTouchable
            key={film.key}
            glass={false}
            onPress={() => onOpen({ type: "movie", id: film.id })}
            accessibilityRole="button"
            accessibilityLabel={film.name}
            style={{ width: posterWidth }}
          >
            <ChallengePoster id={film.id} path={film.imagePath} width={posterWidth} color={color} />
            <Text style={[styles.cellTitle, { color: theme.text.primary }]} numberOfLines={1}>
              {kind === "countries" || kind === "country" ? `${flagOf(film.label)} ${film.name}` : film.name}
            </Text>
          </GlassTouchable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SIDE,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "88%",
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  scrollRoom: { marginTop: -GLASS_PRESS_ROOM },
  scrollRoomContent: { paddingTop: GLASS_PRESS_ROOM },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  window: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  progressCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  progressTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  progressCount: { fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] },
  progressMeta: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  pace: { fontSize: 12, fontWeight: "700" },
  preview: { fontSize: 12, fontWeight: "800", marginTop: 12 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 10 },
  pending: { fontSize: 12, marginBottom: 8 },
  empty: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, rowGap: 12 },
  cellTitle: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  cellSub: { fontSize: 10, marginTop: 1 },
  emptySlot: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  showRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  showName: { flex: 1, fontSize: 14, fontWeight: "700" },
  showCount: { fontSize: 13, fontWeight: "800" },
  cta: {
    marginTop: 22,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  blocker: { marginTop: 22, textAlign: "center", fontSize: 13, fontWeight: "700" },
  leaveLink: { marginTop: 22, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8 },
  leaveText: { fontSize: 13, fontWeight: "700" },
  confirm: { marginTop: 22, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  confirmTitle: { fontSize: 15, fontWeight: "900" },
  confirmBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "800" },
  dangerBtn: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  dangerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});

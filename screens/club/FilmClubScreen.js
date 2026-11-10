// screens/club/FilmClubScreen.js
//
// Film Kulübü (docs/ozellikler/FILM_KULUBU.md) — bir grubun kulüp ekranı. Rota parametresi: `groupId`
// (+ isteğe bağlı `roundId`: sohbet kartından gelince o tur seçili açılır).
//
//   [kulüp kapalı]  tanıtım + (yönetici) sıklık + "Kulübü kur" (Premium)
//   [açık tur]      Oylama: aday afiş ızgarası, oy sayıları, kalan süre, (yönetici) "Oylamayı kapat"
//                   İzleme: seçilen film, "N/M izledi", İzledim + 1–10 puan, Tartışma (izleyince açılır), "Turu bitir"
//   [tur yok]       (yönetici) "Yeni tur başlat" → ClubCandidatePicker
//   [arşiv]         kulüp istatistiği + biten turlar (dokununca üstteki kartta açılır)
//   [ayarlar]       (yönetici) sıklık, kulübü kapat
//
// Süresi dolan evreyi ekranı açan herhangi bir üye kapatır (services/filmClubService transaction; aynı anda iki üye
// açsa da duyuru bir kez yazılır). Kurallar utils/filmClub.js, yetki firestore.rules.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import LensLoader from "../../components/LensLoader";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import ClubCandidatePicker, { CLUB_ACCENT } from "@components/club/ClubCandidatePicker";
import GlassPressable from "@components/common/GlassPressable";
import GlassSegmentedControl from "@components/common/GlassSegmentedControl";
import UserAvatar from "@components/common/UserAvatar";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useTheme } from "@context/ThemeContext";
import useClubSender from "@hooks/useClubSender";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import {
  castClubVote,
  closeClubVoting,
  finishClubRound,
  setClubRating,
  setClubSettings,
  setClubWatched,
  startClubRound,
  subscribeClubRounds,
} from "@services/filmClubService";
import { subscribeGroup } from "@services/groupsService";
import {
  CLUB_CADENCES,
  CLUB_RATING_MAX,
  CLUB_RATING_MIN,
  DEFAULT_CADENCE,
  activeRoundOf,
  canCloseVoting,
  canFinishRound,
  candidateIdOf,
  clubStats,
  hasWatched,
  msLeft,
  myRatingOf,
  myVoteOf,
  nextClubVote,
  nextRoundNumber,
  roundPhase,
  roundStats,
  splitLeft,
  tallyRound,
} from "@utils/filmClub";
import { getFilmClubCopy } from "@utils/filmClubCopy";
import { canManageGroup } from "@utils/groupRoles";
import { GLASS_PRESS_ROOM } from "@utils/liquidGlass";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { GameScreenShell, gameSharedStyles } from "../game/GameScreenShell";
import { isBetaFeature } from "@utils/betaFeatures";
import usePosterCorner from "@hooks/usePosterCorner";
import { percentText } from "@utils/i18nText";

const HERO = ["#3B2410", "#7A4A12", CLUB_ACCENT];
const MINUTE = 60 * 1000;
const RATINGS = Array.from({ length: CLUB_RATING_MAX - CLUB_RATING_MIN + 1 }, (_, i) => CLUB_RATING_MIN + i);

function Poster({ path, width, theme, style }) {
  const uri = buildTmdbUrl(path, "poster", width * 2);
  const corner = usePosterCorner("fun");
  return (
    <View style={[styles.poster, { width, height: width * 1.5, borderRadius: corner(8), backgroundColor: theme.secondary }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      ) : (
        <AppIcon family="Ionicons" name="film-outline" size={width * 0.35} color={theme.text.muted} />
      )}
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, busy, disabled, color = CLUB_ACCENT, theme, testID }) {
  const off = disabled || busy;
  return (
    <GlassPressable
      glass={false}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        gameSharedStyles.primaryButton,
        { backgroundColor: off && !busy ? theme.secondary : color },
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <LensLoader tone="mono" color="#fff" />
      ) : (
        <>
          {icon ? <AppIcon family="Ionicons" name={icon} size={18} color="#fff" /> : null}
          <Text style={gameSharedStyles.primaryButtonText}>{label}</Text>
        </>
      )}
    </GlassPressable>
  );
}

function SecondaryButton({ label, icon, onPress, theme, danger, testID }) {
  const color = danger ? "#FF6B6B" : theme.text.primary;
  return (
    <GlassPressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}
    >
      {icon ? <AppIcon family="Ionicons" name={icon} size={16} color={color} /> : null}
      <Text style={[styles.secondaryText, { color }]}>{label}</Text>
    </GlassPressable>
  );
}

function TimeLeftPill({ round, now, copy }) {
  const ms = msLeft(round, now);
  if (ms == null) return null;
  return (
    <View style={styles.timePill}>
      <AppIcon family="Ionicons" name="time-outline" size={12} color="#fff" />
      <Text style={styles.timeText} allowFontScaling={false}>
        {ms > 0 ? copy.timeLeft(splitLeft(ms)) : copy.timeUp}
      </Text>
    </View>
  );
}

// ─── Kulüp kapalı ───────────────────────────────────────────────────────────

function ClubIntro({ copy, theme, canManage, cadence, onCadence, onSetUp, busy, locked }) {
  const c = CLUB_CADENCES[cadence];
  return (
    <View style={styles.block}>
      <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View pointerEvents="none" style={styles.watermark}>
          <AppIcon family="Ionicons" name="ticket" size={150} color="rgba(255,255,255,0.08)" />
        </View>
        <Text style={styles.kicker}>{copy.kicker}</Text>
        <Text style={styles.heroTitle}>{copy.introTitle}</Text>
        <Text style={styles.heroBody}>{copy.introBody}</Text>
        <View style={styles.steps}>
          {[
            ["podium-outline", copy.step1],
            ["eye-outline", copy.step2],
            ["chatbubbles-outline", copy.step3],
          ].map(([icon, label], index) => (
            <View key={icon} style={styles.step}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNum}>{index + 1}</Text>
              </View>
              <AppIcon family="Ionicons" name={icon} size={15} color="#fff" />
              <Text style={styles.stepText}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {canManage ? (
        <>
          <Text style={[gameSharedStyles.sectionTitle, { color: theme.text.muted }]}>{copy.cadenceLabel}</Text>
          <GlassSegmentedControl
            options={[
              { value: "weekly", label: copy.cadenceWeekly, icon: "calendar-outline" },
              { value: "monthly", label: copy.cadenceMonthly, icon: "calendar" },
            ]}
            value={cadence}
            onChange={onCadence}
            height={38}
            accessibilityLabel={copy.cadenceLabel}
            testIDPrefix="club-cadence"
          />
          <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.cadenceHint(c.voteDays, c.watchDays)}</Text>
          <PrimaryButton
            testID="club-setup"
            label={copy.setUp}
            icon={locked ? "diamond" : "ticket"}
            onPress={onSetUp}
            busy={busy}
            theme={theme}
          />
        </>
      ) : (
        <View style={[styles.note, { backgroundColor: theme.secondary }]}>
          <AppIcon family="Ionicons" name="lock-closed-outline" size={16} color={theme.text.muted} />
          <Text style={[styles.noteText, { color: theme.text.secondary }]}>{copy.memberWaiting}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Tur kartı ──────────────────────────────────────────────────────────────

function VotingBody({ round, uid, copy, theme, onVote }) {
  const tally = tallyRound(round);
  const mine = myVoteOf(round, uid);
  const byId = new Map(tally.map((row) => [row.id, row]));
  return (
    <>
      <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.tapToVote}</Text>
      <View style={styles.grid}>
        {round.candidates.map((media) => {
          const id = candidateIdOf(media);
          const row = byId.get(id);
          const picked = mine === id;
          return (
            <GlassPressable
              key={id}
              glass={false}
              testID={`club-vote-${id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`${media.title}. ${copy.votes(row?.count || 0)}`}
              onPress={() => onVote(id)}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            >
              <View>
                <Poster
                  path={media.poster_path}
                  width={96}
                  theme={theme}
                  style={picked ? { borderColor: CLUB_ACCENT, borderWidth: 3 } : null}
                />
                {picked ? (
                  <View style={styles.myVote}>
                    <AppIcon family="Ionicons" name="checkmark" size={12} color="#fff" />
                    <Text style={styles.myVoteText}>{copy.yourVote}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={[styles.cellTitle, { color: theme.text.primary }]}>
                {media.title}
              </Text>
              <Text style={[styles.cellVotes, { color: picked ? CLUB_ACCENT : theme.text.muted }]}>
                {copy.votes(row?.count || 0)}
              </Text>
            </GlassPressable>
          );
        })}
      </View>
    </>
  );
}

function WatchedFaces({ round, group, theme }) {
  const info = group?.memberInfo || {};
  const uids = Object.keys(round.watched || {}).filter((uid) => (group?.members || []).includes(uid));
  if (!uids.length) return null;
  return (
    <View style={styles.faces}>
      {uids.slice(0, 7).map((uid, index) => (
        <View key={uid} style={[styles.face, index > 0 && styles.faceOverlap, { borderColor: theme.primary }]}>
          <UserAvatar avatarIndex={info[uid]?.avatarIndex} photoURL={info[uid]?.photoURL || null} size={26} />
        </View>
      ))}
      {uids.length > 7 ? (
        <Text style={[styles.faceMore, { color: theme.text.muted }]}>{`+${uids.length - 7}`}</Text>
      ) : null}
    </View>
  );
}

function WatchingBody({ round, group, uid, copy, theme, inLibrary, onWatched, onRate, onDiscuss, onOpenDetail }) {
  const watched = hasWatched(round, uid);
  const rating = myRatingOf(round, uid);
  const stats = roundStats(round, group?.members);
  const pick = round.pick;
  return (
    <>
      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={`${pick.title}. ${copy.openDetail}`}
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
      >
        <Poster path={pick.poster_path} width={92} theme={theme} />
        <View style={styles.pickCopy}>
          <Text style={[styles.pickKicker, { color: CLUB_ACCENT }]}>{copy.pickTitle(round.cadence)}</Text>
          <Text numberOfLines={3} style={[styles.pickTitle, { color: theme.text.primary }]}>
            {pick.title}
          </Text>
          {pick.release_date ? (
            <Text style={[styles.pickMeta, { color: theme.text.muted }]}>{pick.release_date.slice(0, 4)}</Text>
          ) : null}
          <Text style={[styles.pickMeta, { color: theme.text.secondary }]}>
            {copy.watchedProgress(stats.watchedCount, stats.memberCount)}
          </Text>
          {stats.avgRating != null ? (
            <Text style={[styles.pickMeta, { color: theme.text.secondary }]}>{copy.clubAverage(stats.avgRating)}</Text>
          ) : null}
          <WatchedFaces round={round} group={group} theme={theme} />
        </View>
      </GlassPressable>

      {watched ? (
        <View style={styles.watchedRow}>
          <View style={[styles.watchedBadge, { backgroundColor: `${CLUB_ACCENT}22` }]}>
            <AppIcon family="Ionicons" name="checkmark-circle" size={16} color={CLUB_ACCENT} />
            <Text style={[styles.watchedText, { color: CLUB_ACCENT }]}>{copy.watchedDone}</Text>
          </View>
          <GlassPressable
            glass={false}
            testID="club-unwatch"
            accessibilityRole="button"
            onPress={() => onWatched(false)}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: theme.text.muted }]}>{copy.unmarkWatched}</Text>
          </GlassPressable>
        </View>
      ) : (
        <>
          {inLibrary ? (
            <View style={styles.libraryHint}>
              <AppIcon family="Ionicons" name="library-outline" size={13} color={theme.text.muted} />
              <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.libraryHint}</Text>
            </View>
          ) : null}
          <PrimaryButton
            testID="club-watched"
            label={copy.markWatched}
            icon="eye"
            onPress={() => onWatched(true)}
            theme={theme}
          />
        </>
      )}

      {watched ? (
        <>
          <Text style={[gameSharedStyles.sectionTitle, { color: theme.text.muted }]}>{copy.rateTitle}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ratingScroll}
            contentContainerStyle={styles.ratings}
          >
            {RATINGS.map((value) => {
              const on = rating === value;
              return (
                <GlassPressable
                  key={value}
                  glass={false}
                  testID={`club-rate-${value}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onRate(on ? null : value)}
                  style={({ pressed }) => [
                    styles.rateChip,
                    { backgroundColor: on ? CLUB_ACCENT : theme.secondary, borderColor: on ? CLUB_ACCENT : theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.rateText, { color: on ? "#fff" : theme.text.primary }]}>{value}</Text>
                </GlassPressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <GlassPressable
        testID="club-discussion"
        accessibilityRole="button"
        onPress={onDiscuss}
        style={({ pressed }) => [styles.discussRow, { borderColor: theme.border }, pressed && styles.pressed]}
      >
        <AppIcon
          family="Ionicons"
          name={watched ? "chatbubbles" : "lock-closed"}
          size={18}
          color={watched ? CLUB_ACCENT : theme.text.muted}
        />
        <View style={styles.discussCopy}>
          <Text style={[styles.discussTitle, { color: theme.text.primary }]}>{copy.discussion}</Text>
          <Text style={[styles.discussSub, { color: theme.text.muted }]}>
            {watched ? copy.discussionCount(round.commentCount || 0) : copy.discussionLocked}
          </Text>
        </View>
        <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
      </GlassPressable>
    </>
  );
}

function RoundCard(props) {
  const { round, now, copy, theme, canManage, busy, onClose, onFinish } = props;
  const phase = roundPhase(round, now);
  const voting = phase === "voting" || phase === "votingOver";
  const label = voting ? copy.phaseVoting : phase === "done" ? copy.phaseDone : copy.phaseWatching;
  return (
    <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{copy.roundLabel(round.number)}</Text>
        <View style={[styles.phasePill, { backgroundColor: phase === "done" ? theme.border : CLUB_ACCENT }]}>
          <Text style={styles.phaseText}>{label}</Text>
        </View>
        <View style={styles.flex} />
        {phase !== "done" ? (
          <View style={[styles.timeWrap, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
            <TimeLeftPill round={round} now={now} copy={copy} />
          </View>
        ) : null}
      </View>

      {voting ? <VotingBody {...props} /> : round.pick ? <WatchingBody {...props} /> : null}

      {voting && canCloseVoting(round, { isManager: canManage, nowMs: now }) ? (
        <PrimaryButton
          testID="club-close-voting"
          label={phase === "votingOver" ? copy.revealWinner : copy.closeVoting}
          icon="trophy"
          onPress={onClose}
          busy={busy}
          theme={theme}
          color="#7A4A12"
        />
      ) : null}
      {!voting && canFinishRound(round, { isManager: canManage, nowMs: now }) ? (
        <SecondaryButton testID="club-finish" label={copy.finishRound} icon="flag-outline" onPress={onFinish} theme={theme} />
      ) : null}
    </View>
  );
}

// ─── Arşiv ──────────────────────────────────────────────────────────────────

function Archive({ rounds, group, copy, theme, selectedId, onSelect }) {
  const done = rounds.filter((round) => round.status === "done" && round.pick);
  const stats = clubStats(rounds, group?.members);
  const nameOf = (uid) => group?.memberInfo?.[uid]?.name || copy.memberFallback;
  return (
    <View style={styles.block}>
      <Text style={[gameSharedStyles.sectionTitle, { color: theme.text.muted }]}>{copy.archiveTitle}</Text>
      {!done.length ? (
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.archiveEmpty}</Text>
      ) : (
        <>
          <View style={gameSharedStyles.metricRow}>
            {[
              [stats.roundsDone, copy.statRounds],
              [stats.avgRating ?? "–", copy.statAvg],
              [percentText(stats.participationPct), copy.statParticipation],
            ].map(([value, label]) => (
              <View key={label} style={[gameSharedStyles.metric, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
                <Text style={[gameSharedStyles.metricValue, { color: theme.text.primary }]}>{value}</Text>
                <Text style={[gameSharedStyles.metricLabel, { color: theme.text.muted }]}>{label}</Text>
              </View>
            ))}
          </View>
          {[
            stats.topRated && ["star", copy.topRated, stats.topRated.round.pick.title, String(stats.topRated.avgRating)],
            stats.divisive && ["git-compare", copy.divisive, stats.divisive.round.pick.title, copy.spread(stats.divisive.spread)],
            stats.loyal && ["medal", copy.loyal, nameOf(stats.loyal.uid), copy.loyalCount(stats.loyal.count)],
          ]
            .filter(Boolean)
            .map(([icon, label, value, side]) => (
              <View key={label} style={[styles.factRow, { borderColor: theme.border }]}>
                <AppIcon family="Ionicons" name={icon} size={16} color={CLUB_ACCENT} />
                <View style={styles.flex}>
                  <Text style={[styles.factLabel, { color: theme.text.muted }]}>{label}</Text>
                  <Text numberOfLines={1} style={[styles.factValue, { color: theme.text.primary }]}>
                    {value}
                  </Text>
                </View>
                <Text style={[styles.factSide, { color: theme.text.secondary }]}>{side}</Text>
              </View>
            ))}
          {done.map((round) => {
            const s = roundStats(round, group?.members);
            const on = selectedId === round.id;
            return (
              <GlassPressable
                key={round.id}
                glass={false}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(on ? null : round.id)}
                style={({ pressed }) => [
                  styles.archiveRow,
                  { borderColor: on ? CLUB_ACCENT : theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Poster path={round.pick.poster_path} width={40} theme={theme} />
                <View style={styles.flex}>
                  <Text style={[styles.factLabel, { color: theme.text.muted }]}>{copy.roundLabel(round.number)}</Text>
                  <Text numberOfLines={1} style={[styles.factValue, { color: theme.text.primary }]}>
                    {round.pick.title}
                  </Text>
                  <Text style={[styles.factLabel, { color: theme.text.muted }]}>
                    {copy.watchedProgress(s.watchedCount, s.memberCount)}
                  </Text>
                </View>
                {s.avgRating != null ? (
                  <View style={styles.avgBox}>
                    <AppIcon family="Ionicons" name="star" size={12} color={CLUB_ACCENT} />
                    <Text style={[styles.avgText, { color: theme.text.primary }]}>{s.avgRating}</Text>
                  </View>
                ) : null}
              </GlassPressable>
            );
          })}
        </>
      )}
    </View>
  );
}

// ─── Ekran ──────────────────────────────────────────────────────────────────

export default function FilmClubScreen({ navigation, route }) {
  const { groupId, roundId: initialRoundId = null } = route?.params || {};
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFilmClubCopy(language);
  const sender = useClubSender();
  const uid = sender.uid;
  const clubGate = usePremiumGate("film_club");
  const { statusIndex } = useListStatusContext() || {};
  const [group, setGroup] = useState(undefined);
  const [rounds, setRounds] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState(initialRoundId);
  const [cadence, setCadence] = useState(DEFAULT_CADENCE);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(null); // "setup" | "start" | "close" | "finish"
  const autoClosedRef = useRef(new Set());

  useEffect(() => subscribeGroup(groupId, setGroup), [groupId]);
  useEffect(
    () => subscribeClubRounds(groupId, setRounds, () => setRounds((prev) => prev || [])),
    [groupId],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (group?.club?.cadence) setCadence(group.club.cadence);
  }, [group?.club?.cadence]);

  const enabled = group?.club?.enabled === true;
  const canManage = canManageGroup(group, uid);
  const list = useMemo(() => rounds || [], [rounds]);
  const active = useMemo(() => activeRoundOf(list), [list]);
  const shown = useMemo(
    () => (selectedId && list.find((round) => round.id === selectedId)) || active,
    [selectedId, list, active],
  );

  const fail = useCallback(
    (err) => {
      if (__DEV__) console.warn("film club:", err?.message);
      toast.error(copy.errorGeneric);
    },
    [copy.errorGeneric],
  );

  const run = useCallback(
    async (key, fn) => {
      setBusy(key);
      try {
        return await fn();
      } catch (err) {
        fail(err);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [fail],
  );

  const closeVoting = useCallback(
    (round) =>
      run("close", async () => {
        const result = await closeClubVoting({ groupId, group, roundId: round.id, sender });
        if (result) trackEvent(ANALYTICS_EVENTS.FILM_CLUB_PICKED, { number: result.number, media_type: result.pick.media_type });
      }),
    [run, groupId, group, sender],
  );

  const finishRound = useCallback(
    (round) =>
      run("finish", async () => {
        const result = await finishClubRound({ groupId, group, roundId: round.id, sender });
        if (result) {
          trackEvent(ANALYTICS_EVENTS.FILM_CLUB_FINISHED, {
            number: result.number,
            watched_pct: result.stats.watchedPct,
            rated: result.stats.ratingCount,
          });
        }
      }),
    [run, groupId, group, sender],
  );

  // Süresi dolan evre: ekranı açan üye kapatır (tur başına bir deneme; başkası kapattıysa transaction boş döner).
  useEffect(() => {
    if (!active || !group || busy) return;
    const phase = roundPhase(active, now);
    const key = `${active.id}:${phase}`;
    if (autoClosedRef.current.has(key)) return;
    if (phase === "votingOver") {
      autoClosedRef.current.add(key);
      closeVoting(active);
    } else if (phase === "watchingOver") {
      autoClosedRef.current.add(key);
      finishRound(active);
    }
  }, [active, group, now, busy, closeVoting, finishRound]);

  const setUp = () => {
    // Kulüp kurmak Premium (kural da denetler); kurulu kulübün turları plan düşse de sürer.
    if (!clubGate.check(0)) return;
    run("setup", async () => {
      await setClubSettings(groupId, { enabled: true, cadence }, uid);
      trackEvent(ANALYTICS_EVENTS.FILM_CLUB_CREATED, { cadence, members: group?.members?.length || 0 });
    });
  };

  const changeCadence = (next) => {
    setCadence(next);
    if (enabled && next !== group?.club?.cadence) run("setup", () => setClubSettings(groupId, { enabled: true, cadence: next }, uid));
  };

  const closeClub = () =>
    appAlert(copy.closeClubTitle, copy.closeClubBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.confirmClose,
        style: "destructive",
        onPress: () => run("setup", () => setClubSettings(groupId, { enabled: false, cadence }, uid)),
      },
    ]);

  const startRound = async (candidates) => {
    const result = await run("start", async () => {
      const number = nextRoundNumber(list);
      const id = await startClubRound({ groupId, group, sender, candidates, number });
      trackEvent(ANALYTICS_EVENTS.FILM_CLUB_ROUND_STARTED, { number, candidates: candidates.length });
      return id;
    });
    if (result) {
      setPickerOpen(false);
      setSelectedId(null);
    }
    return !!result;
  };

  const vote = (round, candidateId) => {
    castClubVote(groupId, round.id, uid, nextClubVote(round, uid, candidateId)).catch(fail);
  };

  const markWatched = (round, watched) => {
    setClubWatched(groupId, round.id, uid, watched).catch(fail);
  };

  const rate = (round, value) => {
    setClubRating(groupId, round.id, uid, value).catch(fail);
  };

  const openDetail = (pick) =>
    navigation.navigate(pick.media_type === "tv" ? "TvShowsDetails" : "MovieDetails", { id: pick.id });

  const openDiscussion = (round) =>
    navigation.navigate("FilmClubDiscussionScreen", { groupId, roundId: round.id });

  const loading = group === undefined || rounds === null;
  const subtitle = group?.name || route?.params?.groupName || "";

  let body;
  if (loading) {
    body = (
      <View style={styles.center}>
        <LensLoader color={CLUB_ACCENT} />
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.loading}</Text>
      </View>
    );
  } else if (!group) {
    body = (
      <View style={styles.center}>
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.errorGeneric}</Text>
      </View>
    );
  } else if (!enabled && !list.length) {
    body = (
      <ClubIntro
        copy={copy}
        theme={theme}
        canManage={canManage}
        cadence={cadence}
        onCadence={setCadence}
        onSetUp={setUp}
        busy={busy === "setup"}
        locked={!clubGate.allows(0)}
      />
    );
  } else {
    const inLibrary = !!(shown?.pick && statusIndex?.[shown.pick.media_type]?.[shown.pick.id]?.isWatched);
    body = (
      <>
        {!enabled ? (
          <ClubIntro
            copy={copy}
            theme={theme}
            canManage={canManage}
            cadence={cadence}
            onCadence={setCadence}
            onSetUp={setUp}
            busy={busy === "setup"}
            locked={!clubGate.allows(0)}
          />
        ) : null}

        {shown ? (
          <RoundCard
            round={shown}
            group={group}
            uid={uid}
            now={now}
            copy={copy}
            theme={theme}
            canManage={canManage}
            busy={busy === "close"}
            inLibrary={inLibrary}
            onVote={(id) => vote(shown, id)}
            onWatched={(value) => markWatched(shown, value)}
            onRate={(value) => rate(shown, value)}
            onDiscuss={() => openDiscussion(shown)}
            onOpenDetail={() => openDetail(shown.pick)}
            onClose={() => closeVoting(shown)}
            onFinish={() => finishRound(shown)}
          />
        ) : null}

        {enabled && !active ? (
          <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name="film" size={26} color={CLUB_ACCENT} />
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{copy.noRoundTitle}</Text>
            <Text style={[styles.hint, { color: theme.text.muted }]}>
              {canManage ? copy.noRoundManager : copy.noRoundMember}
            </Text>
            {canManage ? (
              <PrimaryButton
                testID="club-start-round"
                label={copy.startRound}
                icon="add-circle"
                onPress={() => setPickerOpen(true)}
                theme={theme}
              />
            ) : null}
          </View>
        ) : null}

        <Archive
          rounds={list}
          group={group}
          copy={copy}
          theme={theme}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {enabled && canManage ? (
          <View style={styles.block}>
            <Text style={[gameSharedStyles.sectionTitle, { color: theme.text.muted }]}>{copy.settingsTitle}</Text>
            <GlassSegmentedControl
              options={[
                { value: "weekly", label: copy.cadenceWeekly, icon: "calendar-outline" },
                { value: "monthly", label: copy.cadenceMonthly, icon: "calendar" },
              ]}
              value={cadence}
              onChange={changeCadence}
              height={38}
              accessibilityLabel={copy.cadenceLabel}
              testIDPrefix="club-settings-cadence"
            />
            <Text style={[styles.hint, { color: theme.text.muted }]}>
              {copy.cadenceHint(CLUB_CADENCES[cadence].voteDays, CLUB_CADENCES[cadence].watchDays)}
            </Text>
            <SecondaryButton testID="club-close" label={copy.closeClub} icon="close-circle-outline" onPress={closeClub} theme={theme} danger />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <GameScreenShell navigation={navigation} title={copy.title} subtitle={subtitle} beta={isBetaFeature("film_club")}>
      {body}
      <ClubCandidatePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSubmit={startRound}
        submitting={busy === "start"}
      />
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 60 },
  block: { gap: 10 },
  hint: { fontSize: 12.5, fontWeight: "650", lineHeight: 17 },
  pressed: { opacity: 0.85 },
  poster: { borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },

  hero: { borderRadius: 22, padding: 18, gap: 8, overflow: "hidden" },
  watermark: { position: "absolute", right: -30, top: -30 },
  kicker: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  heroBody: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, fontWeight: "650", lineHeight: 19 },
  steps: { gap: 8, marginTop: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  stepNum: { color: "#fff", fontSize: 11, fontWeight: "900" },
  stepText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },
  note: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 14 },
  noteText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },

  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  phasePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  phaseText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  timeWrap: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  timePill: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-start" },
  cell: { width: 96, gap: 4 },
  cellTitle: { fontSize: 12.5, fontWeight: "800", lineHeight: 16 },
  cellVotes: { fontSize: 12, fontWeight: "900" },
  myVote: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: CLUB_ACCENT,
  },
  myVoteText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  pickRow: { flexDirection: "row", gap: 14 },
  pickCopy: { flex: 1, minWidth: 0, gap: 3 },
  pickKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  pickTitle: { fontSize: 19, fontWeight: "900", lineHeight: 23 },
  pickMeta: { fontSize: 12.5, fontWeight: "700" },
  faces: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  face: { borderRadius: 15, borderWidth: 2 },
  faceOverlap: { marginLeft: -8 },
  faceMore: { fontSize: 12, fontWeight: "800", marginLeft: 6 },

  watchedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  watchedBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  watchedText: { fontSize: 14, fontWeight: "900" },
  link: { fontSize: 13, fontWeight: "800", textDecorationLine: "underline" },
  libraryHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  // Basılan cam puan çipi kesilmesin (utils/liquidGlass GLASS_PRESS_ROOM).
  ratingScroll: { marginVertical: 2 - GLASS_PRESS_ROOM },
  ratings: { gap: 7, paddingVertical: GLASS_PRESS_ROOM },
  rateChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rateText: { fontSize: 15, fontWeight: "900" },
  discussRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  discussCopy: { flex: 1 },
  discussTitle: { fontSize: 15, fontWeight: "900" },
  discussSub: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  secondary: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 14.5, fontWeight: "800" },

  factRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 10 },
  factLabel: { fontSize: 11.5, fontWeight: "750" },
  factValue: { fontSize: 14.5, fontWeight: "900" },
  factSide: { fontSize: 12, fontWeight: "800" },
  archiveRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 8 },
  avgBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  avgText: { fontSize: 15, fontWeight: "900" },
});

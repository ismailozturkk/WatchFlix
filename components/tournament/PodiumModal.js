// components/tournament/PodiumModal.js
//
// "Geçen Ayın Kazananı" alt-sayfası: önceki ayın turnuvasından İLK 3 podyumu.
//   • 1. = final kazananı (şampiyon)  • 2. = final kaybedeni
//   • 3. = yarı final kaybedenlerinden daha iyi olanı (YF oyu → toplam oy → seed)
// Her yapı için: poster, sıra madalyası, aldığı TOPLAM oy, final/yarı final
// skoru (+%). Üstte ay/tür etiketi, altta katılım özeti (oy veren + toplam oy).
// Veri butona basılınca BİR KEZ yüklenir (doc + votes) ve state'te tutulur.

import React, { memo, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import {
  buildBracket, tallyVotes, tallyNominations, selectFinalists, parsePeriodId,
  monthLabel, mediaLabel, getScheduleEntry, themeLabel, now,
  computeContestantTotals, computeThirdPlace,
} from "@services/tournamentEngine";
import {
  getTournamentDoc, fetchVotesOnce, fetchAggOnce, fetchWinnerArchive,
} from "@services/tournamentService";

const MEDAL = [
  { color: "#F5C518", icon: "trophy" },   // 1 — altın
  { color: "#C0C4CE", icon: "medal" },    // 2 — gümüş
  { color: "#CD7F32", icon: "medal" },    // 3 — bronz
];

// Önceki ay verisinden podyumu türet (saf hesap — motorla aynı determinizm).
// Sayımlar agg dokümanından (tercih) veya ham oy dokümanlarından gelir —
// her iki kaynak da { nomTally, tallies, voters } biçimine indirgenir.
function computePodium(docData, { nomTally, tallies, voters }) {
  const finalists = selectFinalists(docData?.nominees || [], nomTally);
  if (!finalists.length) return null;
  const bracket = buildBracket({
    nominees: finalists, tallies, periodId: docData.periodId, ms: now(),
  });
  if (!bracket.champion) return null;

  // Her yapının turnuva boyunca topladığı oy (ChampionHero ile paylaşılan hesap).
  const totals = computeContestantTotals(bracket.rounds);

  const finalMatch = bracket.rounds[bracket.rounds.length - 1].matches[0];
  const champ = bracket.champion;
  const runnerUp = finalMatch.winnerSide === "a" ? finalMatch.b : finalMatch.a;
  const finalTotal = finalMatch.aVotes + finalMatch.bVotes;
  const votesOf = (m, c) => (m.a?.id === c?.id ? m.aVotes : m.bVotes);
  const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

  // Yarı final kaybedenlerinden daha iyi olanı (ChampionHero ile paylaşılan hesap).
  const third = computeThirdPlace(bracket, totals);

  const totalVotes = Object.values(tallies).reduce((acc, t) => acc + t.a + t.b, 0);

  return {
    items: [
      champ && {
        place: 1, c: champ, total: totals[champ.id] || 0,
        score: { v: votesOf(finalMatch, champ), t: finalTotal, pct: pct(votesOf(finalMatch, champ), finalTotal) },
      },
      runnerUp && {
        place: 2, c: runnerUp, total: totals[runnerUp.id] || 0,
        score: { v: votesOf(finalMatch, runnerUp), t: finalTotal, pct: pct(votesOf(finalMatch, runnerUp), finalTotal) },
      },
      third && {
        place: 3, c: third.c, total: totals[third.c.id] || 0,
        score: { v: third.sfVotes, t: third.sfTotal, pct: pct(third.sfVotes, third.sfTotal) },
      },
    ].filter(Boolean),
    voters,
    totalVotes,
  };
}

// Tek podyum sütunu. 1. sıra ortada ve daha büyük.
const PodiumColumn = memo(({ item, big, theme, getTmdbUrl, lang }) => {
  const medal = MEDAL[item.place - 1];
  const uri = item.c.posterPath ? getTmdbUrl(item.c.posterPath, "poster", big ? 342 : 185) : null;
  const w = big ? 108 : 82;
  const scoreLabel =
    item.place === 3
      ? i18nText("autoI18n.tournament_semifinal", "Yarı final")
      : i18nText("autoI18n.tournament_final_short", "Final");
  return (
    <View style={[styles.col, big && styles.colBig]}>
      <View style={[styles.medal, { backgroundColor: medal.color }]}>
        <AppIcon family="Ionicons" name={medal.icon} size={big ? 15 : 12} color="#3b3b3b" />
        <Text style={styles.medalText}>{item.place}</Text>
      </View>
      <View style={[styles.posterWrap, { width: w, height: w * 1.5, borderColor: medal.color }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.poster} contentFit="cover" transition={140} />
        ) : (
          <View style={[styles.poster, { backgroundColor: theme.between, alignItems: "center", justifyContent: "center" }]}>
            <AppIcon family="Ionicons" name="image-outline" size={20} color={theme.text.muted} />
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: theme.text.primary }, big && styles.titleBig]}>
        {item.c.title}
      </Text>
      <View style={[styles.statPill, { backgroundColor: medal.color + "26", borderColor: medal.color + "66" }]}>
        <AppIcon family="Ionicons" name="flame" size={10} color={medal.color} />
        <Text style={[styles.statPillText, { color: theme.text.primary }]}>
          {item.total} {i18nText("autoI18n.tournament_votes", "oy")}
        </Text>
      </View>
      <Text style={[styles.scoreText, { color: theme.text.muted }]}>
        {scoreLabel}: {item.score.v}/{item.score.t} (%{item.score.pct})
      </Text>
    </View>
  );
});

// ─── Geçmiş kazanan satırı (yıl-ay şeridi) ────────────────────────────────────
// Kaynak: tournamentWinners/{YYYY-MM} — Cloud Function (archiveTournamentWinners)
// biten her ay için yazar. Burada bracket YENİDEN HESAPLANMAZ; arşiv kaydı
// olduğu gibi gösterilir, böylece 12+ ay listelemek tek koleksiyon okuması olur.
const WinnerRow = memo(({ w, theme, getTmdbUrl, lang }) => {
  const c = w.champion;
  const uri = c?.posterPath ? getTmdbUrl(c.posterPath, "poster", 92) : null;
  const entry = getScheduleEntry(w.monthIndex);
  const genreText = (lang === "tr" ? w.theme : w.themeEn) || themeLabel(entry, lang);
  return (
    <View style={[styles.wRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.wPosterWrap, { backgroundColor: theme.between }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.wPoster} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.wPoster, styles.wPosterEmpty]}>
            <AppIcon family="Ionicons" name="image-outline" size={14} color={theme.text.muted} />
          </View>
        )}
        <View style={styles.wCrown}>
          <AppIcon family="Ionicons" name="trophy" size={9} color="#3b3b3b" />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.wDate, { color: theme.text.muted }]} numberOfLines={1}>
          {monthLabel(w.monthIndex, lang)} {w.year}
        </Text>
        <Text style={[styles.wTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {c?.title || "—"}
        </Text>
        <Text style={[styles.wMeta, { color: theme.text.muted }]} numberOfLines={1}>
          {genreText} · {mediaLabel(w.mediaType, lang)}
        </Text>
      </View>

      <View style={styles.wVotes}>
        <AppIcon family="Ionicons" name="flame" size={10} color="#F5C518" />
        <Text style={[styles.wVotesText, { color: theme.text.secondary }]}>
          {c?.totalVotes || 0}
        </Text>
      </View>
    </View>
  );
});

function PodiumModal({ visible, onClose, periodId, theme, getTmdbUrl, lang = "tr" }) {
  const [loading, setLoading] = useState(false);
  const [podium, setPodium] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);
  const [archive, setArchive] = useState(null);   // null = henüz yüklenmedi

  // Geçmiş kazananlar — tek koleksiyon okuması, ilk açılışta bir kez.
  // Üstteki podyumdan BAĞIMSIZ yüklenir: o ay çekilemese bile arşiv görünsün.
  useEffect(() => {
    if (!visible || archive !== null) return;
    let active = true;
    fetchWinnerArchive()
      .then((rows) => { if (active) setArchive(rows); })
      .catch(() => { if (active) setArchive([]); });
    return () => { active = false; };
  }, [visible, archive]);

  useEffect(() => {
    if (!visible || !periodId || loadedFor === periodId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const docData = await getTournamentDoc(periodId);
      if (!active) return;
      if (!docData?.nominees?.length) {
        setPodium(null);
        setMeta(null);
        setLoadedFor(periodId);
        setLoading(false);
        return;
      }
      // Önce agregat doküman (tek okuma); yoksa eski usul tüm oy dokümanları.
      const agg = await fetchAggOnce(periodId);
      let src;
      if (agg) {
        src = { nomTally: agg.noms, tallies: agg.picks, voters: agg.voters };
      } else {
        const votes = await fetchVotesOnce(periodId);
        src = {
          nomTally: tallyNominations(votes),
          tallies: tallyVotes(votes),
          voters: votes.filter(
            (v) => Object.keys(v?.picks || {}).length > 0 || Object.keys(v?.noms || {}).length > 0,
          ).length,
        };
      }
      if (!active) return;
      setPodium(computePodium(docData, src));
      setMeta({
        monthIndex: docData.monthIndex ?? parsePeriodId(periodId).monthIndex,
        mediaType: docData.mediaType,
      });
      setLoadedFor(periodId);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [visible, periodId, loadedFor]);

  const entry = meta ? getScheduleEntry(meta.monthIndex) : null;
  // Üstte zaten podyumu gösterilen ay listede tekrar etmesin.
  const pastWinners = (archive || []).filter((w) => w.periodId !== periodId);
  // Podyum görsel sırası: 2 — 1 — 3 (orta yüksek).
  const ordered = podium
    ? [podium.items.find((i) => i.place === 2), podium.items.find((i) => i.place === 1), podium.items.find((i) => i.place === 3)].filter(Boolean)
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <LinearGradient
          colors={["#F5C51833", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              🏆 {i18nText("autoI18n.tournament_last_winner", "Geçen Ayın Kazananı")}
            </Text>
            {meta && entry && (
              <Text style={[styles.headerSub, { color: theme.text.muted }]}>
                {monthLabel(meta.monthIndex, lang)} · {themeLabel(entry, lang)} {mediaLabel(meta.mediaType, lang)}
              </Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: theme.secondary }]}>
            <AppIcon family="Ionicons" name="close" size={18} color={theme.text.secondary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 26 }}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} size="large" />
            </View>
          ) : !podium ? (
            <View style={styles.center}>
              <AppIcon family="Ionicons" name="trophy-outline" size={34} color={theme.text.muted} />
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.tournament_no_prev", "Geçen ayın turnuva sonucu bulunamadı.")}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.podiumRow}>
                {ordered.map((item) => (
                  <PodiumColumn
                    key={item.place}
                    item={item}
                    big={item.place === 1}
                    theme={theme}
                    getTmdbUrl={getTmdbUrl}
                    lang={lang}
                  />
                ))}
              </View>

              <View style={[styles.summary, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={styles.summaryItem}>
                  <AppIcon family="Ionicons" name="people" size={14} color={theme.accent} />
                  <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
                    {podium.voters} {i18nText("autoI18n.tournament_voters", "katılımcı")}
                  </Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                <View style={styles.summaryItem}>
                  <AppIcon family="Ionicons" name="stats-chart" size={14} color={theme.accent} />
                  <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
                    {podium.totalVotes} {i18nText("autoI18n.tournament_total_votes", "toplam oy")}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ── Geçmiş kazananlar (yıl-ay şeridi) ─────────────────────────── */}
          {archive !== null && (
            <View style={styles.archive}>
              <View style={styles.archiveHeader}>
                <AppIcon family="Ionicons" name="albums" size={13} color={theme.text.muted} />
                <Text style={[styles.archiveTitle, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.tournament_past_winners", "Geçmiş Kazananlar")}
                </Text>
                {pastWinners.length > 0 && (
                  <Text style={[styles.archiveCount, { color: theme.text.muted }]}>
                    {pastWinners.length}
                  </Text>
                )}
              </View>

              {pastWinners.length === 0 ? (
                <Text style={[styles.archiveEmpty, { color: theme.text.muted }]}>
                  {i18nText(
                    "autoI18n.tournament_past_winners_empty",
                    "Henüz arşivlenmiş bir ay yok — turnuvalar tamamlandıkça buraya eklenecek.",
                  )}
                </Text>
              ) : (
                pastWinners.map((w) => (
                  <WinnerRow key={w.periodId} w={w} theme={theme} getTmdbUrl={getTmdbUrl} lang={lang} />
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: "82%",
    overflow: "hidden",
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: "900" },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10 },
  col: { flex: 1, alignItems: "center" },
  colBig: { marginBottom: 14 },

  medal: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 7,
  },
  medalText: { fontSize: 11, fontWeight: "900", color: "#3b3b3b" },

  posterWrap: { borderRadius: 12, overflow: "hidden", borderWidth: 2.5 },
  poster: { width: "100%", height: "100%" },

  title: { fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 7, minHeight: 30 },
  titleBig: { fontSize: 13.5 },

  statPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, borderWidth: 1, marginTop: 5,
  },
  statPillText: { fontSize: 11, fontWeight: "800" },
  scoreText: { fontSize: 10, fontWeight: "600", marginTop: 3 },

  summary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 14, marginTop: 18, paddingVertical: 11, borderRadius: 14, borderWidth: 1,
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryDivider: { width: 1, height: 16 },
  summaryText: { fontSize: 12, fontWeight: "700" },

  archive: { marginTop: 22 },
  archiveHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9 },
  archiveTitle: { fontSize: 11.5, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  archiveCount: { fontSize: 11, fontWeight: "800", opacity: 0.75 },
  archiveEmpty: { fontSize: 11.5, fontWeight: "600", lineHeight: 16, paddingVertical: 6 },

  wRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 13, borderWidth: 1, padding: 8, marginBottom: 7,
  },
  wPosterWrap: { borderRadius: 7, overflow: "visible" },
  wPoster: { width: 34, height: 51, borderRadius: 7 },
  wPosterEmpty: { alignItems: "center", justifyContent: "center" },
  wCrown: {
    position: "absolute", top: -5, right: -5,
    width: 17, height: 17, borderRadius: 9, backgroundColor: "#F5C518",
    alignItems: "center", justifyContent: "center",
  },
  wDate: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  wTitle: { fontSize: 13, fontWeight: "800", marginTop: 1 },
  wMeta: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
  wVotes: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(245,197,24,0.14)",
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9,
  },
  wVotesText: { fontSize: 11, fontWeight: "800" },

  center: { paddingVertical: 46, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});

export default memo(PodiumModal);

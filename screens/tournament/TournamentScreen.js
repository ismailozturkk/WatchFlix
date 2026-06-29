// screens/tournament/TournamentScreen.js
//
// Aylık turnuvanın tam ekranı. Faz-bilinçli:
//   • selection → bu ayın 32 adayı + ilk tur eşleşmeleri (oylama kapalı, geri sayım)
//   • voting    → tur çipleri + MatchCard listesi (postere 2 kez bas = oy) / ağaç
//   • results   → şampiyon + tüm sonuçlar (ağaç) + tur tur inceleme
//
// Tüm durum tournamentEngine.buildBracket ile docData.nominees + canlı oylardan
// TÜRETİLİR; sunucu yok. Oylar tournaments/{periodId}/votes/{uid} altında.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import BackButton from "@components/BackButton";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import MatchCard from "@components/tournament/MatchCard";
import BracketTree from "@components/tournament/BracketTree";
import CountdownTimer from "@components/tournament/CountdownTimer";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import {
  useImageQualitySettings,
  useHapticsSettings,
  useLanguageSettings,
} from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import {
  ROUNDS, getPeriodId, getScheduleEntry, parsePeriodId, getPeriodStartMs,
  monthLabel, mediaLabel, roundLabel, getPhaseInfo, buildBracket, tallyVotes,
  getMyPicks, getPrevPeriodId, now, setDebugNow, DAY,
} from "@services/tournamentEngine";
import {
  ensureTournament, subscribeTournamentDoc, subscribeTournamentVotes,
  castVote, getTournamentDoc, fetchVotesOnce,
} from "@services/tournamentService";

const PHASE_META = {
  selection: { tr: "Aday Belirleme", en: "Selection", icon: "list", color: "#3B82F6" },
  voting:    { tr: "Oylama", en: "Voting", icon: "flame", color: "#F59E0B" },
  results:   { tr: "Sonuçlar", en: "Results", icon: "trophy", color: "#F5C518" },
  upcoming:  { tr: "Yakında", en: "Upcoming", icon: "time", color: "#6B7280" },
};

// __DEV__ faz önizleme: gerçek zamanı (setDebugNow) bu ayın ilgili gününe sabitler.
const DEV_PRESETS = [
  { key: "real",  label: "Gerçek", offset: null, tab: null },
  { key: "sel",   label: "Seçim",  offset: 2,  tab: 0 },
  { key: "r32",   label: "Son 32", offset: 8,  tab: 0 },
  { key: "r16",   label: "Son 16", offset: 10, tab: 1 },
  { key: "qf",    label: "Çeyrek", offset: 12, tab: 2 },
  { key: "sf",    label: "Yarı",   offset: 14, tab: 3 },
  { key: "final", label: "Final",  offset: 18, tab: 4 },
  { key: "res",   label: "Sonuç",  offset: 24, tab: 4 },
];

export default function TournamentScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const { hapticsEnabled } = useHapticsSettings();
  const { selectedLanguage: lang } = useLanguageSettings();
  const uid = user?.uid;

  const periodId = useMemo(() => getPeriodId(), []);
  const { monthIndex } = useMemo(() => parsePeriodId(periodId), [periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);

  const [docData, setDocData] = useState(null);
  const [voteDocs, setVoteDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(null);          // seçili tur indeksi
  const [viewMode, setViewMode] = useState("list"); // list | tree
  const [nowMs, setNowMs] = useState(now());
  const [prevChampion, setPrevChampion] = useState(null);

  // Canlı saat (geri sayım + tur geçişleri için). Dakika hassasiyeti yeterli.
  useEffect(() => {
    const id = setInterval(() => setNowMs(now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Veri: aday listesini garantile + meta/oy dinle.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    ensureTournament({ periodId, uid, language: lang })
      .then((data) => { if (active) { setDocData(data); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });

    const unsubDoc = subscribeTournamentDoc(periodId, (d) => { if (d) setDocData(d); });
    const unsubVotes = subscribeTournamentVotes(periodId, (v) => setVoteDocs(v));
    return () => { active = false; unsubDoc(); unsubVotes(); };
  }, [periodId, uid, lang]);

  const phaseInfo = useMemo(() => getPhaseInfo(periodId, nowMs), [periodId, nowMs]);
  const tallies = useMemo(() => tallyVotes(voteDocs), [voteDocs]);
  const myPicks = useMemo(() => getMyPicks(voteDocs, uid), [voteDocs, uid]);
  const bracket = useMemo(
    () => buildBracket({ nominees: docData?.nominees || [], tallies, periodId, ms: nowMs }),
    [docData, tallies, periodId, nowMs],
  );

  // Varsayılan seçili tur: oylamada aktif tur, sonuçlarda final, seçimde ilk tur.
  useEffect(() => {
    if (tab != null || loading) return;
    const def = phaseInfo.phase === "voting" ? phaseInfo.activeRound
      : phaseInfo.phase === "results" ? ROUNDS.length - 1 : 0;
    setTab(Math.max(0, Math.min(ROUNDS.length - 1, def)));
  }, [tab, loading, phaseInfo.phase, phaseInfo.activeRound]);

  // Önceki ay şampiyonu (bu ay henüz karar vermediyse "öne çıkan" olarak göster).
  useEffect(() => {
    if (phaseInfo.phase === "results") { setPrevChampion(null); return; }
    let active = true;
    (async () => {
      const prevId = getPrevPeriodId(periodId);
      const pdoc = await getTournamentDoc(prevId);
      if (!pdoc?.nominees?.length) return;
      const pvotes = await fetchVotesOnce(prevId);
      const pb = buildBracket({ nominees: pdoc.nominees, tallies: tallyVotes(pvotes), periodId: prevId, ms: nowMs });
      if (active && pb.champion) {
        setPrevChampion({ champion: pb.champion, periodId: prevId, monthIndex: parsePeriodId(prevId).monthIndex });
      }
    })();
    return () => { active = false; };
  }, [periodId, phaseInfo.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = useCallback(
    (matchId, side) => {
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      // İyimser güncelleme: kendi oy dokümanımı anında yansıt.
      setVoteDocs((prev) => {
        const idx = prev.findIndex((v) => (v.uid || v.id) === uid);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], picks: { ...(copy[idx].picks || {}), [matchId]: side } };
          return copy;
        }
        return [...prev, { uid, picks: { [matchId]: side } }];
      });
      castVote({ periodId, uid, matchId, side })
        .then(() => toast.success(i18nText("autoI18n.tournament_voted", "Oyun kaydedildi")))
        .catch(() => toast.error(i18nText("autoI18n.tournament_vote_fail", "Oy kaydedilemedi")));
    },
    [uid, periodId],
  );

  const theTheme = lang === "tr" ? entry.tr : entry.en;
  const phaseMeta = PHASE_META[phaseInfo.phase] || PHASE_META.selection;

  // ── Header ──────────────────────────────────────────────────────────────────
  const Header = (
    <View style={styles.headerRow}>
      <BackButton absolute={false} />
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {i18nText("autoI18n.tournament_title", "Aylık Turnuva")}
        </Text>
        <Text style={[styles.headerSub, { color: theme.text.muted }]} numberOfLines={1}>
          {monthLabel(monthIndex, lang)} · {theTheme} {mediaLabel(entry.mediaType, lang)}
        </Text>
      </View>
      <View style={[styles.phaseChip, { backgroundColor: phaseMeta.color + "22", borderColor: phaseMeta.color + "55" }]}>
        <AppIcon family="Ionicons" name={phaseMeta.icon} size={13} color={phaseMeta.color} />
        <Text style={[styles.phaseChipText, { color: phaseMeta.color }]}>
          {lang === "tr" ? phaseMeta.tr : phaseMeta.en}
        </Text>
      </View>
    </View>
  );

  // ── Hero (geri sayım) ─────────────────────────────────────────────────────────
  const heroLabel =
    phaseInfo.phase === "selection"
      ? i18nText("autoI18n.tournament_voting_starts", "Oylama başlamasına")
      : phaseInfo.phase === "voting"
        ? `${roundLabel(ROUNDS[phaseInfo.activeRound], lang)} ` + i18nText("autoI18n.tournament_ends_in", "bitişine")
        : i18nText("autoI18n.tournament_next_in", "Yeni turnuvaya");

  const Hero = (
    <LinearGradient
      colors={[phaseMeta.color, theme.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroTop}>
        <Text style={styles.heroTheme}>{theTheme}</Text>
        <View style={styles.heroMediaPill}>
          <AppIcon family="Ionicons" name={entry.mediaType === "tv" ? "tv" : "film"} size={12} color="#fff" />
          <Text style={styles.heroMediaText}>{mediaLabel(entry.mediaType, lang)}</Text>
        </View>
      </View>
      <Text style={styles.heroSub}>{heroLabel}</Text>
      <View style={{ marginTop: 8 }}>
        <CountdownTimer deadlineMs={phaseInfo.nextDeadlineMs} lang={lang} size="lg" />
      </View>

      {/* Tur ilerleme noktaları */}
      <View style={styles.heroDots}>
        {ROUNDS.map((r, i) => {
          const dPhase = phaseInfo.phase;
          const reached = dPhase === "results" || (dPhase === "voting" && i <= phaseInfo.activeRound);
          const active = dPhase === "voting" && i === phaseInfo.activeRound;
          return (
            <View key={r.key} style={styles.heroDotWrap}>
              <View style={[styles.heroDot, { backgroundColor: reached ? "#fff" : "rgba(255,255,255,0.35)", transform: [{ scale: active ? 1.4 : 1 }] }]} />
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );

  // ── Tur çipleri ───────────────────────────────────────────────────────────────
  const RoundChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {ROUNDS.map((r, i) => {
        const round = bracket.rounds[i];
        const isActive = phaseInfo.phase === "voting" && i === phaseInfo.activeRound;
        const isSelected = tab === i;
        const locked = !round?.decided && !round?.votable && !(phaseInfo.phase === "results");
        return (
          <TouchableOpacity
            key={r.key}
            onPress={() => setTab(i)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.accent : theme.secondary,
                borderColor: isActive ? theme.accent : theme.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: isSelected ? "#fff" : theme.text.secondary }]}>
              {roundLabel(r, lang)}
            </Text>
            {round?.decided && <AppIcon family="Ionicons" name="checkmark-circle" size={12} color={isSelected ? "#fff" : "#22C55E"} />}
            {locked && <AppIcon family="Ionicons" name="lock-closed" size={11} color={isSelected ? "#fff" : theme.text.muted} />}
            {isActive && !round?.decided && <View style={styles.liveDot} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Liste/Ağaç anahtarı ─────────────────────────────────────────────────────
  const ViewToggle = (
    <View style={[styles.toggle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {["list", "tree"].map((m) => (
        <Pressable
          key={m}
          onPress={() => setViewMode(m)}
          style={[styles.toggleBtn, viewMode === m && { backgroundColor: theme.accent }]}
        >
          <AppIcon
            family="Ionicons"
            name={m === "list" ? "albums" : "git-network"}
            size={14}
            color={viewMode === m ? "#fff" : theme.text.secondary}
          />
          <Text style={[styles.toggleText, { color: viewMode === m ? "#fff" : theme.text.secondary }]}>
            {m === "list"
              ? i18nText("autoI18n.tournament_list", "Liste")
              : i18nText("autoI18n.tournament_tree", "Ağaç")}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // ── Seçili turun maç listesi ─────────────────────────────────────────────────
  const selectedRound = tab != null ? bracket.rounds[tab] : null;
  const roundList = selectedRound && (
    <View>
      {!selectedRound.votable && !selectedRound.decided && (
        <View style={[styles.notice, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="time-outline" size={16} color={theme.text.muted} />
          <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.tournament_round_locked", "Bu tur henüz başlamadı; önceki turlar tamamlanınca eşleşmeler belli olacak.")}
          </Text>
        </View>
      )}
      {selectedRound.votable && (
        <View style={[styles.notice, { backgroundColor: theme.accent + "1A", borderColor: theme.accent + "44" }]}>
          <AppIcon family="Ionicons" name="hand-left" size={16} color={theme.accent} />
          <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.tournament_vote_hint", "Oy vermek için postere iki kez bas: ilk basış onay ister, ikinci basış oyunu kaydeder.")}
          </Text>
        </View>
      )}
      {selectedRound.matches.map((m) => (
        <MatchCard
          key={m.matchId}
          match={m}
          mySide={myPicks[m.matchId] || null}
          votable={m.votable && !!m.a && !!m.b}
          onVote={handleVote}
          theme={theme}
          getTmdbUrl={getTmdbUrl}
          lang={lang}
          hapticsEnabled={hapticsEnabled}
        />
      ))}
    </View>
  );

  const RoundsBrowser = (
    <View>
      {RoundChips}
      <View style={styles.browserHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {selectedRound ? roundLabel(selectedRound.def, lang) : ""}
        </Text>
        {ViewToggle}
      </View>
      {viewMode === "list"
        ? roundList
        : <BracketTree rounds={bracket.rounds} theme={theme} getTmdbUrl={getTmdbUrl} lang={lang} />}
    </View>
  );

  // ── Şampiyon hero (results) ───────────────────────────────────────────────────
  const ChampionHero = ({ champion, label }) => {
    const uri = champion?.posterPath ? getTmdbUrl(champion.posterPath, "poster", 342) : null;
    return (
      <LinearGradient colors={["#F5C518", theme.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.champHero}>
        <AppIcon family="Ionicons" name="trophy" size={26} color="#fff" />
        <Text style={styles.champLabel}>{label || i18nText("autoI18n.tournament_champion", "ŞAMPİYON")}</Text>
        {uri ? (
          <Image source={{ uri }} style={styles.champPoster} contentFit="cover" />
        ) : (
          <View style={[styles.champPoster, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
        )}
        <Text style={styles.champTitle} numberOfLines={2}>{champion?.title}</Text>
        <Text style={styles.champSeed}>#{champion?.seed} {i18nText("autoI18n.tournament_seed", "sıra")}</Text>
      </LinearGradient>
    );
  };

  // ── Aday gridi (selection) ────────────────────────────────────────────────────
  const NomineeGrid = () => {
    const nominees = [...(docData?.nominees || [])].sort((a, b) => a.seed - b.seed);
    return (
      <View style={styles.grid}>
        {nominees.map((n) => {
          const uri = n.posterPath ? getTmdbUrl(n.posterPath, "poster", 185) : null;
          return (
            <View key={n.id} style={styles.gridItem}>
              <View style={[styles.gridPosterWrap, { backgroundColor: theme.between }]}>
                {uri ? (
                  <Image source={{ uri }} style={styles.gridPoster} contentFit="cover" transition={120} />
                ) : (
                  <View style={[styles.gridPoster, { alignItems: "center", justifyContent: "center" }]}>
                    <AppIcon family="Ionicons" name="image-outline" size={20} color={theme.text.muted} />
                  </View>
                )}
                <View style={[styles.gridSeed, { backgroundColor: theme.primary + "E6" }]}>
                  <Text style={[styles.gridSeedText, { color: theme.text.secondary }]}>{n.seed}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.gridTitle, { color: theme.text.secondary }]}>{n.title}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Body ──────────────────────────────────────────────────────────────────────
  let body;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[styles.muted, { color: theme.text.muted }]}>
          {i18nText("autoI18n.tournament_loading", "Turnuva hazırlanıyor…")}
        </Text>
      </View>
    );
  } else if (error || !docData?.nominees?.length) {
    body = (
      <View style={styles.center}>
        <AppIcon family="Ionicons" name="cloud-offline" size={34} color={theme.text.muted} />
        <Text style={[styles.muted, { color: theme.text.muted }]}>
          {i18nText("autoI18n.tournament_load_error", "Turnuva yüklenemedi. İnternet bağlantını kontrol et.")}
        </Text>
      </View>
    );
  } else if (phaseInfo.phase === "selection" || phaseInfo.phase === "upcoming") {
    body = (
      <View>
        {Hero}
        {prevChampion && ChampionHero({
          champion: prevChampion.champion,
          label: `${monthLabel(prevChampion.monthIndex, lang)} ${i18nText("autoI18n.tournament_winner", "Kazananı")}`,
        })}
        <Text style={[styles.sectionTitle, { color: theme.text.muted, marginTop: 18 }]}>
          {i18nText("autoI18n.tournament_nominees", "Bu Ayın 32 Adayı")}
        </Text>
        {NomineeGrid()}
        <Text style={[styles.sectionTitle, { color: theme.text.muted, marginTop: 8 }]}>
          {i18nText("autoI18n.tournament_first_round", "İlk Tur Eşleşmeleri")}
        </Text>
        {(bracket.rounds[0]?.matches || []).map((m) => (
          <MatchCard
            key={m.matchId}
            match={m}
            mySide={null}
            votable={false}
            onVote={handleVote}
            theme={theme}
            getTmdbUrl={getTmdbUrl}
            lang={lang}
            hapticsEnabled={hapticsEnabled}
          />
        ))}
      </View>
    );
  } else if (phaseInfo.phase === "voting") {
    body = (
      <View>
        {Hero}
        {RoundsBrowser}
      </View>
    );
  } else {
    // results
    body = (
      <View>
        {bracket.champion
          ? ChampionHero({ champion: bracket.champion })
          : Hero}
        {RoundsBrowser}
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.primary }]}>
      {Header}
      {__DEV__ && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devStrip}>
          {DEV_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => {
                const ms = p.offset == null ? null : getPeriodStartMs(periodId) + p.offset * DAY;
                setDebugNow(ms);
                setNowMs(ms == null ? Date.now() : ms);
                if (p.tab != null) setTab(p.tab);
              }}
              style={[styles.devChip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text.secondary, fontSize: 11, fontWeight: "700" }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "900" },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 1,
  },
  phaseChipText: { fontSize: 11, fontWeight: "800" },

  hero: { borderRadius: 20, padding: 18, marginTop: 6, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTheme: { color: "#fff", fontSize: 24, fontWeight: "900" },
  heroMediaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  heroMediaText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "700", marginTop: 6 },
  heroDots: { flexDirection: "row", marginTop: 14, gap: 2 },
  heroDotWrap: { flex: 1, alignItems: "center" },
  heroDot: { width: 9, height: 9, borderRadius: 5 },

  chipsRow: { gap: 8, paddingVertical: 14, paddingRight: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontWeight: "800" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },

  browserHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },
  toggle: { flexDirection: "row", borderRadius: 11, borderWidth: 1, padding: 3, gap: 2 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: "800" },

  notice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 11, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },

  champHero: { borderRadius: 20, padding: 18, alignItems: "center", marginTop: 6, marginBottom: 14 },
  champLabel: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 2, marginTop: 4 },
  champPoster: { width: 130, height: 195, borderRadius: 12, marginTop: 12, borderWidth: 3, borderColor: "#fff" },
  champTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 12, textAlign: "center" },
  champSeed: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700", marginTop: 2 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 8 },
  gridItem: { width: "25%", padding: 4 },
  gridPosterWrap: { width: "100%", aspectRatio: 2 / 3, borderRadius: 9, overflow: "hidden" },
  gridPoster: { width: "100%", height: "100%" },
  gridSeed: { position: "absolute", top: 4, left: 4, minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, alignItems: "center" },
  gridSeedText: { fontSize: 10, fontWeight: "800" },
  gridTitle: { fontSize: 10, fontWeight: "600", marginTop: 3 },

  devStrip: { gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  devChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },

  center: { paddingTop: 80, alignItems: "center", gap: 12 },
  muted: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});

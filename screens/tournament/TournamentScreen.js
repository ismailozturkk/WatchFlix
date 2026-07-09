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
  TouchableOpacity, Pressable, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import BackButton from "@components/BackButton";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import MatchCard from "@components/tournament/MatchCard";
import BracketTree from "@components/tournament/BracketTree";
import CountdownTimer from "@components/tournament/CountdownTimer";
import NomineeSearchModal from "@components/tournament/NomineeSearchModal";
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
  FINALIST_COUNT, MAX_NOMINATIONS, tallyNominations, getMyNominations,
  rankPool, selectFinalists, getChampionStats,
} from "@services/tournamentEngine";
import {
  ensureTournament, subscribeTournamentDoc, subscribeTournamentVotes,
  subscribeTournamentAgg, subscribeMyVote,
  castVote, setNomination,
} from "@services/tournamentService";
import StageTimeline from "@components/tournament/StageTimeline";
import PodiumModal from "@components/tournament/PodiumModal";

// Her faz kendi gradyanı + 4 bilgi kartı (Tür/Ortam/Ay/Aşama) için kendi renk
// paletiyle gelir; hero her fazda görsel olarak FARKLI hissettirsin diye
// (mavi=seçim, turuncu/kırmızı=oylama, altın=sonuç, gri=yakında).
const PHASE_META = {
  selection: {
    tr: "Aday Belirleme", en: "Selection", icon: "list",
    color: "#3B82F6",
    gradient: ["#2563EB", "#7C3AED"],
    grid: ["#60A5FA", "#818CF8", "#38BDF8", "#A78BFA"],
  },
  voting: {
    tr: "Oylama", en: "Voting", icon: "flame",
    color: "#F59E0B",
    gradient: ["#EA580C", "#DC2626"],
    grid: ["#FBBF24", "#FB923C", "#F87171", "#FCD34D"],
  },
  results: {
    tr: "Sonuçlar", en: "Results", icon: "trophy",
    color: "#F5C518",
    gradient: ["#D97706", "#F5C518"],
    grid: ["#FDE047", "#FACC15", "#F59E0B", "#FBBF24"],
  },
  upcoming: {
    tr: "Yakında", en: "Upcoming", icon: "time",
    color: "#6B7280",
    gradient: ["#4B5563", "#1F2937"],
    grid: ["#9CA3AF", "#6B7280", "#4B5563", "#9CA3AF"],
  },
};

// ─── Aday hücresi (seçim fazı "hype" oylaması) ───────────────────────────────
// memo: 64 hücrelik gridde tek oy değişince yalnız etkilenen hücreler çizilsin.
// Görsel dil: sıra rozeti (ilk 32 yeşil, dışı gri+soluk), HYPE (alev) sayacı,
// benim adayım = accent çerçeve + alev rozeti.
//
// OY AKIŞI (eleme maçlarıyla aynı): postere İKİ KEZ bas — ilk basış "Seçimi
// onayla" uyarı katmanını açar (isPending), ikinci basış hype'ı KESİN olarak
// kaydeder. Tek hak vardır ve değiştirilemez; iki adımlı onay bu yüzden şart.
const NomineeCell = React.memo(function NomineeCell({
  id, title, posterPath, rank, nomVotes, finalist, mine, canVote, isPending,
  onPress, theme, getTmdbUrl,
}) {
  const uri = posterPath ? getTmdbUrl(posterPath, "poster", 185) : null;
  const rankColor = finalist ? "#22C55E" : "#9CA3AF";
  return (
    <Pressable
      disabled={!canVote}
      onPress={() => onPress(id)}
      style={styles.gridItem}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.gridPosterWrap,
          {
            backgroundColor: theme.between,
            borderWidth: mine || isPending ? 2.5 : 0,
            borderColor: mine || isPending ? theme.accent : "transparent",
            opacity: finalist ? 1 : 0.55,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.gridPoster} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.gridPoster, { alignItems: "center", justifyContent: "center" }]}>
            <AppIcon family="Ionicons" name="image-outline" size={20} color={theme.text.muted} />
          </View>
        )}

        {/* Sıra rozeti — canlı projeksiyon (ilk 32 = turnuvaya girer) */}
        <View style={[styles.gridSeed, { backgroundColor: rankColor + "E6" }]}>
          <Text style={[styles.gridSeedText, { color: "#fff" }]}>{rank}</Text>
        </View>

        {/* Benim adayım (hype verilmiş) */}
        {mine && (
          <View style={[styles.gridMine, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="flame" size={10} color="#fff" />
          </View>
        )}

        {/* Hype sayacı pili */}
        <View style={styles.gridVotesPill}>
          <AppIcon family="Ionicons" name="flame" size={9} color="#FBBF24" />
          <Text style={styles.gridVotesText}>{nomVotes}</Text>
        </View>

        {/* "Seçimi onayla" katmanı (1. basıştan sonra) — MatchCard ile aynı dil */}
        {isPending && (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={[styles.gridConfirm, { backgroundColor: theme.accent + "E6" }]}
            pointerEvents="none"
          >
            <AppIcon family="Ionicons" name="flame" size={22} color="#fff" />
            <Text style={styles.gridConfirmText}>
              {i18nText("autoI18n.tournament_confirm", "Seçimi onayla")}
            </Text>
            <Text style={styles.gridConfirmSub}>
              {i18nText("autoI18n.tournament_confirm_final_sub", "tekrar bas — değiştirilemez")}
            </Text>
          </Animated.View>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.gridTitle, { color: theme.text.secondary }]}>{title}</Text>
    </Pressable>
  );
});

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
  // Çok kullanıcı optimizasyonu: tally için önce AGG dokümanı denenir
  // (tournaments/{p}/agg/tallies — Cloud Function toplar, tek doküman).
  // undefined = henüz bilinmiyor, null = agg yok (eski ay / fonksiyon yeni),
  // obj = { noms, picks, voters }. Agg yoksa fallback: votes koleksiyonu.
  const [agg, setAgg] = useState(undefined);
  const [myVote, setMyVote] = useState(null); // yalnız KENDİ oy dokümanım
  const [voteDocs, setVoteDocs] = useState([]); // yalnız fallback modunda dolar
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(null);          // seçili tur indeksi
  const [viewMode, setViewMode] = useState("list"); // list | tree
  const [nowMs, setNowMs] = useState(now());
  const [podiumVisible, setPodiumVisible] = useState(false);   // geçen ay ilk-3 modalı
  const [showProjection, setShowProjection] = useState(false); // seçimde eşleşme önizleme
  const [searchVisible, setSearchVisible] = useState(false);   // aday arama modalı
  const [pendingNom, setPendingNom] = useState(null);          // 2 adımlı hype onayı
  const [treeMatchId, setTreeMatchId] = useState(null);        // ağaçtan seçilen maç
  const nomTimer = useRef(null);

  // Canlı saat (geri sayım + tur geçişleri için). Dakika hassasiyeti yeterli.
  useEffect(() => {
    const id = setInterval(() => setNowMs(now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Veri: aday listesini garantile + meta/agg/kendi-oy dinle.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    ensureTournament({ periodId, uid, language: lang })
      .then((data) => { if (active) { setDocData(data); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });

    const unsubDoc = subscribeTournamentDoc(periodId, (d) => { if (d) setDocData(d); });
    const unsubAgg = subscribeTournamentAgg(periodId, (a) => setAgg(a));
    const unsubMine = uid ? subscribeMyVote(periodId, uid, (v) => setMyVote(v)) : () => {};
    return () => { active = false; unsubDoc(); unsubAgg(); unsubMine(); };
  }, [periodId, uid, lang]);

  // Fallback: agg dokümanı YOKSA (null) eski usul tüm oy koleksiyonunu dinle.
  // Agg gelir gelmez (ilk oy yazımında Cloud Function kurar) bu dinleme kapanır.
  const aggMissing = agg === null;
  useEffect(() => {
    if (!aggMissing) { setVoteDocs([]); return undefined; }
    const unsub = subscribeTournamentVotes(periodId, (v) => setVoteDocs(v));
    return unsub;
  }, [aggMissing, periodId]);

  const phaseInfo = useMemo(() => getPhaseInfo(periodId, nowMs), [periodId, nowMs]);
  const tallies = useMemo(
    () => (agg ? agg.picks : tallyVotes(voteDocs)),
    [agg, voteDocs],
  );
  // Kendi oylarım her modda kendi dokümanımdan (tek doc listener) türetilir;
  // fallback listesi yalnız myVote henüz gelmediyse yedek olarak kullanılır.
  const myPicks = useMemo(
    () => (myVote ? myVote.picks || {} : getMyPicks(voteDocs, uid)),
    [myVote, voteDocs, uid],
  );

  // ── Aday belirleme (seçim fazı topluluk "hype" oylaması) ───────────────────
  // Havuz > 32 ise turnuvaya EN ÇOK HYPE ALAN 32 yapı girer; havuz ≤ 32 olan
  // eski aylar için selectFinalists listeyi olduğu gibi döner (davranış aynı).
  const nomTally = useMemo(
    () => (agg ? agg.noms : tallyNominations(voteDocs)),
    [agg, voteDocs],
  );
  const myNoms = useMemo(() => {
    if (myVote) {
      const n = myVote.noms || {};
      return new Set(Object.keys(n).filter((k) => n[k]));
    }
    return getMyNominations(voteDocs, uid);
  }, [myVote, voteDocs, uid]);
  const rankedPool = useMemo(
    () => rankPool(docData?.nominees || [], nomTally),
    [docData, nomTally],
  );
  const finalists = useMemo(
    () => selectFinalists(docData?.nominees || [], nomTally),
    [docData, nomTally],
  );
  const nominationOpen =
    phaseInfo.phase === "selection" && (docData?.nominees?.length || 0) > FINALIST_COUNT;

  const bracket = useMemo(
    () => buildBracket({ nominees: finalists, tallies, periodId, ms: nowMs }),
    [finalists, tallies, periodId, nowMs],
  );

  // Şampiyon kartı: final skoru + turnuva boyunca toplam oy + ikincilik.
  const championStats = useMemo(() => getChampionStats(bracket), [bracket]);

  // Varsayılan seçili tur: oylamada aktif tur, sonuçlarda final, seçimde ilk tur.
  useEffect(() => {
    if (tab != null || loading) return;
    const def = phaseInfo.phase === "voting" ? phaseInfo.activeRound
      : phaseInfo.phase === "results" ? ROUNDS.length - 1 : 0;
    setTab(Math.max(0, Math.min(ROUNDS.length - 1, def)));
  }, [tab, loading, phaseInfo.phase, phaseInfo.activeRound]);

  // ── Eleme maçı oyu — TEK ve DEĞİŞTİRİLEMEZ ─────────────────────────────────
  // İki adımlı onay MatchCard içindedir; buraya gelen çağrı KESİN oydur.
  // Aynı maça ikinci oy istemcide burada, sunucuda firestore.rules'ta engellenir.
  const handleVote = useCallback(
    (matchId, side) => {
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      if (myPicks[matchId]) {
        toast.warning(i18nText("autoI18n.tournament_vote_locked", "Bu maçtaki oyun kesin — değiştirilemez"));
        return;
      }
      // İyimser güncelleme: kendi oy dokümanımı anında yansıt (tally, agg
      // listener'ı Cloud Function'ı yakalayınca ~1-2 sn içinde güncellenir).
      setMyVote((prev) => ({
        ...(prev || { uid }),
        picks: { ...(prev?.picks || {}), [matchId]: side },
      }));
      castVote({ periodId, uid, matchId, side })
        .then(() => toast.success(i18nText("autoI18n.tournament_voted_final", "Oyun kaydedildi — değiştirilemez")))
        .catch(() => {
          // Geri al (ör. pencere dışı yazım rules tarafından reddedildi).
          setMyVote((prev) => {
            if (!prev) return prev;
            const picks = { ...(prev.picks || {}) };
            delete picks[matchId];
            return { ...prev, picks };
          });
          toast.error(i18nText("autoI18n.tournament_vote_fail", "Oy kaydedilemedi"));
        });
    },
    [uid, periodId, myPicks],
  );

  // ── Hype'ı KESİN kaydet (grid onayından veya arama modalından gelir) ───────
  const commitNomination = useCallback(
    (nomineeId) => {
      const key = String(nomineeId);
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      if (myNoms.size >= MAX_NOMINATIONS) {
        toast.warning(i18nText("autoI18n.tournament_hype_used", "Hype hakkını kullandın — seçim değiştirilemez"));
        return;
      }
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMyVote((prev) => ({
        ...(prev || { uid }),
        noms: { ...(prev?.noms || {}), [key]: true },
      }));
      setNomination({ periodId, uid, nomineeId })
        .then(() => toast.success(i18nText("autoI18n.tournament_hype_saved", "Hype'ın kaydedildi — bu seçim kesin")))
        .catch(() => {
          setMyVote((prev) => {
            if (!prev) return prev;
            const noms = { ...(prev.noms || {}) };
            delete noms[key];
            return { ...prev, noms };
          });
          toast.error(i18nText("autoI18n.tournament_vote_fail", "Oy kaydedilemedi"));
        });
    },
    [uid, periodId, myNoms, hapticsEnabled],
  );

  // Grid'de iki adımlı onay: 1. basış "Seçimi onayla" katmanı, 2. basış kesin.
  const clearPendingNom = useCallback(() => {
    if (nomTimer.current) { clearTimeout(nomTimer.current); nomTimer.current = null; }
    setPendingNom(null);
  }, []);
  useEffect(() => () => { if (nomTimer.current) clearTimeout(nomTimer.current); }, []);

  const handleNomineePress = useCallback(
    (nomineeId) => {
      const key = String(nomineeId);
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      if (myNoms.has(key)) {
        toast.info(i18nText("autoI18n.tournament_already_yours", "Bu zaten senin adayın"));
        return;
      }
      if (myNoms.size >= MAX_NOMINATIONS) {
        toast.warning(i18nText("autoI18n.tournament_hype_used", "Hype hakkını kullandın — seçim değiştirilemez"));
        return;
      }
      if (pendingNom === key) {
        clearPendingNom();
        commitNomination(nomineeId);
      } else {
        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setPendingNom(key);
        if (nomTimer.current) clearTimeout(nomTimer.current);
        nomTimer.current = setTimeout(() => setPendingNom(null), 2600);
      }
    },
    [uid, myNoms, pendingNom, clearPendingNom, commitNomination, hapticsEnabled],
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

  // ── Hero (tür + faz + geri sayım + interaktif aşama çizelgesi) ───────────────
  const heroLabel =
    phaseInfo.phase === "selection"
      ? nominationOpen
        ? i18nText("autoI18n.tournament_nom_ends", "Aday oylaması bitişine")
        : i18nText("autoI18n.tournament_voting_starts", "Oylama başlamasına")
      : phaseInfo.phase === "voting"
        ? `${roundLabel(ROUNDS[phaseInfo.activeRound], lang)} ` + i18nText("autoI18n.tournament_ends_in", "bitişine")
        : i18nText("autoI18n.tournament_next_in", "Yeni turnuvaya");

  const deadlineText = new Date(phaseInfo.nextDeadlineMs).toLocaleDateString(
    lang === "tr" ? "tr-TR" : "en-US",
    { day: "numeric", month: "long" },
  );

  // Aşama çizelgesinden tur seçimi (oylama/sonuç fazlarında ilgili tura atlar).
  const handleStagePress = useCallback((s) => {
    if (s.roundIndex == null) return;
    setTab(s.roundIndex);
    setViewMode("list");
  }, []);

  // 2x2 bilgi gridi: Tür / Ortam / Ay / Aşama — her kart o fazın paletinden bir
  // renk alır (grid[0..3]), böylece hero her fazda görsel olarak farklılaşır.
  const heroGridItems = [
    { key: "theme", icon: "pricetag", label: i18nText("autoI18n.tournament_genre", "Tür"), value: theTheme },
    { key: "media", icon: entry.mediaType === "tv" ? "tv" : "film", label: i18nText("autoI18n.tournament_format", "Ortam"), value: mediaLabel(entry.mediaType, lang) },
    { key: "month", icon: "calendar", label: i18nText("autoI18n.tournament_month", "Ay"), value: monthLabel(monthIndex, lang) },
    { key: "phase", icon: phaseMeta.icon, label: i18nText("autoI18n.tournament_stage", "Aşama"), value: lang === "tr" ? phaseMeta.tr : phaseMeta.en },
  ];

  const Hero = (
    <LinearGradient
      colors={phaseMeta.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={styles.heroGlow} />
      <Text style={styles.heroTheme} numberOfLines={1}>{theTheme}</Text>

      {/* Bilgi gridi — tür/ortam/ay/aşama, faza özgü renklerle */}
      <View style={styles.heroGrid}>
        {heroGridItems.map((item, i) => (
          <View key={item.key} style={styles.heroGridCell}>
            <View style={[styles.heroGridIcon, { backgroundColor: phaseMeta.grid[i] }]}>
              <AppIcon family="Ionicons" name={item.icon} size={13} color="#1a1a1a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGridLabel}>{item.label}</Text>
              <Text style={styles.heroGridValue} numberOfLines={1}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.heroCountdownRow}>
        <Text style={styles.heroSub}>{heroLabel}</Text>
        <View style={{ marginTop: 6 }}>
          <CountdownTimer deadlineMs={phaseInfo.nextDeadlineMs} lang={lang} size="lg" />
        </View>
        <Text style={styles.heroDeadline}>
          {i18nText("autoI18n.tournament_deadline", "Bitiş")}: {deadlineText}
        </Text>
      </View>

      {/* İnteraktif aşama çizelgesi — düğüme bas: o turun listesine git */}
      <StageTimeline periodId={periodId} nowMs={nowMs} lang={lang} onStagePress={handleStagePress} />
    </LinearGradient>
  );

  // ── Geçen ayın kazananı (ilk 3 + oy sayıları) — podyum modal butonu ─────────
  const PodiumButton = (
    <TouchableOpacity
      onPress={() => setPodiumVisible(true)}
      activeOpacity={0.85}
      style={[styles.podiumBtn, { backgroundColor: theme.secondary, borderColor: "#F5C51855" }]}
    >
      <View style={styles.podiumIconWrap}>
        <AppIcon family="Ionicons" name="trophy" size={16} color="#F5C518" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.podiumBtnTitle, { color: theme.text.primary }]}>
          {i18nText("autoI18n.tournament_last_winner", "Geçen Ayın Kazananı")}
        </Text>
        <Text style={[styles.podiumBtnSub, { color: theme.text.muted }]}>
          {i18nText("autoI18n.tournament_podium_sub", "İlk 3 · oy sayıları · katılım")}
        </Text>
      </View>
      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
    </TouchableOpacity>
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
            {i18nText(
              "autoI18n.tournament_vote_hint_final",
              "Postere iki kez bas: ilk basış onay ister, ikinci basış oyunu KESİN kaydeder. Her maçta tek oy hakkın var, sonradan değiştirilemez.",
            )}
          </Text>
        </View>
      )}
      {selectedRound.matches.map((m) => (
        <MatchCard
          key={m.matchId}
          match={m}
          mySide={myPicks[m.matchId] || null}
          votable={m.votable && !!m.a && !!m.b && !myPicks[m.matchId]}
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
      {viewMode === "tree" && (
        <View style={[styles.notice, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="finger-print" size={16} color={theme.accent} />
          <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
            {i18nText(
              "autoI18n.tournament_tree_hint",
              "Bir maça dokun: detayını gör ve (tur açıksa) oyunu buradan ver.",
            )}
          </Text>
        </View>
      )}
      {viewMode === "list"
        ? roundList
        : (
          <BracketTree
            rounds={bracket.rounds}
            theme={theme}
            getTmdbUrl={getTmdbUrl}
            lang={lang}
            myPicks={myPicks}
            onMatchPress={(m) => setTreeMatchId(m.matchId)}
          />
        )}
    </View>
  );

  // ── Ağaçtan seçilen maçın oy modalı ─────────────────────────────────────────
  // matchId üzerinden CANLI bracket'ten çözülür ki oy sonrası yüzdeler/rozet
  // modal açıkken de güncellensin.
  const treeMatch = useMemo(() => {
    if (!treeMatchId) return null;
    for (const r of bracket.rounds) {
      for (const m of r.matches) if (m.matchId === treeMatchId) return m;
    }
    return null;
  }, [treeMatchId, bracket]);

  const treeMatchModal = (
    <Modal
      visible={!!treeMatch}
      transparent
      animationType="fade"
      onRequestClose={() => setTreeMatchId(null)}
    >
      <Pressable style={styles.matchModalOverlay} onPress={() => setTreeMatchId(null)}>
        {/* Kartın kendisine basınca kapanmasın */}
        <Pressable onPress={() => {}} style={[styles.matchModalCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          {treeMatch && (
            <>
              <View style={styles.matchModalHeader}>
                <Text style={[styles.matchModalTitle, { color: theme.text.primary }]}>
                  {roundLabel(ROUNDS[treeMatch.round], lang)} · {i18nText("autoI18n.tournament_match", "Maç")} {treeMatch.index + 1}
                </Text>
                <Pressable
                  onPress={() => setTreeMatchId(null)}
                  style={[styles.matchModalClose, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                >
                  <AppIcon family="Ionicons" name="close" size={16} color={theme.text.secondary} />
                </Pressable>
              </View>

              <MatchCard
                match={treeMatch}
                mySide={myPicks[treeMatch.matchId] || null}
                votable={treeMatch.votable && !!treeMatch.a && !!treeMatch.b && !myPicks[treeMatch.matchId]}
                onVote={handleVote}
                theme={theme}
                getTmdbUrl={getTmdbUrl}
                lang={lang}
                hapticsEnabled={hapticsEnabled}
              />

              <Text style={[styles.matchModalHint, { color: theme.text.muted }]}>
                {myPicks[treeMatch.matchId]
                  ? i18nText("autoI18n.tournament_vote_locked", "Bu maçtaki oyun kesin — değiştirilemez")
                  : treeMatch.votable && treeMatch.a && treeMatch.b
                    ? i18nText("autoI18n.tournament_confirm_final_sub", "tekrar bas — değiştirilemez")
                    : treeMatch.decided
                      ? i18nText("autoI18n.tournament_round_done", "Bu maç tamamlandı")
                      : i18nText("autoI18n.tournament_round_locked_short", "Bu tur henüz açık değil")}
              </Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Şampiyon hero (results) ───────────────────────────────────────────────────
  // Konfeti + kademeli giriş animasyonları (poster ZoomIn, metin/istatistikler
  // FadeInDown gecikmeli) ile "ödül töreni" hissi verir. `stats` yalnız BU AYIN
  // canlı bracket'inden gelir (getChampionStats); geçmiş ay podyumu ayrı akışta
  // (PodiumModal → butonla açılır), burada karışmaz.
  const ChampionHero = ({ champion, label, stats }) => {
    const posterUri = champion?.posterPath ? getTmdbUrl(champion.posterPath, "poster", 342) : null;
    const runnerUpUri = stats?.runnerUp?.posterPath
      ? getTmdbUrl(stats.runnerUp.posterPath, "poster", 92)
      : null;
    const thirdUri = stats?.third?.c?.posterPath
      ? getTmdbUrl(stats.third.c.posterPath, "poster", 92)
      : null;
    return (
      <LinearGradient
        colors={["#92400E", "#F5C518", "#FDE68A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.champHero}
      >
        <View pointerEvents="none" style={styles.champGlowOne} />
        <View pointerEvents="none" style={styles.champGlowTwo} />
        <LottieView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          source={require("@lottie/confetti_2.json")}
          autoPlay
          loop={false}
        />

        <Animated.View entering={FadeInDown.duration(380)} style={styles.champKicker}>
          <AppIcon family="Ionicons" name="trophy" size={12} color="#7A4A00" />
          <Text style={styles.champKickerText}>
            {label || i18nText("autoI18n.tournament_champion", "ŞAMPİYON")}
          </Text>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(120).duration(480)} style={styles.champPosterWrap}>
          <View pointerEvents="none" style={styles.champPosterHalo} />
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.champPoster} contentFit="cover" />
          ) : (
            <View style={[styles.champPoster, styles.champPosterEmpty]} />
          )}
          <View style={styles.champCrown}>
            <AppIcon family="Ionicons" name="trophy" size={16} color="#fff" />
          </View>
          {champion?.seed != null && (
            <View style={styles.champSeedBadge}>
              <Text style={styles.champSeedBadgeText}>
                #{champion.seed} {i18nText("autoI18n.tournament_seed", "sıra")}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(200).duration(400)}
          numberOfLines={2}
          style={styles.champTitle}
        >
          {champion?.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.champSubtitle}>
          {theTheme} · {mediaLabel(entry.mediaType, lang)} · {monthLabel(monthIndex, lang)}
        </Animated.Text>

        {stats && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)} style={styles.champStatsRow}>
            <View style={styles.champStatCard}>
              <AppIcon family="Ionicons" name="stats-chart" size={13} color="#7A4A00" />
              <Text style={styles.champStatValue}>%{stats.pct}</Text>
              <Text style={styles.champStatLabel} numberOfLines={1}>
                {i18nText("autoI18n.tournament_final_score", "Final skoru")} · {stats.finalVotes}/{stats.finalTotal}
              </Text>
            </View>
            <View style={styles.champStatDivider} />
            <View style={styles.champStatCard}>
              <AppIcon family="Ionicons" name="flame" size={13} color="#7A4A00" />
              <Text style={styles.champStatValue}>{stats.totalVotes}</Text>
              <Text style={styles.champStatLabel} numberOfLines={1}>
                {i18nText("autoI18n.tournament_total_votes", "Toplam oy")}
              </Text>
            </View>
          </Animated.View>
        )}

        {(stats?.runnerUp || stats?.third) && (
          <Animated.View entering={FadeInDown.delay(380).duration(400)} style={styles.champRunnersRow}>
            {stats?.runnerUp && (
              <View style={styles.champRunnerItem}>
                {runnerUpUri ? (
                  <Image source={{ uri: runnerUpUri }} style={styles.champRunnerThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.champRunnerThumb, styles.champPosterEmpty]} />
                )}
                <AppIcon family="Ionicons" name="medal" size={12} color="#C0C4CE" />
                <Text style={styles.champRunnerText} numberOfLines={1}>
                  {stats.runnerUp.title}
                </Text>
              </View>
            )}
            {stats?.third?.c && (
              <View style={styles.champRunnerItem}>
                {thirdUri ? (
                  <Image source={{ uri: thirdUri }} style={styles.champRunnerThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.champRunnerThumb, styles.champPosterEmpty]} />
                )}
                <AppIcon family="Ionicons" name="medal" size={12} color="#CD7F32" />
                <Text style={styles.champRunnerText} numberOfLines={1}>
                  {stats.third.c.title}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </LinearGradient>
    );
  };

  // ── Aday hype gridi (selection) ───────────────────────────────────────────────
  // İlk açılışta havuz TMDB popülerlik sırasıyla gelir (türünün en bilinen 64
  // yapımı); hype'lar geldikçe canlı olarak oy sayısına göre yeniden sıralanır
  // (rankPool: oy desc → havuz sırası asc). İlk 32 yeşil rozet, kalanı soluk.
  // Postere İKİ KEZ bas = tek ve kesin hype (onay katmanı + değiştirilemez).
  const NomineeGrid = () => (
    <View style={styles.grid}>
      {rankedPool.map((n) => (
        <NomineeCell
          key={n.id}
          id={n.id}
          title={n.title}
          posterPath={n.posterPath}
          rank={n.rank}
          nomVotes={n.nomVotes}
          finalist={n.finalist}
          mine={myNoms.has(String(n.id))}
          canVote={nominationOpen}
          isPending={pendingNom === String(n.id)}
          onPress={handleNomineePress}
          theme={theme}
          getTmdbUrl={getTmdbUrl}
        />
      ))}
    </View>
  );

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
        {PodiumButton}

        {/* Aday hype başlığı + kişisel hak durumu */}
        <View style={styles.nomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text.muted, marginBottom: 2 }]}>
              {nominationOpen
                ? i18nText("autoI18n.tournament_pick32_title", "İlk 32'yi Sen Seç")
                : i18nText("autoI18n.tournament_nominees", "Bu Ayın 32 Adayı")}
            </Text>
            {nominationOpen && (
              <Text style={[styles.nomSubtitle, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.tournament_pick32_sub_hype",
                  "En çok hype alan 32 aday turnuvaya katılır. TEK hakkın var: adayının posterine iki kez bas — seçim kesindir.",
                )}
              </Text>
            )}
          </View>
          {nominationOpen && (
            <View
              style={[
                styles.nomCounter,
                myNoms.size >= MAX_NOMINATIONS
                  ? { backgroundColor: "#22C55E1A", borderColor: "#22C55E66" }
                  : { backgroundColor: theme.accent + "1A", borderColor: theme.accent + "55" },
              ]}
            >
              <AppIcon
                family="Ionicons"
                name={myNoms.size >= MAX_NOMINATIONS ? "checkmark-circle" : "flame"}
                size={12}
                color={myNoms.size >= MAX_NOMINATIONS ? "#22C55E" : theme.accent}
              />
              <Text style={[styles.nomCounterText, { color: theme.text.primary }]}>
                {myNoms.size >= MAX_NOMINATIONS
                  ? i18nText("autoI18n.tournament_hype_done", "Hype verildi")
                  : i18nText("autoI18n.tournament_hype_left", "1 hype hakkı")}
              </Text>
            </View>
          )}
        </View>

        {/* Arama çubuğu görünümlü buton → aday arama modalı (oradan da hype verilir) */}
        <Pressable
          onPress={() => setSearchVisible(true)}
          style={[styles.searchBar, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.tournament_search_ph", "Aday ara…")}
        >
          <AppIcon family="Ionicons" name="search" size={15} color={theme.text.muted} />
          <Text style={[styles.searchBarText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.tournament_search_ph", "Aday ara…")}
          </Text>
          <View style={[styles.searchBarBadge, { backgroundColor: theme.accent + "1A" }]}>
            <AppIcon family="Ionicons" name="flame" size={11} color={theme.accent} />
          </View>
        </Pressable>

        {NomineeGrid()}

        {/* Eşleşme projeksiyonu — şu anki oylara göre; istenirse açılır */}
        <TouchableOpacity
          onPress={() => setShowProjection((s) => !s)}
          activeOpacity={0.8}
          style={[styles.projToggle, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <AppIcon family="Ionicons" name="git-compare" size={14} color={theme.text.secondary} />
          <Text style={[styles.projToggleText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.tournament_projection", "İlk Tur Eşleşme Projeksiyonu")}
          </Text>
          <AppIcon
            family="Ionicons"
            name={showProjection ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.text.muted}
          />
        </TouchableOpacity>
        {showProjection && (
          <View>
            {nominationOpen && (
              <Text style={[styles.nomSubtitle, { color: theme.text.muted, marginBottom: 8 }]}>
                {i18nText(
                  "autoI18n.tournament_projection_hint",
                  "Şu anki aday oylarına göre — seçim bitene kadar değişebilir.",
                )}
              </Text>
            )}
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
        )}
      </View>
    );
  } else if (phaseInfo.phase === "voting") {
    body = (
      <View>
        {Hero}
        {PodiumButton}
        {RoundsBrowser}
      </View>
    );
  } else {
    // results
    body = (
      <View>
        {bracket.champion
          ? ChampionHero({ champion: bracket.champion, stats: championStats })
          : Hero}
        {PodiumButton}
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

      {/* Geçen ayın ilk 3'ü — oy sayıları ve katılım bilgisiyle */}
      <PodiumModal
        visible={podiumVisible}
        onClose={() => setPodiumVisible(false)}
        periodId={getPrevPeriodId(periodId)}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />

      {/* Aday arama modalı — havuzda ara + buradan da hype ver */}
      <NomineeSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        pool={rankedPool}
        myNoms={myNoms}
        canVote={nominationOpen && !!uid && myNoms.size < MAX_NOMINATIONS}
        onHype={commitNomination}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />

      {/* Ağaçtan seçilen maçın detay/oy modalı */}
      {treeMatchModal}
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
  heroGlow: {
    position: "absolute", width: 190, height: 190, borderRadius: 95,
    right: -60, top: -80, backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroTheme: { color: "#fff", fontSize: 22, fontWeight: "900" },

  heroGrid: {
    flexDirection: "row", flexWrap: "wrap",
    marginTop: 12, marginHorizontal: -4,
  },
  heroGridCell: {
    width: "50%", flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 4, paddingVertical: 6,
  },
  heroGridIcon: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  heroGridLabel: { color: "rgba(255,255,255,0.75)", fontSize: 9.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  heroGridValue: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 1 },

  heroCountdownRow: {
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)",
  },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "700" },
  heroDeadline: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", marginTop: 6 },

  podiumBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 15, borderWidth: 1, padding: 11, marginTop: 12,
  },
  podiumIconWrap: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: "#F5C51822",
    alignItems: "center", justifyContent: "center",
  },
  podiumBtnTitle: { fontSize: 13.5, fontWeight: "900" },
  podiumBtnSub: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  nomHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18 },
  nomSubtitle: { fontSize: 11.5, fontWeight: "600", lineHeight: 15, marginBottom: 8 },
  nomCounter: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderWidth: 1,
  },
  nomCounterText: { fontSize: 12, fontWeight: "900" },

  projToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: 13, borderWidth: 1, paddingVertical: 11, marginTop: 6, marginBottom: 10,
  },
  projToggleText: { fontSize: 12.5, fontWeight: "800" },

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

  champHero: {
    borderRadius: 24, padding: 22, alignItems: "center",
    marginTop: 6, marginBottom: 14, overflow: "hidden",
  },
  champGlowOne: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    right: -70, top: -90, backgroundColor: "rgba(255,255,255,0.14)",
  },
  champGlowTwo: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    left: -40, bottom: -60, backgroundColor: "rgba(255,255,255,0.10)",
  },

  champKicker: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.55)", paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 12,
  },
  champKickerText: { color: "#7A4A00", fontSize: 11.5, fontWeight: "900", letterSpacing: 1.5 },

  champPosterWrap: { alignItems: "center", justifyContent: "center", marginTop: 16 },
  champPosterHalo: {
    position: "absolute", width: 170, height: 170, borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  champPoster: {
    width: 132, height: 198, borderRadius: 14, borderWidth: 3, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 8,
  },
  champPosterEmpty: { backgroundColor: "rgba(255,255,255,0.25)" },
  champCrown: {
    position: "absolute", top: -14, alignSelf: "center",
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#F5C518",
    borderWidth: 2.5, borderColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  champSeedBadge: {
    position: "absolute", bottom: 8, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9,
  },
  champSeedBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

  champTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 16, textAlign: "center" },
  champSubtitle: { color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: "700", marginTop: 4 },

  champStatsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 16, width: "100%",
  },
  champStatCard: {
    flex: 1, maxWidth: 150, alignItems: "center", gap: 2,
    backgroundColor: "rgba(255,255,255,0.32)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8,
  },
  champStatValue: { color: "#4A2E00", fontSize: 16, fontWeight: "900" },
  champStatLabel: { color: "#5C3D00", fontSize: 10, fontWeight: "700" },
  champStatDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.4)" },

  champRunnersRow: {
    flexDirection: "row", alignItems: "stretch", justifyContent: "center",
    gap: 8, marginTop: 12, width: "100%",
  },
  champRunnerItem: {
    flex: 1, maxWidth: 165, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 6,
  },
  champRunnerThumb: { width: 20, height: 30, borderRadius: 4 },
  champRunnerText: { color: "#4A2E00", fontSize: 11.5, fontWeight: "800", flexShrink: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 8 },
  gridItem: { width: "25%", padding: 4 },
  gridPosterWrap: { width: "100%", aspectRatio: 2 / 3, borderRadius: 9, overflow: "hidden" },
  gridPoster: { width: "100%", height: "100%" },
  gridSeed: { position: "absolute", top: 4, left: 4, minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, alignItems: "center" },
  gridSeedText: { fontSize: 10, fontWeight: "800" },
  gridMine: {
    position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  gridVotesPill: {
    position: "absolute", bottom: 4, left: 4, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 7,
  },
  gridVotesText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  gridTitle: { fontSize: 10, fontWeight: "600", marginTop: 3 },
  gridConfirm: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 1,
  },
  gridConfirmText: { color: "#fff", fontSize: 10.5, fontWeight: "900", marginTop: 3, textAlign: "center" },
  gridConfirmSub: { color: "rgba(255,255,255,0.85)", fontSize: 8.5, fontWeight: "700", textAlign: "center" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  searchBarText: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  searchBarBadge: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },

  matchModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", padding: 18,
  },
  matchModalCard: {
    width: "100%", maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 14,
  },
  matchModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  },
  matchModalTitle: { fontSize: 14, fontWeight: "900" },
  matchModalClose: {
    width: 30, height: 30, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  matchModalHint: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 2 },

  devStrip: { gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  devChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },

  center: { paddingTop: 80, alignItems: "center", gap: 12 },
  muted: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});

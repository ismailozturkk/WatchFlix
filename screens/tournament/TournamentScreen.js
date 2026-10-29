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
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
} from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import Animated, {
  FadeInDown, FadeInUp, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring,
} from "react-native-reanimated";
import * as Haptics from "@services/hapticsService";
import BackButton from "@components/BackButton";
import AppIcon from "@components/AppIcon";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { toast } from "@components/AppToast";
import MatchCard from "@components/tournament/MatchCard";
import BracketTree from "@components/tournament/BracketTree";
import NomineeSearchModal from "@components/tournament/NomineeSearchModal";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import {
  useImageQualitySettings,
  useHapticsSettings,
  useLanguageSettings,
} from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { usePremiumGate } from "@hooks/usePremiumGate";
import {
  ROUNDS, getPeriodId, getScheduleEntry, parsePeriodId, getPeriodStartMs,
  monthLabel, mediaLabel, roundLabel, themeLabel, getPhaseInfo, buildBracket, tallyVotes,
  getMyPicks, getPrevPeriodId, now, setDebugNow, DAY,
  FINALIST_COUNT, MAX_NOMINATIONS, tallyNominations, getMyNominations,
  rankPool, mergePool, selectFinalists, getChampionStats,
} from "@services/tournamentEngine";
import {
  ensureTournament, subscribeTournamentDoc, subscribeTournamentVotes,
  subscribeTournamentAgg, subscribeMyVote, subscribeTournamentPool,
  castVote, setNomination, addPoolCandidate, fetchTmdbItem,
} from "@services/tournamentService";
import TournamentHero from "@components/tournament/TournamentHero";
import RoundRail from "@components/tournament/RoundRail";
import PodiumModal from "@components/tournament/PodiumModal";
import ScreenDecor from "@components/ScreenDecor";
// Faz kimliği (başlıktaki faz çipi): components/tournament/phaseMeta.js.
// Tür kimliği (hero + ağaç gradyanı, animasyonlu simge) Hub kartıyla ortak:
// components/tournament/genreMeta.js.
import { PHASE_META, phaseLabel } from "@components/tournament/phaseMeta";
import { genreMetaFor } from "@components/tournament/genreMeta";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../../components/common/GlassTouchable";
import GlassPressable from "../../components/common/GlassPressable";
// Onay katmanında artık okunacak iki seçenek var; eski 2.6 sn karar vermeye
// yetmiyordu (MatchCard'daki PENDING_TIMEOUT ile aynı).
const NOM_PENDING_TIMEOUT = 6000;

// Ağaç modalı kapanırken ardından açılacak yükseltme sayfası için pay: kapanış
// animasyonu bitmeden ikinci bir Modal açılırsa iOS onu sunamaz.
const TREE_MODAL_HANDOFF_MS = 350;

// Uygulamanın onay/başarı yeşili — finalist rozeti ve "Hype verildi" çipiyle
// AYNI değer (temada `success` belirteci yok, turnuva ekranı bunu sabit kullanır).
const CONFIRM_GREEN = "#22C55E";

// Basış geri bildirimi: parmak inince poster hafifçe küçülür, kalkınca yayla
// eski boyuna döner (MatchCard ile aynı yay ve oran).
const PRESS_SPRING = { mass: 0.5, damping: 13, stiffness: 200 };
const PRESS_SCALE = 0.94;

// ─── Aday hücresi (seçim fazı "hype" oylaması) ───────────────────────────────
// memo: 64 hücrelik gridde tek oy değişince yalnız etkilenen hücreler çizilsin.
// Görsel dil: sıra rozeti (ilk 32 yeşil, dışı gri+soluk), HYPE (alev) sayacı,
// benim adayım = accent çerçeve + alev rozeti.
//
// OY AKIŞI (eleme maçlarıyla — MatchCard — birebir aynı): postere bas, üstünde
// açılan katmandan İKİ seçenekten birini seç:
//   • Onayla → hype KESİN kaydedilir (tek hak, geri alınamaz)
//   • Bilgi  → yapımın detay sayfası açılır
// Katmanın boşluğuna basmak vazgeçer; dokunulmazsa süre sonunda kapanır.
// Onay bilerek "tekrar bas" değil AÇIK SEÇİM: hak tek ve geri alınamıyor,
// kullanıcı karar vermeden önce yapımın detayına bakabilmeli.
const NomineeCell = React.memo(function NomineeCell({
  id, title, posterPath, rank, nomVotes, finalist, mine, isPending,
  onPress, onConfirm, onInfo, theme, getTmdbUrl,
}) {
  const uri = posterPath ? getTmdbUrl(posterPath, "poster", 185) : null;
  const rankColor = finalist ? CONFIRM_GREEN : "#9CA3AF";

  // Yalnız POSTER ölçeklenir (başlık şeridi yerinde kalsın); dokunma hedefi
  // hücrenin tamamı olmaya devam eder.
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    // Hiçbir zaman disabled DEĞİL: oy verilebiliyorsa hype akışı, verilemiyorsa
    // detay sayfası açılır (karar handleNomineePress'te).
    <Pressable
      onPress={() => onPress(id)}
      onPressIn={() => { press.value = withSpring(PRESS_SCALE, PRESS_SPRING); }}
      onPressOut={() => { press.value = withSpring(1, PRESS_SPRING); }}
      style={styles.gridItem}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Animated.View
        style={[
          styles.gridPosterWrap,
          pressStyle,
          {
            backgroundColor: theme.between,
            // Kenarlık HER ZAMAN 2.5: RN kenarlığı kutunun İÇİNDEN yediği için
            // 0 ↔ 2.5 arası geçiş posteri her basışta 2.5px küçültüp zıplatırdı.
            // Kalınlık sabit, yalnız rengi değişir.
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

        {/* Onay katmanı: posteri TAM kaplayan iki yarım buton — MatchCard ile
            AYNI görsel dil (dairesel ikon rozeti + gradyan derinlik + zıt
            yönlerden giriş), yalnız ölçüler hücre darlığına göre küçültülmüş. */}
        {isPending && (
          <View style={styles.gridConfirm}>
            <Animated.View entering={FadeInDown.duration(170)} style={styles.gridConfirmHalf}>
              <Pressable
                onPress={() => onConfirm(id)}
                style={({ pressed }) => [
                  styles.gridConfirmInner,
                  styles.gridConfirmPrimary,
                  pressed && styles.gridConfirmPressed,
                ]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.16)", "rgba(0,0,0,0.22)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.gridConfirmBadgeLight}>
                  <AppIcon family="Ionicons" name="checkmark-sharp" size={13} color="#fff" />
                </View>
                <Text numberOfLines={1} style={[styles.gridConfirmText, { color: "#fff" }]}>
                  {i18nText("autoI18n.tournament_confirm_short", "Onayla")}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(170)} style={styles.gridConfirmHalf}>
              <Pressable
                onPress={() => onInfo(id)}
                style={({ pressed }) => [
                  styles.gridConfirmInner,
                  styles.gridConfirmInfo,
                  { backgroundColor: theme.accent },
                  pressed && styles.gridConfirmPressed,
                ]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.16)", "rgba(0,0,0,0.22)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.gridConfirmBadgeLight}>
                  <AppIcon family="Ionicons" name="information" size={13} color="#fff" />
                </View>
                <Text numberOfLines={1} style={[styles.gridConfirmText, { color: "#fff" }]}>
                  {i18nText("autoI18n.tournament_info", "Bilgi")}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </Animated.View>
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const { hapticsEnabled } = useHapticsSettings();
  const { selectedLanguage: lang } = useLanguageSettings();
  const uid = user?.uid;

  // Oy kullanmak (maç oyu + aday "hype"ı) Premium'a özel; Free kullanıcı turnuvayı
  // yalnız izler. Kapı, ilk dokunuşta yükseltme sayfasını açar — oy zaten iki
  // adımlı onaydan geçtiği için reddi onaydan SONRAya bırakmak kullanıcıyı yorardı.
  const voteGate = usePremiumGate("tournament_vote");
  const canVoteHere = voteGate.allows();

  const periodId = useMemo(() => getPeriodId(), []);
  const { year, monthIndex } = useMemo(() => parsePeriodId(periodId), [periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);

  const [docData, setDocData] = useState(null);
  // Çok kullanıcı optimizasyonu: tally için önce AGG dokümanı denenir
  // (tournaments/{p}/agg/tallies — Cloud Function toplar, tek doküman).
  // undefined = henüz bilinmiyor, null = agg yok (eski ay / fonksiyon yeni),
  // obj = { noms, picks, voters }. Agg yoksa fallback: votes koleksiyonu.
  const [agg, setAgg] = useState(undefined);
  const [myVote, setMyVote] = useState(null); // yalnız KENDİ oy dokümanım
  const [voteDocs, setVoteDocs] = useState([]); // yalnız fallback modunda dolar
  const [suggested, setSuggested] = useState([]); // aramayla havuza eklenen adaylar
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
  const [infoVisible, setInfoVisible] = useState(false);       // liste/ağaç kullanım ipucu modalı
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
    // Topluluğun aramayla eklediği adaylar — canlı, çünkü seçim fazında havuz
    // büyümeye devam eder (ensureTournament ilk okumada zaten birleştirmişti).
    const unsubPool = subscribeTournamentPool(periodId, (p) => setSuggested(p));
    return () => { active = false; unsubDoc(); unsubAgg(); unsubMine(); unsubPool(); };
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
  // Havuz = ay başı TMDB anlık görüntüsü + topluluğun aramayla eklediği adaylar.
  // mergePool idempotent olduğu için ensureTournament'ın zaten birleştirdiği
  // liste ile canlı öneri akışını tekrar harmanlamak güvenlidir.
  const pool = useMemo(
    () => mergePool(docData?.nominees || [], suggested),
    [docData, suggested],
  );
  const rankedPool = useMemo(() => rankPool(pool, nomTally), [pool, nomTally]);
  const finalists = useMemo(() => selectFinalists(pool, nomTally), [pool, nomTally]);
  const nominationOpen = phaseInfo.phase === "selection" && pool.length > FINALIST_COUNT;
  // Aramanın hedefi: ayın ortamı + türü. Doküman anlık görüntüsü esastır
  // (firestore.rules havuz eklemede mediaType'ı onunla karşılaştırır).
  const poolMediaType = docData?.mediaType || entry.mediaType;
  const poolGenreId = docData?.genreId || entry.genreId;
  // Aramadan aday eklemek TEK hype hakkını harcar; hak bitmişse arama yalnız
  // inceleme moduna düşer (havuz + TMDB listelenir, buton çıkmaz).
  const canHype = nominationOpen && !!uid && myNoms.size < MAX_NOMINATIONS && canVoteHere;

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
      // Savunma: MatchCard ilk dokunuşta zaten engeller; yine de buraya ulaşan
      // bir oy (ör. plan arada düştüyse) yazılmaz.
      if (!canVoteHere) { voteGate.showUpsell(); return; }
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
    [uid, periodId, myPicks, canVoteHere, voteGate],
  );

  // ── Hype'ı KESİN kaydet (grid onayından veya arama modalından gelir) ───────
  const commitNomination = useCallback(
    (nomineeId) => {
      const key = String(nomineeId);
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      if (!canVoteHere) { voteGate.showUpsell(); return; }
      if (myNoms.size >= MAX_NOMINATIONS) {
        toast.warning(i18nText("autoI18n.tournament_hype_used", "Hype hakkını kullandın"));
        return;
      }
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMyVote((prev) => ({
        ...(prev || { uid }),
        noms: { ...(prev?.noms || {}), [key]: true },
      }));
      setNomination({ periodId, uid, nomineeId })
        .then(() => toast.success(i18nText("autoI18n.tournament_hype_saved", "Hype'ın kaydedildi")))
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
    [uid, periodId, myNoms, hapticsEnabled, canVoteHere, voteGate],
  );

  // ── Yarışmacının detay sayfası (onay katmanındaki "Bilgi") ─────────────────
  // Ağaçtan açılan maç modalı da kapatılır; aksi halde detayın ÜSTÜNDE açık
  // kalırdı. Ortam yapımın kendi mediaType'ından, yoksa ayın ortamından gelir.
  const openContestant = useCallback(
    (contestant) => {
      if (!contestant?.id) return;
      setTreeMatchId(null);
      const media = contestant.mediaType || poolMediaType;
      navigation.navigate(media === "tv" ? "TvShowsDetails" : "MovieDetails", { id: contestant.id });
    },
    [navigation, poolMediaType],
  );

  // ── Aramadan gelen aday: havuza EKLE + hype ver ────────────────────────────
  // Ay başı havuzu yalnız türün en popüler 64 yapımıdır; kullanıcı TMDB'de
  // arayıp eksik bir yapımı buradan ekler ve tek hakkını ona harcar.
  //
  // SIRA ÖNEMLİ: önce hype, sonra havuz kaydı. firestore.rules havuz eklemeyi
  // kullanıcının noms'una bağlar (kişi başına tek öneri freni), yani hype
  // dokümanda olmadan pool yazımı reddedilir.
  const commitExternalHype = useCallback(
    async (candidate) => {
      const key = String(candidate?.id ?? "");
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      if (!canVoteHere) { voteGate.showUpsell(); return; }
      if (!key || key === "undefined") return;
      if (myNoms.size >= MAX_NOMINATIONS) {
        toast.warning(i18nText("autoI18n.tournament_hype_used", "Hype hakkını kullandın"));
        return;
      }
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // İyimser: hype ve yeni havuz satırı anında görünsün.
      setMyVote((prev) => ({
        ...(prev || { uid }),
        noms: { ...(prev?.noms || {}), [key]: true },
      }));
      setSuggested((prev) =>
        prev.some((s) => String(s.id) === key)
          ? prev
          : [...prev, { ...candidate, addedBy: uid, addedAtMs: 0 }]);

      try {
        await setNomination({ periodId, uid, nomineeId: key });
      } catch {
        // Hype yazılamadı → her iki iyimser güncellemeyi de geri al.
        setMyVote((prev) => {
          if (!prev) return prev;
          const noms = { ...(prev.noms || {}) };
          delete noms[key];
          return { ...prev, noms };
        });
        setSuggested((prev) => prev.filter((s) => String(s.id) !== key));
        toast.error(i18nText("autoI18n.tournament_vote_fail", "Oy kaydedilemedi"));
        return;
      }

      try {
        // false = sessiz no-op (faz kapandı / eksik parametre) — başarı sayma.
        if (!(await addPoolCandidate({ periodId, uid, candidate }))) throw new Error("pool-noop");
        setSearchVisible(false);
        toast.success(i18nText("autoI18n.tournament_added_hyped", "Hype'ın kaydedildi"));
      } catch {
        // Hype KAYITLI (geri alınamaz) ama havuz satırı yazılamadı: aday
        // görünmez kalmasın diye açılışta kendini onarma yolu tekrar dener.
        toast.warning(i18nText("autoI18n.tournament_pool_add_retry", "Hype'ın kaydedildi, aday birazdan eklenecek"));
      }
    },
    [uid, periodId, myNoms, hapticsEnabled, canVoteHere, voteGate],
  );

  // ── Kendini onarma: hype var ama havuzda aday yok ───────────────────────────
  // (Yukarıdaki ikinci yazım ağ hatasıyla düştüyse.) Aday TMDB'den geri kurulur
  // ve havuz kaydı yeniden denenir; yoksa kullanıcının TEK hakkı boşa giderdi.
  const healedRef = useRef(new Set());
  useEffect(() => {
    if (phaseInfo.phase !== "selection" || !uid) return;
    if (!docData?.nominees?.length) return; // havuz henüz yüklenmedi
    const missing = [...myNoms].find(
      (id) => !pool.some((n) => String(n.id) === id) && !healedRef.current.has(id),
    );
    if (!missing) return;
    healedRef.current.add(missing); // hata olsa da bu oturumda tekrar deneme
    fetchTmdbItem({ mediaType: poolMediaType, id: missing, language: lang })
      .then((c) => (c ? addPoolCandidate({ periodId, uid, candidate: c }) : null))
      .catch(() => {});
  }, [myNoms, pool, phaseInfo.phase, uid, docData, poolMediaType, lang, periodId]);

  // Grid onayı: 1. basış katmanı açar, sonra katmandaki Onayla / Bilgi seçilir.
  const clearPendingNom = useCallback(() => {
    if (nomTimer.current) { clearTimeout(nomTimer.current); nomTimer.current = null; }
    setPendingNom(null);
  }, []);
  useEffect(() => () => { if (nomTimer.current) clearTimeout(nomTimer.current); }, []);

  const handleNomineePress = useCallback(
    (nomineeId) => {
      const key = String(nomineeId);
      if (!uid) { toast.error(i18nText("autoI18n.giris_gerekli", "Giriş gerekli")); return; }
      // Verilecek oy kalmadığında (hak bitti veya aday penceresi kapalı) ızgara
      // bir OY yüzeyi olmaktan çıkıp gezinme yüzeyine döner: hangi postere
      // basılırsa basılsın (kendi adayın dahil) detayına gider. Yapacak oy
      // yokken uyarı toast'u da, hiçbir şey olmaması da işe yaramıyordu.
      if (!nominationOpen || myNoms.size >= MAX_NOMINATIONS) {
        openContestant(pool.find((n) => String(n.id) === key) || { id: nomineeId });
        return;
      }
      // Katman posteri TAM kapladığı için bu basış açıkken yalnız posterin
      // DIŞINDAN (altındaki başlık şeridi) gelebilir → vazgeçme yolu budur.
      if (pendingNom === key) { clearPendingNom(); return; }
      // Seyirci (Free): onay katmanı açılmaz, yükseltme sayfası gelir.
      if (!canVoteHere) { voteGate.showUpsell(); return; }
      // Onay artık "aynı yere tekrar basmak" değil, katmandaki açık seçim.
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setPendingNom(key);
      if (nomTimer.current) clearTimeout(nomTimer.current);
      nomTimer.current = setTimeout(() => setPendingNom(null), NOM_PENDING_TIMEOUT);
    },
    [uid, myNoms, hapticsEnabled, openContestant, pool, nominationOpen, pendingNom, clearPendingNom, canVoteHere, voteGate],
  );

  const handleNomineeConfirm = useCallback(
    (nomineeId) => {
      clearPendingNom();
      commitNomination(nomineeId);
    },
    [clearPendingNom, commitNomination],
  );

  // Detaya giderken katman kapanmalı: geri dönüldüğünde açık kalmasın.
  const handleNomineeInfo = useCallback(
    (nomineeId) => {
      const key = String(nomineeId);
      clearPendingNom();
      openContestant(pool.find((n) => String(n.id) === key) || { id: nomineeId });
    },
    [clearPendingNom, openContestant, pool],
  );

  const theTheme = themeLabel(entry, lang);
  const phaseMeta = PHASE_META[phaseInfo.phase] || PHASE_META.selection;
  const genreMeta = genreMetaFor(entry);

  // ── Geçen ayın kazananı (ilk 3 + oy sayıları) — küçük kupa ikonu, podyum
  // modalını açar. Başlık/alt yazı kaldırıldı; tüm bilgi accessibilityLabel'da.
  // Header'ın en sağında yer alır.
  const PodiumButton = (
    <GlassTouchable
      onPress={() => setPodiumVisible(true)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.tournament_last_winner", "Geçen Ayın Kazananı")} — ${i18nText("autoI18n.tournament_podium_sub", "İlk 3 · oy sayıları · geçmiş kazananlar")}`}
      style={[styles.podiumBtn, { backgroundColor: "#F5C51822", borderColor: "#F5C51866" }]}
    >
      <AppIcon family="Ionicons" name="trophy" size={17} color="#F5C518" />
    </GlassTouchable>
  );

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
          {phaseLabel(phaseMeta, lang)}
        </Text>
      </View>
      {PodiumButton}
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

  // Aşama çizelgesinden tur seçimi (oylama/sonuç fazlarında ilgili tura atlar).
  const handleStagePress = useCallback((s) => {
    if (s.roundIndex == null) return;
    setTab(s.roundIndex);
    setViewMode("list");
  }, []);

  // Tür başlığı + ay/ortam çipleri + geri sayım paneli + interaktif aşama çizelgesi.
  const Hero = (
    <TournamentHero
      genreMeta={genreMeta}
      theTheme={theTheme}
      mediaType={entry.mediaType}
      monthIndex={monthIndex}
      year={year}
      lang={lang}
      label={heroLabel}
      deadlineMs={phaseInfo.nextDeadlineMs}
      periodId={periodId}
      nowMs={nowMs}
      onStagePress={handleStagePress}
    />
  );

  // ── Tur seçici ────────────────────────────────────────────────────────────────
  const RoundChips = (
    <RoundRail
      rounds={bracket.rounds}
      phase={phaseInfo.phase}
      activeRound={phaseInfo.activeRound}
      selected={tab}
      onSelect={setTab}
      myPicks={myPicks}
      theme={theme}
      lang={lang}
    />
  );

  // ── Liste/Ağaç anahtarı ─────────────────────────────────────────────────────
  // Parça (segmented) kontrol: seçili segment accent dolgulu, diğeri şeffaf.
  const ViewToggle = (
    <View style={[styles.toggle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {["list", "tree"].map((m) => (
        <GlassPressable
          key={m}
          onPress={() => setViewMode(m)}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === m }}
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
        </GlassPressable>
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
      {selectedRound.matches.map((m) => (
        <MatchCard
          key={m.matchId}
          match={m}
          mySide={myPicks[m.matchId] || null}
          votable={m.votable && !!m.a && !!m.b && !myPicks[m.matchId]}
          onVote={handleVote}
          canVote={canVoteHere}
          onVoteBlocked={voteGate.showUpsell}
          onInfo={openContestant}
          theme={theme}
          getTmdbUrl={getTmdbUrl}
          lang={lang}
          hapticsEnabled={hapticsEnabled}
        />
      ))}
    </View>
  );

  // Seçili turun alt satırı: "16 maç · Oyların 5/16" (giriş yapılmamışsa yalnız maç sayısı).
  const selectedMatchCount = selectedRound?.matches.length || 0;
  const selectedMyCount = selectedRound
    ? selectedRound.matches.reduce((n, m) => n + (myPicks[m.matchId] ? 1 : 0), 0)
    : 0;
  const browserSub = selectedRound
    ? `${selectedMatchCount} ${i18nText("autoI18n.tournament_widget_match", "maç")}${
        uid ? ` · ${i18nText("autoI18n.tournament_my_votes", "Oyların")} ${selectedMyCount}/${selectedMatchCount}` : ""
      }`
    : "";

  const RoundsBrowser = (
    <View>
      {RoundChips}
      <View style={styles.browserHeader}>
        <View style={styles.browserTitleWrap}>
          <Text numberOfLines={1} style={[styles.browserTitle, { color: theme.text.primary }]}>
            {selectedRound ? roundLabel(selectedRound.def, lang) : ""}
          </Text>
          <Text numberOfLines={1} style={[styles.browserSub, { color: theme.text.muted }]}>
            {browserSub}
          </Text>
        </View>
        <View style={styles.browserHeaderRight}>
          <GlassTouchable
            onPress={() => setInfoVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.tournament_info", "Bilgi")}
            style={[styles.infoBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name="information" size={13} color={theme.text.secondary} />
          </GlassTouchable>
          {ViewToggle}
        </View>
      </View>
      {viewMode === "list"
        ? roundList
        : (
          <BracketTree
            rounds={bracket.rounds}
            genre={genreMeta}
            periodId={periodId}
            focusRound={tab}
            getTmdbUrl={getTmdbUrl}
            lang={lang}
            myPicks={myPicks}
            onMatchPress={(m) => setTreeMatchId(m.matchId)}
          />
        )}
    </View>
  );

  // ── Liste/ağaç kullanım ipucu — eskiden her zaman açık bant olarak
  // görünürdü; artık üstteki "!" ikonuna basınca açılan bir kart.
  const infoModal = (
    <Modal
      visible={infoVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setInfoVisible(false)}
    >
      <Pressable style={styles.matchModalOverlay} onPress={() => setInfoVisible(false)}>
        <GlassPressable onPress={() => {}} style={[styles.matchModalCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <View style={styles.matchModalHeader}>
            <Text style={[styles.matchModalTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.tournament_info", "Bilgi")}
            </Text>
            <GlassCloseButton
              size={30}
              fallbackRadius={10}
              iconSize={16}
              color={theme.text.secondary}
              backgroundColor={theme.secondary}
              borderColor={theme.border}
              onPress={() => setInfoVisible(false)}
            />
          </View>

          <View style={[styles.notice, { backgroundColor: theme.accent + "1A", borderColor: theme.accent + "44" }]}>
            <AppIcon family="Ionicons" name="hand-left" size={16} color={theme.accent} />
            <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
              {i18nText(
                "autoI18n.tournament_vote_hint_final",
                "Postere iki kez bas: ilk basış onay ister, ikinci basış oyunu KESİN kaydeder. Her maçta tek oy hakkın var, sonradan değiştirilemez.",
              )}
            </Text>
          </View>
          <View style={[styles.notice, { backgroundColor: theme.secondary, borderColor: theme.border, marginBottom: 0 }]}>
            <AppIcon family="Ionicons" name="finger-print" size={16} color={theme.accent} />
            <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
              {i18nText(
                "autoI18n.tournament_tree_hint",
                "Bir maça dokun: detayını gör ve (tur açıksa) oyunu buradan ver.",
              )}
            </Text>
          </View>
        </GlassPressable>
      </Pressable>
      <ModalToastHost visible={infoVisible} />
    </Modal>
  );

  // ── Ağaçtan seçilen maçın oy modalı ─────────────────────────────────────────
  // matchId üzerinden CANLI bracket'ten çözülür ki oy sonrası yüzdeler/rozet
  // modal açıkken de güncellensin.
  // Seyirci (Free) ağaç modalında oy vermeye kalkarsa: önce modal kalkar, sonra
  // yükseltme sayfası açılır — iOS iki Modal'ı aynı anda sunamaz.
  const handleTreeVoteBlocked = useCallback(() => {
    setTreeMatchId(null);
    setTimeout(() => voteGate.showUpsell(), TREE_MODAL_HANDOFF_MS);
  }, [voteGate]);

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
        <GlassPressable onPress={() => {}} style={[styles.matchModalCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          {treeMatch && (
            <>
              <View style={styles.matchModalHeader}>
                <Text style={[styles.matchModalTitle, { color: theme.text.primary }]}>
                  {roundLabel(ROUNDS[treeMatch.round], lang)} · {i18nText("autoI18n.tournament_match", "Maç")} {treeMatch.index + 1}
                </Text>
                <GlassCloseButton
                  size={30}
                  fallbackRadius={10}
                  iconSize={16}
                  color={theme.text.secondary}
                  backgroundColor={theme.secondary}
                  borderColor={theme.border}
                  onPress={() => setTreeMatchId(null)}
                />
              </View>

              <MatchCard
                match={treeMatch}
                mySide={myPicks[treeMatch.matchId] || null}
                votable={treeMatch.votable && !!treeMatch.a && !!treeMatch.b && !myPicks[treeMatch.matchId]}
                onVote={handleVote}
                canVote={canVoteHere}
                onVoteBlocked={handleTreeVoteBlocked}
                onInfo={openContestant}
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
        </GlassPressable>
      </Pressable>
      <ModalToastHost visible={!!treeMatch} />
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
  //
  // Izgara İKİYE bölünür: ilk 32 (turnuvaya girenler) ile geri kalan. Arada bir
  // "eleme sınırı" ayracı durur; böylece yeşil/soluk rozet farkı tek başına
  // bırakılmaz, sınırın nerede olduğu görülür. Havuz ≤ 32 ise ayraç çıkmaz.
  const renderNominee = (n) => (
    <NomineeCell
      key={n.id}
      id={n.id}
      title={n.title}
      posterPath={n.posterPath}
      rank={n.rank}
      nomVotes={n.nomVotes}
      finalist={n.finalist}
      mine={myNoms.has(String(n.id))}
      isPending={pendingNom === String(n.id)}
      onPress={handleNomineePress}
      onConfirm={handleNomineeConfirm}
      onInfo={handleNomineeInfo}
      theme={theme}
      getTmdbUrl={getTmdbUrl}
    />
  );

  const NomineeGrid = () => {
    const inList = rankedPool.filter((n) => n.finalist);
    const outList = rankedPool.filter((n) => !n.finalist);
    return (
      <View>
        <View style={styles.grid}>{inList.map(renderNominee)}</View>
        {outList.length > 0 && (
          <>
            <View style={styles.cutline}>
              <View style={styles.cutlineRow}>
                <View style={[styles.cutlineRule, { backgroundColor: theme.border }]} />
                <View style={[styles.cutlinePill, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <AppIcon family="Ionicons" name="cut" size={12} color={theme.text.muted} />
                  <Text style={[styles.cutlineText, { color: theme.text.secondary }]}>
                    {i18nText("autoI18n.tournament_cutline", "Eleme sınırı")}
                  </Text>
                </View>
                <View style={[styles.cutlineRule, { backgroundColor: theme.border }]} />
              </View>
              <Text style={[styles.cutlineSub, { color: theme.text.muted }]}>
                {i18nText("autoI18n.tournament_cutline_sub", "Altındakiler dışarıda kalır")}
              </Text>
            </View>
            <View style={styles.grid}>{outList.map(renderNominee)}</View>
          </>
        )}
      </View>
    );
  };

  // ── Seyirci bandı (Free) ──────────────────────────────────────────────────────
  // Ücretsiz planda turnuva yalnız izlenir. Bant, oy verilebilen fazlarda (aday
  // seçimi + eleme turları) nedenini söyler ve yükseltme sayfasına götürür; aksi
  // halde postere basınca "bir şey olmuyor" hissi verirdi.
  const spectatorNotice =
    !canVoteHere && !!uid && (nominationOpen || phaseInfo.phase === "voting") ? (
      <GlassPressable
        onPress={() => voteGate.showUpsell()}
        accessibilityRole="button"
        style={[styles.notice, { backgroundColor: theme.accent + "1A", borderColor: theme.accent + "44" }]}
      >
        <AppIcon family="Ionicons" name="eye" size={16} color={theme.accent} />
        <Text style={[styles.noticeText, { color: theme.text.secondary }]}>
          {lang === "tr" ? "Turnuvayı seyirci olarak izliyorsun. Oy kullanmak Premium'a özel." : lang === "es" ? "Estás viendo el torneo como espectador. Votar es una ventaja Premium." : lang === "pt" ? "Você está vendo o torneio como espectador. Votar é um benefício Premium." : lang === "de" ? "Du schaust als Zuschauer zu. Das Abstimmen ist ein Premium-Vorteil." : "You're watching as a spectator. Voting is a Premium perk."}
        </Text>
        <AppIcon family="Ionicons" name="chevron-forward" size={14} color={theme.text.muted} />
      </GlassPressable>
    ) : null;

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
        {spectatorNotice}

        {/* Aday hype kartı: ikon + başlık + kişisel hak çipi, alt metin ve arama.
            Başlık ve çip TEK satırda (dikeyde ortalı), alt metin altlarında tam
            genişlikte. Çip sol sütunun içinde değil ki alt metin iki satıra
            çıkınca çip aşağı kaymasın. */}
        <View style={[styles.nomCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={styles.nomTitleRow}>
            <View style={[styles.nomIconTile, { backgroundColor: theme.accent + "1F" }]}>
              <AppIcon family="Ionicons" name={nominationOpen ? "flame" : "list"} size={16} color={theme.accent} />
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.nomTitle, { color: theme.text.primary }]}
            >
              {nominationOpen
                ? i18nText("autoI18n.tournament_pick32_title", "İlk 32'yi Sen Seç")
                : i18nText("autoI18n.tournament_nominees", "Bu Ayın 32 Adayı")}
            </Text>
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
                <Text numberOfLines={1} style={[styles.nomCounterText, { color: theme.text.primary }]}>
                  {myNoms.size >= MAX_NOMINATIONS
                    ? i18nText("autoI18n.tournament_hype_done", "Hype verildi")
                    : i18nText("autoI18n.tournament_hype_left", "1 hype hakkı")}
                </Text>
              </View>
            )}
          </View>

          {/* Alt metin hype verilince KISALIR ama KALKMAZ: kalksaydı altındaki
              her şey (arama çubuğu, ızgara) yukarı zıplardı. Slot iki satıra
              sabitlenmiştir (nomSubtitle.minHeight), böylece iki durum da aynı
              yüksekliği kaplar — hiçbir kayma olmaz. */}
          {nominationOpen && (
            <Text numberOfLines={2} style={[styles.nomSubtitle, { color: theme.text.muted }]}>
              {myNoms.size >= MAX_NOMINATIONS
                ? i18nText(
                    "autoI18n.tournament_pick32_sub_done",
                    "En çok hype alan 32 yapım turnuvaya girer.",
                  )
                : i18nText(
                    "autoI18n.tournament_pick32_sub_hype",
                    "En çok hype alan 32 yapım turnuvaya girer. Tek hakkın var.",
                  )}
            </Text>
          )}

          {/* Arama çubuğu görünümlü buton → aday arama ekranı (oradan hype verilir) */}
          <GlassPressable
            onPress={() => setSearchVisible(true)}
            style={[styles.searchBar, { backgroundColor: theme.between, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.tournament_search_ph", "Aday ara…")}
          >
            <AppIcon family="Ionicons" name="search" size={15} color={theme.text.muted} />
            <Text style={[styles.searchBarText, { color: theme.text.muted }]} numberOfLines={1}>
              {i18nText("autoI18n.tournament_search_ph", "Aday ara…")}
            </Text>
            <View style={[styles.searchBarBadge, { backgroundColor: theme.accent + "1A" }]}>
              <AppIcon family="Ionicons" name="flame" size={11} color={theme.accent} />
            </View>
          </GlassPressable>
        </View>

        {NomineeGrid()}

        {/* Eşleşme projeksiyonu — şu anki oylara göre; istenirse açılır */}
        <GlassTouchable
          onPress={() => setShowProjection((s) => !s)}
          activeOpacity={0.8}
          style={[styles.projToggle, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <View style={[styles.projIcon, { backgroundColor: theme.accent + "1F" }]}>
            <AppIcon family="Ionicons" name="git-compare" size={15} color={theme.accent} />
          </View>
          <Text numberOfLines={1} style={[styles.projToggleText, { color: theme.text.primary }]}>
            {i18nText("autoI18n.tournament_projection", "İlk Tur Eşleşme Projeksiyonu")}
          </Text>
          <AppIcon
            family="Ionicons"
            name={showProjection ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.text.muted}
          />
        </GlassTouchable>
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
                onInfo={openContestant}
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
        {spectatorNotice}
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
        {RoundsBrowser}
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="more" iconOpacity={0.25} />
      {Header}
      {__DEV__ && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devStrip}>
          {DEV_PRESETS.map((p) => (
            <GlassTouchable
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
            </GlassTouchable>
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

      {/* Aday arama modalı — havuzda + TMDB'de ara, buradan hype ver / havuza ekle */}
      <NomineeSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        pool={rankedPool}
        myNoms={myNoms}
        canVote={canHype}
        onHype={commitNomination}
        onHypeExternal={commitExternalHype}
        onOpen={(n) => { setSearchVisible(false); openContestant(n); }}
        mediaType={poolMediaType}
        genreId={poolGenreId}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />

      {/* Ağaçtan seçilen maçın detay/oy modalı */}
      {treeMatchModal}

      {/* Liste/ağaç kullanım ipucu — "!" ikonuna basınca açılır */}
      {infoModal}
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

  // Hero kartı artık components/tournament/TournamentHero.js içinde.

  podiumBtn: {
    width: 34, height: 34, borderRadius: 12,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  // Aday hype kartı: başlık + çip + alt metin + arama tek yüzeyde.
  nomCard: { marginTop: 16, marginBottom: 14, padding: 14, borderRadius: 22, borderWidth: 1 },
  // Başlık ile çip dikeyde ORTALANIR (flex-start'ta çip başlığa göre kayıyordu).
  nomTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  nomIconTile: {
    width: 32, height: 32, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  nomTitle: { flex: 1, fontSize: 16, fontWeight: "900" },
  // İki satırlık SABİT slot: metin kısalsa da yükseklik değişmez → kayma yok.
  nomSubtitle: {
    fontSize: 11.5, fontWeight: "600", lineHeight: 15,
    minHeight: 30, marginBottom: 10,
  },

  // Eleme sınırı ayracı (ilk 32 ile geri kalan arasında).
  cutline: { marginTop: 6, marginBottom: 12 },
  cutlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cutlineRule: { flex: 1, height: 1, borderRadius: 1 },
  cutlinePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  cutlineText: { fontSize: 11.5, fontWeight: "800" },
  cutlineSub: { fontSize: 10.5, fontWeight: "600", textAlign: "center", marginTop: 5 },
  nomCounter: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderWidth: 1,
    // Sabit genişlik: "1 hype hakkı" ↔ "Hype verildi" geçişinde çip büyüyüp
    // küçülmesin, sol sütun (flex:1) yeniden akmasın.
    minWidth: 112,
  },
  nomCounterText: { fontSize: 12, fontWeight: "900" },

  projToggle: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 18, borderWidth: 1, padding: 12, marginTop: 6, marginBottom: 12,
  },
  projIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  projToggleText: { flex: 1, fontSize: 13, fontWeight: "800" },

  browserHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  browserTitleWrap: { flex: 1, minWidth: 0 },
  browserTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  browserSub: { fontSize: 11.5, fontWeight: "700", marginTop: 2 },
  browserHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoBtn: {
    width: 32, height: 32, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  toggle: { flexDirection: "row", borderRadius: 13, borderWidth: 1, padding: 3, gap: 2 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
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
  gridPosterWrap: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 12, overflow: "hidden",
    borderWidth: 2.5, // rengi duruma göre değişir; kalınlık sabit (bkz. NomineeCell)
  },
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
  // Posteri tam kaplayan iki yarım buton (üst: Onayla, alt: Bilgi).
  gridConfirm: { ...StyleSheet.absoluteFill, flexDirection: "column" },
  gridConfirmHalf: { flex: 1 },
  gridConfirmInner: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 3,
    paddingHorizontal: 3, overflow: "hidden",
  },
  // Yeşil = onay, accent = bilgi (MatchCard ile aynı kural).
  gridConfirmPrimary: { backgroundColor: CONFIRM_GREEN },
  gridConfirmInfo: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.55)" },
  gridConfirmPressed: { opacity: 0.82 },
  gridConfirmBadgeLight: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  gridConfirmText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.2 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11,
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
  matchModalHint: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 2 },

  devStrip: { gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  devChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },

  center: { paddingTop: 80, alignItems: "center", gap: 12 },
  muted: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});

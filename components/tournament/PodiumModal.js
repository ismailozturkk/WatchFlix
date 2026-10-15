// components/tournament/PodiumModal.js
//
// "Geçen Ayın Kazananı" alt-sayfası: önceki ayın turnuvasından İLK 3 + arşiv.
//   • 1. = final kazananı (şampiyon)  • 2. = final kaybedeni
//   • 3. = yarı final kaybedenlerinden daha iyi olanı (YF oyu → toplam oy → seed)
//
// Düzen (yukarıdan aşağı):
//   1. Şampiyon kartı — bulanık poster arka planlı koyu "hero": büyük poster,
//      başlık, turnuva boyunca toplanan oy, final skoru çubuğu (şampiyon vs finalist).
//   2. 2. ve 3. — madalya rozetli kompakt satırlar (poster, başlık, skor, oy).
//   3. Katılım kutucukları — katılımcı sayısı + toplam oy.
//   4. Geçmiş kazananlar — YILA göre gruplu; her ay bir kart, dokununca açılır ve
//      o ayın 2./3. sırası + katılım/final rakamlarını gösterir (tek seferde bir kart).
//
// Veri butona basılınca BİR KEZ yüklenir (doc + votes) ve state'te tutulur; arşiv
// tek koleksiyon okumasıdır (tournamentWinners — Cloud Function yazar) ve üstteki
// podyumdan BAĞIMSIZ yüklenir.
//
// Hero her zaman KOYU zemindedir (beyaz/altın yazı), bu yüzden tema açık da olsa
// okunurluk değişmez; hero dışındaki her şey tema token'larından gelir.
//
// Kabuk: BottomSheetModal — diğer tüm alt sayfalarla aynı blur+kayma davranışı
// (blur YERİNDE solar, sayfa TAM OPAKLIKTA aşağıdan yukarı kayar).

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, LayoutAnimation,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import GlassCloseButton from "@components/common/GlassCloseButton";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import {
  buildBracket, tallyVotes, tallyNominations, selectFinalists, parsePeriodId,
  monthLabel, mediaLabel, getScheduleEntry, themeLabel, now,
  computeContestantTotals, computeThirdPlace,
} from "@services/tournamentEngine";
import {
  getTournamentDoc, fetchVotesOnce, fetchAggOnce, fetchWinnerArchive,
} from "@services/tournamentService";

const GOLD = "#F5C518";
// Tema yüzeyleri (açık temada beyaz kart) üzerindeki altın METİN/İKON için koyulaştırılmış ton —
// saf #F5C518 beyaz üstünde okunmaz. Altın DOLGU (rozet, hero) GOLD kalır.
const GOLD_INK = "#B58300";

// Sıraya göre madalya rengi (dolgu) + üzerindeki yazı rengi (koyu — her üç renkte de okunur)
// + tema yüzeyi üstünde okunan metin/ikon tonu (label — hem koyu hem açık temada).
const MEDAL = [
  { color: GOLD, ink: "#3b2a00", label: GOLD_INK },            // 1 — altın
  { color: "#C9CED8", ink: "#2b2f38", label: "#8A93A5" },     // 2 — gümüş
  { color: "#CD7F32", ink: "#2e1a05", label: "#B8691F" },     // 3 — bronz
];

// Türkçe-güvenli BÜYÜK harf: JS'in toUpperCase'i 'i' → 'I' yapar, doğrusu 'İ'dir.
const trUpper = (s, lang) =>
  (lang === "tr" ? String(s).replace(/i/g, "İ") : String(s)).toUpperCase();

const formatNumber = (n, lang) =>
  Number(n || 0).toLocaleString(lang === "tr" ? "tr-TR" : "en-US");

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

// ─── Ortak parçalar ──────────────────────────────────────────────────────────
// Poster yoksa tema renkli yer tutucu; boyutlar çağırandan gelir.
const Poster = memo(({ uri, width, height, radius, theme, style }) =>
  uri ? (
    <Image
      source={{ uri }}
      style={[{ width, height, borderRadius: radius }, style]}
      contentFit="cover"
      transition={120}
    />
  ) : (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.between, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <AppIcon family="Ionicons" name="image-outline" size={Math.max(12, Math.min(width * 0.4, 22))} color={theme.text.muted} />
    </View>
  ),
);

// Küçük bilgi hapı (ikon + metin) — arşiv kartının açılan bölümünde.
const InfoChip = memo(({ icon, text, theme }) => (
  <View style={[styles.infoChip, { backgroundColor: theme.between }]}>
    <AppIcon family="Ionicons" name={icon} size={11} color={GOLD_INK} />
    <Text style={[styles.infoChipText, { color: theme.text.secondary }]} numberOfLines={1}>{text}</Text>
  </View>
));

// ─── 1. Şampiyon kartı ───────────────────────────────────────────────────────
// Arka plan: posterin kendisi, bulanık + karartılmış; üstüne altın bir ışıma.
// Poster yoksa düz koyu zemin + ışıma kalır. Alttaki cam panel final skorunu
// şampiyon (altın) ve finalist (gri) payı olarak çubukta gösterir.
const ChampionHero = memo(({ item, rival, meta, theme, getTmdbUrl, lang }) => {
  const c = item.c;
  const uri = c.posterPath ? getTmdbUrl(c.posterPath, "poster", 342) : null;
  const entry = meta ? getScheduleEntry(meta.monthIndex) : null;
  const hasFinal = item.score.t > 0;
  const rivalVotes = rival ? rival.score.v : Math.max(0, item.score.t - item.score.v);
  const rivalPct = rival ? rival.score.pct : Math.max(0, 100 - item.score.pct);

  return (
    <View style={styles.hero}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={26} />
      ) : null}
      <LinearGradient
        colors={[alpha("#1A1203", 0.55), alpha("#08070C", 0.94)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[alpha(GOLD, 0.34), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.heroGlow} />
      <View pointerEvents="none" style={styles.heroWatermark}>
        <AppIcon family="Ionicons" name="trophy" size={130} color="rgba(255,255,255,0.07)" />
      </View>

      <View style={styles.heroTop}>
        <View style={styles.crownChip}>
          <AppIcon family="Ionicons" name="trophy" size={12} color={MEDAL[0].ink} />
          <Text style={styles.crownChipText}>{i18nText("autoI18n.tournament_champion", "ŞAMPİYON")}</Text>
        </View>
        {meta ? (
          <View style={styles.glassPill}>
            <AppIcon family="Ionicons" name={meta.mediaType === "tv" ? "tv" : "film"} size={11} color="#fff" />
            <Text style={styles.glassPillText} numberOfLines={1}>
              {entry ? `${themeLabel(entry, lang)} · ` : ""}{mediaLabel(meta.mediaType, lang)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroBody}>
        <View style={styles.heroPosterHalo}>
          <Poster
            uri={uri}
            width={112}
            height={168}
            radius={13}
            theme={theme}
            style={styles.heroPoster}
          />
        </View>

        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle} numberOfLines={3}>{c.title}</Text>
          <View>
            <View style={styles.heroVotesRow}>
              <AppIcon family="Ionicons" name="flame" size={18} color={GOLD} />
              <Text style={styles.heroVotesNum}>{formatNumber(item.total, lang)}</Text>
              <Text style={styles.heroVotesUnit}>{i18nText("autoI18n.tournament_votes", "oy")}</Text>
            </View>
            <Text style={styles.heroVotesSub}>
              {i18nText("autoI18n.tournament_across", "turnuva boyunca")}
            </Text>
          </View>
        </View>
      </View>

      {hasFinal ? (
        <View style={styles.finalPanel}>
          <View style={styles.finalHead}>
            <Text style={styles.finalLabel}>
              {i18nText("autoI18n.tournament_final_score", "Final skoru")}
            </Text>
            <Text style={styles.finalNums}>
              <Text style={{ color: GOLD }}>{formatNumber(item.score.v, lang)}</Text>
              {"  –  "}
              {formatNumber(rivalVotes, lang)}
            </Text>
          </View>
          <View style={styles.finalBar}>
            <View style={[styles.finalFillWin, { flex: Math.max(item.score.v, 0.0001) }]} />
            <View style={[styles.finalFillRival, { flex: Math.max(rivalVotes, 0.0001) }]} />
          </View>
          <View style={styles.finalHead}>
            <Text style={[styles.finalPct, { color: GOLD }]}>%{item.score.pct}</Text>
            <Text style={[styles.finalPct, { color: "rgba(255,255,255,0.62)" }]}>%{rivalPct}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

// ─── 2. 2. ve 3. sıra satırı ─────────────────────────────────────────────────
const PlaceRow = memo(({ item, theme, getTmdbUrl, lang }) => {
  const medal = MEDAL[item.place - 1];
  const uri = item.c.posterPath ? getTmdbUrl(item.c.posterPath, "poster", 185) : null;
  const placeLabel =
    item.place === 2
      ? i18nText("autoI18n.tournament_place_2", "Finalist")
      : i18nText("autoI18n.tournament_place_3", "Üçüncü");
  const scoreLabel =
    item.place === 3
      ? i18nText("autoI18n.tournament_semifinal", "Yarı final")
      : i18nText("autoI18n.tournament_final_short", "Final");

  return (
    <View style={[styles.place, { backgroundColor: theme.secondary, borderColor: alpha(medal.color, 0.38) }]}>
      <View style={[styles.placeAccent, { backgroundColor: medal.color }]} />
      <View>
        <Poster uri={uri} width={46} height={69} radius={9} theme={theme} />
        <View style={[styles.rankBadge, { backgroundColor: medal.color }]}>
          <Text style={[styles.rankBadgeText, { color: medal.ink }]}>{item.place}</Text>
        </View>
      </View>

      <View style={styles.placeText}>
        <Text style={[styles.placeKicker, { color: medal.label }]} numberOfLines={1}>
          {trUpper(placeLabel, lang)}
        </Text>
        <Text style={[styles.placeTitle, { color: theme.text.primary }]} numberOfLines={2}>
          {item.c.title}
        </Text>
        <Text style={[styles.placeScore, { color: theme.text.muted }]} numberOfLines={1}>
          {scoreLabel} {item.score.v}/{item.score.t} · %{item.score.pct}
        </Text>
      </View>

      <View style={[styles.votePill, { backgroundColor: alpha(medal.color, 0.16), borderColor: alpha(medal.color, 0.4) }]}>
        <AppIcon family="Ionicons" name="flame" size={11} color={medal.label} />
        <Text style={[styles.votePillText, { color: theme.text.primary }]}>{item.total}</Text>
      </View>
    </View>
  );
});

// ─── 3. Katılım kutucuğu ─────────────────────────────────────────────────────
const StatTile = memo(({ icon, value, label, theme }) => (
  <View style={[styles.statTile, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
    <View style={[styles.statIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
      <AppIcon family="Ionicons" name={icon} size={16} color={theme.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.statValue, { color: theme.text.primary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>{label}</Text>
    </View>
  </View>
));

// ─── 4. Geçmiş kazananlar ────────────────────────────────────────────────────
// Kaynak: tournamentWinners/{YYYY-MM} — Cloud Function (archiveTournamentWinners)
// biten her ay için yazar. Burada bracket YENİDEN HESAPLANMAZ; arşiv kaydı
// olduğu gibi gösterilir, böylece 12+ ay listelemek tek koleksiyon okuması olur.

// Açılan bölümdeki 2./3. sıra mini satırı (arşiv girdisi: id/title/posterPath/totalVotes).
const ArchivePlace = memo(({ place, entry, theme, getTmdbUrl }) => {
  if (!entry) return null;
  const medal = MEDAL[place - 1];
  const uri = entry.posterPath ? getTmdbUrl(entry.posterPath, "poster", 92) : null;
  return (
    <View style={styles.aPlace}>
      <View>
        <Poster uri={uri} width={28} height={42} radius={6} theme={theme} />
        <View style={[styles.aRank, { backgroundColor: medal.color }]}>
          <Text style={[styles.aRankText, { color: medal.ink }]}>{place}</Text>
        </View>
      </View>
      <Text style={[styles.aPlaceTitle, { color: theme.text.primary }]} numberOfLines={1}>{entry.title}</Text>
      <View style={styles.aPlaceVotes}>
        <AppIcon family="Ionicons" name="flame" size={10} color={medal.label} />
        <Text style={[styles.aPlaceVotesText, { color: theme.text.secondary }]}>{entry.totalVotes || 0}</Text>
      </View>
    </View>
  );
});

const WinnerCard = memo(({ w, expanded, onToggle, theme, getTmdbUrl, lang }) => {
  const c = w.champion;
  const uri = c?.posterPath ? getTmdbUrl(c.posterPath, "poster", 185) : null;
  const entry = getScheduleEntry(w.monthIndex);
  const genreText = (lang === "tr" ? w.theme : w.themeEn) || themeLabel(entry, lang);
  const monthName = monthLabel(w.monthIndex, lang);
  const mon = trUpper(monthName.slice(0, 3), lang);
  const monthNo = String((w.monthIndex ?? 0) + 1).padStart(2, "0");
  const finalPct = w.finalTotal > 0 ? Math.round(((w.finalVotes || 0) / w.finalTotal) * 100) : null;
  const handlePress = useCallback(() => onToggle(w.periodId), [onToggle, w.periodId]);
  const hasMore = !!(w.runnerUp || w.third || w.voters != null || w.totalVotes != null);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!hasMore}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${monthName} ${w.year}: ${c?.title || ""}`}
      style={({ pressed }) => [
        styles.wCard,
        {
          backgroundColor: theme.secondary,
          borderColor: expanded ? alpha(GOLD, 0.55) : theme.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.wMain}>
        <View style={[styles.wMonth, { backgroundColor: alpha(GOLD, 0.13), borderColor: alpha(GOLD, 0.3) }]}>
          <Text style={[styles.wMonthNo, { color: theme.text.primary }]}>{monthNo}</Text>
          <Text style={styles.wMonthAbbr}>{mon}</Text>
        </View>

        <View>
          <Poster uri={uri} width={44} height={66} radius={9} theme={theme} />
          <View style={styles.wCrown}>
            <AppIcon family="Ionicons" name="trophy" size={9} color={MEDAL[0].ink} />
          </View>
        </View>

        <View style={styles.wText}>
          <Text style={[styles.wTitle, { color: theme.text.primary }]} numberOfLines={2}>
            {c?.title || "—"}
          </Text>
          <Text style={[styles.wMeta, { color: theme.text.muted }]} numberOfLines={1}>
            {genreText} · {mediaLabel(w.mediaType, lang)}
          </Text>
          <View style={styles.wVotes}>
            <AppIcon family="Ionicons" name="flame" size={10} color={GOLD_INK} />
            <Text style={[styles.wVotesText, { color: theme.text.secondary }]}>
              {formatNumber(c?.totalVotes || 0, lang)} {i18nText("autoI18n.tournament_votes", "oy")}
            </Text>
          </View>
        </View>

        {hasMore ? (
          <AppIcon
            family="Ionicons"
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.text.muted}
          />
        ) : null}
      </View>

      {expanded && hasMore ? (
        <View style={[styles.wDetails, { borderTopColor: theme.border }]}>
          <ArchivePlace place={2} entry={w.runnerUp} theme={theme} getTmdbUrl={getTmdbUrl} />
          <ArchivePlace place={3} entry={w.third} theme={theme} getTmdbUrl={getTmdbUrl} />
          <View style={styles.chipRow}>
            {w.voters != null ? (
              <InfoChip
                icon="people"
                text={`${formatNumber(w.voters, lang)} ${i18nText("autoI18n.tournament_voters", "katılımcı")}`}
                theme={theme}
              />
            ) : null}
            {w.totalVotes != null ? (
              <InfoChip
                icon="stats-chart"
                text={`${formatNumber(w.totalVotes, lang)} ${i18nText("autoI18n.tournament_total_votes", "toplam oy")}`}
                theme={theme}
              />
            ) : null}
            {finalPct != null ? (
              <InfoChip
                icon="ribbon"
                text={`${i18nText("autoI18n.tournament_final_short", "Final")} %${finalPct}`}
                theme={theme}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
});

function PodiumModal({ visible, onClose, periodId, theme, getTmdbUrl, lang = "tr" }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [podium, setPodium] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);
  const [archive, setArchive] = useState(null);   // null = henüz yüklenmedi
  const [openId, setOpenId] = useState(null);     // açık arşiv kartı (tek seferde biri)

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

  const toggleCard = useCallback((id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  const entry = meta ? getScheduleEntry(meta.monthIndex) : null;

  // Üstte zaten podyumu gösterilen ay listede tekrar etmesin; kalanlar YILA göre
  // gruplanır. Arşiv zaten yeniden eskiye sıralı geldiği için Map ekleme sırası
  // (yıllar azalan) korunur.
  const archiveGroups = useMemo(() => {
    const groups = new Map();
    (archive || [])
      .filter((w) => w.periodId !== periodId)
      .forEach((w) => {
        const year = w.year ?? parsePeriodId(w.periodId).year;
        if (!groups.has(year)) groups.set(year, []);
        groups.get(year).push(w);
      });
    return [...groups.entries()].map(([year, rows]) => ({ year, rows }));
  }, [archive, periodId]);
  const pastCount = archiveGroups.reduce((acc, g) => acc + g.rows.length, 0);

  const champion = podium?.items.find((i) => i.place === 1) || null;
  const runnerUp = podium?.items.find((i) => i.place === 2) || null;
  const third = podium?.items.find((i) => i.place === 3) || null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={40}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.primary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom + 18, 26),
          maxHeight: "88%",
        },
      ]}
    >
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />
      <LinearGradient
        colors={[alpha(GOLD, 0.22), "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.topWash}
        pointerEvents="none"
      />

      <View style={styles.headerRow}>
        <LinearGradient
          colors={[GOLD, "#D99A00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIconBadge}
        >
          <AppIcon family="Ionicons" name="trophy" size={19} color={MEDAL[0].ink} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {i18nText("autoI18n.tournament_last_winner", "Geçen Ayın Kazananı")}
          </Text>
          {meta && entry && (
            <Text style={[styles.headerSub, { color: theme.text.muted }]} numberOfLines={1}>
              {monthLabel(meta.monthIndex, lang)} · {themeLabel(entry, lang)} {mediaLabel(meta.mediaType, lang)}
            </Text>
          )}
        </View>
        <GlassCloseButton
          size={32}
          fallbackRadius={11}
          color={theme.text.secondary}
          backgroundColor={theme.between}
          hitSlop={10}
          onPress={onClose}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
        {loading ? (
          <View style={[styles.skeleton, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : !champion ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: alpha(GOLD, 0.12), borderColor: alpha(GOLD, 0.28) }]}>
              <AppIcon family="Ionicons" name="trophy-outline" size={28} color={GOLD} />
            </View>
            <Text style={[styles.emptyText, { color: theme.text.muted }]}>
              {i18nText("autoI18n.tournament_no_prev", "Geçen ayın turnuva sonucu bulunamadı.")}
            </Text>
          </View>
        ) : (
          <>
            <ChampionHero
              item={champion}
              rival={runnerUp}
              meta={meta}
              theme={theme}
              getTmdbUrl={getTmdbUrl}
              lang={lang}
            />

            {runnerUp ? <PlaceRow item={runnerUp} theme={theme} getTmdbUrl={getTmdbUrl} lang={lang} /> : null}
            {third ? <PlaceRow item={third} theme={theme} getTmdbUrl={getTmdbUrl} lang={lang} /> : null}

            <View style={styles.statsRow}>
              <StatTile
                icon="people"
                value={formatNumber(podium.voters, lang)}
                label={i18nText("autoI18n.tournament_voters", "katılımcı")}
                theme={theme}
              />
              <StatTile
                icon="stats-chart"
                value={formatNumber(podium.totalVotes, lang)}
                label={i18nText("autoI18n.tournament_total_votes", "toplam oy")}
                theme={theme}
              />
            </View>
          </>
        )}

        {/* ── Geçmiş kazananlar (yıla göre gruplu) ───────────────────────── */}
        {archive !== null && (
          <View style={styles.archive}>
            <View style={styles.archiveHeader}>
              <AppIcon family="Ionicons" name="albums" size={14} color={theme.text.muted} />
              <Text style={[styles.archiveTitle, { color: theme.text.secondary }]}>
                {i18nText("autoI18n.tournament_past_winners", "Geçmiş Kazananlar")}
              </Text>
              {pastCount > 0 && (
                <Text style={[styles.archiveCount, { color: theme.text.muted, backgroundColor: theme.between }]}>
                  {pastCount}
                </Text>
              )}
            </View>
            {pastCount > 0 && (
              <Text style={[styles.archiveHint, { color: theme.text.muted }]}>
                {i18nText("autoI18n.tournament_archive_hint", "Ayrıntılar için bir aya dokun")}
              </Text>
            )}

            {pastCount === 0 ? (
              <Text style={[styles.archiveEmpty, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.tournament_past_winners_empty",
                  "Henüz arşivlenmiş bir ay yok — turnuvalar tamamlandıkça buraya eklenecek.",
                )}
              </Text>
            ) : (
              archiveGroups.map((g) => (
                <View key={g.year}>
                  <View style={styles.yearRow}>
                    <Text style={[styles.yearText, { color: theme.text.primary }]}>{g.year}</Text>
                    <View style={[styles.yearLine, { backgroundColor: theme.border }]} />
                    <Text style={[styles.yearCount, { color: theme.text.muted }]}>{g.rows.length}</Text>
                  </View>
                  {g.rows.map((w) => (
                    <WinnerCard
                      key={w.periodId}
                      w={w}
                      expanded={openId === w.periodId}
                      onToggle={toggleCard}
                      theme={theme}
                      getTmdbUrl={getTmdbUrl}
                      lang={lang}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    overflow: "hidden",
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  topWash: { position: "absolute", left: 0, right: 0, top: 0, height: 240 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  headerIconBadge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  // ── Şampiyon kartı
  hero: {
    borderRadius: 24, overflow: "hidden", padding: 14, marginBottom: 10,
    backgroundColor: "#120D02",
    borderWidth: 1, borderColor: alpha(GOLD, 0.45),
  },
  heroGlow: {
    position: "absolute", width: 230, height: 230, borderRadius: 115,
    right: -80, top: -110, backgroundColor: alpha(GOLD, 0.16),
  },
  heroWatermark: { position: "absolute", right: -18, bottom: 40, transform: [{ rotate: "-14deg" }] },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  crownChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: GOLD,
  },
  crownChipText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, color: "#3b2a00" },
  glassPill: {
    flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  glassPillText: { flexShrink: 1, fontSize: 11, fontWeight: "800", color: "#fff" },

  heroBody: { flexDirection: "row", gap: 14 },
  heroPosterHalo: {
    alignSelf: "flex-start", borderRadius: 18, padding: 4,
    backgroundColor: alpha(GOLD, 0.2),
    shadowColor: GOLD, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  heroPoster: { borderWidth: 2.5, borderColor: GOLD },
  heroInfo: { flex: 1, justifyContent: "space-between", paddingVertical: 2 },
  heroTitle: { fontSize: 21, lineHeight: 25, fontWeight: "900", letterSpacing: -0.4, color: "#fff" },
  heroVotesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroVotesNum: { fontSize: 30, lineHeight: 34, fontWeight: "900", letterSpacing: -0.6, color: GOLD },
  heroVotesUnit: { fontSize: 13, fontWeight: "800", color: "rgba(255,255,255,0.85)", marginTop: 8 },
  heroVotesSub: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 1 },

  finalPanel: {
    marginTop: 14, padding: 12, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  finalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  finalLabel: { fontSize: 11.5, fontWeight: "800", color: "rgba(255,255,255,0.82)" },
  finalNums: { fontSize: 12.5, fontWeight: "900", color: "rgba(255,255,255,0.7)" },
  finalBar: { flexDirection: "row", height: 9, borderRadius: 5, overflow: "hidden", gap: 2, marginVertical: 8 },
  finalFillWin: { backgroundColor: GOLD, borderRadius: 5 },
  finalFillRival: { backgroundColor: "rgba(255,255,255,0.32)", borderRadius: 5 },
  finalPct: { fontSize: 11, fontWeight: "900" },

  // ── 2. / 3. sıra
  place: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, borderWidth: 1, paddingVertical: 10, paddingRight: 12, paddingLeft: 16,
    marginBottom: 8, overflow: "hidden",
  },
  placeAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  rankBadge: {
    position: "absolute", top: -6, left: -6,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
  },
  rankBadgeText: { fontSize: 11, fontWeight: "900" },
  placeText: { flex: 1 },
  placeKicker: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  placeTitle: { fontSize: 14.5, fontWeight: "800", marginTop: 1, letterSpacing: -0.2 },
  placeScore: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  votePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderWidth: 1,
  },
  votePillText: { fontSize: 12, fontWeight: "900" },

  // ── Katılım kutucukları
  statsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  statTile: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 16, borderWidth: 1,
  },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: "700", marginTop: 1 },

  // ── Arşiv
  archive: { marginTop: 24 },
  archiveHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  archiveTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.1 },
  archiveCount: {
    fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 8, overflow: "hidden",
  },
  archiveHint: { fontSize: 11.5, fontWeight: "600", marginTop: 3, marginBottom: 4 },
  archiveEmpty: { fontSize: 11.5, fontWeight: "600", lineHeight: 16, paddingVertical: 8 },

  yearRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 8 },
  yearText: { fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  yearLine: { flex: 1, height: StyleSheet.hairlineWidth },
  yearCount: { fontSize: 11, fontWeight: "800" },

  wCard: { borderRadius: 18, borderWidth: 1, padding: 10, marginBottom: 8 },
  wMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  wMonth: {
    width: 40, height: 66, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  wMonthNo: { fontSize: 18, lineHeight: 21, fontWeight: "900", letterSpacing: -0.4 },
  wMonthAbbr: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5, color: GOLD_INK, marginTop: 1 },
  wCrown: {
    position: "absolute", top: -5, right: -5,
    width: 18, height: 18, borderRadius: 9, backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center",
  },
  wText: { flex: 1 },
  wTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  wMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  wVotes: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  wVotesText: { fontSize: 11, fontWeight: "800" },

  wDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  aPlace: { flexDirection: "row", alignItems: "center", gap: 10 },
  aRank: {
    position: "absolute", top: -4, left: -4,
    width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  aRankText: { fontSize: 9, fontWeight: "900" },
  aPlaceTitle: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  aPlaceVotes: { flexDirection: "row", alignItems: "center", gap: 3 },
  aPlaceVotesText: { fontSize: 11, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  infoChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
  },
  infoChipText: { fontSize: 11, fontWeight: "700" },

  // ── Yükleniyor / boş
  skeleton: {
    height: 260, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  emptyCard: {
    borderRadius: 22, borderWidth: 1, paddingVertical: 32, paddingHorizontal: 24,
    alignItems: "center", gap: 14,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19 },
});

export default memo(PodiumModal);

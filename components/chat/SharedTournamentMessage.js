// components/chat/SharedTournamentMessage.js
//
// Sohbette/grupta paylaşılan Hub TURNUVA kartının gövdesi (mesaj kind:
// "tournamentShare", bkz. utils/chatShare.js). Hub'daki Aylık Turnuva kartının
// sohbet ölçeğindeki karşılığı: AYIN TÜRÜNÜN gradyanı (genreMeta) üstünde beyaz
// içerik — tür simgesi + ay/tür adı, faz çipi, faza özgü görsel ve gönderim
// anındaki ELEME AĞACI önizlemesi (Hub kartındakiyle aynı bileşen).
//
// Faza özgü görsel:
//   • seçim   → hype'ta öne çıkan ilk üç aday (gönderim anı)
//   • oylama  → ağaç, aktif tur çipiyle
//   • sonuç   → ağacın merkezinde şampiyon; ayrı şampiyon paneli YALNIZ ağaç
//               anlık görüntüsü olmayan eski mesajlarda (aynı afiş iki kez çıkmasın)
//
// Mesaja yalnız `periodId` (+ gönderim anındaki faz, şampiyon, katılımcı sayısı,
// ağaç anlık görüntüsü) gömülür; ay/tür adı ve GÜNCEL faz alıcının cihazında
// alıcının dilinde çözülür (services/tournamentEngine saf takvimi — ağ
// gerekmez). Böylece "oylama sürüyor" diye gönderilen kart, turnuva bitince
// "Sonuçları gör"e döner. Ağaç ise bilerek GÖNDERİLDİĞİ ANI gösterir.
//
// Kişisel durum: kartı GÖRENİN kendi oy dokümanı tek seferlik okunur
// (fetchMyVoteOnce, kısa ömürlü önbellekle) → "Zaten oy verdin", "3/8 maç",
// "Hype'ını zaten verdin"; düğme de buna göre "Oy ver" / "Oylamaya devam et" /
// "Ağacı gör" der. Gönderen de görüntüleyendir: kendi kartında kendi durumunu görür.
//
// Gövde gezinmez: düğme `onOpen` ile bildirir (TournamentScreen). Ekran daima
// GÜNCEL ayı gösterir; eski ay kartında düğme "Sonuçları gör" der.

import React, { memo, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppIcon from "../AppIcon";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { i18nText, i18nCount } from "../../utils/i18nText";
import { decodeBracketSnapshot, tournamentVoteStatus } from "../../utils/tournamentShare";
import {
  getPeriodId,
  getPhaseInfo,
  getScheduleEntry,
  mediaLabel,
  monthLabel,
  now,
  parsePeriodId,
  ROUNDS,
  roundLabel,
  themeLabel,
} from "../../services/tournamentEngine";
import { fetchMyVoteOnce } from "../../services/tournamentService";
import { PHASE_META, phaseLabel } from "../tournament/phaseMeta";
import { genreMetaFor } from "../tournament/genreMeta";
import TournamentTreePreview from "../tournament/TournamentTreePreview";

const GOLD = "#F5C518";
const GOLD_SOFT = "#FDE68A";
const DONE_GREEN = "#4ADE80";
const CARD_W = 268;
const CHAMP_W = 64;
const CHAMP_H = 96;
const TOP_W = 54;
const TOP_H = 81;
const GLASS = "rgba(255,255,255,0.16)";
const GLASS_BORDER = "rgba(255,255,255,0.22)";
const PANEL = "rgba(5,10,24,0.34)";

/**
 * Kartın GÜNCEL fazı: bu ayın turnuvasıysa takvimden canlı, geçmiş aysa bitmiş
 * ("results"), gelecek aysa gönderimdeki faz.
 */
export function livePhase(periodId, sentPhase, ms = now()) {
  const current = getPeriodId(ms);
  if (periodId === current) return getPhaseInfo(periodId, ms).phase;
  return periodId < current ? "results" : sentPhase;
}

/** Bu ayın turnuvasıysa canlı aktif tur; değilse -1 (kişisel oy durumu sorulmaz). */
const liveActiveRound = (periodId, ms = now()) =>
  periodId === getPeriodId(ms) ? getPhaseInfo(periodId, ms).activeRound : -1;

// ─── Görüntüleyenin oy dokümanı ───────────────────────────────────────────────
// Aynı turnuva kartı bir sohbette defalarca geçebilir; aynı (ay, kişi) için tek
// okuma paylaşılır. Kısa ömürlü: turnuva ekranında oy verip sohbete dönünce kart
// yeniden takıldığında taze durumu okur.
const VOTE_TTL_MS = 20 * 1000;
const voteCache = new Map();

/** Testler için: önbelleği boşaltır. */
export const resetTournamentVoteCache = () => voteCache.clear();

function useMyTournamentVote(periodId, uid, enabled) {
  const [state, setState] = useState({ loaded: false, vote: null });
  useEffect(() => {
    if (!enabled || !uid) {
      setState({ loaded: false, vote: null });
      return undefined;
    }
    let active = true;
    const key = `${periodId}:${uid}`;
    let hit = voteCache.get(key);
    if (!hit || Date.now() - hit.at > VOTE_TTL_MS) {
      hit = { at: Date.now(), promise: Promise.resolve(fetchMyVoteOnce(periodId, uid)) };
      voteCache.set(key, hit);
    }
    hit.promise
      .then((vote) => {
        if (active) setState({ loaded: true, vote: vote || null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [periodId, uid, enabled]);
  return state;
}

function statusText(phase) {
  if (phase === "voting") return i18nText("autoI18n.paylas_turnuva_oylama", "Oylama sürüyor");
  if (phase === "results") return i18nText("autoI18n.paylas_turnuva_sonuclar_acik", "Sonuçlar açıklandı");
  if (phase === "upcoming") return i18nText("autoI18n.paylas_turnuva_yakinda", "Yakında başlıyor");
  return i18nText("autoI18n.paylas_turnuva_secim", "Aday belirleme sürüyor");
}

/**
 * Oy durumu → { icon, color, text, sub } satırı ve düğme etiketi/ikonu.
 * Satır yalnız kişisel bir şey söyleyebildiğimizde çizilir (row null değilse).
 */
function voteCopy(status, lang) {
  const round = status.roundIndex != null ? roundLabel(ROUNDS[status.roundIndex], lang) : "";
  switch (status.kind) {
    case "hyped":
      return {
        row: {
          icon: "checkmark-circle",
          color: DONE_GREEN,
          text: i18nText("autoI18n.paylas_turnuva_hype_verdin", "Hype'ını zaten verdin"),
        },
        action: i18nText("autoI18n.paylas_turnuva_siralama", "Sıralamayı gör"),
        actionIcon: "podium-outline",
      };
    case "hypeOpen":
      return {
        row: {
          icon: "flame",
          color: GOLD_SOFT,
          text: i18nText("autoI18n.paylas_turnuva_hype_yok", "Henüz hype vermedin — İlk 32'yi sen seç"),
        },
        action: i18nText("autoI18n.paylas_turnuva_hype_ver", "Hype ver"),
        actionIcon: "flame-outline",
      };
    case "roundDone":
      return {
        row: {
          icon: "checkmark-circle",
          color: DONE_GREEN,
          text: i18nText("autoI18n.paylas_turnuva_oy_verdin", "Zaten oy verdin"),
          sub: `${round} · ${status.done}/${status.total}`,
        },
        action: i18nText("autoI18n.paylas_turnuva_agaci_gor", "Ağacı gör"),
        actionIcon: "git-network-outline",
      };
    case "roundPartial":
      return {
        row: {
          icon: "time",
          color: GOLD_SOFT,
          text: i18nText("autoI18n.paylas_turnuva_oy_kismi", "{{done}}/{{total}} maça oy verdin", {
            done: status.done,
            total: status.total,
          }),
          sub: round,
        },
        action: i18nText("autoI18n.paylas_turnuva_oy_devam", "Oylamaya devam et"),
        actionIcon: "flame-outline",
      };
    case "roundOpen":
      return {
        row: {
          icon: "ellipse-outline",
          color: "rgba(255,255,255,0.85)",
          text: i18nText("autoI18n.paylas_turnuva_oy_yok", "Bu turda henüz oy vermedin"),
          sub: round,
        },
        action: i18nText("autoI18n.paylas_turnuva_oy_ver", "Oy ver"),
        actionIcon: "flame-outline",
      };
    case "results":
      return {
        row: null,
        action: i18nText("autoI18n.paylas_turnuva_sonuclar", "Sonuçları gör"),
        actionIcon: "podium-outline",
      };
    default:
      return {
        row: null,
        action: i18nText("autoI18n.paylas_turnuva_katil", "Turnuvaya katıl"),
        actionIcon: "flame-outline",
      };
  }
}

// Seçim fazı: hype'ta öne çıkan ilk üç aday (gönderim anı).
function TopNominees({ top, getTmdbUrl }) {
  return (
    <View style={[styles.panel, styles.topPanel]}>
      <View style={styles.panelLabelRow}>
        <Ionicons name="flame" size={11} color={GOLD_SOFT} />
        <Text allowFontScaling={false} style={styles.panelLabel} numberOfLines={1}>
          {i18nText("autoI18n.paylas_turnuva_hype_liderleri", "Hype liderleri")}
        </Text>
      </View>
      <View style={styles.topRow}>
        {top.map((c, i) => (
          <View key={`${c.id}`} style={styles.topItem}>
            <View style={[styles.topPoster, i === 0 && styles.topPosterLead]}>
              {c.poster_path ? (
                <Image
                  source={{ uri: getTmdbUrl(c.poster_path, "poster", 200) }}
                  style={styles.fill}
                  cachePolicy="memory-disk"
                  transition={120}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.fill, styles.center]}>
                  <Ionicons name="film-outline" size={18} color="rgba(255,255,255,0.6)" />
                </View>
              )}
              <LinearGradient
                colors={["rgba(4,7,18,0)", "rgba(4,7,18,0.85)"]}
                style={styles.topScrim}
                pointerEvents="none"
              >
                <Text allowFontScaling={false} style={styles.topSeed}>
                  #{i + 1}
                </Text>
              </LinearGradient>
            </View>
            <Text allowFontScaling={false} style={styles.topTitle} numberOfLines={1}>
              {c.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SharedTournamentMessage({ share, getTmdbUrl, onOpen, cardWidth = CARD_W }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth() || {};

  const { year, monthIndex } = useMemo(() => parsePeriodId(share.periodId), [share.periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);
  const genre = genreMetaFor(entry);
  const phase = useMemo(() => livePhase(share.periodId, share.phase), [share.periodId, share.phase]);
  const activeRound = useMemo(() => liveActiveRound(share.periodId), [share.periodId]);
  const meta = PHASE_META[phase] || PHASE_META.selection;

  // Kişisel durum yalnız SÜREN fazda anlamlı (seçim / oylama).
  const personal = phase === "selection" || phase === "voting";
  const { loaded, vote } = useMyTournamentVote(share.periodId, user?.uid, personal);
  const status = tournamentVoteStatus({ phase, activeRound, vote, loaded });
  const copy = voteCopy(status, language);

  const bracket = useMemo(() => decodeBracketSnapshot(share.bracket), [share.bracket]);
  const myPicks = useMemo(() => vote?.picks || null, [vote]);

  const title = `${themeLabel(entry, language)} ${mediaLabel(entry.mediaType, language)}`;
  const period = `${monthLabel(monthIndex, language)} ${year}`;
  const canOpen = typeof onOpen === "function";
  const finished = phase === "results";
  const champion = share.champion;
  const top = phase === "selection" ? share.bracket?.top : null;

  return (
    <LinearGradient
      colors={genre.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* Filigran: ayın tür simgesi, sağ üstte soluk ve büyük. */}
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon
          family={genre.icon?.family || "Ionicons"}
          name={genre.icon?.name || "trophy"}
          size={92}
          color="rgba(255,255,255,0.12)"
        />
      </View>

      <View style={styles.header}>
        <View style={styles.tile}>
          <AppIcon
            family={genre.icon?.family || "Ionicons"}
            name={genre.icon?.name || "trophy"}
            size={18}
            color="#fff"
          />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={styles.kicker} numberOfLines={1}>
            {i18nText("autoI18n.tournament_monthly", "AYLIK TURNUVA")}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.phasePill}>
          <Ionicons name={meta.icon} size={11} color="#fff" />
          <Text allowFontScaling={false} style={styles.phaseText} numberOfLines={1}>
            {phaseLabel(meta, language)}
          </Text>
        </View>
        <Text allowFontScaling={false} style={styles.period} numberOfLines={1}>
          {period}
        </Text>
      </View>
      <Text allowFontScaling={false} style={styles.statusText} numberOfLines={1}>
        {statusText(phase)}
      </Text>

      {champion && finished && !bracket ? (
        <View style={[styles.panel, styles.champion]}>
          <View style={styles.champPoster}>
            {champion.poster_path ? (
              <Image
                source={{ uri: getTmdbUrl(champion.poster_path, "poster", 200) }}
                style={styles.fill}
                cachePolicy="memory-disk"
                transition={120}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.fill, styles.center]}>
                <Ionicons name="film-outline" size={22} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
          <View style={styles.champCopy}>
            <View style={styles.champLabelRow}>
              <Ionicons name="trophy" size={12} color={GOLD_SOFT} />
              <Text allowFontScaling={false} style={styles.champLabel} numberOfLines={1}>
                {i18nText("autoI18n.paylas_turnuva_sampiyon", "Şampiyon")}
              </Text>
            </View>
            <Text style={styles.champTitle} numberOfLines={3}>
              {champion.title}
            </Text>
          </View>
        </View>
      ) : top?.length ? (
        <TopNominees top={top} getTmdbUrl={getTmdbUrl} />
      ) : null}

      {bracket ? (
        <TournamentTreePreview
          bracket={bracket}
          getTmdbUrl={getTmdbUrl}
          accent={theme.accent}
          lang={language}
          phase={share.phase}
          activeRound={share.bracket.round}
          myPicks={myPicks}
          animated={false}
          style={styles.tree}
        />
      ) : null}

      {copy.row ? (
        <View style={[styles.voteRow, status.kind === "roundDone" || status.kind === "hyped" ? styles.voteRowDone : null]}>
          <Ionicons name={copy.row.icon} size={16} color={copy.row.color} />
          <View style={styles.voteCopy}>
            <Text allowFontScaling={false} style={styles.voteText} numberOfLines={2}>
              {copy.row.text}
            </Text>
            {copy.row.sub ? (
              <Text allowFontScaling={false} style={styles.voteSub} numberOfLines={1}>
                {copy.row.sub}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {share.voters ? (
        <View style={styles.votersRow}>
          <Ionicons name="people" size={11} color="rgba(255,255,255,0.78)" />
          <Text allowFontScaling={false} style={styles.voters}>
            {i18nCount("autoI18n.paylas_turnuva_katilimci", "{{n}} katılımcı", share.voters)}
          </Text>
        </View>
      ) : null}

      {canOpen && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpen}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={copy.action}
        >
          <Ionicons name={copy.actionIcon} size={15} color={genre.ink} />
          <Text allowFontScaling={false} style={[styles.actionText, { color: genre.ink }]} numberOfLines={1}>
            {copy.action}
          </Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

export default memo(SharedTournamentMessage);

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    width: CARD_W,
    marginBottom: 2,
    padding: 12,
    borderRadius: 18,
    overflow: "hidden",
  },
  watermark: { position: "absolute", top: -14, right: -14, transform: [{ rotate: "-12deg" }] },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6, color: "rgba(255,255,255,0.82)" },
  title: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 1,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexShrink: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  phaseText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, flexShrink: 1, color: "#fff" },
  period: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  statusText: { fontSize: 12, fontWeight: "800", marginTop: 6, color: "rgba(255,255,255,0.92)" },

  panel: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: PANEL,
  },
  panelLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  panelLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.82)",
  },

  champion: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  champPoster: {
    width: CHAMP_W,
    height: CHAMP_H,
    borderRadius: 9,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  champCopy: { flex: 1, minWidth: 0 },
  champLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  champLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: GOLD_SOFT,
  },
  champTitle: { fontSize: 15, fontWeight: "800", lineHeight: 19, marginTop: 4, color: "#fff" },

  topPanel: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 9 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  topItem: { width: TOP_W + 12, alignItems: "center" },
  topPoster: {
    width: TOP_W,
    height: TOP_H,
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  topPosterLead: { borderWidth: 2, borderColor: GOLD },
  topScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    justifyContent: "flex-end",
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  topSeed: { color: "#fff", fontSize: 10, fontWeight: "900" },
  topTitle: { fontSize: 10, fontWeight: "700", marginTop: 4, color: "rgba(255,255,255,0.9)", maxWidth: TOP_W + 12 },

  tree: { marginTop: 10 },

  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
  },
  voteRowDone: { borderColor: "rgba(74,222,128,0.55)", backgroundColor: "rgba(22,101,52,0.32)" },
  voteCopy: { flex: 1, minWidth: 0 },
  voteText: { fontSize: 12.5, fontWeight: "800", lineHeight: 16, color: "#fff" },
  voteSub: { fontSize: 10.5, fontWeight: "700", marginTop: 1, color: "rgba(255,255,255,0.75)" },

  votersRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  voters: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.82)" },

  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
});

// components/chat/SharedTournamentMessage.js
//
// Sohbette/grupta paylaşılan Hub TURNUVA kartının gövdesi (mesaj kind:
// "tournamentShare", bkz. utils/chatShare.js). Hub'daki Aylık Turnuva kartının
// sohbet ölçeğindeki karşılığı: faz renkli ikon karosu, ay + tür adı, faz durumu,
// (bittiyse) şampiyon posteri ve "Turnuvaya katıl / Sonuçları gör" düğmesi.
//
// Mesaja yalnız `periodId` (+ gönderim anındaki faz, şampiyon, katılımcı sayısı)
// gömülür; ay/tür adı ve GÜNCEL faz alıcının cihazında alıcının dilinde çözülür
// (services/tournamentEngine saf takvimi — ağ gerekmez). Böylece "oylama
// sürüyor" diye gönderilen kart, turnuva bitince "Sonuçları gör"e döner.
//
// Gövde gezinmez: düğme `onOpen` ile bildirir (TournamentScreen). Ekran daima
// GÜNCEL ayı gösterir; eski ay kartında düğme "Sonuçları gör" der.

import React, { memo, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import { readableOn } from "../../utils/colorUtils";
import {
  getPeriodId,
  getPhaseInfo,
  getScheduleEntry,
  mediaLabel,
  monthLabel,
  now,
  parsePeriodId,
  themeLabel,
} from "../../services/tournamentEngine";
import { PHASE_META, phaseLabel } from "../tournament/phaseMeta";
import { PosterEdge, sharePalette } from "./shareKit";

const GOLD = "#F5C518";
const CHAMP_W = 64;
const CHAMP_H = 96;

/**
 * Kartın GÜNCEL fazı: bu ayın turnuvasıysa takvimden canlı, geçmiş aysa bitmiş
 * ("results"), gelecek aysa gönderimdeki faz.
 */
export function livePhase(periodId, sentPhase, ms = now()) {
  const current = getPeriodId(ms);
  if (periodId === current) return getPhaseInfo(periodId, ms).phase;
  return periodId < current ? "results" : sentPhase;
}

function statusText(phase) {
  if (phase === "voting") return i18nText("autoI18n.paylas_turnuva_oylama", "Oylama sürüyor");
  if (phase === "results") return i18nText("autoI18n.paylas_turnuva_sonuclar_acik", "Sonuçlar açıklandı");
  if (phase === "upcoming") return i18nText("autoI18n.paylas_turnuva_yakinda", "Yakında başlıyor");
  return i18nText("autoI18n.paylas_turnuva_secim", "Aday belirleme sürüyor");
}

function SharedTournamentMessage({ share, isOutgoing = false, getTmdbUrl, onOpen }) {
  const { theme } = useTheme();
  const { language } = useLanguage();

  const { year, monthIndex } = useMemo(() => parsePeriodId(share.periodId), [share.periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);
  const phase = useMemo(() => livePhase(share.periodId, share.phase), [share.periodId, share.phase]);
  const meta = PHASE_META[phase] || PHASE_META.selection;
  // Vurgu: gelen balonda zemine göre OKUNUR tona çekilir (açık temada altın metin
  // okunmazdı); düğme zemini fazın KOYU gradyan ucu — beyaz yazı altın üstünde
  // (#F5C518) okunmuyor, koyu amber üstünde okunuyor (Hub kartıyla aynı renk).
  const accent = isOutgoing ? meta.color : readableOn(meta.color, theme.secondary);
  const palette = useMemo(() => {
    const base = sharePalette({ theme, isOutgoing, accent });
    return isOutgoing ? base : { ...base, buttonBg: meta.gradient?.[0] || base.buttonBg };
  }, [theme, isOutgoing, accent, meta]);

  const title = `${themeLabel(entry, language)} ${mediaLabel(entry.mediaType, language)}`;
  const period = `${monthLabel(monthIndex, language)} ${year}`;
  const canOpen = typeof onOpen === "function";
  const finished = phase === "results";
  const champion = share.champion;
  const actionLabel = finished
    ? i18nText("autoI18n.paylas_turnuva_sonuclar", "Sonuçları gör")
    : i18nText("autoI18n.paylas_turnuva_katil", "Turnuvaya katıl");
  const ink = isOutgoing ? palette.primary : accent;
  // Şampiyon altını: açık temada okunur tona çekilir (sabit #F5C518 beyaz zeminde kaybolur).
  const gold = isOutgoing ? GOLD : readableOn(GOLD, theme.secondary);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="trophy" size={17} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.kicker, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            {i18nText("autoI18n.tournament_monthly", "AYLIK TURNUVA")}
          </Text>
          <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.phasePill, { backgroundColor: palette.tile }]}>
          <Ionicons name={meta.icon} size={11} color={palette.tileInk} />
          <Text
            allowFontScaling={false}
            style={[styles.phaseText, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            {phaseLabel(meta, language)}
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.period, { color: palette.muted }]}
          numberOfLines={1}
        >
          {period}
        </Text>
      </View>

      {champion && finished ? (
        <View style={[styles.champion, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <View style={[styles.champPoster, { backgroundColor: palette.posterBg }]}>
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
                <Ionicons name="film-outline" size={22} color={palette.muted} />
              </View>
            )}
            <PosterEdge radius={9} color={gold} width={1.5} />
          </View>
          <View style={styles.champCopy}>
            <View style={styles.champLabelRow}>
              <Ionicons name="trophy" size={12} color={gold} />
              <Text allowFontScaling={false} style={[styles.champLabel, { color: gold }]} numberOfLines={1}>
                {i18nText("autoI18n.paylas_turnuva_sampiyon", "Şampiyon")}
              </Text>
            </View>
            <Text style={[styles.champTitle, { color: palette.primary }]} numberOfLines={3}>
              {champion.title}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.note, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <Ionicons name={meta.icon} size={16} color={ink} />
          <Text style={[styles.noteText, { color: palette.primary }]} numberOfLines={2}>
            {statusText(phase)}
          </Text>
        </View>
      )}

      {share.voters ? (
        <Text allowFontScaling={false} style={[styles.voters, { color: palette.muted }]}>
          {i18nText("autoI18n.paylas_turnuva_katilimci", "{{n}} katılımcı", { n: share.voters })}
        </Text>
      ) : null}

      {canOpen && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpen}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { backgroundColor: palette.buttonBg }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Ionicons name={finished ? "podium-outline" : "flame-outline"} size={15} color={palette.buttonInk} />
          <Text
            allowFontScaling={false}
            style={[styles.actionText, { color: palette.buttonInk }]}
            numberOfLines={1}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default memo(SharedTournamentMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 250, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6 },
  title: { fontSize: 16, fontWeight: "900", lineHeight: 20, marginTop: 1 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexShrink: 1,
  },
  phaseText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, flexShrink: 1 },
  period: { fontSize: 11, fontWeight: "700" },

  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 17 },

  champion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  champPoster: { width: CHAMP_W, height: CHAMP_H, borderRadius: 9, overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  champCopy: { flex: 1, minWidth: 0 },
  champLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  champLabel: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  champTitle: { fontSize: 15, fontWeight: "800", lineHeight: 19, marginTop: 4 },

  voters: { fontSize: 11, fontWeight: "700", marginTop: 8 },

  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
});

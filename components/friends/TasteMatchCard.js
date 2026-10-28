// components/friends/TasteMatchCard.js
//
// Arkadaş profilindeki "Zevk uyumu" kartı + "Birlikte izleyelim" bölümü. Hesap utils/tasteMatch.js'te (saf);
// burada yalnız sunum. Gizlilik kararı çağıranda: görünmeyen liste hesaba `null` gider, kart onu "veri yok" diye
// anlatır, sıfır sanmaz.
//
// DÜZEN (az metin, çok yapı): halka + kademe + "!" (nasıl hesaplanır) → Film / Dizi kutuları → sayı kutuları
// (ortak izlenen · favori · puan uyumu) + ortak tür çipleri → içgörü satırları → ortak izlenen afişleri →
// sohbete gönder. Açıklayıcı uzun cümleler "!" sayfasına (TasteMatchInfoSheet) taşındı.
//
// DÜRÜST ÇIKTI: yeterli veri yoksa yüzde ÇİZİLMEZ (nedeni yazılır). Arkadaş yalnız film YA DA yalnız dizi
// paylaşıyorsa diğer kutu "Paylaşılmıyor" diye sönük gösterilir (puan uydurulmaz). Davet düğmesi yalnız arkadaşa
// ve adayı olan kullanıcıya görünür.
import React, { memo, useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import usePosterUri from "../../hooks/usePosterUri";
import { alpha } from "../../theme/colors";
import { getTasteMatchCopy } from "../../utils/tasteMatchCopy";
import { TASTE_HEAT_THRESHOLDS, tasteMatchHeat } from "../../utils/tasteMatchVisuals";
import GlassBox from "../common/GlassBox";
import TasteMatchInfoSheet from "./TasteMatchInfoSheet";

const THUMBS_SHOWN = 8;
const RING = 58;
const RING_STROKE = 5.5;
const EMPTY = [];

/** Yüzde halkası: iz + vurgu yayı. Merkez metni çağıran verir. */
function Ring({ ratio, accent, track, children }) {
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const o = Math.max(0, Math.min(1, Number(ratio) || 0));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
        {o > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - o)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={styles.ringCenter}>
        {children}
      </View>
    </View>
  );
}

function Bar({ value, color, track }) {
  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      <View style={[styles.barFill, { backgroundColor: color, width: `${Math.max(4, Math.min(100, value))}%` }]} />
    </View>
  );
}

/** Ana uyum puanı: 60/70/80/90 eşiklerinde rengi ve alev yoğunluğu artan çubuk. */
function HeatBar({ score, heat, track }) {
  return (
    <View
      accessible
      accessibilityLabel={`heat-${heat.level}`}
      style={styles.heatBarWrap}
    >
      <View style={[styles.heatTrack, { backgroundColor: track }]}>
        <LinearGradient
          colors={heat.colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.heatFill, { width: `${Math.max(3, heat.score)}%` }]}
        />
        {TASTE_HEAT_THRESHOLDS.map((threshold) => (
          <View
            key={threshold}
            pointerEvents="none"
            style={[styles.heatMark, { left: `${threshold}%`, backgroundColor: alpha("#FFFFFF", score >= threshold ? 0.9 : 0.36) }]}
          />
        ))}
      </View>
      {heat.level > 0 ? (
        <View style={[styles.heatFlames, { backgroundColor: alpha(heat.accent, 0.16) }]}>
          {Array.from({ length: heat.level }, (_, index) => (
            <Ionicons key={index} name={index === heat.level - 1 ? "flame" : "flame-outline"} size={11} color={heat.accent} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Film / Dizi kompakt yatay kartı: başlık + yüzde aynı satırda, altında ince çubuk ve ortak sayısı. */
function TypeTile({ icon, label, info, color, copy, theme, track, primary, muted, pct }) {
  const tone = color || theme.accent;
  if (!info.shared) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${copy.types.notShared}`}
        style={[styles.tile, styles.tileOff, { borderColor: theme.border, backgroundColor: alpha(muted, 0.05) }]}
      >
        <View style={styles.tileTopRow}>
          <View style={styles.tileHead}>
            <Ionicons name={icon} size={13} color={muted} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileLabel, { color: muted }]}>
              {label}
            </Text>
          </View>
          <Ionicons name="lock-closed-outline" size={12} color={muted} />
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileCaption, { color: muted }]}>
          {copy.types.notShared}
        </Text>
      </View>
    );
  }
  const scored = info.score !== null;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${scored ? pct(info.score) : copy.types.notEnough}`}
      style={[styles.tile, { borderColor: alpha(tone, 0.28), backgroundColor: alpha(tone, 0.07) }]}
    >
      <View style={styles.tileTopRow}>
        <View style={styles.tileHead}>
          <Ionicons name={icon} size={13} color={tone} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileLabel, { color: primary }]}>
            {label}
          </Text>
        </View>
        <Text allowFontScaling={false} style={[styles.tileValue, { color: scored ? tone : muted }]}>
          {scored ? pct(info.score) : "–"}
        </Text>
      </View>
      {scored ? <Bar value={info.score} color={tone} track={track} /> : null}
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileCaption, { color: muted }]}>
        {scored ? copy.types.common(info.overlap) : copy.types.notEnough}
      </Text>
    </View>
  );
}

/** Sayı hücresi: tek şerit içinde ikonlu değer + kısa etiket + ince çubuk. */
function Stat({ icon, value, label, bar, color, theme, track, primary, muted }) {
  const tone = color || theme.accent;
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <View style={styles.statTop}>
        <Ionicons name={icon} size={13} color={tone} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.statValue, { color: primary }]}>
          {value}
        </Text>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { color: muted }]}>
        {label}
      </Text>
      {typeof bar === "number" ? <Bar value={bar} color={tone} track={track} /> : null}
    </View>
  );
}

function InsightRow({ icon, text, color, muted }) {
  return (
    <View style={styles.insightRow}>
      <Ionicons name={icon} size={13} color={color} />
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.insightText, { color: muted }]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../../utils/tasteMatch").computeTasteMatch>} props.match
 * @param {ReturnType<typeof import("../../utils/tasteMatch").findTogetherCandidates>} props.together
 * @param {string} props.friendName
 * @param {boolean} props.friendListHidden arkadaşın izleme listesi görünmüyor
 * @param {boolean} props.noWatchedVisible arkadaşın izlenen listeleri görünmüyor
 * @param {boolean} props.canInvite arkadaş mı?
 * @param {boolean} props.inviteBusy
 * @param {() => void} props.onInvite
 * @param {() => void} [props.onShareMatch] uyumu arkadaşın sohbetine kart olarak gönderir (yalnız puan varsa)
 */
function TasteMatchCard({
  match,
  together,
  friendName,
  friendListHidden = false,
  noWatchedVisible = false,
  canInvite = false,
  inviteBusy = false,
  onInvite,
  onShareMatch,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const posterUri = usePosterUri();
  const copy = getTasteMatchCopy(language);
  const [infoOpen, setInfoOpen] = useState(false);
  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  const muted = theme.text?.secondary ?? "#aaa";
  const primary = theme.text?.primary ?? "#fff";
  const track = alpha(muted, 0.22);
  const blue = theme.colors?.blue ?? "#64b4ff";
  const green = theme.colors?.green ?? "#29b864";
  const orange = theme.colors?.orange ?? "#ff9650";
  const rose = "#E11D48";
  const pct = (n) => copy.percent(n);
  const heat = tasteMatchHeat(match.score, theme.accent);

  const percent = match.ratings.agreement === null ? null : Math.round(match.ratings.agreement * 100);
  const valueOf = (id) => match.breakdown?.find((part) => part.id === id)?.value;
  const highlights = match.highlights ?? EMPTY;
  const loved = match.loved ?? EMPTY;
  const split = match.split ?? null;
  const lean = match.genres.lean ?? null;
  const leanText =
    lean?.mine && lean?.theirs
      ? copy.insights.lean(lean.mine, lean.theirs, friendName)
      : lean?.mine
        ? copy.insights.leanMine(lean.mine)
        : lean?.theirs
          ? copy.insights.leanTheirs(lean.theirs, friendName)
          : null;
  const hasInsights = loved.length > 0 || !!split || !!leanText;
  const hasData = match.state !== "no-data";
  const scope = match.scope ?? "both";
  const showTypes = hasData && !!match.byType && scope !== "none";
  const favoritesShown = (match.favorites && match.favorites.length > 0) || valueOf("favorites") !== undefined;

  const candidates = together.candidates;
  const { both, mine, theirs } = together.counts;
  const introText = candidates.length === 0 ? copy.together.none : both > 0 ? copy.together.both(both) : copy.together.mixed(mine + theirs);

  // Başlık altı tek satır: tek kategori karşılaştırıldıysa onu, yoksa "yaklaşık" notunu söyler.
  const subText =
    hasData && (scope === "movies" || scope === "shows")
      ? copy.scopeOnly[scope]
      : match.state === "limited"
        ? copy.limited
        : null;

  return (
    <GlassBox role="card" style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {/* ── Başlık: kompakt halka · kademe · hızlı eylemler (sohbete gönder + !) ── */}
      <View
        style={[
          styles.head,
          heat.level > 0 && styles.hotHead,
          heat.level > 0 && { backgroundColor: alpha(heat.accent, heat.level >= 3 ? 0.12 : 0.07), borderColor: alpha(heat.accent, 0.28) },
        ]}
      >
        {match.score !== null ? (
          <View accessible accessibilityLabel={`${copy.title}: ${pct(match.score)}`}>
            <Ring ratio={match.score / 100} accent={heat.accent} track={track}>
              <Text allowFontScaling={false} style={[styles.ringText, { color: heat.level > 0 ? heat.accent : primary }]}>
                {pct(match.score)}
              </Text>
            </Ring>
          </View>
        ) : (
          <Ring ratio={0} accent={theme.accent} track={track}>
            <Ionicons name="help" size={20} color={muted} />
          </Ring>
        )}
        <View style={styles.headText}>
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.title, { color: primary }]}>
            {match.tier ? copy.tiers[match.tier] : copy.title}
          </Text>
          {subText ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.sub, { color: muted }]}>
              {subText}
            </Text>
          ) : null}
          {match.state === "no-data" ? (
            <Text style={[styles.sub, { color: muted }]}>
              {noWatchedVisible ? copy.noData.hidden(friendName) : copy.noData.notEnough}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={openInfo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy.info.open}
          style={({ pressed }) => [styles.infoButton, { backgroundColor: alpha(muted, 0.14) }, pressed && styles.pressed]}
        >
          <Ionicons name="information" size={16} color={muted} />
        </Pressable>
      </View>

      {match.score !== null ? <HeatBar score={match.score} heat={heat} track={track} /> : null}

      {/* ── Film / Dizi ayrı uyum (kompakt yatay ikili) ── */}
      {showTypes ? (
        <View style={styles.tiles}>
          <TypeTile icon="film-outline" label={copy.types.movie} info={match.byType.movie} color={blue} {...{ copy, theme, track, primary, muted, pct }} />
          <TypeTile icon="tv-outline" label={copy.types.tv} info={match.byType.tv} color={green} {...{ copy, theme, track, primary, muted, pct }} />
        </View>
      ) : null}

      {/* ── Sayı şeridi + ortak türler ── */}
      {hasData ? (
        <>
          <View style={[styles.statsStrip, { backgroundColor: theme.between, borderColor: theme.border }]}>
            <Stat
              icon="checkmark-done-outline"
              value={String(match.watched.overlap.length)}
              label={copy.parts.overlap}
              bar={valueOf("overlap")}
              color={theme.accent}
              {...{ theme, track, primary, muted }}
            />
            {favoritesShown ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: alpha(theme.border, 0.9) }]} />
                <Stat
                  icon="heart-outline"
                  value={String(match.favorites?.length ?? 0)}
                  label={copy.parts.favorites}
                  bar={valueOf("favorites")}
                  color={rose}
                  {...{ theme, track, primary, muted }}
                />
              </>
            ) : null}
            {percent !== null ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: alpha(theme.border, 0.9) }]} />
                <Stat
                  icon="star-half-outline"
                  value={pct(percent)}
                  label={copy.parts.ratings}
                  bar={valueOf("ratings")}
                  color={orange}
                  {...{ theme, track, primary, muted }}
                />
              </>
            ) : null}
          </View>
          {match.genres.shared.length > 0 ? (
            <View style={styles.chips} accessible accessibilityLabel={`${copy.parts.genres}: ${match.genres.shared.join(", ")}`}>
              <Ionicons name="pricetags-outline" size={13} color={muted} />
              {match.genres.shared.map((genre) => (
                <View key={genre} style={[styles.chip, { backgroundColor: alpha(theme.accent, 0.13), borderColor: alpha(theme.accent, 0.25) }]}>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color: theme.accent }]}>
                    {genre}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {/* ── İçgörüler ── */}
      {hasData && hasInsights ? (
        <View style={[styles.insights, { backgroundColor: alpha(theme.accent, 0.08), borderColor: alpha(theme.accent, 0.2) }]}>
          {loved.length > 0 ? (
            <InsightRow icon="sparkles-outline" color={theme.accent} muted={muted} text={copy.insights.loved(loved.map((entry) => entry.name).join(", "))} />
          ) : null}
          {split ? (
            <InsightRow
              icon="git-compare-outline"
              color={orange}
              muted={muted}
              text={copy.insights.split(split.name, split.mine, split.theirs, friendName)}
            />
          ) : null}
          {leanText ? <InsightRow icon="compass-outline" color={blue} muted={muted} text={leanText} /> : null}
        </View>
      ) : null}

      {/* ── Ortak izlenenler (kompakt afiş şeridi + iki taraf puanı) ── */}
      {hasData && highlights.length > 0 ? (
        <View style={styles.railSection}>
          <Text allowFontScaling={false} style={[styles.sectionTitle, { color: muted }]}>
            {copy.sharedTitle}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {highlights.map((item) => {
              const bothRated = item.mine !== null && item.theirs !== null;
              return (
                <View
                  key={item.key}
                  accessible
                  accessibilityLabel={bothRated ? `${item.name}. ${copy.ratingPair(item.mine, item.theirs)}` : item.name}
                  style={[styles.thumb, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Image source={{ uri: posterUri(item.type, item.id, item.imagePath) }} style={styles.thumbImage} contentFit="cover" />
                  {bothRated ? (
                    <View style={[styles.ratingChip, { backgroundColor: alpha("#000000", 0.72) }]}>
                      <Text allowFontScaling={false} style={styles.ratingChipText}>
                        {`${item.mine} · ${item.theirs}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Birlikte izleyelim ── */}
      <View style={[styles.divider, { backgroundColor: alpha(theme.border, 0.9) }]} />
      <View style={styles.togetherSection}>
        <View style={styles.togetherHeader}>
          <View style={[styles.togetherBadge, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            <Ionicons name="film-outline" size={13} color={theme.accent} />
          </View>
          <View style={styles.togetherHeaderCopy}>
            <Text allowFontScaling={false} style={[styles.togetherTitle, { color: primary }]}>
              {copy.together.title}
            </Text>
            <Text style={[styles.togetherSub, { color: muted }]}>{introText}</Text>
          </View>
        </View>
        {friendListHidden ? (
          <Text style={[styles.note, { color: muted }]}>{copy.together.hiddenList(friendName)}</Text>
        ) : null}
        {candidates.length === 0 ? <Text style={[styles.note, { color: muted }]}>{copy.together.noneHint}</Text> : null}

        {candidates.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {candidates.slice(0, THUMBS_SHOWN).map((item) => (
              <View
                key={item.key}
                accessible
                accessibilityLabel={`${item.name}. ${copy.together.sources[item.source]}`}
                style={[styles.thumb, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                {item.imagePath ? (
                  <Image source={{ uri: posterUri(item.type, item.id, item.imagePath) }} style={styles.thumbImage} contentFit="cover" />
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {!canInvite && candidates.length > 0 ? (
          <Text style={[styles.note, { color: muted }]}>{copy.together.needFriend}</Text>
        ) : null}

        {canInvite && (candidates.length > 0 || (match.score !== null && onShareMatch)) ? (
          <View style={styles.actionRow}>
            {candidates.length > 0 ? (
              <Pressable
                onPress={onInvite}
                disabled={inviteBusy}
                accessibilityRole="button"
                accessibilityLabel={copy.together.action(friendName)}
                accessibilityState={{ disabled: inviteBusy, busy: inviteBusy }}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.accent }, (pressed || inviteBusy) && styles.pressed]}
              >
                {inviteBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />}
                <Text allowFontScaling={false} numberOfLines={1} style={styles.actionText}>
                  {copy.together.inviteLabel}
                </Text>
              </Pressable>
            ) : null}
            {match.score !== null && onShareMatch ? (
              <Pressable
                onPress={onShareMatch}
                accessibilityRole="button"
                accessibilityLabel={copy.shareAction(friendName)}
                style={({ pressed }) => [
                  styles.shareAction,
                  { backgroundColor: alpha(heat.accent, heat.level > 0 ? 0.16 : 0.14), borderColor: alpha(heat.accent, heat.level > 0 ? 0.52 : 0.36) },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={heat.level >= 2 ? "flame" : "chatbubble-ellipses-outline"} size={14} color={heat.accent} />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.shareActionText, { color: heat.accent }]}>
                  {copy.shareLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <TasteMatchInfoSheet visible={infoOpen} onClose={closeInfo} copy={copy} />
    </GlassBox>
  );
}

export default memo(TasteMatchCard);

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 11 },
  hotHead: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, margin: -4, padding: 4 },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringText: { fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  headText: { flexShrink: 1, flexGrow: 1, gap: 2 },
  title: { fontSize: 15.5, lineHeight: 20, fontWeight: "800", letterSpacing: -0.2 },
  sub: { fontSize: 12, lineHeight: 16 },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  heatBarWrap: { minHeight: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  heatTrack: { flex: 1, height: 8, borderRadius: 999, overflow: "hidden", position: "relative" },
  heatFill: { height: "100%", borderRadius: 999 },
  heatMark: { position: "absolute", top: 1, bottom: 1, width: 1, marginLeft: -0.5 },
  heatFlames: { minWidth: 25, height: 18, borderRadius: 9, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1 },

  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  tileOff: { borderStyle: "dashed", justifyContent: "space-between" },
  tileTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  tileLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.1, flexShrink: 1 },
  tileValue: { fontSize: 16, lineHeight: 19, fontWeight: "900", letterSpacing: -0.3 },
  tileCaption: { fontSize: 11, fontWeight: "600" },

  statsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 2, justifyContent: "center" },
  statDivider: { width: StyleSheet.hairlineWidth * 2, marginVertical: 2 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontSize: 16, lineHeight: 19, fontWeight: "900", letterSpacing: -0.3 },
  statLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: "700" },

  barTrack: { height: 3, borderRadius: 1.5, overflow: "hidden", marginTop: 2 },
  barFill: { height: "100%", borderRadius: 1.5 },

  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, paddingVertical: 3.5, maxWidth: "100%" },
  chipText: { fontSize: 11.5, fontWeight: "800" },

  insights: { gap: 5, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8 },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  insightText: { flexShrink: 1, fontSize: 11.5, lineHeight: 15.5, fontWeight: "600" },

  railSection: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.1 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginVertical: 1 },

  togetherSection: { gap: 7 },
  togetherHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  togetherBadge: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  togetherHeaderCopy: { flex: 1, minWidth: 0, gap: 1 },
  togetherTitle: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.1 },
  togetherSub: { fontSize: 11.5, lineHeight: 15 },
  note: { fontSize: 11, lineHeight: 15 },

  thumbs: { gap: 6, paddingVertical: 1 },
  thumb: { width: 48, height: 72, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  ratingChip: { position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: 1.5, alignItems: "center" },
  ratingChipText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "800" },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  action: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800", flexShrink: 1, textAlign: "center" },
  shareAction: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shareActionText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1, textAlign: "center" },
  pressed: { opacity: 0.8 },
});

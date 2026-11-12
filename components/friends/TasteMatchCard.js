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
// KOMPAKT (12 Kas): Derin analiz, İçgörüler ve Ortak izlenenler KATLANIR bölümlerdir (Collapsible), varsayılan
// kapalı. Başlık satırı kapalıyken de kısa özet gösterir (güven düzeyi / satır sayısı / afiş sayısı).
//
// DÜRÜST ÇIKTI: yeterli veri yoksa yüzde ÇİZİLMEZ (nedeni yazılır). Arkadaş yalnız film YA DA yalnız dizi
// paylaşıyorsa diğer kutu "Paylaşılmıyor" diye sönük gösterilir (puan uydurulmaz). Davet düğmesi yalnız arkadaşa
// ve adayı olan kullanıcıya görünür.
import React, { memo, useCallback, useState } from "react";
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import LensLoader from "../LensLoader";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import usePosterUri from "../../hooks/usePosterUri";
import { alpha } from "../../theme/colors";
import { getTasteMatchCopy } from "../../utils/tasteMatchCopy";
import { localizeGenreList, localizeGenreName } from "../../utils/genreDisplay";
import { tasteMatchHeat } from "../../utils/tasteMatchVisuals";
import GlassBox from "../common/GlassBox";
import TasteMatchInfoSheet from "./TasteMatchInfoSheet";
import { Bar, GenreChips, HeatBar, StatsStrip, TasteHead, TypeTiles } from "./TasteMatchParts";
import { DEEP_COMPONENTS } from "../../utils/tasteMatch";

const THUMBS_SHOWN = 8;
const LOW_DATA_COLOR = "#F5A524";
const EMPTY = [];

/**
 * Katlanır bölüm: başlık satırı (ikon · ad · sağda kısa özet · ok) her zaman görünür; gövde dokununca açılır.
 * Kapalıyken kart kısa kalır; ayrıntı isteyen tek dokunuşla açar.
 */
function Collapsible({ icon, title, summary, summaryColor, open, onToggle, toggleCopy, theme, primary, muted, children }) {
  return (
    <View style={[styles.section, { borderColor: theme.border, backgroundColor: alpha(muted, 0.05) }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={open ? toggleCopy.collapse : toggleCopy.expand}
        accessibilityState={{ expanded: open }}
        hitSlop={4}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={14} color={theme.accent} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.sectionHeadTitle, { color: primary }]}>
          {title}
        </Text>
        {summary ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.sectionSummary, { color: summaryColor || muted }]}>
            {summary}
          </Text>
        ) : null}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={15} color={muted} />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function animateNext() {
  try {
    LayoutAnimation?.configureNext?.(LayoutAnimation.Presets?.easeInEaseOut);
  } catch {
    // animasyon yoksa (test / desteklenmeyen platform) düz aç-kapa
  }
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
  // Ayrıntı bölümleri varsayılan KAPALI (kart kompakt); her biri bağımsız açılır.
  const [openSections, setOpenSections] = useState(() => ({ deep: false, insights: false, shared: false }));
  const toggleSection = useCallback((key) => {
    animateNext();
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const toggleDeep = useCallback(() => toggleSection("deep"), [toggleSection]);
  const toggleInsights = useCallback(() => toggleSection("insights"), [toggleSection]);
  const toggleShared = useCallback(() => toggleSection("shared"), [toggleSection]);

  const muted = theme.text?.secondary ?? "#aaa";
  const primary = theme.text?.primary ?? "#fff";
  const track = alpha(muted, 0.22);
  const blue = theme.colors?.blue ?? "#64b4ff";
  const green = theme.colors?.green ?? "#29b864";
  const orange = theme.colors?.orange ?? "#ff9650";
  const rose = "#E11D48";
  const pct = (n) => copy.percent(n);
  const heat = tasteMatchHeat(match.score, theme.accent);
  const tone = { primary, muted, track, border: theme.border, accent: theme.accent, strip: theme.between };

  const percent = match.ratings.agreement === null ? null : Math.round(match.ratings.agreement * 100);
  const valueOf = (id) => match.breakdown?.find((part) => part.id === id)?.value;
  const highlights = match.highlights ?? EMPTY;
  const loved = match.loved ?? EMPTY;
  const split = match.split ?? null;
  const lean = match.genres.lean ?? null;
  const leanText =
    lean?.mine && lean?.theirs
      ? copy.insights.lean(localizeGenreName(lean.mine, language), localizeGenreName(lean.theirs, language), friendName)
      : lean?.mine
        ? copy.insights.leanMine(localizeGenreName(lean.mine, language))
        : lean?.theirs
          ? copy.insights.leanTheirs(localizeGenreName(lean.theirs, language), friendName)
          : null;
  const sharedGenres = localizeGenreList(match.genres.shared, language);
  const deep = match.deep ?? null;
  const deepParts = DEEP_COMPONENTS.map((id) => ({ id, value: valueOf(id) })).filter((p) => p.value !== undefined);
  const deepTexts = [];
  if (deep?.genreAgree) deepTexts.push({ icon: "heart-circle-outline", color: green, text: copy.insights.genreAgree(localizeGenreName(deep.genreAgree.genre, language)) });
  if (deep?.genreSplit) {
    deepTexts.push({
      icon: "swap-horizontal-outline",
      color: orange,
      text: copy.insights.genreSplit(localizeGenreName(deep.genreSplit.genre, language), deep.genreSplit.mine, deep.genreSplit.theirs, friendName),
    });
  }
  const trend = valueOf("ratingTrend");
  if (trend !== undefined && trend >= 70) deepTexts.push({ icon: "trending-up-outline", color: green, text: copy.insights.trendHigh() });
  else if (trend !== undefined && trend <= 40) deepTexts.push({ icon: "trending-down-outline", color: orange, text: copy.insights.trendLow() });
  if (deep?.generous) {
    deepTexts.push({
      icon: "scale-outline",
      color: blue,
      text: deep.generous.who === "mine" ? copy.insights.generousMine(deep.generous.gap) : copy.insights.generousTheirs(deep.generous.gap, friendName),
    });
  }
  const genreTable = match.genres?.table ?? EMPTY;
  const tableMax = genreTable.reduce((m, row) => Math.max(m, row.mine, row.theirs), 1);
  const insightCount = (loved.length > 0 ? 1 : 0) + (split ? 1 : 0) + (leanText ? 1 : 0) + deepTexts.length;
  const hasInsights = insightCount > 0;
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
      {/* ── Üst kısım (türler dahil): sohbete giden kartla AYNI parçalar (TasteMatchParts) ── */}
      <TasteHead
        score={match.score}
        title={match.tier ? copy.tiers[match.tier] : copy.title}
        heat={heat}
        tone={tone}
        percentText={{ label: `${copy.title}: ${pct(match.score)}`, value: pct(match.score) }}
        sub={
          <>
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
          </>
        }
        trailing={
          <Pressable
            onPress={openInfo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copy.info.open}
            style={({ pressed }) => [styles.infoButton, { backgroundColor: alpha(muted, 0.14) }, pressed && styles.pressed]}
          >
            <Ionicons name="information" size={16} color={muted} />
          </Pressable>
        }
      />

      {match.score !== null ? <HeatBar score={match.score} heat={heat} track={track} /> : null}

      {/* ── Az veri uyarısı ── */}
      {hasData && match.lowData ? (
        <View
          accessible
          accessibilityRole="alert"
          style={[styles.lowData, { backgroundColor: alpha(LOW_DATA_COLOR, 0.12), borderColor: alpha(LOW_DATA_COLOR, 0.35) }]}
        >
          <Ionicons name="warning-outline" size={14} color={LOW_DATA_COLOR} />
          <Text allowFontScaling={false} style={[styles.lowDataText, { color: primary }]}>
            {copy.lowData}
          </Text>
        </View>
      ) : null}

      {/* ── Film / Dizi ayrı uyum (kompakt yatay ikili) ── */}
      {showTypes ? <TypeTiles movie={match.byType.movie} tv={match.byType.tv} colors={{ movie: blue, tv: green }} {...{ copy, tone, pct }} /> : null}

      {/* ── Sayı şeridi + ortak türler ── */}
      {hasData ? (
        <>
          <StatsStrip
            tone={tone}
            stats={[
              { key: "overlap", icon: "checkmark-done-outline", value: String(match.watched.overlap.length), label: copy.parts.overlap, bar: valueOf("overlap"), color: theme.accent },
              favoritesShown
                ? { key: "favorites", icon: "heart-outline", value: String(match.favorites?.length ?? 0), label: copy.parts.favorites, bar: valueOf("favorites"), color: rose }
                : null,
              percent !== null ? { key: "ratings", icon: "star-half-outline", value: pct(percent), label: copy.parts.ratings, bar: valueOf("ratings"), color: orange } : null,
            ].filter(Boolean)}
          />
          <GenreChips genres={sharedGenres} label={copy.parts.genres} tone={tone} />
        </>
      ) : null}

      {/* ── Derin analiz: ek bileşenler + güven + incelenen veri ── */}
      {hasData && (deepParts.length > 0 || match.confidence || genreTable.length > 0) ? (
        <Collapsible
          icon="analytics-outline"
          title={copy.deepTitle}
          summary={match.confidence ? copy.confidence[match.confidence] : null}
          summaryColor={match.lowData ? LOW_DATA_COLOR : theme.accent}
          open={openSections.deep}
          onToggle={toggleDeep}
          toggleCopy={copy.sectionToggle}
          {...{ theme, primary, muted }}
        >
          {deepParts.map((part) => (
            <View key={part.id} style={styles.deepRow} accessible accessibilityLabel={`${copy.parts[part.id]}: ${pct(part.value)}`}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.deepLabel, { color: muted }]}>
                {copy.parts[part.id]}
              </Text>
              <View style={styles.deepBar}>
                <Bar value={part.value} color={theme.accent} track={track} />
              </View>
              <Text allowFontScaling={false} style={[styles.deepValue, { color: primary }]}>
                {pct(part.value)}
              </Text>
            </View>
          ))}
          {genreTable.length > 0 ? (
            <View style={styles.genreTable}>
              <View style={styles.genreTableHead}>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.genreTableTitle, { color: primary }]}>
                  {copy.genreTableTitle}
                </Text>
                <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { color: muted }]}>
                  {copy.you}
                </Text>
                <View style={[styles.legendDot, { backgroundColor: blue }]} />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.legendText, styles.legendName, { color: muted }]}>
                  {friendName}
                </Text>
              </View>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.deepBasis, { color: muted }]}>
                {copy.genreTableHint}
              </Text>
              {genreTable.map((row) => {
                const label = localizeGenreName(row.genre, language);
                const mineText = `${pct(row.mine)}${row.mineAvg != null ? ` · ${row.mineAvg}` : ""}`;
                const theirText = `${pct(row.theirs)}${row.theirAvg != null ? ` · ${row.theirAvg}` : ""}`;
                return (
                  <View
                    key={row.genre}
                    style={styles.genreRow}
                    accessible
                    accessibilityLabel={`${label}: ${copy.you} ${mineText}, ${friendName} ${theirText}`}
                  >
                    <Text allowFontScaling={false} numberOfLines={1} style={[styles.genreName, { color: primary }]}>
                      {label}
                    </Text>
                    <View style={styles.genreBars}>
                      <View style={[styles.genreTrack, { backgroundColor: track }]}>
                        <View style={[styles.genreFill, { backgroundColor: theme.accent, width: `${Math.max(row.mine ? 3 : 0, (row.mine / tableMax) * 100)}%` }]} />
                      </View>
                      <View style={[styles.genreTrack, { backgroundColor: track }]}>
                        <View style={[styles.genreFill, { backgroundColor: blue, width: `${Math.max(row.theirs ? 3 : 0, (row.theirs / tableMax) * 100)}%` }]} />
                      </View>
                    </View>
                    <View style={styles.genreNums}>
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.genreNum, { color: theme.accent }]}>
                        {mineText}
                      </Text>
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.genreNum, { color: blue }]}>
                        {theirText}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.deepBasis, { color: muted }]}>
            {copy.basis(match.watched.overlap.length, match.ratings.pairs)}
          </Text>
        </Collapsible>
      ) : null}

      {/* ── İçgörüler (katlanır; başlıkta satır sayısı) ── */}
      {hasData && hasInsights ? (
        <Collapsible
          icon="bulb-outline"
          title={copy.insightsTitle}
          summary={String(insightCount)}
          open={openSections.insights}
          onToggle={toggleInsights}
          toggleCopy={copy.sectionToggle}
          {...{ theme, primary, muted }}
        >
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
          {deepTexts.map((row) => (
            <InsightRow key={row.text} icon={row.icon} color={row.color} muted={muted} text={row.text} />
          ))}
        </Collapsible>
      ) : null}

      {/* ── Ortak izlenenler (katlanır afiş şeridi + iki taraf puanı) ── */}
      {hasData && highlights.length > 0 ? (
        <Collapsible
          icon="albums-outline"
          title={copy.sharedTitle}
          summary={String(highlights.length)}
          open={openSections.shared}
          onToggle={toggleShared}
          toggleCopy={copy.sectionToggle}
          {...{ theme, primary, muted }}
        >
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
        </Collapsible>
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
                {inviteBusy ? <LensLoader tone="mono" size="small" color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />}
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
  card: { borderRadius: 20, borderWidth: 1, padding: 12, gap: 8 },
  sub: { fontSize: 12, lineHeight: 16 },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },






  lowData: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  lowDataText: { flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 },
  section: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38, paddingHorizontal: 10 },
  sectionHeadTitle: { flex: 1, fontSize: 12.5, fontWeight: "800" },
  sectionSummary: { fontSize: 11, fontWeight: "800", maxWidth: "40%" },
  sectionBody: { gap: 7, paddingHorizontal: 10, paddingBottom: 10 },
  deepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  deepLabel: { width: 112, fontSize: 11, fontWeight: "700" },
  deepBar: { flex: 1 },
  deepValue: { width: 38, textAlign: "right", fontSize: 11, fontWeight: "800" },
  deepBasis: { fontSize: 10, fontWeight: "600" },
  genreTable: { gap: 6, marginTop: 4 },
  genreTableHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  genreTableTitle: { flex: 1, fontSize: 11.5, fontWeight: "800" },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "700" },
  legendName: { maxWidth: 80 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  genreName: { width: 92, fontSize: 11, fontWeight: "700" },
  genreBars: { flex: 1, gap: 3 },
  genreTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  genreFill: { height: 5, borderRadius: 3 },
  genreNums: { width: 74, alignItems: "flex-end", gap: 1 },
  genreNum: { fontSize: 9.5, fontWeight: "800" },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  insightText: { flexShrink: 1, fontSize: 11.5, lineHeight: 15.5, fontWeight: "600" },

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

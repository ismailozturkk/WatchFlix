// components/chat/SharedAiMessage.js
//
// Sohbette/grupta paylaşılan CineMatch (AI) cevabı balonunun gövdesi (mesaj
// kind: "aiShare", bkz. utils/chatShare.js). Alıcı cevabı AI hakkı HARCAMADAN,
// bağlamıyla (sorulan soru) görür; bulunan yapımlara basınca detay açılır.
//
// Gövde, AI ekranındaki kalıbın (components/AICineCards.js) sohbet balonuna
// sığan karşılığıdır — her cevap türü KENDİ düzeniyle çizilir:
//   • öneriler        → sıra numaralı satırlar: afiş + meta (tür · yıl · süre ·
//                       puan) + tür çipleri + neden
//   • izleme listesi  → bölüm başlıklı (öne çıkanlar, gizli cevherler…) satırlar
//                       + "Mutlaka" rozeti
//   • izleme planı    → numaralı oturum zaman çizelgesi; her oturumda toplam süre
//                       ve süre etiketli afiş şeridi
//   • karşılaştırma   → kazanan taçlı VS başlığı, toplam puan çubuğu, yıldızlı
//                       metrik tablosu, artı/eksi sütunları ve sonuç kutusu
//   • yapım detayı    → arka plan bannerı + afiş, künye çipleri, CineMatch yorumu,
//                       özet, yönetmen/oyuncular, "Detay" düğmesi
//   • genel           → metin + afiş şeridi
// Eski mesajlarda ek alanlar (süre, tür, metrikler…) yoktur; kart o blokları
// çizmeden aynı düzeni korur.
//
// Metin sabitleri tek yerden (çeviri paketi `AICineChat` + utils/aiCopy) gelir;
// böylece alıcı cevabın türünü / bölüm adlarını KENDİ dilinde görür (içerik —
// başlık, neden — gönderenin dilinde kalır, çünkü modelin ürettiği metindir).

import React, { memo, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import { fillCopy, getAiCopy } from "../../utils/aiCopy";
import { pickByLanguage } from "../../utils/appLanguages";
import GlassTouchable from "../common/GlassTouchable";
import { MEDIA_TYPE_COLOR, PosterEdge, easeLayout, sharePalette } from "./shareKit";

const COLLAPSED_PICKS = 4;
const COLLAPSED_SESSIONS = 3;
const SUMMARY_FOLD_CHARS = 220;
const ROW_POSTER_W = 50;
const STRIP_POSTER_W = 54;
const STAR = "#FFC94D";
const GREEN = "#29b864";
const RED = "#e5484d";
const GOLD = "#FF9F43";

const VARIANT_FALLBACK = {
  recommendations: "Sana Özel Öneriler",
  comparison: "Karşılaştırma",
  watch_plan: "İzleme Planı",
  watchlist: "İzleme Listesi",
  title_spotlight: "Yapım Detayı",
};

const VARIANT_ICON = {
  recommendations: "sparkles",
  comparison: "git-compare",
  watch_plan: "calendar",
  watchlist: "bookmarks",
  title_spotlight: "film",
  general: "chatbubble-ellipses",
};

const typeWord = (mediaType, t) =>
  mediaType === "tv"
    ? t?.AICineChat?.series || i18nText("autoI18n.dizi", "Dizi")
    : t?.AICineChat?.movie || i18nText("autoI18n.film", "Film");

/** "2 sa 15 dk" — services/aiCineInsights.formatDuration ile aynı birimler (o modül ağır). */
export function durationText(minutes, language) {
  const total = Math.round(Number(minutes) || 0);
  if (total <= 0) return "";
  const { hour, minute } = pickByLanguage(language, {
    tr: { hour: "sa", minute: "dk" },
    en: { hour: "h", minute: "m" },
    es: { hour: "h", minute: "min" },
    pt: { hour: "h", minute: "min" },
    de: { hour: "h", minute: "m" },

  it: {
  hour: "h",
  minute: "M"
},
  fr: { hour: "h", minute: "min" },
  ja: { hour: "時間", minute: "分" }});
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${minute}`;
  return m === 0 ? `${h} ${hour}` : `${h} ${hour} ${m} ${minute}`;
}

/** Bir plan oturumunun toplamı: filmlerin süresi toplanır, diziler ayrı sayılır. */
export function sessionTotals(picks) {
  return (picks || []).reduce(
    (acc, pick) => {
      if (pick.media_type === "tv") acc.series += 1;
      else if (pick.minutes > 0) {
        acc.minutes += pick.minutes;
        acc.movies += 1;
      }
      return acc;
    },
    { minutes: 0, movies: 0, series: 0 },
  );
}

const ratingColor = (r) => (r >= 8 ? GREEN : r >= 6 ? STAR : r >= 4 ? GOLD : RED);

// ── Atomlar ──────────────────────────────────────────────────────────────────

function Poster({ pick, width, radius, getTmdbUrl, palette }) {
  return (
    <View
      style={[
        styles.poster,
        { width, height: Math.round(width * 1.5), borderRadius: radius, backgroundColor: palette.posterBg },
      ]}
    >
      {pick?.poster_path && getTmdbUrl ? (
        <Image
          source={{ uri: getTmdbUrl(pick.poster_path, "poster", Math.max(154, width * 2)) }}
          style={styles.fill}
          cachePolicy="memory-disk"
          transition={120}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.fill, styles.center]}>
          <Ionicons
            name={pick?.media_type === "tv" ? "tv-outline" : "film-outline"}
            size={width > 60 ? 24 : 16}
            color={palette.muted}
          />
        </View>
      )}
      <PosterEdge radius={radius} color={palette.posterEdge} />
    </View>
  );
}

/**
 * Satır / afiş hücresi sarmalayıcısı (kart, düğme değil — cama çevrilmez):
 * yalnız TMDB kimliği olan başlık dokununca detay açar.
 */
function OpenableCell({ pick, onOpen, style, children, label = true }) {
  const openable = pick?.id != null && typeof onOpen === "function";
  if (!openable) return <View style={style}>{children}</View>;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onOpen(pick)}
      accessibilityRole="button"
      accessibilityLabel={label ? pick.title : undefined}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
}

function Chip({ label, icon, palette, tint }) {
  return (
    <View
      style={[
        styles.chip,
        tint
          ? { backgroundColor: alpha(tint, 0.16), borderColor: alpha(tint, 0.45) }
          : { backgroundColor: palette.surface, borderColor: palette.divider },
      ]}
    >
      {icon ? <Ionicons name={icon} size={10} color={tint || palette.muted} /> : null}
      <Text allowFontScaling={false} style={[styles.chipText, { color: tint || palette.secondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MustBadge({ t }) {
  return (
    <View style={[styles.must, { backgroundColor: alpha(GOLD, 0.2) }]}>
      <Text allowFontScaling={false} style={[styles.mustText, { color: GOLD }]}>
        {t?.AICineChat?.mustWatch || "Mutlaka"}
      </Text>
    </View>
  );
}

function Stars({ score, color }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < score ? "star" : "star-outline"}
          size={10}
          color={i < score ? color : alpha(color, 0.35)}
        />
      ))}
    </View>
  );
}

function MetaLine({ pick, t, language, palette }) {
  const meta = [typeWord(pick.media_type, t), pick.year, durationText(pick.minutes, language)]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.metaLine}>
      <View style={[styles.typeDot, { backgroundColor: MEDIA_TYPE_COLOR[pick.media_type] || MEDIA_TYPE_COLOR.movie }]} />
      <Text style={[styles.rowMeta, { color: palette.muted }]} numberOfLines={1}>
        {meta}
      </Text>
      {pick.rating ? (
        <>
          <Ionicons name="star" size={10} color={STAR} style={styles.star} />
          <Text allowFontScaling={false} style={[styles.rowMeta, { color: palette.secondary }]}>
            {pick.rating.toFixed(1)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function FoldText({ text, palette, style, lines, color }) {
  const [open, setOpen] = useState(false);
  const foldable = text.length > SUMMARY_FOLD_CHARS;
  return (
    <View>
      <Text style={[style, { color: color || palette.primary }]} numberOfLines={open || !foldable ? undefined : lines}>
        {text}
      </Text>
      {foldable && (
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 12 }}
          onPress={() => {
            easeLayout();
            setOpen((value) => !value);
          }}
          accessibilityRole="button"
        >
          <Text allowFontScaling={false} style={[styles.foldLink, { color: palette.tileInk }]}>
            {open ? i18nText("autoI18n.daha_az", "Daha az") : i18nText("autoI18n.devamini_oku", "Devamını oku")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FoldButton({ expanded, total, palette, onToggle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        easeLayout();
        onToggle();
      }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={[styles.foldButton, { backgroundColor: palette.ghostBg, borderColor: palette.ghostBorder }]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={palette.ghostInk} />
      <Text allowFontScaling={false} style={[styles.foldButtonText, { color: palette.ghostInk }]}>
        {expanded
          ? i18nText("autoI18n.daha_az", "Daha az")
          : `${i18nText("autoI18n.liste_paylas_tumunu_gor", "Tümünü gör")} (${total})`}
      </Text>
    </TouchableOpacity>
  );
}

/** Sonuç / karar kutusu (karşılaştırmada kupalı, diğerlerinde ampullü). */
function SummaryBox({ text, palette, icon, tint, prefix }) {
  return (
    <View
      style={[
        styles.summaryBox,
        tint
          ? { backgroundColor: alpha(tint, 0.12), borderColor: alpha(tint, 0.55) }
          : { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
      ]}
    >
      <Ionicons name={icon} size={15} color={tint || palette.tileInk} style={styles.summaryIcon} />
      <View style={styles.summaryCopy}>
        {prefix ? (
          <Text allowFontScaling={false} style={[styles.summaryPrefix, { color: tint || palette.tileInk }]}>
            {prefix}
          </Text>
        ) : null}
        <FoldText text={text} palette={palette} style={styles.summaryText} lines={5} />
      </View>
    </View>
  );
}

/** İlk N öğeyi bölümler boyunca sayarak katlar; öğesi kalmayan bölüm gizlenir. */
function foldSections(sections, budget) {
  const out = [];
  sections.forEach((section) => {
    if (budget <= 0) return;
    const picks = section.picks.slice(0, budget);
    budget -= picks.length;
    out.push({ ...section, picks });
  });
  return out;
}

// ── Kalıplar ─────────────────────────────────────────────────────────────────

/** Öneriler: sıra numarası + afiş + meta + tür çipleri + neden. */
function RankRow({ pick, rank, ctx, last }) {
  const { palette, getTmdbUrl, t, language, onOpen } = ctx;
  return (
    <OpenableCell pick={pick} onOpen={onOpen} style={[styles.row, { borderColor: palette.divider }, last && styles.rowLast]}>
      <View>
        <Poster pick={pick} width={ROW_POSTER_W} radius={9} getTmdbUrl={getTmdbUrl} palette={palette} />
        <View style={[styles.rankBadge, { backgroundColor: palette.buttonBg, borderColor: palette.cardBg }]}>
          <Text allowFontScaling={false} style={[styles.rankText, { color: palette.buttonInk }]}>
            {rank}
          </Text>
        </View>
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, { color: palette.primary }]} numberOfLines={2}>
            {pick.title}
          </Text>
          {pick.must ? <MustBadge t={t} /> : null}
        </View>
        <MetaLine pick={pick} t={t} language={language} palette={palette} />
        {pick.genres?.length ? (
          <View style={styles.chipRow}>
            {pick.genres.map((genre) => (
              <Chip key={genre} label={genre} palette={palette} />
            ))}
          </View>
        ) : null}
        {!!pick.note && (
          <Text style={[styles.note, { color: palette.secondary }]} numberOfLines={3}>
            {pick.note}
          </Text>
        )}
      </View>
      {pick.id != null && onOpen ? <Ionicons name="chevron-forward" size={14} color={palette.muted} /> : null}
    </OpenableCell>
  );
}

/** İzleme listesi: daha sıkı satır, "Mutlaka" rozeti ve kısa not. */
function ListRow({ pick, ctx, last }) {
  const { palette, getTmdbUrl, t, language, onOpen } = ctx;
  return (
    <OpenableCell pick={pick} onOpen={onOpen} style={[styles.row, styles.rowTight, { borderColor: palette.divider }, last && styles.rowLast]}>
      <Poster pick={pick} width={40} radius={7} getTmdbUrl={getTmdbUrl} palette={palette} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitleSm, { color: palette.primary }]} numberOfLines={2}>
            {pick.title}
          </Text>
          {pick.must ? <MustBadge t={t} /> : null}
        </View>
        <MetaLine pick={pick} t={t} language={language} palette={palette} />
        {!!pick.note && (
          <Text style={[styles.noteSm, { color: palette.secondary }]} numberOfLines={2}>
            {pick.note}
          </Text>
        )}
      </View>
      {pick.id != null && onOpen ? <Ionicons name="chevron-forward" size={14} color={palette.muted} /> : null}
    </OpenableCell>
  );
}

function SectionHead({ label, count, palette }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionDot, { backgroundColor: palette.tileInk }]} />
      <Text style={[styles.sectionName, { color: palette.primary }]} numberOfLines={1}>
        {label}
      </Text>
      {count ? (
        <Text allowFontScaling={false} style={[styles.sectionCount, { color: palette.muted }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

function RecommendationsBody({ sections, ctx }) {
  let rank = 0;
  return sections.map((section, sIndex) => (
    <View key={`rec-${sIndex}`} style={styles.section}>
      {section.picks.map((pick, pIndex) => {
        rank += 1;
        return (
          <RankRow
            key={`${pick.media_type}-${pick.id ?? pick.title}-${pIndex}`}
            pick={pick}
            rank={rank}
            ctx={ctx}
            last={pIndex === section.picks.length - 1}
          />
        );
      })}
    </View>
  ));
}

function WatchlistBody({ sections, fullSections, ctx }) {
  return sections.map((section, sIndex) => {
    const label = ctx.sectionLabel(section);
    const fullCount = fullSections[sIndex]?.picks.length || section.picks.length;
    return (
      <View key={`${label}-${sIndex}`} style={styles.section}>
        {!!label && <SectionHead label={label} count={fullCount} palette={ctx.palette} />}
        {!!section.note && (
          <Text style={[styles.sectionNote, { color: ctx.palette.muted }]} numberOfLines={3}>
            {section.note}
          </Text>
        )}
        {section.picks.map((pick, pIndex) => (
          <ListRow
            key={`${pick.media_type}-${pick.id ?? pick.title}-${pIndex}`}
            pick={pick}
            ctx={ctx}
            last={pIndex === section.picks.length - 1}
          />
        ))}
      </View>
    );
  });
}

/** İzleme planı: numaralı oturumlar dikey bir çizgiyle bağlanır. */
function PlanBody({ sections, totalSessions, ctx }) {
  const { palette, getTmdbUrl, t, language, copy, onOpen } = ctx;
  return (
    <View style={styles.plan}>
      {sections.map((section, index) => {
        const totals = sessionTotals(section.picks);
        const parts = [];
        if (totals.minutes > 0) {
          parts.push(fillCopy(copy.notes.runtimeMovies, { time: durationText(totals.minutes, language), n: totals.movies }));
        }
        if (totals.series > 0) parts.push(fillCopy(copy.notes.runtimeSeries, { n: totals.series }));
        const isLast = index === sections.length - 1 && sections.length === totalSessions;
        return (
          <View key={`plan-${index}`} style={styles.planStep}>
            <View style={styles.planRail}>
              <View style={[styles.planNum, { backgroundColor: palette.buttonBg }]}>
                <Text allowFontScaling={false} style={[styles.planNumText, { color: palette.buttonInk }]}>
                  {index + 1}
                </Text>
              </View>
              {!isLast ? <View style={[styles.planLine, { backgroundColor: palette.divider }]} /> : null}
            </View>
            <View style={styles.planBody}>
              <Text style={[styles.planLabel, { color: palette.primary }]} numberOfLines={2}>
                {ctx.sectionLabel(section) || `${index + 1}.`}
              </Text>
              {parts.length ? (
                <View style={styles.planRuntime}>
                  <Ionicons name="time-outline" size={11} color={palette.muted} />
                  <Text style={[styles.planRuntimeText, { color: palette.muted }]} numberOfLines={1}>
                    {parts.join(" ")}
                  </Text>
                </View>
              ) : null}
              <View style={styles.strip}>
                {section.picks.map((pick, pIndex) => (
                  <OpenableCell
                    key={`${pick.media_type}-${pick.id ?? pick.title}-${pIndex}`}
                    pick={pick}
                    onOpen={onOpen}
                    style={styles.stripItem}
                  >
                    <Poster pick={pick} width={STRIP_POSTER_W} radius={8} getTmdbUrl={getTmdbUrl} palette={palette} />
                    <Text style={[styles.stripTitle, { color: palette.primary }]} numberOfLines={2}>
                      {pick.title}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.stripMeta, { color: palette.muted }]} numberOfLines={1}>
                      {durationText(pick.minutes, language) || typeWord(pick.media_type, t)}
                    </Text>
                  </OpenableCell>
                ))}
              </View>
              {!!section.note && (
                <Text style={[styles.sectionNote, { color: palette.secondary }]} numberOfLines={3}>
                  {section.note}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProsCons({ items, color, icon, palette }) {
  if (!items?.length) return null;
  return items.map((text, i) => (
    <View key={`${icon}-${i}`} style={styles.pcRow}>
      <Ionicons name={icon} size={12} color={color} style={styles.pcIcon} />
      <Text style={[styles.pcText, { color: palette.secondary }]}>{text}</Text>
    </View>
  ));
}

function VersusPick({ pick, winner, ctx }) {
  const { palette, getTmdbUrl, t, onOpen } = ctx;
  return (
    <OpenableCell pick={pick} onOpen={onOpen} style={styles.versusPick}>
      <View style={[styles.versusRing, { borderColor: winner ? GOLD : "transparent" }]}>
        <Poster pick={pick} width={84} radius={11} getTmdbUrl={getTmdbUrl} palette={palette} />
        {winner ? (
          <View style={[styles.crown, { backgroundColor: GOLD }]}>
            <Ionicons name="trophy" size={11} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.versusTitle, { color: palette.primary }]} numberOfLines={2}>
        {pick.title}
      </Text>
      <Text style={[styles.versusMeta, { color: palette.muted }]} numberOfLines={1}>
        {[typeWord(pick.media_type, t), pick.year].filter(Boolean).join(" · ")}
      </Text>
    </OpenableCell>
  );
}

function ComparisonBody({ share, ctx }) {
  const { palette, t } = ctx;
  const [left, right] = share.sections[0].picks;
  const compare = share.compare || {};
  const metrics = compare.metrics || [];
  const leftTotal = metrics.reduce((sum, m) => sum + m.left, 0);
  const rightTotal = metrics.reduce((sum, m) => sum + m.right, 0);
  const hasTotals = metrics.length > 0 && leftTotal + rightTotal > 0;
  const leftWins = hasTotals && leftTotal > rightTotal;
  const rightWins = hasTotals && rightTotal > leftTotal;
  const leftColor = palette.tileInk;
  const rightColor = palette.secondary;
  const hasProsCons = ["leftPros", "leftCons", "rightPros", "rightCons"].some((key) => compare[key]?.length);
  const metricLabel = (m) => (m.key && t?.AICineChat?.metrics?.[m.key]) || m.label || m.key;

  return (
    <View>
      <View style={styles.versus}>
        <VersusPick pick={left} winner={leftWins} ctx={ctx} />
        <View style={[styles.vsBadge, { backgroundColor: palette.buttonBg }]}>
          <Text allowFontScaling={false} style={[styles.vsText, { color: palette.buttonInk }]}>
            VS
          </Text>
        </View>
        <VersusPick pick={right} winner={rightWins} ctx={ctx} />
      </View>

      {hasTotals && (
        <View style={styles.totalWrap}>
          <Text allowFontScaling={false} style={[styles.totalNum, { color: leftWins ? leftColor : palette.muted }]}>
            {leftTotal}
          </Text>
          <View style={[styles.totalBar, { backgroundColor: palette.surface }]}>
            <View
              style={{
                width: `${Math.round((leftTotal / (leftTotal + rightTotal)) * 100)}%`,
                height: "100%",
                backgroundColor: leftColor,
              }}
            />
          </View>
          <Text allowFontScaling={false} style={[styles.totalNum, { color: rightWins ? palette.primary : palette.muted }]}>
            {rightTotal}
          </Text>
        </View>
      )}

      {metrics.length > 0 && (
        <View style={[styles.metricBox, { borderColor: palette.divider }]}>
          {metrics.map((m, i) => (
            <View
              key={`${m.key || m.label}-${i}`}
              style={[styles.metricRow, { borderColor: palette.divider }, i === metrics.length - 1 && styles.rowLast]}
            >
              <Stars score={m.left} color={leftColor} />
              <Text style={[styles.metricLabel, { color: palette.secondary }]} numberOfLines={1}>
                {metricLabel(m)}
              </Text>
              <Stars score={m.right} color={rightColor} />
            </View>
          ))}
        </View>
      )}

      {hasProsCons && (
        <View style={styles.pcWrap}>
          <View style={styles.pcCol}>
            <ProsCons items={compare.leftPros} color={GREEN} icon="add-circle" palette={palette} />
            <ProsCons items={compare.leftCons} color={RED} icon="remove-circle" palette={palette} />
          </View>
          <View style={[styles.pcDivider, { backgroundColor: palette.divider }]} />
          <View style={styles.pcCol}>
            <ProsCons items={compare.rightPros} color={GREEN} icon="add-circle" palette={palette} />
            <ProsCons items={compare.rightCons} color={RED} icon="remove-circle" palette={palette} />
          </View>
        </View>
      )}

      {!!share.summary && (
        <SummaryBox
          text={share.summary}
          palette={palette}
          icon="trophy"
          tint={GOLD}
          prefix={t?.AICineChat?.verdict || i18nText("autoI18n.sonuc", "Sonuç")}
        />
      )}
    </View>
  );
}

function SpotlightBody({ share, ctx }) {
  const { palette, getTmdbUrl, t, language, copy, onOpen } = ctx;
  const pick = share.sections[0].picks[0];
  const extra = share.spotlight || {};
  const backdrop = extra.backdrop_path && getTmdbUrl ? getTmdbUrl(extra.backdrop_path, "backdrop", 780) : null;
  const runtime = durationText(pick.minutes, language);
  const openable = pick.id != null && typeof onOpen === "function";

  return (
    <View>
      {backdrop ? (
        <View style={[styles.banner, { backgroundColor: palette.posterBg }]}>
          <Image source={{ uri: backdrop }} style={styles.fill} contentFit="cover" transition={160} cachePolicy="memory-disk" />
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", alpha(palette.cardBg, 0.95)]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <View style={[styles.spotHead, backdrop && styles.spotHeadRaised]}>
        <OpenableCell pick={pick} onOpen={onOpen} label={false} style={[styles.spotPoster, { borderColor: palette.cardBg }]}>
          <Poster pick={pick} width={78} radius={10} getTmdbUrl={getTmdbUrl} palette={palette} />
        </OpenableCell>
        <View style={styles.spotCopy}>
          <Text style={[styles.spotTitle, { color: palette.primary }]} numberOfLines={3}>
            {pick.title}
          </Text>
          {!!extra.tagline && (
            <Text style={[styles.tagline, { color: palette.muted }]} numberOfLines={2}>
              {extra.tagline}
            </Text>
          )}
          <View style={styles.chipRow}>
            <Chip label={typeWord(pick.media_type, t)} palette={palette} />
            {!!pick.year && <Chip icon="calendar-outline" label={pick.year} palette={palette} />}
            {!!runtime && <Chip icon="time-outline" label={runtime} palette={palette} />}
            {pick.rating ? <Chip label={`★ ${pick.rating.toFixed(1)}`} palette={palette} tint={ratingColor(pick.rating)} /> : null}
          </View>
        </View>
      </View>

      {pick.genres?.length ? (
        <View style={[styles.chipRow, styles.spotGenres]}>
          {pick.genres.map((genre) => (
            <Chip key={genre} label={genre} palette={palette} />
          ))}
        </View>
      ) : null}

      {!!share.summary && <SummaryBox text={share.summary} palette={palette} icon="sparkles" />}

      {!!extra.overview && (
        <View style={styles.spotOverview}>
          <FoldText text={extra.overview} palette={palette} style={styles.overviewText} lines={4} color={palette.secondary} />
        </View>
      )}

      {!!extra.director && (
        <Text style={[styles.spotLine, { color: palette.secondary }]} numberOfLines={1}>
          <Text style={{ color: palette.muted }}>{t?.AICineChat?.director || i18nText("autoI18n.yonetmen", "Yönetmen")}: </Text>
          {extra.director}
        </Text>
      )}
      {!!extra.cast?.length && (
        <Text style={[styles.spotLine, { color: palette.secondary }]} numberOfLines={2}>
          <Text style={{ color: palette.muted }}>{t?.AICineChat?.cast || "Oyuncular"}: </Text>
          {extra.cast.join(", ")}
        </Text>
      )}

      {openable && (
        <GlassTouchable
          activeOpacity={0.85}
          onPress={() => onOpen(pick)}
          accessibilityRole="button"
          accessibilityLabel={pick.title}
          style={[styles.detailBtn, { backgroundColor: palette.ghostBg, borderColor: palette.ghostBorder }]}
        >
          <Text allowFontScaling={false} style={[styles.detailText, { color: palette.ghostInk }]}>
            {copy.actions.detail}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={palette.ghostInk} />
        </GlassTouchable>
      )}
    </View>
  );
}

function GeneralBody({ share, ctx }) {
  const { palette, getTmdbUrl, onOpen } = ctx;
  const picks = share.sections.flatMap((section) => section.picks);
  return (
    <View>
      {!!share.summary && (
        <View style={styles.summaryTop}>
          <FoldText text={share.summary} palette={palette} style={styles.summaryPlain} lines={8} />
        </View>
      )}
      {picks.length > 0 && (
        <View style={[styles.strip, styles.generalStrip]}>
          {picks.map((pick, index) => (
            <OpenableCell key={`${pick.media_type}-${pick.id ?? pick.title}-${index}`} pick={pick} onOpen={onOpen} style={styles.stripItem}>
              <Poster pick={pick} width={STRIP_POSTER_W} radius={8} getTmdbUrl={getTmdbUrl} palette={palette} />
              <Text style={[styles.stripTitle, { color: palette.primary }]} numberOfLines={2}>
                {pick.title}
              </Text>
            </OpenableCell>
          ))}
        </View>
      )}
    </View>
  );
}

/** Başlıktaki afiş yelpazesi (AI kartlarındaki CardHero'nun küçüğü). */
function PosterFan({ picks, getTmdbUrl, palette }) {
  const withPoster = picks.filter((pick) => pick.poster_path).slice(0, 3);
  if (!withPoster.length || !getTmdbUrl) return null;
  return (
    <View style={[styles.fan, { width: 26 + (withPoster.length - 1) * 13 }]}>
      {withPoster.map((pick, i) => (
        <View
          key={`${pick.poster_path}-${i}`}
          style={[
            styles.fanItem,
            {
              left: i * 13,
              zIndex: 3 - i,
              transform: [{ rotate: `${(i - (withPoster.length - 1) / 2) * 7}deg` }],
              borderColor: palette.cardBg,
            },
          ]}
        >
          <Poster pick={pick} width={24} radius={4} getTmdbUrl={getTmdbUrl} palette={palette} />
        </View>
      ))}
    </View>
  );
}

// ── Kart ─────────────────────────────────────────────────────────────────────

function SharedAiMessage({ share, isOutgoing = false, neutralCard = false, cardWidth, accent: propAccent, getTmdbUrl, onOpenItem }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const accent = propAccent || theme.accent || "#6C63FF";
  const palette = useMemo(() => {
    const base = sharePalette({ theme, isOutgoing: isOutgoing && !neutralCard, accent });
    return { ...base, cardBg: theme.secondary || theme.primary || "#1b1b1b" };
  }, [theme, isOutgoing, neutralCard, accent]);
  const copy = useMemo(() => getAiCopy(language), [language]);
  const [expanded, setExpanded] = useState(false);

  const sections = useMemo(() => share?.sections || [], [share]);
  const allPicks = useMemo(() => sections.flatMap((section) => section.picks), [sections]);
  const picksTotal = allPicks.length;

  const variant = share?.variant || "general";
  const isPlan = variant === "watch_plan";
  const isVersus = !!share?.versus && sections[0]?.picks?.length === 2;
  const isSpotlight = variant === "title_spotlight" && sections.length === 1 && sections[0].picks.length === 1;
  const isGeneral = variant === "general" || (!isVersus && !isSpotlight && !sections.length);

  // Katlama: plan oturum sayısına, listeler öğe sayısına göre.
  const canFold = isPlan
    ? sections.length > COLLAPSED_SESSIONS
    : !isVersus && !isSpotlight && !isGeneral && picksTotal > COLLAPSED_PICKS;
  const visible = useMemo(() => {
    if (!canFold || expanded) return sections;
    return isPlan ? sections.slice(0, COLLAPSED_SESSIONS) : foldSections(sections, COLLAPSED_PICKS);
  }, [sections, canFold, expanded, isPlan]);

  const variantLabel = t?.AICineChat?.responseTypes?.[variant] || VARIANT_FALLBACK[variant] || "";
  const sectionLabel = (section) =>
    (section.labelKey && t?.AICineChat?.sections?.[section.labelKey]) || section.label || section.labelKey || "";

  const ctx = { palette, getTmdbUrl, t, language, copy, onOpen: onOpenItem, sectionLabel };
  const showFan = !isVersus && !isSpotlight && !isGeneral;

  let body;
  if (isVersus) body = <ComparisonBody share={share} ctx={ctx} />;
  else if (isSpotlight) body = <SpotlightBody share={share} ctx={ctx} />;
  else if (isGeneral) body = <GeneralBody share={share} ctx={ctx} />;
  else if (isPlan) body = <PlanBody sections={visible} totalSessions={sections.length} ctx={ctx} />;
  else if (variant === "watchlist") body = <WatchlistBody sections={visible} fullSections={sections} ctx={ctx} />;
  else body = <RecommendationsBody sections={visible} ctx={ctx} />;

  return (
    <View style={[styles.wrap, cardWidth ? { width: cardWidth } : null]}>
      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: palette.tile }]}>
          <Ionicons name={VARIANT_ICON[variant] || "sparkles"} size={15} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.kickerLine}>
            <Ionicons name="sparkles" size={9} color={palette.tileInk} />
            <Text allowFontScaling={false} style={[styles.kicker, { color: palette.tileInk }]} numberOfLines={1}>
              CineMatch
            </Text>
          </View>
          {!!variantLabel && (
            <Text style={[styles.title, { color: palette.primary }]} numberOfLines={1}>
              {variantLabel}
            </Text>
          )}
        </View>
        {showFan ? <PosterFan picks={allPicks} getTmdbUrl={getTmdbUrl} palette={palette} /> : null}
      </View>

      {!!share?.question && (
        <View style={[styles.questionLine, { backgroundColor: palette.surface }]}>
          <Ionicons name="chatbubble-outline" size={12} color={palette.muted} style={styles.questionIcon} />
          <Text style={[styles.question, { color: palette.secondary }]} numberOfLines={3}>
            {share.question}
          </Text>
        </View>
      )}

      <View style={styles.body}>{body}</View>

      {canFold && (
        <FoldButton
          expanded={expanded}
          total={isPlan ? sections.length : picksTotal}
          palette={palette}
          onToggle={() => setExpanded((value) => !value)}
        />
      )}

      {/* Öneri / liste / plan: varsa model özeti en sonda */}
      {!isVersus && !isSpotlight && !isGeneral && !!share?.summary && (
        <SummaryBox text={share.summary} palette={palette} icon="bulb-outline" />
      )}
    </View>
  );
}

export default memo(SharedAiMessage);

const styles = StyleSheet.create({
  wrap: { width: "100%", minWidth: 0, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerTile: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kickerLine: { flexDirection: "row", alignItems: "center", gap: 3 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 19, marginTop: 1 },

  fan: { height: 40, marginRight: 4 },
  fanItem: { position: "absolute", top: 2, borderWidth: 1.5, borderRadius: 5, overflow: "hidden" },

  questionLine: { flexDirection: "row", gap: 7, marginTop: 10, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10 },
  questionIcon: { marginTop: 2 },
  question: { flex: 1, fontSize: 12.5, lineHeight: 17, fontStyle: "italic" },

  body: { marginTop: 2 },
  section: { marginTop: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 1, marginTop: 4 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionName: { flex: 1, fontSize: 13, fontWeight: "800" },
  sectionCount: { fontSize: 11, fontWeight: "700" },
  sectionNote: { fontSize: 11.5, lineHeight: 15, fontStyle: "italic", marginTop: 4 },

  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTight: { gap: 9, paddingVertical: 7 },
  rowLast: { borderBottomWidth: 0 },
  poster: { overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  rankBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 10, fontWeight: "900" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  rowTitleSm: { flexShrink: 1, fontSize: 13, fontWeight: "800", lineHeight: 17 },
  must: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 1 },
  mustText: { fontSize: 9, fontWeight: "800" },
  metaLine: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  typeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  rowMeta: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  star: { marginLeft: 8, marginRight: 2 },
  note: { fontSize: 12, lineHeight: 16, marginTop: 5 },
  noteSm: { fontSize: 11.5, lineHeight: 15, marginTop: 3 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },
  chipText: { fontSize: 10, fontWeight: "700", flexShrink: 1 },

  plan: { marginTop: 10 },
  planStep: { flexDirection: "row", gap: 10 },
  planRail: { alignItems: "center", width: 24 },
  planNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  planNumText: { fontSize: 11.5, fontWeight: "900" },
  planLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: 3 },
  planBody: { flex: 1, minWidth: 0, paddingBottom: 12 },
  planLabel: { fontSize: 13.5, fontWeight: "800", lineHeight: 18, marginTop: 2 },
  planRuntime: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  planRuntimeText: { fontSize: 11, fontWeight: "600", flexShrink: 1 },

  strip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  generalStrip: { marginTop: 12 },
  stripItem: { width: STRIP_POSTER_W },
  stripTitle: { fontSize: 10.5, fontWeight: "700", lineHeight: 13, marginTop: 4 },
  stripMeta: { fontSize: 9.5, fontWeight: "600", marginTop: 1 },

  versus: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 12 },
  versusPick: { flex: 1, alignItems: "center" },
  versusRing: { padding: 2, borderRadius: 13, borderWidth: 2 },
  crown: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  versusTitle: { fontSize: 12.5, fontWeight: "800", lineHeight: 16, textAlign: "center", marginTop: 7 },
  versusMeta: { fontSize: 10.5, marginTop: 1, textAlign: "center" },
  vsBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginHorizontal: 2, marginTop: 52 },
  vsText: { fontSize: 11, fontWeight: "900" },

  totalWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  totalNum: { fontSize: 15, fontWeight: "900", minWidth: 22, textAlign: "center" },
  totalBar: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },

  metricBox: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 8 },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stars: { flexDirection: "row", gap: 1 },
  metricLabel: { flex: 1, fontSize: 11, fontWeight: "700", textAlign: "center", paddingHorizontal: 4 },

  pcWrap: { flexDirection: "row", marginTop: 10 },
  pcCol: { flex: 1, gap: 4 },
  pcDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 8 },
  pcRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  pcIcon: { marginTop: 2 },
  pcText: { flex: 1, fontSize: 11.5, lineHeight: 15 },

  banner: { height: 112, borderRadius: 12, overflow: "hidden", marginTop: 10 },
  spotHead: { flexDirection: "row", gap: 11, marginTop: 10 },
  spotHeadRaised: { marginTop: -44, paddingHorizontal: 8 },
  spotPoster: { borderWidth: 2, borderRadius: 12 },
  spotCopy: { flex: 1, minWidth: 0, justifyContent: "flex-end" },
  spotTitle: { fontSize: 16, fontWeight: "900", lineHeight: 20 },
  tagline: { fontSize: 11.5, fontStyle: "italic", lineHeight: 15, marginTop: 2 },
  spotGenres: { marginTop: 8 },
  spotOverview: { marginTop: 10 },
  overviewText: { fontSize: 12.5, lineHeight: 18 },
  spotLine: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 34,
    marginTop: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  detailText: { fontSize: 12.5, fontWeight: "800" },

  summaryTop: { marginTop: 10 },
  summaryPlain: { fontSize: 14, lineHeight: 20 },
  summaryBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryIcon: { marginTop: 1 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryPrefix: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  summaryText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  foldLink: { fontSize: 11.5, fontWeight: "800", marginTop: 4 },

  foldButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 32,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  foldButtonText: { fontSize: 12, fontWeight: "800" },
});

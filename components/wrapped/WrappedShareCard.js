// components/wrapped/WrappedShareCard.js
//
// Seelogd Wrapped — paylaşılabilir özet kartı (captureRef hedefi). TAM 9:16,
// referans tuval 360x640 (3x'te 1080x1920). Saf/statik: animasyon, buton, dokunma
// yok — her yakalamada tam kompozisyon çıkar.
//
// ÖNİZLEME ÖLÇEĞİ: kart HER ZAMAN 360x640 olarak yerleşir; ekran onu
// `transform: scale` ile küçültüp gösterir (screens/wrapped/WrappedScreen.js).
// Yakalama düğümün KENDİ boyutunu alır, üst öğenin dönüşümünü almaz — önizleme
// küçük de olsa çıktı tam boyutlu ve önizlemeyle birebir aynıdır. Bu yüzden iç
// ölçüler piksel sabitidir.
//
// DÖRT DÜZEN (options.layout): showcase (vitrin/bento), posters (poster panosu),
// ticket (sinema bileti), minimal (dev tipografi). Her biri TÜM bölümler açıkken
// ve 2 satır notla da sığacak biçimde ölçüldü (düzen başına bütçe aşağıda); yeni
// bir satır eklemek bütçeyi aşarsa altbilgi kırpılır — eklemeden önce bütçeyi
// güncelle.
//
// GÖRÜNÜM: cam paneller (yarı saydam dolgu + üst ışık + ince kenar), SVG radyal
// ışımalar. Blur KATMANI kullanılmaz (yakalama anında yerel blur boş çıkabilir);
// poster arka planı yalnızca resmin kendi `blurRadius`ıyla bulanıklaştırılır.
// GRADYAN KURALI: soluklaşan her gradyan AYNI rengin alfa=0 hâline iner
// ("transparent" değil) — yerel gradyan renkleri önceden çarpmadan harmanlar ve
// "transparent" ara tonlarda gri bir leke bırakır.
//
// Dışa açılan sözleşme (WrappedScreen + ProfileStoryCard bağımlı):
//   WRAPPED_CARD_THEMES, getWrappedCardPalette, foregroundForPalette
//   props: { recap, str, theme, language, getTmdbUrl, userName, options, pace,
//            onImageSettled }

import React, { memo, useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import AppIcon from "../AppIcon";
import YearHeat from "./YearHeat";
import useAppLogo from "../../hooks/useAppLogo";
import { alpha } from "../../theme/colors";
import { shiftLightness, toHex } from "../../utils/colorUtils";
import { formatNumber, monthName, weekdayName } from "../../utils/wrapped";
import {
  WRAPPED_CARD_H,
  WRAPPED_CARD_W,
  WRAPPED_SHARED_PALETTES,
  buildWrappedCardPosters,
  layoutSupportsModule,
  resolveWrappedPalette,
  sanitizeWrappedCardOptions,
  splitWatchTime,
  wrappedBarcode,
  wrappedSerial,
} from "../../utils/wrappedCard";

// Profil hikâye kartı (ProfileStoryCard) bu üç dışa aktarımı kullanır: ortak
// altı palet + vurgu rengi üstündeki yazı rengi. Kaynak utils/wrappedCard.js.
export const WRAPPED_CARD_THEMES = WRAPPED_SHARED_PALETTES;
export const getWrappedCardPalette = resolveWrappedPalette;
export const foregroundForPalette = (palette) => palette?.onAccent || "#FFFFFF";

/**
 * TMDB yolunu kartın kullandığı görsel adresine çevirir. Kart ve düzenleyici
 * ekran AYNI fonksiyonu kullanır: ekran hangi adreslerin inmesini bekleyeceğini
 * (buildWrappedCardPosters) kartla birebir aynı hesapla bulur.
 */
export const makeWrappedPosterUri = (getTmdbUrl) => (path, kind) =>
  getTmdbUrl ? getTmdbUrl(path, "poster", kind === "backdrop" ? 500 : 300) : null;

const W = WRAPPED_CARD_W;
const H = WRAPPED_CARD_H;
const PAD = 20;
const CW = W - PAD * 2; // içerik genişliği (320)
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const PAPER_INK = "#1B1710";

// ── Renk jetonları ───────────────────────────────────────────────────────────
// Koyu paletlerde yazı beyaz, "Kâğıt" gibi açık paletlerde koyu mürekkep. `tint`
// vurgunun METİN/ikon için ayarlı tonu: "İmza" gibi zemini vurgudan doğan
// temalarda düz vurgu yazısı kayboluyordu.
function makeTokens(palette) {
  const light = palette.tone === "light";
  const ink = light ? PAPER_INK : WHITE;
  const accentHex = toHex(palette.accent);
  return {
    light,
    ink,
    text: ink,
    muted: alpha(ink, light ? 0.64 : 0.66),
    faint: alpha(ink, light ? 0.42 : 0.44),
    glassFill: alpha(ink, light ? 0.05 : 0.07),
    glassStrong: alpha(ink, light ? 0.08 : 0.12),
    sheen: alpha(WHITE, light ? 0.6 : 0.14),
    edge: alpha(ink, light ? 0.11 : 0.15),
    hairline: alpha(ink, light ? 0.14 : 0.12),
    track: alpha(ink, light ? 0.09 : 0.09),
    tint: light ? shiftLightness(accentHex, -8) : shiftLightness(accentHex, 18),
  };
}

const CardText = ({ style, ...rest }) => (
  <Text allowFontScaling={false} {...rest} style={style} />
);

// ── Zemin ────────────────────────────────────────────────────────────────────

function Background({ ctx, bgUri, onImageSettled }) {
  const { palette, t, options } = ctx;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { accent } = palette;
  const secondary = palette.secondary || accent;
  const mode = options.background;
  const clean = mode === "clean";
  const poster = mode === "poster" && bgUri;
  const glowK = t.light ? 0.62 : 1; // açık zeminde ışımalar daha ince

  return (
    <>
      <LinearGradient
        colors={clean ? [palette.colors[0], palette.colors[2], palette.colors[3]] : palette.colors}
        locations={clean ? [0, 0.55, 1] : [0, 0.4, 0.74, 1]}
        start={{ x: 0.1, y: -0.05 }}
        end={{ x: 0.9, y: 1.05 }}
        style={StyleSheet.absoluteFill}
      />

      {poster ? (
        <>
          <Image
            source={{ uri: bgUri }}
            blurRadius={26}
            contentFit="cover"
            transition={0}
            style={styles.bgPoster}
            onLoad={() => onImageSettled?.(bgUri)}
            onError={() => onImageSettled?.(bgUri)}
          />
          {/* Posteri paletin tonuna boyayan örtü: yazılar her posterde okunur. */}
          <LinearGradient
            colors={
              t.light
                ? [alpha(palette.colors[0], 0.78), alpha(palette.colors[1], 0.9), alpha(palette.colors[2], 0.96)]
                : [alpha(palette.colors[1], 0.55), alpha(palette.colors[2], 0.86), alpha(palette.colors[3], 0.97)]
            }
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}

      {!clean && (
        // Düz daireler yerine radyal ışımalar: kenarsız, "mesh gradient" dokusu.
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`a${uid}`} cx={W * 0.95} cy={H * 0.02} r={330} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={accent} stopOpacity={0.5 * glowK} />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`b${uid}`} cx={0} cy={H * 0.5} r={300} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={secondary} stopOpacity={0.32 * glowK} />
              <Stop offset="1" stopColor={secondary} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`c${uid}`} cx={W} cy={H} r={320} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={accent} stopOpacity={0.26 * glowK} />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={W} height={H} fill={`url(#a${uid})`} />
          <Rect x="0" y="0" width={W} height={H} fill={`url(#b${uid})`} />
          <Rect x="0" y="0" width={W} height={H} fill={`url(#c${uid})`} />
        </Svg>
      )}

      <LinearGradient
        colors={[alpha(WHITE, t.light ? 0.5 : clean ? 0.07 : 0.1), alpha(WHITE, 0)]}
        style={[styles.topSheen, { height: 200 }]}
      />
      <LinearGradient
        colors={[alpha(t.light ? PAPER_INK : BLACK, 0), alpha(t.light ? PAPER_INK : BLACK, t.light ? 0.1 : 0.6)]}
        style={[styles.bottomVignette, { height: 260 }]}
      />
    </>
  );
}

// ── Ortak parçalar ───────────────────────────────────────────────────────────

// Bölümler arası esnek boşluk: en az 8px; kart boşsa (not yok, bölüm kapalı)
// artan alan bölümler arasına eşit dağılır (her aralık en çok 22px), kalanı
// alttaki poster/altbilgi öbeğini aşağı iter. Dolu kartta (tüm bölümler + 2
// satır not) boşluk 8px'te kalır — yerleşim bütçesi bu minimuma göre ölçülü.
const Gap = () => <View style={styles.gap} />;

// Çocukları arasına Gap koyar. null/false çocuklar atlanır; "render ettiği şey
// null olan" bir bileşen ÇAĞRI YERİNDE koşullanmalı (yoksa çift boşluk çıkar).
function Stack({ children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return items.map((child, i) => (
    <React.Fragment key={child.key ?? i}>
      {i > 0 ? <Gap /> : null}
      {child}
    </React.Fragment>
  ));
}

// Cam panel: yarı saydam dolgu + sol-üstten gelen ışık + ince kenar.
function Glass({ t, children, style, radius = 16, strong = false }) {
  return (
    <View
      style={[
        styles.glass,
        {
          borderRadius: radius,
          borderColor: t.edge,
          backgroundColor: strong ? t.glassStrong : t.glassFill,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[t.sheen, alpha(WHITE, 0)]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function Brand({ ctx, size = 34 }) {
  const { palette, t, logo, str } = ctx;
  const secondary = palette.secondary || palette.accent;
  return (
    <View style={styles.brandLockup}>
      <LinearGradient
        colors={[alpha(palette.accent, 0.95), alpha(secondary, 0.85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.logoTile, { width: size, height: size, borderRadius: Math.round(size * 0.34) }]}
      >
        <Image source={logo} style={{ width: size * 0.84, height: size * 0.84 }} contentFit="contain" />
      </LinearGradient>
      <View>
        <CardText style={[styles.brand, { color: t.text }]}>SEELOGD</CardText>
        <CardText style={[styles.brandSub, { color: t.tint }]}>{str.cardWrapped}</CardText>
      </View>
    </View>
  );
}

function YearPill({ ctx }) {
  const { palette, t, recap } = ctx;
  return (
    <View
      style={[
        styles.yearPill,
        { borderColor: alpha(palette.accent, 0.5), backgroundColor: alpha(palette.accent, 0.14) },
      ]}
    >
      <View style={[styles.liveDot, { backgroundColor: palette.accent }]} />
      <CardText style={[styles.yearText, { color: t.text }]}>{recap.year}</CardText>
    </View>
  );
}

function Header({ ctx }) {
  return (
    <View style={styles.header}>
      <Brand ctx={ctx} />
      <YearPill ctx={ctx} />
    </View>
  );
}

function Footer({ ctx, style }) {
  const { logo, t, palette, displayName, recap, str } = ctx;
  return (
    <View style={[styles.footer, { borderTopColor: t.hairline }, style]}>
      <View style={styles.footerBrand}>
        <Image source={logo} style={{ width: 18, height: 18 }} contentFit="contain" />
        <CardText style={[styles.footerBrandText, { color: t.text }]}>Seelogd</CardText>
      </View>
      <View style={[styles.footerPill, { borderColor: alpha(palette.accent, 0.45) }]}>
        {displayName ? (
          <>
            <AppIcon family="Ionicons" name="person" size={10} color={t.tint} />
            <CardText numberOfLines={1} style={[styles.footerMeta, { color: t.text, maxWidth: 150 }]}>
              {displayName}
            </CardText>
          </>
        ) : (
          <CardText style={[styles.footerMeta, { color: t.muted }]}>
            {recap.year} · {str.cardWrapped}
          </CardText>
        )}
      </View>
    </View>
  );
}

function Caption({ ctx, style }) {
  const { t, palette, options } = ctx;
  if (!options.caption) return null;
  return (
    <Glass t={t} radius={14} style={[styles.caption, style]}>
      <View style={[styles.captionBar, { backgroundColor: palette.accent }]} />
      <CardText numberOfLines={2} style={[styles.captionText, { color: t.text }]}>
        {options.caption}
      </CardText>
    </Glass>
  );
}

function SectionHead({ ctx, title, right }) {
  const { t, palette } = ctx;
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionTick, { backgroundColor: palette.accent }]} />
        <CardText numberOfLines={1} style={[styles.sectionLabel, { color: t.muted }]}>
          {title}
        </CardText>
      </View>
      {right ? (
        <View style={[styles.sectionPill, { borderColor: alpha(palette.accent, 0.4) }]}>
          <CardText numberOfLines={1} style={[styles.sectionPillText, { color: t.tint }]}>
            {right}
          </CardText>
        </View>
      ) : null}
    </View>
  );
}

// Kişilik satırı: emoji karosu + başlık.
function Identity({ ctx, style }) {
  const { recap, str, t, palette } = ctx;
  const secondary = palette.secondary || palette.accent;
  if (!recap.personality) return null;
  return (
    <Glass t={t} radius={18} style={[styles.identity, style]}>
      <LinearGradient
        colors={[alpha(palette.accent, 0.34), alpha(secondary, 0.2)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.emojiTile, { borderColor: t.edge }]}
      >
        <CardText style={styles.emoji}>{recap.personality.emoji}</CardText>
      </LinearGradient>
      <View style={styles.identityCopy}>
        <CardText numberOfLines={1} style={[styles.eyebrow, { color: t.tint }]}>
          {str.cardPersonality}
        </CardText>
        <CardText numberOfLines={1} style={[styles.identityTitle, { color: t.text }]}>
          {recap.personality.title}
        </CardText>
      </View>
      <View style={[styles.identityArrow, { backgroundColor: alpha(palette.accent, 0.16) }]}>
        <AppIcon family="MaterialCommunityIcons" name="star-four-points" size={13} color={t.tint} />
      </View>
    </Glass>
  );
}

// Geçen yıla göre değişim rozeti (kıyas yoksa hiç çizilmez).
function PaceChip({ ctx }) {
  const { pace, str, t } = ctx;
  if (!pace || pace.deltaPct == null || Math.abs(pace.deltaPct) < 1) return null;
  const up = pace.deltaPct > 0;
  const tone = up ? "#34D399" : "#FB7185";
  const key = up ? "paceUpShort" : "paceDownShort";
  return (
    <View style={[styles.paceChip, { backgroundColor: alpha(tone, 0.16), borderColor: alpha(tone, 0.5) }]}>
      <AppIcon family="Ionicons" name={up ? "trending-up" : "trending-down"} size={11} color={tone} />
      <CardText numberOfLines={1} style={[styles.paceText, { color: t.light ? shiftLightness(toHex(tone), -18) : tone }]}>
        {str[key].replace("{n}", String(Math.abs(pace.deltaPct)))}
      </CardText>
    </View>
  );
}

// Toplam süre: etiket + dev sayı + birim + "≈ saat · gün" satırı.
function HeroNumber({ ctx, size = 56, unitBelow = false, showPace = true }) {
  const { recap, str, language, t, palette } = ctx;
  const { hours, days, remHours } = splitWatchTime(recap.totalMinutes);
  const natural =
    days > 0
      ? `≈ ${formatNumber(hours, language)} ${str.hours} · ${formatNumber(days, language)} ${str.days}${remHours ? ` ${formatNumber(remHours, language)} ${str.hoursShort}` : ""}`
      : `≈ ${formatNumber(hours, language)} ${str.hours}`;
  return (
    <View>
      <CardText numberOfLines={1} style={[styles.eyebrow, { color: t.muted }]}>
        {str.cardTotal}
      </CardText>
      <View style={[styles.heroRow, { marginTop: 2 }]}>
        <View style={{ flexShrink: 1 }}>
          <CardText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[
              styles.heroNumber,
              { color: t.text, fontSize: size, lineHeight: Math.round(size * 1.04), letterSpacing: -size * 0.05 },
            ]}
          >
            {formatNumber(recap.totalMinutes, language)}
          </CardText>
        </View>
        {!unitBelow && (
          <View
            style={[
              styles.heroUnit,
              { backgroundColor: alpha(palette.accent, 0.2), borderColor: alpha(palette.accent, 0.45), marginBottom: Math.round(size * 0.14) },
            ]}
          >
            <AppIcon family="MaterialCommunityIcons" name="clock-outline" size={11} color={t.tint} />
            <CardText style={[styles.heroUnitText, { color: t.tint }]}>{str.summaryMinutes}</CardText>
          </View>
        )}
      </View>
      <View style={styles.heroSubRow}>
        <CardText numberOfLines={1} style={[styles.heroSub, { color: t.muted, flexShrink: 1 }]}>
          {unitBelow ? `${str.minutes} · ${natural}` : natural}
        </CardText>
        {showPace ? <PaceChip ctx={ctx} /> : null}
      </View>
    </View>
  );
}

function StatTile({ ctx, icon, value, label }) {
  const { t, palette } = ctx;
  return (
    <Glass t={t} radius={16} style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: alpha(palette.accent, 0.2) }]}>
        <AppIcon family="MaterialCommunityIcons" name={icon} size={12} color={t.tint} />
      </View>
      <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.statValue, { color: t.text }]}>
        {value}
      </CardText>
      <CardText numberOfLines={1} style={[styles.statLabel, { color: t.muted }]}>
        {label}
      </CardText>
    </Glass>
  );
}

function StatsRow({ ctx, style }) {
  const { recap, str, language } = ctx;
  return (
    <View style={[styles.statsRow, style]}>
      <StatTile ctx={ctx} icon="movie-open-outline" value={formatNumber(recap.totalMovies, language)} label={str.summaryMovies} />
      <StatTile ctx={ctx} icon="play-box-multiple-outline" value={formatNumber(recap.totalEpisodes, language)} label={str.summaryEpisodes} />
      <StatTile ctx={ctx} icon="television-classic" value={formatNumber(recap.totalShows, language)} label={str.summaryShows} />
    </View>
  );
}

function GenreChip({ ctx, label, top }) {
  const { palette, t } = ctx;
  const secondary = palette.secondary || palette.accent;
  if (top) {
    return (
      <LinearGradient
        colors={[palette.accent, secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.genreChip, styles.genreChipTop]}
      >
        <AppIcon family="MaterialCommunityIcons" name="star" size={9} color={palette.onAccent} />
        <CardText numberOfLines={1} style={[styles.genreText, { color: palette.onAccent, flexShrink: 1 }]}>
          {label}
        </CardText>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.genreChip, { borderColor: t.edge, backgroundColor: t.glassFill }]}>
      <CardText numberOfLines={1} style={[styles.genreText, { color: t.text, flexShrink: 1 }]}>
        {label}
      </CardText>
    </View>
  );
}

function GenresRow({ ctx, style, max = 3, withHead = true }) {
  const { recap, str } = ctx;
  const genres = (recap.topGenres || []).slice(0, max);
  if (!genres.length) return null;
  return (
    <View style={style}>
      {withHead ? <SectionHead ctx={ctx} title={str.cardGenres} right={`TOP ${genres.length}`} /> : null}
      <View style={[styles.genreRow, withHead && { marginTop: 7 }]}>
        {genres.map((g, i) => (
          <GenreChip key={`${g.genre}-${i}`} ctx={ctx} label={g.genre} top={i === 0} />
        ))}
      </View>
    </View>
  );
}

function HeatStrip({ ctx, style, width = CW }) {
  const { recap, str, language, palette, t } = ctx;
  if (!Array.isArray(recap.dayHeat) || !recap.activeDays) return null;
  return (
    <View style={style}>
      <SectionHead
        ctx={ctx}
        title={str.cardActivity}
        right={`${formatNumber(recap.activeDays, language)} ${str.cardActiveDays}`}
      />
      <View style={{ marginTop: 6 }}>
        <YearHeat
          year={recap.year}
          dayHeat={recap.dayHeat}
          width={width}
          color={palette.accent}
          trackColor={t.track}
        />
      </View>
    </View>
  );
}

// Poster: dikey 2:3 karo + sıra rozeti. `highlight` birinciyi vurgular.
function PosterThumb({ ctx, item, w, h, radius = 11, rank, highlight, onSettled }) {
  const { palette, t } = ctx;
  return (
    <View
      style={[
        { width: w, height: h },
        highlight && {
          shadowColor: palette.accent,
          shadowOpacity: 0.55,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
      ]}
    >
      <View
        style={[
          styles.posterFrame,
          {
            borderRadius: radius,
            borderColor: highlight ? palette.accent : t.edge,
            borderWidth: highlight ? 2 : 1,
            backgroundColor: t.glassFill,
          },
        ]}
      >
        {item.uri ? (
          <Image
            source={{ uri: item.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
            onLoad={() => onSettled?.(item.uri)}
            onError={() => onSettled?.(item.uri)}
          />
        ) : (
          <View style={styles.posterEmpty}>
            <AppIcon family="MaterialCommunityIcons" name="movie-open-outline" size={Math.min(w, h) * 0.34} color={t.faint} />
          </View>
        )}
        <LinearGradient colors={[alpha(BLACK, 0), alpha(BLACK, 0.55)]} style={styles.posterFade} />
        {rank ? (
          <View
            style={[
              styles.rankChip,
              { backgroundColor: highlight ? palette.accent : alpha(BLACK, 0.62) },
            ]}
          >
            <CardText style={[styles.rankChipText, { color: highlight ? palette.onAccent : WHITE }]}>
              {rank}
            </CardText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Düzen 1: Vitrin ──────────────────────────────────────────────────────────
// Bütçe (dikey, px): başlık 38 · kimlik 54 · toplam süre 92 · sayı karoları 62 ·
// türler 46 · ısı haritası 62 · posterler 110 · altbilgi 28 + aralar 10×6 = 552;
// 600 içerik alanından 48 pay kalır → 2 satırlık not (≤ 45) da sığar.

function ShowcasePosters({ ctx }) {
  const { posters, str, language, t, palette, onImageSettled } = ctx;
  if (!posters.items.length) return null;
  const lead = posters.items[0];
  const isMovies = posters.source === "movies";
  const meta = isMovies
    ? `${formatNumber(Math.round((lead.minutes || 0) / 60), language)} ${str.hoursShort}`
    : `${formatNumber(lead.count || 0, language)} ${str.episodesShort}`;
  return (
    <View>
      <SectionHead ctx={ctx} title={isMovies ? str.cardTopMovies : str.cardTopShows} right={`TOP ${posters.items.length}`} />
      <View style={styles.showcasePosterRow}>
        <View style={styles.posterFan}>
          {posters.items.map((item, i) => (
            <View key={item.key} style={{ marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }}>
              <PosterThumb
                ctx={ctx}
                item={item}
                w={i === 0 ? 60 : 54}
                h={i === 0 ? 90 : 81}
                rank={i + 1}
                highlight={i === 0}
                onSettled={onImageSettled}
              />
            </View>
          ))}
        </View>
        <View style={styles.posterCopy}>
          <CardText numberOfLines={1} style={[styles.eyebrow, { color: t.tint }]}>
            #1
          </CardText>
          <CardText numberOfLines={2} style={[styles.posterLead, { color: t.text }]}>
            {lead.name}
          </CardText>
          <View style={[styles.metaPill, { backgroundColor: alpha(palette.accent, 0.18), borderColor: alpha(palette.accent, 0.45) }]}>
            <CardText numberOfLines={1} style={[styles.metaPillText, { color: t.tint }]}>
              {meta}
            </CardText>
          </View>
        </View>
      </View>
    </View>
  );
}

function ShowcaseLayout({ ctx }) {
  const { options, recap, posters } = ctx;
  return (
    <View style={styles.layoutPad}>
      <Stack>
        <Header ctx={ctx} />
        {options.caption ? <Caption ctx={ctx} /> : null}
        {options.showPersonality ? <Identity ctx={ctx} /> : null}
        <HeroNumber ctx={ctx} size={50} />
        {options.showStats ? <StatsRow ctx={ctx} /> : null}
        {options.showGenres ? <GenresRow ctx={ctx} /> : null}
        {options.showActivity && recap.dayHeat ? <HeatStrip ctx={ctx} /> : null}
      </Stack>
      <View testID="card-spacer" style={styles.flexSpacer} />
      <Stack>
        {options.showPosters && posters.items.length ? <ShowcasePosters ctx={ctx} /> : null}
        <Footer ctx={ctx} />
      </Stack>
    </View>
  );
}

// ── Düzen 2: Poster panosu ───────────────────────────────────────────────────
// Bütçe: başlık 38 · pano 225 · kimlik 46 · toplam süre 80 · yatay sayılar 34 ·
// türler 28 · altbilgi 28 + aralar = 543; not için 57 pay.

function PosterWall({ ctx }) {
  const { posters, palette, t, recap, onImageSettled } = ctx;
  if (!posters.items.length) {
    // Poster kapalı/yoksa: dev emoji + hale — kart yine dolu görünür.
    return (
      <View style={styles.wallEmpty}>
        <View style={[styles.wallHalo, { backgroundColor: alpha(palette.accent, 0.18), borderColor: alpha(palette.accent, 0.4) }]} />
        <View style={[styles.wallHalo2, { borderColor: alpha(palette.accent, 0.22) }]} />
        <CardText style={styles.wallEmoji}>{recap.personality?.emoji || "🍿"}</CardText>
      </View>
    );
  }
  const [lead, ...rest] = posters.items;
  return (
    <View style={styles.wall}>
      <PosterThumb ctx={ctx} item={lead} w={150} h={210} radius={16} rank={1} highlight onSettled={onImageSettled} />
      <View style={styles.wallGrid}>
        {rest.slice(0, 4).map((item, i) => (
          <PosterThumb key={item.key} ctx={ctx} item={item} w={72} h={100} radius={12} rank={i + 2} onSettled={onImageSettled} />
        ))}
        {/* Eksik yuvalar süs olarak boş cam karolarla dolar. */}
        {Array.from({ length: Math.max(0, 4 - rest.length) }).map((_, i) => (
          <View key={`ph${i}`} style={[styles.wallPh, { borderColor: t.edge, backgroundColor: t.glassFill }]} />
        ))}
      </View>
    </View>
  );
}

function InlineStats({ ctx, style }) {
  const { recap, str, language, t, palette } = ctx;
  const items = [
    { icon: "movie-open-outline", value: recap.totalMovies, label: str.summaryMovies },
    { icon: "play-box-multiple-outline", value: recap.totalEpisodes, label: str.summaryEpisodes },
    { icon: "television-classic", value: recap.totalShows, label: str.summaryShows },
  ];
  return (
    <Glass t={t} radius={16} style={[styles.inlineStats, style]}>
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View style={[styles.inlineDivider, { backgroundColor: t.hairline }]} /> : null}
          <View style={styles.inlineCell}>
            <AppIcon family="MaterialCommunityIcons" name={it.icon} size={13} color={t.tint} />
            <CardText numberOfLines={1} style={[styles.inlineValue, { color: t.text }]}>
              {formatNumber(it.value, language)}
            </CardText>
            <CardText numberOfLines={1} style={[styles.inlineLabel, { color: t.muted }]}>
              {it.label}
            </CardText>
          </View>
        </React.Fragment>
      ))}
    </Glass>
  );
}

function PostersLayout({ ctx }) {
  const { options } = ctx;
  return (
    <View style={styles.layoutPad}>
      <Stack>
        <Header ctx={ctx} />
        {options.caption ? <Caption ctx={ctx} /> : null}
        <PosterWall ctx={ctx} />
        {options.showPersonality ? <Identity ctx={ctx} style={{ height: 44 }} /> : null}
        <HeroNumber ctx={ctx} size={46} />
        {options.showStats ? <InlineStats ctx={ctx} /> : null}
        {options.showGenres ? <GenresRow ctx={ctx} withHead={false} /> : null}
      </Stack>
      <View testID="card-spacer" style={styles.flexSpacer} />
      <Footer ctx={ctx} />
    </View>
  );
}

// ── Düzen 3: Bilet ───────────────────────────────────────────────────────────
// Bilet 324x604 (kenar boşluğu 18/18): ana kısım 458, delik çizgisi, koçan 146.

const TK = { x: 18, y: 18, w: 324, h: 604, main: 458, notch: 12, corner: 22 };

function ticketPath({ w, h, main, notch, corner }) {
  const r = corner;
  const n = notch;
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${main - n}`,
    `A ${n} ${n} 0 0 0 ${w} ${main + n}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${main + n}`,
    `A ${n} ${n} 0 0 0 0 ${main - n}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

function TicketLayout({ ctx }) {
  const { recap, str, language, palette, t, options, posters, displayName, onImageSettled } = ctx;
  // Bilet kâğıdı: koyu paletlerde sıcak beyaz, "Kâğıt" paletinde saf beyaz.
  const paper = t.light ? "#FFFFFF" : "#FBF6EA";
  const ink = PAPER_INK;
  const inkMuted = alpha(ink, 0.62);
  const inkHair = alpha(ink, 0.16);
  const accentInk = shiftLightness(toHex(palette.accent), t.light ? -8 : -14);
  const secondary = palette.secondary || palette.accent;
  const { hours, days, remHours } = splitWatchTime(recap.totalMinutes);
  const bars = wrappedBarcode(recap, 34);
  const serial = wrappedSerial(recap);
  const genres = (recap.topGenres || []).slice(0, 3);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Bilet gövdesi: gerçek oyuk (notch) için SVG yolu — arkaplan görünür kalır. */}
      <View style={{ position: "absolute", left: TK.x, top: TK.y, width: TK.w, height: TK.h }}>
        <Svg width={TK.w} height={TK.h}>
          <Path d={ticketPath(TK)} fill={paper} />
          <Line
            x1={TK.notch + 6}
            y1={TK.main}
            x2={TK.w - TK.notch - 6}
            y2={TK.main}
            stroke={alpha(ink, 0.3)}
            strokeWidth={1.4}
            strokeDasharray="5 5"
          />
        </Svg>

        {/* Üst şerit renkli bant */}
        <LinearGradient
          colors={[palette.accent, secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ticketBand}
        />

        {/* ── Ana kısım ── */}
        <View style={[styles.ticketMain, { height: TK.main }]}>
          <View>
          <View style={styles.ticketTopRow}>
            <View style={styles.ticketBrand}>
              <LinearGradient
                colors={[palette.accent, secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ticketLogo}
              >
                <Image source={ctx.logo} style={{ width: 22, height: 22 }} contentFit="contain" />
              </LinearGradient>
              <View>
                <CardText style={[styles.ticketBrandText, { color: ink }]}>{str.ticketBrand}</CardText>
                <CardText style={[styles.ticketBrandSub, { color: accentInk }]}>{str.cardWrapped}</CardText>
              </View>
            </View>
            <View style={[styles.admit, { borderColor: alpha(ink, 0.5) }]}>
              <CardText style={[styles.admitText, { color: ink }]}>{str.ticketAdmit}</CardText>
            </View>
          </View>

          <View style={[styles.ticketRule, { backgroundColor: inkHair }]} />
          </View>

          <View>
            <CardText style={[styles.ticketEyebrow, { color: accentInk }]}>{str.ticketNowShowing}</CardText>
            <CardText style={[styles.ticketYear, { color: ink }]}>{recap.year}</CardText>
          </View>

          {options.showPersonality && recap.personality ? (
            <View style={[styles.ticketIdentity, { backgroundColor: alpha(palette.accent, 0.12), borderColor: alpha(palette.accent, 0.3) }]}>
              <CardText style={styles.ticketEmoji}>{recap.personality.emoji}</CardText>
              <View style={{ flex: 1 }}>
                <CardText numberOfLines={1} style={[styles.ticketIdEyebrow, { color: inkMuted }]}>
                  {str.cardPersonality}
                </CardText>
                <CardText numberOfLines={1} style={[styles.ticketIdTitle, { color: ink }]}>
                  {recap.personality.title}
                </CardText>
              </View>
            </View>
          ) : null}

          <View style={styles.ticketHero}>
            <CardText numberOfLines={1} style={[styles.ticketEyebrowSm, { color: inkMuted }]}>
              {str.cardTotal}
            </CardText>
            <View style={styles.ticketHeroRow}>
              <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[styles.ticketHeroNumber, { color: ink }]}>
                {formatNumber(recap.totalMinutes, language)}
              </CardText>
              <CardText style={[styles.ticketHeroUnit, { color: accentInk }]}>{str.minutes}</CardText>
            </View>
            <CardText numberOfLines={1} style={[styles.ticketHeroSub, { color: inkMuted }]}>
              {days > 0
                ? `≈ ${formatNumber(days, language)} ${str.days}${remHours ? ` ${formatNumber(remHours, language)} ${str.hoursShort}` : ""} · ${formatNumber(hours, language)} ${str.hours}`
                : `≈ ${formatNumber(hours, language)} ${str.hours}`}
            </CardText>
          </View>

          {options.showStats ? (
            <View style={[styles.ticketStats, { borderColor: inkHair }]}>
              {[
                [recap.totalMovies, str.summaryMovies],
                [recap.totalEpisodes, str.summaryEpisodes],
                [recap.totalShows, str.summaryShows],
              ].map(([value, label], i) => (
                <View key={label} style={[styles.ticketStat, i > 0 && { borderLeftWidth: 1, borderLeftColor: inkHair }]}>
                  <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.ticketStatValue, { color: ink }]}>
                    {formatNumber(value, language)}
                  </CardText>
                  <CardText numberOfLines={1} style={[styles.ticketStatLabel, { color: inkMuted }]}>
                    {label}
                  </CardText>
                </View>
              ))}
            </View>
          ) : null}

          {options.showGenres && genres.length ? (
            <View style={styles.ticketGenres}>
              {genres.map((g, i) => (
                <View
                  key={`${g.genre}-${i}`}
                  style={[
                    styles.ticketChip,
                    i === 0
                      ? { backgroundColor: ink, borderColor: ink }
                      : { backgroundColor: "transparent", borderColor: alpha(ink, 0.3) },
                  ]}
                >
                  <CardText numberOfLines={1} style={[styles.ticketChipText, { color: i === 0 ? paper : ink }]}>
                    {g.genre}
                  </CardText>
                </View>
              ))}
            </View>
          ) : null}

          {options.caption ? (
            <View style={[styles.ticketCaption, { borderLeftColor: palette.accent }]}>
              <CardText numberOfLines={2} style={[styles.ticketCaptionText, { color: ink }]}>
                {options.caption}
              </CardText>
            </View>
          ) : null}
        </View>

        {/* ── Koçan ── */}
        <View style={[styles.ticketStub, { top: TK.main, height: TK.h - TK.main }]}>
          <View style={styles.stubRow}>
            <View style={{ flex: 1 }}>
              <CardText style={[styles.stubLabel, { color: inkMuted }]}>{str.ticketNo}</CardText>
              <CardText style={[styles.stubSerial, { color: ink }]}>{serial}</CardText>
              <Svg width={150} height={38} style={{ marginTop: 6 }}>
                {(() => {
                  let x = 0;
                  return bars.map((bar, i) => {
                    const rect = <Rect key={i} x={x} y={0} width={bar} height={38} fill={ink} />;
                    x += bar + 1.6;
                    return rect;
                  });
                })()}
              </Svg>
            </View>
            {options.showPosters && posters.items.length ? (
              <View style={styles.stubPosters}>
                {posters.items.slice(0, 3).map((item, i) => (
                  <PosterThumb
                    key={item.key}
                    ctx={{ ...ctx, t: { ...t, edge: alpha(ink, 0.18), glassFill: alpha(ink, 0.06), faint: alpha(ink, 0.4) } }}
                    item={item}
                    w={40}
                    h={60}
                    radius={7}
                    rank={i + 1}
                    highlight={i === 0}
                    onSettled={onImageSettled}
                  />
                ))}
              </View>
            ) : null}
          </View>
          <View style={[styles.stubFoot, { borderTopColor: inkHair }]}>
            <CardText numberOfLines={1} style={[styles.stubHolder, { color: inkMuted }]}>
              {displayName ? `${str.ticketHolder} · ${displayName}` : `${recap.year} · ${str.cardWrapped}`}
            </CardText>
            <CardText style={[styles.stubBrand, { color: ink }]}>seelogd</CardText>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Düzen 4: Minimal ─────────────────────────────────────────────────────────
// Bütçe: başlık 38 · dev sayı 128 · kişilik 52 · üç satır 3×32 · türler 30 ·
// ısı haritası 62 · posterler 78 · altbilgi 28 + aralar = 560; not için 40 pay.

function MinimalRow({ ctx, label, value, last }) {
  const { t, language } = ctx;
  return (
    <View style={[styles.minRow, { borderTopColor: t.hairline }, last && { borderBottomWidth: 1, borderBottomColor: t.hairline }]}>
      <CardText numberOfLines={1} style={[styles.minRowLabel, { color: t.muted }]}>
        {label}
      </CardText>
      <CardText numberOfLines={1} style={[styles.minRowValue, { color: t.text }]}>
        {formatNumber(value, language)}
      </CardText>
    </View>
  );
}

function MinimalLayout({ ctx }) {
  const { recap, str, t, palette, options, posters, onImageSettled } = ctx;
  const genres = (recap.topGenres || []).slice(0, 3);
  return (
    <View style={styles.layoutPad}>
      <Stack>
        <Header ctx={ctx} />
        {options.caption ? <Caption ctx={ctx} /> : null}
        <HeroNumber ctx={ctx} size={80} unitBelow />

        {options.showPersonality && recap.personality ? (
          <View style={styles.minIdentity}>
            <CardText style={styles.minEmoji}>{recap.personality.emoji}</CardText>
            <View style={{ flex: 1 }}>
              <CardText numberOfLines={1} style={[styles.eyebrow, { color: t.tint }]}>
                {str.cardPersonality}
              </CardText>
              <CardText numberOfLines={1} style={[styles.minIdentityTitle, { color: t.text }]}>
                {recap.personality.title}
              </CardText>
            </View>
          </View>
        ) : null}

        {options.showStats ? (
          <View>
            <MinimalRow ctx={ctx} label={str.summaryMovies} value={recap.totalMovies} />
            <MinimalRow ctx={ctx} label={str.summaryEpisodes} value={recap.totalEpisodes} />
            <MinimalRow ctx={ctx} label={str.summaryShows} value={recap.totalShows} last />
          </View>
        ) : null}

        {options.showGenres && genres.length ? (
          <View style={styles.minGenres}>
            {genres.map((g, i) => (
              <React.Fragment key={`${g.genre}-${i}`}>
                {i > 0 ? <View style={[styles.minDot, { backgroundColor: palette.accent }]} /> : null}
                <CardText
                  numberOfLines={1}
                  style={[styles.minGenre, { color: i === 0 ? t.text : t.muted, flexShrink: 1 }]}
                >
                  {g.genre}
                </CardText>
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {options.showActivity && recap.dayHeat ? <HeatStrip ctx={ctx} /> : null}
      </Stack>
      <View testID="card-spacer" style={styles.flexSpacer} />

      <Stack>
        {options.showPosters && posters.items.length ? (
          <View style={styles.minPosters}>
            {posters.items.slice(0, 4).map((item, i) => (
              <PosterThumb
                key={item.key}
                ctx={ctx}
                item={item}
                w={57}
                h={80}
                radius={10}
                rank={i + 1}
                highlight={i === 0}
                onSettled={onImageSettled}
              />
            ))}
          </View>
        ) : null}
        <Footer ctx={ctx} />
      </Stack>
    </View>
  );
}

const LAYOUTS = {
  showcase: ShowcaseLayout,
  posters: PostersLayout,
  ticket: TicketLayout,
  minimal: MinimalLayout,
};

// ── Kart ─────────────────────────────────────────────────────────────────────

const WrappedShareCard = memo(function WrappedShareCard({
  recap,
  str,
  theme,
  language = "tr",
  getTmdbUrl,
  userName,
  options: rawOptions,
  pace,
  onImageSettled,
}) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo } = useAppLogo();
  if (!recap) return null;

  const options = sanitizeWrappedCardOptions(rawOptions);
  const palette = resolveWrappedPalette(options.themeId, theme?.accent || "#7C3AED");
  const t = makeTokens(palette);
  const posters = buildWrappedCardPosters(recap, options, makeWrappedPosterUri(getTmdbUrl));
  const displayName = options.showName ? (userName || "").trim() : "";

  const ctx = {
    recap,
    str,
    language,
    palette,
    t,
    logo,
    options,
    posters,
    displayName,
    pace,
    onImageSettled,
  };
  const Layout = LAYOUTS[options.layout] || ShowcaseLayout;

  return (
    <View style={[styles.root, { width: W, height: H, backgroundColor: palette.colors[3] }]}>
      <Background ctx={ctx} bgUri={posters.bgUri} onImageSettled={onImageSettled} />
      {options.layout !== "ticket" && (
        // İnce iç çerçeve: kartı "basılı" gösterir.
        <View
          pointerEvents="none"
          style={[styles.innerBorder, { borderColor: t.light ? alpha(PAPER_INK, 0.12) : alpha(WHITE, 0.12) }]}
        />
      )}
      <Layout ctx={ctx} />
    </View>
  );
});

export default WrappedShareCard;

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomVignette: { position: "absolute", bottom: 0, left: 0, right: 0 },
  innerBorder: { position: "absolute", top: 10, left: 10, right: 10, bottom: 10, borderRadius: 26, borderWidth: 1 },
  bgPoster: {
    position: "absolute",
    top: -60,
    left: -60,
    width: W + 120,
    height: H + 120,
  },

  layoutPad: { flex: 1, paddingHorizontal: PAD, paddingTop: PAD, paddingBottom: PAD },
  flexSpacer: { flex: 1, minHeight: 6 },
  gap: { flexGrow: 1, flexShrink: 0, flexBasis: 8, maxHeight: 22 },

  glass: { overflow: "hidden", borderWidth: 1 },

  // Başlık
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 36 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoTile: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  brand: { fontSize: 13, lineHeight: 15, fontWeight: "900", letterSpacing: 1.5 },
  brandSub: { fontSize: 8.5, lineHeight: 11, fontWeight: "800", letterSpacing: 1.3, marginTop: 1 },
  yearPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  yearText: { fontSize: 12, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3 },

  // Altbilgi
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, height: 26, paddingTop: 6 },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerBrandText: { fontSize: 10.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3 },
  footerPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, height: 20 },
  footerMeta: { fontSize: 8.5, lineHeight: 11, fontWeight: "800", letterSpacing: 0.7 },

  // Not
  caption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingRight: 12, minHeight: 32 },
  captionBar: { width: 3, alignSelf: "stretch", borderRadius: 2, marginLeft: 10 },
  captionText: { flex: 1, fontSize: 12.5, lineHeight: 16, fontWeight: "700" },

  // Bölüm başlığı
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 16 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  sectionTick: { width: 3, height: 11, borderRadius: 2 },
  sectionLabel: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.9, flexShrink: 1 },
  sectionPill: { height: 16, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  sectionPillText: { fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 0.4 },

  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.1 },

  // Kimlik
  identity: { flexDirection: "row", alignItems: "center", height: 48, paddingHorizontal: 7 },
  emojiTile: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22, lineHeight: 28 },
  identityCopy: { flex: 1, marginLeft: 10 },
  identityTitle: { fontSize: 16, lineHeight: 20, fontWeight: "900", letterSpacing: -0.3, marginTop: 1 },
  identityArrow: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  // Toplam süre
  heroRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  heroNumber: { fontWeight: "900", includeFontPadding: false },
  heroUnit: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroUnitText: { fontSize: 9, lineHeight: 12, fontWeight: "900" },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, height: 18 },
  heroSub: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 0.2 },
  paceChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, height: 18 },
  paceText: { fontSize: 8.5, lineHeight: 11, fontWeight: "900" },

  // Sayı karoları
  statsRow: { flexDirection: "row", gap: 8 },
  statTile: { flex: 1, height: 54, paddingHorizontal: 10, paddingBottom: 8, justifyContent: "flex-end" },
  statIcon: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 20, lineHeight: 24, fontWeight: "900", letterSpacing: -0.6 },
  statLabel: { fontSize: 8.5, lineHeight: 11, fontWeight: "800", letterSpacing: 0.3 },

  // Türler
  genreRow: { flexDirection: "row", gap: 6 },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    height: 24,
    flexShrink: 1,
  },
  genreChipTop: { borderColor: "transparent" },
  genreText: { fontSize: 10, lineHeight: 13, fontWeight: "800" },

  // Posterler
  posterFrame: { flex: 1, overflow: "hidden" },
  posterEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  posterFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" },
  rankChip: { position: "absolute", top: 5, left: 5, minWidth: 18, height: 18, borderRadius: 7, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  rankChipText: { fontSize: 9.5, lineHeight: 12, fontWeight: "900" },

  showcasePosterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, height: 90 },
  posterFan: { flexDirection: "row", alignItems: "flex-end" },
  posterCopy: { flex: 1, minWidth: 0 },
  posterLead: { fontSize: 14, lineHeight: 17, fontWeight: "900", letterSpacing: -0.2, marginTop: 2 },
  metaPill: { alignSelf: "flex-start", marginTop: 7, height: 20, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  metaPillText: { fontSize: 9, lineHeight: 12, fontWeight: "900" },

  // Poster panosu
  wall: { flexDirection: "row", gap: 10, height: 210 },
  wallGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, alignContent: "flex-start" },
  wallPh: { width: 72, height: 100, borderRadius: 12, borderWidth: 1 },
  wallEmpty: { height: 210, alignItems: "center", justifyContent: "center" },
  wallHalo: { position: "absolute", width: 190, height: 190, borderRadius: 95, borderWidth: 1 },
  wallHalo2: { position: "absolute", width: 238, height: 238, borderRadius: 119, borderWidth: 1 },
  wallEmoji: { fontSize: 92, lineHeight: 112 },

  inlineStats: { flexDirection: "row", alignItems: "center", height: 40, paddingHorizontal: 6 },
  inlineCell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  inlineDivider: { width: 1, height: 18 },
  inlineValue: { fontSize: 14, lineHeight: 17, fontWeight: "900", letterSpacing: -0.3 },
  inlineLabel: { fontSize: 8, lineHeight: 10, fontWeight: "800", letterSpacing: 0.3 },

  // Bilet
  ticketBand: { position: "absolute", top: 0, left: 22, right: 22, height: 5, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  ticketMain: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, justifyContent: "space-between", gap: 8 },
  ticketTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ticketBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  ticketLogo: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  ticketBrandText: { fontSize: 12, lineHeight: 14, fontWeight: "900", letterSpacing: 1.2 },
  ticketBrandSub: { fontSize: 8.5, lineHeight: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 1 },
  admit: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, transform: [{ rotate: "-4deg" }] },
  admitText: { fontSize: 9, lineHeight: 11, fontWeight: "900", letterSpacing: 1.4 },
  ticketRule: { height: 1, marginTop: 12 },
  ticketEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.6 },
  ticketYear: { fontSize: 66, lineHeight: 70, fontWeight: "900", letterSpacing: -3, includeFontPadding: false, marginTop: 2 },
  ticketIdentity: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, height: 46, paddingHorizontal: 10 },
  ticketEmoji: { fontSize: 24, lineHeight: 30 },
  ticketIdEyebrow: { fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 1 },
  ticketIdTitle: { fontSize: 15, lineHeight: 19, fontWeight: "900", letterSpacing: -0.2 },
  ticketHero: {},
  ticketEyebrowSm: { fontSize: 8.5, lineHeight: 11, fontWeight: "900", letterSpacing: 1.2 },
  ticketHeroRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  ticketHeroNumber: { flexShrink: 1, fontSize: 44, lineHeight: 48, fontWeight: "900", letterSpacing: -2, includeFontPadding: false },
  ticketHeroUnit: { fontSize: 13, lineHeight: 18, fontWeight: "900", marginBottom: 6 },
  ticketHeroSub: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 0.2 },
  ticketStats: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, height: 52 },
  ticketStat: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  ticketStatValue: { fontSize: 20, lineHeight: 24, fontWeight: "900", letterSpacing: -0.5 },
  ticketStatLabel: { fontSize: 8, lineHeight: 10, fontWeight: "800", letterSpacing: 0.4 },
  ticketGenres: { flexDirection: "row", gap: 6 },
  ticketChip: { borderWidth: 1, borderRadius: 999, height: 24, paddingHorizontal: 11, justifyContent: "center", flexShrink: 1 },
  ticketChipText: { fontSize: 9.5, lineHeight: 12, fontWeight: "800" },
  ticketCaption: { borderLeftWidth: 3, paddingLeft: 9 },
  ticketCaptionText: { fontSize: 11.5, lineHeight: 15, fontWeight: "700" },
  ticketStub: { position: "absolute", left: 0, right: 0, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 14, justifyContent: "space-between" },
  stubRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  stubLabel: { fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 1.4 },
  stubSerial: { fontSize: 15, lineHeight: 19, fontWeight: "900", letterSpacing: 1.6, marginTop: 1 },
  stubPosters: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  stubFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 8 },
  stubHolder: { flex: 1, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.8, marginRight: 10 },
  stubBrand: { fontSize: 11, lineHeight: 14, fontWeight: "900", letterSpacing: 0.6 },

  // Minimal
  minIdentity: { flexDirection: "row", alignItems: "center", gap: 11, height: 44 },
  minEmoji: { fontSize: 28, lineHeight: 34 },
  minIdentityTitle: { fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: -0.5 },
  minRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, height: 28 },
  minRowLabel: { fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 1.3 },
  minRowValue: { fontSize: 21, lineHeight: 25, fontWeight: "900", letterSpacing: -0.6 },
  minGenres: { flexDirection: "row", alignItems: "center", gap: 8, height: 22 },
  minGenre: { fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: -0.2 },
  minDot: { width: 4, height: 4, borderRadius: 2 },
  minPosters: { flexDirection: "row", justifyContent: "space-between" },
});

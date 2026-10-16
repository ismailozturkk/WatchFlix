// components/storyShare/ProfileStoryCard.js
//
// Profilden paylaşılan hikaye kartı (captureRef hedefi). TAM 9:16, referans
// tuval 360x640 (3x'te 1080x1920). Saf/statik: animasyon, buton, dokunma yok —
// her yakalamada tam kompozisyon çıkar.
//
// ÖNİZLEME ÖLÇEĞİ: kart HER ZAMAN 360x640 olarak yerleşir; düzenleyici sayfa onu
// `transform: scale` ile küçültüp gösterir (ProfileStoryModal). Yakalama düğümün
// KENDİ boyutunu alır, üst öğenin dönüşümünü almaz — önizleme küçük de olsa çıktı
// tam boyutlu ve önizlemeyle birebir aynıdır. Bu yüzden iç ölçüler piksel sabitidir.
//
// GÖRÜNÜM DİLİ: cam paneller (yarı saydam dolgu + üstten ışık + ince kenar),
// SVG radyal ışımalar, büyük sayılar, geniş harf aralıklı küçük etiketler.
// Blur KULLANILMAZ: yakalama anında yerel blur katmanı boş çıkabiliyor.
// GRADYAN KURALI: soluklaşan her gradyan AYNI rengin alfa=0 hâline iner
// ("transparent" değil) — yerel gradyan renkleri önceden çarpmadan harmanlar ve
// "transparent" ara tonlarda gri bir leke bırakır.
//
// YERLEŞİM SÖZLEŞMESİ: ekrana sığması için her bölümün yüksekliği ÖNCEDEN BELLİ
// olmalı (tek satır metin, sabit karo yüksekliği, not en çok 2 satır). Her düzen,
// TÜM bölümler açıkken de sığacak biçimde ölçüldü (düzen başına bütçe aşağıda).
// Yeni bir satır eklemek bütçeyi aşarsa altbilgi kırpılır — ekleme yaparken önce
// bütçeyi güncelle.
//
// Palet: Wrapped kartıyla AYNI (WRAPPED_CARD_THEMES) + kullanıcının halka rengi
// ("rank"); iki kart yan yana paylaşıldığında aynı marka dilini konuşur.
//
// DÖRT FAVORİ (Users/{uid}.fourFavorites): `favorites` verilir ve
// `options.showFavorites` açıksa favoriler POSTER ALANININ yerine geçer —
//   Vitrin/Kimlik/Minimal → kategori başına üst üste binen küçük poster destesi
//   (şerit; alan yüksekliği değişmez, FAVORITE_RIBBON),
//   Duvar                → kolaj hücreleri favori afişleriyle dolar,
//   Seçki ("picks")      → favorilerin büyük, adlı raflarla gösterildiği düzen.
// Seçki'nin dikey bütçesi anahtarlara göre ÇÖZÜLÜR (planPicksLayout, testli);
// favori yoksa Seçki çizilmez, kart Vitrin'e düşer (resolveStoryLayout).
//
// Dışa açılan sözleşme (ProfileStoryModal bağımlı):
//   STORY_CARD_W / STORY_CARD_H, getStoryPalette
//   props: { options, theme, language, profile, badges, badgeInfo, stats, perde,
//            genres, streak, member, posters, favorites, str, onImageSettled }
//   favorites: { count, groups: [{ kind, label, items: [{ key, title, uri }] }] }
//   (uri yoksa kart tür simgeli yer tutucu çizer)

import React, { memo, useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from "react-native-svg";
import AppIcon from "../AppIcon";
import AppBadge from "../badges/AppBadge";
import UserAvatar from "../common/UserAvatar";
import { badgeLabel } from "../badges/badgeCatalog";
import useAppLogo from "../../hooks/useAppLogo";
import { alpha } from "../../theme/colors";
import { GOLD } from "../../theme/badgeTokens";
import { readableTextOn, shiftLightness, toHex } from "../../utils/colorUtils";
import {
  foregroundForPalette,
  getWrappedCardPalette,
} from "../wrapped/WrappedShareCard";
import {
  FAVORITE_RIBBON,
  PICKS_BUDGET,
  buildRankPalette,
  formatStoryNumber,
  isFavoritesActive,
  planPicksLayout,
  resolveStoryLayout,
  ribbonMetrics,
} from "../../utils/profileStoryCard";

export const STORY_CARD_W = 360;
export const STORY_CARD_H = 640;

const W = STORY_CARD_W;
const H = STORY_CARD_H;
const PAD = 20;
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const INK = "#0B0812"; // karttaki koyu zemin (avatar boşluğu)

// `tint`: vurgunun METİN/ikon için açılmış tonu. "İmza" temasında zemin de vurgu
// renginden doğduğundan, düz vurguyla yazılmış kullanıcı adı zeminde kayboluyordu;
// dolgu ve çubuklar `accent`, yazı ve ikonlar `tint` kullanır.
function withTint(palette) {
  const hex = toHex(palette.accent);
  return { ...palette, tint: shiftLightness(hex, hex === "#000000" ? 0 : 20) };
}

/** Seçili temaya göre kart paleti; "rank" halka renginden türer. */
export function getStoryPalette(themeId, accent, ringColors) {
  if (themeId === "rank") {
    const palette = buildRankPalette(ringColors);
    if (palette) return withTint(palette);
  }
  return withTint(getWrappedCardPalette(themeId === "rank" ? "signature" : themeId, accent));
}

const foregroundOn = (palette) =>
  palette?.id === "rank" ? readableTextOn(palette.accent) : foregroundForPalette(palette);

// Rozet rengi: kademeli rozetler kendi kademe rengini taşır (`color`); ailesiz
// olanlar nadirliğe göre, KOYU zemine uygun sabit tonlarla çizilir (uygulama
// teması açık olsa da kart hep koyu).
const RARITY_ON_DARK = {
  common: "#CBD5E1",
  uncommon: null, // paletin vurgusu
  rare: "#C084FC",
  epic: "#22D3EE",
  legendary: GOLD,
};

const CardText = ({ style, ...rest }) => (
  <Text allowFontScaling={false} {...rest} style={style} />
);

const percentText = (value, language) => (language === "en" ? `${value}%` : `%${value}`);

// ── Zemin ────────────────────────────────────────────────────────────────────

function Background({ palette, background }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { accent } = palette;
  const secondary = palette.secondary || accent;
  const clean = background === "clean";
  return (
    <>
      <LinearGradient
        colors={clean ? [palette.colors[0], palette.colors[2], palette.colors[3]] : palette.colors}
        locations={clean ? [0, 0.55, 1] : [0, 0.4, 0.74, 1]}
        start={{ x: 0.1, y: -0.05 }}
        end={{ x: 0.9, y: 1.05 }}
        style={StyleSheet.absoluteFill}
      />
      {!clean && (
        // Düz daireler yerine radyal ışımalar: kenarsız, "mesh gradient" dokusu.
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`a${uid}`} cx={W * 0.95} cy={H * 0.02} r={330} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={accent} stopOpacity="0.5" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`b${uid}`} cx={0} cy={H * 0.5} r={300} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={secondary} stopOpacity="0.32" />
              <Stop offset="1" stopColor={secondary} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`c${uid}`} cx={W} cy={H} r={320} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={accent} stopOpacity="0.26" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={W} height={H} fill={`url(#a${uid})`} />
          <Rect x="0" y="0" width={W} height={H} fill={`url(#b${uid})`} />
          <Rect x="0" y="0" width={W} height={H} fill={`url(#c${uid})`} />
        </Svg>
      )}
      <LinearGradient
        colors={[alpha(WHITE, clean ? 0.07 : 0.1), alpha(WHITE, 0)]}
        style={[styles.topSheen, { height: 200 }]}
      />
      <LinearGradient
        colors={[alpha(BLACK, 0), alpha(BLACK, 0.6)]}
        style={[styles.bottomVignette, { height: 260 }]}
      />
    </>
  );
}

// ── Ortak parçalar ───────────────────────────────────────────────────────────

// Cam panel: yarı saydam dolgu + sol-üstten gelen ışık + ince kenar.
function Glass({ children, style, radius = 20, strong = false }) {
  return (
    <View
      style={[
        styles.glass,
        { borderRadius: radius, backgroundColor: alpha(WHITE, strong ? 0.1 : 0.065) },
        style,
      ]}
    >
      <LinearGradient
        colors={[alpha(WHITE, strong ? 0.18 : 0.12), alpha(WHITE, 0)]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function Eyebrow({ children, color, style }) {
  return (
    <CardText numberOfLines={1} style={[styles.eyebrow, { color: color || alpha(WHITE, 0.58) }, style]}>
      {children}
    </CardText>
  );
}

function MemberPill({ ctx }) {
  const { member, str, options, palette } = ctx;
  if (!options.showMember || !member) return null;
  return (
    <View style={styles.memberPill}>
      <AppIcon family="Ionicons" name="calendar-outline" size={11} color={palette.tint} />
      <CardText numberOfLines={1} style={styles.memberText}>
        {str.member} · {member}
      </CardText>
    </View>
  );
}

function Header({ ctx }) {
  const { palette, logo, str } = ctx;
  const { accent } = palette;
  const secondary = palette.secondary || accent;
  return (
    <View style={styles.header}>
      <View style={styles.brandLockup}>
        <LinearGradient
          colors={[alpha(accent, 0.95), alpha(secondary, 0.85)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoTile}
        >
          <Image source={logo} style={{ width: 22, height: 22 }} contentFit="contain" />
        </LinearGradient>
        <View>
          <CardText style={styles.brand}>SEELOGD</CardText>
          <CardText style={[styles.brandSub, { color: alpha(WHITE, 0.62) }]}>{str.brandSub}</CardText>
        </View>
      </View>
      <MemberPill ctx={ctx} />
    </View>
  );
}

function Footer({ ctx }) {
  const { logo, str, palette } = ctx;
  return (
    <View style={styles.footer}>
      <View style={styles.footerBrand}>
        <Image source={logo} style={{ width: 18, height: 18 }} contentFit="contain" />
        <CardText style={styles.footerBrandText}>Seelogd</CardText>
      </View>
      <View style={styles.footerCta}>
        <CardText numberOfLines={1} style={styles.footerCtaText}>
          {str.cta}
        </CardText>
        <AppIcon family="Ionicons" name="arrow-forward" size={11} color={palette.tint} />
      </View>
    </View>
  );
}

// Halka rütbe renginden gelir (profildeki avatar halkasıyla aynı kaynak).
function RingAvatar({ ctx, size }) {
  const { profile, palette } = ctx;
  const ringColors = profile.ringColors?.length === 2 ? profile.ringColors : [palette.accent, palette.secondary || palette.accent];
  const ring = 2.5;
  const gap = 3;
  const inner = size + gap * 2;
  const outer = inner + ring * 2;
  return (
    <LinearGradient
      colors={ringColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: outer, height: outer, borderRadius: outer / 2, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: INK,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <UserAvatar
          source={profile.avatar}
          fallbackSource={require("../../assets/avatar/3.png")}
          isCustomPhoto={profile.isCustomPhoto}
          size={size}
          priority="high"
          cachePolicy="memory-disk"
        />
      </View>
    </LinearGradient>
  );
}

// Kurucu / Premium gibi kimlik rozetleri: ad satırının yanında küçük haplar.
function IdentityTags({ ctx, centered }) {
  const { badges, language, options } = ctx;
  if (!options.showBadges || !badges?.length) return null;
  return (
    <View style={[styles.tagRow, centered && { justifyContent: "center" }]}>
      {badges.slice(0, 2).map((badge) => {
        const tone = RARITY_ON_DARK[badge.rarity] || ctx.palette.tint;
        return (
          <View
            key={badge.id}
            style={[styles.tag, { backgroundColor: alpha(tone, 0.16), borderColor: alpha(tone, 0.55) }]}
          >
            <AppIcon family="Ionicons" name={badge.glyphSolid || badge.glyph} size={10} color={tone} />
            <CardText numberOfLines={1} style={[styles.tagText, { color: tone }]}>
              {badgeLabel(badge, language)}
            </CardText>
          </View>
        );
      })}
    </View>
  );
}

function Username({ ctx, centered }) {
  const { options, profile, palette } = ctx;
  if (!options.showUsername || !profile.username) return null;
  return (
    <CardText
      numberOfLines={1}
      style={[styles.username, { color: palette.tint }, centered && { textAlign: "center" }]}
    >
      @{profile.username}
    </CardText>
  );
}

function Name({ ctx, size = 26, centered }) {
  return (
    <CardText
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      fontRole="body"
      style={[
        styles.name,
        { fontSize: size, lineHeight: Math.round(size * 1.18) },
        centered && { textAlign: "center", alignSelf: "stretch" },
      ]}
    >
      {ctx.profile.name}
    </CardText>
  );
}

function Note({ ctx, centered }) {
  const text = ctx.options.note;
  if (!text) return null;
  return (
    <View style={[styles.note, centered && { alignSelf: "center" }]}>
      <CardText style={[styles.noteQuote, { color: ctx.palette.tint }]}>“</CardText>
      <CardText numberOfLines={2} style={[styles.noteText, centered && { textAlign: "center" }]}>
        {text}
      </CardText>
    </View>
  );
}

// `icon`: görseli olmayan (uri yok) öğede çizilen yer tutucu simgesi — yalnız
// dört favoride olur (profil belgesinde görsel yolu boş olabilir).
function Poster({ item, width, height, ctx, style, radius, icon }) {
  return (
    <View
      style={[
        styles.poster,
        { width, height, borderRadius: radius ?? Math.max(8, Math.round(width * 0.13)) },
        style,
      ]}
    >
      {item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          priority="high"
          cachePolicy="memory-disk"
          onLoadEnd={() => ctx.onImageSettled?.(item.uri)}
        />
      ) : (
        <View style={styles.posterEmpty}>
          <AppIcon
            family="Ionicons"
            name={icon || "image-outline"}
            size={Math.max(12, Math.round(Math.min(width, height) * 0.4))}
            color={alpha(WHITE, 0.5)}
          />
        </View>
      )}
    </View>
  );
}

function SectionTitle({ ctx, title }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionDot, { backgroundColor: ctx.palette.accent }]} />
      <CardText numberOfLines={1} style={styles.sectionTitle}>
        {title}
      </CardText>
      <View style={[styles.sectionLine, { backgroundColor: alpha(WHITE, 0.14) }]} />
    </View>
  );
}

const compact = (ctx, value) => formatStoryNumber(value, ctx.language, { compact: true });

// "78 GÜN 1 SAAT": çeviri şablonu düzenleyicide çözülür (stats.daysText).
const daysHoursText = (ctx) => ctx.stats.daysText || "";

// ── Modüller ─────────────────────────────────────────────────────────────────

// Perde: seviye adı + ilerleme çubuğu. `bare`: cam panelsiz (başka bir panelin içinde).
function PerdeModule({ ctx, bare }) {
  const { perde, palette, language } = ctx;
  const { accent } = palette;
  const secondary = palette.secondary || accent;
  const onAccent = foregroundOn(palette);
  const pct = Math.round((perde.progress || 0) * 100);
  const body = (
    <View style={styles.perdeRow}>
      <View style={[styles.perdeIcon, { backgroundColor: accent }]}>
        <AppIcon family="Ionicons" name="film" size={14} color={onAccent} />
      </View>
      <View style={styles.perdeCopy}>
        <View style={styles.perdeTitleRow}>
          <CardText numberOfLines={1} style={[styles.perdeLabel, { color: palette.tint }]}>
            {perde.label}
          </CardText>
          {perde.name ? (
            <CardText numberOfLines={1} style={styles.perdeName}>
              {perde.name}
            </CardText>
          ) : null}
        </View>
        <View style={styles.barTrack}>
          <LinearGradient
            colors={[accent, secondary]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.barFill, { width: `${Math.max(pct, 4)}%` }]}
          />
        </View>
      </View>
      <CardText numberOfLines={1} style={styles.perdePct}>
        {perde.maxed && perde.makaraLabel ? perde.makaraLabel : percentText(pct, language)}
      </CardText>
    </View>
  );
  if (bare) return body;
  return (
    <Glass radius={18} style={styles.perdePanel}>
      {body}
    </Glass>
  );
}

// Üç satırlık sayaç listesi (film / dizi / bölüm).
function StatList({ ctx, style }) {
  const { stats, str, palette } = ctx;
  const rows = [
    [str.movies, compact(ctx, stats.movies)],
    [str.shows, compact(ctx, stats.shows)],
    [str.episodes, compact(ctx, stats.episodes)],
  ];
  return (
    <Glass radius={18} style={[styles.statList, style]}>
      {rows.map(([label, value], index) => (
        <View
          key={label}
          style={[
            styles.statListRow,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: alpha(WHITE, 0.16) },
          ]}
        >
          <View style={[styles.statListDot, { backgroundColor: alpha(palette.accent, 0.9 - index * 0.2) }]} />
          <CardText numberOfLines={1} style={styles.statListLabel}>
            {label}
          </CardText>
          <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statListValue}>
            {value}
          </CardText>
        </View>
      ))}
    </Glass>
  );
}

// Hero sayısı karoya sığacak boyutta çizilir: karakter sayısına göre kademeli
// küçülür (uzun birim — "HOURS" — sayıyı sıkıştırıp kırpmasın; sığdırmayı yalnız
// `adjustsFontSizeToFit`e bırakmıyoruz).
const heroFontSize = (text) => (text.length <= 4 ? 38 : text.length === 5 ? 34 : text.length === 6 ? 30 : 26);

// Büyük "toplam süre" karosu.
function HeroTime({ ctx, style }) {
  const { stats, str, palette, language } = ctx;
  const sub = daysHoursText(ctx);
  const hoursText = formatStoryNumber(stats.hours, language);
  const size = heroFontSize(hoursText);
  return (
    <Glass radius={18} strong style={[styles.hero, style]}>
      <Eyebrow>{str.totalTime}</Eyebrow>
      <View>
        <View style={styles.heroNumberRow}>
          <CardText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[styles.heroNumber, { fontSize: size, lineHeight: size + 4 }]}
          >
            {hoursText}
          </CardText>
          <CardText style={[styles.heroUnit, { color: palette.tint }]}>{str.hours}</CardText>
        </View>
        {sub ? (
          <CardText numberOfLines={1} style={styles.heroSub}>
            {sub}
          </CardText>
        ) : null}
      </View>
    </Glass>
  );
}

function GenreBars({ ctx, style }) {
  const { genres, str, palette, language } = ctx;
  const top = genres.top;
  const max = top[0]?.count || 1;
  const secondary = palette.secondary || palette.accent;
  return (
    <Glass radius={18} style={[styles.genreBars, style]}>
      <Eyebrow>{str.genres}</Eyebrow>
      <View style={styles.genreRows}>
        {top.map((genre) => (
          <View key={genre.id} style={styles.genreRow}>
            <CardText numberOfLines={1} style={styles.genreLabel}>
              {genre.label}
            </CardText>
            <View style={styles.genreTrack}>
              <LinearGradient
                colors={[palette.accent, secondary]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.barFill, { width: `${Math.max(12, Math.round((genre.count / max) * 100))}%` }]}
              />
            </View>
            <CardText numberOfLines={1} style={styles.genrePct}>
              {percentText(genre.pct, language)}
            </CardText>
          </View>
        ))}
      </View>
    </Glass>
  );
}

// Tür haplarının yatay hâli (geniş ve alçak yerlerde). `nowrap`: tek satıra
// zorlanır, uzun adlar kısalır (Seçki'nin dikey bütçesi tek satır varsayar).
// Dizi biçimleri `nowrap` kapalıyken eskisiyle AYNI (referans testi bunu korur).
function GenreChips({ ctx, centered, nowrap }) {
  const { genres, palette, language } = ctx;
  return (
    <View style={[styles.chipRow, centered && { justifyContent: "center" }, ...(nowrap ? [styles.chipRowNoWrap] : [])]}>
      {genres.top.map((genre, index) => (
        <View
          key={genre.id}
          style={[
            styles.chip,
            index === 0 && { backgroundColor: alpha(palette.accent, 0.2), borderColor: alpha(palette.accent, 0.6) },
            ...(nowrap ? [styles.chipShrink] : []),
          ]}
        >
          <CardText numberOfLines={1} style={nowrap ? [styles.chipText, styles.chipShrink] : styles.chipText}>
            {genre.label}
          </CardText>
          <CardText numberOfLines={1} style={[styles.chipPct, { color: palette.tint }]}>
            {percentText(genre.pct, language)}
          </CardText>
        </View>
      ))}
    </View>
  );
}

function StreakTile({ ctx, style }) {
  const { streak, str, palette } = ctx;
  const value = streak.showRecord ? streak.record : streak.current;
  return (
    <Glass radius={18} style={[styles.streakTile, style]}>
      <View style={styles.streakHead}>
        <AppIcon family="Ionicons" name="flame" size={13} color={palette.tint} />
        <Eyebrow style={{ flexShrink: 1 }}>{streak.showRecord ? str.streakRecord : str.streak}</Eyebrow>
      </View>
      <View style={styles.streakNumberRow}>
        <CardText numberOfLines={1} style={styles.streakNumber}>
          {value}
        </CardText>
        <CardText style={styles.streakUnit}>{str.dayUnit}</CardText>
      </View>
      <View style={styles.weekDots}>
        {streak.week.map((on, index) => (
          <View
            key={index}
            style={[
              styles.weekDot,
              on
                ? { backgroundColor: palette.accent }
                : { backgroundColor: alpha(WHITE, 0.16) },
            ]}
          />
        ))}
      </View>
    </Glass>
  );
}

// Yatay tek satırlık seri hapı (dar düzenler).
function StreakPill({ ctx }) {
  const { streak, str, palette } = ctx;
  const value = streak.showRecord ? streak.record : streak.current;
  return (
    <View style={[styles.streakPill, { borderColor: alpha(palette.accent, 0.5), backgroundColor: alpha(palette.accent, 0.14) }]}>
      <AppIcon family="Ionicons" name="flame" size={13} color={palette.tint} />
      <CardText numberOfLines={1} style={styles.streakPillValue}>
        {value}
      </CardText>
      <CardText numberOfLines={1} style={styles.streakPillLabel}>
        {streak.showRecord ? str.streakRecord : str.streak}
      </CardText>
    </View>
  );
}

function ShowcaseBadges({ ctx, size = 30 }) {
  const { badgeInfo, palette } = ctx;
  return (
    <View style={styles.badgeIcons}>
      {badgeInfo.showcase.map((badge) => (
        <AppBadge
          key={badge.id}
          glyph={badge.glyph}
          glyphSolid={badge.glyphSolid}
          rarity={badge.rarity}
          unlocked
          size={size}
          sides={badge.sides}
          ornate={badge.ornate}
          color={badge.color || RARITY_ON_DARK[badge.rarity] || palette.accent}
        />
      ))}
    </View>
  );
}

// Rozet sayacı + vitrin: "24/81" ve en nadir rozetler.
function BadgeRail({ ctx, style }) {
  const { badgeInfo, str, palette } = ctx;
  return (
    <Glass radius={18} style={[styles.badgeRail, style]}>
      <View style={styles.badgeRailCopy}>
        <View style={styles.badgeRailHead}>
          <AppIcon family="Ionicons" name="ribbon" size={12} color={palette.tint} />
          <Eyebrow style={{ flexShrink: 1 }}>{str.badges}</Eyebrow>
        </View>
        <View style={styles.badgeCountRow}>
          <CardText style={styles.badgeCount}>{badgeInfo.earned}</CardText>
          <CardText style={styles.badgeTotal}>/{badgeInfo.total}</CardText>
        </View>
      </View>
      <ShowcaseBadges ctx={ctx} />
    </Glass>
  );
}

// Tek satır dört sayaç (saat / film / dizi / bölüm). Duvar'ın istatistik şeridi
// ve Seçki'nin istatistik satırı AYNI parçayı kullanır; `style` yüksekliği verir.
function StatStrip({ ctx, style }) {
  const { stats, str } = ctx;
  return (
    <Glass radius={18} style={style}>
      {[
        [compact(ctx, stats.movies), str.movies],
        [compact(ctx, stats.shows), str.shows],
        [compact(ctx, stats.episodes), str.episodes],
        [compact(ctx, stats.hours), str.hours],
      ].map(([value, label], index) => (
        <View
          key={label}
          style={[
            styles.wallStat,
            index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: alpha(WHITE, 0.2) },
          ]}
        >
          <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.wallStatValue}>
            {value}
          </CardText>
          <CardText numberOfLines={1} style={styles.wallStatLabel}>
            {label}
          </CardText>
        </View>
      ))}
    </Glass>
  );
}

// Tür hapları + seri/rozet hapları. Kimlik, Duvar, Minimal ve Seçki ortak
// kullanır; `style` sarmalayıcının yerleşimini (boşluk/hizalama) belirler.
function ExtrasBlock({ ctx, centered, style, nowrap }) {
  const { options, genres, streak, badgeInfo } = ctx;
  const showGenres = options.showGenres && genres?.top?.length > 0;
  const showStreak = options.showStreak && streak;
  const showBadges = options.showBadges && badgeInfo?.showcase?.length > 0;
  if (!showGenres && !showStreak && !showBadges) return null;
  return (
    <View style={style}>
      {showGenres ? <GenreChips ctx={ctx} centered={centered} nowrap={nowrap} /> : null}
      {showStreak || showBadges ? (
        <View style={styles.extrasRow}>
          {showStreak ? <StreakPill ctx={ctx} /> : null}
          {showBadges ? (
            <View style={styles.badgePill}>
              <CardText style={styles.badgePillCount}>
                {badgeInfo.earned}
                <CardText style={styles.badgeTotal}>/{badgeInfo.total}</CardText>
              </CardText>
              <ShowcaseBadges ctx={ctx} size={24} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Dört favori ──────────────────────────────────────────────────────────────

const KIND_ICON = { movies: "film-outline", shows: "tv-outline", people: "person-outline" };
// Üst üste binen posterlerin arasını açan koyu halka (kart zeminiyle aynı ton).
const STACK_RING = "rgba(10,7,16,0.9)";

// Kategori başlığı: simge + büyük harfli ad. Şeritte ve üst etiketli rafta ortak.
function KindLabel({ ctx, group }) {
  return (
    <View style={styles.kindLabel}>
      <AppIcon family="Ionicons" name={KIND_ICON[group.kind]} size={10} color={ctx.palette.tint} />
      <CardText numberOfLines={1} style={styles.kindLabelText}>
        {group.label}
      </CardText>
    </View>
  );
}

// Eski düzenlerin poster alanının yerine geçen şerit: her kategori için ilki en
// üstte olan, sağa doğru taşan küçük bir poster destesi. Alan yüksekliği
// `FAVORITE_RIBBON[layoutId].slot` (düzenin poster alanıyla aynı), içerik ortalanır.
function FavoritesRibbon({ ctx, layoutId }) {
  const { slot, thumb } = FAVORITE_RIBBON[layoutId];
  const m = ribbonMetrics(thumb);
  const groups = ctx.favorites.groups;
  const spread = groups.length >= 3;
  return (
    <View
      style={[
        styles.ribbon,
        { height: slot, justifyContent: spread ? "space-between" : "center", gap: spread ? 0 : 28 },
      ]}
    >
      {groups.map((group) => {
        const people = group.kind === "people";
        const items = group.items.slice(0, 4);
        return (
          <View key={group.kind} style={{ width: m.stackW }}>
            <KindLabel ctx={ctx} group={group} />
            <View style={{ width: m.stackW, height: m.thumbH }}>
              {items.map((item, index) => (
                <Poster
                  key={item.key}
                  item={item}
                  ctx={ctx}
                  width={thumb}
                  height={people ? thumb : m.thumbH}
                  radius={people ? thumb / 2 : 7}
                  icon={KIND_ICON[group.kind]}
                  style={{
                    position: "absolute",
                    left: index * m.offset,
                    top: people ? Math.round((m.thumbH - thumb) / 2) : 0,
                    zIndex: items.length - index,
                    borderWidth: 1.5,
                    borderColor: STACK_RING,
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Seçki düzeninin ana bölümü: başlık + cam panelde kategori rafları. Boyutlar
// `plan` (planFavoriteShelves) ile gelir; 3 kategoride etiket solda, 1–2'de rafın
// üstünde (daha büyük posterler).
function FavoriteShelves({ ctx, plan }) {
  const { favorites, palette, str } = ctx;
  const side = plan.style === "side";
  // Cam panelin iç genişliği: kart − 2×PAD − 2×12 iç boşluk − 2 kenar.
  const innerW = W - PAD * 2 - 24 - 2;
  const slotsW = side ? innerW - SHELF_LABEL_W - SHELF_LABEL_GAP : innerW;
  const gap = Math.max(6, Math.floor((slotsW - 4 * plan.width) / 3));
  return (
    <View>
      <View style={styles.shelfTitle}>
        <SectionTitle ctx={ctx} title={str.favTitle} />
      </View>
      <Glass radius={18} style={styles.shelfPanel}>
        {favorites.groups.map((group) => {
          const row = plan.rows.find((r) => r.kind === group.kind);
          if (!row) return null;
          const people = group.kind === "people";
          const slots = (
            <View style={styles.shelfSlots}>
              {group.items.slice(0, 4).map((item, index) => (
                <View key={item.key} style={{ width: row.artW, marginLeft: index ? gap : 0 }}>
                  <Poster
                    item={item}
                    ctx={ctx}
                    width={row.artW}
                    height={row.artH}
                    radius={people ? row.artW / 2 : undefined}
                    icon={KIND_ICON[group.kind]}
                  />
                  {plan.names ? (
                    <CardText numberOfLines={1} style={[styles.shelfName, { width: row.artW }]}>
                      {item.title}
                    </CardText>
                  ) : null}
                </View>
              ))}
            </View>
          );
          return side ? (
            <View key={group.kind} style={styles.shelfRow}>
              <View style={[styles.shelfLabelCol, { height: row.artH }]}>
                <View style={[styles.shelfLabelIcon, { backgroundColor: alpha(palette.accent, 0.22) }]}>
                  <AppIcon family="Ionicons" name={KIND_ICON[group.kind]} size={13} color={palette.tint} />
                </View>
                <CardText numberOfLines={1} style={styles.shelfLabelText}>
                  {group.label}
                </CardText>
              </View>
              {slots}
            </View>
          ) : (
            <View key={group.kind}>
              <KindLabel ctx={ctx} group={group} />
              {slots}
            </View>
          );
        })}
      </Glass>
    </View>
  );
}

// Soldaki kategori etiketi sütunu (3 kategorili raf).
const SHELF_LABEL_W = 58;
const SHELF_LABEL_GAP = 8;

// Duvar kolajı için favori afişleri: görseli olanlar, kategori sırasıyla.
function favoriteWallItems(favorites, limit) {
  return (favorites?.groups || [])
    .flatMap((group) => group.items)
    .filter((item) => item.uri)
    .slice(0, limit)
    .map((item) => ({ key: item.key, name: item.title, uri: item.uri }));
}

// ── Düzen 1: Vitrin (bento) ──────────────────────────────────────────────────
// Bütçe (hepsi açık, 2 satır not): 28 başlık + 64 kimlik + 52 not + 50 Perde
// + 96 sayaçlar + 80 tür/seri + 48 rozet + 104 poster + 28 altbilgi = 550 / 600
// (içerik alanı = 640 - 2×20); kalan 50, 8 boşluğa dağılır.
function ShowcaseLayout({ ctx }) {
  const { options, perde, badgeInfo, genres, streak, posters, favoritesActive } = ctx;
  const showPerde = options.showPerde && perde;
  const showGenres = options.showGenres && genres?.top?.length > 0;
  const showStreak = options.showStreak && streak;
  const showBadges = options.showBadges && badgeInfo?.showcase?.length > 0;
  const showPosters = !favoritesActive && options.showPosters && posters.items.length > 0;
  const gap = 8;
  const count = 5;
  const posterW = Math.floor((W - PAD * 2 - gap * (count - 1)) / count);
  const posterH = Math.round(posterW * 1.5);
  return (
    <View style={styles.layout}>
      <Header ctx={ctx} />

      <View style={{ gap: 8 }}>
        <View style={styles.identityRow}>
          <RingAvatar ctx={ctx} size={54} />
          <View style={styles.identityCopy}>
            <Name ctx={ctx} size={26} />
            <View style={styles.metaRow}>
              <Username ctx={ctx} />
              <IdentityTags ctx={ctx} />
            </View>
          </View>
        </View>
        <Note ctx={ctx} />
      </View>

      {showPerde ? <PerdeModule ctx={ctx} /> : null}

      {options.showStats ? (
        <View style={[styles.bentoRow, { gap, height: 96 }]}>
          <HeroTime ctx={ctx} style={{ flex: 1.12 }} />
          <StatList ctx={ctx} style={{ flex: 1 }} />
        </View>
      ) : null}

      {showGenres || showStreak ? (
        <View style={[styles.bentoRow, { gap, height: 80 }]}>
          {showGenres ? <GenreBars ctx={ctx} style={{ flex: 1 }} /> : null}
          {showStreak ? <StreakTile ctx={ctx} style={showGenres ? { width: 108 } : { flex: 1 }} /> : null}
        </View>
      ) : null}

      {showBadges ? <BadgeRail ctx={ctx} /> : null}

      {favoritesActive ? (
        <View>
          <SectionTitle ctx={ctx} title={ctx.str.favTitle} />
          <View style={{ marginTop: 8 }}>
            <FavoritesRibbon ctx={ctx} layoutId="showcase" />
          </View>
        </View>
      ) : null}

      {showPosters ? (
        <View>
          <SectionTitle ctx={ctx} title={ctx.str.posterTitle[posters.source]} />
          <View style={[styles.posterRow, { gap, marginTop: 8, height: posterH }]}>
            {posters.items.slice(0, count).map((item) => (
              <Poster key={item.key} item={item} width={posterW} height={posterH} ctx={ctx} />
            ))}
          </View>
        </View>
      ) : null}

      <Footer ctx={ctx} />
    </View>
  );
}

// ── Düzen 2: Kimlik (üyelik kartı) ───────────────────────────────────────────
function IdentityLayout({ ctx }) {
  const { options, perde, posters, stats, str, palette, language, favoritesActive } = ctx;
  const showPerde = options.showPerde && perde;
  const showPosters = !favoritesActive && options.showPosters && posters.items.length > 0;
  const items = posters.items.slice(0, 3);
  const sub = daysHoursText(ctx);
  return (
    <View style={styles.layout}>
      <Header ctx={ctx} />

      <View style={styles.passWrap}>
        <Glass radius={30} strong style={styles.pass}>
          <Name ctx={ctx} size={24} centered />
          <View style={styles.passMeta}>
            <Username ctx={ctx} centered />
            <IdentityTags ctx={ctx} centered />
          </View>
          {options.note ? (
            <View style={{ marginTop: 6, maxWidth: 270 }}>
              <Note ctx={ctx} centered />
            </View>
          ) : null}

          {options.showStats ? (
            <>
              <Svg width={W - PAD * 2 - 36} height={1} style={{ marginTop: 10 }}>
                <Line
                  x1="0"
                  y1="0.5"
                  x2={W - PAD * 2 - 36}
                  y2="0.5"
                  stroke={alpha(WHITE, 0.28)}
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
              </Svg>
              <View style={styles.passHero}>
                <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.passHeroNumber}>
                  {formatStoryNumber(stats.hours, language)}
                </CardText>
                <View style={[styles.passUnit, { backgroundColor: alpha(palette.accent, 0.2), borderColor: alpha(palette.accent, 0.5) }]}>
                  <AppIcon family="Ionicons" name="time-outline" size={11} color={palette.tint} />
                  <CardText style={[styles.passUnitText, { color: palette.tint }]}>{str.hours}</CardText>
                </View>
              </View>
              {sub ? (
                <CardText numberOfLines={1} style={styles.passSub}>
                  {sub}
                </CardText>
              ) : null}
              <View style={styles.passTrio}>
                {[
                  [compact(ctx, stats.movies), str.movies],
                  [compact(ctx, stats.shows), str.shows],
                  [compact(ctx, stats.episodes), str.episodes],
                ].map(([value, label], index) => (
                  <View
                    key={label}
                    style={[
                      styles.passTrioCell,
                      index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: alpha(WHITE, 0.22) },
                    ]}
                  >
                    <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.passTrioValue}>
                      {value}
                    </CardText>
                    <CardText numberOfLines={1} style={styles.passTrioLabel}>
                      {label}
                    </CardText>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {showPerde ? (
            <View style={{ alignSelf: "stretch", marginTop: 12 }}>
              <PerdeModule ctx={ctx} bare />
            </View>
          ) : null}
        </Glass>
        <View style={styles.passAvatar}>
          <RingAvatar ctx={ctx} size={62} />
        </View>
      </View>

      <ExtrasBlock ctx={ctx} centered style={styles.passExtras} />

      {favoritesActive ? <FavoritesRibbon ctx={ctx} layoutId="identity" /> : null}

      {showPosters ? (
        <View style={styles.fan}>
          {items.map((item, index) => {
            const mid = items.length === 3 ? index === 1 : index === Math.floor(items.length / 2);
            const w = mid ? 64 : 56;
            const h = mid ? 96 : 84;
            const tilt = items.length === 1 ? 0 : (index - (items.length - 1) / 2) * 8;
            return (
              <Poster
                key={item.key}
                item={item}
                width={w}
                height={h}
                ctx={ctx}
                style={{
                  marginHorizontal: -3,
                  zIndex: mid ? 2 : 1,
                  transform: [{ rotate: `${tilt}deg` }, { translateY: mid ? -6 : 4 }],
                }}
              />
            );
          })}
        </View>
      ) : null}

      <Footer ctx={ctx} />
    </View>
  );
}

// ── Düzen 3: Sinematik duvar ─────────────────────────────────────────────────
const WALL_H = 390;

function WallLayout({ ctx }) {
  const { palette, options, perde, posters, favorites, favoritesActive } = ctx;
  const showPerde = options.showPerde && perde;
  // Dört favori açıkken kolajı favori afişleri doldurur (görseli olanlar); yoksa
  // liste posterleri. Hücre kaynağı bu ikisinden biridir.
  const wallItems = favoritesActive ? favoriteWallItems(favorites, 9) : posters.items;
  const showPosters = (favoritesActive || options.showPosters) && wallItems.length > 0;

  // Duvar 4 sütun x 3 sıra; poster azsa döngüyle doldurulur. Çift sütunlar
  // yukarı kayık (kolaj hissi), tüm ızgara hafif eğik.
  const cols = 4;
  const rows = 3;
  const cellW = 118;
  const cellH = 177;
  const cells = [];
  if (showPosters) {
    for (let i = 0; i < cols * rows; i += 1) cells.push(wallItems[i % wallItems.length]);
  }
  const bg = palette.colors[3];
  const mid = palette.colors[2];
  return (
    <View style={styles.wallRoot}>
      <View style={[styles.wall, { height: WALL_H }]}>
        {showPosters ? (
          <View style={styles.wallGridWrap}>
            <View style={styles.wallGrid}>
              {Array.from({ length: cols }, (_, col) => (
                <View key={col} style={[styles.wallCol, { marginTop: col % 2 ? -62 : 0 }]}>
                  {Array.from({ length: rows }, (_, row) => {
                    const item = cells[row * cols + col];
                    return (
                      <View key={row} style={{ width: cellW, height: cellH, padding: 3 }}>
                        <Poster item={item} width={cellW - 6} height={cellH - 6} ctx={ctx} radius={10} />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <LinearGradient
          colors={[alpha(bg, showPosters ? 0.7 : 0), alpha(bg, 0)]}
          locations={[0, 1]}
          style={[styles.wallScrimTop, { height: 120 }]}
        />
      </View>
      {/* Duvarı zemine gömen TEK uzun geçiş: son satırlarda neredeyse opak olduğu
          için duvarın kesim kenarı görünmez, altındaki zeminle de renk uyuşur. */}
      <LinearGradient
        colors={[alpha(mid, 0), alpha(mid, 0.9), alpha(bg, 0.97)]}
        locations={[0, 0.42, 1]}
        style={styles.wallFade}
      />

      <View style={styles.wallHeader}>
        <Header ctx={ctx} />
      </View>

      <View style={[styles.wallContent, { paddingTop: showPosters ? 266 : 96 }]}>
        <View style={styles.wallIdentity}>
          <RingAvatar ctx={ctx} size={64} />
          <View style={styles.identityCopy}>
            <Name ctx={ctx} size={28} />
            <View style={styles.metaRow}>
              <Username ctx={ctx} />
              <IdentityTags ctx={ctx} />
            </View>
          </View>
        </View>
        {options.note ? (
          <View style={{ marginTop: 8 }}>
            <Note ctx={ctx} />
          </View>
        ) : null}

        {options.showStats ? <StatStrip ctx={ctx} style={styles.wallStats} /> : null}

        {showPerde ? (
          <Glass radius={18} style={[styles.perdePanel, { marginTop: 8 }]}>
            <PerdeModule ctx={ctx} bare />
          </Glass>
        ) : null}

        <ExtrasBlock ctx={ctx} style={styles.wallExtras} />

        <View style={styles.wallFooter}>
          <Footer ctx={ctx} />
        </View>
      </View>
    </View>
  );
}

// ── Düzen 4: Minimal (tipografik) ────────────────────────────────────────────
function MinimalLayout({ ctx }) {
  const { palette, options, perde, posters, stats, str, language, favoritesActive } = ctx;
  const showPerde = options.showPerde && perde;
  const showPosters = !favoritesActive && options.showPosters && posters.items.length > 0;
  const sub = daysHoursText(ctx);
  const count = 5;
  const posterW = 52;
  const posterH = Math.round(posterW * 1.5);
  return (
    <View style={styles.layout}>
      <Header ctx={ctx} />

      <View>
        <View style={styles.minimalIdentity}>
          <RingAvatar ctx={ctx} size={40} />
          <View style={styles.identityCopy}>
            <Name ctx={ctx} size={22} />
            <View style={styles.metaRow}>
              <Username ctx={ctx} />
              <IdentityTags ctx={ctx} />
            </View>
          </View>
        </View>
        {options.note ? (
          <View style={{ marginTop: 10 }}>
            <Note ctx={ctx} />
          </View>
        ) : null}
      </View>

      {options.showStats ? (
        <View>
          <Eyebrow color={palette.tint}>{str.totalTime}</Eyebrow>
          <View style={styles.minimalHeroRow}>
            <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.minimalHero}>
              {formatStoryNumber(stats.hours, language)}
            </CardText>
          </View>
          <View style={styles.minimalHeroMeta}>
            <CardText style={[styles.minimalHeroUnit, { color: palette.tint }]}>{str.hours}</CardText>
            {sub ? (
              <>
                <View style={styles.inlineDot} />
                <CardText numberOfLines={1} style={styles.minimalHeroSub}>
                  {sub}
                </CardText>
              </>
            ) : null}
          </View>
          <View style={styles.minimalList}>
            {[
              [str.movies, compact(ctx, stats.movies)],
              [str.shows, compact(ctx, stats.shows)],
              [str.episodes, compact(ctx, stats.episodes)],
            ].map(([label, value], index) => (
              <View
                key={label}
                style={[
                  styles.minimalListRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: alpha(WHITE, 0.2) },
                ]}
              >
                <CardText numberOfLines={1} style={styles.minimalListLabel}>
                  {label}
                </CardText>
                <CardText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.minimalListValue}>
                  {value}
                </CardText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {showPerde ? <PerdeModule ctx={ctx} /> : null}

      <ExtrasBlock ctx={ctx} style={{ gap: 8 }} />

      {favoritesActive ? <FavoritesRibbon ctx={ctx} layoutId="minimal" /> : null}

      {showPosters ? (
        <View style={[styles.posterRow, { height: posterH, justifyContent: posters.items.length >= count ? "space-between" : "center", gap: posters.items.length >= count ? 0 : 14 }]}>
          {posters.items.slice(0, count).map((item) => (
            <Poster key={item.key} item={item} width={posterW} height={posterH} ctx={ctx} />
          ))}
        </View>
      ) : null}

      <Footer ctx={ctx} />
    </View>
  );
}

// ── Düzen 5: Seçki (dört favori) ─────────────────────────────────────────────
// Dikey bütçe BURADA elle değil planPicksLayout ile (utils/profileStoryCard.js)
// hesaplanır; bu düzendeki her sabit yükseklik PICKS_BUDGET'tan gelir ve testle
// "her anahtar birleşiminde 600 piksele sığar" diye kilitlidir. Bölüm sırası:
// üst bilgi, kimlik (+not), favoriler, istatistik, Perde, tür/seri/rozet, altbilgi.
function PicksLayout({ ctx }) {
  const { options, perde, genres, streak, badgeInfo, favorites } = ctx;
  const showPerde = Boolean(options.showPerde && perde);
  const showGenres = Boolean(options.showGenres && genres?.top?.length > 0);
  const showStreak = Boolean(options.showStreak && streak);
  const showBadges = Boolean(options.showBadges && badgeInfo?.showcase?.length > 0);
  const plan = planPicksLayout({
    kinds: favorites.groups.map((group) => group.kind),
    hasNote: Boolean(options.note),
    showStats: Boolean(options.showStats),
    showPerde,
    showGenres,
    showPills: showStreak || showBadges,
  });
  return (
    <View style={styles.layout}>
      <Header ctx={ctx} />

      <View style={{ gap: PICKS_BUDGET.noteGap }}>
        <View style={[styles.identityRow, { height: PICKS_BUDGET.identity }]}>
          <RingAvatar ctx={ctx} size={40} />
          <View style={styles.identityCopy}>
            <Name ctx={ctx} size={22} />
            <View style={styles.metaRow}>
              <Username ctx={ctx} />
              <IdentityTags ctx={ctx} />
            </View>
          </View>
        </View>
        <Note ctx={ctx} />
      </View>

      {plan.shelf ? <FavoriteShelves ctx={ctx} plan={plan.shelf} /> : null}

      {options.showStats ? <StatStrip ctx={ctx} style={styles.statStrip} /> : null}

      {showPerde ? <PerdeModule ctx={ctx} /> : null}

      <ExtrasBlock ctx={ctx} style={{ gap: PICKS_BUDGET.extrasGap, alignItems: "center" }} centered nowrap />

      <Footer ctx={ctx} />
    </View>
  );
}

const LAYOUTS = {
  showcase: ShowcaseLayout,
  identity: IdentityLayout,
  wall: WallLayout,
  minimal: MinimalLayout,
  picks: PicksLayout,
};

const ProfileStoryCard = memo(function ProfileStoryCard({
  options,
  theme,
  language = "tr",
  profile,
  badges = [],
  badgeInfo = null,
  stats,
  perde = null,
  genres = null,
  streak = null,
  member = "",
  posters,
  favorites = null,
  str,
  onImageSettled,
}) {
  const { logo } = useAppLogo();
  const palette = getStoryPalette(options.themeId, theme?.accent || "#7C3AED", profile.ringColors);
  // Dört favori etkinse poster alanını o doldurur; Seçki favorisiz çizilemez.
  const favoritesActive = isFavoritesActive(options, favorites);
  const Layout = LAYOUTS[resolveStoryLayout(options.layout, favoritesActive)] || ShowcaseLayout;
  const ctx = {
    options,
    palette,
    language,
    profile,
    badges,
    badgeInfo,
    stats,
    perde,
    genres,
    streak,
    member,
    posters,
    favorites,
    favoritesActive,
    str,
    logo,
    onImageSettled,
  };

  return (
    <View style={styles.root}>
      <Background palette={palette} background={options.background} />
      <Layout ctx={ctx} />
    </View>
  );
});

export default ProfileStoryCard;

const styles = StyleSheet.create({
  root: {
    width: W,
    height: H,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#0A0710",
  },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomVignette: { position: "absolute", bottom: 0, left: 0, right: 0 },
  layout: {
    flex: 1,
    padding: PAD,
    justifyContent: "space-between",
  },

  glass: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  eyebrow: { fontSize: 8.5, fontWeight: "800", letterSpacing: 1.5 },

  // başlık
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 30 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoTile: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  brand: { color: WHITE, fontSize: 12.5, fontWeight: "900", letterSpacing: 1.2 },
  brandSub: { fontSize: 7.5, fontWeight: "800", letterSpacing: 1.8, marginTop: 1 },
  memberPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 26,
    maxWidth: 190,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  memberText: { flexShrink: 1, color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },

  // altbilgi
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 28,
  },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerBrandText: { color: WHITE, fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  footerCta: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 12,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  footerCtaText: { flexShrink: 1, color: "rgba(255,255,255,0.82)", fontSize: 9.5, fontWeight: "700", letterSpacing: 0.2 },

  // kimlik
  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityCopy: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1, minHeight: 20 },
  name: { color: WHITE, fontWeight: "900", letterSpacing: -0.5 },
  username: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 18,
    paddingHorizontal: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  tagText: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },

  // not
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  noteQuote: { fontSize: 24, lineHeight: 26, fontWeight: "900", marginTop: -1 },
  noteText: { flexShrink: 1, color: "rgba(255,255,255,0.88)", fontSize: 12, fontStyle: "italic", fontWeight: "500", lineHeight: 17, paddingTop: 2 },

  // poster
  poster: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  posterRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  posterEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { flexShrink: 1, color: "rgba(255,255,255,0.78)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.5 },
  sectionLine: { flex: 1, height: 1 },

  // Perde
  perdePanel: { height: 50, paddingHorizontal: 12, justifyContent: "center" },
  perdeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  perdeIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  perdeCopy: { flex: 1, minWidth: 0, gap: 6 },
  perdeTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  perdeLabel: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.1 },
  perdeName: { flexShrink: 1, color: WHITE, fontSize: 12.5, fontWeight: "800" },
  perdePct: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "900", minWidth: 34, textAlign: "right" },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.16)" },
  barFill: { height: 6, borderRadius: 3 },

  // bento
  bentoRow: { flexDirection: "row" },
  hero: { padding: 12, justifyContent: "space-between" },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  heroNumber: { flexShrink: 1, color: WHITE, fontSize: 38, fontWeight: "900", letterSpacing: -1.2, lineHeight: 42 },
  heroUnit: { fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroSub: { color: "rgba(255,255,255,0.66)", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 1 },
  statList: { paddingHorizontal: 12 },
  statListRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statListDot: { width: 6, height: 6, borderRadius: 3 },
  statListLabel: { flex: 1, color: "rgba(255,255,255,0.66)", fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
  statListValue: { color: WHITE, fontSize: 17, fontWeight: "900", letterSpacing: -0.4, maxWidth: 70, textAlign: "right" },

  // tür
  genreBars: { paddingHorizontal: 12, paddingVertical: 10, justifyContent: "space-between" },
  genreRows: { gap: 4 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 7, height: 12 },
  genreLabel: { width: 70, color: WHITE, fontSize: 10.5, fontWeight: "800" },
  genreTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" },
  genrePct: { width: 28, textAlign: "right", color: "rgba(255,255,255,0.66)", fontSize: 9, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chipText: { color: WHITE, fontSize: 10.5, fontWeight: "800" },
  chipPct: { fontSize: 9.5, fontWeight: "900" },
  // Seçki: tek satır, uzun ad kısalır (dikey bütçe tek satır varsayar).
  chipRowNoWrap: { flexWrap: "nowrap", maxWidth: W - PAD * 2 },
  chipShrink: { flexShrink: 1 },

  // seri
  streakTile: { paddingHorizontal: 12, paddingVertical: 10, justifyContent: "space-between" },
  streakHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  streakNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  streakNumber: { color: WHITE, fontSize: 28, fontWeight: "900", letterSpacing: -0.8, lineHeight: 30 },
  streakUnit: { color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  weekDots: { flexDirection: "row", gap: 4 },
  weekDot: { width: 7, height: 7, borderRadius: 4 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  streakPillValue: { color: WHITE, fontSize: 14, fontWeight: "900" },
  streakPillLabel: { color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  extrasRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  // rozet
  badgeIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  badgeRail: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, paddingHorizontal: 12 },
  badgeRailCopy: { gap: 2 },
  badgeRailHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  badgeCountRow: { flexDirection: "row", alignItems: "baseline" },
  badgeCount: { color: WHITE, fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  badgeTotal: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800" },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 32,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  badgePillCount: { color: WHITE, fontSize: 14, fontWeight: "900" },

  // kimlik düzeni (üyelik kartı)
  passWrap: { paddingTop: 36 },
  pass: { alignItems: "center", paddingTop: 45, paddingHorizontal: 18, paddingBottom: 14 },
  passAvatar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  passMeta: { alignItems: "center", gap: 4, marginTop: 1 },
  passHero: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  passHeroNumber: { color: WHITE, fontSize: 46, fontWeight: "900", letterSpacing: -1.8, lineHeight: 50, maxWidth: 210 },
  passUnit: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12, borderWidth: 1 },
  passUnitText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  passSub: { color: "rgba(255,255,255,0.66)", fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9, marginTop: -1 },
  passTrio: { flexDirection: "row", alignSelf: "stretch", marginTop: 10 },
  passTrioCell: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  passTrioValue: { alignSelf: "stretch", textAlign: "center", color: WHITE, fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  passTrioLabel: { color: "rgba(255,255,255,0.62)", fontSize: 8.5, fontWeight: "800", letterSpacing: 1.3, marginTop: 1 },
  passExtras: { gap: 8, alignItems: "center" },
  fan: { height: 96, flexDirection: "row", alignItems: "center", justifyContent: "center" },

  // sinematik duvar
  wallRoot: { flex: 1 },
  wall: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  wallGridWrap: { position: "absolute", left: -60, top: -64, width: 4 * 118, transform: [{ rotate: "-9deg" }] },
  wallGrid: { flexDirection: "row" },
  wallCol: { width: 118 },
  wallScrimTop: { position: "absolute", top: 0, left: 0, right: 0 },
  wallFade: { position: "absolute", top: 120, left: 0, right: 0, bottom: 0 },
  wallHeader: { position: "absolute", top: PAD, left: PAD, right: PAD },
  wallContent: { flex: 1, paddingHorizontal: PAD, paddingBottom: PAD },
  wallIdentity: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  wallStats: { flexDirection: "row", alignItems: "center", height: 54, marginTop: 10 },
  wallStat: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  wallStatValue: { alignSelf: "stretch", textAlign: "center", color: WHITE, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  wallStatLabel: { color: "rgba(255,255,255,0.62)", fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 1 },
  wallExtras: { gap: 8, marginTop: 10 },
  wallFooter: { marginTop: "auto" },

  // dört favori: şerit (eski düzenler) + raflar (Seçki)
  ribbon: { flexDirection: "row", alignItems: "center" },
  kindLabel: { flexDirection: "row", alignItems: "center", gap: 4, height: 14, marginBottom: 4 },
  kindLabelText: { flexShrink: 1, color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  shelfTitle: { height: 14, marginBottom: 8 },
  shelfPanel: { paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  shelfRow: { flexDirection: "row", alignItems: "flex-start" },
  shelfLabelCol: { width: SHELF_LABEL_W, marginRight: SHELF_LABEL_GAP, alignItems: "center", justifyContent: "center", gap: 2 },
  shelfLabelIcon: { width: 22, height: 22, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  shelfLabelText: { color: "rgba(255,255,255,0.72)", fontSize: 7.5, fontWeight: "800", letterSpacing: 0.4 },
  shelfSlots: { flexDirection: "row", alignItems: "flex-start" },
  shelfName: { marginTop: 4, height: 12, textAlign: "center", color: "rgba(255,255,255,0.82)", fontSize: 8.5, lineHeight: 12, fontWeight: "700" },
  statStrip: { flexDirection: "row", alignItems: "center", height: 54 },

  // minimal
  minimalIdentity: { flexDirection: "row", alignItems: "center", gap: 12 },
  minimalHeroRow: { flexDirection: "row", marginTop: 2 },
  minimalHero: { color: WHITE, fontSize: 76, fontWeight: "900", letterSpacing: -3.6, lineHeight: 80, maxWidth: W - PAD * 2 },
  minimalHeroMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  minimalHeroUnit: { fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  minimalHeroSub: { flexShrink: 1, color: "rgba(255,255,255,0.66)", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  inlineDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  minimalList: { marginTop: 10 },
  minimalListRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 34 },
  minimalListLabel: { color: "rgba(255,255,255,0.66)", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  minimalListValue: { color: WHITE, fontSize: 23, fontWeight: "900", letterSpacing: -0.8, maxWidth: 170, textAlign: "right" },
});

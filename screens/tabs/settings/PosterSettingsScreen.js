// screens/tabs/settings/PosterSettingsScreen.js
//
// Ayarlar > Poster görünümü. İki sekme:
//   • Düzen ve Boyutlar — önce ALAN seçilir (Listeler / Tümünü Gör / Ana ekran /
//     Eğlence / Kütüphane), canlı
//     önizleme ve kontroller yalnız o alanı gösterir. Eski ekran altı ayrı satırı
//     (her alan için sütun + köşe) aynı anda gösterip hangi ayarın nereyi değiştirdiğini
//     karıştırıyordu. Köşe beş kademeli (utils/posterCorners); önizleme gerçek ekran
//     oranıyla çizilir, seçici simgeleri ise kademeler ayırt edilsin diye abartılıdır.
//   • Poster Rozetleri — açıklamalı satırlar + rozet yığınının canlı önizlemesi.

import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useListLayoutSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "../../../utils/i18nText";
import { REMINDER_BADGE } from "../../../utils/reminderBadge";
import { POSTER_SIZES, posterSizeScale, railPosterWidth } from "../../../utils/posterSizes";
import {
  POSTER_CORNER_LEVELS,
  posterCornerIndex,
  posterCornerValueAt,
  posterCornerValues,
  scalePosterCorner,
} from "../../../utils/posterCorners";
import { SettingsSubScreen, SectionLabel, buildUiColors } from "./settingsUi";
import GlassTouchable from "../../../components/common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../../utils/liquidGlass";

// Önizleme posterleri tek renk olunca "kart" gibi duruyor; birkaç ton dönüşümlü.
const tileTone = (colors, index) =>
  [
    { bg: colors.accentDim, fg: colors.accent },
    { bg: colors.iconBlue, fg: colors.blue },
    { bg: colors.iconPurple, fg: colors.purple },
    { bg: colors.iconAmber, fg: colors.amber },
    { bg: colors.iconGreen, fg: colors.green },
  ][index % 5];

// Canlı önizleme için tek bir sahte poster karesi.
function PreviewTile({ width, radius, colors, index = 0 }) {
  const tone = tileTone(colors, index);
  return (
    <View
      style={{
        width,
        aspectRatio: 2 / 3,
        borderRadius: radius,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <AppIcon family="Ionicons" name="film-outline" size={Math.max(12, width * 0.3)} color={tone.fg} />
    </View>
  );
}

function PostListLayoutPreview({ layout, colors, tileWidth = 38, radius = 10 }) {
  const joined = layout === "joined";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: joined ? 0 : Math.round(tileWidth * 0.18) }}>
      {[0, 1, 2, 3].map((index) => {
        const first = index === 0;
        const last = index === 3;
        const tone = tileTone(colors, index);
        return (
          <View
            key={index}
            style={{
              width: tileWidth,
              aspectRatio: 2 / 3,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: tone.bg,
              borderWidth: 1,
              borderLeftWidth: joined && !first ? 0 : 1,
              borderColor: colors.border,
              borderTopLeftRadius: joined ? (first ? radius : 0) : radius,
              borderBottomLeftRadius: joined ? (first ? radius : 0) : radius,
              borderTopRightRadius: joined ? (last ? radius : 0) : radius,
              borderBottomRightRadius: joined ? (last ? radius : 0) : radius,
            }}
          >
            <AppIcon family="Ionicons" name="film-outline" size={Math.max(9, tileWidth * 0.36)} color={tone.fg} />
          </View>
        );
      })}
    </View>
  );
}

// Rozet önizlemesi: poster karesi + canlı aktif rozetlerin simülasyonu.
function BadgePreviewTile({ width, radius, colors, badges }) {
  const statusBadges = buildPosterBadgeOptions().filter(
    (b) => b.group === "status" && badges?.[b.key] !== false
  );
  const denseCount = statusBadges.length;
  const height = width * 1.5;
  const scale = width / 110;
  const densityScale = denseCount >= 6 ? 0.72 : denseCount >= 5 ? 0.78 : denseCount >= 4 ? 0.85 : 1.0;
  const effectiveScale = scale * densityScale;

  const edge = Math.max(4, Math.round(width * 0.05));
  const iconSize = Math.max(7, Math.round(12 * effectiveScale));
  const infoFontSize = Math.max(7.5, Math.round(10.5 * scale));
  const miniIconSize = Math.max(7, Math.round(9.5 * scale));
  const showRating = badges?.tmdbRating !== false;
  const showVotes = badges?.voteCount !== false && scale >= 0.8;
  const showDate = badges?.releaseDate !== false;
  const showCountdown = badges?.countdown !== false;

  return (
    <View style={{ width, height }}>
      <PreviewTile width={width} radius={radius} colors={colors} />
      {(showRating || showVotes) && (
        <View
          style={[
            ps.previewRatingPill,
            {
              right: edge,
              bottom: edge,
              paddingHorizontal: Math.max(3, Math.round(5 * scale)),
              paddingVertical: Math.max(1.5, Math.round(2 * scale)),
              borderRadius: Math.max(4, Math.round(8 * scale)),
              maxWidth: "88%",
            },
          ]}
        >
          {showRating && (
            <Text allowFontScaling={false} style={[ps.previewRatingText, { fontSize: infoFontSize }]}>
              ★ 8.4
            </Text>
          )}
          {showRating && showVotes && (
            <Text allowFontScaling={false} style={[ps.previewMutedText, { fontSize: infoFontSize }]}>
              •
            </Text>
          )}
          {showVotes && (
            <AppIcon family="Ionicons" name="people" size={miniIconSize} color="#64b4ff" />
          )}
        </View>
      )}
      {showCountdown && (
        <View
          style={[
            ps.previewCountdownPill,
            {
              top: edge,
              left: edge,
              paddingHorizontal: Math.max(3, Math.round(5 * scale)),
              paddingVertical: Math.max(1.5, Math.round(2 * scale)),
              borderRadius: Math.max(4, Math.round(8 * scale)),
            },
          ]}
        >
          <Text allowFontScaling={false} style={[ps.previewCountdownText, { fontSize: infoFontSize }]}>
            12g
          </Text>
        </View>
      )}
      {showDate && (
        <View
          style={[
            ps.previewDatePill,
            {
              top: edge,
              right: edge,
              paddingHorizontal: Math.max(3, Math.round(5 * scale)),
              paddingVertical: Math.max(1.5, Math.round(2 * scale)),
              borderRadius: Math.max(4, Math.round(8 * scale)),
            },
          ]}
        >
          <Text allowFontScaling={false} style={[ps.previewDateText, { fontSize: infoFontSize }]}>
            2026
          </Text>
        </View>
      )}
      {statusBadges.length > 0 && (
        <View
          style={[
            ps.badgePill,
            {
              left: edge,
              bottom: edge,
              gap: Math.max(1, Math.round(2 * effectiveScale)),
              paddingVertical: Math.max(1.5, Math.round(2.5 * effectiveScale)),
              paddingHorizontal: Math.max(1, Math.round(1.5 * effectiveScale)),
              borderRadius: Math.max(4, Math.round(6 * effectiveScale)),
              maxHeight: "90%",
            },
          ]}
        >
          {statusBadges.map((b) => (
            <AppIcon
              key={b.key}
              family="Ionicons"
              name={b.icon}
              size={iconSize}
              color={b.color}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// Rozet satırı: simge + ad + ne işe yaradığı + işaret. Tamamı tek dokunma hedefi.
function BadgeToggleRow({ item, enabled, colors, onChange, first }) {
  return (
    <GlassTouchable
      glass={false}
      style={[ps.badgeRow, !first && { borderTopWidth: 1, borderTopColor: colors.borderMuted }]}
      activeOpacity={0.72}
      onPress={() => onChange(item.key, !enabled)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={item.label}
      accessibilityHint={item.subtitle}
    >
      <View style={[ps.badgeRowIcon, { backgroundColor: enabled ? item.color : colors.closeBg }]}>
        <AppIcon family="Ionicons" name={item.icon} size={16} color={enabled ? colors.white : colors.muted} />
      </View>
      <View style={ps.badgeRowText}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[ps.badgeRowLabel, { color: enabled ? colors.text : colors.muted }]}
        >
          {item.label}
        </Text>
        <Text allowFontScaling={false} numberOfLines={2} style={[ps.badgeRowSub, { color: colors.muted }]}>
          {item.subtitle}
        </Text>
      </View>
      <View
        style={[
          ps.badgeCheck,
          {
            backgroundColor: enabled ? colors.accent : "transparent",
            borderColor: enabled ? colors.accent : colors.border,
          },
        ]}
      >
        {enabled ? <AppIcon family="Ionicons" name="checkmark" size={13} color={colors.white} /> : null}
      </View>
    </GlassTouchable>
  );
}

function BadgeGroup({ title, subtitle, items, badges, colors, onChange, onToggleAll }) {
  const enabledCount = items.filter((item) => badges?.[item.key] !== false).length;
  const allEnabled = enabledCount === items.length;
  return (
    <>
      <View style={ps.groupHeader}>
        <View style={{ flex: 1 }}>
          <SectionLabel color={colors.muted}>{title.toUpperCase()}</SectionLabel>
          <Text style={[ps.groupSub, { color: colors.muted }]}>
            {subtitle} · {enabledCount}/{items.length}
          </Text>
        </View>
        <GlassTouchable
          onPress={() => onToggleAll(items, !allEnabled)}
          activeOpacity={0.7}
          style={[ps.groupAction, { backgroundColor: colors.accentDim }]}
        >
          <Text style={[ps.groupActionText, { color: colors.accent }]}>
            {allEnabled
              ? i18nText("autoI18n.tumunu_kapat", "Tümünü kapat")
              : i18nText("autoI18n.tumunu_ac", "Tümünü aç")}
          </Text>
        </GlassTouchable>
      </View>
      <View style={[ps.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {items.map((item, index) => (
          <BadgeToggleRow
            key={item.key}
            item={item}
            first={index === 0}
            enabled={badges?.[item.key] !== false}
            colors={colors}
            onChange={onChange}
          />
        ))}
      </View>
    </>
  );
}

// Ayar başlığı: solda ad, sağda seçili değerin adı (vurgu renginde).
function ControlHeader({ title, value, colors }) {
  return (
    <View style={ps.controlHeader}>
      <Text allowFontScaling={false} style={[ps.controlTitle, { color: colors.text }]}>
        {title}
      </Text>
      {value ? (
        <Text allowFontScaling={false} style={[ps.controlValue, { color: colors.accent }]}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}

// Seçenek kutuları: her biri bir küçük görsel + ad. Köşe, sütun, boyut ve dizilim
// seçicilerinin ortak kabuğu.
function OptionTiles({ options, value, onChange, colors, compact = false }) {
  return (
    <View style={ps.optionRow}>
      {options.map((opt) => {
        const active = value === opt.value;
        const ink = active ? colors.accent : colors.muted;
        return (
          <GlassTouchable
            key={String(opt.value)}
            glass={false} // kartın içinde: iç içe cam kalabalık, seçim çerçevesi de camda çizilmez
            style={[
              ps.optionTile,
              compact && ps.optionTileCompact,
              {
                backgroundColor: active ? colors.accentDim : colors.cardAlt,
                borderColor: active ? colors.accent : colors.borderMuted,
              },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.72}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <View style={ps.optionVisual}>{opt.renderVisual(ink, active)}</View>
            <Text
              allowFontScaling={false}
              numberOfLines={compact ? 2 : 1}
              adjustsFontSizeToFit // beş sütunda "Redondeadas"/"Abgerundet" sığsın
              minimumFontScale={0.8}
              style={[ps.optionLabel, compact && ps.optionLabelCompact, { color: active ? colors.text : colors.muted }]}
            >
              {opt.label}
            </Text>
          </GlassTouchable>
        );
      })}
    </View>
  );
}

// Köşe simgeleri: gerçek oranla (değer × ~0.2) beş kademe gözle ayrılmıyor, bu yüzden
// 20×28'lik çerçevede eşit adımlarla abartılı çizilir (en çok genişliğin yarısı).
const CORNER_SWATCH_RADIUS = [1, 3.25, 5.5, 7.75, 10];

// Etiketler çizim anında çözülür: modül yüklenirken dondurulursa dil değişince eski dilde kalır.
const buildCornerLabels = () => ({
  sharp: i18nText("autoI18n.kose_koseli", "Köşeli"),
  subtle: i18nText("autoI18n.kose_hafif", "Hafif"),
  normal: i18nText("autoI18n.kose_normal", "Normal"),
  soft: i18nText("autoI18n.kose_yumusak", "Yumuşak"),
  round: i18nText("autoI18n.kose_yuvarlak", "Yuvarlak"),
});

const buildColumnLabels = () => ({
  3: i18nText("autoI18n.uclu_dizilim", "3'lü"),
  4: i18nText("autoI18n.dortlu_dizilim", "4'lü"),
});

const buildRailSizeLabels = () => ({
  normal: i18nText("autoI18n.varsayilan", "Varsayılan"),
  small: i18nText("autoI18n.kucuk", "Küçük"),
  xsmall: i18nText("autoI18n.daha_kucuk", "Daha küçük"),
});

const buildPostListLayoutOptions = () => [
  { value: "spaced", label: i18nText("autoI18n.aralikli", "Aralıklı") },
  { value: "joined", label: i18nText("autoI18n.bitisik", "Bitişik") },
];

// Düzenlenen alanlar. `scale` köşe ölçeği (utils/posterCorners), `kind` ikinci ayar.
const buildAreas = () => [
  {
    id: "lists",
    scale: "grid",
    kind: "columns",
    icon: "grid-outline",
    label: i18nText("autoI18n.listeler", "Listeler"),
    hint: i18nText("autoI18n.poster_alan_listeler_ipucu", "Kütüphane'deki listelerin ve ortak listelerin içi"),
  },
  {
    id: "seeAll",
    scale: "grid",
    kind: "columns",
    icon: "apps-outline",
    label: i18nText("autoI18n.tumunu_gor", "Tümünü Gör"),
    hint: i18nText("autoI18n.poster_alan_tumunu_gor_ipucu", "Raflardaki \"Tümünü gör\" ile açılan sayfalar"),
  },
  {
    id: "rails",
    scale: "rail",
    kind: "size",
    icon: "film-outline",
    label: i18nText("autoI18n.ana_ekran", "Ana Ekran"),
    hint: i18nText("autoI18n.poster_alan_ana_ekran_ipucu", "Film ve Dizi rafları, Trendler ve detay sayfalarındaki posterler"),
  },
  // Göreli alanlar: her yüzeyin kendi köşesi seçili kademeyle ölçeklenir (utils/posterCorners).
  {
    id: "fun",
    scale: "grid",
    kind: "relative",
    icon: "game-controller-outline",
    label: i18nText("funTab", "Eğlence"),
    hint: i18nText(
      "autoI18n.poster_alan_eglence_ipucu",
      "Oyunlar, Top 100, turnuva, tier list, Film Kulübü, meydan okumalar ve CineSwipe"
    ),
  },
  {
    id: "library",
    scale: "grid",
    kind: "relative",
    icon: "library-outline",
    label: i18nText("library", "Kütüphane"),
    hint: i18nText(
      "autoI18n.poster_alan_kutuphane_ipucu",
      "Liste kapakları, Listelerim, Wrapped ve paylaşım kartı, hatırlatıcı önizlemesi"
    ),
  },
];

const buildPosterBadgeOptions = () => [
  {
    key: "watchlist",
    group: "status",
    icon: "bookmark",
    color: "#64b4ff",
    label: i18nText("autoI18n.izleme_listesi_rozeti", "İzleme listesi"),
    subtitle: i18nText("autoI18n.izleme_listesi_rozeti_aciklama", "İzleme listesine eklenen posterlerde göster"),
  },
  {
    key: "watched",
    group: "status",
    icon: "eye",
    color: "#29b864",
    label: i18nText("autoI18n.izlendi_rozeti", "İzlendi"),
    subtitle: i18nText("autoI18n.izlendi_rozeti_aciklama", "İzlenen film ve dizilerde göster"),
  },
  {
    key: "favorite",
    group: "status",
    icon: "heart",
    color: "#e33",
    label: i18nText("autoI18n.favori_rozeti", "Favori"),
    subtitle: i18nText("autoI18n.favori_rozeti_aciklama", "Favorilere alınan posterlerde göster"),
  },
  {
    key: "other",
    group: "status",
    icon: "grid",
    color: "#ff6400",
    label: i18nText("autoI18n.diger_liste_rozeti", "Diğer listeler"),
    subtitle: i18nText("autoI18n.diger_liste_rozeti_aciklama", "Özel listelerdeki posterlerde göster"),
  },
  {
    key: "shared",
    group: "status",
    icon: "people",
    color: "#38bdf8",
    label: i18nText("autoI18n.ortak_liste_rozeti", "Ortak"),
    subtitle: i18nText("autoI18n.ortak_liste_rozeti_aciklama", "Ortak listelerdeki posterlerde göster"),
  },
  {
    // Anahtar/simge/renk ListBadges ile ortak kayıttan (utils/reminderBadge.js).
    key: REMINDER_BADGE.key,
    group: "status",
    icon: REMINDER_BADGE.icon,
    color: REMINDER_BADGE.color,
    label: i18nText("autoI18n.hatirlatma_rozeti", "Hatırlatma"),
    subtitle: i18nText("autoI18n.hatirlatma_rozeti_aciklama", "Hatırlatma kurduğun yaklaşan film ve dizilerde göster"),
  },
  {
    key: "rated",
    group: "status",
    icon: "star",
    color: "#FFEB3B",
    label: i18nText("autoI18n.benim_puanim_rozeti", "Benim"),
    subtitle: i18nText("autoI18n.puan_rozeti_aciklama", "Puanladığın içeriklerde göster"),
  },
  {
    key: "commented",
    group: "status",
    icon: "chatbubble",
    color: "#c060e0",
    label: i18nText("autoI18n.yorum_rozeti", "Yorum"),
    subtitle: i18nText("autoI18n.yorum_rozeti_aciklama", "Yorum yaptığın içeriklerde göster"),
  },
  {
    key: "tmdbRating",
    group: "info",
    icon: "star-half",
    color: "#f59e0b",
    label: i18nText("autoI18n.tmdb_puani_rozeti", "TMDB"),
    subtitle: i18nText("autoI18n.tmdb_puani_rozeti_aciklama", "Posterlerdeki TMDB puanını göster"),
  },
  {
    key: "voteCount",
    group: "info",
    icon: "people",
    color: "#3b82f6",
    label: i18nText("autoI18n.oy_sayisi_rozeti", "Oy"),
    subtitle: i18nText("autoI18n.oy_sayisi_rozeti_aciklama", "Puan pillindeki oy sayısını göster"),
  },
  {
    key: "releaseDate",
    group: "info",
    icon: "calendar",
    color: "#94a3b8",
    label: i18nText("autoI18n.tarih_rozeti", "Tarih"),
    subtitle: i18nText("autoI18n.tarih_rozeti_aciklama", "Poster tarih/yıl rozetlerini göster"),
  },
  {
    key: "countdown",
    group: "info",
    icon: "timer",
    color: "#22c55e",
    label: i18nText("autoI18n.geri_sayim_rozeti", "Sayaç"),
    subtitle: i18nText("autoI18n.geri_sayim_rozeti_aciklama", "Geri sayım ve kalan gün rozetlerini göster"),
  },
];

// Gerçek poster genişliği (pt) — önizlemedeki köşe bununla orantılanır.
// Izgara: SeeAll/Listeler kenar boşluğu + 8 pt aralık; raf: useRailPosterStyle.
const realGridWidth = (windowWidth, columns) => (windowWidth - 24 - 8 * (columns - 1)) / columns;
const realRailWidth = railPosterWidth;

// Seçili alanın gerçek orandaki önizlemesi. Raf posterleri sahneden taşar (yatay kaydırma hissi).
function AreaPreview({ area, settings, colors, stageWidth, windowWidth }) {
  if (!stageWidth) return null;
  if (area.kind === "relative") {
    // Farklı boyutlu afişler bir arada: büyük olan kendi tabanı (12), küçükler (6)
    // aynı kademeyle ölçeklenir — "her yüzey kendi köşesini korur" fikrini gösterir.
    const big = Math.round(stageWidth * 0.36);
    const small = Math.round(stageWidth * 0.17);
    return (
      <View style={[ps.stageRow, { gap: 10 }]}>
        <PreviewTile width={big} radius={scalePosterCorner(12, settings.radius)} colors={colors} />
        <View style={{ width: small * 2 + 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {[1, 2, 3, 4].map((i) => (
            <PreviewTile key={i} index={i} width={small} radius={scalePosterCorner(6, settings.radius)} colors={colors} />
          ))}
        </View>
      </View>
    );
  }
  if (area.kind === "columns") {
    const columns = settings.columns;
    const gap = 6;
    const tileWidth = (stageWidth - gap * (columns - 1)) / columns;
    const radius = settings.radius * (tileWidth / realGridWidth(windowWidth, columns));
    return (
      <View style={[ps.stageRow, { gap }]}>
        {Array.from({ length: columns }).map((_, i) => (
          <PreviewTile key={i} index={i} width={tileWidth} radius={radius} colors={colors} />
        ))}
      </View>
    );
  }
  const k = stageWidth / windowWidth;
  const tileWidth = realRailWidth(windowWidth, settings.size) * k;
  return (
    <View style={[ps.stageRow, { gap: 10 * k, alignSelf: "flex-start" }]}>
      {[0, 1, 2].map((i) => (
        <PreviewTile key={i} index={i} width={tileWidth} radius={settings.radius * k} colors={colors} />
      ))}
    </View>
  );
}

function MiniGrid({ columns, ink }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: columns }).map((_, i) => (
        <View key={i} style={{ width: columns === 4 ? 6 : 8, height: 13, borderRadius: 1.5, backgroundColor: ink }} />
      ))}
    </View>
  );
}

export default function PosterSettingsScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const C = buildUiColors(theme);
  const AREAS = useMemo(buildAreas, [language]);
  const CORNER_LABELS = useMemo(buildCornerLabels, [language]);
  const COLUMN_LABELS = useMemo(buildColumnLabels, [language]);
  const RAIL_SIZE_LABELS = useMemo(buildRailSizeLabels, [language]);
  const POST_LIST_LAYOUT_OPTIONS = useMemo(buildPostListLayoutOptions, [language]);
  const POSTER_BADGE_OPTIONS = useMemo(buildPosterBadgeOptions, [language]);
  const {
    listsGridColumns,
    changeListsGridColumns,
    listsPosterRadius,
    changeListsPosterRadius,
    seeAllGridColumns,
    changeSeeAllGridColumns,
    seeAllPosterRadius,
    changeSeeAllPosterRadius,
    railPosterSize,
    changeRailPosterSize,
    railPosterRadius,
    changeRailPosterRadius,
    funPosterRadius,
    changeFunPosterRadius,
    libraryPosterRadius,
    changeLibraryPosterRadius,
    postListPosterLayout,
    changePostListPosterLayout,
    posterBadges,
    changePosterBadges,
    changePosterBadge,
  } = useListLayoutSettings();

  const [activeTab, setActiveTab] = useState("layout"); // "layout" | "badges"
  const [areaId, setAreaId] = useState("lists"); // "lists" | "seeAll" | "rails"
  const [stageWidth, setStageWidth] = useState(0);

  // Alan başına okunan/yazılan değerler — ekranın geri kalanı alanı bilmeden çalışır.
  const areaSettings = {
    lists: {
      columns: listsGridColumns,
      onColumns: changeListsGridColumns,
      radius: listsPosterRadius,
      onRadius: changeListsPosterRadius,
    },
    seeAll: {
      columns: seeAllGridColumns,
      onColumns: changeSeeAllGridColumns,
      radius: seeAllPosterRadius,
      onRadius: changeSeeAllPosterRadius,
    },
    rails: {
      size: railPosterSize,
      onSize: changeRailPosterSize,
      radius: railPosterRadius,
      onRadius: changeRailPosterRadius,
    },
    fun: { radius: funPosterRadius, onRadius: changeFunPosterRadius },
    library: { radius: libraryPosterRadius, onRadius: changeLibraryPosterRadius },
  };
  const area = AREAS.find((a) => a.id === areaId) || AREAS[0];
  const current = areaSettings[area.id];
  const cornerIndexOf = (a) => posterCornerIndex(a.scale, areaSettings[a.id].radius);
  const currentCornerIndex = cornerIndexOf(area);
  const cornerLabelAt = (index) => CORNER_LABELS[POSTER_CORNER_LEVELS[index]];
  const cornersDiffer = AREAS.some((a) => cornerIndexOf(a) !== currentCornerIndex);

  const areaSummary = (a) => {
    const s = areaSettings[a.id];
    if (a.kind === "relative") return cornerLabelAt(cornerIndexOf(a));
    const first = a.kind === "columns" ? COLUMN_LABELS[s.columns] : RAIL_SIZE_LABELS[s.size];
    // İki satır: dar telefonda "Varsayılan · Yumuşak" tek satıra sığmıyor.
    return `${first}
${cornerLabelAt(cornerIndexOf(a))}`;
  };

  // Aynı kademe her alana kendi ölçeğinden yazılır (ızgara 15 ≠ raf 15).
  const applyCornerToAll = () => {
    AREAS.forEach((a) => {
      if (a.id === area.id) return;
      areaSettings[a.id].onRadius(posterCornerValueAt(a.scale, currentCornerIndex));
    });
  };

  const cornerOptions = posterCornerValues(area.scale).map((value, i) => ({
    value,
    label: cornerLabelAt(i),
    renderVisual: (ink) => (
      <View style={[ps.cornerSwatch, { borderRadius: CORNER_SWATCH_RADIUS[i], borderColor: ink }]} />
    ),
  }));

  const secondOptions =
    area.kind === "columns"
      ? [3, 4].map((value) => ({
          value,
          label: COLUMN_LABELS[value],
          renderVisual: (ink) => <MiniGrid columns={value} ink={ink} />,
        }))
      : POSTER_SIZES.map((value) => ({
          value,
          label: RAIL_SIZE_LABELS[value],
          renderVisual: (ink) => (
            <View
              style={{
                width: Math.round(13 * posterSizeScale(value)),
                height: Math.round(19 * posterSizeScale(value)),
                borderRadius: 2.5,
                backgroundColor: ink,
              }}
            />
          ),
        }));

  const postLayoutOptions = POST_LIST_LAYOUT_OPTIONS.map((opt) => ({
    ...opt,
    renderVisual: () => <PostListLayoutPreview layout={opt.value} colors={C} tileWidth={20} radius={5} />,
  }));

  // Rozet önizleme posteri raf boyutunu izler (Varsayılan 96 · Küçük 82 · Daha küçük 69).
  const badgePreviewWidth = Math.round(96 * posterSizeScale(railPosterSize));
  const enabledBadgeCount = POSTER_BADGE_OPTIONS.filter(
    (item) => posterBadges?.[item.key] !== false
  ).length;
  const statusBadgeOptions = POSTER_BADGE_OPTIONS.filter((item) => item.group === "status");
  const infoBadgeOptions = POSTER_BADGE_OPTIONS.filter((item) => item.group === "info");

  const toggleBadgeGroup = (items, enabled) => {
    const patch = Object.fromEntries(items.map((item) => [item.key, enabled]));
    changePosterBadges({ ...posterBadges, ...patch });
  };

  const tabs = [
    {
      id: "layout",
      icon: "crop-outline",
      label: i18nText("autoI18n.duzen_ve_boyutlar", "Düzen ve Boyutlar"),
    },
    {
      id: "badges",
      icon: "pricetags-outline",
      label: i18nText("autoI18n.rozetler", "Rozetler"),
      count: `${enabledBadgeCount}/${POSTER_BADGE_OPTIONS.length}`,
    },
  ];

  return (
    <SettingsSubScreen title={i18nText("autoI18n.poster_gorunumu", "Poster görünümü")}>
      {/* ── SEKMELER ── */}
      <View style={[ps.tabBar, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <GlassTouchable
              key={tab.id}
              style={[ps.tabButton, active && { backgroundColor: C.card }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <AppIcon family="Ionicons" name={tab.icon} size={15} color={active ? C.accent : C.muted} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[ps.tabButtonText, { color: active ? C.text : C.muted }, active && ps.tabButtonTextActive]}
              >
                {tab.label}
              </Text>
              {tab.count ? (
                <View style={[ps.tabCount, { backgroundColor: active ? C.accentDim : C.closeBg }]}>
                  <Text allowFontScaling={false} style={[ps.tabCountText, { color: active ? C.accent : C.muted }]}>
                    {tab.count}
                  </Text>
                </View>
              ) : null}
            </GlassTouchable>
          );
        })}
      </View>

      {/* ── SEKME 1: DÜZEN VE BOYUTLAR ── */}
      {activeTab === "layout" && (
        <>
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.poster_ayar_alani", "Düzenlenecek alan").toUpperCase()}
          </SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ps.areaScroller} contentContainerStyle={ps.areaRow}>
            {AREAS.map((a) => {
              const active = a.id === area.id;
              return (
                <GlassTouchable
                  key={a.id}
                  style={[
                    ps.areaTile,
                    {
                      backgroundColor: active ? C.accentDim : C.card,
                      borderColor: active ? C.accent : C.border,
                    },
                  ]}
                  onPress={() => setAreaId(a.id)}
                  activeOpacity={0.75}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <View style={ps.areaTileTop}>
                    <AppIcon family="Ionicons" name={a.icon} size={17} color={C.accent} />
                    <Text allowFontScaling={false} numberOfLines={2} style={[ps.areaLabel, { color: C.text }]}>
                      {a.label}
                    </Text>
                    {active ? <AppIcon family="Ionicons" name="checkmark-circle" size={16} color={C.accent} /> : null}
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[ps.areaSummary, { color: C.muted }]}
                  >
                    {areaSummary(a)}
                  </Text>
                </GlassTouchable>
              );
            })}
          </ScrollView>

          <View style={[ps.card, ps.editorCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={ps.editorHeading}>
              <View style={[ps.editorIcon, { backgroundColor: C.accentDim }]}>
                <AppIcon family="Ionicons" name={area.icon} size={19} color={C.accent} />
              </View>
              <View style={ps.editorHeadingCopy}>
                <Text style={[ps.editorTitle, { color: C.text }]}>{area.label}</Text>
                <Text style={[ps.hintText, { color: C.muted }]}>{area.hint}</Text>
              </View>
            </View>

            {/* Gerçek oranlı canlı önizleme */}
            <View style={[ps.stage, { backgroundColor: C.bg, borderColor: C.borderMuted }]}>
              <View
                style={[ps.stageInner, { height: stageWidth ? stageWidth * 0.6 : 150 }]}
                onLayout={(e) => setStageWidth(Math.round(e.nativeEvent.layout.width))}
              >
                <AreaPreview
                  area={area}
                  settings={current}
                  colors={C}
                  stageWidth={stageWidth}
                  windowWidth={windowWidth}
                />
              </View>
            </View>

            {area.kind === "relative" ? null : (
              <View style={[ps.primaryControl, { borderBottomColor: C.borderMuted }]}>
                <ControlHeader
                  title={area.kind === "columns"
                    ? i18nText("autoI18n.sutun_sayisi", "Sütun sayısı")
                    : i18nText("autoI18n.poster_boyutu", "Poster boyutu")}
                  value={area.kind === "columns" ? COLUMN_LABELS[current.columns] : RAIL_SIZE_LABELS[current.size]}
                  colors={C}
                />
                <OptionTiles
                  options={secondOptions}
                  value={area.kind === "columns" ? current.columns : current.size}
                  onChange={area.kind === "columns" ? current.onColumns : current.onSize}
                  colors={C}
                />
              </View>
            )}

            <ControlHeader
              title={i18nText("autoI18n.kose_yuvarlakligi", "Köşe yuvarlaklığı")}
              value={cornerLabelAt(currentCornerIndex)}
              colors={C}
            />
            {area.kind === "relative" ? (
              <Text style={[ps.hintText, ps.controlHint, { color: C.muted }]}>
                {i18nText(
                  "autoI18n.poster_goreli_aciklama",
                  "Normal, her ekranın kendi köşesidir; diğer seçenekler bunu oranla azaltır ya da artırır."
                )}
              </Text>
            ) : null}
            <OptionTiles
              options={cornerOptions}
              value={posterCornerValueAt(area.scale, currentCornerIndex)}
              onChange={current.onRadius}
              colors={C}
              compact
            />
            {cornersDiffer ? (
              <GlassTouchable
                glass={false}
                style={ps.applyAll}
                onPress={applyCornerToAll}
                activeOpacity={0.7}
              >
                <AppIcon family="Ionicons" name="copy-outline" size={14} color={C.accent} />
                <Text allowFontScaling={false} style={[ps.applyAllText, { color: C.accent }]}>
                  {i18nText("autoI18n.tum_alanlara_uygula", "Bu köşeyi tüm alanlara uygula")}
                </Text>
              </GlassTouchable>
            ) : null}

          </View>

          {/* Paylaşılan liste kapakları — alandan bağımsız tek ayar */}
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.paylasim_liste_posterleri", "PAYLAŞIM KARTLARI").toUpperCase()}
          </SectionLabel>
          <View style={[ps.card, ps.editorCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <ControlHeader
              title={i18nText("autoI18n.liste_poster_dizilimi", "Liste Poster Dizilimi")}
              colors={C}
            />
            <Text style={[ps.hintText, ps.controlHint, { color: C.muted }]}>
              {i18nText(
                "autoI18n.liste_poster_dizilimi_aciklama",
                "Sosyal akışta paylaşılan liste kapaklarının görünüm düzeni"
              )}
            </Text>
            <OptionTiles
              options={postLayoutOptions}
              value={postListPosterLayout}
              onChange={changePostListPosterLayout}
              colors={C}
            />
          </View>
        </>
      )}

      {/* ── SEKME 2: POSTER ROZETLERİ ── */}
      {activeTab === "badges" && (
        <>
          <View style={[ps.card, ps.badgeHero, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[ps.badgeStage, { backgroundColor: C.bg, borderColor: C.borderMuted }]}>
              <BadgePreviewTile
                width={badgePreviewWidth}
                radius={railPosterRadius * (badgePreviewWidth / realRailWidth(windowWidth, railPosterSize))}
                colors={C}
                badges={posterBadges}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ps.badgeHeroTitle, { color: C.text }]}>
                {i18nText("autoI18n.rozetleri_goster", "Rozetleri Göster")}
              </Text>
              <Text style={[ps.hintText, { color: C.muted, marginTop: 4 }]}>
                {i18nText(
                  "autoI18n.rozetleri_goster_aciklama",
                  "Kapattığın rozet türü posterlerin üzerinde hiç görünmez"
                )}
              </Text>
            </View>
          </View>

          <BadgeGroup
            title={i18nText("autoI18n.liste_durumlari", "Liste Durumları")}
            subtitle={i18nText(
              "autoI18n.liste_durumlari_aciklama",
              "İzleme, favori ve kişisel etkileşimlerin"
            )}
            items={statusBadgeOptions}
            badges={posterBadges}
            colors={C}
            onChange={changePosterBadge}
            onToggleAll={toggleBadgeGroup}
          />

          <BadgeGroup
            title={i18nText("autoI18n.icerik_bilgileri", "İçerik Bilgileri")}
            subtitle={i18nText(
              "autoI18n.icerik_bilgileri_aciklama",
              "Puan, oy, tarih ve geri sayım etiketleri"
            )}
            items={infoBadgeOptions}
            badges={posterBadges}
            colors={C}
            onChange={changePosterBadge}
            onToggleAll={toggleBadgeGroup}
          />
        </>
      )}
    </SettingsSubScreen>
  );
}

const ps = StyleSheet.create({
  // Sekmeler
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabButtonText: { flexShrink: 1, fontSize: 13, fontWeight: "600" },
  tabButtonTextActive: { fontWeight: "800" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tabCountText: { fontSize: 10.5, fontWeight: "800" },

  // Alan seçici: diğer alanın ucu görünür, yatay kaydırma keşfedilir.
  // Basılan cam karo yatay kaydırıcının kırpma sınırında kesilmesin: üst/alt GLASS_PRESS_ROOM
  // dolgu, aynı kadar eksi marj (yerleşim değişmez).
  areaScroller: { marginHorizontal: -4, marginTop: 8 - GLASS_PRESS_ROOM, marginBottom: 2 - GLASS_PRESS_ROOM },
  areaRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingVertical: GLASS_PRESS_ROOM },
  areaTile: {
    width: 152,
    minHeight: 86,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 11,
    justifyContent: "center",
    gap: 5,
  },
  areaTileTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  areaLabel: { flex: 1, fontSize: 13, fontWeight: "800" },
  areaSummary: { fontSize: 10.5, lineHeight: 13, fontWeight: "600" },

  // Kartlar
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  editorCard: { marginTop: 12, padding: 14 },
  editorHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  editorIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  editorHeadingCopy: { flex: 1, minWidth: 0 },
  editorTitle: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  hintText: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
  controlHint: { marginTop: -4, marginBottom: 10 },
  primaryControl: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 16, marginBottom: 16 },

  // Sahne (önizleme)
  stage: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 14,
    padding: 12,
    overflow: "hidden",
  },
  stageInner: { width: "100%", justifyContent: "center", overflow: "hidden" },
  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  // Kontroller
  controlHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  controlTitle: { fontSize: 14, fontWeight: "800" },
  controlValue: { fontSize: 12.5, fontWeight: "800" },
  optionRow: { flexDirection: "row", gap: 6 },
  optionTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 7,
  },
  optionTileCompact: { paddingHorizontal: 2, paddingVertical: 9, minHeight: 74 },
  optionVisual: { minHeight: 28, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  optionLabelCompact: { fontSize: 10.5 },
  cornerSwatch: { width: 20, height: 28, borderWidth: 2 },
  applyAll: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
  },
  applyAllText: { fontSize: 12.5, fontWeight: "700" },

  // Rozetler
  badgeHero: { marginTop: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 14 },
  badgeStage: { borderRadius: 14, borderWidth: 1, padding: 10 },
  badgeHeroTitle: { fontSize: 15, fontWeight: "800" },
  groupHeader: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  groupSub: { fontSize: 11.5, marginTop: -4, marginBottom: 8, marginLeft: 4 },
  groupAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, marginBottom: 8 },
  groupActionText: { fontSize: 11.5, fontWeight: "800" },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  badgeRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeRowText: { flex: 1, minWidth: 0 },
  badgeRowLabel: { fontSize: 14, fontWeight: "700" },
  badgeRowSub: { fontSize: 11.5, marginTop: 1, lineHeight: 15 },
  badgeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  // Rozet önizleme pilleri
  badgePill: {
    position: "absolute",
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  previewRatingPill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  previewRatingText: { color: "#f59e0b", fontSize: 8, fontWeight: "800" },
  previewMutedText: { color: "rgba(255,255,255,0.65)", fontSize: 8, fontWeight: "800" },
  previewCountdownPill: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(34,197,94,0.88)",
  },
  previewCountdownText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  previewDatePill: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  previewDateText: { color: "#fff", fontSize: 8, fontWeight: "800" },
});

// screens/tabs/settings/PosterSettingsScreen.js
//
// Ayarlar > Poster görünümü. Liste, "Tümünü Gör" ve ana ekran raflarındaki
// poster boyutu + köşe yuvarlaklığı + sütun sayısı ayarları ve rozet özelleştirmeleri.
// Kafa karıştırıcı tekrarları önleyen Canlı Önizleme Stüdyosu ve sekmeli kontrol
// yapısı ile modernize edilmiştir.

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useListLayoutSettings } from "@context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import { SettingsSubScreen, SectionLabel, buildUiColors } from "./settingsUi";

// Canlı önizleme için tek bir sahte poster karesi.
function PreviewTile({ width, radius, colors, title }) {
  return (
    <View
      style={{
        width,
        aspectRatio: 2 / 3,
        borderRadius: radius,
        backgroundColor: colors.accentDim,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <AppIcon
        family="Ionicons"
        name="film-outline"
        size={Math.max(14, width * 0.34)}
        color={colors.accent}
      />
      {title ? (
        <Text
          allowFontScaling={false}
          style={{
            position: "absolute",
            bottom: 4,
            fontSize: 7.5,
            fontWeight: "700",
            color: colors.text,
            backgroundColor: colors.card,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 4,
          }}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}

function PostListLayoutPreview({ layout, colors }) {
  const joined = layout === "joined";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: joined ? 0 : 7 }}>
      {[0, 1, 2, 3].map((index) => {
        const first = index === 0;
        const last = index === 3;
        return (
          <View
            key={index}
            style={{
              width: 38,
              aspectRatio: 2 / 3,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: colors.accentDim,
              borderWidth: 1,
              borderLeftWidth: joined && !first ? 0 : 1,
              borderColor: colors.border,
              borderTopLeftRadius: joined ? (first ? 10 : 0) : 10,
              borderBottomLeftRadius: joined ? (first ? 10 : 0) : 10,
              borderTopRightRadius: joined ? (last ? 10 : 0) : 10,
              borderBottomRightRadius: joined ? (last ? 10 : 0) : 10,
            }}
          >
            <AppIcon
              family="Ionicons"
              name="film-outline"
              size={15}
              color={colors.accent}
            />
          </View>
        );
      })}
    </View>
  );
}

// Rozet önizlemesi: poster karesi + canlı aktif rozetlerin simülasyonu.
function BadgePreviewTile({ width, radius, colors, badges }) {
  const statusBadges = POSTER_BADGE_OPTIONS.filter(
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

function BadgeToggleButton({ item, enabled, colors, onChange }) {
  return (
    <TouchableOpacity
      style={[
        ps.badgeButton,
        {
          backgroundColor: enabled ? item.color + "22" : colors.cardAlt,
          borderColor: enabled ? item.color + "88" : colors.borderMuted,
        },
      ]}
      activeOpacity={0.72}
      onPress={() => onChange(item.key, !enabled)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled }}
    >
      <View
        style={[
          ps.badgeButtonIcon,
          { backgroundColor: enabled ? item.color : colors.closeBg },
        ]}
      >
        <AppIcon
          family="Ionicons"
          name={item.icon}
          size={17}
          color={enabled ? colors.white : colors.muted}
        />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[ps.badgeButtonLabel, { color: enabled ? colors.text : colors.muted }]}
      >
        {item.label}
      </Text>
      <View
        style={[
          ps.badgeCheck,
          {
            backgroundColor: enabled ? item.color : "transparent",
            borderColor: enabled ? item.color : colors.border,
          },
        ]}
      >
        {enabled ? (
          <AppIcon family="Ionicons" name="checkmark" size={10} color="#fff" />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function BadgeGroup({ title, subtitle, items, badges, colors, onChange, onToggleAll }) {
  const enabledCount = items.filter((item) => badges?.[item.key] !== false).length;
  const allEnabled = enabledCount === items.length;
  return (
    <View style={[ps.badgeGroup, { borderTopColor: colors.borderMuted }]}>
      <View style={ps.badgeGroupHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[ps.badgeGroupTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[ps.badgeGroupSub, { color: colors.muted }]}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onToggleAll(items, !allEnabled)}
          activeOpacity={0.7}
          style={[ps.groupAction, { backgroundColor: colors.accentDim }]}
        >
          <Text style={[ps.groupActionText, { color: colors.accent }]}>
            {allEnabled
              ? i18nText("autoI18n.tumunu_kapat", "Tümünü kapat")
              : i18nText("autoI18n.tumunu_ac", "Tümünü aç")}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={ps.badgeButtonGrid}>
        {items.map((item) => (
          <BadgeToggleButton
            key={item.key}
            item={item}
            enabled={badges?.[item.key] !== false}
            colors={colors}
            onChange={onChange}
          />
        ))}
      </View>
    </View>
  );
}

function SummaryChip({ icon, label, value, colors }) {
  return (
    <View style={[ps.summaryChip, { backgroundColor: colors.cardAlt, borderColor: colors.borderMuted }]}>
      <AppIcon family="Ionicons" name={icon} size={14} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[ps.summaryLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[ps.summaryValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// Başlık ve seçenekleri tek satırda tutan kompakt ayar kontrolü.
function ControlRow({ icon, iconFamily = "Ionicons", title, options, value, onChange, colors }) {
  return (
    <View style={[ps.compactControl, { borderTopColor: colors.borderMuted }]}>
      <View style={ps.compactControlLabel}>
        <View style={[ps.compactControlIcon, { backgroundColor: colors.accentDim }]}>
          <AppIcon family={iconFamily} name={icon} size={14} color={colors.accent} />
        </View>
        <Text numberOfLines={2} style={[ps.compactControlTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      <View style={[ps.compactOptions, { backgroundColor: colors.cardAlt }]}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              style={[ps.compactOption, active && { backgroundColor: colors.accent }]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.72}
            >
              {opt.r != null ? (
                <View
                  style={{
                    width: 9,
                    height: 12,
                    borderRadius: Math.min(opt.r, 5),
                    borderWidth: 1.2,
                    borderColor: active ? colors.white : colors.muted,
                  }}
                />
              ) : null}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  ps.compactOptionText,
                  { color: active ? colors.white : colors.muted },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const COLUMN_OPTIONS = [
  { value: 3, label: i18nText("autoI18n.uclu_dizilim", "3'lü") },
  { value: 4, label: i18nText("autoI18n.dortlu_dizilim", "4'lü") },
];

const GRID_RADIUS_OPTIONS = [
  { value: 2, label: i18nText("autoI18n.kose_koseli", "Köşeli"), r: 3 },
  { value: 10, label: i18nText("autoI18n.kose_normal", "Normal"), r: 7 },
  { value: 20, label: i18nText("autoI18n.kose_yuvarlak", "Yuvarlak"), r: 12 },
];

const RAIL_RADIUS_OPTIONS = [
  { value: 4, label: i18nText("autoI18n.kose_koseli", "Köşeli"), r: 3 },
  { value: 15, label: i18nText("autoI18n.kose_normal", "Normal"), r: 8 },
  { value: 24, label: i18nText("autoI18n.kose_yuvarlak", "Yuvarlak"), r: 12 },
];

const RAIL_SIZE_OPTIONS = [
  { value: "normal", label: i18nText("autoI18n.varsayilan", "Varsayılan") },
  { value: "small", label: i18nText("autoI18n.kucuk", "Küçük") },
];

const POST_LIST_LAYOUT_OPTIONS = [
  { value: "spaced", label: i18nText("autoI18n.aralikli", "Aralıklı") },
  { value: "joined", label: i18nText("autoI18n.bitisik", "Bitişik") },
];

const POSTER_BADGE_OPTIONS = [
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

const PREVIEW_MODES = [
  { id: "lists", label: i18nText("autoI18n.listeler", "Listeler"), icon: "grid-outline" },
  { id: "seeAll", label: i18nText("autoI18n.tumunu_gor", "Tümünü Gör"), icon: "apps-outline" },
  { id: "rails", label: i18nText("autoI18n.ana_ekran", "Ana Ekran"), icon: "film-outline" },
  { id: "posts", label: i18nText("autoI18n.paylasimlar", "Paylaşımlar"), icon: "albums-outline" },
  { id: "badges", label: i18nText("autoI18n.rozetler", "Rozetler"), icon: "pricetags-outline" },
];

export default function PosterSettingsScreen() {
  const { theme } = useTheme();
  const C = buildUiColors(theme);
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
    postListPosterLayout,
    changePostListPosterLayout,
    posterBadges,
    changePosterBadges,
    changePosterBadge,
  } = useListLayoutSettings();

  const [activeTab, setActiveTab] = useState("layout"); // "layout" | "badges"
  const [previewMode, setPreviewMode] = useState("lists"); // "lists" | "seeAll" | "rails" | "posts" | "badges"

  // Önizleme genişlikleri
  const gridWidth = (cols) => (cols === 4 ? 38 : 48);
  const railWidth = railPosterSize === "small" ? 40 : 50;
  const badgeWidth = railPosterSize === "small" ? 82 : 94;

  const enabledBadgeCount = POSTER_BADGE_OPTIONS.filter(
    (item) => posterBadges?.[item.key] !== false
  ).length;

  const statusBadgeOptions = POSTER_BADGE_OPTIONS.filter((item) => item.group === "status");
  const infoBadgeOptions = POSTER_BADGE_OPTIONS.filter((item) => item.group === "info");

  const toggleBadgeGroup = (items, enabled) => {
    const patch = Object.fromEntries(items.map((item) => [item.key, enabled]));
    changePosterBadges({ ...posterBadges, ...patch });
  };

  // Sekme değiştirilirken önizleme modunu da ilgili sekmeye uygun ayarla
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "badges") {
      setPreviewMode("badges");
    } else if (previewMode === "badges") {
      setPreviewMode("lists");
    }
  };

  return (
    <SettingsSubScreen title={i18nText("autoI18n.poster_gorunumu", "Poster görünümü")}>
      {/* ── MASTER CANLI ÖNİZLEME STÜDYOSU (HERO STUDIO) ── */}
      <View style={[ps.studioCard, { backgroundColor: C.card, borderColor: C.border }]}>
        {/* Studio Üst Başlık Barı */}
        <View style={ps.studioHeader}>
          <View style={[ps.studioBadge, { backgroundColor: C.accentDim }]}>
            <AppIcon family="Ionicons" name="color-palette-outline" size={16} color={C.accent} />
          </View>
          <Text style={[ps.studioTitle, { color: C.text }]}>
            {i18nText("autoI18n.canli_onizleme_studyo", "Canlı Önizleme Stüdyosu")}
          </Text>
          <View style={[ps.livePill, { backgroundColor: C.iconGreen }]}>
            <View style={[ps.liveDot, { backgroundColor: C.green }]} />
            <Text style={[ps.liveText, { color: C.green }]}>
              {i18nText("autoI18n.canli", "CANLI")}
            </Text>
          </View>
        </View>

        {/* Önizleme Modu Seçicisi */}
        <View style={[ps.modePicker, { backgroundColor: C.cardAlt }]}>
          {PREVIEW_MODES.map((m) => {
            const active = previewMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  ps.modeChip,
                  active && { backgroundColor: C.accent, shadowColor: C.accent },
                ]}
                onPress={() => setPreviewMode(m.id)}
                activeOpacity={0.75}
              >
                <AppIcon
                  family="Ionicons"
                  name={m.icon}
                  size={12}
                  color={active ? C.white : C.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[ps.modeChipText, { color: active ? C.white : C.muted }]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Canlı Önizleme Ekranı (Stage) */}
        <View style={[ps.stage, { backgroundColor: C.bg, borderColor: C.borderMuted }]}>
          {previewMode === "lists" && (
            <View style={ps.stageRow}>
              {Array.from({ length: listsGridColumns }).map((_, i) => (
                <PreviewTile
                  key={i}
                  width={gridWidth(listsGridColumns)}
                  radius={listsPosterRadius}
                  colors={C}
                />
              ))}
            </View>
          )}

          {previewMode === "seeAll" && (
            <View style={ps.stageRow}>
              {Array.from({ length: seeAllGridColumns }).map((_, i) => (
                <PreviewTile
                  key={i}
                  width={gridWidth(seeAllGridColumns)}
                  radius={seeAllPosterRadius}
                  colors={C}
                />
              ))}
            </View>
          )}

          {previewMode === "rails" && (
            <View style={ps.stageRow}>
              {[0, 1, 2, 3].map((i) => (
                <PreviewTile key={i} width={railWidth} radius={railPosterRadius} colors={C} />
              ))}
            </View>
          )}

          {previewMode === "posts" && (
            <View style={ps.stageRow}>
              <PostListLayoutPreview layout={postListPosterLayout} colors={C} />
            </View>
          )}

          {previewMode === "badges" && (
            <View style={ps.stageRow}>
              <BadgePreviewTile
                width={badgeWidth}
                radius={railPosterRadius}
                colors={C}
                badges={posterBadges}
              />
            </View>
          )}
        </View>

        {/* Canlı Özet Çipler Barı */}
        <View style={ps.summaryRow}>
          <SummaryChip
            icon="grid-outline"
            label={i18nText("autoI18n.listeler", "Listeler")}
            value={`${listsGridColumns} ${i18nText("autoI18n.sutun", "sütun")}`}
            colors={C}
          />
          <SummaryChip
            icon="albums-outline"
            label={i18nText("autoI18n.ana_ekran", "Ana ekran")}
            value={
              railPosterSize === "small"
                ? i18nText("autoI18n.kucuk", "Küçük")
                : i18nText("autoI18n.varsayilan", "Varsayılan")
            }
            colors={C}
          />
          <SummaryChip
            icon="pricetags-outline"
            label={i18nText("autoI18n.rozetler", "Rozetler")}
            value={`${enabledBadgeCount}/${POSTER_BADGE_OPTIONS.length}`}
            colors={C}
          />
        </View>
      </View>

      {/* ── ANA KATEGORİ SEKMELERİ (TABS) ── */}
      <View style={[ps.tabBar, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
        <TouchableOpacity
          style={[ps.tabButton, activeTab === "layout" && { backgroundColor: C.card }]}
          onPress={() => handleTabChange("layout")}
          activeOpacity={0.8}
        >
          <AppIcon
            family="Feather"
            name="layout"
            size={14}
            color={activeTab === "layout" ? C.accent : C.muted}
          />
          <Text
            allowFontScaling={false}
            style={[
              ps.tabButtonText,
              { color: activeTab === "layout" ? C.text : C.muted },
              activeTab === "layout" && { fontWeight: "800" },
            ]}
          >
            {i18nText("autoI18n.duzen_ve_boyutlar", "Düzen ve Boyutlar")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[ps.tabButton, activeTab === "badges" && { backgroundColor: C.card }]}
          onPress={() => handleTabChange("badges")}
          activeOpacity={0.8}
        >
          <AppIcon
            family="Ionicons"
            name="pricetags-outline"
            size={14}
            color={activeTab === "badges" ? C.accent : C.muted}
          />
          <Text
            allowFontScaling={false}
            style={[
              ps.tabButtonText,
              { color: activeTab === "badges" ? C.text : C.muted },
              activeTab === "badges" && { fontWeight: "800" },
            ]}
          >
            {i18nText("autoI18n.poster_rozetleri", "Poster Rozetleri")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: DÜZEN VE BOYUTLAR ── */}
      {activeTab === "layout" && (
        <View style={ps.tabContent}>
          {/* LİSTE VE TÜMÜNÜ GÖR GRID KARTI */}
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.grid_duzenleri", "GRID DÜZENLERİ").toUpperCase()}
          </SectionLabel>
          <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={ps.cardTitleHeader}>
              <View style={[ps.sectionIconWrap, { backgroundColor: C.iconBlue }]}>
                <AppIcon family="Feather" name="grid" size={15} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ps.cardHeaderTitle, { color: C.text }]}>
                  {i18nText("autoI18n.liste_ve_tumunu_gor", "Kişisel ve Genel Listeler")}
                </Text>
                <Text style={[ps.cardHeaderSub, { color: C.muted }]}>
                  {i18nText(
                    "autoI18n.grid_duzenleri_aciklama",
                    "Koleksiyonlarda satır başına düşen kapak ve köşe yumuşaklığı"
                  )}
                </Text>
              </View>
            </View>

            {/* Listeler Ayarları */}
            <ControlRow
              icon="list-outline"
              title={i18nText("autoI18n.listeler_sutun", "Listeler (Sütun)")}
              options={COLUMN_OPTIONS}
              value={listsGridColumns}
              onChange={(v) => {
                changeListsGridColumns(v);
                setPreviewMode("lists");
              }}
              colors={C}
            />
            <ControlRow
              icon="crop-outline"
              title={i18nText("autoI18n.listeler_kose", "Listeler (Köşe)")}
              options={GRID_RADIUS_OPTIONS}
              value={listsPosterRadius}
              onChange={(v) => {
                changeListsPosterRadius(v);
                setPreviewMode("lists");
              }}
              colors={C}
            />

            {/* Tümünü Gör Ayarları */}
            <ControlRow
              icon="apps-outline"
              title={i18nText("autoI18n.tumunu_gor_sutun", "Tümünü Gör (Sütun)")}
              options={COLUMN_OPTIONS}
              value={seeAllGridColumns}
              onChange={(v) => {
                changeSeeAllGridColumns(v);
                setPreviewMode("seeAll");
              }}
              colors={C}
            />
            <ControlRow
              icon="crop-outline"
              title={i18nText("autoI18n.tumunu_gor_kose", "Tümünü Gör (Köşe)")}
              options={GRID_RADIUS_OPTIONS}
              value={seeAllPosterRadius}
              onChange={(v) => {
                changeSeeAllPosterRadius(v);
                setPreviewMode("seeAll");
              }}
              colors={C}
            />
          </View>

          {/* ANA EKRAN VE RAFLAR KARTI */}
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.ana_ekran_ve_raflar", "ANA EKRAN VE RAFLAR").toUpperCase()}
          </SectionLabel>
          <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={ps.cardTitleHeader}>
              <View style={[ps.sectionIconWrap, { backgroundColor: C.iconPurple }]}>
                <AppIcon family="Ionicons" name="film-outline" size={15} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ps.cardHeaderTitle, { color: C.text }]}>
                  {i18nText("autoI18n.ana_ekran_posterleri", "Ana Ekran Rafları")}
                </Text>
                <Text style={[ps.cardHeaderSub, { color: C.muted }]}>
                  {i18nText(
                    "autoI18n.ana_ekran_posterleri_aciklama",
                    "Trendler ve vizyondakiler raflarındaki kart boyutları"
                  )}
                </Text>
              </View>
            </View>

            <ControlRow
              icon="image-size-select-large"
              iconFamily="MaterialCommunityIcons"
              title={i18nText("autoI18n.poster_boyutu", "Poster boyutu")}
              options={RAIL_SIZE_OPTIONS}
              value={railPosterSize}
              onChange={(v) => {
                changeRailPosterSize(v);
                setPreviewMode("rails");
              }}
              colors={C}
            />
            <ControlRow
              icon="crop-outline"
              title={i18nText("autoI18n.kose_yuvarlakligi", "Köşe yuvarlaklığı")}
              options={RAIL_RADIUS_OPTIONS}
              value={railPosterRadius}
              onChange={(v) => {
                changeRailPosterRadius(v);
                setPreviewMode("rails");
              }}
              colors={C}
            />
          </View>

          {/* PAYLAŞIM LİSTE POSTERLERİ KARTI */}
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.paylasim_liste_posterleri", "PAYLAŞIM KARTLARI").toUpperCase()}
          </SectionLabel>
          <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={ps.cardTitleHeader}>
              <View style={[ps.sectionIconWrap, { backgroundColor: C.iconAmber }]}>
                <AppIcon family="Ionicons" name="albums-outline" size={15} color={C.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ps.cardHeaderTitle, { color: C.text }]}>
                  {i18nText("autoI18n.liste_poster_dizilimi", "Liste Poster Dizilimi")}
                </Text>
                <Text style={[ps.cardHeaderSub, { color: C.muted }]}>
                  {i18nText(
                    "autoI18n.liste_poster_dizilimi_aciklama",
                    "Sosyal akışta paylaşılan liste kapaklarının görünüm düzeni"
                  )}
                </Text>
              </View>
            </View>

            <ControlRow
              icon="albums-outline"
              title={i18nText("autoI18n.dizilim_stili", "Dizilim stili")}
              options={POST_LIST_LAYOUT_OPTIONS}
              value={postListPosterLayout}
              onChange={(v) => {
                changePostListPosterLayout(v);
                setPreviewMode("posts");
              }}
              colors={C}
            />
          </View>
        </View>
      )}

      {/* ── TAB 2: POSTER ROZETLERİ ── */}
      {activeTab === "badges" && (
        <View style={ps.tabContent}>
          <SectionLabel color={C.muted}>
            {i18nText("autoI18n.poster_rozetleri", "POSTER ROZETLERİ").toUpperCase()}
          </SectionLabel>
          <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={ps.cardTitleHeader}>
              <View style={[ps.sectionIconWrap, { backgroundColor: C.iconGreen }]}>
                <AppIcon family="Ionicons" name="bookmarks" size={15} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ps.cardHeaderTitle, { color: C.text }]}>
                  {i18nText("autoI18n.rozetleri_goster", "Rozetleri Göster")}
                </Text>
                <Text style={[ps.cardHeaderSub, { color: C.muted }]}>
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
              onChange={(k, v) => {
                changePosterBadge(k, v);
                setPreviewMode("badges");
              }}
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
              onChange={(k, v) => {
                changePosterBadge(k, v);
                setPreviewMode("badges");
              }}
              onToggleAll={toggleBadgeGroup}
            />
          </View>
        </View>
      )}
    </SettingsSubScreen>
  );
}

const ps = StyleSheet.create({
  // Master Preview Studio
  studioCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  studioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  studioBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  studioTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.5 },

  // Önizleme Mod Seçicisi
  modePicker: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    marginTop: 10,
  },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modeChipText: {
    fontSize: 8.5,
    fontWeight: "700",
  },

  // Sahne (Stage)
  stage: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // Özet Çipler Barı
  summaryRow: { flexDirection: "row", gap: 6 },
  summaryChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: { fontSize: 8, fontWeight: "600" },
  summaryValue: { fontSize: 10, fontWeight: "800", marginTop: 1 },

  // Sekmeler (Tabs)
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabButtonText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  tabContent: {
    marginTop: 0,
  },

  // Kartlar
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  cardTitleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderTitle: { fontSize: 13, fontWeight: "800" },
  cardHeaderSub: { fontSize: 9.5, marginTop: 1 },

  // Kompakt Kontroller
  compactControl: {
    flexDirection: "row",
    borderTopWidth: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  compactControlLabel: {
    width: 125,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  compactControlIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  compactControlTitle: { flex: 1, fontSize: 10.2, lineHeight: 13, fontWeight: "700" },
  compactOptions: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 10,
  },
  compactOption: {
    flex: 1,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  compactOptionText: { fontSize: 8.5, fontWeight: "700", textAlign: "center" },

  // Rozet Önizleme Pill
  badgePill: {
    position: "absolute",
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgePillDense: {
    gap: 1,
    paddingVertical: 2,
    borderRadius: 6,
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

  // Rozet Grupları ve Çipler
  badgeGroup: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  badgeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  badgeGroupTitle: { fontSize: 11.5, fontWeight: "800" },
  badgeGroupSub: { fontSize: 8.5, marginTop: 1 },
  groupAction: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  groupActionText: { fontSize: 8.5, fontWeight: "800" },
  badgeButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badgeButton: {
    width: "31.8%",
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 5,
    paddingHorizontal: 6,
    paddingRight: 14,
    paddingVertical: 6,
  },
  badgeButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeButtonLabel: { flex: 1, fontSize: 8.8, fontWeight: "700" },
  badgeCheck: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

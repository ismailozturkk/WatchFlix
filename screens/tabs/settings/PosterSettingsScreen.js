// screens/tabs/settings/PosterSettingsScreen.js
//
// Ayarlar > Poster görünümü. Liste, "Tümünü Gör" ve ana ekran raflarındaki
// poster boyutu + köşe yuvarlaklığı + sütun sayısı ayarları. SettingsScreen'den
// ayrı bir ekrana taşındı ve her ayarın etkisini gösteren canlı önizlemelerle
// zenginleştirildi.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useListLayoutSettings } from "@context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import { SettingsSubScreen, SectionLabel, buildUiColors } from "./settingsUi";

// Canlı önizleme için tek bir sahte poster karesi. Boyut + köşe yuvarlaklığı
// doğrudan ayardan gelir; içeride hafif bir film ikonu gösterilir.
function PreviewTile({ width, radius, colors }) {
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
    </View>
  );
}

// Rozet önizlemesi: poster karesi + üzerinde ListBadges pill'inin taklidi.
// Açık/kapalı durumu ve poster boyutu ayarı önizlemeye canlı yansır.
function BadgePreviewTile({ width, radius, colors, badges, small }) {
  const statusBadges = POSTER_BADGE_OPTIONS.filter((b) => b.group === "status" && badges?.[b.key] !== false);
  const dense = statusBadges.length >= 5;
  const height = width * 1.5;
  const scale = width / 104;
  const edge = Math.max(7, Math.round(width * 0.07));
  const iconSize = Math.max(10, Math.round((dense ? 13 : 15) * scale));
  const infoFontSize = Math.max(10, Math.round(12 * scale));
  const miniIconSize = Math.max(10, Math.round(12 * scale));
  const showRating = badges?.tmdbRating !== false;
  const showVotes = badges?.voteCount !== false;
  const showDate = badges?.releaseDate !== false;
  const showCountdown = badges?.countdown !== false;
  return (
    <View style={{ width, height }}>
      <PreviewTile width={width} radius={radius} colors={colors} />
      {(showRating || showVotes) && (
        <View style={[ps.previewRatingPill, { right: edge, bottom: edge, minHeight: Math.round(22 * scale), borderRadius: Math.round(11 * scale) }]}>
          {showRating && (
            <Text allowFontScaling={false} style={[ps.previewRatingText, { fontSize: infoFontSize }]}>★ 8.4</Text>
          )}
          {showRating && showVotes && (
            <Text allowFontScaling={false} style={[ps.previewMutedText, { fontSize: infoFontSize }]}>•</Text>
          )}
          {showVotes && (
            <AppIcon family="Ionicons" name="people" size={miniIconSize} color="#64b4ff" />
          )}
        </View>
      )}
      {showCountdown && (
        <View style={[ps.previewCountdownPill, { top: edge, left: edge, borderRadius: Math.round(10 * scale) }]}>
          <Text allowFontScaling={false} style={[ps.previewCountdownText, { fontSize: infoFontSize }]}>12g</Text>
        </View>
      )}
      {showDate && (
        <View style={[ps.previewDatePill, { top: edge, right: edge, borderRadius: Math.round(10 * scale) }]}>
          <Text allowFontScaling={false} style={[ps.previewDateText, { fontSize: infoFontSize }]}>2026</Text>
        </View>
      )}
      {statusBadges.length > 0 && (
        <View
          style={[
            ps.badgePill,
            dense && ps.badgePillDense,
            {
              left: edge,
              bottom: edge,
              gap: Math.max(2, Math.round(3 * scale)),
              paddingVertical: Math.max(3, Math.round(4 * scale)),
              paddingHorizontal: Math.max(2, Math.round(3 * scale)),
              borderRadius: Math.round(9 * scale),
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
    </TouchableOpacity>
  );
}

// Ayar kartlarında ortak segment kontrolü. Her seçenek isteğe bağlı bir köşe
// önizleme kutucuğu (r) taşıyabilir.
function Segmented({ options, value, onChange, colors }) {
  return (
    <View
      style={[
        ps.segment,
        { backgroundColor: colors.cardAlt, borderTopColor: colors.border },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[
              ps.segOpt,
              opt.r != null && { flexDirection: "row", gap: 7 },
              active && { backgroundColor: colors.accent },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            {opt.r != null && (
              <View
                style={{
                  width: 13,
                  height: 17,
                  borderRadius: opt.r,
                  borderWidth: 1.5,
                  borderColor: active ? colors.white : colors.muted,
                }}
              />
            )}
            <Text
              allowFontScaling={false}
              style={[
                ps.segText,
                { color: active ? colors.white : colors.muted, fontWeight: active ? "700" : "500" },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Kart içi başlık satırı (ikon + başlık + açıklama). İsteğe bağlı üst çizgi.
function CardHeader({ icon, iconFamily = "Ionicons", iconBg, iconColor, title, subtitle, colors, divided }) {
  return (
    <View
      style={[
        ps.cardHeader,
        divided && { borderTopWidth: 1, borderTopColor: colors.borderMuted },
      ]}
    >
      <View style={[ps.iconWrap, { backgroundColor: iconBg }]}>
        <AppIcon family={iconFamily} name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text allowFontScaling={false} style={[ps.rowTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text allowFontScaling={false} style={[ps.rowSub, { color: colors.muted }]}>
          {subtitle}
        </Text>
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

export default function PosterSettingsScreen() {
  const { t } = useLanguage();
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
    posterBadges,
    changePosterBadge,
  } = useListLayoutSettings();

  // Önizleme genişlikleri: sütun sayısına göre ölçekli grid + boyuta göre raf.
  const gridPreviewWidth = (cols) => (cols === 4 ? 52 : 68);
  const railPreviewWidth = railPosterSize === "small" ? 52 : 70;
  const badgePreviewWidth = railPosterSize === "small" ? 88 : 108;

  return (
    <SettingsSubScreen title={i18nText("autoI18n.poster_gorunumu", "Poster görünümü")}>
      {/* ── LİSTE GÖRÜNÜMÜ ── */}
      <SectionLabel color={C.muted}>
        {i18nText("autoI18n.liste_gorunumu", "LİSTE GÖRÜNÜMÜ").toUpperCase()}
      </SectionLabel>
      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[ps.preview, { backgroundColor: C.cardAlt, borderBottomColor: C.borderMuted }]}>
          {Array.from({ length: listsGridColumns }).map((_, i) => (
            <PreviewTile
              key={i}
              width={gridPreviewWidth(listsGridColumns)}
              radius={listsPosterRadius}
              colors={C}
            />
          ))}
        </View>

        <CardHeader
          colors={C}
          icon="grid"
          iconFamily="Feather"
          iconBg={C.iconPurple}
          iconColor={C.purple}
          title={i18nText("autoI18n.satir_basi_kapak", "Satır başına kapak")}
          subtitle={i18nText("autoI18n.liste_sutun_aciklama", "Listelerde her satırda kaç afiş görünsün")}
        />
        <Segmented
          options={COLUMN_OPTIONS}
          value={listsGridColumns}
          onChange={changeListsGridColumns}
          colors={C}
        />

        <CardHeader
          colors={C}
          divided
          icon="crop-outline"
          iconBg={C.iconAmber}
          iconColor={C.amber}
          title={i18nText("autoI18n.kose_yuvarlakligi", "Köşe yuvarlaklığı")}
          subtitle={i18nText("autoI18n.kose_yuvarlakligi_aciklama", "Afiş köşelerinin yuvarlaklığı")}
        />
        <Segmented
          options={GRID_RADIUS_OPTIONS}
          value={listsPosterRadius}
          onChange={changeListsPosterRadius}
          colors={C}
        />
      </View>

      {/* ── TÜMÜNÜ GÖR GÖRÜNÜMÜ ── */}
      <SectionLabel color={C.muted}>
        {i18nText("autoI18n.tumunu_gor_gorunumu", "TÜMÜNÜ GÖR GÖRÜNÜMÜ").toUpperCase()}
      </SectionLabel>
      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[ps.preview, { backgroundColor: C.cardAlt, borderBottomColor: C.borderMuted }]}>
          {Array.from({ length: seeAllGridColumns }).map((_, i) => (
            <PreviewTile
              key={i}
              width={gridPreviewWidth(seeAllGridColumns)}
              radius={seeAllPosterRadius}
              colors={C}
            />
          ))}
        </View>

        <CardHeader
          colors={C}
          icon="grid"
          iconFamily="Feather"
          iconBg={C.iconPurple}
          iconColor={C.purple}
          title={i18nText("autoI18n.satir_basi_kapak", "Satır başına kapak")}
          subtitle={i18nText("autoI18n.tumunu_gor_sutun_aciklama", "Tümünü Gör ekranında her satırda kaç afiş görünsün")}
        />
        <Segmented
          options={COLUMN_OPTIONS}
          value={seeAllGridColumns}
          onChange={changeSeeAllGridColumns}
          colors={C}
        />

        <CardHeader
          colors={C}
          divided
          icon="crop-outline"
          iconBg={C.iconAmber}
          iconColor={C.amber}
          title={i18nText("autoI18n.kose_yuvarlakligi", "Köşe yuvarlaklığı")}
          subtitle={i18nText("autoI18n.kose_yuvarlakligi_aciklama", "Afiş köşelerinin yuvarlaklığı")}
        />
        <Segmented
          options={GRID_RADIUS_OPTIONS}
          value={seeAllPosterRadius}
          onChange={changeSeeAllPosterRadius}
          colors={C}
        />
      </View>

      {/* ── ANA EKRAN POSTERLERİ ── */}
      <SectionLabel color={C.muted}>
        {i18nText("autoI18n.ana_ekran_posterleri", "ANA EKRAN POSTERLERİ").toUpperCase()}
      </SectionLabel>
      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View
          style={[
            ps.preview,
            ps.previewRail,
            { backgroundColor: C.cardAlt, borderBottomColor: C.borderMuted },
          ]}
        >
          {[0, 1, 2, 3].map((i) => (
            <PreviewTile key={i} width={railPreviewWidth} radius={railPosterRadius} colors={C} />
          ))}
        </View>

        <CardHeader
          colors={C}
          icon="image-size-select-large"
          iconFamily="MaterialCommunityIcons"
          iconBg={C.iconPurple}
          iconColor={C.purple}
          title={i18nText("autoI18n.poster_boyutu", "Poster boyutu")}
          subtitle={i18nText("autoI18n.ana_ekran_poster_boyutu_aciklama", "TV/Film ana ekranlarındaki poster boyutu")}
        />
        <Segmented
          options={RAIL_SIZE_OPTIONS}
          value={railPosterSize}
          onChange={changeRailPosterSize}
          colors={C}
        />

        <CardHeader
          colors={C}
          divided
          icon="crop-outline"
          iconBg={C.iconAmber}
          iconColor={C.amber}
          title={i18nText("autoI18n.kose_yuvarlakligi", "Köşe yuvarlaklığı")}
          subtitle={i18nText("autoI18n.kose_yuvarlakligi_aciklama", "Afiş köşelerinin yuvarlaklığı")}
        />
        <Segmented
          options={RAIL_RADIUS_OPTIONS}
          value={railPosterRadius}
          onChange={changeRailPosterRadius}
          colors={C}
        />
      </View>

      {/* ── POSTER ROZETLERİ ── */}
      <SectionLabel color={C.muted}>
        {i18nText("autoI18n.poster_rozetleri", "POSTER ROZETLERİ").toUpperCase()}
      </SectionLabel>
      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[ps.preview, ps.badgePreview, { backgroundColor: C.cardAlt, borderBottomColor: C.borderMuted }]}>
          <BadgePreviewTile
            width={badgePreviewWidth}
            radius={railPosterRadius}
            colors={C}
            badges={posterBadges}
            small={railPosterSize === "small"}
          />
        </View>

        <CardHeader
          colors={C}
          icon="bookmarks"
          iconBg={C.iconGreen}
          iconColor={C.accent}
          title={i18nText("autoI18n.rozetleri_goster", "Rozetleri göster")}
          subtitle={i18nText(
            "autoI18n.rozetleri_goster_aciklama",
            "Kapattığın rozet türü posterlerin üzerinde hiç görünmez",
          )}
        />
        <View style={[ps.badgeButtonGrid, { borderTopColor: C.borderMuted }]}>
          {POSTER_BADGE_OPTIONS.map((item) => (
            <BadgeToggleButton
              key={item.key}
              item={item}
              enabled={posterBadges?.[item.key] !== false}
              colors={C}
              onChange={changePosterBadge}
            />
          ))}
        </View>
      </View>
    </SettingsSubScreen>
  );
}

const ps = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  preview: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  previewRail: {
    justifyContent: "flex-start",
    gap: 8,
    overflow: "hidden",
  },
  badgePreview: {
    alignItems: "center",
    paddingVertical: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 2 },
  segment: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 4,
    gap: 2,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segText: { fontSize: 11, textAlign: "center" },
  // Rozet önizlemesindeki pill — ListBadges.pill görünümünün taklidi
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
  badgeButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    padding: 10,
  },
  badgeButton: {
    width: "23%",
    minWidth: 68,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  badgeButtonIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeButtonLabel: { fontSize: 9.5, fontWeight: "700", textAlign: "center" },
});

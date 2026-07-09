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
  } = useListLayoutSettings();

  // Önizleme genişlikleri: sütun sayısına göre ölçekli grid + boyuta göre raf.
  const gridPreviewWidth = (cols) => (cols === 4 ? 52 : 68);
  const railPreviewWidth = railPosterSize === "small" ? 52 : 70;

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
});

// components/settings/ImageQualityPanel.js
//
// Poster/görsel kalitesi denetimi — Ayarlar > Veri ve depolama ile Ayarlar >
// Poster görünümü > Kalite sekmesi AYNI bileşeni kullanır (tek davranış).
//
//   • Otomatik anahtarı: açıkken çözünürlük her görsel için ekrandaki boyutuna,
//     ekran yoğunluğuna, bağlantıya (mobil veri) ve cihaz sınıfına göre seçilir
//     (utils/imageQuality.js). Alt satır o anki kararı söyler.
//   • Elle kademeler: dokununca Otomatik kapanır ve o kademe sabitlenir.
//   • "Bu ayarla ne iner?": kullanıcının KENDİ poster boyutlarıyla (raf boyutu,
//     liste sütunu) her alanda inen TMDB türevi ve yaklaşık boyutu — ayarı
//     değiştirince canlı güncellenir.
//
// compact: Ayarlar ana ekranı için tek satırlık özet (tablo yerine).

import React, { useMemo } from "react";
import { View, Text, StyleSheet, PixelRatio, useWindowDimensions } from "react-native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import GlassTouchable from "@components/common/GlassTouchable";
import {
  useImageQualitySettings,
  useListLayoutSettings,
} from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import { getOptimalTmdbSize } from "../../utils/tmdbImageUtils";
import {
  IMAGE_QUALITY_AUTO,
  MANUAL_IMAGE_QUALITIES,
  approxImageKb,
  describeAutoQuality,
} from "../../utils/imageQuality";
import { railPosterWidth } from "../../utils/posterSizes";
import { posterWidthFor } from "../../utils/listPosterLayout";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const LEVEL_LABEL_KEYS = {
  low: "imageQualityLow",
  medium: "imageQualityMedium",
  good: "imageQualityGood",
  high: "imageQualityHigh",
  original: "imageQualityOriginal",
};

const LEVEL_HINTS = {
  low: ["autoI18n.gorsel_kalite_ipucu_low", "En az veri; afişler hafif yumuşak görünür"],
  medium: ["autoI18n.gorsel_kalite_ipucu_medium", "Dengeli; ekran yoğunluğunun altında"],
  good: ["autoI18n.gorsel_kalite_ipucu_good", "Ekranın yoğunluğunda keskin"],
  high: ["autoI18n.gorsel_kalite_ipucu_high", "Ekstra keskin; belirgin şekilde daha çok veri"],
  original: ["autoI18n.gorsel_kalite_ipucu_original", "Tam boy dosyalar; en çok veri ve bellek"],
};

const AUTO_REASON_TEXT = {
  full: ["autoI18n.gorsel_kalite_oto_full", "Şu an: tam keskinlik ({{density}}×)"],
  metered: ["autoI18n.gorsel_kalite_oto_metered", "Şu an: mobil veride tasarruf ({{density}}×)"],
  lowTier: ["autoI18n.gorsel_kalite_oto_lowtier", "Şu an: cihaza göre hafifletildi ({{density}}×)"],
};

// Fallback (çeviri yoksa) da aynı yer tutucuyu doldursun.
const tr = ([key, fallback], vars) => {
  const text = i18nText(key, fallback, vars);
  return vars ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? "")) : text;
};

export function imageQualityLabel(level, t = {}) {
  if (level === IMAGE_QUALITY_AUTO) return tr(["autoI18n.gorsel_kalite_otomatik", "Otomatik"]);
  return t[LEVEL_LABEL_KEYS[level]] || level;
}

export default function ImageQualityPanel({ colors: C, compact = false, onOpenDetails }) {
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const { imageQualityLevel, imageAutoContext, isMeteredConnection, changeImageQuality } =
    useImageQualitySettings();
  const { railPosterSize, listsGridColumns } = useListLayoutSettings();
  const isAuto = imageQualityLevel === IMAGE_QUALITY_AUTO;
  const pixelRatio = PixelRatio.get();

  const autoInfo = useMemo(
    () =>
      describeAutoQuality({
        pixelRatio,
        metered: imageAutoContext?.metered ?? isMeteredConnection,
        tier: imageAutoContext?.tier,
      }),
    [pixelRatio, imageAutoContext, isMeteredConnection],
  );

  // Kullanıcının kendi poster boyutlarıyla her alanda inen türev.
  const rows = useMemo(() => {
    const areas = [
      {
        id: "rail",
        icon: "albums-outline",
        label: tr(["autoI18n.gorsel_kalite_alan_rail", "Ana ekran afişi"]),
        type: "poster",
        width: railPosterWidth(windowWidth, railPosterSize),
      },
      {
        id: "list",
        icon: "grid-outline",
        label: tr(["autoI18n.gorsel_kalite_alan_list", "Liste ızgarası"]),
        type: "poster",
        width: posterWidthFor({ windowWidth, columns: listsGridColumns || 3 }),
      },
      {
        id: "detail",
        icon: "document-text-outline",
        label: tr(["autoI18n.gorsel_kalite_alan_detail", "Detay afişi"]),
        type: "poster",
        width: 110,
      },
      {
        id: "backdrop",
        icon: "image-outline",
        label: tr(["autoI18n.gorsel_kalite_alan_backdrop", "Arka plan"]),
        type: "backdrop",
        width: windowWidth,
      },
    ];
    return areas.map((a) => {
      const size = getOptimalTmdbSize(a.type, a.width, imageQualityLevel, imageAutoContext || undefined);
      return { ...a, size, kb: approxImageKb(size) };
    });
  }, [windowWidth, railPosterSize, listsGridColumns, imageQualityLevel, imageAutoContext]);

  const toggleAuto = (next) => {
    if (next) changeImageQuality(IMAGE_QUALITY_AUTO);
    // Kapatınca otomatiğin şu anki kararına en yakın elle kademe: tam yoğunluk → İyi.
    else changeImageQuality(autoInfo.reason === "full" ? "good" : "medium");
  };

  const statusText = isAuto
    ? tr(AUTO_REASON_TEXT[autoInfo.reason], { density: autoInfo.density })
    : tr(LEVEL_HINTS[imageQualityLevel] || LEVEL_HINTS.good);
  const railRow = rows[0];
  const kbText = (kb) => (kb ? tr(["autoI18n.gorsel_kalite_kb", "≈{{kb}} KB"], { kb }) : "");

  return (
    <View>
      {/* Otomatik */}
      <View style={[st.autoRow, compact && [st.autoRowCompact, { borderTopColor: C.border }]]}>
        {compact ? null : (
          <View style={[st.iconWrap, { backgroundColor: C.iconPurple }]}>
            <AppIcon family="Ionicons" name="sparkles-outline" size={16} color={C.purple} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text allowFontScaling={false} style={[st.title, { color: C.text }]}>
            {tr(["autoI18n.gorsel_kalite_otomatik", "Otomatik"])}
          </Text>
          <Text allowFontScaling={false} style={[st.sub, { color: C.muted }]}>
            {tr(["autoI18n.gorsel_kalite_otomatik_alt", "Afiş boyutuna, ekranına ve bağlantına göre seçilir"])}
          </Text>
        </View>
        <SwitchToggle value={isAuto} onValueChange={toggleAuto} size={36} />
      </View>

      {/* Elle kademeler */}
      <View style={[st.segment, { backgroundColor: C.cardAlt, borderTopColor: C.border }]}>
        {MANUAL_IMAGE_QUALITIES.map((level) => {
          const active = !isAuto && imageQualityLevel === level;
          return (
            <GlassTouchable
              key={level}
              style={[st.segOpt, active && { backgroundColor: C.accent }, isAuto && st.segDimmed]}
              onPress={() => changeImageQuality(level)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[st.segText, { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" }]}
              >
                {t[LEVEL_LABEL_KEYS[level]] || level}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>

      {/* Durum + etki */}
      <View style={[st.status, { borderTopColor: C.border }]}>
        <AppIcon
          family="Ionicons"
          name={isAuto ? (autoInfo.reason === "metered" ? "cellular-outline" : "flash-outline") : "options-outline"}
          size={13}
          color={C.accent}
        />
        <Text allowFontScaling={false} style={[st.statusText, { color: C.text }]}>
          {statusText}
        </Text>
      </View>
      {isAuto ? null : (
        <Text allowFontScaling={false} style={[st.manualHint, { color: C.muted }]}>
          {tr(["autoI18n.gorsel_kalite_elle_ipucu", "Otomatik'i açınca kalite poster boyutuna ve bağlantına göre ayarlanır"])}
        </Text>
      )}

      {compact ? (
        <GlassTouchable
          style={st.compactLine}
          onPress={onOpenDetails}
          disabled={!onOpenDetails}
          activeOpacity={0.7}
          accessibilityRole={onOpenDetails ? "button" : undefined}
        >
          <Text allowFontScaling={false} style={[st.sub, st.compactText, { color: C.muted }]} numberOfLines={1}>
            {`${railRow.label}: ${railRow.size} ${kbText(railRow.kb)}`.trim()}
          </Text>
          {onOpenDetails ? (
            <>
              <Text allowFontScaling={false} style={[st.compactLink, { color: C.accent }]}>
                {tr(["autoI18n.gorsel_kalite_ayrinti", "Ayrıntılar"])}
              </Text>
              <AppIcon family="Ionicons" name="chevron-forward" size={13} color={C.accent} />
            </>
          ) : null}
        </GlassTouchable>
      ) : (
        <View style={[st.table, { borderColor: C.border, backgroundColor: C.cardAlt }]}>
          <Text allowFontScaling={false} style={[st.tableTitle, { color: C.muted }]}>
            {tr(["autoI18n.gorsel_kalite_ne_iner", "Bu ayarla ne iner?"]).toUpperCase()}
          </Text>
          {rows.map((row, index) => (
            <View
              key={row.id}
              style={[st.tableRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }]}
            >
              <AppIcon family="Ionicons" name={row.icon} size={14} color={C.muted} />
              <Text allowFontScaling={false} style={[st.tableLabel, { color: C.text }]} numberOfLines={1}>
                {row.label}
              </Text>
              <Text allowFontScaling={false} style={[st.tableSize, { color: C.accentStrong }]}>
                {row.size}
              </Text>
              <Text allowFontScaling={false} style={[st.tableKb, { color: C.muted }]}>
                {kbText(row.kb)}
              </Text>
            </View>
          ))}
          <Text allowFontScaling={false} style={[st.tableFoot, { color: C.muted }]}>
            {tr([
              "gorsel_kalite_tablo_not",
              "Poster boyutunu küçültünce inen dosya da küçülür. Boyutlar yaklaşıktır.",
            ])}
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  autoRow: {
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
  title: { fontSize: 14, fontWeight: "600" },
  sub: { fontSize: 11, marginTop: 2 },
  segment: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 4,
    paddingHorizontal: GLASS_PRESS_ROOM,
    paddingBottom: 4,
    gap: 2,
  },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  segDimmed: { opacity: 0.55 },
  segText: { fontSize: 11, textAlign: "center" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  statusText: { flex: 1, fontSize: 12, fontWeight: "500" },
  manualHint: { fontSize: 11, paddingHorizontal: 16, marginTop: -4, paddingBottom: 10 },
  autoRowCompact: { borderTopWidth: 1, paddingTop: 12 },
  compactLine: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingBottom: 14 },
  compactText: { flex: 1, marginTop: 0 },
  compactLink: { fontSize: 12, fontWeight: "600" },
  table: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tableTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  tableLabel: { flex: 1, fontSize: 12.5 },
  tableSize: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tableKb: { width: 64, textAlign: "right", fontSize: 11, fontVariant: ["tabular-nums"] },
  tableFoot: { fontSize: 10.5, marginTop: 4, lineHeight: 14 },
});

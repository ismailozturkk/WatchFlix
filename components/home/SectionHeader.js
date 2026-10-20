// components/home/SectionHeader.js
//
// Film / Dizi ana ekranındaki HER rafın başlığı. Eskiden 8 ayrı elle yazılmış düzendi: düz Text +
// "genişlet" hapı, başlıksız kategori sekmeleri (Trendler/En iyiler), çip satırları (Tür/Platform),
// tarih çipleri, Oscar/Emmy mod anahtarı, Devam Edenler'in kendi rozeti… Hepsi bu bileşene indi.
//
//   ┌────┐  Başlık  [rozet]                      ┌──────────┐
//   │ ikon│  alt başlık (bilgilendirme)           │  Tümü  › │
//   └────┘                                        └──────────┘
//   [ çipler / segment … ]            ← children (isteğe bağlı, başlığın hemen altında)
//
// DÜZ yüzey (cam değil): başlık kaydırılan listenin içinde; her rafta cam pahalı ve HIG'e aykırı
// (bkz. __tests__/glassButtonCoverage.test.js — "içerik katmanı"). Bu yüzden opaklık/basma geri
// bildirimi serbest.
//
// YÜKSEKLİK KARARLILIĞI: yükleme ve yüklenmiş durum AYNI öğeyi çizmeli (ray başlığın altında; başlık
// yüksekliği değişirse ray aşağı zıplar). Alt başlık bilinmiyorsa bile boş bir satır yer tutar
// (`reserveSubtitle`), tek istisna alt başlığı hiç olmayan çağıran.
// UZUN BAŞLIK: varsayılan tek satır + "…". Metni uzun olan raf (ör. "Takip ettiklerinin yaklaşanları")
// `titleLines={2}` verir; yükleme ve yüklenmiş durum aynı başlığı çizdiği için yükseklik sabit kalır.
//
// KİMLİK: `section` (HOME_SECTIONS anahtarı) verilirse simge, ton ve alt başlık utils/homeSectionCopy
// tablosundan gelir — rafların cümleleri tek yerde durur. Başlık METNİ çağıranın çeviri anahtarından gelir.
//
// TON: "accent" temanın vurgusu; "gold" ödül rafları. Kutunun içindeki simge VURGU renginde, zemin
// vurgunun %14'ü — vurgu üstü METİN koymuyoruz, bu yüzden tüm temalarda (açık sarı dahil) okunur.
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { getSectionMeta, getSeeAllLabel } from "../../utils/homeSectionCopy";
import GlassPressable from "../common/GlassPressable";

export const SECTION_GOLD = "#F2B705";
/** İkon kutusu ve başlık/alt başlık bloğunun yüksekliği (24 + 16). */
export const SECTION_HEADER_HEIGHT = 40;
const TILE = 36;

/** Başlığın yanındaki küçük sayı rozeti (ör. Devam Edenler: hazır bölüm sayısı). */
export function SectionBadge({ icon, text, tone = "accent" }) {
  const { theme } = useTheme();
  const tint = tone === "gold" ? SECTION_GOLD : theme.accent;
  return (
    <View style={[styles.badge, { backgroundColor: alpha(tint, 0.16) }]}>
      {icon ? <Ionicons name={icon} size={11} color={tint} /> : null}
      <Text allowFontScaling={false} style={[styles.badgeText, { color: tint }]}>
        {text}
      </Text>
    </View>
  );
}

/** Başlığın sağındaki yuvarlak, simge-yalnız eylem (ör. "tümünü takvime ekle"). */
export function SectionIconAction({ icon, onPress, accessibilityLabel, tone = "accent" }) {
  const { theme } = useTheme();
  const tint = tone === "gold" ? SECTION_GOLD : theme.accent;
  return (
    <GlassPressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconAction,
        { backgroundColor: alpha(tint, 0.14) },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={tint} />
    </GlassPressable>
  );
}

function SectionHeader({
  section,
  mediaType,
  title: titleProp,
  subtitle: subtitleProp,
  icon: iconProp,
  tone: toneProp,
  leading,
  badge,
  trailing,
  actionLabel,
  onPressAction,
  actionAccessibilityLabel,
  reserveSubtitle = true,
  titleLines = 1,
  children,
  style,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  // `section` verilince simge / ton / alt başlık (ve gerekirse başlık) utils/homeSectionCopy'den gelir;
  // açık prop her zaman kazanır (ör. alt başlığı dinamik olan raflar).
  const meta = getSectionMeta(section, language, mediaType);
  const title = titleProp ?? meta.title;
  const subtitle = subtitleProp !== undefined ? subtitleProp : meta.subtitle;
  const icon = iconProp ?? (section ? meta.icon : undefined);
  const tone = toneProp ?? meta.tone;
  const tint = tone === "gold" ? SECTION_GOLD : theme.accent;
  const hasAction = typeof onPressAction === "function";
  const label = actionLabel || getSeeAllLabel(language);
  const seeAll = i18nText("autoI18n.tumunu_gor", "Tümünü Gör");
  // Kısa etiket ("Tümü") ekran okuyucuda belirsiz: hangi rafın tümü olduğu da söylensin.
  const a11yLabel = actionAccessibilityLabel || (title ? `${seeAll}: ${title}` : seeAll);
  const showSubtitleLine = Boolean(subtitle) || reserveSubtitle;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        {leading ??
          (icon ? (
            <View
              style={[
                styles.tile,
                { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.3) },
              ]}
            >
              <Ionicons name={icon} size={19} color={tint} />
            </View>
          ) : null)}

        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text
              allowFontScaling={false}
              numberOfLines={titleLines}
              // Tek satırlı başlık uzunsa ("Emmy-Winning TV Shows" + "See all" düğmesi) "…" yerine
              // %80'e kadar küçülür; iki satırlıda gerek yok.
              adjustsFontSizeToFit={titleLines === 1}
              minimumFontScale={0.8}
              accessibilityRole="header"
              style={[styles.title, { color: theme.text.primary }]}
            >
              {title}
            </Text>
            {badge}
          </View>
          {showSubtitleLine ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.subtitle, { color: theme.text.between || theme.text.muted }]}
            >
              {subtitle || " "}
            </Text>
          ) : null}
        </View>

        {trailing}

        {hasAction ? (
          <GlassPressable
            onPress={onPressAction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: alpha(theme.accent, 0.13) },
              pressed && styles.pressed,
            ]}
          >
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.actionText, { color: theme.accent }]}>
              {label}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.accent} />
          </GlassPressable>
        ) : null}
      </View>

      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export default memo(SectionHeader);

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: {
    minHeight: SECTION_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, flexShrink: 1, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: {
    flexShrink: 1,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  action: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 15,
    flexShrink: 0,
  },
  actionText: { fontSize: 12.5, fontWeight: "700" },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  body: { marginTop: 12 },
  pressed: { opacity: 0.7 },
});

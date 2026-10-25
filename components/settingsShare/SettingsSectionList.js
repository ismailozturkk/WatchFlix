// components/settingsShare/SettingsSectionList.js
//
// Paylaşılan görünüm ayarlarının bölüm satırları — seçim kutulu. Hem gönderme
// ("neleri göndereyim") hem uygulama ("neleri alayım") sayfası aynı satırı çizer.
//
// Satır durumları:
//   • seçili / seçili değil (dokununca değişir)
//   • `same`: cihazdakiyle zaten aynı → "Zaten aynı" rozeti (yine seçilebilir)
//   • `lock`: Premium'a bağlı → Premium rozeti, kutu yerine kilit; dokununca
//     `onLockedPress` (yükseltme sayfası), seçilemez
//
// Tema satırının karosu temanın üç rengi, yazı tipi satırınınki başlık fontuyla
// "Aa" — özet metnini okumadan da ne geldiği anlaşılsın.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassPressable from "../common/GlassPressable";
import PremiumPill from "../premium/PremiumPill";
import { alpha } from "../../theme/colors";
import { SETTINGS_SHARE_SECTIONS, sharedFontRolesOf, sharedThemeColors } from "../../utils/settingsShare";
import { fontFamilyOf, getSettingsShareCopy, sectionSummary } from "../../utils/settingsShareCopy";

const ICON_BY_ID = Object.fromEntries(SETTINGS_SHARE_SECTIONS.map((section) => [section.id, section.icon]));

function Tile({ id, share, colors }) {
  if (id === "theme") {
    const theme = sharedThemeColors(share);
    if (theme) {
      return (
        <View style={[styles.tile, styles.swatch, { backgroundColor: theme.primary, borderColor: alpha(theme.border, 0.9) }]}>
          <View style={[styles.swatchDot, { backgroundColor: theme.secondary }]} />
          <View style={[styles.swatchDot, { backgroundColor: theme.accent }]} />
        </View>
      );
    }
  }
  if (id === "fonts") {
    const family = fontFamilyOf(sharedFontRolesOf(share)?.heading);
    return (
      <View style={[styles.tile, { backgroundColor: colors.accentDim }]}>
        <Text allowFontScaling={false} style={[styles.tileGlyph, { color: colors.accent }, family ? { fontFamily: family } : null]}>
          Aa
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.tile, { backgroundColor: colors.accentDim }]}>
      <Ionicons name={`${ICON_BY_ID[id]}-outline`} size={17} color={colors.accent} />
    </View>
  );
}

// `style`: kabuğun ezilmesi — ayar alt sayfasında liste bir cam kartın İÇİNDE durur
// (kendi zemini/çerçevesi kalkar).
function SettingsSectionList({ share, rows, selected, onToggle, onLockedPress, colors, language, t, style }) {
  const copy = getSettingsShareCopy(language);
  return (
    <View style={[styles.box, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      {rows.map((row, index) => {
        const checked = !row.lock && selected.has(row.id);
        const last = index === rows.length - 1;
        const title = copy.sections[row.id];
        const summary = sectionSummary(share, row.id, { language, t });
        return (
          <GlassPressable
            key={row.id}
            glass={false}
            testID={`settings-share-row-${row.id}`}
            accessibilityRole="checkbox"
            accessibilityLabel={`${title}. ${summary}${row.same ? `. ${copy.sameAsYours}` : ""}${row.lock ? `. ${copy.premium}` : ""}`}
            accessibilityState={{ checked, disabled: !!row.lock }}
            onPress={() => (row.lock ? onLockedPress?.(row) : onToggle(row.id))}
            style={({ pressed }) => [
              styles.row,
              !last && { borderBottomColor: colors.borderMuted, borderBottomWidth: StyleSheet.hairlineWidth },
              pressed && styles.pressed,
            ]}
          >
            <Tile id={row.id} share={share} colors={colors} />
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: colors.text }]}>
                  {title}
                </Text>
                {row.lock ? <PremiumPill label={copy.premium} /> : null}
                {!row.lock && row.same ? (
                  <View style={[styles.sameBadge, { backgroundColor: colors.closeBg }]}>
                    <Text allowFontScaling={false} style={[styles.sameText, { color: colors.muted }]}>
                      {copy.sameAsYours}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.summary, { color: colors.muted }]}>
                {summary}
              </Text>
            </View>
            {row.lock ? (
              <View style={[styles.check, { borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={12} color={colors.muted} />
              </View>
            ) : (
              <View
                style={[
                  styles.check,
                  checked
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { borderColor: alpha(colors.muted, 0.6) },
                ]}
              >
                {checked ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
              </View>
            )}
          </GlassPressable>
        );
      })}
    </View>
  );
}

export default memo(SettingsSectionList);

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10 },
  pressed: { opacity: 0.75 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  swatch: { flexDirection: "row", gap: 4, borderWidth: 1 },
  swatchDot: { width: 10, height: 10, borderRadius: 5 },
  tileGlyph: { fontSize: 17, fontWeight: "800" },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flexShrink: 1, fontSize: 14, fontWeight: "800" },
  summary: { fontSize: 12, fontWeight: "600", lineHeight: 16, marginTop: 2 },
  sameBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  sameText: { fontSize: 10, fontWeight: "800" },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});

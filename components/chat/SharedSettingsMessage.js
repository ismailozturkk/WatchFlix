// components/chat/SharedSettingsMessage.js
//
// Sohbette paylaşılan GÖRÜNÜM AYARLARI balonunun gövdesi (mesaj kind: "settingsShare",
// gövde utils/settingsShare.js). Paylaşılan tema mini bir uygulama ekranı olarak
// çizilir (afiş köşesi ve başlık fontu da paylaşılandan), altında yazı tipi satırı
// ve diğer bölümlerin çipleri.
//
// GELEN balonda "İncele ve uygula": alıcı her bölümü ayrı seçip uygular
// (ApplySharedSettingsSheet). GİDEN balonda düğme yok, kısa bir not var.
// Metinler ALICININ dilinde; gönderenin dili yalnız gelen kutusu önizlemesinde.

import React, { memo, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GlassPressable from "../common/GlassPressable";
import SettingsThemeMock from "../settingsShare/SettingsThemeMock";
import {
  SETTINGS_SHARE_SECTIONS,
  settingsShareSectionIds,
  sharedFontRolesOf,
  sharedThemeColors,
} from "../../utils/settingsShare";
import { fontFamilyOf, getSettingsShareCopy, sectionSummary, themeLabel } from "../../utils/settingsShareCopy";
import { settingsBubbleWidth } from "../../utils/settingsShareLayout";
import { sharePalette } from "./shareKit";

const ICON_BY_ID = Object.fromEntries(SETTINGS_SHARE_SECTIONS.map((section) => [section.id, section.icon]));
// Ayrı satırı olanlar (tema önizlemesi, yazı tipi satırı) çip olarak tekrar edilmez.
const OWN_ROW = new Set(["theme", "fonts"]);

// Uygulama sayfası (ayar context'leri, Premium, toast…) ancak düğmeye basılınca
// yüklenir: balon sohbet listesinde çok kez çizilir, MessageBubble hafif kalmalı.
function LazyApplySheet(props) {
  // eslint-disable-next-line global-require
  const ApplySharedSettingsSheet = require("../settingsShare/ApplySharedSettingsSheet").default;
  return <ApplySharedSettingsSheet {...props} />;
}

function SharedSettingsMessage({ share, isOutgoing = false }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const copy = getSettingsShareCopy(language);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: theme.accent }), [theme, isOutgoing]);
  // Dar telefonda (320 dp) sabit genişlik zengin balonun %90 sınırını taşırıyordu.
  const { width: windowWidth } = useWindowDimensions();
  const bubbleWidth = settingsBubbleWidth(windowWidth);
  const [sheetVisible, setSheetVisible] = useState(false);
  // İlk açılıştan sonra bağlı kalır: kapanış animasyonu ve onDismissed çalışabilsin.
  const [sheetMounted, setSheetMounted] = useState(false);

  const ids = settingsShareSectionIds(share);
  const sharedTheme = useMemo(() => sharedThemeColors(share), [share]);
  const headingFamily = fontFamilyOf(sharedFontRolesOf(share)?.heading);
  const chips = ids.filter((id) => !OWN_ROW.has(id) || (id === "theme" && !sharedTheme));
  const label = themeLabel(share, { language, t });

  return (
    <View style={[styles.wrap, { width: bubbleWidth }]}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="color-palette" size={17} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.kicker, { color: palette.tileInk }]}>
            {copy.kicker.toLocaleUpperCase()}
          </Text>
          <Text numberOfLines={1} style={[styles.sub, { color: palette.secondary }]}>
            {share.owner ? copy.from(share.owner) : copy.groups(ids.length)}
          </Text>
        </View>
      </View>

      {sharedTheme ? (
        <View style={styles.mockBlock}>
          <SettingsThemeMock
            theme={sharedTheme}
            title={label}
            headingFamily={headingFamily}
            posterRadius={share.sections.posters?.listsPosterRadius ?? 10}
          />
        </View>
      ) : null}

      {share.sections.fonts ? (
        <View style={[styles.fontRow, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <Text
            allowFontScaling={false}
            style={[styles.fontGlyph, { color: palette.primary }, headingFamily ? { fontFamily: headingFamily } : null]}
          >
            Aa
          </Text>
          <Text numberOfLines={2} style={[styles.fontText, { color: palette.secondary }]}>
            {sectionSummary(share, "fonts", { language, t })}
          </Text>
        </View>
      ) : null}

      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((id) => (
            <View key={id} style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
              <Ionicons name={`${ICON_BY_ID[id]}-outline`} size={12} color={palette.tileInk} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color: palette.primary }]}>
                {copy.sections[id]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {isOutgoing ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.outgoingNote}</Text>
      ) : (
        <GlassPressable
          glass={false}
          testID="shared-settings-review"
          accessibilityRole="button"
          onPress={() => {
            setSheetMounted(true);
            setSheetVisible(true);
          }}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.buttonBg }, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={15} color={palette.buttonInk} />
          <Text allowFontScaling={false} style={[styles.buttonText, { color: palette.buttonInk }]}>
            {copy.reviewAndApply}
          </Text>
        </GlassPressable>
      )}

      {!isOutgoing && sheetMounted ? (
        <LazyApplySheet visible={sheetVisible} share={share} onClose={() => setSheetVisible(false)} />
      ) : null}
    </View>
  );
}

export default memo(SharedSettingsMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", marginBottom: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  sub: { fontSize: 13, fontWeight: "800", marginTop: 1 },
  mockBlock: { marginTop: 11 },
  fontRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  fontGlyph: { fontSize: 20, fontWeight: "800" },
  fontText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: { flexShrink: 1, fontSize: 11.5, fontWeight: "700" },
  note: { fontSize: 11.5, fontWeight: "600", lineHeight: 16, marginTop: 10 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    borderRadius: 12,
    marginTop: 11,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 13.5, fontWeight: "800" },
});

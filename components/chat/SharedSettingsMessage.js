// components/chat/SharedSettingsMessage.js
//
// Sohbette paylaşılan GÖRÜNÜM AYARLARI balonunun gövdesi (mesaj kind: "settingsShare",
// gövde utils/settingsShare.js). Paylaşılan tema mini bir uygulama ekranı olarak
// çizilir (afiş köşesi ve başlık fontu da paylaşılandan); altında diğer paylaşılan
// bölümler yalnız ikon olarak kompakt biçimde gösterilir.
//
// GELEN balonda "İncele ve uygula": alıcı her bölümü ayrı seçip uygular
// (ApplySharedSettingsSheet). GİDEN balonda kısa bir not var; gönderen o günden
// beri ayarlarını değiştirdiyse "Bende uygula" ile aynı sayfadan geri dönebilir.
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
import { fontFamilyOf, getSettingsShareCopy, themeLabel } from "../../utils/settingsShareCopy";
import { bubbleMockPosterCount, settingsBubbleWidth } from "../../utils/settingsShareLayout";
import { sharePalette } from "./shareKit";

const ICON_BY_ID = Object.fromEntries(SETTINGS_SHARE_SECTIONS.map((section) => [section.id, section.icon]));

// Uygulama sayfası (ayar context'leri, Premium, toast…) ancak düğmeye basılınca
// yüklenir: balon sohbet listesinde çok kez çizilir, MessageBubble hafif kalmalı.
function LazyApplySheet(props) {
  // eslint-disable-next-line global-require
  const ApplySharedSettingsSheet = require("../settingsShare/ApplySharedSettingsSheet").default;
  return <ApplySharedSettingsSheet {...props} />;
}

// Giden satır ayar context'lerine bağlanır (karşılaştırma); o da tembel yüklenir.
function LazyOutgoingApply(props) {
  // eslint-disable-next-line global-require
  const OutgoingSettingsApply = require("../settingsShare/OutgoingSettingsApply").default;
  return <OutgoingSettingsApply {...props} />;
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
  // Tema kendi mini önizlemesinde görünür. Tema yoksa onun ikonu da diğerleriyle çizilir.
  const compactSections = ids.filter((id) => id !== "theme" || !sharedTheme);
  const label = themeLabel(share, { language, t });
  const openSheet = () => {
    setSheetMounted(true);
    setSheetVisible(true);
  };

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
            compact
            posterCount={bubbleMockPosterCount(bubbleWidth)}
          />
        </View>
      ) : null}

      {compactSections.length ? (
        <View style={styles.sectionIcons} accessibilityRole="summary">
          {compactSections.map((id) => (
            <View
              key={id}
              testID={`shared-settings-icon-${id}`}
              accessible
              accessibilityLabel={copy.sections[id]}
              style={[styles.sectionIcon, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}
            >
              <Ionicons name={`${ICON_BY_ID[id]}-outline`} size={14} color={palette.tileInk} />
            </View>
          ))}
        </View>
      ) : null}

      {isOutgoing ? (
        <LazyOutgoingApply share={share} copy={copy} palette={palette} onApply={openSheet} />
      ) : (
        <GlassPressable
          glass={false}
          testID="shared-settings-review"
          accessibilityRole="button"
          onPress={openSheet}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.buttonBg }, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={15} color={palette.buttonInk} />
          <Text allowFontScaling={false} style={[styles.buttonText, { color: palette.buttonInk }]}>
            {copy.reviewAndApply}
          </Text>
        </GlassPressable>
      )}

      {sheetMounted ? (
        <LazyApplySheet visible={sheetVisible} share={share} own={isOutgoing} onClose={() => setSheetVisible(false)} />
      ) : null}
    </View>
  );
}

export default memo(SharedSettingsMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", marginBottom: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  sub: { fontSize: 12, fontWeight: "800", marginTop: 1 },
  mockBlock: { marginTop: 8 },
  sectionIcons: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 36,
    borderRadius: 11,
    marginTop: 8,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 12.5, fontWeight: "800" },
});

// screens/tabs/settings/ShareSettingsScreen.js
//
// Ayarlar > Görünüm > "Görünümümü paylaş". Diğer özelleştirme alt sayfalarıyla
// (Poster görünümü, Kişiselleştirme) AYNI iskelet: SettingsSubScreen (geri düğmesi +
// başlık), üstte önizleme kartı, bölüm etiketi + cam kartta seçim satırları.
// Önizleme ve satırlar kullanıcının GÖRDÜĞÜ ayarlardan (Free'de kilitli tema/font
// yerine çizilen) kurulur; gövde utils/settingsShare.js'te.
//
// "Sohbete gönder" alt çubukta SABİT: liste uzasa da düğme ekranda kalır. Alıcı
// seçimi ShareToChatSheet (alt sayfa) → ChatScreen `initialShare`.
//
// 25 Eki: önce alt sayfaydı — uzun içerikte tepesi durum çubuğunun altına giriyordu
// ve diğer ayar sayfalarından farklı görünüyordu.

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassBox from "../../../components/common/GlassBox";
import GlassPressable from "../../../components/common/GlassPressable";
import ShareToChatSheet from "../../../components/chat/ShareToChatSheet";
import SettingsThemeMock from "../../../components/settingsShare/SettingsThemeMock";
import SettingsSectionList from "../../../components/settingsShare/SettingsSectionList";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import useSettingsShare from "../../../hooks/useSettingsShare";
import { intlLocaleOf } from "../../../utils/appLanguages";
import {
  SETTINGS_SHARE_SECTION_IDS,
  settingsShareSectionIds,
  sharedFontRolesOf,
  sharedThemeColors,
} from "../../../utils/settingsShare";
import { fontFamilyOf, getSettingsShareCopy, themeLabel } from "../../../utils/settingsShareCopy";
import { settingsScreenPreview } from "../../../utils/settingsShareLayout";
import { alpha } from "../../../theme/colors";
import { SectionLabel, SettingsSubScreen, buildUiColors, ui } from "./settingsUi";

export default function ShareSettingsScreen() {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const { profile } = useUserProfile() || {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const settings = useSettingsShare();
  const copy = getSettingsShareCopy(language);
  const locale = intlLocaleOf(language);
  const C = buildUiColors(theme);
  const preview = settingsScreenPreview(width);

  // Ekran açıldığında BİR KEZ kurulur: kullanıcı bu sayfadayken ayarları değişmez.
  const [full] = useState(() => settings.buildMine(SETTINGS_SHARE_SECTION_IDS));
  const [selected, setSelected] = useState(() => new Set(settingsShareSectionIds(full)));
  const [pickerShare, setPickerShare] = useState(null);

  const rows = useMemo(() => settingsShareSectionIds(full).map((id) => ({ id, lock: null, same: false })), [full]);
  const sharedTheme = useMemo(() => sharedThemeColors(full), [full]);
  const count = rows.filter((row) => selected.has(row.id)).length;
  const allSelected = rows.length > 0 && count === rows.length;

  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));

  const send = () => {
    if (!count) return;
    // Gönderen adı gönderim anında: profil ekran açıldıktan sonra yüklenmiş olabilir.
    setPickerShare(settings.buildMine([...selected], profile?.displayName));
  };

  return (
    <SettingsSubScreen title={copy.shareTitle} scrollable={false}>
      <ScrollView style={s.flex} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {sharedTheme ? (
          <GlassBox
            role="card"
            testID="settings-share-preview"
            style={[s.previewCard, { backgroundColor: C.card, borderColor: C.border, width: preview.cardWidth }]}
          >
            <View style={s.previewHead}>
              <View style={[s.previewBadge, { backgroundColor: C.accentDim }]}>
                <Ionicons name="color-palette-outline" size={15} color={C.accent} />
              </View>
              <Text allowFontScaling={false} numberOfLines={1} style={[s.previewTitle, { color: C.text }]}>
                {copy.previewLabel}
              </Text>
              {!selected.has("theme") ? (
                <View style={[s.offPill, { backgroundColor: C.closeBg }]}>
                  <Text allowFontScaling={false} numberOfLines={1} style={[s.offText, { color: C.muted }]}>
                    {copy.themeNotIncluded}
                  </Text>
                </View>
              ) : null}
            </View>
            {/* Tema seçilmese de önizleme YERİNDE kalır (soluk): satır aç/kapa sayfayı
                zıplatmasın. Font ve afiş köşesi yalnız seçiliyse yansır. */}
            <View style={!selected.has("theme") && s.previewOff}>
              <SettingsThemeMock
                theme={sharedTheme}
                posterCount={preview.posterCount}
                title={themeLabel(full, { language, t })}
                headingFamily={selected.has("fonts") ? fontFamilyOf(sharedFontRolesOf(full)?.heading) : null}
                posterRadius={selected.has("posters") ? full.sections.posters?.listsPosterRadius ?? 10 : 10}
              />
            </View>
          </GlassBox>
        ) : null}

        <View style={s.labelRow}>
          <SectionLabel color={C.muted}>{copy.includedLabel.toLocaleUpperCase(locale)}</SectionLabel>
          {rows.length > 1 ? (
            <GlassPressable glass={false} accessibilityRole="button" onPress={toggleAll} hitSlop={8} style={s.toggleAll}>
              <Text allowFontScaling={false} numberOfLines={1} style={[s.toggleAllText, { color: C.accent }]}>
                {allSelected ? copy.selectNone : copy.selectAll}
              </Text>
            </GlassPressable>
          ) : null}
        </View>
        {full ? (
          <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingsSectionList
              share={full}
              rows={rows}
              selected={selected}
              onToggle={toggle}
              colors={C}
              language={language}
              t={t}
              style={s.listInCard}
            />
          </GlassBox>
        ) : null}

        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {copy.shareNote}
        </Text>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4, borderTopColor: C.borderMuted }]}>
        <GlassPressable
          testID="settings-share-send"
          accessibilityRole="button"
          accessibilityState={{ disabled: !count }}
          disabled={!count}
          onPress={send}
          style={({ pressed }) => [
            s.sendBtn,
            // Cam yolunda stildeki opacity düşer; pasif hâl zeminin tonuyla anlatılır.
            { backgroundColor: count ? C.accent : alpha(C.accent, 0.4), width: preview.cardWidth },
            pressed && s.pressed,
          ]}
        >
          <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
          <Text allowFontScaling={false} numberOfLines={1} style={s.sendText}>
            {copy.sendSelected(count)}
          </Text>
        </GlassPressable>
      </View>

      <ShareToChatSheet visible={!!pickerShare} share={pickerShare} onClose={() => setPickerShare(null)} />
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  previewCard: { alignSelf: "center", borderRadius: 18, borderWidth: 1, padding: 12, marginTop: 8 },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  previewBadge: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  previewTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  offPill: { flexShrink: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  offText: { fontSize: 10.5, fontWeight: "700" },
  previewOff: { opacity: 0.35 },
  labelRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  toggleAll: { marginBottom: 10 },
  toggleAllText: { fontSize: 12, fontWeight: "700" },
  listInCard: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0 },
  note: { fontSize: 11, fontWeight: "500", lineHeight: 16, marginTop: 10, marginHorizontal: 4 },
  footer: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  sendBtn: {
    minHeight: 50,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.8 },
  sendText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900", flexShrink: 1 },
});

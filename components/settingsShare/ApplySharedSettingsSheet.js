// components/settingsShare/ApplySharedSettingsSheet.js
//
// Sohbette gelen görünüm ayarlarını SEÇEREK uygulama sayfası. Üstte paylaşılan
// temanın mini uygulama önizlemesi, altında bölüm satırları (tema, yazı tipi,
// efektler, afiş ve köşeler, liste görünümü, ana ekran bölümleri).
//
// Varsayılan seçim: uygulanabilir VE cihazdakinden FARKLI bölümler. "Zaten aynı"
// olan da elle seçilebilir; Premium'a bağlı olan seçilemez, dokununca yükseltme
// sayfası açılır.
//
// Uygulama sayfa TAMAMEN kapandıktan sonra (onDismissed) yapılır: tema değişince
// tüm uygulama yeniden çizilir, kapanmakta olan Modal'ın içinde bunu yapmak
// gereksiz yük; yükseltme sayfası da iOS'ta kapanan Modal'ın üstüne açılamaz
// (bkz. components/common/BottomSheetModal.js). Ardından "Geri Al"lı toast.
//
// Yerleşim (yükseklik sınırı, sabit başlık/düğmeler, tablet genişliği):
// SettingsShareSheetFrame.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import GlassPressable from "../common/GlassPressable";
import { toast } from "../AppToast";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePremium } from "../../context/PremiumContext";
import { ensureCatalogFontsLoaded } from "../../context/TypographyContext";
import { showPremiumLimitAlert } from "../../services/premiumUpsell";
import useSettingsShare from "../../hooks/useSettingsShare";
import {
  planSettingsApply,
  sectionLock,
  sectionMatchesCurrent,
  settingsShareSectionIds,
  sharedFontRolesOf,
  sharedThemeColors,
} from "../../utils/settingsShare";
import { fontFamilyOf, getSettingsShareCopy, themeLabel } from "../../utils/settingsShareCopy";
import { buildUiColors } from "../../screens/tabs/settings/settingsUi";
import SettingsThemeMock from "./SettingsThemeMock";
import SettingsSectionList from "./SettingsSectionList";
import SettingsShareSheetFrame, { useSettingsSheetLayout } from "./SettingsShareSheetFrame";

export default function ApplySharedSettingsSheet({ visible, share, onClose }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const { plan } = usePremium();
  const settings = useSettingsShare();
  const copy = getSettingsShareCopy(language);
  const C = buildUiColors(theme);
  const layout = useSettingsSheetLayout();
  const afterCloseRef = useRef(null);

  // Satırlar sayfa AÇILDIĞI render'da hesaplanır (effect'te değil): effect'te ilk
  // kare boş satırla çiziliyor, sayfa küçük açılıp sonra büyüyordu. Açıkken bir daha
  // hesaplanmaz — uygulandıktan sonra (kapanış animasyonu sürerken) "Zaten aynı"ya
  // dönüp titremesin, sonraki ayar değişimleri açık sayfanın seçimini ezmesin.
  const [opened, setOpened] = useState({ visible: false, rows: [] });
  const [selected, setSelected] = useState(() => new Set());
  if (visible !== opened.visible) {
    if (visible && share) {
      const next = settingsShareSectionIds(share).map((id) => ({
        id,
        lock: sectionLock(share, id, plan),
        same: sectionMatchesCurrent(share, id, { read: settings.read, customThemes: settings.customThemes }),
      }));
      setOpened({ visible: true, rows: next });
      setSelected(new Set(next.filter((row) => !row.lock && !row.same).map((row) => row.id)));
    } else if (!visible) {
      // Kapanırken son satırlar kalır (çıkış animasyonu boyunca aynı içerik).
      setOpened((previous) => ({ ...previous, visible: false }));
    }
  }
  const rows = opened.rows;

  useEffect(() => {
    // Katalog fontları arka planda geç yüklenir; önizleme gerçek fontla çizilsin.
    if (visible && share?.sections?.fonts) ensureCatalogFontsLoaded();
  }, [visible, share]);

  const sharedTheme = useMemo(() => sharedThemeColors(share), [share]);
  const headingFamily = fontFamilyOf(sharedFontRolesOf(share)?.heading);
  const selectable = rows.filter((row) => !row.lock);
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.id));
  const nothingNew = rows.length > 0 && rows.every((row) => row.lock || row.same);

  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((row) => row.id)));

  const runApply = (ids) => {
    const { sections } = planSettingsApply(share, ids, { plan });
    const result = settings.apply(sections);
    if (!result.applied.length) {
      toast.error(copy.applyFailed);
      return;
    }
    const title = result.failed.length
      ? copy.appliedPartial(result.applied.length, result.failed.length)
      : copy.applied(result.applied.length);
    toast.undo(
      title,
      () => {
        result.undo();
        toast.success(copy.undone);
      },
      { kind: "success" },
    );
  };

  const confirm = () => {
    if (!selected.size) return;
    const ids = [...selected];
    afterCloseRef.current = () => runApply(ids);
    onClose();
  };

  const openUpsell = (row) => {
    afterCloseRef.current = () => showPremiumLimitAlert(row.lock, plan);
    onClose();
  };

  const handleDismissed = () => {
    const next = afterCloseRef.current;
    afterCloseRef.current = null;
    next?.();
  };

  const count = selected.size;

  return (
    <SettingsShareSheetFrame
      visible={visible}
      onClose={onClose}
      onDismissed={handleDismissed}
      icon="color-palette"
      title={copy.applyTitle}
      subtitle={share?.owner ? `${copy.from(share.owner)} · ${copy.applySubtitle}` : copy.applySubtitle}
      cancelLabel={copy.cancel}
      confirmLabel={copy.applySelected(count)}
      confirmIcon="checkmark-done"
      confirmTestID="settings-share-apply"
      confirmDisabled={!count}
      onConfirm={confirm}
    >
      {sharedTheme ? (
        <SettingsThemeMock
          theme={sharedTheme}
          large={layout.largeMock}
          posterCount={layout.posterCount}
          title={themeLabel(share, { language, t })}
          headingFamily={headingFamily}
          posterRadius={share?.sections?.posters?.listsPosterRadius ?? 10}
        />
      ) : null}

      <View style={styles.listHead}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.listTitle, { color: C.muted }]}>
          {copy.groups(rows.length).toLocaleUpperCase()}
        </Text>
        {selectable.length > 1 ? (
          <GlassPressable glass={false} accessibilityRole="button" onPress={toggleAll} hitSlop={8}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.toggleAll, { color: C.accent }]}>
              {allSelected ? copy.selectNone : copy.selectAll}
            </Text>
          </GlassPressable>
        ) : null}
      </View>

      <SettingsSectionList
        share={share}
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onLockedPress={openUpsell}
        colors={C}
        language={language}
        t={t}
      />

      <Text allowFontScaling={false} style={[styles.note, { color: C.muted }]}>
        {nothingNew ? copy.nothingNew : copy.applyNote}
      </Text>
    </SettingsShareSheetFrame>
  );
}

const styles = StyleSheet.create({
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, marginBottom: 8 },
  listTitle: { flexShrink: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  toggleAll: { fontSize: 12.5, fontWeight: "800" },
  note: { fontSize: 11.5, fontWeight: "500", lineHeight: 16, marginTop: 10 },
});

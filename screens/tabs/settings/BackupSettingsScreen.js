// screens/tabs/settings/BackupSettingsScreen.js
//
// Ayarlar > Veri ve depolama > Ayarları Yedekle ve Geri Yükle.
//
// Ayarlar (özel temalar dahil) tek bir JSON dosyasına yazılır, dosya olarak
// paylaşılır/kaydedilir ya da panoya kopyalanır; geri yüklerken önce NE
// uygulanacağı gösterilir, onaydan sonra yazılır ve uygulama yeniden başlar.
// Önceki ayarlar "geri alma noktası" olarak saklanır (bkz. services/
// settingsBackupService.js). Biçim/doğrulama: utils/settingsBackup.js.

import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import SheetScroll from "@components/common/SheetScroll";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  applyImport,
  collectCurrentBackup,
  getRestorePoint,
  previewImport,
  restoreFromRestorePoint,
} from "@services/settingsBackupService";
import {
  exportToClipboard,
  exportToFile,
  pickBackupFile,
  readClipboardBackup,
} from "@services/settingsBackupFiles";
import { reloadApp } from "@services/appReload";
import { backupFileName, summarizeBackupContents } from "@utils/settingsBackup";
import { alpha } from "../../../theme/colors";
import { SettingsSubScreen, SectionLabel, SettingRow, Chevron, buildUiColors, ui } from "./settingsUi";
import {
  count,
  errorMessage,
  fill,
  getBackupCopy,
  groupSub,
  groupTitle,
  platformName,
} from "./backupCopy";

const tick = () => {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fmtDate = (iso, locale) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

export default function BackupSettingsScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "tr-TR";
  const copy = useMemo(() => getBackupCopy(isEn), [isEn]);
  const C = buildUiColors(theme);

  const [busy, setBusy] = useState(null); // "export-file" | "export-clipboard" | "import-file" | "import-clipboard"
  const [pending, setPending] = useState(null); // { plan, fileName }
  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const afterCloseRef = useRef(null);

  // Ekran açılınca bir kez okunur; içe aktarma/geri alma sonrası uygulama zaten yeniden başlar.
  const contents = useMemo(() => summarizeBackupContents(collectCurrentBackup()), []);
  const restorePoint = useMemo(() => getRestorePoint(), []);
  const fileName = useMemo(() => backupFileName(), []);

  const run = async (id, task) => {
    if (busy || applying) return;
    tick();
    setBusy(id);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  /* ── Dışa aktar ── */
  const exportFile = () =>
    run("export-file", async () => {
      const res = await exportToFile({ dialogTitle: copy.title });
      if (res.ok) toast.success(copy.exported);
      else toast.error(errorMessage(copy, res.error));
    });

  const exportClipboard = () =>
    run("export-clipboard", async () => {
      const res = await exportToClipboard();
      if (res.ok) toast.success(copy.copied);
      else toast.error(errorMessage(copy, res.error));
    });

  /* ── İçe aktar: oku → ÖNİZLE → onayla ── */
  const importFrom = (id, reader) =>
    run(id, async () => {
      const res = await reader();
      if (res.cancelled) return;
      if (!res.ok) {
        toast.error(errorMessage(copy, res.error));
        return;
      }
      const plan = previewImport(res.backup);
      if (!plan.writes.length) {
        toast.info(copy.nothingToImport);
        return;
      }
      setPending({ plan, fileName: res.fileName || null });
      setSheetVisible(true);
    });

  // Ayarlar yazıldıktan sonra: bildir, toast görünsün, uygulamayı yeniden yükle.
  const finishAndReload = async (message) => {
    toast.success(message);
    await wait(700);
    const reloaded = await reloadApp();
    if (!reloaded) appAlert(copy.manualRestartTitle, copy.manualRestartBody);
  };

  const confirmImport = async () => {
    if (!pending || applying) return;
    setApplying(true);
    let result;
    try {
      result = await applyImport(pending.plan);
    } finally {
      setApplying(false);
    }
    const message = result.failed ? count(copy, "importedPartial", result.failed) : copy.imported;
    // Alt sayfa TAM kapanınca (onDismissed) devam: iOS'ta kapanan Modal'ın üstüne
    // ikinci pencere (uyarı) sunulamaz.
    afterCloseRef.current = () => finishAndReload(message);
    setSheetVisible(false);
  };

  const closeSheet = () => {
    if (!applying) setSheetVisible(false);
  };

  const handleDismissed = () => {
    const next = afterCloseRef.current;
    afterCloseRef.current = null;
    if (next) next();
  };

  /* ── Geri al ── */
  const confirmRestore = () => {
    if (busy || applying) return;
    appAlert(copy.restoreConfirmTitle, copy.restoreConfirmBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.restoreAction,
        style: "destructive",
        onPress: async () => {
          const res = await restoreFromRestorePoint();
          if (!res.ok) {
            toast.error(copy.errReadFailed);
            return;
          }
          finishAndReload(copy.restored);
        },
      },
    ]);
  };

  const spinner = <ActivityIndicator size="small" color={C.accent} />;
  const plan = pending?.plan;
  const metaLine = plan
    ? [
        plan.meta.createdAt ? fmtDate(plan.meta.createdAt, locale) : "",
        plan.meta.appVersion ? `v${plan.meta.appVersion}` : "",
        platformName(copy, plan.meta.platform),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const GROUP_TONES = [
    [C.iconPurple, C.purple],
    [C.iconBlue, C.blue],
    [C.iconGreen, C.green],
    [C.iconAmber, C.amber],
    [C.iconTeal, C.teal],
  ];

  return (
    <SettingsSubScreen title={copy.title}>
      {/* ── Tanıtım ── */}
      <View style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="archive-outline" size={26} color={C.accent} />
        </View>
        <View style={s.heroCopy}>
          <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
            {copy.heroTitle}
          </Text>
          <Text allowFontScaling={false} style={[s.heroText, { color: C.muted }]}>
            {copy.heroText}
          </Text>
        </View>
      </View>

      {/* ── Neler dahil ── */}
      <SectionLabel color={C.muted}>{copy.sectionIncluded.toLocaleUpperCase(locale)}</SectionLabel>
      <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {contents.groups.map((group, index) => {
          const [bg, fg] = GROUP_TONES[index % GROUP_TONES.length];
          const last = index === contents.groups.length - 1;
          const showThemes = group.id === "appearance" && contents.themeCount > 0;
          return (
            <View
              key={group.id}
              style={[ui.row, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}
            >
              <View style={ui.rowLeft}>
                <View style={[ui.iconWrap, { backgroundColor: bg }]}>
                  <AppIcon family="Ionicons" name={group.icon} size={15} color={fg} />
                </View>
                <View style={ui.rowTexts}>
                  <Text allowFontScaling={false} style={[ui.rowTitle, { color: C.text }]}>
                    {groupTitle(copy, group.id)}
                  </Text>
                  <Text allowFontScaling={false} style={[ui.rowSub, { color: C.muted }]}>
                    {groupSub(copy, group.id)}
                  </Text>
                  {showThemes ? (
                    <Text allowFontScaling={false} style={[s.themeLine, { color: C.accent }]}>
                      {count(copy, "themeCount", contents.themeCount)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[s.badge, { backgroundColor: group.saved ? C.accentDim : C.closeBg }]}>
                <Text
                  allowFontScaling={false}
                  style={[s.badgeText, { color: group.saved ? C.accentStrong : C.muted }]}
                >
                  {group.saved ? fill(copy.customized, { n: group.saved }) : copy.allDefault}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
        {copy.notIncluded}
      </Text>

      {/* ── Dışa aktar ── */}
      <SectionLabel color={C.muted}>{copy.sectionExport.toLocaleUpperCase(locale)}</SectionLabel>
      <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="download-outline"
          title={copy.exportFile}
          subtitle={fill(copy.exportFileSub, { name: fileName })}
          onPress={exportFile}
          right={busy === "export-file" ? spinner : <Chevron color={C.muted} />}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconTeal}
          iconColor={C.teal}
          iconName="copy-outline"
          title={copy.exportClipboard}
          subtitle={copy.exportClipboardSub}
          onPress={exportClipboard}
          right={busy === "export-clipboard" ? spinner : <Chevron color={C.muted} />}
          last
        />
      </View>

      {/* ── İçe aktar ── */}
      <SectionLabel color={C.muted}>{copy.sectionImport.toLocaleUpperCase(locale)}</SectionLabel>
      <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconGreen}
          iconColor={C.green}
          iconName="folder-open-outline"
          title={copy.importFile}
          subtitle={copy.importFileSub}
          onPress={() => importFrom("import-file", pickBackupFile)}
          right={busy === "import-file" ? spinner : <Chevron color={C.muted} />}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconAmber}
          iconColor={C.amber}
          iconName="clipboard-outline"
          title={copy.importClipboard}
          subtitle={copy.importClipboardSub}
          onPress={() => importFrom("import-clipboard", readClipboardBackup)}
          right={busy === "import-clipboard" ? spinner : <Chevron color={C.muted} />}
          last
        />
      </View>

      {/* ── Geri al (yalnız bir içe aktarma yapıldıysa) ── */}
      {restorePoint ? (
        <>
          <SectionLabel color={C.muted}>{copy.sectionRestore.toLocaleUpperCase(locale)}</SectionLabel>
          <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow
              colors={C}
              iconBg={C.dangerDim}
              iconColor={C.danger}
              iconName="arrow-undo-outline"
              title={copy.restoreTitle}
              subtitle={
                fill(copy.restoreSub, { date: fmtDate(restorePoint.createdAt, locale) }) +
                (restorePoint.themeCount ? ` · ${count(copy, "themeCount", restorePoint.themeCount)}` : "")
              }
              onPress={confirmRestore}
              right={<Chevron color={C.muted} />}
              last
            />
          </View>
        </>
      ) : null}

      {/* ── İçe aktarma önizleme sayfası ── */}
      <BottomSheetModal
        visible={sheetVisible}
        onClose={closeSheet}
        onDismissed={handleDismissed}
        intensity={35}
        dimColor="rgba(0,0,0,0.38)"
      >
        <SafeAreaView
          edges={["bottom"]}
          style={[s.sheet, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <View style={[s.handle, { backgroundColor: C.handle }]} />
          <SheetScroll>
            <View style={s.sheetHead}>
              <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
                <AppIcon family="Ionicons" name="archive-outline" size={24} color={C.accent} />
              </View>
              <View style={s.heroCopy}>
                <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
                  {copy.sheetTitle}
                </Text>
                {metaLine ? (
                  <Text allowFontScaling={false} style={[s.heroText, { color: C.muted }]}>
                    {metaLine}
                  </Text>
                ) : null}
                {pending?.fileName ? (
                  <Text allowFontScaling={false} numberOfLines={1} style={[s.fileLine, { color: C.muted }]}>
                    {copy.sheetFile}: {pending.fileName}
                  </Text>
                ) : null}
              </View>
            </View>

            {plan ? (
              <>
                <Text allowFontScaling={false} style={[s.willApply, { color: C.text }]}>
                  {count(copy, "sheetWillApply", plan.writes.length)}
                </Text>

                <View style={[s.listBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                  {plan.groups
                    .filter((g) => g.applied > 0)
                    .map((g, i, arr) => (
                      <View
                        key={g.id}
                        style={[
                          s.listRow,
                          i !== arr.length - 1 && { borderBottomColor: C.borderMuted, borderBottomWidth: StyleSheet.hairlineWidth },
                        ]}
                      >
                        <Text allowFontScaling={false} style={[s.listTitle, { color: C.text }]}>
                          {groupTitle(copy, g.id)}
                        </Text>
                        <Text allowFontScaling={false} style={[s.listValue, { color: C.muted }]}>
                          {count(copy, "sheetGroupLine", g.applied)}
                        </Text>
                      </View>
                    ))}
                </View>

                {plan.themes.incoming > 0 ? (
                  <View style={[s.themeBox, { backgroundColor: C.accentDim, borderColor: alpha(C.accent, 0.35) }]}>
                    <View style={s.themeHead}>
                      <AppIcon family="Ionicons" name="color-palette" size={15} color={C.accent} />
                      <Text allowFontScaling={false} style={[s.themeTitle, { color: C.text }]}>
                        {copy.sheetThemes}
                      </Text>
                    </View>
                    <Text allowFontScaling={false} style={[s.themeText, { color: C.text }]}>
                      {[
                        plan.themes.added ? fill(copy.sheetThemesNew, { n: plan.themes.added }) : "",
                        plan.themes.updated ? fill(copy.sheetThemesUpdated, { n: plan.themes.updated }) : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {plan.themes.names.length ? (
                      <Text allowFontScaling={false} numberOfLines={2} style={[s.themeNames, { color: C.muted }]}>
                        {plan.themes.names.join(", ")}
                      </Text>
                    ) : null}
                    {plan.themes.kept > 0 ? (
                      <Text allowFontScaling={false} style={[s.themeNames, { color: C.muted }]}>
                        {count(copy, "sheetThemesKept", plan.themes.kept)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {plan.warnings.includes("some-invalid") ? (
                  <Warn colors={C}>
                    {count(copy, "warnInvalid", plan.skipped.filter((x) => x.reason !== "unknown").length)}
                  </Warn>
                ) : null}
                {plan.warnings.includes("theme-missing") ? <Warn colors={C}>{copy.warnThemeMissing}</Warn> : null}
                {plan.warnings.includes("themes-dropped") ? (
                  <Warn colors={C}>{count(copy, "warnThemesDropped", plan.themes.dropped)}</Warn>
                ) : null}

                <Text allowFontScaling={false} style={[s.restartNote, { color: C.muted }]}>
                  {copy.restartNote}
                </Text>
              </>
            ) : null}
          </SheetScroll>

          <View style={s.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              disabled={applying}
              onPress={closeSheet}
              style={[s.cancelBtn, { borderColor: C.border, opacity: applying ? 0.5 : 1 }]}
            >
              <Text allowFontScaling={false} style={[s.cancelText, { color: C.muted }]}>
                {copy.cancel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={applying}
              onPress={confirmImport}
              style={[s.confirmBtn, { backgroundColor: C.accent }]}
            >
              {applying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon family="Ionicons" name="refresh" size={17} color="#FFFFFF" />
              )}
              <Text allowFontScaling={false} numberOfLines={1} style={s.confirmText}>
                {applying ? copy.applying : copy.confirm}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BottomSheetModal>
    </SettingsSubScreen>
  );
}

function Warn({ colors, children }) {
  return (
    <View style={[s.warn, { backgroundColor: alpha(colors.amber, 0.12), borderColor: alpha(colors.amber, 0.4) }]}>
      <AppIcon family="Ionicons" name="alert-circle" size={15} color={colors.amber} />
      <Text allowFontScaling={false} style={[s.warnText, { color: colors.text }]}>
        {children}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 6 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: "800" },
  heroText: { fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 17 },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginLeft: 8 },
  badgeText: { fontSize: 10.5, fontWeight: "700" },
  themeLine: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  note: { fontSize: 11, fontWeight: "500", lineHeight: 16, marginTop: 10, marginHorizontal: 4 },

  sheet: { flexShrink: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  fileLine: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  willApply: { fontSize: 14, fontWeight: "800", marginTop: 16 },
  listBox: { marginTop: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  listRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  listTitle: { fontSize: 13, fontWeight: "650", flexShrink: 1 },
  listValue: { fontSize: 12, fontWeight: "700" },
  themeBox: { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  themeHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  themeTitle: { fontSize: 13, fontWeight: "800" },
  themeText: { fontSize: 12.5, fontWeight: "700" },
  themeNames: { fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  warn: { marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  warnText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  restartNote: { fontSize: 11.5, fontWeight: "500", lineHeight: 16, marginTop: 12 },
  actions: { flexDirection: "row", gap: 11, marginTop: 16 },
  cancelBtn: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14.5, fontWeight: "800" },
  confirmBtn: { flex: 2, minHeight: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10 },
  confirmText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900", flexShrink: 1 },
});

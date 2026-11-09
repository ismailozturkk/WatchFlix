// screens/tabs/settings/BackupSettingsScreen.js
//
// Ayarlar > Veri ve depolama > Ayarları Yedekle ve Geri Yükle.
//
// Ayarlar (özel temalar dahil) tek bir JSON dosyasına yazılır, dosya olarak
// paylaşılır/kaydedilir ya da panoya kopyalanır. Hangi içeriğin dosyaya gireceği
// satırlardan seçilir; geri yüklerken de önce NE uygulanacağı aynı biçimde
// gösterilir ve seçtirilir, onaydan sonra yazılır ve uygulama yeniden başlar.
// Önceki ayarlar "geri alma noktası" olarak saklanır (bkz. services/
// settingsBackupService.js). Biçim/doğrulama: utils/settingsBackup.js.

import { intlLocaleOf } from "../../../utils/appLanguages";
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LensLoader from "../../../components/LensLoader";
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
import {
  BACKUP_GROUPS,
  backupFileName,
  filterPlanByGroups,
  pickBackupGroups,
  serializeBackup,
  summarizeBackupContents,
} from "@utils/settingsBackup";
import { alpha } from "../../../theme/colors";
import { SettingsSubScreen, SettingRow, Chevron, buildUiColors, ui } from "./settingsUi";
import { PickListHead, PickRow, SectionHead, StatGrid } from "./BackupKit";
import {
  count,
  errorMessage,
  fill,
  getBackupCopy,
  groupSub,
  groupTitle,
  platformName,
} from "./backupCopy";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassBox from "../../../components/common/GlassBox";

const tick = () => {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ALL_GROUP_IDS = BACKUP_GROUPS.map((group) => group.id);

const fmtSize = (chars) =>
  chars >= 1024 * 1024 ? `${(chars / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(chars / 1024))} KB`;

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
  const locale = intlLocaleOf(language);
  const copy = useMemo(() => getBackupCopy(language), [language]);
  const C = buildUiColors(theme);

  const [busy, setBusy] = useState(null); // "export-file" | "export-clipboard" | "import-file" | "import-clipboard"
  const [pending, setPending] = useState(null); // { plan, fileName }
  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [exportIds, setExportIds] = useState(ALL_GROUP_IDS); // dosyaya girecek gruplar
  const [importIds, setImportIds] = useState(ALL_GROUP_IDS); // yedekten uygulanacak gruplar
  const afterCloseRef = useRef(null);

  // Ekran açılınca bir kez okunur; içe aktarma/geri alma sonrası uygulama zaten yeniden başlar.
  const currentBackup = useMemo(() => collectCurrentBackup(), []);
  const contents = useMemo(() => summarizeBackupContents(currentBackup), [currentBackup]);
  const restorePoint = useMemo(() => getRestorePoint(), []);
  const fileName = useMemo(() => backupFileName(), []);

  const exportStats = useMemo(() => {
    const picked = contents.groups.filter((group) => exportIds.includes(group.id));
    return {
      settings: picked.reduce((sum, group) => sum + group.total, 0),
      customized: picked.reduce((sum, group) => sum + group.saved, 0),
      themes: exportIds.includes("appearance") ? contents.themeCount : 0,
      size: fmtSize(serializeBackup(pickBackupGroups(currentBackup, exportIds)).length),
    };
  }, [contents, currentBackup, exportIds]);
  const nothingToExport = exportIds.length === 0;

  const toggleId = (setter) => (id) => {
    tick();
    setter((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };
  const toggleExport = toggleId(setExportIds);
  const toggleImport = toggleId(setImportIds);

  const run = async (id, task) => {
    if (busy || applying) return;
    if (id.startsWith("export") && nothingToExport) {
      toast.info(copy.noneSelected);
      return;
    }
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
      const res = await exportToFile({ dialogTitle: copy.title, groups: exportIds });
      if (res.ok) toast.success(copy.exported);
      else toast.error(errorMessage(copy, res.error));
    });

  const exportClipboard = () =>
    run("export-clipboard", async () => {
      const res = await exportToClipboard({ groups: exportIds });
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
      setImportIds(plan.groups.filter((g) => g.applied > 0).map((g) => g.id));
      setSheetVisible(true);
    });

  // Ayarlar yazıldıktan sonra: bildir, toast görünsün, uygulamayı yeniden yükle.
  const finishAndReload = async (message) => {
    toast.success(message);
    await wait(700);
    const reloaded = await reloadApp();
    if (!reloaded) appAlert(copy.manualRestartTitle, copy.manualRestartBody);
  };

  // Önizleme sayfasında işaretli gruplara göre uygulanacak plan ve sayıları.
  const plan = pending?.plan;
  const selectedPlan = useMemo(() => (plan ? filterPlanByGroups(plan, importIds) : null), [plan, importIds]);
  const importGroups = plan ? plan.groups.filter((g) => g.applied > 0) : [];
  const importChanged = selectedPlan
    ? selectedPlan.writes.filter((write) => plan.changedIds?.includes(write.id)).length
    : 0;
  const importThemesShown = !!plan && plan.themes.incoming > 0 && importIds.includes("appearance");

  const confirmImport = async () => {
    if (!pending || applying || !selectedPlan?.writes.length) return;
    setApplying(true);
    let result;
    try {
      result = await applyImport(selectedPlan);
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

  const spinner = <LensLoader size="small" color={C.accent} />;
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
      <GlassBox role="card" style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="archive-outline" size={26} color={C.accent} />
        </View>
        <View style={s.heroCopy}>
          <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
            {copy.heroTitle}
          </Text>
        </View>
      </GlassBox>

      {/* ── Neler dahil: istatistik + seçim ── */}
      <SectionHead
        colors={C}
        label={copy.sectionIncluded.toLocaleUpperCase(locale)}
        info={[copy.heroText, copy.notIncluded]}
        infoLabel={copy.infoLabel}
      />
      <View style={s.stats}>
        <StatGrid
          colors={C}
          items={[
            { id: "settings", value: exportStats.settings, label: copy.statSettings },
            { id: "customized", value: exportStats.customized, label: copy.statCustomized },
            { id: "themes", value: exportStats.themes, label: copy.statThemes },
            { id: "size", value: exportStats.size, label: copy.statSize },
          ]}
        />
      </View>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <PickListHead
          colors={C}
          summary={fill(copy.groupsSelected, { n: exportIds.length, total: ALL_GROUP_IDS.length })}
          allSelected={exportIds.length === ALL_GROUP_IDS.length}
          selectAllLabel={copy.selectAll}
          selectNoneLabel={copy.selectNone}
          onToggleAll={() => {
            tick();
            setExportIds(exportIds.length === ALL_GROUP_IDS.length ? [] : ALL_GROUP_IDS);
          }}
        />
        {contents.groups.map((group, index) => {
          const [bg, fg] = GROUP_TONES[index % GROUP_TONES.length];
          const showThemes = group.id === "appearance" && contents.themeCount > 0;
          return (
            <PickRow
              key={group.id}
              colors={C}
              icon={group.icon}
              iconBg={bg}
              iconColor={fg}
              title={groupTitle(copy, group.id)}
              sub={groupSub(copy, group.id)}
              stat={group.saved ? fill(copy.customized, { n: group.saved }) : copy.allDefault}
              ratio={group.total ? group.saved / group.total : 0}
              note={showThemes ? count(copy, "themeCount", contents.themeCount) : null}
              selected={exportIds.includes(group.id)}
              onToggle={() => toggleExport(group.id)}
              last={index === contents.groups.length - 1}
            />
          );
        })}
      </GlassBox>

      {/* ── Dışa aktar ── */}
      <SectionHead colors={C} label={copy.sectionExport.toLocaleUpperCase(locale)} />
      <GlassBox
        role="card"
        style={[ui.card, { backgroundColor: C.card, borderColor: C.border, opacity: nothingToExport ? 0.55 : 1 }]}
      >
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
      </GlassBox>

      {/* ── İçe aktar ── */}
      <SectionHead colors={C} label={copy.sectionImport.toLocaleUpperCase(locale)} />
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
      </GlassBox>

      {/* ── Geri al (yalnız bir içe aktarma yapıldıysa) ── */}
      {restorePoint ? (
        <>
          <SectionHead colors={C} label={copy.sectionRestore.toLocaleUpperCase(locale)} />
          <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
          </GlassBox>
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
                <SectionHead
                  colors={C}
                  label={count(copy, "sheetWillApply", selectedPlan.writes.length)}
                  info={copy.restartNote}
                  infoLabel={copy.infoLabel}
                />
                <StatGrid
                  colors={C}
                  tileColor={C.bg}
                  items={[
                    { id: "apply", value: selectedPlan.writes.length, label: copy.statApply },
                    { id: "changed", value: importChanged, label: copy.statChanged },
                    { id: "same", value: selectedPlan.writes.length - importChanged, label: copy.statSame },
                    { id: "themes", value: importIds.includes("appearance") ? plan.themes.incoming : 0, label: copy.statThemes },
                  ]}
                />

                <View style={[s.listBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                  <PickListHead
                    colors={C}
                    summary={fill(copy.groupsSelected, {
                      n: importGroups.filter((g) => importIds.includes(g.id)).length,
                      total: importGroups.length,
                    })}
                    allSelected={importGroups.every((g) => importIds.includes(g.id))}
                    selectAllLabel={copy.selectAll}
                    selectNoneLabel={copy.selectNone}
                    onToggleAll={() => {
                      tick();
                      setImportIds(
                        importGroups.every((g) => importIds.includes(g.id)) ? [] : importGroups.map((g) => g.id),
                      );
                    }}
                  />
                  {importGroups.map((g, i) => {
                    const group = BACKUP_GROUPS.find((item) => item.id === g.id);
                    const [bg, fg] = GROUP_TONES[BACKUP_GROUPS.indexOf(group) % GROUP_TONES.length];
                    return (
                      <PickRow
                        key={g.id}
                        colors={C}
                        icon={group.icon}
                        iconBg={bg}
                        iconColor={fg}
                        title={groupTitle(copy, g.id)}
                        stat={fill(copy.sheetGroupChanged, { changed: g.changed ?? 0, n: g.applied })}
                        ratio={g.applied ? (g.changed ?? 0) / g.applied : 0}
                        selected={importIds.includes(g.id)}
                        onToggle={() => toggleImport(g.id)}
                        last={i === importGroups.length - 1}
                      />
                    );
                  })}
                </View>

                {importThemesShown ? (
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

                {selectedPlan.warnings.includes("some-invalid") ? (
                  <Warn colors={C}>
                    {count(copy, "warnInvalid", plan.skipped.filter((x) => x.reason !== "unknown").length)}
                  </Warn>
                ) : null}
                {selectedPlan.warnings.includes("theme-missing") ? <Warn colors={C}>{copy.warnThemeMissing}</Warn> : null}
                {selectedPlan.warnings.includes("themes-dropped") ? (
                  <Warn colors={C}>{count(copy, "warnThemesDropped", plan.themes.dropped)}</Warn>
                ) : null}
              </>
            ) : null}
          </SheetScroll>

          <View style={s.actions}>
            <GlassTouchable
              accessibilityRole="button"
              activeOpacity={0.8}
              disabled={applying}
              onPress={closeSheet}
              style={[s.cancelBtn, { borderColor: C.border, opacity: applying ? 0.5 : 1 }]}
            >
              <Text allowFontScaling={false} style={[s.cancelText, { color: C.muted }]}>
                {copy.cancel}
              </Text>
            </GlassTouchable>
            <GlassTouchable
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={applying || !selectedPlan?.writes.length}
              onPress={confirmImport}
              style={[s.confirmBtn, { backgroundColor: C.accent, opacity: selectedPlan?.writes.length ? 1 : 0.5 }]}
            >
              {applying ? (
                <LensLoader tone="mono" size="small" color="#FFFFFF" />
              ) : (
                <AppIcon family="Ionicons" name="refresh" size={17} color="#FFFFFF" />
              )}
              <Text allowFontScaling={false} numberOfLines={1} style={s.confirmText}>
                {applying ? copy.applying : copy.confirm}
              </Text>
            </GlassTouchable>
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

  stats: { marginBottom: 10 },

  sheet: { flexShrink: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  fileLine: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  listBox: { marginTop: 10, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  themeBox: { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  themeHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  themeTitle: { fontSize: 13, fontWeight: "800" },
  themeText: { fontSize: 12.5, fontWeight: "700" },
  themeNames: { fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  warn: { marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  warnText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  actions: { flexDirection: "row", gap: 11, marginTop: 16 },
  cancelBtn: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14.5, fontWeight: "800" },
  confirmBtn: { flex: 2, minHeight: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10 },
  confirmText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900", flexShrink: 1 },
});

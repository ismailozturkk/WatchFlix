// screens/tabs/settings/LibraryExportScreen.js
//
// Ayarlar > Veri ve depolama > Kütüphaneni Dışa Aktar.
//
// İzlenenler, listeler, izleme tarihleri ve puanlar iki biçimde dışa aktarılır: tek JSON (eksiksiz kopya)
// ya da ZIP (library.csv + Letterboxd'a aktarılabilir CSV'ler). Veri ListStatusContext'te zaten bellekte;
// ek okuma yok. Ücretsiz (taşınabilirlik hakkı — plan kapısı yok). Biçim: utils/libraryExport.js,
// dosya G/Ç: services/libraryExportFiles.js.

import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { intlLocaleOf } from "../../../utils/appLanguages";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useTheme } from "@context/ThemeContext";
import { exportLibraryJson, exportLibraryZip, snapshotFromLibrary } from "@services/libraryExportFiles";
import { isSnapshotEmpty } from "@utils/libraryExport";
import { SettingsSubScreen, SectionLabel, SettingRow, Chevron, buildUiColors, ui } from "./settingsUi";
import { exportErrorMessage, getLibraryExportCopy } from "./libraryExportCopy";

const tick = () => {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

export default function LibraryExportScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const copy = useMemo(() => getLibraryExportCopy(language), [language]);
  const C = buildUiColors(theme);
  const locale = intlLocaleOf(language);
  const { combinedLists, activityIndex, loading, watchedTvLoaded } = useListStatusContext() || {};
  const [busy, setBusy] = useState(null); // "json" | "zip"

  // Listeler gelmeden dışa aktarmak EKSİK dosya üretir (özellikle diziler alt koleksiyondan geç gelir).
  const ready = !loading && !!watchedTvLoaded && !!combinedLists;

  const snapshot = useMemo(
    () => (ready ? snapshotFromLibrary({ lists: combinedLists, ratings: activityIndex?.ratings }) : null),
    [ready, combinedLists, activityIndex],
  );
  const empty = ready && isSnapshotEmpty(snapshot);
  const counts = snapshot?.counts;

  const run = async (id, task) => {
    if (busy || !snapshot || empty) return;
    tick();
    setBusy(id);
    try {
      const res = await task();
      if (res.ok) toast.success(copy.ready);
      else toast.error(exportErrorMessage(copy, res.error));
    } finally {
      setBusy(null);
    }
  };

  const exportJson = () => run("json", () => exportLibraryJson(snapshot, { dialogTitle: copy.title }));
  const exportZip = () =>
    run("zip", () => exportLibraryZip(snapshot, { dialogTitle: copy.title, readme: copy.readme }));

  const spinner = <ActivityIndicator size="small" color={C.accent} />;
  const disabled = !ready || empty;

  const summary = counts
    ? [
        { id: "films", icon: "film-outline", tone: [C.iconAmber, C.amber], text: copy.films(counts.watchedMovies), show: counts.watchedMovies > 0 },
        {
          id: "shows",
          icon: "tv-outline",
          tone: [C.iconBlue, C.blue],
          text: copy.shows(counts.watchedShows, counts.watchedEpisodes),
          show: counts.watchedShows > 0,
        },
        { id: "watchList", icon: "bookmark-outline", tone: [C.iconPurple, C.purple], text: copy.watchList(counts.watchList), show: counts.watchList > 0 },
        { id: "favorites", icon: "heart-outline", tone: [C.dangerDim, C.danger], text: copy.favorites(counts.favorites), show: counts.favorites > 0 },
        {
          id: "customLists",
          icon: "albums-outline",
          tone: [C.iconTeal, C.teal],
          text: copy.customLists(counts.customLists, counts.customListItems),
          show: counts.customLists > 0,
        },
        { id: "ratings", icon: "star-outline", tone: [C.iconGreen, C.green], text: copy.ratings(counts.ratings), show: counts.ratings > 0 },
      ].filter((row) => row.show)
    : [];

  return (
    <SettingsSubScreen title={copy.title}>
      {/* ── Tanıtım ── */}
      <View style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="share-outline" size={26} color={C.accent} />
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
        {!ready ? (
          <View style={s.stateRow}>
            {spinner}
            <Text allowFontScaling={false} style={[s.stateText, { color: C.muted }]}>
              {copy.loading}
            </Text>
          </View>
        ) : empty ? (
          <View style={s.stateRow}>
            <Text allowFontScaling={false} style={[s.stateText, { color: C.muted }]}>
              {copy.empty}
            </Text>
          </View>
        ) : (
          summary.map((row, index) => (
            <View
              key={row.id}
              style={[ui.row, { borderBottomColor: C.borderMuted }, index === summary.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={ui.rowLeft}>
                <View style={[ui.iconWrap, { backgroundColor: row.tone[0] }]}>
                  <AppIcon family="Ionicons" name={row.icon} size={15} color={row.tone[1]} />
                </View>
                <View style={ui.rowTexts}>
                  <Text allowFontScaling={false} style={[ui.rowTitle, { color: C.text }]}>
                    {row.text}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
      <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
        {copy.notIncluded}
      </Text>

      {/* ── Dışa aktar ── */}
      <SectionLabel color={C.muted}>{copy.sectionExport.toLocaleUpperCase(locale)}</SectionLabel>
      <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border, opacity: disabled ? 0.55 : 1 }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="download-outline"
          title={copy.jsonTitle}
          subtitle={copy.jsonSub}
          onPress={disabled ? undefined : exportJson}
          right={busy === "json" ? spinner : <Chevron color={C.muted} />}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconGreen}
          iconColor={C.green}
          iconName="grid-outline"
          title={copy.zipTitle}
          subtitle={copy.zipSub}
          onPress={disabled ? undefined : exportZip}
          right={busy === "zip" ? spinner : <Chevron color={C.muted} />}
          last
        />
      </View>
      <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
        {copy.noteLetterboxd}
      </Text>
      <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
        {copy.notePrivacy}
      </Text>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 6 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroCopy: { flexShrink: 1, flexGrow: 1 },
  heroTitle: { fontSize: 16, fontWeight: "800" },
  heroText: { fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 17 },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  stateText: { flexShrink: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  note: { fontSize: 11, fontWeight: "500", lineHeight: 16, marginTop: 10, marginHorizontal: 4 },
});

// screens/tabs/settings/LibraryExportScreen.js
//
// Ayarlar > Veri ve depolama > Kütüphaneni Dışa Aktar.
//
// İzlenenler, listeler, izleme tarihleri ve puanlar iki biçimde dışa aktarılır: tek JSON (eksiksiz kopya)
// ya da ZIP (library.csv + Letterboxd'a aktarılabilir CSV'ler). Hangi içeriğin dosyaya gireceği satırlardan
// seçilir. Listeler ListStatusContext'te zaten bellekte; yalnız film/dizi YORUMLARI ekran açılınca bir kez okunur
// (services/libraryCommentsIO). Ücretsiz (taşınabilirlik hakkı — plan
// kapısı yok). Biçim: utils/libraryExport.js, dosya G/Ç: services/libraryExportFiles.js.

import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LensLoader from "../../../components/LensLoader";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { intlLocaleOf } from "../../../utils/appLanguages";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useTheme } from "@context/ThemeContext";
import { exportLibraryJson, exportLibraryZip, snapshotFromLibrary } from "@services/libraryExportFiles";
import { readMyTitleComments } from "@services/libraryCommentsIO";
import { isSnapshotEmpty, pickLibrarySections } from "@utils/libraryExport";
import { SettingsSubScreen, SettingRow, Chevron, buildUiColors, ui } from "./settingsUi";
import { exportErrorMessage, getLibraryExportCopy } from "./libraryExportCopy";
import { fill } from "./backupCopy";
import { PickListHead, PickRow, SectionHead, StatGrid } from "./BackupKit";
import GlassBox from "../../../components/common/GlassBox";

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
  const [excluded, setExcluded] = useState([]); // seçimi kaldırılan içerik kimlikleri
  const uid = useAuth()?.user?.uid || null;
  // Yorumlar: { status: "loading" | "ok" | "failed", list }
  const [comments, setComments] = useState({ status: "loading", list: [] });

  useEffect(() => {
    let alive = true;
    if (!uid) {
      setComments({ status: "failed", list: [] });
      return undefined;
    }
    readMyTitleComments(uid)
      .then((res) => alive && setComments(res.ok ? { status: "ok", list: res.comments } : { status: "failed", list: [] }))
      .catch(() => alive && setComments({ status: "failed", list: [] }));
    return () => {
      alive = false;
    };
  }, [uid]);

  // Listeler gelmeden dışa aktarmak EKSİK dosya üretir (özellikle diziler alt koleksiyondan geç gelir).
  // Yorumlar okunurken de beklenir; okunamazsa dosya yorumsuz çıkar ve ekranda yazar.
  const ready = !loading && !!watchedTvLoaded && !!combinedLists && comments.status !== "loading";

  const fullSnapshot = useMemo(
    () =>
      ready
        ? snapshotFromLibrary({ lists: combinedLists, ratings: activityIndex?.ratings, comments: comments.list })
        : null,
    [ready, combinedLists, activityIndex, comments],
  );
  const empty = ready && isSnapshotEmpty(fullSnapshot);
  const counts = fullSnapshot?.counts;

  const rows = counts
    ? [
        { id: "films", icon: "film-outline", tone: [C.iconAmber, C.amber], text: copy.films(counts.watchedMovies), amount: counts.watchedMovies },
        {
          id: "shows",
          icon: "tv-outline",
          tone: [C.iconBlue, C.blue],
          text: copy.shows(counts.watchedShows, counts.watchedEpisodes),
          amount: counts.watchedShows,
        },
        { id: "watchList", icon: "bookmark-outline", tone: [C.iconPurple, C.purple], text: copy.watchList(counts.watchList), amount: counts.watchList },
        { id: "favorites", icon: "heart-outline", tone: [C.dangerDim, C.danger], text: copy.favorites(counts.favorites), amount: counts.favorites },
        {
          id: "customLists",
          icon: "albums-outline",
          tone: [C.iconTeal, C.teal],
          text: copy.customLists(counts.customLists, counts.customListItems),
          amount: counts.customListItems,
        },
        { id: "ratings", icon: "star-outline", tone: [C.iconGreen, C.green], text: copy.ratings(counts.ratings), amount: counts.ratings },
        {
          id: "comments",
          icon: "chatbubble-ellipses-outline",
          tone: [C.iconBlue, C.blue],
          text: copy.comments(counts.comments || 0),
          amount: counts.comments || 0,
        },
      ].filter((row) => row.amount > 0)
    : [];
  const largest = rows.reduce((max, row) => Math.max(max, row.amount), 1);
  const selectedIds = rows.filter((row) => !excluded.includes(row.id)).map((row) => row.id);
  const selectionKey = selectedIds.join(",");

  const snapshot = useMemo(
    () => (fullSnapshot ? pickLibrarySections(fullSnapshot, selectionKey ? selectionKey.split(",") : []) : null),
    [fullSnapshot, selectionKey],
  );
  const picked = snapshot?.counts;
  const nothingSelected = ready && !empty && selectedIds.length === 0;

  const toggleRow = (id) => {
    tick();
    setExcluded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };
  const toggleAll = () => {
    tick();
    setExcluded(selectedIds.length === rows.length ? rows.map((row) => row.id) : []);
  };

  const run = async (id, task) => {
    if (busy || !snapshot || empty) return;
    if (nothingSelected) {
      toast.info(copy.noneSelected);
      return;
    }
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
    run("zip", () =>
      exportLibraryZip(snapshot, {
        dialogTitle: copy.title,
        readme: picked?.comments ? `${copy.readme}\n${copy.readmeComments}` : copy.readme,
      }),
    );

  const spinner = <LensLoader size="small" color={C.accent} />;
  const disabled = !ready || empty;

  return (
    <SettingsSubScreen title={copy.title}>
      {/* ── Tanıtım ── */}
      <GlassBox role="card" style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="share-outline" size={26} color={C.accent} />
        </View>
        <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
          {copy.heroTitle}
        </Text>
      </GlassBox>

      {/* ── Neler dahil ── */}
      <SectionHead
        colors={C}
        label={copy.sectionIncluded.toLocaleUpperCase(locale)}
        info={[copy.heroText, copy.notIncluded]}
        infoLabel={copy.infoLabel}
      />
      {picked && !empty ? (
        <View style={s.stats}>
          <StatGrid
            colors={C}
            items={[
              { id: "films", value: picked.watchedMovies, label: copy.statFilms },
              { id: "shows", value: picked.watchedShows, label: copy.statShows },
              { id: "episodes", value: picked.watchedEpisodes, label: copy.statEpisodes },
              { id: "ratings", value: picked.ratings, label: copy.statRatings },
              ...(picked.comments ? [{ id: "comments", value: picked.comments, label: copy.statComments }] : []),
            ]}
          />
        </View>
      ) : null}
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {!ready ? (
          <View style={s.stateRow}>
            {spinner}
            <Text allowFontScaling={false} style={[s.stateText, { color: C.muted }]}>
              {comments.status === "loading" && !loading && watchedTvLoaded ? copy.commentsLoading : copy.loading}
            </Text>
          </View>
        ) : empty ? (
          <View style={s.stateRow}>
            <Text allowFontScaling={false} style={[s.stateText, { color: C.muted }]}>
              {copy.empty}
            </Text>
          </View>
        ) : (
          <>
            <PickListHead
              colors={C}
              summary={fill(copy.sectionsSelected, { n: selectedIds.length, total: rows.length })}
              allSelected={selectedIds.length === rows.length}
              selectAllLabel={copy.selectAll}
              selectNoneLabel={copy.selectNone}
              onToggleAll={toggleAll}
            />
            {rows.map((row, index) => (
              <PickRow
                key={row.id}
                colors={C}
                icon={row.icon}
                iconBg={row.tone[0]}
                iconColor={row.tone[1]}
                title={row.text}
                stat={String(row.amount)}
                ratio={row.amount / largest}
                selected={selectedIds.includes(row.id)}
                onToggle={() => toggleRow(row.id)}
                last={index === rows.length - 1}
              />
            ))}
            {comments.status === "failed" ? (
              <View style={s.stateRow}>
                <AppIcon family="Ionicons" name="alert-circle-outline" size={16} color={C.amber} />
                <Text allowFontScaling={false} style={[s.stateText, { color: C.muted }]}>
                  {copy.commentsFailed}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </GlassBox>

      {/* ── Dışa aktar ── */}
      <SectionHead
        colors={C}
        label={copy.sectionExport.toLocaleUpperCase(locale)}
        info={[copy.noteLetterboxd, copy.notePrivacy]}
        infoLabel={copy.infoLabel}
      />
      <GlassBox
        role="card"
        style={[ui.card, { backgroundColor: C.card, borderColor: C.border, opacity: disabled || nothingSelected ? 0.55 : 1 }]}
      >
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
      </GlassBox>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 6 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroTitle: { flexShrink: 1, fontSize: 16, fontWeight: "800" },
  stats: { marginBottom: 10 },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  stateText: { flexShrink: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
});

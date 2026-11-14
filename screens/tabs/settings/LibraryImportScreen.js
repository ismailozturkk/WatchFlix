// screens/tabs/settings/LibraryImportScreen.js
//
// Ayarlar > Veri ve depolama > Kütüphaneni İçe Aktar.
//
// Kütüphaneni Dışa Aktar'ın Tam yedek (JSON) dosyasını geri yükler: izlenen filmler (tüm izleme tarihleri),
// diziler (bölüm bölüm), izleme listesi, favoriler, özel listeler, puanlar ve film/dizi yorumları. Akış:
//   giriş → dosya seç → önizleme (ne aktarılacağını seç) → çalışıyor (aşamalar) → bitti | kesildi (sürdür)
// Biçim/doğrulama: utils/libraryImport.js · iş: services/libraryImportService.js · metin: ./libraryImportCopy.js
// Mevcut kütüphane SİLİNMEZ ve EZİLMEZ; aynı dosya tekrar aktarılınca hiçbir şey çoğalmaz.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { useAuth } from "@context/AuthContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useUserProfile } from "@context/UserProfileContext";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import {
  PosterFan,
  RestoreOrb,
  SectionToggle,
  StageList,
  SummaryTiles,
} from "../../../components/libraryImport/RestoreVisuals";
import useReduceMotion from "../../../hooks/useReduceMotion";
import { createImportSignal } from "../../../services/import/importRetry";
import {
  createLibraryRestoreJob,
  pickLibraryBackup,
  restoreSummary,
  runLibraryRestore,
} from "../../../services/libraryImportService";
import { intlLocaleOf, tmdbLanguageOf } from "../../../utils/appLanguages";
import { IMPORT_SECTIONS, planStages, reduceStages, sectionAmount } from "../../../utils/libraryImport";
import { SettingsSubScreen, buildUiColors, ui } from "./settingsUi";
import { SectionHead } from "./BackupKit";
import { fileErrorText, getLibraryImportCopy, isResumableError, runErrorText } from "./libraryImportCopy";

const tick = () => {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};
const celebrate = () => {
  try {
    Haptics.notificationAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

const SECTION_META = {
  films: { icon: "film-outline", tone: (C) => [C.iconAmber, C.amber] },
  shows: { icon: "tv-outline", tone: (C) => [C.iconBlue, C.blue] },
  watchList: { icon: "bookmark-outline", tone: (C) => [C.iconPurple, C.purple] },
  favorites: { icon: "heart-outline", tone: (C) => [C.dangerDim, C.danger] },
  customLists: { icon: "albums-outline", tone: (C) => [C.iconTeal, C.teal] },
  ratings: { icon: "star-outline", tone: (C) => [C.iconGreen, C.green] },
  comments: { icon: "chatbubble-ellipses-outline", tone: (C) => [C.iconBlue, C.blue] },
};

function sectionTitle(copy, id, counts) {
  switch (id) {
    case "films":
      return copy.films(counts.films, counts.filmWatches);
    case "shows":
      return copy.shows(counts.shows, counts.episodes);
    case "customLists":
      return copy.customLists(counts.customLists, counts.customListItems);
    default:
      return copy[id](counts[id]);
  }
}

export default function LibraryImportScreen() {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = useMemo(() => getLibraryImportCopy(language), [language]);
  const locale = intlLocaleOf(language);
  const reduceMotion = useReduceMotion();
  const uid = useAuth()?.user?.uid || null;
  const authUser = useAuth()?.user || null;
  // Geri yüklemeden sonra listeler sunucudan yeniden çekilir (Letterboxd/IMDb aktarımı da böyle yapar,
  // components/import/ImportDataModal). Yapılmazsa cihazdaki liste önbelleği eski kalıyor; yeni diziler,
  // bölümler ve süreler uygulama yeniden açılana dek görünmüyordu.
  const refreshList = useListStatusContext()?.refreshList;
  const refreshRef = useRef(refreshList);
  refreshRef.current = refreshList;
  const refreshLists = useCallback(() => {
    Promise.resolve(refreshRef.current?.("all")).catch(() => {});
  }, []);
  const profile = useUserProfile() || {};

  const [phase, setPhase] = useState("intro"); // intro | reading | preview | running | done | stopped
  const [fileError, setFileError] = useState(null);
  const [picked, setPicked] = useState(null); // { backup, counts, invalid, fileName }
  const [excluded, setExcluded] = useState([]);
  const [stages, setStages] = useState({ order: [], current: null, done: [], progress: {} });
  const [summary, setSummary] = useState(null);
  const [runError, setRunError] = useState(null);
  const [stopping, setStopping] = useState(false);
  const jobRef = useRef(null);
  const signalRef = useRef(null);
  const aliveRef = useRef(true);

  // Ekrandan çıkılırsa iş durur; yazılanlar korunur (her kayıt kendi transaction'ında).
  useEffect(
    () => () => {
      aliveRef.current = false;
      signalRef.current?.cancel();
    },
    [],
  );

  const rows = useMemo(() => {
    if (!picked) return [];
    return IMPORT_SECTIONS.map((id) => ({ id, amount: sectionAmount(picked.counts, id) })).filter((row) => row.amount > 0);
  }, [picked]);
  const largest = rows.reduce((max, row) => Math.max(max, row.amount), 1);
  const selected = rows.filter((row) => !excluded.includes(row.id)).map((row) => row.id);

  const choose = async () => {
    if (phase === "reading" || phase === "running") return;
    tick();
    setFileError(null);
    setPhase("reading");
    const res = await pickLibraryBackup();
    if (!aliveRef.current) return;
    if (res.ok) {
      setPicked(res);
      setExcluded([]);
      setPhase("preview");
      return;
    }
    setPhase(picked ? "preview" : "intro");
    if (!res.cancelled) {
      setFileError(res.error);
      toast.error(fileErrorText(copy, res.error));
    }
  };

  const run = useCallback(async () => {
    const job = jobRef.current;
    if (!job) return;
    const signal = createImportSignal();
    signalRef.current = signal;
    setRunError(null);
    setStopping(false);
    setPhase("running");
    try {
      const result = await runLibraryRestore(job, {
        signal,
        onEvent: (event) => aliveRef.current && setStages((state) => reduceStages(state, event)),
      });
      refreshLists();
      if (!aliveRef.current) return;
      setSummary(result);
      setPhase("done");
      celebrate();
    } catch (error) {
      // Durdurulan / yarıda kalan geri yüklemede de yazılmış kayıtlar vardır.
      refreshLists();
      if (!aliveRef.current) return;
      const code = error?.code || "generic";
      setRunError(code);
      setSummary(restoreSummary(job));
      setPhase("stopped");
    } finally {
      if (signalRef.current === signal) signalRef.current = null;
    }
  }, [refreshLists]);

  const start = () => {
    if (!picked || !uid) return;
    if (selected.length === 0) {
      toast.info(copy.noneSelected);
      return;
    }
    tick();
    const job = createLibraryRestoreJob({
      uid,
      backup: picked.backup,
      sections: selected,
      language: tmdbLanguageOf(language),
      userProfile: {
        displayName: profile.displayName || authUser?.displayName || "",
        photoURL: profile.photoURL || authUser?.photoURL || null,
        username: profile.username || "",
        avatarIndex: profile.avatarIndex,
      },
    });
    jobRef.current = job;
    setSummary(null);
    setStages({ order: planStages(job.plan), current: null, done: [], progress: {} });
    run();
  };

  const stop = () => {
    if (!signalRef.current || stopping) return;
    tick();
    setStopping(true);
    signalRef.current.cancel();
  };

  const reset = () => {
    tick();
    jobRef.current = null;
    setPicked(null);
    setSummary(null);
    setRunError(null);
    setPhase("intro");
  };

  const exportedDate = picked?.backup?.exportedAt
    ? new Date(picked.backup.exportedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;
  const orbMode = phase === "done" ? "done" : phase === "stopped" ? "error" : phase === "running" || phase === "reading" ? "busy" : "idle";
  const enter = (delay = 0) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(340));

  /* ── Gövdeler ─────────────────────────────────────────────────────────────── */

  const hero = (title, text) => (
    <Animated.View key={`hero-${phase}`} entering={reduceMotion ? undefined : FadeIn.duration(260)} style={s.hero}>
      <RestoreOrb C={C} mode={orbMode} reduceMotion={reduceMotion} />
      <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
        {title}
      </Text>
      {text ? <Text style={[s.heroText, { color: C.muted }]}>{text}</Text> : null}
    </Animated.View>
  );

  const primary = (label, onPress, { icon, disabled } = {}) => (
    <GlassTouchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.primary, { backgroundColor: C.accent, opacity: disabled ? 0.5 : 1 }]}
    >
      {icon ? <AppIcon family="Ionicons" name={icon} size={18} color={C.white} /> : null}
      <Text allowFontScaling={false} style={[s.primaryText, { color: C.white }]}>
        {label}
      </Text>
    </GlassTouchable>
  );

  const secondary = (label, onPress, icon) => (
    <GlassTouchable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.secondary, { backgroundColor: C.card, borderColor: C.border }]}
    >
      {icon ? <AppIcon family="Ionicons" name={icon} size={16} color={C.text} /> : null}
      <Text allowFontScaling={false} style={[s.secondaryText, { color: C.text }]}>
        {label}
      </Text>
    </GlassTouchable>
  );

  const note = (icon, color, text, key) => (
    <View key={key} style={s.noteRow}>
      <AppIcon family="Ionicons" name={icon} size={15} color={color} />
      <Text style={[s.noteText, { color: C.muted }]}>{text}</Text>
    </View>
  );

  let body = null;

  if (phase === "intro" || phase === "reading") {
    body = (
      <>
        {hero(copy.heroTitle, phase === "reading" ? copy.reading : copy.heroText)}
        {fileError ? (
          <Animated.View entering={enter()} style={[s.alert, { backgroundColor: C.dangerDim, borderColor: C.danger }]}>
            <AppIcon family="Ionicons" name="alert-circle-outline" size={18} color={C.danger} />
            <Text style={[s.alertText, { color: C.text }]}>{fileErrorText(copy, fileError)}</Text>
          </Animated.View>
        ) : null}
        <Animated.View entering={enter(80)}>
          {primary(copy.pickButton, choose, { icon: "folder-open-outline", disabled: phase === "reading" })}
        </Animated.View>
        <SectionHead colors={C} label={copy.howTitle.toLocaleUpperCase(locale)} />
        <GlassBox role="card" style={[ui.card, s.howCard, { backgroundColor: C.card, borderColor: C.border }]}>
          {copy.how.map((line, index) => (
            <Animated.View key={line} entering={enter(140 + index * 70)} style={s.howRow}>
              <View style={[s.howNum, { backgroundColor: C.accentDim }]}>
                <Text allowFontScaling={false} style={[s.howNumText, { color: C.accentStrong }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[s.howText, { color: C.text }]}>{line}</Text>
            </Animated.View>
          ))}
        </GlassBox>
      </>
    );
  } else if (phase === "preview" && picked) {
    const counts = picked.counts;
    body = (
      <>
        <Animated.View entering={enter()}>
          <GlassBox role="card" style={[s.fileCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[s.fileIcon, { backgroundColor: C.accentDim }]}>
              <AppIcon family="Ionicons" name="document-text-outline" size={22} color={C.accent} />
            </View>
            <View style={s.fileBody}>
              <Text allowFontScaling={false} numberOfLines={1} style={[s.fileTitle, { color: C.text }]}>
                {exportedDate ? copy.backupFrom(exportedDate) : picked.fileName || "JSON"}
              </Text>
              <Text allowFontScaling={false} numberOfLines={1} style={[s.fileMeta, { color: C.muted }]}>
                {copy.backupMeta(picked.backup.appVersion, picked.backup.platform) || picked.fileName || ""}
              </Text>
            </View>
            <GlassTouchable accessibilityRole="button" accessibilityLabel={copy.changeFile} onPress={choose} hitSlop={8}>
              <AppIcon family="Ionicons" name="swap-horizontal" size={20} color={C.accentStrong} />
            </GlassTouchable>
          </GlassBox>
        </Animated.View>

        <SectionHead colors={C} label={copy.sectionPick.toLocaleUpperCase(locale)} />
        <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[s.pickHead, { borderBottomColor: C.borderMuted }]}>
            <Text allowFontScaling={false} style={[s.pickSummary, { color: C.text }]}>
              {copy.sectionsSelected(selected.length, rows.length)}
            </Text>
            <GlassTouchable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                tick();
                setExcluded(selected.length === rows.length ? rows.map((row) => row.id) : []);
              }}
            >
              <Text allowFontScaling={false} style={[s.pickAction, { color: C.accentStrong }]}>
                {selected.length === rows.length ? copy.selectNone : copy.selectAll}
              </Text>
            </GlassTouchable>
          </View>
          {rows.map((row, index) => (
            <SectionToggle
              key={row.id}
              C={C}
              index={index}
              icon={SECTION_META[row.id].icon}
              tone={SECTION_META[row.id].tone(C)}
              title={sectionTitle(copy, row.id, counts)}
              amount={row.amount}
              ratio={row.amount / largest}
              selected={selected.includes(row.id)}
              reduceMotion={reduceMotion}
              last={index === rows.length - 1}
              onToggle={() => {
                tick();
                setExcluded((list) => (list.includes(row.id) ? list.filter((x) => x !== row.id) : [...list, row.id]));
              }}
            />
          ))}
        </GlassBox>

        <Animated.View entering={enter(240)} style={s.notes}>
          {note("shield-checkmark-outline", C.green, copy.how[1], "merge")}
          {picked.invalid > 0 ? note("warning-outline", C.amber, copy.invalidNote(picked.invalid), "invalid") : null}
          {counts.replies > 0 && selected.includes("comments")
            ? note("return-down-forward-outline", C.muted, copy.repliesNote(counts.replies), "replies")
            : null}
        </Animated.View>

        <Animated.View entering={enter(300)}>
          {primary(copy.startButton, start, { icon: "cloud-download-outline", disabled: selected.length === 0 })}
        </Animated.View>
      </>
    );
  } else if (phase === "running") {
    const items = stages.order.map((id) => ({
      id,
      label: copy.stages[id],
      status: stages.done.includes(id) ? "done" : stages.current === id ? "active" : "pending",
      done: stages.progress[id]?.done || 0,
      total: stages.progress[id]?.total || 0,
    }));
    body = (
      <>
        {hero(copy.stages[stages.current] || copy.stages.matching, copy.keepOpen)}
        <StageList C={C} stages={items} reduceMotion={reduceMotion} progressText={copy.progress} />
        <Animated.View entering={enter(200)}>{secondary(copy.stop, stop, stopping ? "hourglass-outline" : "stop-circle-outline")}</Animated.View>
      </>
    );
  } else if (phase === "done" && summary) {
    const tiles = [
      { id: "titles", value: summary.titles, label: copy.sumTitles, color: C.accentStrong },
      { id: "watches", value: summary.watchEvents, label: copy.sumWatches },
      { id: "ratings", value: summary.ratings, label: copy.sumRatings },
      { id: "lists", value: summary.lists, label: copy.sumLists },
      { id: "comments", value: summary.comments, label: copy.sumComments },
    ].filter((tile, index) => index === 0 || tile.value > 0);
    const nothing = summary.titles + summary.watchEvents + summary.ratings + summary.lists + summary.comments === 0;
    body = (
      <>
        {hero(copy.doneTitle, nothing ? copy.doneNothing : null)}
        <PosterFan posters={summary.posters} theme={theme} reduceMotion={reduceMotion} />
        <SummaryTiles C={C} items={tiles} reduceMotion={reduceMotion} />
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(420).duration(320)} style={s.notes}>
          {summary.commentsKept > 0 ? note("checkmark-done-outline", C.green, copy.keptNote(summary.commentsKept), "kept") : null}
          {summary.preservedRatings > 0 ? note("star-half-outline", C.green, copy.preservedNote(summary.preservedRatings), "pres") : null}
          {summary.skippedRatings > 0 ? note("information-circle-outline", C.muted, copy.orphanRatingsNote(summary.skippedRatings), "orphan") : null}
          {summary.failed > 0 ? note("warning-outline", C.amber, copy.failedNote(summary.failed), "failed") : null}
        </Animated.View>
        <Animated.View entering={enter(480)}>{primary(copy.finish, () => navigation.goBack(), { icon: "checkmark" })}</Animated.View>
      </>
    );
  } else if (phase === "stopped") {
    const resumable = isResumableError(runError);
    body = (
      <>
        {hero(runErrorText(copy, runError), null)}
        {summary && summary.titles + summary.comments > 0 ? (
          <SummaryTiles
            C={C}
            reduceMotion={reduceMotion}
            items={[
              { id: "titles", value: summary.titles, label: copy.sumTitles, color: C.accentStrong },
              { id: "comments", value: summary.comments, label: copy.sumComments },
            ].filter((tile, index) => index === 0 || tile.value > 0)}
          />
        ) : null}
        {resumable ? <Animated.View entering={enter(120)}>{primary(copy.resume, run, { icon: "play" })}</Animated.View> : null}
        <Animated.View entering={enter(180)}>{secondary(copy.startOver, reset, "refresh")}</Animated.View>
      </>
    );
  }

  return <SettingsSubScreen title={copy.title}>{body}</SettingsSubScreen>;
}

const s = StyleSheet.create({
  hero: { alignItems: "center", gap: 8, paddingTop: 6, paddingBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: "900", textAlign: "center", letterSpacing: -0.2 },
  heroText: { fontSize: 13.5, lineHeight: 19, textAlign: "center", paddingHorizontal: 18 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 16, marginTop: 14 },
  primaryText: { fontSize: 15.5, fontWeight: "800" },
  secondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, borderWidth: 1, marginTop: 12 },
  secondaryText: { fontSize: 14.5, fontWeight: "700" },
  alert: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginTop: 6 },
  alertText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  howCard: { paddingVertical: 6 },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  howNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1 },
  howNumText: { fontSize: 12, fontWeight: "900" },
  howText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: "500" },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 6 },
  fileIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  fileBody: { flex: 1, gap: 2 },
  fileTitle: { fontSize: 15, fontWeight: "800" },
  fileMeta: { fontSize: 12, fontWeight: "600" },
  pickHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  pickSummary: { fontSize: 13, fontWeight: "700" },
  pickAction: { fontSize: 13, fontWeight: "800" },
  notes: { gap: 8, marginTop: 12 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "500" },
});

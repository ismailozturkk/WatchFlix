// components/import/ImportDataModal.js
//
// Letterboxd ZIP arşivlerini, klasörlerini ve IMDb/Letterboxd CSV verilerini
// tek dokunuşla otomatik tanıyan, ayrıştıran ve Seelogd listelerine aktaran modal.
//
// Adımlar: input → preview (içerik analizi + "İçeri aktar") → importing → success | interrupted.
// İşin kendisi services/import/importRunner'da (kaldığı yerden sürdürülebilir); bu
// dosya dosya seçimini, analizi ve adımlar arası geçişi yönetir. Aktarım sürerken sayfa
// kapatılamaz: kapatma girişimi satır içi "durdurulsun mu?" onayını açar.
// Giriş adımında kaynak bazında birikimli aktarım istatistiği ve "verileri sıfırla" durur.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import GlassCloseButton from "../common/GlassCloseButton";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../context/UserProfileContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { alpha } from "../../theme/colors";
import { intlLocaleOf, tmdbLanguageOf } from "../../utils/appLanguages";
import { parseLetterboxdZip } from "../../services/import/letterboxdBundleImporter";
import { buildBundleFromFiles, isBundleResult, parseImportText } from "../../services/import/importSources";
import { analyzeImport } from "../../services/import/importAnalysis";
import { createImportJob, createRetryJob, jobProgressSummary } from "../../services/import/importRunner";
import { loadImportStats } from "../../services/import/importStats";
import { resetImportedData } from "../../services/import/importReset";
import { triggerHaptic } from "../../services/hapticsService";
import ImportHelpModal from "./ImportHelpModal";
import ImportAnalysisView from "./ImportAnalysisView";
import ImportHistoryCard from "./ImportHistoryCard";
import ImportProgressView from "./ImportProgressView";
import ImportResultView from "./ImportResultView";
import useImportJob from "./useImportJob";
import { useLanguage } from "../../context/LanguageContext";
import { getImportCopy, importErrorText } from "./importCopy";
import { renderRich } from "./richText";
import { isCancelledImport } from "../../services/import/importErrors";
import Toast from "@components/AppToast";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.88;

// "Analiz ediliyor" durumu çizilebilsin diye ayrıştırmadan önce bir kare bekle.
const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 30));

const isZipAsset = (asset) =>
  Boolean(asset?.name?.toLowerCase().endsWith(".zip") || asset?.mimeType?.includes("zip"));

async function readText(uri) {
  try {
    if (FileSystem?.readAsStringAsync) return await FileSystem.readAsStringAsync(uri, { encoding: "utf8" });
  } catch {
    // fetch yoluna düş
  }
  const response = await fetch(uri);
  return response.text();
}

async function readBase64(uri) {
  if (FileSystem?.readAsStringAsync) {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 || "base64" });
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ImportDataModal({ visible, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getImportCopy(language);
  const locale = intlLocaleOf(language);
  const { user } = useAuth();
  const { displayName, username, avatarIndex, photoURL } = useUserProfile();
  const { refreshList } = useListStatusContext();
  const sheet = useSheetTransition(visible);
  const importJob = useImportJob();
  const jobRef = useRef(null);
  const scrollRef = useRef(null);
  const uid = user?.uid;

  const [step, setStep] = useState("input"); // input | preview | importing | success | interrupted
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState(null); // Bundle or Single result
  const [includeWatched, setIncludeWatched] = useState(true);
  const [includeWatchlist, setIncludeWatchlist] = useState(true);
  const [includeCustomLists, setIncludeCustomLists] = useState(true);
  const [singleTargetList, setSingleTargetList] = useState("watchedMovies");
  const [importResult, setImportResult] = useState(null);
  const [interruption, setInterruption] = useState(null); // { error, cancelled, summary }
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [readState, setReadState] = useState(null); // { label, done, total } — dosya okunurken
  const [historyStats, setHistoryStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resetState, setResetState] = useState(null); // { source, phase: "confirm"|"running", done, total }

  const isProcessingFile = readState != null;
  const analysis = useMemo(() => (parsedData ? analyzeImport(parsedData) : null), [parsedData]);

  const loadHistory = useCallback(async () => {
    if (!uid) return;
    setHistoryLoading(true);
    try {
      setHistoryStats(await loadImportStats(uid));
    } catch {
      // Çevrimdışı: kart son bilinen hâlini korur.
    } finally {
      setHistoryLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (visible) loadHistory();
  }, [visible, loadHistory]);

  // Kapanışta durumu sıfırla (sayfa kayarak çıkarken içerik değişmesin diye gecikmeli)
  const resetJob = importJob.reset;
  useEffect(() => {
    if (visible) return undefined;
    const timer = setTimeout(() => {
      setStep("input");
      setCsvText("");
      setParsedData(null);
      setIncludeWatched(true);
      setIncludeWatchlist(true);
      setIncludeCustomLists(true);
      setImportResult(null);
      setInterruption(null);
      setConfirmingStop(false);
      setReadState(null);
      setResetState(null);
      resetJob();
      jobRef.current = null;
    }, 300);
    return () => clearTimeout(timer);
  }, [visible, resetJob]);

  const scrollToTop = () => scrollRef.current?.scrollTo?.({ y: 0, animated: false });

  // Aktarım ya da sıfırlama sürerken sayfa kapanmaz: aktarımda durdurma onayı açılır.
  const requestClose = () => {
    if (step === "importing") {
      triggerHaptic("selection");
      setConfirmingStop(true);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 60);
      return;
    }
    if (resetState?.phase === "running") return;
    onClose();
  };

  const showParsed = (parsed) => {
    setParsedData(parsed);
    setIncludeWatched(true);
    setIncludeWatchlist(true);
    setIncludeCustomLists(true);
    if (!isBundleResult(parsed)) {
      setSingleTargetList(parsed.targetList || (parsed.type === "watchlist" ? "watchList" : "watchedMovies"));
    }
    setResetState(null);
    setStep("preview");
    scrollToTop();
    triggerHaptic("selection");
  };

  // Tekil CSV Metnini Ayrıştır
  const handleParseText = (text, sourceFileName = null) => {
    if (!text || !text.trim()) {
      Toast.show({ type: "error", text1: copy.pasteEmpty });
      return;
    }

    if (text.includes("\0")) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: copy.invalidFileTitle,
        text2: copy.invalidFileBody,
      });
      return;
    }

    try {
      showParsed(parseImportText(text, sourceFileName));
    } catch (e) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: copy.csvErrorTitle,
        text2: importErrorText(e, copy, copy.csvErrorFallback),
      });
    }
  };

  const handleParsePasted = async () => {
    setReadState({ label: copy.analysis.analyzing, done: 0, total: 0 });
    await yieldToUi();
    handleParseText(csvText, copy.pastedTextName);
    setReadState(null);
  };

  // Panodan Yapıştır
  const handlePasteFromClipboard = async () => {
    triggerHaptic("selection");
    const text = await Clipboard.getStringAsync();
    if (text && text.trim()) {
      setCsvText(text);
      handleParseText(text, copy.clipboardName);
    } else {
      Toast.show({ type: "info", text1: copy.clipboardEmpty });
    }
  };

  // Cihaz Dosyalarından ZIP veya CSV Seç (içerik tanıyan paket algılayıcı)
  const handlePickDocument = async () => {
    if (isProcessingFile) return;
    triggerHaptic("selection");
    let res;
    try {
      res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/zip",
          "application/x-zip-compressed",
          "multipart/x-zip",
          "text/csv",
          "text/comma-separated-values",
          "text/tab-separated-values",
          "text/plain",
          "*/*",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
    } catch (err) {
      Toast.show({ type: "error", text1: copy.loadFailedTitle, text2: copy.loadFailedFallback });
      return;
    }
    if (res.canceled || !res.assets || res.assets.length === 0) return;

    const assets = res.assets;
    const zip = assets.find(isZipAsset);
    try {
      // SENARYO 1: ZIP arşivi (yanında seçilen diğer dosyalar yok sayılır)
      if (zip) {
        setReadState({ label: copy.reading.zip, done: 0, total: 0 });
        const base64Content = await readBase64(zip.uri);
        const bundle = await parseLetterboxdZip(base64Content, {
          isBase64: true,
          onProgress: (done, total) => setReadState({ label: copy.reading.files(done, total), done, total }),
        });
        setReadState({ label: copy.analysis.analyzing, done: 1, total: 1 });
        await yieldToUi();
        showParsed(bundle);
        return;
      }

      // SENARYO 2: Birden fazla dosya (klasörden toplu seçim; Letterboxd + IMDb karışık olabilir)
      if (assets.length > 1) {
        const filesMap = {};
        for (let index = 0; index < assets.length; index += 1) {
          const file = assets[index];
          setReadState({ label: copy.reading.files(index, assets.length), done: index, total: assets.length });
          try {
            const content = await readText(file.uri);
            if (content) filesMap[file.name || `file-${index + 1}.csv`] = content;
          } catch {
            // okunamayan dosya "tanınmadı" sayılır
          }
        }
        setReadState({ label: copy.analysis.analyzing, done: assets.length, total: assets.length });
        await yieldToUi();
        showParsed(buildBundleFromFiles(filesMap));
        return;
      }

      // SENARYO 3: Tek bir CSV/metin dosyası
      const file = assets[0];
      setReadState({ label: copy.reading.files(0, 1), done: 0, total: 1 });
      const content = await readText(file.uri);
      if (!content || !content.trim()) {
        Toast.show({ type: "error", text1: copy.emptyFileTitle, text2: copy.emptyFileBody });
        return;
      }
      setReadState({ label: copy.analysis.analyzing, done: 1, total: 1 });
      await yieldToUi();
      handleParseText(content, file.name || copy.csvFileName);
    } catch (err) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: copy.loadFailedTitle,
        text2: importErrorText(err, copy, copy.loadFailedFallback),
      });
    } finally {
      setReadState(null);
    }
  };

  // İçe Aktarılacak Öğeleri Hazırla
  const getItemsToImport = () => {
    if (!parsedData) return [];

    // Paket ise (ZIP veya çoklu dosya)
    if (isBundleResult(parsedData)) {
      const items = [];
      if (includeWatched && parsedData.watchedItems) {
        items.push(...parsedData.watchedItems);
      }
      if (includeWatchlist && parsedData.watchlistItems) {
        items.push(...parsedData.watchlistItems);
      }
      return items;
    }

    // Tekil dosya ise (Single file)
    return (parsedData.items || []).map((it) => ({
      ...it,
      targetList: singleTargetList,
    }));
  };

  const getCustomItemsToImport = () => {
    if (!isBundleResult(parsedData) || !includeCustomLists) return [];
    return (parsedData.customLists || []).flatMap((list) =>
      (list.items || []).map((item) => ({ ...item, customListName: list.name })),
    );
  };

  /** İşi yürütür ve sonuca göre adımı seçer (başarı / kesinti / durdurma). */
  const startJob = async (job, { resume = false } = {}) => {
    jobRef.current = job;
    setConfirmingStop(false);
    setStep("importing");
    scrollToTop();
    const outcome = await importJob.run(job, { resume });
    if (outcome.stale) return;

    if (outcome.result) {
      // Liste önbellekleri ve profil sayaçları yeni kök özetle aynı anda görünür olsun.
      try {
        await refreshList("all");
      } catch {
        // Yenileme başarısız olsa da kayıtlar yazıldı; bir sonraki senkron getirir.
      }
      setImportResult(outcome.result);
      setStep("success");
      scrollToTop();
      triggerHaptic("notification");
      loadHistory();
      return;
    }

    const error = outcome.error;
    const summary = jobProgressSummary(job);
    // Hiçbir şey eşleşmediyse devam etmenin anlamı yok: analize dön.
    if (error?.code === "noTmdbMatch") {
      triggerHaptic("error");
      Toast.show({ type: "error", text1: copy.importFailedTitle, text2: importErrorText(error, copy) });
      setStep("preview");
      return;
    }
    const cancelled = isCancelledImport(error);
    setInterruption({ error, cancelled, summary });
    setStep("interrupted");
    scrollToTop();
    triggerHaptic(cancelled ? "selection" : "error");
    if (summary.saved > 0 || summary.lists > 0) {
      refreshList("all")?.catch?.(() => {});
      loadHistory();
    }
  };

  // İçe Aktarmayı Başlat
  const handleStartImport = () => {
    const items = getItemsToImport();
    const customItems = getCustomItemsToImport();
    if (items.length + customItems.length === 0 || !uid) {
      Toast.show({ type: "info", text1: copy.nothingToImport });
      return;
    }
    triggerHaptic("impact");
    startJob(createImportJob({
      uid,
      items,
      customItems,
      language: tmdbLanguageOf(language),
      userProfile: {
        displayName: displayName || user?.displayName,
        photoURL: photoURL || user?.photoURL,
        username: username || "",
        avatarIndex,
      },
    }));
  };

  const handleResume = () => {
    if (!jobRef.current) return;
    startJob(jobRef.current, { resume: true });
  };

  const handleRetryFailed = () => {
    if (!jobRef.current) return;
    startJob(createRetryJob(jobRef.current));
  };

  const handleConfirmReset = async (source) => {
    if (!uid) return;
    setResetState({ source, phase: "running", done: 0, total: 0 });
    try {
      const counts = await resetImportedData(uid, source, {
        onProgress: (done, total) => setResetState({ source, phase: "running", done, total }),
      });
      try {
        await refreshList("all");
      } catch {
        // kayıtlar silindi; liste bir sonraki senkronda güncellenir
      }
      const removed = counts.titles + counts.ratings + counts.reviews + counts.listItems;
      triggerHaptic("notification");
      Toast.show({
        type: "success",
        text1: copy.history.resetDone(copy.sources[source]),
        text2: [copy.history.resetDoneBody(removed), counts.keptReviews ? copy.history.resetKept(counts.keptReviews) : null]
          .filter(Boolean)
          .join(" "),
      });
    } catch {
      triggerHaptic("error");
      Toast.show({ type: "error", text1: copy.history.resetFailed });
    } finally {
      setResetState(null);
      loadHistory();
    }
  };

  const itemsToImport = getItemsToImport();
  const customItemsToImport = getCustomItemsToImport();
  const totalItemsToImport = itemsToImport.length + customItemsToImport.length;
  const accent = theme.accent || "#138DF0";
  const readPercent = readState?.total > 0 ? Math.round((readState.done / readState.total) * 100) : null;

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={styles.overlay} onLayout={sheet.onOverlayLayout}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={35} />
        </Animated.View>

        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={requestClose}
        />

        {/* fit: "CSV metnini yapıştır" kutusu klavyeyi açınca sayfa klavyenin
            üstünde kalan alana sığacak şekilde kısalır (içerik kendi içinde kayar). */}
        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[
            sheet.fit([
              styles.sheet,
              {
                backgroundColor: theme.primary,
                borderColor: theme.border,
              },
            ]),
            sheet.sheetStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconCircle, { backgroundColor: alpha(accent, 0.15) }]}>
                <AppIcon family="Ionicons" name="cloud-upload" size={20} color={accent} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                {copy.title}
              </Text>
            </View>

            <GlassCloseButton
              size={32}
              fallbackRadius={16}
              iconSize={20}
              color={theme.text.secondary}
              backgroundColor="rgba(255,255,255,0.06)"
              onPress={requestClose}
            />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Adım 1: ZIP / CSV seç, yapıştır + aktarım geçmişi */}
            {step === "input" && (
              <View style={styles.stepContainer}>
                <View style={styles.helpRow}>
                  <Text style={[styles.stepDesc, { color: theme.text.secondary }]}>
                    {copy.inputDesc}
                  </Text>
                  <GlassTouchable
                    onPress={() => setShowHelpModal(true)}
                    style={[styles.helpTrigger, { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.28) }]}
                  >
                    <AppIcon family="Ionicons" name="help-circle-outline" size={14} color={accent} />
                    <Text style={[styles.helpTriggerText, { color: accent }]}>{copy.howTo}</Text>
                  </GlassTouchable>
                </View>

                {/* Ana eylem: ZIP veya CSV seç */}
                <GlassTouchable
                  style={[styles.filePickBtn, { backgroundColor: accent }]}
                  onPress={handlePickDocument}
                  activeOpacity={0.85}
                  disabled={isProcessingFile}
                >
                  {isProcessingFile ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <AppIcon family="Ionicons" name="archive-outline" size={22} color="#FFF" />
                      <Text style={styles.filePickBtnText}>{copy.pickBtn}</Text>
                    </>
                  )}
                </GlassTouchable>

                {readState ? (
                  <View style={[styles.readingCard, { backgroundColor: alpha(accent, 0.08), borderColor: alpha(accent, 0.22) }]}>
                    <View style={styles.readingRow}>
                      <AppIcon family="Ionicons" name="document-text-outline" size={16} color={accent} />
                      <Text numberOfLines={1} style={[styles.readingText, { color: theme.text.primary }]}>{readState.label}</Text>
                      {readPercent != null ? (
                        <Text style={[styles.readingPercent, { color: accent }]}>{copy.percent(readPercent)}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.readingTrack, { backgroundColor: alpha(theme.text.muted || "#888", 0.18) }]}>
                      <View style={[styles.readingFill, { width: `${readPercent ?? 12}%`, backgroundColor: accent }]} />
                    </View>
                  </View>
                ) : null}

                {/* Paket bilgisi */}
                <View style={[styles.infoBanner, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5), borderColor: alpha(theme.border || "#444", 0.3) }]}>
                  <AppIcon family="Ionicons" name="sparkles-outline" size={16} color={accent} />
                  <Text style={[styles.infoBannerText, { color: theme.text.secondary }]}>
                    <Text style={{ fontWeight: "700", color: theme.text.primary }}>{copy.autoPackLead}</Text> {renderRich(copy.autoPackBody, { color: accent })}
                  </Text>
                </View>

                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: theme.border || "#333" }]} />
                  <Text style={[styles.orText, { color: theme.text.muted }]}>{copy.orPaste}</Text>
                  <View style={[styles.orLine, { backgroundColor: theme.border || "#333" }]} />
                </View>

                <GlassBox role="field" style={[styles.inputBox, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.4), borderColor: alpha(theme.border || "#444", 0.4) }]}>
                  <TextInput
                    style={[styles.textInput, { color: theme.text.primary }]}
                    placeholder={copy.pastePlaceholder}
                    placeholderTextColor={theme.text.muted}
                    multiline
                    numberOfLines={3}
                    value={csvText}
                    onChangeText={setCsvText}
                  />

                  <GlassTouchable
                    onPress={handlePasteFromClipboard}
                    style={[styles.pasteBtn, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.8) }]}
                  >
                    <AppIcon family="Ionicons" name="clipboard-outline" size={15} color={accent} />
                    <Text style={[styles.pasteBtnText, { color: accent }]}>
                      {copy.pasteBtn}
                    </Text>
                  </GlassTouchable>
                </GlassBox>

                {csvText.trim().length > 0 && (
                  <GlassTouchable
                    style={[styles.parseBtn, { backgroundColor: alpha(accent, 0.2), borderColor: accent }]}
                    onPress={handleParsePasted}
                    disabled={isProcessingFile}
                  >
                    <Text style={[styles.parseBtnText, { color: accent }]}>{copy.parseBtn}</Text>
                  </GlassTouchable>
                )}

                {uid ? (
                  <ImportHistoryCard
                    stats={historyStats}
                    loading={historyLoading}
                    copy={copy}
                    theme={theme}
                    locale={locale}
                    resetState={resetState}
                    onAskReset={(source) => {
                      triggerHaptic("selection");
                      setResetState({ source, phase: "confirm" });
                    }}
                    onCancelReset={() => setResetState(null)}
                    onConfirmReset={handleConfirmReset}
                  />
                ) : null}
              </View>
            )}

            {/* Adım 2: İçerik analizi + "İçeri aktar" */}
            {step === "preview" && parsedData && analysis && (
              <ImportAnalysisView
                parsed={parsedData}
                analysis={analysis}
                copy={copy}
                theme={theme}
                includeWatched={includeWatched}
                includeWatchlist={includeWatchlist}
                includeCustomLists={includeCustomLists}
                onToggleWatched={() => setIncludeWatched((value) => !value)}
                onToggleWatchlist={() => setIncludeWatchlist((value) => !value)}
                onToggleCustomLists={() => setIncludeCustomLists((value) => !value)}
                targetList={singleTargetList}
                onTargetChange={setSingleTargetList}
                importCount={totalItemsToImport}
                onBack={() => {
                  setStep("input");
                  scrollToTop();
                }}
                onImport={handleStartImport}
              />
            )}

            {/* Adım 3: Aktarım */}
            {step === "importing" && (
              <ImportProgressView
                progress={importJob.progress}
                copy={copy}
                theme={theme}
                cancelling={importJob.cancelling}
                confirmingStop={confirmingStop}
                onAskStop={() => {
                  triggerHaptic("selection");
                  setConfirmingStop(true);
                }}
                onDismissStop={() => setConfirmingStop(false)}
                onConfirmStop={() => {
                  setConfirmingStop(false);
                  importJob.cancel();
                }}
              />
            )}

            {/* Adım 4: Sonuç */}
            {step === "success" && (
              <ImportResultView
                variant="success"
                result={importResult}
                copy={copy}
                theme={theme}
                onDone={onClose}
                onRetryFailed={handleRetryFailed}
              />
            )}

            {step === "interrupted" && interruption && (
              <ImportResultView
                variant={interruption.cancelled ? "cancelled" : "interrupted"}
                error={interruption.error}
                summary={interruption.summary}
                progress={importJob.progress}
                copy={copy}
                theme={theme}
                onDone={onClose}
                onResume={handleResume}
              />
            )}
          </ScrollView>
        </Animated.View>
      </View>

      <ImportHelpModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <ModalToastHost visible={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: SHEET_MAX_H,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 10,
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  // Tam genişlikteki cam düğmeler basılınca kaydırma sınırında kesilmesin: yanlarda
  // GLASS_PRESS_ROOM (dolgu + sayfanın 20 pt yan boşluğuna taşan negatif dış boşluk).
  scrollArea: {
    marginTop: 8,
    marginHorizontal: -GLASS_PRESS_ROOM,
  },
  scrollContent: {
    paddingVertical: 10,
    paddingHorizontal: GLASS_PRESS_ROOM,
  },
  stepContainer: {
    paddingBottom: 10,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 8,
  },
  stepDesc: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  helpTrigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  helpTriggerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  filePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  filePickBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  readingCard: { borderRadius: 13, borderWidth: 1, padding: 11, gap: 8, marginTop: 10 },
  readingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  readingText: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  readingPercent: { fontSize: 12.5, fontWeight: "900" },
  readingTrack: { height: 5, borderRadius: 999, overflow: "hidden" },
  readingFill: { height: "100%", borderRadius: 999 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    marginHorizontal: 10,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 100,
    justifyContent: "space-between",
  },
  textInput: {
    fontSize: 13,
    textAlignVertical: "top",
    maxHeight: 90,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
    marginTop: 8,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  parseBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  parseBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

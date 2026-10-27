// components/import/ImportDataModal.js
//
// Letterboxd ZIP arşivlerini, klasörlerini ve IMDb/Letterboxd CSV verilerini
// tek dokunuşla otomatik tanıyan, ayrıştıran ve Seelogd listelerine aktaran modal.

import React, { useState, useEffect } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import GlassCloseButton from "../common/GlassCloseButton";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../context/UserProfileContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { alpha } from "../../theme/colors";
import { parseLetterboxdZip, parseLetterboxdBundle } from "../../services/import/letterboxdBundleImporter";
import { parseLetterboxdCsv, isLetterboxdCsv } from "../../services/import/letterboxdImporter";
import { parseImdbCsv, isImdbCsv } from "../../services/import/imdbImporter";
import { parseCsv } from "../../services/import/csvParser";
import { resolveBatchMedia } from "../../services/import/tmdbResolver";
import { writeImportedCustomLists, writeImportedItems } from "../../services/import/importWriter";
import { triggerHaptic } from "../../services/hapticsService";
import ImportHelpModal from "./ImportHelpModal";
import { useLanguage } from "../../context/LanguageContext";
import { getImportCopy, importErrorText } from "./importCopy";
import { renderRich } from "./richText";
import { ImportError } from "../../services/import/importErrors";
import Toast from "@components/AppToast";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { buildImportResultRows, getImportPhase } from "./importPresentation";
const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.88;

export default function ImportDataModal({ visible, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getImportCopy(language);
  const { user } = useAuth();
  const { displayName, username, avatarIndex, photoURL } = useUserProfile();
  const { refreshList } = useListStatusContext();
  const sheet = useSheetTransition(visible);

  const [step, setStep] = useState("input"); // "input" | "preview" | "importing" | "success"
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState(null); // Bundle or Single result
  const [includeWatched, setIncludeWatched] = useState(true);
  const [includeWatchlist, setIncludeWatchlist] = useState(true);
  const [includeCustomLists, setIncludeCustomLists] = useState(true);
  const [singleTargetList, setSingleTargetList] = useState("watchedMovies");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [importStats, setImportStats] = useState({
    success: true,
    count: 0,
    watchedCount: 0,
    watchlistCount: 0,
    ratingsCount: 0,
    reviewsCount: 0,
    favoritesCount: 0,
    preservedRatingsCount: 0,
    preservedReviewsCount: 0,
    unchangedCount: 0,
    customListsCount: 0,
    customListItemsCount: 0,
    unmatchedCount: 0,
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Kapanışta durumu sıfırla
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setStep("input");
        setCsvText("");
        setParsedData(null);
        setProgress(0);
        setProgressText("");
        setIncludeWatched(true);
        setIncludeWatchlist(true);
        setIncludeCustomLists(true);
        setIsProcessingFile(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

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
      const { headers } = parseCsv(text);

      if (!headers || headers.length === 0) {
        throw new ImportError("emptyHeaders");
      }

      let parsed = null;

      if (isLetterboxdCsv(headers)) {
        parsed = parseLetterboxdCsv(text, sourceFileName);
      } else if (isImdbCsv(headers)) {
        parsed = parseImdbCsv(text);
      } else {
        throw new ImportError("unrecognizedCsv");
      }

      if (!parsed.items || parsed.items.length === 0) {
        throw new ImportError("noItemsInFile");
      }

      setParsedData(parsed);
      setSingleTargetList(parsed.targetList || (parsed.type === "watchlist" ? "watchList" : "watchedMovies"));
      setStep("preview");
      triggerHaptic("selection");

      if (sourceFileName) {
        Toast.show({
          type: "success",
          text1: copy.loadedTitle(sourceFileName),
          text2: copy.loadedBody(parsed.items.length),
        });
      }
    } catch (e) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: copy.csvErrorTitle,
        text2: importErrorText(e, copy, copy.csvErrorFallback),
      });
    }
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

  // Cihaz Dosyalarından ZIP veya CSV Seç (Akıllı Paket Algılayıcı)
  const handlePickDocument = async () => {
    try {
      triggerHaptic("selection");
      const res = await DocumentPicker.getDocumentAsync({
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

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      setIsProcessingFile(true);

      const assets = res.assets;
      const isZip = assets.length === 1 && (
        assets[0].name?.toLowerCase().endsWith(".zip") ||
        assets[0].mimeType?.includes("zip")
      );

      // SENARYO 1: ZIP Dosyası Seçildi
      if (isZip) {
        const file = assets[0];
        let base64Content = "";

        try {
          if (FileSystem?.readAsStringAsync) {
            base64Content = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64 || "base64",
            });
          } else {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const reader = new FileReader();
            base64Content = await new Promise((resolve, reject) => {
              reader.onload = () => {
                const b64 = reader.result.split(",")[1];
                resolve(b64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          const bundle = await parseLetterboxdZip(base64Content, { isBase64: true });
          setParsedData(bundle);
          setStep("preview");
          triggerHaptic("selection");
          Toast.show({
            type: "success",
            text1: copy.bundleLoadedTitle,
            text2: copy.bundleLoadedBody(bundle.stats.totalUniqueItems, bundle.stats.ratingsCount),
          });
        } catch (zipErr) {
          throw zipErr instanceof ImportError ? zipErr : new ImportError("zipOpen", zipErr?.message);
        } finally {
          setIsProcessingFile(false);
        }
        return;
      }

      // SENARYO 2: Birden Fazla CSV Dosyası Seçildi (Klasörden toplu seçim)
      if (assets.length > 1) {
        const filesMap = {};
        for (const file of assets) {
          const fileName = file.name || "";
          let content = "";
          try {
            if (FileSystem?.readAsStringAsync) {
              content = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
            } else {
              const response = await fetch(file.uri);
              content = await response.text();
            }
            if (content) filesMap[fileName] = content;
          } catch (e) {
            // sessizce geç
          }
        }

        const bundle = parseLetterboxdBundle(filesMap);
        setParsedData(bundle);
        setStep("preview");
        triggerHaptic("selection");
        setIsProcessingFile(false);
        Toast.show({
          type: "success",
          text1: copy.filesMergedTitle,
          text2: copy.filesMergedBody(bundle.stats.totalUniqueItems),
        });
        return;
      }

      // SENARYO 3: Tek Bir CSV/Metin Dosyası Seçildi
      const file = assets[0];
      let content = "";
      try {
        if (FileSystem?.readAsStringAsync) {
          content = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
        } else {
          const response = await fetch(file.uri);
          content = await response.text();
        }
      } catch (readErr) {
        const response = await fetch(file.uri);
        content = await response.text();
      }

      setIsProcessingFile(false);

      if (content && content.trim()) {
        setCsvText(content);
        handleParseText(content, file.name || copy.csvFileName);
      } else {
        Toast.show({
          type: "error",
          text1: copy.emptyFileTitle,
          text2: copy.emptyFileBody,
        });
      }
    } catch (err) {
      setIsProcessingFile(false);
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: copy.loadFailedTitle,
        text2: importErrorText(err, copy, copy.loadFailedFallback),
      });
    }
  };

  // İçe Aktarılacak Öğeleri Hazırla
  const getItemsToImport = () => {
    if (!parsedData) return [];

    // Bundle paketi ise (ZIP veya çoklu dosya)
    if (parsedData.source === "letterboxd_bundle") {
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
    if (parsedData?.source !== "letterboxd_bundle" || !includeCustomLists) return [];
    return (parsedData.customLists || []).flatMap((list) =>
      (list.items || []).map((item) => ({ ...item, customListName: list.name })),
    );
  };

  // İçe Aktarmayı Başlat
  const handleStartImport = async () => {
    const itemsToImport = getItemsToImport();
    const customItemsToImport = getCustomItemsToImport();
    const allItemsToResolve = [...itemsToImport, ...customItemsToImport];
    if (!allItemsToResolve.length || !user?.uid) {
      Toast.show({ type: "info", text1: copy.nothingToImport });
      return;
    }

    setStep("importing");
    setProgress(0);
    setProgressText(copy.matching);

    try {
      // 1. TMDB Eşleme (Concurrency 5 ile paralel çözümleme)
      const resolvedItems = await resolveBatchMedia(allItemsToResolve, {
        onProgress: (current, total, currentItem) => {
          const ratio = (current / total) * 0.65;
          setProgress(ratio);
          setProgressText(copy.matchingProgress(current, total, currentItem));
        },
      });

      if (resolvedItems.length === 0) {
        throw new ImportError("noTmdbMatch");
      }

      // 2. Firestore'a Güvenli Batch Yazma (Lists + myRatings + myComments / MovieComment)
      setProgressText(copy.saving);
      const standardResolvedItems = resolvedItems.filter((item) => !item.customListName);
      const customResolvedItems = resolvedItems.filter((item) => item.customListName);
      const stats = await writeImportedItems(user.uid, standardResolvedItems, {
        userProfile: {
          displayName: displayName || user?.displayName,
          photoURL: photoURL || user?.photoURL,
          username: username || "",
          avatarIndex,
        },
        onProgress: (savedCount, total) => {
          const ratio = 0.65 + (savedCount / total) * 0.25;
          setProgress(ratio);
          setProgressText(copy.savingProgress(savedCount, total));
        },
      });

      const customGroups = [...customResolvedItems.reduce((groups, item) => {
        const current = groups.get(item.customListName) || [];
        current.push(item);
        groups.set(item.customListName, current);
        return groups;
      }, new Map()).entries()].map(([name, items]) => ({ name, items }));
      setProgress(0.94);
      setProgressText(copy.mergingLists);
      const customStats = await writeImportedCustomLists(user.uid, customGroups);
      const finalStats = {
        ...stats,
        ...customStats,
        count: stats.count + customResolvedItems.length,
        unmatchedCount: Math.max(0, allItemsToResolve.length - resolvedItems.length),
      };

      // Liste cache'leri ve profil sayaçları yeni kök özetle aynı anda görünür olsun.
      await refreshList("all");

      setProgress(1);
      setImportStats(finalStats);
      setStep("success");
      triggerHaptic("notification");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: copy.importFailedTitle,
        text2: copy.importFailedBody(e instanceof ImportError ? importErrorText(e, copy) : copy.unexpected),
      });
      setStep("preview");
    }
  };

  const isBundle = parsedData?.source === "letterboxd_bundle";
  const itemsToImport = getItemsToImport();
  const customItemsToImport = getCustomItemsToImport();
  const totalItemsToImport = itemsToImport.length + customItemsToImport.length;
  const progressPercent = Math.min(100, Math.round(progress * 100));
  const importPhase = getImportPhase(progress);
  const progressLines = String(progressText || "").split("\n");
  const resultRows = buildImportResultRows(importStats, copy);
  const resultTone = {
    accent: theme.accent || "#138DF0",
    gold: "#F5B942",
    safe: "#43D17B",
    muted: theme.text.secondary,
    blue: "#4CA7FF",
    rose: "#F05B7A",
    violet: "#A78BFA",
    warning: "#FF9F43",
  };

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={onClose}
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
          onPress={onClose}
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
              <View style={[styles.headerIconCircle, { backgroundColor: alpha(theme.accent || "#138DF0", 0.15) }]}>
                <AppIcon family="Ionicons" name="cloud-upload" size={20} color={theme.accent || "#138DF0"} />
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
              onPress={onClose}
            />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: Input / ZIP / CSV Select */}
            {step === "input" && (
              <View style={styles.stepContainer}>
                <View style={styles.helpRow}>
                  <Text style={[styles.stepDesc, { color: theme.text.secondary }]}>
                    {copy.inputDesc}
                  </Text>
                  <GlassTouchable
                    onPress={() => setShowHelpModal(true)}
                    style={[styles.helpTrigger, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.28) }]}
                  >
                    <AppIcon family="Ionicons" name="help-circle-outline" size={14} color={theme.accent} />
                    <Text style={[styles.helpTriggerText, { color: theme.accent }]}>{copy.howTo}</Text>
                  </GlassTouchable>
                </View>

                {/* Primary Action: Pick ZIP or CSV */}
                <GlassTouchable
                  style={[styles.filePickBtn, { backgroundColor: theme.accent || "#138DF0" }]}
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

                {/* Folder Info Hint */}
                <View style={[styles.infoBanner, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5), borderColor: alpha(theme.border || "#444", 0.3) }]}>
                  <AppIcon family="Ionicons" name="sparkles-outline" size={16} color={theme.accent} />
                  <Text style={[styles.infoBannerText, { color: theme.text.secondary }]}>
                    <Text style={{ fontWeight: "700", color: theme.text.primary }}>{copy.autoPackLead}</Text> {renderRich(copy.autoPackBody, { color: theme.accent })}
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
                    <AppIcon family="Ionicons" name="clipboard-outline" size={15} color={theme.accent || "#138DF0"} />
                    <Text style={[styles.pasteBtnText, { color: theme.accent || "#138DF0" }]}>
                      {copy.pasteBtn}
                    </Text>
                  </GlassTouchable>
                </GlassBox>

                {csvText.trim().length > 0 && (
                  <GlassTouchable
                    style={[styles.parseBtn, { backgroundColor: alpha(theme.accent, 0.2), borderColor: theme.accent }]}
                    onPress={() => handleParseText(csvText, copy.pastedTextName)}
                  >
                    <Text style={[styles.parseBtnText, { color: theme.accent }]}>{copy.parseBtn}</Text>
                  </GlassTouchable>
                )}
              </View>
            )}

            {/* Step 2: Preview & Category Selector */}
            {step === "preview" && parsedData && (
              <View style={styles.stepContainer}>
                {/* Bundle Mode Preview */}
                {isBundle ? (
                  <View style={[styles.previewCard, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5) }]}>
                    <View style={styles.previewHeader}>
                      <AppIcon family="Ionicons" name="file-tray-stacked" size={22} color={theme.accent} />
                      <Text style={[styles.previewSource, { color: theme.text.primary }]}>
                        {copy.bundleDetected}
                      </Text>
                    </View>

                    {parsedData.stats.listsCount > 0 && (
                      <GlassTouchable
                        style={[
                          styles.customListsToggle,
                          includeCustomLists && { borderColor: theme.accent, backgroundColor: alpha(theme.accent, 0.1) },
                        ]}
                        onPress={() => {
                          triggerHaptic("selection");
                          setIncludeCustomLists(!includeCustomLists);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.customListsToggleInfo}>
                          <AppIcon family="Ionicons" name="albums-outline" size={18} color={includeCustomLists ? theme.accent : theme.text.muted} />
                          <View>
                            <Text style={[styles.customListsToggleTitle, { color: theme.text.primary }]}>{copy.customLists}</Text>
                            <Text style={[styles.customListsToggleDesc, { color: theme.text.secondary }]}>
                              {copy.customListsMeta(parsedData.stats.listsCount, customItemsToImport.length)}
                            </Text>
                          </View>
                        </View>
                        <AppIcon family="Ionicons" name={includeCustomLists ? "checkbox" : "square-outline"} size={20} color={includeCustomLists ? theme.accent : theme.text.muted} />
                      </GlassTouchable>
                    )}

                    {/* Stats Grid */}
                    <View style={styles.bundleStatsGrid}>
                      {/* Watched Toggle Card */}
                      <GlassTouchable
                        style={[
                          styles.bundleStatCard,
                          includeWatched && { borderColor: theme.accent, backgroundColor: alpha(theme.accent, 0.1) },
                        ]}
                        onPress={() => {
                          triggerHaptic("selection");
                          setIncludeWatched(!includeWatched);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.bundleCardTop}>
                          <AppIcon family="Ionicons" name="film-outline" size={18} color={includeWatched ? theme.accent : theme.text.muted} />
                          <AppIcon
                            family="Ionicons"
                            name={includeWatched ? "checkbox" : "square-outline"}
                            size={18}
                            color={includeWatched ? theme.accent : theme.text.muted}
                          />
                        </View>
                        <Text style={[styles.bundleStatNum, { color: theme.text.primary }]}>
                          {parsedData.stats.watchedCount}
                        </Text>
                        <Text style={[styles.bundleStatLabel, { color: theme.text.secondary }]}>
                          {copy.watchedMovies}
                        </Text>
                      </GlassTouchable>

                      {/* Watchlist Toggle Card */}
                      <GlassTouchable
                        style={[
                          styles.bundleStatCard,
                          includeWatchlist && { borderColor: theme.accent, backgroundColor: alpha(theme.accent, 0.1) },
                        ]}
                        onPress={() => {
                          triggerHaptic("selection");
                          setIncludeWatchlist(!includeWatchlist);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.bundleCardTop}>
                          <AppIcon family="Ionicons" name="bookmark-outline" size={18} color={includeWatchlist ? theme.accent : theme.text.muted} />
                          <AppIcon
                            family="Ionicons"
                            name={includeWatchlist ? "checkbox" : "square-outline"}
                            size={18}
                            color={includeWatchlist ? theme.accent : theme.text.muted}
                          />
                        </View>
                        <Text style={[styles.bundleStatNum, { color: theme.text.primary }]}>
                          {parsedData.stats.watchlistCount}
                        </Text>
                        <Text style={[styles.bundleStatLabel, { color: theme.text.secondary }]}>
                          {copy.watchlist}
                        </Text>
                      </GlassTouchable>
                    </View>

                    {/* Extra Badges Row */}
                    <View style={styles.extraStatsRow}>
                      <View style={[styles.miniBadge, { backgroundColor: alpha("#FFD700", 0.15) }]}>
                        <Text style={[styles.miniBadgeText, { color: "#FFD700" }]}>
                          {copy.ratingsBadge(parsedData.stats.ratingsCount)}
                        </Text>
                      </View>
                      {parsedData.stats.reviewsCount > 0 && (
                        <View style={[styles.miniBadge, { backgroundColor: alpha(theme.accent, 0.15) }]}>
                          <Text style={[styles.miniBadgeText, { color: theme.accent }]}>
                            {copy.reviewsBadge(parsedData.stats.reviewsCount)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.sampleTitle, { color: theme.text.secondary, marginTop: 14 }]}>
                      {copy.sampleTitle}
                    </Text>
                    {parsedData.watchedItems.slice(0, 3).map((item, idx) => (
                      <View key={idx} style={styles.sampleItem}>
                        <Text style={[styles.sampleName, { color: theme.text.primary }]} numberOfLines={1}>
                          • {item.title} {item.year ? `(${item.year})` : ""}
                        </Text>
                        {item.rating && (
                          <Text style={[styles.sampleRating, { color: "#FFD700" }]}>⭐ {item.rating}/10</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  /* Single CSV Mode Preview */
                  <View style={[styles.previewCard, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5) }]}>
                    <View style={styles.previewHeader}>
                      <AppIcon
                        family="Ionicons"
                        name={parsedData.source === "letterboxd" ? "film" : "star"}
                        size={22}
                        color={theme.accent}
                      />
                      <Text style={[styles.previewSource, { color: theme.text.primary }]}>
                        {copy.fileDetected(parsedData.source === "letterboxd" ? "Letterboxd" : "IMDb")}
                      </Text>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: theme.text.primary }]}>
                          {parsedData.items?.length || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{copy.totalItems}</Text>
                      </View>
                    </View>

                    {(parsedData.items?.some((item) => item.rating) || parsedData.items?.some((item) => item.review)) && (
                      <View style={styles.extraStatsRow}>
                        {parsedData.items?.some((item) => item.rating) && (
                          <View style={[styles.miniBadge, { backgroundColor: alpha("#FFD700", 0.15) }]}>
                            <Text style={[styles.miniBadgeText, { color: "#FFD700" }]}>{copy.singleRatings(parsedData.items.filter((item) => item.rating).length)}</Text>
                          </View>
                        )}
                        {parsedData.items?.some((item) => item.review) && (
                          <View style={[styles.miniBadge, { backgroundColor: alpha(theme.accent, 0.15) }]}>
                            <Text style={[styles.miniBadgeText, { color: theme.accent }]}>{copy.reviewsBadge(parsedData.items.filter((item) => item.review).length)}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Target List Selector */}
                    <Text style={[styles.selectorTitle, { color: theme.text.secondary }]}>{copy.targetTitle}</Text>
                    <View style={styles.targetListSelector}>
                      {[
                        { key: "watchedMovies", label: copy.targetWatched, icon: "film-outline" },
                        { key: "watchList", label: copy.targetWatchlist, icon: "bookmark-outline" },
                        { key: "favorites", label: copy.targetFavorites, icon: "heart-outline" },
                      ].map((tgt) => (
                        <GlassTouchable
                          key={tgt.key}
                          style={[
                            styles.targetBtn,
                            singleTargetList === tgt.key && {
                              backgroundColor: theme.accent,
                              borderColor: theme.accent,
                            },
                          ]}
                          onPress={() => {
                            triggerHaptic("selection");
                            setSingleTargetList(tgt.key);
                          }}
                        >
                          <AppIcon
                            family="Ionicons"
                            name={tgt.icon}
                            size={14}
                            color={singleTargetList === tgt.key ? "#FFF" : theme.text.secondary}
                          />
                          <Text
                            style={[
                              styles.targetBtnText,
                              { color: singleTargetList === tgt.key ? "#FFF" : theme.text.secondary },
                            ]}
                          >
                            {tgt.label}
                          </Text>
                        </GlassTouchable>
                      ))}
                    </View>

                    <Text style={[styles.sampleTitle, { color: theme.text.secondary, marginTop: 14 }]}>
                      {copy.sampleTitle}
                    </Text>
                    {parsedData.items?.slice(0, 3).map((item, idx) => (
                      <View key={idx} style={styles.sampleItem}>
                        <Text style={[styles.sampleName, { color: theme.text.primary }]} numberOfLines={1}>
                          • {item.title} {item.year ? `(${item.year})` : ""}
                        </Text>
                        {item.rating && (
                          <Text style={[styles.sampleRating, { color: "#FFD700" }]}>⭐ {item.rating}/10</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionBtnRow}>
                  <GlassTouchable
                    style={[styles.backStepBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.8) }]}
                    onPress={() => setStep("input")}
                  >
                    <Text style={[styles.backStepText, { color: theme.text.primary }]}>{copy.back}</Text>
                  </GlassTouchable>

                  <GlassTouchable
                    style={[
                      styles.importBtn,
                      { backgroundColor: theme.accent || "#138DF0" },
                      totalItemsToImport === 0 && { opacity: 0.5 },
                    ]}
                    onPress={handleStartImport}
                    disabled={totalItemsToImport === 0}
                  >
                    <Text style={styles.importBtnText}>
                      {copy.start(totalItemsToImport)}
                    </Text>
                  </GlassTouchable>
                </View>
              </View>
            )}

            {/* Step 3: Progress */}
            {step === "importing" && (
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressHero,
                    { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.58), borderColor: alpha(theme.accent, 0.25) },
                  ]}
                >
                  <View style={styles.progressHeroTop}>
                    <View style={[styles.progressIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
                      <ActivityIndicator size="small" color={theme.accent || "#138DF0"} style={styles.progressSpinner} />
                      <AppIcon family="Ionicons" name="cloud-upload-outline" size={22} color={theme.accent || "#138DF0"} />
                    </View>
                    <View style={styles.progressCopy}>
                      <Text style={[styles.progressTitle, { color: theme.text.primary }]}>{copy.importingTitle}</Text>
                      <Text style={[styles.progressHint, { color: theme.text.secondary }]}>{copy.importingHint}</Text>
                    </View>
                    <Text allowFontScaling={false} style={[styles.progressPercentHero, { color: theme.accent || "#138DF0" }]}>
                      {copy.percent(progressPercent)}
                    </Text>
                  </View>

                  <View style={[styles.progressBarBg, { backgroundColor: alpha(theme.text.muted || "#888", 0.2) }]}>
                    <LinearGradient
                      colors={[theme.accent || "#138DF0", "#65D6FF"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                    />
                  </View>

                  <View style={styles.phaseRail}>
                    {[copy.stageMatching, copy.stageSaving, copy.stageLists].map((label, index) => {
                      const done = importPhase > index;
                      const active = importPhase === index;
                      return (
                        <View key={label} style={styles.phaseItem}>
                          <View
                            style={[
                              styles.phaseDot,
                              { backgroundColor: done || active ? theme.accent : alpha(theme.text.muted, 0.2) },
                              active && { borderColor: alpha(theme.accent, 0.25) },
                            ]}
                          >
                            <AppIcon
                              family="Ionicons"
                              name={done ? "checkmark" : active ? "ellipsis-horizontal" : "ellipse-outline"}
                              size={12}
                              color={done || active ? "#FFFFFF" : theme.text.muted}
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[styles.phaseLabel, { color: active ? theme.text.primary : theme.text.secondary }, active && styles.phaseLabelActive]}
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.currentWork, { backgroundColor: alpha(theme.accent, 0.08), borderColor: alpha(theme.accent, 0.2) }]}>
                  <AppIcon family="Ionicons" name="sparkles-outline" size={17} color={theme.accent} />
                  <View style={styles.currentWorkCopy}>
                    <Text style={[styles.progressText, { color: theme.text.primary }]}>{progressLines[0]}</Text>
                    {progressLines[1] ? (
                      <Text numberOfLines={2} style={[styles.progressItem, { color: theme.text.secondary }]}>
                        {progressLines.slice(1).join(" ")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
              <View style={styles.successContainer}>
                <View style={[styles.successHero, { backgroundColor: alpha("#43D17B", 0.09), borderColor: alpha("#43D17B", 0.26) }]}>
                  <View style={[styles.successIconCircle, { backgroundColor: alpha("#43D17B", 0.16) }]}>
                    <AppIcon family="Ionicons" name="checkmark" size={32} color="#43D17B" />
                  </View>
                  <Text style={[styles.successTitle, { color: theme.text.primary }]}>
                    {copy.successTitle}
                  </Text>
                  <Text style={[styles.successDesc, { color: theme.text.secondary }]}>
                    {renderRich(copy.successTotal(importStats.count), { fontWeight: "900", color: "#43D17B" })}
                  </Text>
                </View>

                {resultRows.length > 0 ? (
                  <View style={styles.resultsSection}>
                    <Text style={[styles.resultsTitle, { color: theme.text.secondary }]}>{copy.resultDetails}</Text>
                    <View style={[styles.resultsCard, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.52), borderColor: alpha(theme.border, 0.7) }]}>
                      {resultRows.map((row, index) => {
                        const tone = resultTone[row.tone];
                        return (
                          <View key={row.key}>
                            <View style={styles.resultRow}>
                              <View style={[styles.resultIcon, { backgroundColor: alpha(tone, 0.13) }]}>
                                <AppIcon family="Ionicons" name={row.icon} size={16} color={tone} />
                              </View>
                              <Text style={[styles.resultText, { color: row.tone === "warning" ? tone : theme.text.primary }]}>{row.text}</Text>
                            </View>
                            {index < resultRows.length - 1 ? <View style={[styles.resultDivider, { backgroundColor: alpha(theme.border, 0.65) }]} /> : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <GlassTouchable
                  style={[styles.doneBtn, { backgroundColor: theme.accent || "#138DF0" }]}
                  onPress={onClose}
                >
                  <Text style={styles.doneBtnText}>{copy.done}</Text>
                </GlassTouchable>
              </View>
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
  previewCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  previewSource: {
    fontSize: 15,
    fontWeight: "800",
  },
  bundleStatsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  bundleStatCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  bundleCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bundleStatNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  bundleStatLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  customListsToggle: {
    minHeight: 62,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  customListsToggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customListsToggleTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  customListsToggleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  extraStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  miniBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  miniBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  statNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  targetListSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  targetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  targetBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sampleTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  sampleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  sampleName: {
    fontSize: 13,
    flex: 1,
  },
  sampleRating: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  backStepBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backStepText: {
    fontSize: 14,
    fontWeight: "700",
  },
  importBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  importBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  progressContainer: {
    paddingVertical: 12,
    gap: 12,
  },
  progressHero: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 15 },
  progressHeroTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  progressIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  progressSpinner: { position: "absolute", opacity: 0.28, transform: [{ scale: 1.55 }] },
  progressCopy: { flex: 1, minWidth: 0, gap: 2 },
  progressTitle: { fontSize: 16, lineHeight: 20, fontWeight: "900" },
  progressHint: { fontSize: 11.5, lineHeight: 16 },
  progressPercentHero: { fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.8 },
  progressText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  progressItem: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  progressBarBg: {
    width: "100%",
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  phaseRail: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  phaseItem: { flex: 1, alignItems: "center", gap: 5 },
  phaseDot: { width: 23, height: 23, borderRadius: 12, borderWidth: 4, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  phaseLabel: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", textAlign: "center" },
  phaseLabelActive: { fontWeight: "900" },
  currentWork: { minHeight: 58, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  currentWorkCopy: { flex: 1, minWidth: 0 },
  successContainer: {
    paddingVertical: 10,
    gap: 14,
  },
  successHero: { alignItems: "center", borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 18 },
  successIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  resultsSection: { gap: 7 },
  resultsTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", paddingHorizontal: 2 },
  resultsCard: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 12 },
  resultRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  resultIcon: { width: 31, height: 31, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  resultText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "600" },
  resultDivider: { height: StyleSheet.hairlineWidth, marginLeft: 41 },
  doneBtn: {
    minHeight: 48,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  doneBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
});

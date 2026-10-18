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
import Toast from "@components/AppToast";

import ModalToastHost from "@components/toast/ModalToastHost";
const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.88;

export default function ImportDataModal({ visible, onClose }) {
  const { theme } = useTheme();
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
      Toast.show({ type: "error", text1: "Lütfen geçerli bir CSV verisi girin." });
      return;
    }

    if (text.includes("\0")) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: "Geçersiz Dosya Formatı",
        text2: "Seçilen dosya metin tabanlı bir CSV dosyası değil.",
      });
      return;
    }

    try {
      const { headers } = parseCsv(text);

      if (!headers || headers.length === 0) {
        throw new Error("Dosya boş veya sütun başlıkları okunamadı.");
      }

      let parsed = null;

      if (isLetterboxdCsv(headers)) {
        parsed = parseLetterboxdCsv(text, sourceFileName);
      } else if (isImdbCsv(headers)) {
        parsed = parseImdbCsv(text);
      } else {
        throw new Error(
          "Uyumsuz CSV formatı! Bu dosya Letterboxd veya IMDb dışa aktarımına ait görünmüyor. Lütfen Letterboxd ZIP dosyasını veya doğru CSV'yi seçin."
        );
      }

      if (!parsed.items || parsed.items.length === 0) {
        throw new Error("Dosya içinde aktarılabilecek film veya dizi kaydı bulunamadı.");
      }

      setParsedData(parsed);
      setSingleTargetList(parsed.targetList || (parsed.type === "watchlist" ? "watchList" : "watchedMovies"));
      setStep("preview");
      triggerHaptic("selection");

      if (sourceFileName) {
        Toast.show({
          type: "success",
          text1: `${sourceFileName} Yüklendi`,
          text2: `${parsed.items.length} içerik başarıyla ayrıştırıldı.`,
        });
      }
    } catch (e) {
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: "CSV Doğrulama Hatası",
        text2: e.message || "Lütfen dosya formatını kontrol edin.",
      });
    }
  };

  // Panodan Yapıştır
  const handlePasteFromClipboard = async () => {
    triggerHaptic("selection");
    const text = await Clipboard.getStringAsync();
    if (text && text.trim()) {
      setCsvText(text);
      handleParseText(text, "Pano İçeriği");
    } else {
      Toast.show({ type: "info", text1: "Panoda yapıştırılacak metin bulunamadı." });
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
            text1: "Letterboxd Paketi Yüklendi",
            text2: `${bundle.stats.totalUniqueItems} içerik ve ${bundle.stats.ratingsCount} puan tespit edildi.`,
          });
        } catch (zipErr) {
          throw new Error(`ZIP açılırken hata: ${zipErr.message}`);
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
          text1: "Letterboxd Dosyaları Birleştirildi",
          text2: `${bundle.stats.totalUniqueItems} içerik hazırlandı.`,
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
        handleParseText(content, file.name || "CSV Dosyası");
      } else {
        Toast.show({
          type: "error",
          text1: "Dosya Boş",
          text2: "Seçilen dosyanın içi boş görünüyor.",
        });
      }
    } catch (err) {
      setIsProcessingFile(false);
      triggerHaptic("error");
      Toast.show({
        type: "error",
        text1: "İçerik Yüklenemedi",
        text2: err.message || "Lütfen geçerli bir ZIP veya CSV dosyası seçin.",
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
      Toast.show({ type: "info", text1: "Aktarılacak içerik bulunamadı." });
      return;
    }

    setStep("importing");
    setProgress(0);
    setProgressText("İçerikler TMDB ile eşleştiriliyor...");

    try {
      // 1. TMDB Eşleme (Concurrency 5 ile paralel çözümleme)
      const resolvedItems = await resolveBatchMedia(allItemsToResolve, {
        onProgress: (current, total, currentItem) => {
          const ratio = (current / total) * 0.65;
          setProgress(ratio);
          setProgressText(`Eşleştiriliyor: ${current} / ${total}\n${currentItem}`);
        },
      });

      if (resolvedItems.length === 0) {
        throw new Error("TMDB veritabanında eşleşen film bulunamadı.");
      }

      // 2. Firestore'a Güvenli Batch Yazma (Lists + myRatings + myComments / MovieComment)
      setProgressText("Seelogd listelerinize, puanlarınıza ve incelemelerinize kaydediliyor...");
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
          setProgressText(`Kaydediliyor: ${savedCount} / ${total}`);
        },
      });

      const customGroups = [...customResolvedItems.reduce((groups, item) => {
        const current = groups.get(item.customListName) || [];
        current.push(item);
        groups.set(item.customListName, current);
        return groups;
      }, new Map()).entries()].map(([name, items]) => ({ name, items }));
      setProgress(0.94);
      setProgressText("Özel Letterboxd listeleri birleştiriliyor...");
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
        text1: "İçe aktarma sırasında hata oluştu",
        text2: `${e.message || "Beklenmeyen bir hata oluştu."} Tamamlanan kayıtlar korunur; güvenle yeniden deneyebilirsiniz.`,
      });
      setStep("preview");
    }
  };

  const isBundle = parsedData?.source === "letterboxd_bundle";
  const itemsToImport = getItemsToImport();
  const customItemsToImport = getCustomItemsToImport();
  const totalItemsToImport = itemsToImport.length + customItemsToImport.length;

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
                Letterboxd / IMDb Aktar
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
                    İndirilen ZIP dosyasını veya CSV'leri seçin. İzlenenler, puanlar, incelemeler ve izleme listesi mevcut kayıtlar korunarak birleştirilir.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowHelpModal(true)}
                    style={[styles.helpTrigger, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.28) }]}
                  >
                    <AppIcon family="Ionicons" name="help-circle-outline" size={14} color={theme.accent} />
                    <Text style={[styles.helpTriggerText, { color: theme.accent }]}>Nasıl Alınır?</Text>
                  </TouchableOpacity>
                </View>

                {/* Primary Action: Pick ZIP or CSV */}
                <TouchableOpacity
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
                      <Text style={styles.filePickBtnText}>Letterboxd ZIP veya CSV Seç</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Folder Info Hint */}
                <View style={[styles.infoBanner, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5), borderColor: alpha(theme.border || "#444", 0.3) }]}>
                  <AppIcon family="Ionicons" name="sparkles-outline" size={16} color={theme.accent} />
                  <Text style={[styles.infoBannerText, { color: theme.text.secondary }]}>
                    <Text style={{ fontWeight: "700", color: theme.text.primary }}>Otomatik Paket Çözücü:</Text> Zip arşivi içindeki <Text style={{ color: theme.accent }}>watched.csv</Text>, <Text style={{ color: theme.accent }}>diary.csv</Text>, <Text style={{ color: theme.accent }}>ratings.csv</Text> ve <Text style={{ color: theme.accent }}>watchlist.csv</Text> otomatik taranır.
                  </Text>
                </View>

                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: theme.border || "#333" }]} />
                  <Text style={[styles.orText, { color: theme.text.muted }]}>VEYA METİN OLARAK YAPIŞTIR</Text>
                  <View style={[styles.orLine, { backgroundColor: theme.border || "#333" }]} />
                </View>

                <View style={[styles.inputBox, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.4), borderColor: alpha(theme.border || "#444", 0.4) }]}>
                  <TextInput
                    style={[styles.textInput, { color: theme.text.primary }]}
                    placeholder="CSV metnini buraya yapıştırın..."
                    placeholderTextColor={theme.text.muted}
                    multiline
                    numberOfLines={3}
                    value={csvText}
                    onChangeText={setCsvText}
                  />

                  <TouchableOpacity
                    onPress={handlePasteFromClipboard}
                    style={[styles.pasteBtn, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.8) }]}
                  >
                    <AppIcon family="Ionicons" name="clipboard-outline" size={15} color={theme.accent || "#138DF0"} />
                    <Text style={[styles.pasteBtnText, { color: theme.accent || "#138DF0" }]}>
                      Panodan Yapıştır
                    </Text>
                  </TouchableOpacity>
                </View>

                {csvText.trim().length > 0 && (
                  <TouchableOpacity
                    style={[styles.parseBtn, { backgroundColor: alpha(theme.accent, 0.2), borderColor: theme.accent }]}
                    onPress={() => handleParseText(csvText, "Yapıştırılan Metin")}
                  >
                    <Text style={[styles.parseBtnText, { color: theme.accent }]}>Verileri Ayrıştır & Önizle</Text>
                  </TouchableOpacity>
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
                        Letterboxd Paketi Tespit Edildi
                      </Text>
                    </View>

                    {parsedData.stats.listsCount > 0 && (
                      <TouchableOpacity
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
                            <Text style={[styles.customListsToggleTitle, { color: theme.text.primary }]}>Özel Letterboxd Listeleri</Text>
                            <Text style={[styles.customListsToggleDesc, { color: theme.text.secondary }]}>
                              {parsedData.stats.listsCount} liste · {customItemsToImport.length} içerik
                            </Text>
                          </View>
                        </View>
                        <AppIcon family="Ionicons" name={includeCustomLists ? "checkbox" : "square-outline"} size={20} color={includeCustomLists ? theme.accent : theme.text.muted} />
                      </TouchableOpacity>
                    )}

                    {/* Stats Grid */}
                    <View style={styles.bundleStatsGrid}>
                      {/* Watched Toggle Card */}
                      <TouchableOpacity
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
                          İzlenen Filmler
                        </Text>
                      </TouchableOpacity>

                      {/* Watchlist Toggle Card */}
                      <TouchableOpacity
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
                          İzleme Listesi
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Extra Badges Row */}
                    <View style={styles.extraStatsRow}>
                      <View style={[styles.miniBadge, { backgroundColor: alpha("#FFD700", 0.15) }]}>
                        <Text style={[styles.miniBadgeText, { color: "#FFD700" }]}>
                          ⭐ {parsedData.stats.ratingsCount} Film Puanı
                        </Text>
                      </View>
                      {parsedData.stats.reviewsCount > 0 && (
                        <View style={[styles.miniBadge, { backgroundColor: alpha(theme.accent, 0.15) }]}>
                          <Text style={[styles.miniBadgeText, { color: theme.accent }]}>
                            ✍️ {parsedData.stats.reviewsCount} İnceleme
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.sampleTitle, { color: theme.text.secondary, marginTop: 14 }]}>
                      Örnek İçerikler:
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
                        {parsedData.source === "letterboxd" ? "Letterboxd" : "IMDb"} Dosyası Tespit Edildi
                      </Text>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: theme.text.primary }]}>
                          {parsedData.items?.length || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Toplam İçerik</Text>
                      </View>
                    </View>

                    {(parsedData.items?.some((item) => item.rating) || parsedData.items?.some((item) => item.review)) && (
                      <View style={styles.extraStatsRow}>
                        {parsedData.items?.some((item) => item.rating) && (
                          <View style={[styles.miniBadge, { backgroundColor: alpha("#FFD700", 0.15) }]}>
                            <Text style={[styles.miniBadgeText, { color: "#FFD700" }]}>⭐ {parsedData.items.filter((item) => item.rating).length} Puan</Text>
                          </View>
                        )}
                        {parsedData.items?.some((item) => item.review) && (
                          <View style={[styles.miniBadge, { backgroundColor: alpha(theme.accent, 0.15) }]}>
                            <Text style={[styles.miniBadgeText, { color: theme.accent }]}>✍️ {parsedData.items.filter((item) => item.review).length} İnceleme</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Target List Selector */}
                    <Text style={[styles.selectorTitle, { color: theme.text.secondary }]}>Hedef Liste Seçin:</Text>
                    <View style={styles.targetListSelector}>
                      {[
                        { key: "watchedMovies", label: "İzlenenler", icon: "film-outline" },
                        { key: "watchList", label: "İzleme Listesi", icon: "bookmark-outline" },
                        { key: "favorites", label: "Favoriler", icon: "heart-outline" },
                      ].map((tgt) => (
                        <TouchableOpacity
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
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.sampleTitle, { color: theme.text.secondary, marginTop: 14 }]}>
                      Örnek İçerikler:
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
                  <TouchableOpacity
                    style={[styles.backStepBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.8) }]}
                    onPress={() => setStep("input")}
                  >
                    <Text style={[styles.backStepText, { color: theme.text.primary }]}>Geri Dön</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.importBtn,
                      { backgroundColor: theme.accent || "#138DF0" },
                      totalItemsToImport === 0 && { opacity: 0.5 },
                    ]}
                    onPress={handleStartImport}
                    disabled={totalItemsToImport === 0}
                  >
                    <Text style={styles.importBtnText}>
                      Aktarımı Başlat ({totalItemsToImport})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Progress */}
            {step === "importing" && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={theme.accent || "#138DF0"} style={{ marginBottom: 16 }} />
                <Text style={[styles.progressText, { color: theme.text.primary }]}>{progressText}</Text>

                <View style={[styles.progressBarBg, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.8) }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.round(progress * 100))}%`,
                        backgroundColor: theme.accent || "#138DF0",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressPercent, { color: theme.text.secondary }]}>
                  %{Math.min(100, Math.round(progress * 100))}
                </Text>
              </View>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
              <View style={styles.successContainer}>
                <View style={[styles.successIconCircle, { backgroundColor: alpha("#64FF64", 0.16) }]}>
                  <AppIcon family="Ionicons" name="checkmark-circle" size={48} color="#64FF64" />
                </View>
                <Text style={[styles.successTitle, { color: theme.text.primary }]}>
                  Aktarım Başarıyla Tamamlandı!
                </Text>
                <Text style={[styles.successDesc, { color: theme.text.secondary }]}>
                  Toplam <Text style={{ fontWeight: "800", color: theme.text.primary }}>{importStats.count}</Text> içerik güvenle işlendi.
                  {importStats.addedWatchEventsCount > 0 && `\n🎬 ${importStats.addedWatchEventsCount} eksik izleme kaydı eklendi.`}
                  {importStats.ratingsCount > 0 && `\n⭐ ${importStats.ratingsCount} eksik puan profilinize işlendi.`}
                  {importStats.reviewsCount > 0 && `\n✍️ ${importStats.reviewsCount} eksik inceleme yorumlarınıza aktarıldı.`}
                  {(importStats.preservedRatingsCount > 0 || importStats.preservedReviewsCount > 0) && `\n🛡️ Mevcut puan ve yorumlarınız değiştirilmedi.`}
                  {importStats.unchangedCount > 0 && `\n✓ ${importStats.unchangedCount} içerik zaten günceldi.`}
                  {importStats.watchlistCount > 0 && `\n📌 ${importStats.watchlistCount} izleme listesi kaydı kontrol edildi.`}
                  {importStats.favoritesCount > 0 && `\n❤️ ${importStats.favoritesCount} favori kaydı kontrol edildi.`}
                  {importStats.customListsCount > 0 && `\n📚 ${importStats.customListsCount} özel liste, ${importStats.customListItemsCount} yeni içerikle birleştirildi.`}
                  {importStats.unmatchedCount > 0 && `\n⚠️ ${importStats.unmatchedCount} içerik TMDB ile eşleşmediği için atlandı.`}
                </Text>

                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: theme.accent || "#138DF0" }]}
                  onPress={onClose}
                >
                  <Text style={styles.doneBtnText}>Tamam</Text>
                </TouchableOpacity>
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
  scrollArea: {
    marginTop: 8,
  },
  scrollContent: {
    paddingVertical: 10,
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
    alignItems: "center",
    paddingVertical: 28,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 18,
  },
  progressBarBg: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressPercent: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
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
    marginBottom: 20,
  },
  doneBtn: {
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 14,
  },
  doneBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
});

// screens/tabs/UsageDebugScreen.js
//
// Geliştirici ve Test Modu Tüketim & Maliyet İzleme Ekranı.
// Firebase Firestore (Bölgesel / Modül Ayrımı), Cloud Functions, Gemini AI token (Giriş / Çıkış),
// TMDB API kotaları, Realtime Database, Hosting, Storage, Auth ve diğer tüm servis maliyetlerini izler.

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { useTheme } from "../../context/ThemeContext";
import AppIcon from "../../components/AppIcon";
import ScreenDecor from "../../components/ScreenDecor";
import { toast } from "../../components/AppToast";
import * as Haptics from "../../services/hapticsService";
import ModalBlurBackdrop from "../../components/common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import {
  presentNow,
  CHANNELS,
  ensureAndroidChannels,
  getPermissionInfo,
  requestNotificationPermission,
} from "../../services/pushNotificationsService";
import {
  getUsageStats,
  subscribeToUsage,
  resetUsageStats,
  calculateCostSummary,
  generateMarkdownReport,
  getDailyAnalytics,
  getTodayKey,
  exportUsageBackup,
  validateUsageBackup,
  importUsageBackup,
  FIREBASE_LIMITS,
  GEMINI_MODELS,
  ALL_ECOSYSTEM_SERVICES,
  ZONES,
  PRICING,
} from "../../services/usageTrackerService";

const TABS = [
  { id: "overview", label: "Genel Bakış", icon: "pie-chart" },
  { id: "notifications_test", label: "Bildirim Testleri", icon: "notifications" },
  { id: "daily", label: "Günlük Grafikler", icon: "bar-chart" },
  { id: "zones", label: "Bölgesel Dağılım", icon: "grid" },
  { id: "gemini", label: "Gemini AI (Giriş/Çıkış)", icon: "sparkles" },
  { id: "tmdb", label: "TMDB API", icon: "film" },
  { id: "firestore", label: "Firestore", icon: "server" },
  { id: "ecosystem", label: "Tüm Servisler", icon: "wallet" },
  { id: "logs", label: "Canlı Log", icon: "list" },
  { id: "simulator", label: "Projeksiyon", icon: "calculator" },
];

export default function UsageDebugScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(() => getUsageStats());
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [subFeeInput, setSubFeeInput] = useState("59");
  const [usdRateInput, setUsdRateInput] = useState("50");
  const [taxPercentInput, setTaxPercentInput] = useState("15");
  const [selectedDayKey, setSelectedDayKey] = useState(() => getTodayKey());
  const [simBasisMode, setSimBasisMode] = useState("session"); // "session" | "monthly" | "net"
  const [expandedLogGroups, setExpandedLogGroups] = useState({
    gemini: true,
    lists: true,
    social: true,
  });
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const backupSheet = useSheetTransition(backupModalVisible);
  const [manualJsonText, setManualJsonText] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Canlı abonelik ve saniyelik zamanlayıcı
  useEffect(() => {
    const unsub = subscribeToUsage((newStats) => {
      setStats({ ...newStats });
    });

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const costs = useMemo(() => {
    if (!stats) return null;
    const rate = parseFloat(usdRateInput) || PRICING.usdToTryRate || 50;
    return calculateCostSummary(stats, rate);
  }, [stats, usdRateInput]);

  // Günlük Analitik Verileri ve Seçili Gün
  const dailyList = useMemo(() => {
    return getDailyAnalytics(stats);
  }, [stats]);

  const selectedDay = useMemo(() => {
    if (!dailyList || dailyList.length === 0) return null;
    const found = dailyList.find((d) => d.dateKey === selectedDayKey);
    return found || dailyList[0];
  }, [dailyList, selectedDayKey]);

  // Gruplanmış Loglar (Her alan kendi rengi ve toplamlarıyla)
  const groupedLogs = useMemo(() => {
    const groups = {
      gemini: {
        id: "gemini",
        name: "Gemini AI Asistanı",
        icon: "sparkles",
        color: "#C25AFF",
        logs: [],
        totalCostUsd: 0,
        totalTokens: 0,
        requests: 0,
      },
      lists: {
        id: "lists",
        name: "Listeler & İzleme Geçmişi",
        icon: "list",
        color: "#29B864",
        logs: [],
        reads: 0,
        writes: 0,
        deletes: 0,
      },
      social: {
        id: "social",
        name: "Sosyal & Paylaşımlar",
        icon: "chatbubbles",
        color: "#E91E63",
        logs: [],
        reads: 0,
        writes: 0,
        deletes: 0,
      },
      chat: {
        id: "chat",
        name: "Mesajlaşma & Sohbet",
        icon: "paper-plane",
        color: "#00BCD4",
        logs: [],
        reads: 0,
        writes: 0,
        deletes: 0,
      },
      profile: {
        id: "profile",
        name: "Profil & Arkadaşlar",
        icon: "people",
        color: "#9C27B0",
        logs: [],
        reads: 0,
        writes: 0,
        deletes: 0,
      },
      tmdb: {
        id: "tmdb",
        name: "TMDB Medya Keşfi",
        icon: "film",
        color: "#FF9800",
        logs: [],
        totalRequests: 0,
      },
      games: {
        id: "games",
        name: "CineSwipe & Oyunlar",
        icon: "game-controller",
        color: "#FF5722",
        logs: [],
        reads: 0,
        writes: 0,
      },
      notifications: {
        id: "notifications",
        name: "Bildirimler & Functions",
        icon: "notifications",
        color: "#3F51B5",
        logs: [],
        calls: 0,
      },
      other: {
        id: "other",
        name: "Diğer Sistem İşlemleri",
        icon: "ellipsis-horizontal-circle",
        color: "#607D8B",
        logs: [],
      },
    };

    (stats.recentLogs || []).forEach((log) => {
      let zid = log.zoneId;
      if (!zid || !groups[zid]) {
        if (log.type === "gemini_ai") zid = "gemini";
        else if (log.type === "tmdb_request") zid = "tmdb";
        else if (log.type === "function_call") zid = "notifications";
        else if (log.type === "rtdb_event") zid = "chat";
        else zid = "other";
      }
      const g = groups[zid] || groups.other;
      g.logs.push(log);
      g.totalOps = (g.totalOps || 0) + 1;

      let docCount = typeof log.docCount === "number" ? log.docCount : 1;
      if (docCount === 1 && typeof log.detail === "string" && log.detail.startsWith("+")) {
        const parsed = parseInt(log.detail.slice(1), 10);
        if (!isNaN(parsed) && parsed > 0) docCount = parsed;
      }

      if (log.type === "gemini_ai") {
        g.requests = (g.requests || 0) + 1;
        g.totalCostUsd = (g.totalCostUsd || 0) + (log.cost || 0);
      } else if (log.type === "firestore_read") {
        g.reads = (g.reads || 0) + docCount;
        g.readOps = (g.readOps || 0) + 1;
      } else if (log.type === "firestore_write") {
        g.writes = (g.writes || 0) + docCount;
        g.writeOps = (g.writeOps || 0) + 1;
      } else if (log.type === "firestore_delete") {
        g.deletes = (g.deletes || 0) + docCount;
        g.deleteOps = (g.deleteOps || 0) + 1;
      } else if (log.type === "tmdb_request") {
        g.totalRequests = (g.totalRequests || 0) + 1;
      } else if (log.type === "function_call") {
        g.calls = (g.calls || 0) + 1;
      }
    });

    return groups;
  }, [stats.recentLogs]);

  const totalLogDocs = useMemo(() => {
    let totalReads = 0;
    let totalWrites = 0;
    let totalDeletes = 0;
    (stats.recentLogs || []).forEach((l) => {
      let count = typeof l.docCount === "number" ? l.docCount : 1;
      if (count === 1 && typeof l.detail === "string" && l.detail.startsWith("+")) {
        const parsed = parseInt(l.detail.slice(1), 10);
        if (!isNaN(parsed) && parsed > 0) count = parsed;
      }
      if (l.type === "firestore_read") totalReads += count;
      else if (l.type === "firestore_write") totalWrites += count;
      else if (l.type === "firestore_delete") totalDeletes += count;
    });
    return { totalReads, totalWrites, totalDeletes };
  }, [stats.recentLogs]);

  // Yenileme işlemi
  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    const freshStats = getUsageStats();
    setStats({ ...freshStats });
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Yenilendi", "Sayaçlar ve canlı metrikler güncellendi.");
    }, 300);
  }, []);

  // Sıfırlama işlemi
  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Sayaçları Sıfırla",
      "Tüm Firestore, Functions ve Gemini tüketim kayıtları sıfırlanacak. Yeni bir test başlatmak istiyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sıfırla",
          style: "destructive",
          onPress: () => {
            resetUsageStats();
            toast.success("Başarılı", "Tüketim sayaçları sıfırlandı.");
          },
        },
      ],
    );
  }, []);

  // Raporu Kopyala
  const handleCopyReport = useCallback(async () => {
    Haptics.selectionAsync();
    const report = generateMarkdownReport(stats);
    await Clipboard.setStringAsync(report);
    toast.success("Kopyalandı", "Ayrıntılı test ve maliyet raporu panoya kopyalandı.");
  }, [stats]);

  // ── Sıfır Kayıpla Yedekleme & Geri Yükleme Eylemleri ─────────────────────
  const handleCopyBackupJson = useCallback(async () => {
    try {
      Haptics.selectionAsync();
      const json = exportUsageBackup({ format: "string", pretty: true });
      await Clipboard.setStringAsync(json);
      toast.success("Yedek Kopyalandı", "Tüm istatistik, log ve oturum verileri JSON olarak panoya kopyalandı.");
    } catch (err) {
      Alert.alert("Hata", "Yedek kopyalanırken hata oluştu: " + err.message);
    }
  }, []);

  const handleShareBackupFile = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsExporting(true);
      const json = exportUsageBackup({ format: "string", pretty: true });
      const now = new Date();
      const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const filename = `seelogd_usage_backup_${dateTag}.json`;
      const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Seelogd İstatistik Yedeğini Kaydet / Paylaş",
          UTI: "public.json",
        });
      } else {
        await Clipboard.setStringAsync(json);
        toast.success("Panoya Kopyalandı", "Paylaşım desteklenmediği için yedek panoya kopyalandı.");
      }
    } catch (err) {
      Alert.alert("Dışa Aktarma Hatası", err.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const confirmAndRestore = useCallback((rawInput, sourceName = "Yedek") => {
    const validation = validateUsageBackup(rawInput);
    if (!validation.valid) {
      Alert.alert("Geçersiz Yedek", validation.error || "Seelogd istatistik formatına uygun değil.");
      return;
    }

    const s = validation.summary;
    const detailsMsg =
      `📅 Oturum Başlangıcı: ${s.startedAtFormatted}\n` +
      `📊 Toplam Firestore: ${s.firestoreOps.toLocaleString()} işlem\n` +
      `🤖 Gemini AI Token: ${s.geminiTokens.toLocaleString()} token (${s.geminiRequests} istek)\n` +
      `📜 Canlı Log Kaydı: ${s.logCount} adet\n` +
      `🗓️ Günlük Geçmiş: ${s.daysCount} gün\n\n` +
      `Bu yedeği geri yüklemek mevcut canlı verilerin üzerine yazacaktır. Onaylıyor musunuz?`;

    Alert.alert(`${sourceName} Geri Yükle`, detailsMsg, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Geri Yükle",
        style: "destructive",
        onPress: () => {
          const res = importUsageBackup(rawInput);
          if (res.success) {
            setStats({ ...res.stats });
            setBackupModalVisible(false);
            setShowManualInput(false);
            setManualJsonText("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.success("Yedek Yüklendi", "Tüm istatistikler ve log geçmişi başarıyla geri yüklendi.");
          } else {
            Alert.alert("Hata", "Yedek yüklenemedi: " + res.error);
          }
        },
      },
    ]);
  }, []);

  const handleImportFromClipboard = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert("Pano Boş", "Panoda herhangi bir metin bulunamadı. Lütfen önce JSON yedeğini kopyalayın.");
        return;
      }
      confirmAndRestore(text, "Panodan");
    } catch (err) {
      Alert.alert("Hata", "Panodan okuma başarısız: " + err.message);
    }
  }, [confirmAndRestore]);

  const handleImportFromFile = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      confirmAndRestore(fileContent, "Dosyadan");
    } catch (err) {
      Alert.alert("Dosya Okuma Hatası", err.message);
    }
  }, [confirmAndRestore]);

  const handleManualRestore = useCallback(() => {
    if (!manualJsonText || !manualJsonText.trim()) return;
    confirmAndRestore(manualJsonText, "Manuel Metinden");
  }, [manualJsonText, confirmAndRestore]);

  // ── Bildirim Testi Eylemleri ──────────────────────────────────────────────
  const [notifPerm, setNotifPerm] = useState({ status: "undetermined", granted: false });

  useEffect(() => {
    getPermissionInfo().then(setNotifPerm);
    ensureAndroidChannels();
  }, []);

  const handleRequestNotifPerm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const granted = await requestNotificationPermission();
    const info = await getPermissionInfo();
    setNotifPerm(info);
    if (granted) {
      toast.success("İzin Verildi", "Bildirim izinleri başarıyla açıldı.");
    } else {
      Alert.alert("İzin Gerekli", "Bildirim izni reddedildi. Bildirimleri test etmek için cihaz ayarlarından bildirim izni vermelisiniz.");
    }
  }, []);

  const triggerTestNotification = useCallback(async ({ title, body, channelId = CHANNELS.default, data = {} }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await ensureAndroidChannels();
      await presentNow({ title, body, channelId, data });
      toast.success("Bildirim Gönderildi", title);
    } catch (e) {
      Alert.alert("Bildirim Hatası", e?.message || "Bildirim gönderilemedi.");
    }
  }, []);

  const triggerDelayedNotification = useCallback(async (seconds = 5) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await ensureAndroidChannels();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Zamanlanmış Test Bildirimi",
          body: "5 saniye doldu! Uygulama arka plandayken bildirim başarıyla iletildi.",
          sound: true,
          data: { test: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
      toast.success("5 Saniye Sayacı Başladı", "Lütfen uygulamayı simge durumuna küçültün veya ana ekrana geçin.");
    } catch (e) {
      Alert.alert("Hata", e?.message || "Zamanlama başarısız.");
    }
  }, []);

  if (!stats || !costs) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ color: theme.text?.secondary || "#888", marginTop: 12 }}>
            İstatistikler yükleniyor...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Geçen süre formatı (gün, saat, dakika, saniye)
  const elapsedSec = Math.max(1, Math.floor((currentTime - (stats.startedAt || currentTime)) / 1000));
  const elapsedDays = Math.floor(elapsedSec / 86400);
  const elapsedHours = Math.floor((elapsedSec % 86400) / 3600);
  const elapsedMinutes = Math.floor((elapsedSec % 3600) / 60);
  const elapsedSeconds = elapsedSec % 60;
  const timerStr = elapsedDays > 0
    ? `${elapsedDays}g ${elapsedHours}sa ${elapsedMinutes}dk`
    : elapsedHours > 0
    ? `${elapsedHours}sa ${elapsedMinutes}dk ${elapsedSeconds}sn`
    : `${elapsedMinutes}dk ${elapsedSeconds}sn`;

  const startFormattedDate = new Date(stats.startedAt || currentTime).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalFirestoreOps = stats.firestore.reads + stats.firestore.writes + stats.firestore.deletes;
  const freeTierSavingsUsd = Math.max(0, costs.totalUsd - costs.netPayableUsd);
  const freeTierSavingsTry = freeTierSavingsUsd * PRICING.usdToTryRate;

  // En çok tüketim yapan modüller (Top 3 Hotspot)
  const sortedZones = Object.entries(stats.firestore.zones || {})
    .map(([key, data]) => {
      const reads = data.reads || 0;
      const writes = data.writes || 0;
      const deletes = data.deletes || 0;
      const totalOps = reads + writes + deletes;
      const estCostUsd = ((reads / 1e5) * PRICING.firestoreReadPer100k) +
                         ((writes / 1e5) * PRICING.firestoreWritePer100k);
      const estCostTry = estCostUsd * PRICING.usdToTryRate;
      return {
        key,
        name: ZONES[key]?.name || key,
        icon: ZONES[key]?.icon || "layers",
        color: ZONES[key]?.color || theme.accent,
        totalOps,
        reads,
        writes,
        deletes,
        estCostUsd,
        estCostTry,
      };
    })
    .sort((a, b) => b.totalOps - a.totalOps);

  const toggleLogGroup = (groupId) => {
    Haptics.selectionAsync();
    setExpandedLogGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const expandAllLogGroups = () => {
    Haptics.selectionAsync();
    const allExpanded = {};
    Object.keys(groupedLogs).forEach((k) => {
      allExpanded[k] = true;
    });
    setExpandedLogGroups(allExpanded);
  };

  const collapseAllLogGroups = () => {
    Haptics.selectionAsync();
    setExpandedLogGroups({});
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="settings" iconOpacity={0.25} />

      {/* ── Üst Başlık ve Hızlı Eylemler (Yenile / Kopyala / Sıfırla) ────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.devTag, { backgroundColor: (theme.colors?.orange || "#FF9800") + "26" }]}>
              <Text style={[styles.devTagText, { color: theme.colors?.orange || "#FF9800" }]}>DEV MONITOR</Text>
            </View>
            <Text style={[styles.timerText, { color: theme.text?.muted || "#888" }]}>
              ⏱️ {timerStr} aktif
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.headerTitle, { color: theme.text?.primary || "#fff" }]}>
            Tüketim & Maliyet
          </Text>
          <Text style={{ fontSize: 11, color: theme.text?.muted || "#777", marginTop: 2 }}>
            📅 Başlangıç: {startFormattedDate}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleRefresh}
            style={[styles.headerBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <AppIcon family="Ionicons" name="refresh" size={17} color={theme.accent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCopyReport}
            style={[styles.headerBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name="copy-outline" size={17} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync();
              setBackupModalVisible(true);
            }}
            style={[styles.headerBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name="save-outline" size={17} color={theme.colors?.green || "#29b864"} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleReset}
            style={[styles.headerBtn, { backgroundColor: "#FF3B3018", borderColor: "#FF3B3044" }]}
          >
            <AppIcon family="Ionicons" name="trash-outline" size={17} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sekme Çubuğu (Segmented Tabs) ──────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(t.id);
                }}
                activeOpacity={0.75}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? theme.accent : theme.secondary,
                    borderColor: isActive ? theme.accent : theme.border,
                  },
                ]}
              >
                <AppIcon
                  family="Ionicons"
                  name={t.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : theme.text?.secondary || "#aaa"}
                />
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive ? "#FFFFFF" : theme.text?.secondary || "#aaa",
                      fontWeight: isActive ? "800" : "600",
                    },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── İçerik Alanı ──────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. GENEL BAKIŞ SEKMESİ (ZENGİNLEŞTİRİLMİŞ KOKPİT) ─────────────── */}
        {activeTab === "overview" && (
          <View style={styles.tabContent}>
            {/* 1. Ana Kokpit Kartı */}
            <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              {/* Üst Durum & Zaman Satırı */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.liveIndicatorDot, { backgroundColor: "#4CAF50" }]} />
                  <Text style={[styles.heroLabel, { color: theme.text?.muted || "#888" }]}>
                    CANLI TEST KOKPİTİ
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={[styles.statusPillText, { color: theme.accent }]}>
                    ⏱️ {timerStr}
                  </Text>
                </View>
              </View>

              {/* Büyük Finansal Tutar */}
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.text?.muted || "#888", textTransform: "uppercase" }}>
                  Toplam Tüketilen Kaynak Değeri
                </Text>
                <View style={styles.heroPriceRow}>
                  <Text style={[styles.heroPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                    ${(costs?.totalUsd || 0) < 0.01 ? (costs?.totalUsd || 0).toFixed(4) : (costs?.totalUsd || 0).toFixed(2)}
                  </Text>
                  <Text style={[styles.heroPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                    ≈ {(costs?.totalTry || 0).toFixed(2)} ₺
                  </Text>
                </View>
              </View>

              {/* Fatura Durumu ve Tasarruf Banner'ı */}
              <View style={[styles.heroBanner, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", color: theme.text?.muted || "#888" }}>
                    GOOGLE'A ÖDENECEK
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: (costs?.netPayableUsd || 0) > 0 ? "#FF9800" : (theme.colors?.green || "#29b864"), marginTop: 2 }}>
                    ${(costs?.netPayableUsd || 0).toFixed(2)} ({(costs?.netPayableTry || 0).toFixed(2)} ₺)
                  </Text>
                </View>
                <View style={[styles.freeShieldBadge, { backgroundColor: "#4CAF5018", borderColor: "#4CAF5055" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#4CAF50" }}>
                    🎁 {(freeTierSavingsTry || 0).toFixed(2)} ₺ Tasarruf
                  </Text>
                  <Text style={{ fontSize: 9.5, fontWeight: "600", color: "#4CAF50", marginTop: 1 }}>
                    Ücretsiz Kota Koruması
                  </Text>
                </View>
              </View>

              {/* 4'lü Hızlı Metrik Özeti */}
              <View style={styles.quickMetricsGrid}>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📖</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.accent }]}>{(stats?.firestore?.reads || 0).toLocaleString()}</Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Okuma</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>✍️</Text>
                  <Text style={[styles.quickMetricVal, { color: "#4CAF50" }]}>{(stats?.firestore?.writes || 0).toLocaleString()}</Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Yazma</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                  <Text style={[styles.quickMetricVal, { color: "#C25AFF" }]}>{(stats?.gemini?.totalTokens || 0).toLocaleString()}</Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>AI Token</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🎬</Text>
                  <Text style={[styles.quickMetricVal, { color: "#FF9800" }]}>{stats?.tmdb?.totalRequests || 0}</Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>TMDB İstek</Text>
                </View>
              </View>
            </View>

            {/* 2. Servis Bazında Ayrıntılı Tüketim & Fatura Dağılımı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                🏛️ Servis Bazlı Tüketim & Fatura Ayrımı
              </Text>

              {/* Firestore Servis Kartı */}
              <View style={[styles.serviceOverviewCard, { borderColor: "#FF980044", backgroundColor: theme.primary }]}>
                <View style={styles.serviceOverviewHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.serviceIconWrap, { backgroundColor: "#FF980020" }]}>
                      <AppIcon family="Ionicons" name="server" size={16} color="#FF9800" />
                    </View>
                    <View>
                      <Text style={[styles.serviceOverviewName, { color: theme.text?.primary || "#fff" }]}>Cloud Firestore</Text>
                      <Text style={[styles.serviceOverviewSub, { color: theme.text?.muted || "#888" }]}>
                        {(stats?.firestore?.reads || 0) + (stats?.firestore?.writes || 0) + (stats?.firestore?.deletes || 0)} Toplam Döküman İşlemi
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.serviceOverviewCost, { color: theme.colors?.green || "#29b864" }]}>
                      {(costs?.firestore?.totalCostTry || (costs?.firestore?.totalCost || 0) * PRICING.usdToTryRate).toFixed(3)} ₺
                    </Text>
                    <Text style={{ fontSize: 10, color: "#FF9800", fontWeight: "700" }}>
                      %{(((stats?.firestore?.reads || 0) / 50000) * 100).toFixed(1)} Günlük Kota
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceOverviewDetailRow}>
                  <Text style={[styles.serviceDetailText, { color: theme.text?.secondary || "#ccc" }]}>
                    📖 {(stats?.firestore?.reads || 0).toLocaleString()} Okuma
                  </Text>
                  <Text style={[styles.serviceDetailText, { color: theme.text?.secondary || "#ccc" }]}>
                    ✍️ {(stats?.firestore?.writes || 0).toLocaleString()} Yazma
                  </Text>
                  <Text style={[styles.serviceDetailText, { color: theme.text?.secondary || "#ccc" }]}>
                    🗑️ {(stats?.firestore?.deletes || 0).toLocaleString()} Silme
                  </Text>
                </View>
              </View>

              {/* Gemini AI Servis Kartı */}
              <View style={[styles.serviceOverviewCard, { borderColor: "#C25AFF44", backgroundColor: theme.primary }]}>
                <View style={styles.serviceOverviewHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.serviceIconWrap, { backgroundColor: "#C25AFF20" }]}>
                      <AppIcon family="Ionicons" name="sparkles" size={16} color="#C25AFF" />
                    </View>
                    <View>
                      <Text style={[styles.serviceOverviewName, { color: theme.text?.primary || "#fff" }]}>Gemini 2.5 Flash</Text>
                      <Text style={[styles.serviceOverviewSub, { color: theme.text?.muted || "#888" }]}>
                        {stats?.gemini?.requests || 0} İstek · {(stats?.gemini?.totalTokens || 0).toLocaleString()} Token
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.serviceOverviewCost, { color: theme.colors?.green || "#29b864" }]}>
                      {((stats?.gemini?.totalCostUsd || 0) * PRICING.usdToTryRate).toFixed(3)} ₺
                    </Text>
                    <Text style={{ fontSize: 10, color: "#C25AFF", fontWeight: "700" }}>
                      ${(stats?.gemini?.totalCostUsd || 0).toFixed(5)}
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceOverviewDetailRow}>
                  <Text style={[styles.serviceDetailText, { color: theme.text?.secondary || "#ccc" }]}>
                    📥 Giriş: {(stats?.gemini?.promptTokens || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.serviceDetailText, { color: theme.text?.secondary || "#ccc" }]}>
                    📤 Çıkış: {((stats?.gemini?.outputTokens || 0) + ((stats?.gemini?.thoughtsTokens) || 0)).toLocaleString()} (4x)
                  </Text>
                </View>
              </View>

              {/* Cloud Functions Servis Kartı */}
              <View style={[styles.serviceOverviewCard, { borderColor: "#3F51B544", backgroundColor: theme.primary }]}>
                <View style={styles.serviceOverviewHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.serviceIconWrap, { backgroundColor: "#3F51B520" }]}>
                      <AppIcon family="Ionicons" name="flash" size={16} color="#3F51B5" />
                    </View>
                    <View>
                      <Text style={[styles.serviceOverviewName, { color: theme.text?.primary || "#fff" }]}>Cloud Functions</Text>
                      <Text style={[styles.serviceOverviewSub, { color: theme.text?.muted || "#888" }]}>
                        {stats.functions.totalCalls} Çağrı · Toplam {stats.functions.totalDurationMs} ms
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.serviceOverviewCost, { color: theme.colors?.green || "#29b864" }]}>
                      0.00 ₺
                    </Text>
                    <Text style={{ fontSize: 10, color: "#3F51B5", fontWeight: "700" }}>
                      2M / Ay Ücretsiz
                    </Text>
                  </View>
                </View>
              </View>

              {/* TMDB Medya Servis Kartı */}
              <View style={[styles.serviceOverviewCard, { borderColor: "#01D27744", backgroundColor: theme.primary }]}>
                <View style={styles.serviceOverviewHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.serviceIconWrap, { backgroundColor: "#01D27720" }]}>
                      <AppIcon family="Ionicons" name="film" size={16} color="#01D277" />
                    </View>
                    <View>
                      <Text style={[styles.serviceOverviewName, { color: theme.text?.primary || "#fff" }]}>TMDB Medya API</Text>
                      <Text style={[styles.serviceOverviewSub, { color: theme.text?.muted || "#888" }]}>
                        {stats.tmdb?.totalRequests || 0} Toplam İstek
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.serviceOverviewCost, { color: theme.colors?.green || "#29b864" }]}>
                      0.00 ₺ (Sınırsız)
                    </Text>
                    <Text style={{ fontSize: 10, color: "#01D277", fontWeight: "700" }}>
                      %{costs.tmdb.cacheEfficiency} SWR Tasarruf
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 3. Günlük & Aylık Kotaların Canlı İlerleme Barları (Kalan Haklarla) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📊 Ücretsiz Kotalar ve Kalan Haklar
              </Text>

              {/* Firestore Okuma Barı */}
              <View style={styles.quotaItem}>
                <View style={styles.quotaHeader}>
                  <Text style={[styles.quotaLabel, { color: theme.text?.primary || "#fff" }]}>Firestore Okuma (Günlük 50K)</Text>
                  <Text style={[styles.quotaVal, { color: theme.accent }]}>
                    Kalan: {Math.max(0, 50000 - (stats?.firestore?.reads || 0)).toLocaleString()} (%{((((stats?.firestore?.reads || 0) / 50000) * 100)).toFixed(1)})
                  </Text>
                </View>
                <View style={styles.quotaBarBg}>
                  <View
                    style={[
                      styles.quotaBarFill,
                      {
                        width: `${Math.min(100, (((stats?.firestore?.reads || 0) / 50000) * 100))}%`,
                        backgroundColor: ((stats?.firestore?.reads || 0) / 50000) > 0.8 ? "#FF3B30" : theme.accent,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Firestore Yazma Barı */}
              <View style={styles.quotaItem}>
                <View style={styles.quotaHeader}>
                  <Text style={[styles.quotaLabel, { color: theme.text?.primary || "#fff" }]}>Firestore Yazma (Günlük 20K)</Text>
                  <Text style={[styles.quotaVal, { color: theme.colors?.green || "#29b864" }]}>
                    Kalan: {Math.max(0, 20000 - (stats?.firestore?.writes || 0)).toLocaleString()} (%{((((stats?.firestore?.writes || 0) / 20000) * 100)).toFixed(1)})
                  </Text>
                </View>
                <View style={styles.quotaBarBg}>
                  <View
                    style={[
                      styles.quotaBarFill,
                      {
                        width: `${Math.min(100, (((stats?.firestore?.writes || 0) / 20000) * 100))}%`,
                        backgroundColor: theme.colors?.green || "#29b864",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Cloud Functions Barı */}
              <View style={styles.quotaItem}>
                <View style={styles.quotaHeader}>
                  <Text style={[styles.quotaLabel, { color: theme.text?.primary || "#fff" }]}>Cloud Functions (Aylık 2M)</Text>
                  <Text style={[styles.quotaVal, { color: "#3F51B5" }]}>
                    {stats.functions.totalCalls.toLocaleString()} / 2.000.000
                  </Text>
                </View>
                <View style={styles.quotaBarBg}>
                  <View
                    style={[
                      styles.quotaBarFill,
                      {
                        width: `${Math.min(100, Math.max(0.5, (stats.functions.totalCalls / 2000000) * 100))}%`,
                        backgroundColor: "#3F51B5",
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* 4. En Çok Tüketim Yapan Modüller (Modern Hotspot Podium) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                  🔥 En Çok Okuma/Yazma Yapan Alanlar
                </Text>
                <View style={[styles.hotspotLiveBadge, { backgroundColor: "#FF3B3018", borderColor: "#FF3B3044" }]}>
                  <Text style={[styles.hotspotLiveBadgeText, { color: "#FF3B30" }]}>TOP 3 HOTSPOT</Text>
                </View>
              </View>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                Toplam {(totalFirestoreOps || 0).toLocaleString()} işlem içerisindeki en yoğun tüketim merkezleri ve yük dağılımı:
              </Text>

              {sortedZones.slice(0, 3).map((item, idx) => {
                const percent = totalFirestoreOps > 0 ? ((item.totalOps / totalFirestoreOps) * 100).toFixed(1) : "0.0";
                const readPercent = item.totalOps > 0 ? Math.round((item.reads / item.totalOps) * 100) : 0;
                const writePercent = item.totalOps > 0 ? Math.round((item.writes / item.totalOps) * 100) : 0;

                const medalMeta = idx === 0
                  ? { medal: "🥇", label: "1. Sıra (Lider)", badgeBg: "#FFD70020", badgeColor: "#FFD700", glowBorder: "#FFD70055" }
                  : idx === 1
                  ? { medal: "🥈", label: "2. Sıra", badgeBg: "#C0C0C020", badgeColor: "#C0C0C0", glowBorder: "#C0C0C044" }
                  : { medal: "🥉", label: "3. Sıra", badgeBg: "#CD7F3220", badgeColor: "#CD7F32", glowBorder: "#CD7F3244" };

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.modernHotspotCard,
                      {
                        backgroundColor: theme.primary,
                        borderColor: idx === 0 ? medalMeta.glowBorder : theme.border,
                      },
                    ]}
                  >
                    {/* Üst Sıralama & Başlık Satırı */}
                    <View style={styles.modernHotspotTopRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={[styles.modernHotspotIconWrap, { backgroundColor: item.color + "22", borderColor: item.color + "44" }]}>
                          <AppIcon family="Ionicons" name={item.icon} size={18} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={[styles.modernHotspotName, { color: theme.text?.primary || "#fff" }]}>
                              {item.name}
                            </Text>
                            <View style={[styles.modernMedalBadge, { backgroundColor: medalMeta.badgeBg }]}>
                              <Text style={[styles.modernMedalText, { color: medalMeta.badgeColor }]}>
                                {medalMeta.medal} {medalMeta.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.modernHotspotSub, { color: theme.text?.muted || "#888" }]}>
                            {item.reads.toLocaleString()} Okuma · {item.writes.toLocaleString()} Yazma · {item.deletes.toLocaleString()} Silme
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.modernHotspotPercent, { color: item.color }]}>
                          %{percent}
                        </Text>
                        <Text style={[styles.modernHotspotTotalOps, { color: theme.text?.muted || "#888" }]}>
                          {item.totalOps.toLocaleString()} İşlem
                        </Text>
                      </View>
                    </View>

                    {/* Çift Renkli Okuma vs. Yazma İlerleme Çubuğu */}
                    <View style={styles.dualBarContainer}>
                      <View style={styles.dualBarBg}>
                        {readPercent > 0 && (
                          <View
                            style={[
                              styles.dualBarSegment,
                              {
                                width: `${readPercent}%`,
                                backgroundColor: theme.accent,
                              },
                            ]}
                          />
                        )}
                        {writePercent > 0 && (
                          <View
                            style={[
                              styles.dualBarSegment,
                              {
                                width: `${writePercent}%`,
                                backgroundColor: theme.colors?.green || "#29b864",
                              },
                            ]}
                          />
                        )}
                      </View>
                    </View>

                    {/* Alt 3'lü Mikro-Metrik Izgarası */}
                    <View style={styles.modernHotspotFooter}>
                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <View style={[styles.microDot, { backgroundColor: theme.accent }]} />
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Okuma:</Text>
                        <Text style={[styles.microMetricVal, { color: theme.text?.primary || "#fff" }]}>
                          {item.reads.toLocaleString()} (%{readPercent})
                        </Text>
                      </View>

                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <View style={[styles.microDot, { backgroundColor: theme.colors?.green || "#29b864" }]} />
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Yazma:</Text>
                        <Text style={[styles.microMetricVal, { color: theme.text?.primary || "#fff" }]}>
                          {item.writes.toLocaleString()} (%{writePercent})
                        </Text>
                      </View>

                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <Text style={{ fontSize: 10 }}>💰</Text>
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Maliyet:</Text>
                        <Text style={[styles.microMetricVal, { color: theme.colors?.green || "#29b864" }]}>
                          {(item.estCostTry || 0).toFixed(3)} ₺
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* 5. Canlı Sağlık ve Optimizasyon Karnesi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                💡 Canlı Sistem Sağlığı & Optimizasyon Karnesi
              </Text>

              <View style={styles.auditRow}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Firestore Okuma Dengesi</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Toplu liste dinleyicileri SWR ve yerel önbellekle destekleniyor, gereksiz sorgu tekrarlanmıyor.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Gemini Token Verimliliği</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    4 kat daha pahalı olan çıkış token'ları kısa tutuluyor, geçmiş mesajlar 12 mesajla sınırlandırılıyor.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>TMDB & Medya Önbellekleme</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    İsteklerin %{costs.tmdb.cacheEfficiency}'i internete çıkmadan MMKV bellekten karşılanarak sıfır gecikme sağlandı.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── BİLDİRİM TESTLERİ SEKMESİ ──────────────────────────────────────── */}
        {activeTab === "notifications_test" && (
          <View style={styles.tabContent}>
            {/* 1. İzin ve Sistem Durumu Banner'ı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.serviceIconWrap, { backgroundColor: notifPerm.granted ? "#4CAF5022" : "#FF3B3022" }]}>
                    <AppIcon
                      family="Ionicons"
                      name={notifPerm.granted ? "notifications" : "notifications-off"}
                      size={18}
                      color={notifPerm.granted ? "#4CAF50" : "#FF3B30"}
                    />
                  </View>
                  <View>
                    <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 2, fontSize: 15 }]}>
                      Cihaz Bildirim Durumu
                    </Text>
                    <Text style={{ fontSize: 11.5, color: notifPerm.granted ? "#4CAF50" : "#FF9800", fontWeight: "700" }}>
                      {notifPerm.granted ? "🟢 İzin Verildi (Kullanıma Hazır)" : `🟡 İzin Durumu: ${notifPerm.status}`}
                    </Text>
                  </View>
                </View>

                {!notifPerm.granted && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleRequestNotifPerm}
                    style={[styles.presetChip, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  >
                    <Text style={[styles.presetChipText, { color: "#FFFFFF", fontWeight: "800" }]}>İzin İste</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={{ fontSize: 11.5, color: theme.text?.muted || "#888", marginTop: 10, lineHeight: 16 }}>
                Aşağıdaki butonlara dokunarak uygulamanın tüm bildirim türlerini (Hatırlatıcılar, Sosyal, Sohbet, CineSwipe ve Arka Plan) canlı olarak cihazınızda test edebilirsiniz.
              </Text>
            </View>

            {/* 2. Zamanlanmış / Arka Plan Testi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                ⏱️ Arka Plan Bildirim Testi (Zamanlayıcı)
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                Butona bastıktan sonra 5 saniye içinde uygulamayı arka plana atın veya ana ekrana dönün:
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => triggerDelayedNotification(5)}
                style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.accent }]}
              >
                <View style={[styles.notifTestIconWrap, { backgroundColor: theme.accent + "20" }]}>
                  <AppIcon family="Ionicons" name="timer" size={20} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                    5 Saniye Sonra Gönder (Arka Plan Testi)
                  </Text>
                  <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                    Sayacı başlatır ve uygulama kapalıyken bildirimin gelişini test eder.
                  </Text>
                </View>
                <AppIcon family="Ionicons" name="play-forward" size={18} color={theme.accent} />
              </TouchableOpacity>
            </View>

            {/* 3. Hatırlatıcı Bildirimleri (Reminders) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={[styles.notifTestIconWrap, { backgroundColor: "#FF980020" }]}>
                  <AppIcon family="Ionicons" name="alarm" size={18} color="#FF9800" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                    1. Hatırlatıcı Bildirimleri (Ayarlar &gt; Hatırlatıcılar)
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.text?.muted || "#888" }}>
                    Film, dizi, özel notlar ve yayın platformu bildirimleri
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "🎬 Oppenheimer (Vizyon Günü)",
                      body: "Beklediğin film bugün sinemalarda ve dijital platformlarda yayında!",
                      channelId: CHANNELS.reminders,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>🎬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Film Vizyon & Yayın Bildirimi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Vizyon günü veya seçilen gün öncesinde iletilen film bildirimi
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#FF9800" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "📺 The Last of Us (Yeni Bölüm)",
                      body: "2. Sezon 1. Bölüm şimdi yayında! Kaçırma.",
                      channelId: CHANNELS.reminders,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>📺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Dizi Yeni Bölüm Bildirimi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Takip edilen dizinin yeni bölümü çıktığında gönderilir
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#FF9800" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "📝 'Haftasonu İzlenecekler' Notun",
                      body: "Hatırlatma: Bu akşam Inception filmini izlemeyi planlamıştın.",
                      channelId: CHANNELS.reminders,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>📝</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Özel İzleme Notu Hatırlatıcısı
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Kullanıcının profil notlarına kurduğu tarihli hatırlatıcı
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#FF9800" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "🍿 Dune: Part Two (Yayında)",
                      body: "Favori listenizdeki film artık Netflix ve BluTV'de izlenebilir!",
                      channelId: CHANNELS.reminders,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>🍿</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Platform / Yayın Uygunluğu Bildirimi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Film kullanıcının seçtiği bir yayın platformuna eklendiğinde iletilir
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#FF9800" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Sosyal Bildirimler (Social) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={[styles.notifTestIconWrap, { backgroundColor: "#E91E6320" }]}>
                  <AppIcon family="Ionicons" name="heart" size={18} color="#E91E63" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                    2. Sosyal Bildirimler (Ayarlar &gt; Sosyal)
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.text?.muted || "#888" }}>
                    Arkadaşlık, beğeni, yorum ve bahsetmeler
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Can Yılmaz",
                      body: "👤 sana arkadaşlık isteği gönderdi",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Arkadaşlık İsteği
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Yeni bir kullanıcıdan gelen arkadaşlık daveti
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Elif Kaya",
                      body: "🤝 arkadaşlık isteğini kabul etti",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>🤝</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Arkadaşlık Kabulü
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Gönderilen arkadaşlık isteği onaylandığında
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Murat Demir",
                      body: "❤️ 'Interstellar incelemesi' gönderini beğendi",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>❤️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Gönderi Beğenisi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Paylaştığınız bir post veya inceleme beğenildiğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Zeynep Arslan",
                      body: "💬 gönderine yorum yaptı: 'Görsel efektler tek kelimeyle harikaydı!'",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>💬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Gönderi Yorumu
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Gönderinize yeni bir yorum eklendiğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Ahmet Yıldız",
                      body: "💬 yorumuna yanıt verdi: 'Film müziği Hans Zimmer imzalıydı.'",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>↩️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Yorum Yanıtı
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Yorumunuza bir kullanıcı cevap verdiğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Mehmet Öz",
                      body: "💬 bir gönderide senden bahsetti: '@ismail bu diziye bayılacaksın!'",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>@</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Bahsetme (@Mention)
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Bir yorum veya gönderide kullanıcı adınız etiketlendiğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "📋 'En İyi Bilim Kurgular' Listesi",
                      body: "Berk yeni bir film ekledi: Blade Runner 2049",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Ortak Liste Güncellemesi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Ortak olduğunuz listeye bir arkadaşınız yeni film eklediğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#E91E63" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 5. Mesajlar & Sohbet Bildirimleri (Chat) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={[styles.notifTestIconWrap, { backgroundColor: "#00BCD420" }]}>
                  <AppIcon family="Ionicons" name="chatbubbles" size={18} color="#00BCD4" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                    3. Mesajlar & Sohbet Bildirimleri
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.text?.muted || "#888" }}>
                    Birebir sohbet, grup mesajları ve CineSwipe
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Ayşe Korkmaz",
                      body: "Bu akşamki film gecesi için hazır mısın?",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>💬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Birebir Özel Mesaj (DM)
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Bir arkadaşınızdan gelen yeni sohbet mesajı
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#00BCD4" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "Sinema Kulübü (Grup)",
                      body: "Burak: Hafta sonu IMAX biletlerini aldım!",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>👥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      Grup Sohbeti Mesajı
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Grup üyelerinden gelen yeni mesaj bildirimi
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#00BCD4" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    triggerTestNotification({
                      title: "🎉 Yeni Bir Eşleşme Var!",
                      body: "Gizem ile 'Fight Club' filminde eşleştiniz! Birlikte izleyebilirsiniz.",
                      channelId: CHANNELS.social,
                    })
                  }
                  style={[styles.notifTestBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 18 }}>🎉</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTestTitle, { color: theme.text?.primary || "#fff" }]}>
                      CineSwipe Film Eşleşmesi
                    </Text>
                    <Text style={[styles.notifTestSub, { color: theme.text?.muted || "#888" }]}>
                      Oyun odasında arkadaşınızla ortak beğendiğiniz film eşleştiğinde
                    </Text>
                  </View>
                  <AppIcon family="Ionicons" name="send" size={16} color="#00BCD4" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── 2. GÜNLÜK GRAFİKLER & GÜN BAZLI ANALİZ SEKMESİ ───────────────── */}
        {activeTab === "daily" && (
          <View style={styles.tabContent}>
            {/* Gün Seçici Şeridi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border, paddingVertical: 12 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 10, fontSize: 14 }]}>
                📅 Analiz Edilecek Günü Seçin
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {dailyList.map((day) => {
                  const isSelected = day.dateKey === selectedDay?.dateKey;
                  const isToday = day.dateKey === getTodayKey();
                  return (
                    <TouchableOpacity
                      key={day.dateKey}
                      activeOpacity={0.75}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedDayKey(day.dateKey);
                      }}
                      style={[
                        styles.dailyDayChip,
                        {
                          backgroundColor: isSelected ? theme.accent : theme.primary,
                          borderColor: isSelected ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {isToday && <View style={[styles.statusDot, { backgroundColor: isSelected ? "#fff" : "#4CAF50" }]} />}
                        <Text
                          style={[
                            styles.dailyDayChipTitle,
                            {
                              color: isSelected ? "#FFFFFF" : theme.text?.primary || "#fff",
                              fontWeight: isSelected ? "900" : "700",
                            },
                          ]}
                        >
                          {isToday ? "Bugün" : day.dateFormatted || day.dateKey}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.dailyDayChipSub,
                          {
                            color: isSelected ? "#FFFFFFDD" : theme.colors?.green || "#29b864",
                          },
                        ]}
                      >
                        {(day.totalCostTry || 0).toFixed(2)} ₺ · {((day.firestore?.reads || 0) + (day.firestore?.writes || 0))} İşlem
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Seçili Günün Genel Tüketim & Finansal Özeti */}
            <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                  <Text style={[styles.heroLabel, { color: theme.text?.muted || "#888" }]}>
                    {selectedDay?.dateFormatted || selectedDay?.dateKey} GÜNLÜK RAPORU
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={[styles.statusPillText, { color: theme.accent }]}>
                    {selectedDay?.dateKey === getTodayKey() ? "🟢 Aktif Gün" : "Geçmiş Kayıt"}
                  </Text>
                </View>
              </View>

              <View style={styles.heroPriceRow}>
                <Text style={[styles.heroPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                  ${(selectedDay?.totalCostUsd || 0) < 0.01 ? (selectedDay?.totalCostUsd || 0).toFixed(4) : (selectedDay?.totalCostUsd || 0).toFixed(2)}
                </Text>
                <Text style={[styles.heroPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                  ≈ {(selectedDay?.totalCostTry || 0).toFixed(2)} ₺
                </Text>
              </View>

              {/* 4'lü Hızlı Sayaç Izgarası */}
              <View style={styles.quickMetricsGrid}>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📖</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.accent }]}>
                    {(selectedDay?.firestore?.reads || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Okuma</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>✍️</Text>
                  <Text style={[styles.quickMetricVal, { color: "#4CAF50" }]}>
                    {(selectedDay?.firestore?.writes || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Yazma</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                  <Text style={[styles.quickMetricVal, { color: "#C25AFF" }]}>
                    {(selectedDay?.gemini?.totalTokens || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>AI Token</Text>
                </View>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🎬</Text>
                  <Text style={[styles.quickMetricVal, { color: "#FF9800" }]}>
                    {(selectedDay?.tmdb?.totalRequests || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>TMDB</Text>
                </View>
              </View>
            </View>

            {/* Alan Bazında Grafiksel Tüketim & Maliyet Çizelgesi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📈 Hangi Alan Ne Kadar Kullanıldı? (Grafiksel Dağılım)
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 16 }]}>
                Seçili gün içerisinde modüllerin toplam işlemler içerisindeki grafiksel payı ve birim maliyeti:
              </Text>

              {(() => {
                const dayZones = Object.entries(ZONES).map(([zid, zone]) => {
                  const zData = selectedDay?.zones?.[zid] || { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
                  const totalOps = (zData.reads || 0) + (zData.writes || 0) + (zData.deletes || 0) + (zData.ops || 0);
                  const costTry = (zData.costUsd || 0) * PRICING.usdToTryRate;
                  return {
                    zid,
                    zone,
                    data: zData,
                    totalOps,
                    costUsd: zData.costUsd || 0,
                    costTry,
                  };
                }).sort((a, b) => b.totalOps - a.totalOps || b.costUsd - a.costUsd);

                const maxOps = Math.max(1, ...dayZones.map((z) => z.totalOps));
                const totalDayOps = dayZones.reduce((sum, z) => sum + z.totalOps, 0);

                return dayZones.map((item, idx) => {
                  const percentOfTotal = totalDayOps > 0 ? ((item.totalOps / totalDayOps) * 100).toFixed(1) : "0.0";
                  const barWidthPercent = Math.max(4, Math.round((item.totalOps / maxOps) * 100));

                  return (
                    <View key={item.zid} style={[styles.dailyZoneCard, { backgroundColor: theme.primary, borderColor: item.totalOps > 0 ? item.zone.color + "55" : theme.border }]}>
                      {/* Üst Bilgi Satırı */}
                      <View style={styles.dailyZoneHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <View style={[styles.dailyZoneIconCircle, { backgroundColor: item.zone.color + "22" }]}>
                            <AppIcon family="Ionicons" name={item.zone.icon} size={16} color={item.zone.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[styles.dailyZoneTitle, { color: theme.text?.primary || "#fff" }]}>
                                {item.zone.name}
                              </Text>
                              <View style={[styles.dailyRankPill, { backgroundColor: item.zone.color + "18" }]}>
                                <Text style={[styles.dailyRankPillText, { color: item.zone.color }]}>
                                  %{percentOfTotal}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.dailyZoneMetrics, { color: theme.text?.muted || "#888" }]}>
                              {item.zid === "gemini"
                                ? `${(item.data.tokens || 0).toLocaleString()} Token · ${item.totalOps} İstek`
                                : item.zid === "tmdb"
                                ? `${item.totalOps} Medya İsteği`
                                : `${item.data.reads || 0} Okuma · ${item.data.writes || 0} Yazma · ${item.data.deletes || 0} Silme`}
                            </Text>
                          </View>
                        </View>

                        {/* Sağ Maliyet Değeri */}
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.dailyZoneCostTry, { color: item.costTry > 0 ? (theme.colors?.green || "#29b864") : theme.text?.muted || "#777" }]}>
                            {item.costTry > 0 ? `${item.costTry.toFixed(3)} ₺` : "0.00 ₺"}
                          </Text>
                          <Text style={[styles.dailyZoneCostUsd, { color: theme.text?.muted || "#777" }]}>
                            ${item.costUsd.toFixed(5)}
                          </Text>
                        </View>
                      </View>

                      {/* Görsel İlerleme / Çubuk Çizgisi */}
                      <View style={[styles.dailyBarTrack, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                        <View
                          style={[
                            styles.dailyBarFill,
                            {
                              width: `${barWidthPercent}%`,
                              backgroundColor: item.zone.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                });
              })()}
            </View>

            {/* 24 Saatlik Aktivite Grafiği */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                ⏱️ 24 Saatlik Kullanım Yoğunluğu Grafiği
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                Seçilen gün boyunca işlemlerin saatlere göre dağılımı (Zirve kullanım saatleri):
              </Text>

              {(() => {
                const hourly = selectedDay?.hourlyOps || Array(24).fill(0);
                const maxHourly = Math.max(1, ...hourly);

                return (
                  <View>
                    {/* Saatlik Dikey Çubuklar Grafiği */}
                    <View style={styles.hourlyChartContainer}>
                      {hourly.map((count, hour) => {
                        const heightPercent = Math.max(6, Math.round((count / maxHourly) * 100));
                        const isHigh = count > 0 && count === maxHourly;
                        return (
                          <View key={hour} style={styles.hourlyBarColumn}>
                            <Text
                              style={[
                                styles.hourlyBarValText,
                                {
                                  color: isHigh ? "#FF9800" : count > 0 ? (theme.text?.primary || "#fff") : "transparent",
                                  fontWeight: isHigh ? "900" : "700",
                                },
                              ]}
                            >
                              {count > 0 ? count : ""}
                            </Text>
                            <View style={[styles.hourlyBarBg, { backgroundColor: theme.primary }]}>
                              <View
                                style={[
                                  styles.hourlyBarFill,
                                  {
                                    height: `${heightPercent}%`,
                                    backgroundColor: isHigh ? "#FF9800" : count > 0 ? theme.accent : "rgba(255,255,255,0.08)",
                                  },
                                ]}
                              />
                            </View>
                            <Text
                              style={[
                                styles.hourlyLabel,
                                {
                                  color: isHigh
                                    ? "#FF9800"
                                    : count > 0
                                    ? (theme.text?.primary || "#fff")
                                    : hour % 3 === 0
                                    ? (theme.text?.secondary || "#aaa")
                                    : (theme.text?.muted || "#555"),
                                  fontWeight: isHigh || count > 0 ? "800" : "600",
                                },
                              ]}
                            >
                              {hour % 3 === 0 ? String(hour).padStart(2, "0") : "·"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* 4 Zaman Bloğu Özeti */}
                    <View style={styles.timeBlockGrid}>
                      <View style={[styles.timeBlockCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                        <Text style={[styles.timeBlockTitle, { color: theme.text?.primary || "#fff" }]}>🌙 Gece (00-06)</Text>
                        <Text style={[styles.timeBlockVal, { color: theme.accent }]}>
                          {hourly.slice(0, 6).reduce((a, b) => a + b, 0)} İşlem
                        </Text>
                      </View>
                      <View style={[styles.timeBlockCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                        <Text style={[styles.timeBlockTitle, { color: theme.text?.primary || "#fff" }]}>🌅 Sabah (06-12)</Text>
                        <Text style={[styles.timeBlockVal, { color: "#FF9800" }]}>
                          {hourly.slice(6, 12).reduce((a, b) => a + b, 0)} İşlem
                        </Text>
                      </View>
                      <View style={[styles.timeBlockCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                        <Text style={[styles.timeBlockTitle, { color: theme.text?.primary || "#fff" }]}>☀️ Öğle (12-18)</Text>
                        <Text style={[styles.timeBlockVal, { color: theme.colors?.green || "#29b864" }]}>
                          {hourly.slice(12, 18).reduce((a, b) => a + b, 0)} İşlem
                        </Text>
                      </View>
                      <View style={[styles.timeBlockCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                        <Text style={[styles.timeBlockTitle, { color: theme.text?.primary || "#fff" }]}>🌆 Akşam (18-24)</Text>
                        <Text style={[styles.timeBlockVal, { color: "#C25AFF" }]}>
                          {hourly.slice(18, 24).reduce((a, b) => a + b, 0)} İşlem
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* 7 Günlük Karşılaştırmalı Trend Grafiği */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📅 Son Günlerin Tüketim Trendi
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                Günler arasındaki maliyet ve işlem değişimi:
              </Text>

              {(() => {
                const recentDays = dailyList.slice(0, 7).reverse();
                const maxCost = Math.max(0.01, ...recentDays.map((d) => d.totalCostTry || 0));

                return (
                  <View style={styles.trendChartRow}>
                    {recentDays.map((d) => {
                      const isSelected = d.dateKey === selectedDay?.dateKey;
                      const heightPercent = Math.max(10, Math.round(((d.totalCostTry || 0) / maxCost) * 100));
                      return (
                        <TouchableOpacity
                          key={d.dateKey}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedDayKey(d.dateKey);
                          }}
                          style={[
                            styles.trendColumn,
                            isSelected && { transform: [{ scale: 1.05 }] },
                          ]}
                        >
                          <Text
                            style={[
                              styles.trendCostText,
                              {
                                color: isSelected ? (theme.colors?.green || "#29b864") : (theme.text?.primary || "#fff"),
                                fontWeight: "800",
                              },
                            ]}
                          >
                            {(d.totalCostTry || 0).toFixed(2)}₺
                          </Text>
                          <View style={[styles.trendBarTrack, { backgroundColor: theme.primary, borderColor: isSelected ? theme.accent : "transparent", borderWidth: isSelected ? 1 : 0 }]}>
                            <View
                              style={[
                                styles.trendBarFill,
                                {
                                  height: `${heightPercent}%`,
                                  backgroundColor: isSelected ? theme.accent : (theme.colors?.green || "#29b864"),
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.trendDateText,
                              {
                                color: isSelected ? theme.accent : (theme.text?.secondary || "#ccc"),
                                fontWeight: isSelected ? "900" : "600",
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {d.dateFormatted ? d.dateFormatted.split(" ")[0] + " " + (d.dateFormatted.split(" ")[1]?.slice(0, 3) || "") : d.dateKey.slice(5)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          </View>
        )}

        {/* ── 3. BÖLGELER & MODÜL ANALİZİ SEKMESİ ───────────────────────────── */}
        {activeTab === "zones" && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📍 Modüler Alan & Bölge Tüketimi
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc" }]}>
                Uygulamanın hangi ekranının veya özelliğinin ne kadar okuma/yazma yaptığını buradan tespit edebilirsiniz:
              </Text>

              {Object.entries(ZONES).map(([zoneKey, zone]) => {
                const zoneData = stats.firestore.zones?.[zoneKey] || { reads: 0, writes: 0, deletes: 0 };
                const totalOps = zoneData.reads + zoneData.writes + zoneData.deletes;
                const estCost = ((zoneData.reads / 1e5) * PRICING.firestoreReadPer100k) +
                                ((zoneData.writes / 1e5) * PRICING.firestoreWritePer100k) +
                                ((zoneData.deletes / 1e5) * PRICING.firestoreDeletePer100k);

                return (
                  <View
                    key={zoneKey}
                    style={[
                      styles.zoneCard,
                      { backgroundColor: theme.primary, borderColor: totalOps > 0 ? zone.color + "66" : theme.border },
                    ]}
                  >
                    {/* Başlık ve Risk Rozeti */}
                    <View style={styles.zoneHeader}>
                      <View style={styles.zoneTitleRow}>
                        <AppIcon family="Ionicons" name={zone.icon} size={18} color={zone.color} />
                        <Text style={[styles.zoneName, { color: theme.text?.primary || "#fff" }]}>{zone.name}</Text>
                      </View>
                      <View style={[styles.riskTag, { backgroundColor: zone.color + "20", borderColor: zone.color }]}>
                        <Text style={[styles.riskTagText, { color: zone.color }]}>{zone.riskLevel}</Text>
                      </View>
                    </View>

                    <Text style={[styles.zoneDesc, { color: theme.text?.muted || "#888" }]}>{zone.description}</Text>

                    {/* Sayaçlar */}
                    <View style={styles.zoneCounters}>
                      <View style={styles.zoneCounterBox}>
                        <Text style={[styles.zoneCounterVal, { color: "#FF9800" }]}>{zoneData.reads}</Text>
                        <Text style={[styles.zoneCounterLbl, { color: theme.text?.muted || "#777" }]}>Okuma</Text>
                      </View>
                      <View style={styles.zoneCounterBox}>
                        <Text style={[styles.zoneCounterVal, { color: "#4CAF50" }]}>{zoneData.writes}</Text>
                        <Text style={[styles.zoneCounterLbl, { color: theme.text?.muted || "#777" }]}>Yazma</Text>
                      </View>
                      <View style={styles.zoneCounterBox}>
                        <Text style={[styles.zoneCounterVal, { color: "#E91E63" }]}>{zoneData.deletes}</Text>
                        <Text style={[styles.zoneCounterLbl, { color: theme.text?.muted || "#777" }]}>Silme</Text>
                      </View>
                      <View style={styles.zoneCounterBox}>
                        <Text style={[styles.zoneCounterVal, { color: theme.accent }]}>${estCost.toFixed(5)}</Text>
                        <Text style={[styles.zoneCounterLbl, { color: theme.text?.muted || "#777" }]}>Tahmini</Text>
                      </View>
                    </View>

                    {/* Optimizasyon İpucu */}
                    <View style={styles.zoneOptBox}>
                      <Text style={[styles.zoneOptText, { color: theme.text?.secondary || "#ccc" }]}>
                        💡 <Text style={{ fontWeight: "700" }}>Tavsiye:</Text> {zone.riskDesc}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── 3. GEMINI AI SEKMESİ ─────────────────────────────────────────── */}
        {activeTab === "gemini" && (
          <View style={styles.tabContent}>
            {/* AI Kokpit Hero Kartı */}
            <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.statusDot, { backgroundColor: "#C25AFF" }]} />
                  <Text style={[styles.heroLabel, { color: theme.text?.muted || "#888" }]}>
                    GEMINI 2.5 FLASH ASİSTAN KOKPİTİ
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: "#C25AFF18", borderColor: "#C25AFF44" }]}>
                  <Text style={[styles.statusPillText, { color: "#C25AFF" }]}>
                    CineMatch Pro
                  </Text>
                </View>
              </View>

              <View style={styles.heroPriceRow}>
                <Text style={[styles.heroPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                  ${(stats.gemini.totalCostUsd || 0) < 0.01 ? (stats.gemini.totalCostUsd || 0).toFixed(5) : (stats.gemini.totalCostUsd || 0).toFixed(3)}
                </Text>
                <Text style={[styles.heroPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                  ≈ {((stats.gemini.totalCostUsd || 0) * PRICING.usdToTryRate).toFixed(4)} ₺
                </Text>
              </View>

              {/* 4'lü Hızlı Sayaç Izgarası */}
              <View style={styles.quickMetricsGrid}>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                  <Text style={[styles.quickMetricVal, { color: "#C25AFF" }]}>
                    {stats.gemini.requests}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>İstek</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📥</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.accent }]}>
                    {stats.gemini.promptTokens.toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Giriş Token</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📤</Text>
                  <Text style={[styles.quickMetricVal, { color: "#FF9800" }]}>
                    {(stats.gemini.outputTokens + (stats.gemini.thoughtsTokens || 0)).toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Çıkış Token</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.colors?.green || "#29b864" }]}>
                    {stats.gemini.requests > 0 ? Math.round(stats.gemini.totalTokens / stats.gemini.requests).toLocaleString() : 0}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Ort. Token</Text>
                </View>
              </View>
            </View>

            {/* Giriş vs. Çıkış Token Ekonomisi (4x Fiyat Ayrımı) */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                  ⚖️ Giriş vs. Çıkış Token Dağılımı
                </Text>
                <View style={[styles.hotspotLiveBadge, { backgroundColor: "#FF980018", borderColor: "#FF980044" }]}>
                  <Text style={[styles.hotspotLiveBadgeText, { color: "#FF9800" }]}>ÇIKIŞ 4X PAHALI</Text>
                </View>
              </View>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                Gemini modellerinde üretilen yanıt (çıkış) token'ları, girdi (prompt) token'larına göre 4 kat daha yüksek birim maliyete sahiptir:
              </Text>

              {/* Çift Renkli Token Oran Barı */}
              {(() => {
                const totalTokens = Math.max(1, stats.gemini.totalTokens);
                const promptPct = Math.round((stats.gemini.promptTokens / totalTokens) * 100);
                const outputPct = Math.round(((stats.gemini.outputTokens + (stats.gemini.thoughtsTokens || 0)) / totalTokens) * 100);

                return (
                  <View>
                    <View style={styles.dualBarContainer}>
                      <View style={[styles.dualBarBg, { height: 10, borderRadius: 5 }]}>
                        {promptPct > 0 && (
                          <View style={[styles.dualBarSegment, { width: `${promptPct}%`, backgroundColor: theme.accent }]} />
                        )}
                        {outputPct > 0 && (
                          <View style={[styles.dualBarSegment, { width: `${outputPct}%`, backgroundColor: "#FF9800" }]} />
                        )}
                      </View>
                    </View>

                    {/* Yan Yana İki Kart */}
                    <View style={[styles.aiMetricRow, { marginTop: 12 }]}>
                      {/* Giriş Kartı */}
                      <View style={[styles.aiMetricBox, { backgroundColor: theme.primary, borderColor: theme.accent + "55" }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <View style={[styles.microDot, { backgroundColor: theme.accent }]} />
                          <Text style={[styles.aiBoxHeader, { color: theme.accent }]}>GİRİŞ / PROMPT (%{promptPct})</Text>
                        </View>
                        <Text style={[styles.aiMetricBoxVal, { color: theme.text?.primary || "#fff" }]}>
                          {stats.gemini.promptTokens.toLocaleString()}
                        </Text>
                        <Text style={[styles.aiMetricBoxLabel, { color: theme.colors?.green || "#29b864" }]}>
                          ${(stats.gemini.promptCostUsd || 0).toFixed(5)} (≈ {((stats.gemini.promptCostUsd || 0) * PRICING.usdToTryRate).toFixed(3)} ₺)
                        </Text>
                        <Text style={[styles.aiUnitText, { color: theme.text?.muted || "#888" }]}>$0.15 / 1M token (Ucuz)</Text>
                      </View>

                      {/* Çıkış Kartı */}
                      <View style={[styles.aiMetricBox, { backgroundColor: theme.primary, borderColor: "#FF980055" }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <View style={[styles.microDot, { backgroundColor: "#FF9800" }]} />
                          <Text style={[styles.aiBoxHeader, { color: "#FF9800" }]}>ÇIKIŞ / YANIT (%{outputPct})</Text>
                        </View>
                        <Text style={[styles.aiMetricBoxVal, { color: theme.text?.primary || "#fff" }]}>
                          {(stats.gemini.outputTokens + (stats.gemini.thoughtsTokens || 0)).toLocaleString()}
                        </Text>
                        <Text style={[styles.aiMetricBoxLabel, { color: "#FF9800" }]}>
                          ${(stats.gemini.outputCostUsd || 0).toFixed(5)} (≈ {((stats.gemini.outputCostUsd || 0) * PRICING.usdToTryRate).toFixed(3)} ₺)
                        </Text>
                        <Text style={[styles.aiUnitText, { color: "#FF9800" }]}>$0.60 / 1M token (4x Pahalı)</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Model Bazlı Tüketim & Kota Kartı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                🧠 Aktif Gemini Modelleri & Tüketim
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                Uygulama genelinde çağrılan yapay zeka modelleri ve harcamaları:
              </Text>

              {Object.entries(GEMINI_MODELS).map(([mKey, mData]) => {
                const tracked = stats.gemini.models?.[mKey] || { requests: 0, promptTokens: 0, outputTokens: 0, tokens: 0, costUsd: 0 };
                const isDefault = mKey === "gemini-2.5-flash";
                const activeOps = tracked.requests || (isDefault ? stats.gemini.requests : 0);
                const activeTokens = tracked.tokens || (isDefault ? stats.gemini.totalTokens : 0);
                const activeCostUsd = tracked.costUsd || (isDefault ? (stats.gemini.totalCostUsd || 0) : 0);

                return (
                  <View key={mKey} style={[styles.modernHotspotCard, { backgroundColor: theme.primary, borderColor: isDefault ? "#C25AFF55" : theme.border }]}>
                    <View style={styles.modernHotspotTopRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={[styles.modernHotspotIconWrap, { backgroundColor: "#C25AFF20", borderColor: "#C25AFF44" }]}>
                          <AppIcon family="Ionicons" name="sparkles" size={18} color="#C25AFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.modernHotspotName, { color: theme.text?.primary || "#fff" }]}>
                              {mData.name}
                            </Text>
                            {isDefault && (
                              <View style={[styles.modernMedalBadge, { backgroundColor: "#C25AFF20" }]}>
                                <Text style={[styles.modernMedalText, { color: "#C25AFF" }]}>Varsayılan</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.modernHotspotSub, { color: theme.text?.muted || "#888" }]}>
                            {mData.description}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.modernHotspotPercent, { color: theme.colors?.green || "#29b864" }]}>
                          {(activeCostUsd * PRICING.usdToTryRate).toFixed(3)} ₺
                        </Text>
                        <Text style={[styles.modernHotspotTotalOps, { color: theme.text?.muted || "#888" }]}>
                          ${activeCostUsd.toFixed(5)}
                        </Text>
                      </View>
                    </View>

                    {/* Alt Mikro-Metrikler */}
                    <View style={styles.modernHotspotFooter}>
                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <Text style={{ fontSize: 10 }}>🤖</Text>
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>İstek:</Text>
                        <Text style={[styles.microMetricVal, { color: theme.text?.primary || "#fff" }]}>{activeOps}</Text>
                      </View>

                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <Text style={{ fontSize: 10 }}>⚡</Text>
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Toplam Token:</Text>
                        <Text style={[styles.microMetricVal, { color: theme.accent }]}>{activeTokens.toLocaleString()}</Text>
                      </View>

                      <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                        <Text style={{ fontSize: 10 }}>🏷️</Text>
                        <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Tarife:</Text>
                        <Text style={[styles.microMetricVal, { color: "#FF9800" }]}>${mData.inputPricePerMillion} / ${mData.outputPricePerMillion}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* AI Optimizasyon & Mimari Karnesi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                💡 Gemini AI Canlı Optimizasyon Karnesi
              </Text>

              <View style={styles.auditRow}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>12 Mesajlık Bağlam Sınırı</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Sohbet geçmişi en fazla 12 mesajla kırpılarak gereksiz token tüketimi %60 oranında azaltılıyor.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Kısa JSON Çıktı Formatı</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    4 kat daha pahalı olan yanıt token'ları yalnızca film kimlikleri ve kısa öneri gerekçesiyle sınırlandırıldı.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Google AI Studio Ücretsiz Kotası</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Günde 1.500 istek ve dakikada 15 istek sınırı aşılmadığı sürece faturaya 0 TL yansır.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── 4. TMDB & SWR SEKMESİ ─────────────────────────────────────────── */}
        {activeTab === "tmdb" && (
          <View style={styles.tabContent}>
            {/* TMDB Hero Kartı */}
            <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.statusDot, { backgroundColor: "#01D277" }]} />
                  <Text style={[styles.heroLabel, { color: theme.text?.muted || "#888" }]}>
                    TMDB MEDYA VE SWR ÖNBELLEK MERKEZİ
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: "#01D27718", borderColor: "#01D27744" }]}>
                  <Text style={[styles.statusPillText, { color: "#01D277" }]}>
                    %100 Ücretsiz API
                  </Text>
                </View>
              </View>

              <View style={styles.heroPriceRow}>
                <Text style={[styles.heroPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                  %{costs.tmdb.cacheEfficiency}
                </Text>
                <Text style={[styles.heroPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                  Önbellek Başarı Oranı
                </Text>
              </View>

              {/* 4'lü Hızlı Sayaç Izgarası */}
              <View style={styles.quickMetricsGrid}>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🌐</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.accent }]}>
                    {stats.tmdb?.totalRequests || 0}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Toplam İstek</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.colors?.green || "#29b864" }]}>
                    {stats.tmdb?.cachedRequests || 0}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>SWR Bellek</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📡</Text>
                  <Text style={[styles.quickMetricVal, { color: "#FF9800" }]}>
                    {stats.tmdb?.networkRequests || 0}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Ağ (HTTP)</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>💰</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.colors?.green || "#29b864" }]}>
                    0.00 ₺
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Aylık Maliyet</Text>
                </View>
              </View>
            </View>

            {/* SWR Önbellek vs. Ağ Karşılaştırma Grafiği */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                  📊 SWR Önbellek & Ağ Dağılımı
                </Text>
                <View style={[styles.hotspotLiveBadge, { backgroundColor: "#01D27718", borderColor: "#01D27744" }]}>
                  <Text style={[styles.hotspotLiveBadgeText, { color: "#01D277" }]}>0 MS GECİKME</Text>
                </View>
              </View>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                MMKV bellek önbelleği sayesinde tekrarlayan istekler doğrudan telefondan karşılanır, internete çıkış yapılmaz:
              </Text>

              {/* Çift Renkli Bar */}
              <View style={styles.dualBarContainer}>
                <View style={[styles.dualBarBg, { height: 10, borderRadius: 5 }]}>
                  <View
                    style={[
                      styles.dualBarSegment,
                      {
                        width: `${Math.max(1, costs.tmdb.cacheEfficiency)}%`,
                        backgroundColor: theme.colors?.green || "#29b864",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.dualBarSegment,
                      {
                        width: `${Math.max(0, 100 - costs.tmdb.cacheEfficiency)}%`,
                        backgroundColor: "#FF9800",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* İki Detay Kartı */}
              <View style={[styles.aiMetricRow, { marginTop: 12 }]}>
                <View style={[styles.aiMetricBox, { backgroundColor: theme.primary, borderColor: (theme.colors?.green || "#29b864") + "55" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[styles.microDot, { backgroundColor: theme.colors?.green || "#29b864" }]} />
                    <Text style={[styles.aiBoxHeader, { color: theme.colors?.green || "#29b864" }]}>SWR BELLEK (%{costs.tmdb.cacheEfficiency})</Text>
                  </View>
                  <Text style={[styles.aiMetricBoxVal, { color: theme.text?.primary || "#fff" }]}>
                    {stats.tmdb?.cachedRequests || 0} İstek
                  </Text>
                  <Text style={[styles.aiMetricBoxLabel, { color: theme.colors?.green || "#29b864" }]}>
                    0 ms Gecikme · $0 Maliyet
                  </Text>
                  <Text style={[styles.aiUnitText, { color: theme.text?.muted || "#888" }]}>Cihaz İçi MMKV Depolama</Text>
                </View>

                <View style={[styles.aiMetricBox, { backgroundColor: theme.primary, borderColor: "#FF980055" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[styles.microDot, { backgroundColor: "#FF9800" }]} />
                    <Text style={[styles.aiBoxHeader, { color: "#FF9800" }]}>AĞ / HTTP (%{(100 - costs.tmdb.cacheEfficiency).toFixed(0)})</Text>
                  </View>
                  <Text style={[styles.aiMetricBoxVal, { color: theme.text?.primary || "#fff" }]}>
                    {stats.tmdb?.networkRequests || 0} İstek
                  </Text>
                  <Text style={[styles.aiMetricBoxLabel, { color: "#FF9800" }]}>
                    ~120 ms Yanıt Süresi
                  </Text>
                  <Text style={[styles.aiUnitText, { color: "#FF9800" }]}>TMDB API Sunucusu</Text>
                </View>
              </View>
            </View>

            {/* Performans & Tasarruf Karnesi */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                🚀 SWR Önbellek Tasarruf Karnesi
              </Text>

              <View style={styles.auditRow}>
                <Text style={{ fontSize: 16 }}>⚡</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Kullanıcı Bekleme Süresi Kazancı</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Önbellek sayesinde toplam yaklaşık {(((stats.tmdb?.cachedRequests || 0) * 150) / 1000).toFixed(1)} saniye bekleme süresi ortadan kaldırıldı.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>📶</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Tasarruf Edilen İnternet Trafiği</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Tekrarlayan film/dizi verileri için yaklaşık {(((stats.tmdb?.cachedRequests || 0) * 25) / 1024).toFixed(2)} MB hücresel veri tasarrufu sağlandı.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🛡️</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>TMDB Hız Sınırı Koruması</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Saniyede 40-50 istek sınırına takılmadan akıcı bir liste kaydırma deneyimi sunuluyor.
                  </Text>
                </View>
              </View>
            </View>

            {/* Son TMDB İstekleri Akışı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📡 Son Yapılan TMDB İstekleri (Canlı)
              </Text>
              {(() => {
                const tmdbLogs = (stats.recentLogs || []).filter((l) => l.zone === "tmdb").slice(0, 6);
                if (tmdbLogs.length === 0) {
                  return (
                    <Text style={{ color: theme.text?.muted || "#777", marginTop: 6, fontStyle: "italic" }}>
                      Henüz kaydedilmiş TMDB isteği bulunmuyor.
                    </Text>
                  );
                }
                return tmdbLogs.map((log) => {
                  const isCached = log.title?.includes("Önbellek") || log.title?.includes("SWR");
                  return (
                    <View key={log.id} style={[styles.hotspotRow, { borderColor: theme.border }]}>
                      <View style={[styles.modernHotspotIconWrap, { backgroundColor: isCached ? "#01D27720" : "#FF980020", borderColor: isCached ? "#01D27744" : "#FF980044" }]}>
                        <AppIcon family="Ionicons" name={isCached ? "flash" : "cloud-download"} size={16} color={isCached ? "#01D277" : "#FF9800"} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.modernHotspotName, { color: theme.text?.primary || "#fff" }]}>
                          {log.detail || log.title}
                        </Text>
                        <Text style={[styles.modernHotspotSub, { color: theme.text?.muted || "#888" }]}>
                          {log.dateStr ? `${log.dateStr} ` : ""}{log.timeStr || new Date(log.time).toLocaleTimeString("tr-TR")}
                        </Text>
                      </View>
                      <View style={[styles.modernMedalBadge, { backgroundColor: isCached ? "#01D27720" : "#FF980020" }]}>
                        <Text style={[styles.modernMedalText, { color: isCached ? "#01D277" : "#FF9800" }]}>
                          {isCached ? "⚡ SWR" : "📡 Ağ"}
                        </Text>
                      </View>
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        )}

        {/* ── 5. FIRESTORE KOLEKSİYONLARI ───────────────────────────────────── */}
        {activeTab === "firestore" && (
          <View style={styles.tabContent}>
            {/* Firestore Hero Kartı */}
            <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.statusDot, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.heroLabel, { color: theme.text?.muted || "#888" }]}>
                    CLOUD FIRESTORE DÖKÜMAN KOKPİTİ
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={[styles.statusPillText, { color: theme.accent }]}>
                    🎁 0.00 ₺ (Kota İçi)
                  </Text>
                </View>
              </View>

              <View style={styles.heroPriceRow}>
                <Text style={[styles.heroPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                  {(stats.firestore.reads + stats.firestore.writes + stats.firestore.deletes).toLocaleString()}
                </Text>
                <Text style={[styles.heroPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                  Toplam Döküman İşlemi
                </Text>
              </View>

              {/* 3'lü Hızlı Sayaç Izgarası */}
              <View style={styles.quickMetricsGrid}>
                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>📖</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.accent }]}>
                    {stats.firestore.reads.toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Okuma (50K)</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>✍️</Text>
                  <Text style={[styles.quickMetricVal, { color: theme.colors?.green || "#29b864" }]}>
                    {stats.firestore.writes.toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Yazma (20K)</Text>
                </View>

                <View style={[styles.quickMetricCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 14 }}>🗑️</Text>
                  <Text style={[styles.quickMetricVal, { color: "#FF3B30" }]}>
                    {stats.firestore.deletes.toLocaleString()}
                  </Text>
                  <Text style={[styles.quickMetricLbl, { color: theme.text?.muted || "#888" }]}>Silme (20K)</Text>
                </View>
              </View>
            </View>

            {/* Koleksiyon Bazlı Derinlemesine Analiz Kartları */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                📁 Koleksiyon Bazlı Döküman Analizi
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                Veritabanınızdaki her bir koleksiyonun toplam tüketimdeki payı, okuma/yazma dengesi ve birim maliyeti:
              </Text>

              {(() => {
                const colEntries = Object.entries(stats.firestore.collections || {});
                if (colEntries.length === 0) {
                  return (
                    <Text style={{ color: theme.text?.muted || "#777", marginTop: 8, fontStyle: "italic" }}>
                      Henüz koleksiyon işlemi kaydedilmedi.
                    </Text>
                  );
                }

                const totalAllOps = Math.max(1, stats.firestore.reads + stats.firestore.writes + stats.firestore.deletes);
                const sortedCols = colEntries
                  .map(([col, data]) => {
                    const reads = data.reads || 0;
                    const writes = data.writes || 0;
                    const deletes = data.deletes || 0;
                    const totalOps = reads + writes + deletes;
                    const costUsd = ((reads / 1e5) * PRICING.firestoreReadPer100k) + ((writes / 1e5) * PRICING.firestoreWritePer100k);
                    const costTry = costUsd * PRICING.usdToTryRate;
                    return { col, reads, writes, deletes, totalOps, costUsd, costTry };
                  })
                  .sort((a, b) => b.totalOps - a.totalOps);

                return sortedCols.map((item, idx) => {
                  const percentOfTotal = ((item.totalOps / totalAllOps) * 100).toFixed(1);
                  const readPct = item.totalOps > 0 ? Math.round((item.reads / item.totalOps) * 100) : 0;
                  const writePct = item.totalOps > 0 ? Math.round((item.writes / item.totalOps) * 100) : 0;
                  const deletePct = item.totalOps > 0 ? Math.round((item.deletes / item.totalOps) * 100) : 0;

                  return (
                    <View key={item.col} style={[styles.modernHotspotCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                      {/* Başlık Satırı */}
                      <View style={styles.modernHotspotTopRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View style={[styles.modernHotspotIconWrap, { backgroundColor: theme.accent + "20", borderColor: theme.accent + "44" }]}>
                            <AppIcon family="Ionicons" name="folder-open" size={18} color={theme.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[styles.modernHotspotName, { color: theme.text?.primary || "#fff" }]}>
                                {item.col}
                              </Text>
                              <View style={[styles.modernMedalBadge, { backgroundColor: theme.accent + "18" }]}>
                                <Text style={[styles.modernMedalText, { color: theme.accent }]}>
                                  %{percentOfTotal} Pay
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.modernHotspotSub, { color: theme.text?.muted || "#888" }]}>
                              Toplam {item.totalOps.toLocaleString()} Döküman İşlemi
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.modernHotspotPercent, { color: theme.colors?.green || "#29b864" }]}>
                            {item.costTry > 0 ? `${item.costTry.toFixed(3)} ₺` : "0.00 ₺"}
                          </Text>
                          <Text style={[styles.modernHotspotTotalOps, { color: theme.text?.muted || "#888" }]}>
                            ${item.costUsd.toFixed(5)}
                          </Text>
                        </View>
                      </View>

                      {/* 3 Segmentli İlerleme Çubuğu */}
                      <View style={styles.dualBarContainer}>
                        <View style={[styles.dualBarBg, { height: 7, borderRadius: 3.5 }]}>
                          {readPct > 0 && (
                            <View style={[styles.dualBarSegment, { width: `${readPct}%`, backgroundColor: theme.accent }]} />
                          )}
                          {writePct > 0 && (
                            <View style={[styles.dualBarSegment, { width: `${writePct}%`, backgroundColor: theme.colors?.green || "#29b864" }]} />
                          )}
                          {deletePct > 0 && (
                            <View style={[styles.dualBarSegment, { width: `${deletePct}%`, backgroundColor: "#FF3B30" }]} />
                          )}
                        </View>
                      </View>

                      {/* Alt 3 Mikro Rozet */}
                      <View style={styles.modernHotspotFooter}>
                        <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                          <View style={[styles.microDot, { backgroundColor: theme.accent }]} />
                          <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Okuma:</Text>
                          <Text style={[styles.microMetricVal, { color: theme.text?.primary || "#fff" }]}>
                            {item.reads.toLocaleString()} (%{readPct})
                          </Text>
                        </View>

                        <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                          <View style={[styles.microDot, { backgroundColor: theme.colors?.green || "#29b864" }]} />
                          <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Yazma:</Text>
                          <Text style={[styles.microMetricVal, { color: theme.text?.primary || "#fff" }]}>
                            {item.writes.toLocaleString()} (%{writePct})
                          </Text>
                        </View>

                        <View style={[styles.microMetricChip, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                          <View style={[styles.microDot, { backgroundColor: "#FF3B30" }]} />
                          <Text style={[styles.microMetricLabel, { color: theme.text?.muted || "#888" }]}>Silme:</Text>
                          <Text style={[styles.microMetricVal, { color: "#FF3B30" }]}>
                            {item.deletes.toLocaleString()} (%{deletePct})
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                });
              })()}
            </View>

            {/* Firestore Optimizasyon & İpuçları */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                ⚡ Firestore Mimari & İndeks İpuçları
              </Text>

              <View style={styles.auditRow}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Sayfalı Yükleme (Pagination: 15-20)</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    Listeler ve sosyal akışta `limit(15)` uygulanarak tek seferde binlerce döküman okunması engelleniyor.
                  </Text>
                </View>
              </View>

              <View style={[styles.auditRow, { marginTop: 10 }]}>
                <Text style={{ fontSize: 16 }}>🟢</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.auditTitle, { color: theme.text?.primary || "#fff" }]}>Toplu Yazma (writeBatch)</Text>
                  <Text style={[styles.auditDesc, { color: theme.text?.secondary || "#ccc" }]}>
                    İzleme geçmişi ve çoklu liste güncellemelerinde batch kullanarak ağ gecikmesi en aza indirgeniyor.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── 6. TÜM SERVİSLER & EKOSİSTEM MALİYET HARİTASI ───────────────────── */}
        {activeTab === "ecosystem" && (
          <View style={styles.tabContent}>
            {/* Üst Bilgilendirme Kartı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <View style={[styles.statusDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                  🌐 Tüm Ekosistem Servisleri & Maliyet Haritası
                </Text>
              </View>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc" }]}>
                Uygulamanın kullandığı tüm harici platformlar, mağaza üyelikleri, veritabanı kotaları ve fiyatlandırma politikaları:
              </Text>
            </View>

            {/* 8 Ana Ekosistem Servisi Kartları */}
            {Object.values(ALL_ECOSYSTEM_SERVICES).map((srv) => (
              <View
                key={srv.id}
                style={[
                  styles.ecosystemServiceCard,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: srv.color + "44",
                  },
                ]}
              >
                {/* Servis Başlık Satırı */}
                <View style={styles.ecosystemHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View style={[styles.ecosystemIconWrap, { backgroundColor: srv.color + "22", borderColor: srv.color + "55" }]}>
                      <AppIcon family="Ionicons" name={srv.icon} size={20} color={srv.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ecosystemName, { color: theme.text?.primary || "#fff" }]}>
                        {srv.name}
                      </Text>
                      <Text style={[styles.ecosystemCategory, { color: theme.text?.muted || "#888" }]}>
                        {srv.category}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.ecosystemBadge, { backgroundColor: (srv.badgeColor || theme.accent) + "22", borderColor: (srv.badgeColor || theme.accent) + "55" }]}>
                    <Text style={[styles.ecosystemBadgeText, { color: srv.badgeColor || theme.accent }]}>
                      {srv.badge}
                    </Text>
                  </View>
                </View>

                {/* Fiyatlandırma Satırı */}
                <View style={[styles.ecosystemPriceRow, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ecosystemPriceLabel, { color: theme.text?.muted || "#888" }]}>Birim Fiyatlandırma:</Text>
                    <Text style={[styles.ecosystemPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                      {srv.pricingUsd}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.ecosystemPriceLabel, { color: theme.text?.muted || "#888" }]}>TL Karşılığı ($1=50₺):</Text>
                    <Text style={[styles.ecosystemPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                      {srv.pricingTry}
                    </Text>
                  </View>
                </View>

                {/* Kotalar & Sınırlar Kutusu */}
                <View style={[styles.ecosystemQuotaBox, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <View style={styles.ecosystemQuotaRow}>
                    <Text style={{ fontSize: 13 }}>🎁</Text>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={[styles.ecosystemQuotaLabel, { color: theme.text?.secondary || "#ccc" }]}>Ücretsiz Katman (Free Tier):</Text>
                      <Text style={[styles.ecosystemQuotaVal, { color: theme.accent }]}>
                        {srv.freeQuota}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.ecosystemQuotaRow, { marginTop: 8 }]}>
                    <Text style={{ fontSize: 13 }}>⚠️</Text>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={[styles.ecosystemQuotaLabel, { color: theme.text?.secondary || "#ccc" }]}>Limitler & Kota Aşımı:</Text>
                      <Text style={[styles.ecosystemQuotaVal, { color: "#FF9800" }]}>
                        {srv.limits}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Mimari Not & Tavsiye */}
                <View style={styles.ecosystemNotesBox}>
                  <Text style={[styles.ecosystemNotesText, { color: theme.text?.secondary || "#bbb" }]}>
                    💡 {srv.notes}
                  </Text>
                </View>
              </View>
            ))}

            {/* Firebase Alt Servisleri & Limitleri Kartı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                🔥 Firebase No-Cost Tier Resmi Limitleri
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                Google Blaze planında bu kotalara kadar fatura 0.00 TL kesilir:
              </Text>

              {Object.entries(FIREBASE_LIMITS).map(([fKey, fData]) => (
                <View key={fKey} style={[styles.firebaseLimitCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <Text style={[styles.firebaseLimitTitle, { color: theme.text?.primary || "#fff" }]}>
                    {fData.name}
                  </Text>
                  <View style={styles.firebaseLimitGrid}>
                    {Object.entries(fData.freeTier).map(([k, val]) => (
                      <View key={k} style={styles.firebaseLimitItem}>
                        <Text style={[styles.firebaseLimitItemKey, { color: theme.text?.muted || "#888" }]}>{k}:</Text>
                        <Text style={[styles.firebaseLimitItemVal, { color: theme.accent }]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {/* Gemini AI Modelleri Fiyatlandırma Kartı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                ✨ Gemini AI Modelleri Token Maliyetleri
              </Text>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                1 Milyon Token başına resmi Google AI Studio ücret tarifesi:
              </Text>

              {Object.entries(GEMINI_MODELS).map(([mKey, mData]) => (
                <View key={mKey} style={[styles.geminiModelPriceCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.geminiModelPriceName, { color: theme.text?.primary || "#fff" }]}>
                      {mData.name}
                    </Text>
                    <View style={[styles.modelRatioPill, { backgroundColor: "#C25AFF20" }]}>
                      <Text style={{ fontSize: 10, color: "#C25AFF", fontWeight: "800" }}>
                        Çıkış 4x Pahalı
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.geminiModelPriceDesc, { color: theme.text?.muted || "#888" }]}>
                    {mData.description}
                  </Text>
                  <View style={styles.geminiTokenPriceRow}>
                    <Text style={[styles.geminiTokenPriceItem, { color: theme.accent }]}>
                      Giriş: ${mData.inputPricePerMillion} / 1M (≈ {(mData.inputPricePerMillion * PRICING.usdToTryRate).toFixed(1)} ₺)
                    </Text>
                    <Text style={[styles.geminiTokenPriceItem, { color: "#C25AFF" }]}>
                      Çıkış: ${mData.outputPricePerMillion} / 1M (≈ {(mData.outputPricePerMillion * PRICING.usdToTryRate).toFixed(1)} ₺)
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 7. CANLI LOG SEKMESİ (GRUPLU & AKORDEON GÖRÜNÜM) ────────────────── */}
        {activeTab === "logs" && (
          <View style={styles.tabContent}>
            {/* Log Başlık ve Hızlı Eylem Kartı */}
            <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 2 }]}>
                    📜 Canlı İşlemler & Alan Defteri
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.text?.muted || "#888" }}>
                    Toplam {stats.recentLogs?.length || 0} İşlem · {totalLogDocs.totalReads.toLocaleString()} Okuma · {totalLogDocs.totalWrites.toLocaleString()} Yazma · {totalLogDocs.totalDeletes.toLocaleString()} Silme
                  </Text>
                </View>

                {/* Hızlı Aç / Kapa Butonları */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={expandAllLogGroups}
                    style={[styles.miniActionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                  >
                    <Text style={[styles.miniActionBtnText, { color: theme.accent }]}>Tümünü Aç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={collapseAllLogGroups}
                    style={[styles.miniActionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                  >
                    <Text style={[styles.miniActionBtnText, { color: theme.text?.secondary || "#aaa" }]}>Kapat</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginTop: 8, marginBottom: 0 }]}>
                Aşağıdaki alan kartlarına dokunarak o bölgede gerçekleşen tüm okuma, yazma, Gemini AI ve API işlemlerini açıp kapatabilirsiniz:
              </Text>
            </View>

            {/* Gruplanmış Alan Kartları (Akordeon) */}
            {Object.values(groupedLogs).map((group) => {
              const isExpanded = !!expandedLogGroups[group.id];
              const logCount = group.logs.length;
              const hasLogs = logCount > 0;

              return (
                <View
                  key={group.id}
                  style={[
                    styles.logGroupCard,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: hasLogs ? group.color + "55" : theme.border,
                    },
                  ]}
                >
                  {/* Grup Başlığı (Dokunulabilir Akordeon) */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => toggleLogGroup(group.id)}
                    style={styles.logGroupHeader}
                  >
                    <View style={styles.logGroupTitleRow}>
                      <View style={[styles.logGroupIconCircle, { backgroundColor: group.color + "22" }]}>
                        <AppIcon family="Ionicons" name={group.icon} size={18} color={group.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.logGroupTitle, { color: theme.text?.primary || "#fff" }]}>
                            {group.name}
                          </Text>
                          <View style={[styles.logGroupOpsBadge, { backgroundColor: group.color + "18", borderColor: group.color + "44" }]}>
                            <Text style={[styles.logGroupOpsBadgeText, { color: group.color }]}>
                              {logCount} İşlem
                            </Text>
                          </View>
                        </View>

                        {/* Alt Özet Bilgisi (Grup bazında toplamlar) */}
                        <Text style={[styles.logGroupSubtotalText, { color: theme.text?.muted || "#888" }]}>
                          {group.id === "gemini"
                            ? `${group.requests || 0} İstek · $${(group.totalCostUsd || 0).toFixed(5)}`
                            : group.id === "tmdb"
                            ? `${group.totalRequests || 0} API İsteği`
                            : group.id === "notifications"
                            ? `${group.calls || 0} Function Çağrısı`
                            : `${(group.reads || 0).toLocaleString()} Okuma · ${(group.writes || 0).toLocaleString()} Yazma · ${(group.deletes || 0).toLocaleString()} Silme (${logCount} İşlem)`}
                        </Text>
                      </View>
                    </View>

                    {/* Sağ Akordeon Oku */}
                    <View style={[styles.logGroupChevron, { backgroundColor: group.color + "15" }]}>
                      <AppIcon
                        family="Ionicons"
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={group.color}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Genişletilmiş İçerik Listesi */}
                  {isExpanded && (
                    <View style={[styles.logGroupBody, { borderColor: theme.border }]}>
                      {!hasLogs ? (
                        <Text style={[styles.emptyGroupText, { color: theme.text?.muted || "#777" }]}>
                          Bu alanda henüz işlem kaydedilmedi.
                        </Text>
                      ) : (
                        group.logs.map((log) => {
                          let docCount = typeof log.docCount === "number" ? log.docCount : 1;
                          if (docCount === 1 && typeof log.detail === "string" && log.detail.startsWith("+")) {
                            const parsed = parseInt(log.detail.slice(1), 10);
                            if (!isNaN(parsed) && parsed > 0) docCount = parsed;
                          }
                          return (
                            <View key={log.id} style={[styles.logDetailItem, { borderColor: theme.border }]}>
                              <View style={[styles.logDot, { backgroundColor: group.color }]} />
                              <View style={{ flex: 1 }}>
                                <View style={styles.logItemTopRow}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                                    <Text style={[styles.logTitle, { color: theme.text?.primary || "#fff" }]}>
                                      {log.title}
                                    </Text>
                                    {docCount > 1 && (
                                      <View
                                        style={{
                                          backgroundColor: group.color + "20",
                                          borderColor: group.color + "55",
                                          borderWidth: 0.8,
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{ fontSize: 10.5, fontWeight: "800", color: group.color }}>
                                          +{docCount} Doküman
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={[styles.logDateTimeTag, { color: theme.text?.muted || "#888" }]}>
                                    {log.dateStr ? `${log.dateStr} ` : ""}{log.timeStr || new Date(log.time).toLocaleTimeString("tr-TR")}
                                  </Text>
                                </View>
                                <Text style={[styles.logDetail, { color: theme.text?.secondary || "#ccc" }]}>
                                  {log.detail}
                                </Text>
                                {(log.cost || 0) > 0 && (
                                  <Text style={[styles.logCostTag, { color: group.color }]}>
                                    💰 +${(log.cost || 0).toFixed(6)} (≈ {((log.cost || 0) * PRICING.usdToTryRate).toFixed(4)} ₺)
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── 8. PROJEKSİYON VE KÂR / ZARAR SİMÜLATÖRÜ ────────────────────── */}
        {activeTab === "simulator" && (() => {
          const subFee = parseFloat(subFeeInput) || 0;
          const usdRate = parseFloat(usdRateInput) || 50;
          const taxPercent = parseFloat(taxPercentInput) || 0;

          // 3 Farklı Temel Maliyet Modu (100% Genel Bakış ile Senkronize)
          const sessionGrossCostTry = costs?.totalTry || 0;
          const sessionNetPayableTry = costs?.netPayableTry || 0;
          const monthlyProjectedGrossTry = sessionGrossCostTry * 30;

          const activeCostPerUserTry =
            simBasisMode === "session"
              ? sessionGrossCostTry
              : simBasisMode === "net"
              ? sessionNetPayableTry
              : monthlyProjectedGrossTry;

          const storeCutPerUserTry = subFee * 0.15; // Apple / Google Small Business (%15)
          const preTaxProfitPerUserTry = subFee - activeCostPerUserTry - storeCutPerUserTry;
          const taxPerUserTry = preTaxProfitPerUserTry > 0 ? (preTaxProfitPerUserTry * (taxPercent / 100)) : 0;
          const netProfitPerUserTry = preTaxProfitPerUserTry - taxPerUserTry;
          const isProfitable = netProfitPerUserTry >= 0;
          const marginPercent = subFee > 0 ? ((netProfitPerUserTry / subFee) * 100).toFixed(1) : "0.0";

          const PRESET_FEES = [39, 49, 59, 79, 99, 149];
          const PRESET_USD_RATES = [40, 45, 50, 55, 60];
          const PRESET_TAX_RATES = [0, 10, 15, 20, 25];

          return (
            <View style={styles.tabContent}>
              {/* 1. Senkronize Canlı Tüketim Tablosu (Genel Bakış ile Birebir Eşleşme) */}
              <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.liveIndicatorDot, { backgroundColor: "#4CAF50" }]} />
                    <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                      📊 Genel Bakış ile Senkronize Tüketim
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                    <Text style={[styles.statusPillText, { color: theme.accent }]}>
                      1 USD = {usdRate.toFixed(2)} ₺
                    </Text>
                  </View>
                </View>
                <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                  Projeksiyon hesaplamalarında baz alınan test oturumu maliyet dökümü (girilen güncel kurla):
                </Text>

                {/* 3'lü Senkronize Maliyet Izgarası */}
                <View style={[styles.ecoPriceStrip, { backgroundColor: theme.primary, borderColor: theme.border, marginTop: 4 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ecoPriceLabel, { color: theme.accent }]}>📖 FIRESTORE BRÜT</Text>
                    <Text style={[styles.ecoPriceUsd, { color: theme.text?.primary || "#fff" }]}>
                      {(costs?.firestore?.totalCostTry || 0).toFixed(4)} ₺
                    </Text>
                    <Text style={{ fontSize: 9.5, color: theme.text?.muted || "#888", marginTop: 1 }}>
                      ${(costs?.firestore?.totalCost || 0).toFixed(5)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={[styles.ecoPriceLabel, { color: "#C25AFF" }]}>🤖 GEMINI AI</Text>
                    <Text style={[styles.ecoPriceUsd, { color: "#C25AFF" }]}>
                      {(costs?.gemini?.totalCostTry || 0).toFixed(4)} ₺
                    </Text>
                    <Text style={{ fontSize: 9.5, color: theme.text?.muted || "#888", marginTop: 1 }}>
                      ${(costs?.gemini?.totalCost || 0).toFixed(5)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={[styles.ecoPriceLabel, { color: theme.colors?.green || "#29b864" }]}>⚡ TOPLAM BRÜT</Text>
                    <Text style={[styles.ecoPriceTry, { color: theme.colors?.green || "#29b864" }]}>
                      {(costs?.totalTry || 0).toFixed(4)} ₺
                    </Text>
                    <Text style={{ fontSize: 9.5, color: (costs?.netPayableTry || 0) > 0 ? "#FF9800" : "#4CAF50", fontWeight: "800", marginTop: 1 }}>
                      Net: {(costs?.netPayableTry || 0).toFixed(4)} ₺
                    </Text>
                  </View>
                </View>
              </View>

              {/* 2. Projeksiyon Hesaplama Modu Seçici */}
              <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                  ⚙️ Maliyet Hesaplama Bazı (Mod Seçimi)
                </Text>
                <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 12 }]}>
                  Kullanıcı başına düşen altyapı giderini hangi kritere göre hesaplamak istiyorsunuz?
                </Text>

                <View style={{ gap: 8 }}>
                  {/* Mod 1: Canlı Test Tüketimi */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSimBasisMode("session");
                    }}
                    style={[
                      styles.simModeCard,
                      {
                        backgroundColor: simBasisMode === "session" ? theme.accent + "18" : theme.primary,
                        borderColor: simBasisMode === "session" ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 16 }}>{simBasisMode === "session" ? "🔘" : "⚪"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.simModeTitle, { color: theme.text?.primary || "#fff" }]}>
                            Canlı Test Tüketimi (1 Kullanıcı = Tüm Test)
                          </Text>
                          <Text style={[styles.simModeSub, { color: theme.text?.muted || "#888" }]}>
                            Genel Bakış ekranındaki toplam brüt maliyet baz alınır.
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.simModeVal, { color: theme.accent }]}>
                        {sessionGrossCostTry.toFixed(4)} ₺
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Mod 2: 30 Günlük Projeksiyon */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSimBasisMode("monthly");
                    }}
                    style={[
                      styles.simModeCard,
                      {
                        backgroundColor: simBasisMode === "monthly" ? theme.accent + "18" : theme.primary,
                        borderColor: simBasisMode === "monthly" ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 16 }}>{simBasisMode === "monthly" ? "🔘" : "⚪"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.simModeTitle, { color: theme.text?.primary || "#fff" }]}>
                            30 Günlük Projeksiyon (Test Tüketimi × 30 Gün)
                          </Text>
                          <Text style={[styles.simModeSub, { color: theme.text?.muted || "#888" }]}>
                            Kullanıcının her gün bu test kadar yoğun işlem yaptığı varsayılır.
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.simModeVal, { color: "#FF9800" }]}>
                        {monthlyProjectedGrossTry.toFixed(2)} ₺
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Mod 3: Google Free Tier Net Fatura */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSimBasisMode("net");
                    }}
                    style={[
                      styles.simModeCard,
                      {
                        backgroundColor: simBasisMode === "net" ? theme.accent + "18" : theme.primary,
                        borderColor: simBasisMode === "net" ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 16 }}>{simBasisMode === "net" ? "🔘" : "⚪"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.simModeTitle, { color: theme.text?.primary || "#fff" }]}>
                            Google Free Tier Korumalı Net Fatura
                          </Text>
                          <Text style={[styles.simModeSub, { color: theme.text?.muted || "#888" }]}>
                            Firebase 50K/20K kotaları ücretsizdir, yalnızca aşım ve Gemini ödenir.
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.simModeVal, { color: theme.colors?.green || "#29b864" }]}>
                        {sessionNetPayableTry.toFixed(4)} ₺
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Finansal Parametreler (Abonelik, Dolar Kuru & Vergi Oranı) */}
              <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                  ⚙️ Finansal Parametreler & Kâr Ayarları
                </Text>
                <Text style={[styles.simulatorDesc, { color: theme.text?.secondary || "#ccc", marginBottom: 14 }]}>
                  Abonelik ücreti, güncel dolar kuru ve gelir vergisi oranını belirleyerek net kârlılık projeksiyonunuzu hesaplayın:
                </Text>

                {/* 1. Parametre: Kullanıcı Başı Aylık Üyelik Ücreti */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.paramTitle, { color: theme.text?.primary || "#fff" }]}>
                    💰 Kullanıcı Başı Aylık Üyelik Ücreti (TL)
                  </Text>
                  <View style={[styles.feeInputWrap, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors?.green || "#29b864" }]}>₺</Text>
                    <TextInput
                      style={[styles.feeInput, { color: theme.text?.primary || "#fff" }]}
                      keyboardType="numeric"
                      value={subFeeInput}
                      onChangeText={(txt) => setSubFeeInput(txt.replace(/[^0-9.]/g, ""))}
                      placeholder="59"
                      placeholderTextColor="#666"
                    />
                    <Text style={[styles.feeInputSub, { color: theme.text?.muted || "#888" }]}>TL / Kullanıcı / Ay</Text>
                  </View>
                  <View style={styles.presetRow}>
                    {PRESET_FEES.map((fee) => {
                      const isSelected = subFee === fee;
                      return (
                        <TouchableOpacity
                          key={fee}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSubFeeInput(String(fee));
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: isSelected ? theme.accent : theme.primary,
                              borderColor: isSelected ? theme.accent : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color: isSelected ? "#FFFFFF" : theme.text?.secondary || "#ccc",
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            {fee} ₺
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 2. Parametre: Dolar / TL Kuru */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.paramTitle, { color: theme.text?.primary || "#fff" }]}>
                    💱 Dolar / TL Kuru (USD / TRY)
                  </Text>
                  <View style={[styles.feeInputWrap, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                    <Text style={[styles.currencySymbol, { color: "#FF9800" }]}>$</Text>
                    <TextInput
                      style={[styles.feeInput, { color: theme.text?.primary || "#fff" }]}
                      keyboardType="numeric"
                      value={usdRateInput}
                      onChangeText={(txt) => setUsdRateInput(txt.replace(/[^0-9.]/g, ""))}
                      placeholder="50"
                      placeholderTextColor="#666"
                    />
                    <Text style={[styles.feeInputSub, { color: theme.text?.muted || "#888" }]}>1 USD = {usdRate} ₺</Text>
                  </View>
                  <View style={styles.presetRow}>
                    {PRESET_USD_RATES.map((rate) => {
                      const isSelected = usdRate === rate;
                      return (
                        <TouchableOpacity
                          key={rate}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setUsdRateInput(String(rate));
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: isSelected ? theme.accent : theme.primary,
                              borderColor: isSelected ? theme.accent : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color: isSelected ? "#FFFFFF" : theme.text?.secondary || "#ccc",
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            {rate} ₺/$
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Parametre: Gelir Vergisi Yüzdesi */}
                <View>
                  <Text style={[styles.paramTitle, { color: theme.text?.primary || "#fff" }]}>
                    🏛️ Gelir Vergisi Oranı (% Net Kâr Üzerinden)
                  </Text>
                  <View style={[styles.feeInputWrap, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                    <Text style={[styles.currencySymbol, { color: "#C25AFF" }]}>%</Text>
                    <TextInput
                      style={[styles.feeInput, { color: theme.text?.primary || "#fff" }]}
                      keyboardType="numeric"
                      value={taxPercentInput}
                      onChangeText={(txt) => setTaxPercentInput(txt.replace(/[^0-9.]/g, ""))}
                      placeholder="15"
                      placeholderTextColor="#666"
                    />
                    <Text style={[styles.feeInputSub, { color: theme.text?.muted || "#888" }]}>%{taxPercent} Vergi (Net Kârdan)</Text>
                  </View>
                  <View style={styles.presetRow}>
                    {PRESET_TAX_RATES.map((tax) => {
                      const isSelected = taxPercent === tax;
                      return (
                        <TouchableOpacity
                          key={tax}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setTaxPercentInput(String(tax));
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: isSelected ? theme.accent : theme.primary,
                              borderColor: isSelected ? theme.accent : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color: isSelected ? "#FFFFFF" : theme.text?.secondary || "#ccc",
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            %{tax}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* 4. Kullanıcı Başı Ünite Ekonomisi (Unit Economics) */}
              <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff", marginBottom: 0 }]}>
                    📊 Kullanıcı Başı Kâr / Zarar
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isProfitable ? "#4CAF5020" : "#FF3B3020",
                        borderColor: isProfitable ? "#4CAF5055" : "#FF3B3055",
                      },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: isProfitable ? "#4CAF50" : "#FF3B30" }]}>
                      {isProfitable ? `🟢 %${marginPercent} KÂR MARJI` : `🔴 ZARARDA`}
                    </Text>
                  </View>
                </View>

                {/* 5'li Gelir / Altyapı / Mağaza / Vergi / Net Kâr Şeridi */}
                <View style={[styles.ecoPriceStrip, { backgroundColor: theme.primary, borderColor: theme.border, marginTop: 14 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ecoPriceLabel, { color: "#4CAF50" }]}>ÜYELİK</Text>
                    <Text style={[styles.ecoPriceUsd, { color: "#4CAF50" }]}>
                      +{subFee.toFixed(2)} ₺
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={[styles.ecoPriceLabel, { color: "#FF9800" }]}>ALTYAPI</Text>
                    <Text style={[styles.ecoPriceUsd, { color: "#FF9800" }]}>
                      -{activeCostPerUserTry.toFixed(2)} ₺
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={[styles.ecoPriceLabel, { color: theme.text?.muted || "#888" }]}>MAĞAZA (%15)</Text>
                    <Text style={[styles.ecoPriceUsd, { color: theme.text?.muted || "#888" }]}>
                      -{storeCutPerUserTry.toFixed(2)} ₺
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={[styles.ecoPriceLabel, { color: "#C25AFF" }]}>VERGİ (%{taxPercent})</Text>
                    <Text style={[styles.ecoPriceUsd, { color: "#C25AFF" }]}>
                      -{taxPerUserTry.toFixed(2)} ₺
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={[styles.ecoPriceLabel, { color: isProfitable ? (theme.colors?.green || "#29b864") : "#FF3B30" }]}>NET KÂR</Text>
                    <Text style={[styles.ecoPriceTry, { color: isProfitable ? (theme.colors?.green || "#29b864") : "#FF3B30" }]}>
                      {netProfitPerUserTry >= 0 ? "+" : ""}{netProfitPerUserTry.toFixed(2)} ₺
                    </Text>
                  </View>
                </View>
              </View>

              {/* 5. Ölçeklenmiş Kullanıcı Simülasyonu */}
              <View style={[styles.sectionCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text?.primary || "#fff" }]}>
                  👥 Ölçeklendirilmiş Aylık Ciro ve Net Kâr
                </Text>

                {[1, 100, 1000, 10000].map((userCount) => {
                  const grossRevenueTry = userCount * subFee;
                  const totalCostTry = userCount * activeCostPerUserTry;
                  const storeCutTry = grossRevenueTry * 0.15; // Apple/Google %15 Small Business
                  const preTaxProfitTry = grossRevenueTry - totalCostTry - storeCutTry;
                  const taxAmountTry = preTaxProfitTry > 0 ? (preTaxProfitTry * (taxPercent / 100)) : 0;
                  const netProfitTry = preTaxProfitTry - taxAmountTry;
                  const isSingle = userCount === 1;

                  return (
                    <View key={userCount} style={[styles.simCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                      <View style={styles.simHeaderRow}>
                        <Text style={[styles.simUserCount, { color: theme.accent }]}>
                          👥 {userCount.toLocaleString()} {isSingle ? "Abone Kullanıcı" : "Abone"}
                        </Text>
                        <Text
                          style={[
                            styles.simMonthlyUsd,
                            { color: netProfitTry >= 0 ? (theme.colors?.green || "#29b864") : "#FF3B30" },
                          ]}
                        >
                          {netProfitTry >= 0 ? "+" : ""}{netProfitTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL Net Kâr
                        </Text>
                      </View>

                      {/* Ayrıntılı Dağılım Çizgisi */}
                      <View style={styles.simDetailsRow}>
                        <Text style={[styles.simDetailText, { color: theme.text?.secondary || "#aaa" }]}>
                          💵 Ciro: <Text style={{ fontWeight: "800", color: theme.text?.primary || "#fff" }}>{grossRevenueTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</Text>
                        </Text>
                        <Text style={[styles.simDetailText, { color: theme.text?.secondary || "#aaa" }]}>
                          ⚡ Gider: <Text style={{ fontWeight: "800", color: "#FF9800" }}>{totalCostTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</Text>
                        </Text>
                        <Text style={[styles.simDetailText, { color: theme.text?.secondary || "#aaa" }]}>
                          🍎 Mağaza (%15): <Text style={{ fontWeight: "800", color: theme.text?.muted || "#888" }}>{storeCutTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</Text>
                        </Text>
                        <Text style={[styles.simDetailText, { color: theme.text?.secondary || "#aaa" }]}>
                          🏛️ Vergi (%{taxPercent}): <Text style={{ fontWeight: "800", color: "#C25AFF" }}>{taxAmountTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* ── İstatistik Yedekleme & Geri Yükleme Modalı ── */}
      <Modal
        animationType="none"
        transparent
        visible={backupSheet.mounted}
        onRequestClose={() => {
          setBackupModalVisible(false);
          setShowManualInput(false);
        }}
        statusBarTranslucent
      >
        <View style={styles.sheetOverlay} onLayout={backupSheet.onOverlayLayout}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: backupSheet.backdropOpacity }]}
          >
            <ModalBlurBackdrop intensity={35} />
          </Animated.View>

          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setBackupModalVisible(false);
              setShowManualInput(false);
            }}
          />

          <Animated.View
            onLayout={backupSheet.onSheetLayout}
            style={[
              backupSheet.fit([
                styles.modalCard,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]),
              backupSheet.sheetStyle,
            ]}
          >
            {/* Sheet Tutamağı (Handle) */}
            <View style={styles.sheetHandleWrap}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            {/* Modal Başlık */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.modalIconWrap, { backgroundColor: (theme.colors?.green || "#29b864") + "22" }]}>
                  <AppIcon family="Ionicons" name="cloud-upload" size={20} color={theme.colors?.green || "#29b864"} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text?.primary || "#fff" }]}>
                    İstatistik Yedekle & Yükle
                  </Text>
                  <Text style={[styles.modalSub, { color: theme.text?.muted || "#888" }]}>
                    Sıfır veri kaybıyla dışa aktarın veya geri yükleyin
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setBackupModalVisible(false);
                  setShowManualInput(false);
                }}
                style={[styles.modalCloseBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <AppIcon family="Ionicons" name="close" size={18} color={theme.text?.secondary || "#ccc"} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            >
              {/* Canlı Yedeklenecek Veri Özeti */}
              <View style={[styles.backupSummaryBox, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.backupSummaryTitle, { color: theme.text?.primary || "#fff" }]}>
                  📦 Mevcut Canlı Veri Özeti
                </Text>
                <View style={styles.backupSummaryGrid}>
                  <View style={styles.backupSummaryItem}>
                    <Text style={[styles.backupSummaryVal, { color: theme.accent }]}>
                      {timerStr}
                    </Text>
                    <Text style={[styles.backupSummaryLbl, { color: theme.text?.muted || "#888" }]}>
                      Oturum Süresi
                    </Text>
                  </View>
                  <View style={styles.backupSummaryItem}>
                    <Text style={[styles.backupSummaryVal, { color: theme.colors?.green || "#29b864" }]}>
                      {totalFirestoreOps.toLocaleString()}
                    </Text>
                    <Text style={[styles.backupSummaryLbl, { color: theme.text?.muted || "#888" }]}>
                      Firestore İşlemi
                    </Text>
                  </View>
                  <View style={styles.backupSummaryItem}>
                    <Text style={[styles.backupSummaryVal, { color: "#C25AFF" }]}>
                      {(stats?.gemini?.totalTokens || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.backupSummaryLbl, { color: theme.text?.muted || "#888" }]}>
                      AI Token
                    </Text>
                  </View>
                  <View style={styles.backupSummaryItem}>
                    <Text style={[styles.backupSummaryVal, { color: "#FF9800" }]}>
                      {(stats?.recentLogs || []).length}
                    </Text>
                    <Text style={[styles.backupSummaryLbl, { color: theme.text?.muted || "#888" }]}>
                      Canlı Log
                    </Text>
                  </View>
                </View>
              </View>

              {/* Dışa Aktarma (Yedekleme) Bölümü */}
              <Text style={[styles.modalSectionHeading, { color: theme.text?.muted || "#888" }]}>
                DIŞA AKTARMA (YEDEK AL)
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleCopyBackupJson}
                style={[styles.modalActionBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={[styles.modalActionIconWrap, { backgroundColor: theme.accent + "20" }]}>
                  <AppIcon family="Ionicons" name="copy" size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalActionTitle, { color: theme.text?.primary || "#fff" }]}>
                    📋 JSON Olarak Panoya Kopyala
                  </Text>
                  <Text style={[styles.modalActionDesc, { color: theme.text?.muted || "#888" }]}>
                    Tüm verileri panoya alır; WhatsApp, Notlar veya e-postaya yapıştırabilirsiniz.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleShareBackupFile}
                disabled={isExporting}
                style={[styles.modalActionBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={[styles.modalActionIconWrap, { backgroundColor: "#00BCD420" }]}>
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#00BCD4" />
                  ) : (
                    <AppIcon family="Ionicons" name="share-social" size={18} color="#00BCD4" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalActionTitle, { color: theme.text?.primary || "#fff" }]}>
                    📁 Yedek Dosyası Olarak Paylaş (.json)
                  </Text>
                  <Text style={[styles.modalActionDesc, { color: theme.text?.muted || "#888" }]}>
                    Drive, Dosyalar veya diğer uygulamalara .json dosyası olarak kaydeder.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* İçe Aktarma (Geri Yükleme) Bölümü */}
              <Text style={[styles.modalSectionHeading, { color: theme.text?.muted || "#888", marginTop: 14 }]}>
                İÇE AKTARMA (GERİ YÜKLE)
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleImportFromClipboard}
                style={[styles.modalActionBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={[styles.modalActionIconWrap, { backgroundColor: (theme.colors?.green || "#29b864") + "20" }]}>
                  <AppIcon family="Ionicons" name="clipboard" size={18} color={theme.colors?.green || "#29b864"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalActionTitle, { color: theme.text?.primary || "#fff" }]}>
                    📥 Panodan Oku ve Geri Yükle
                  </Text>
                  <Text style={[styles.modalActionDesc, { color: theme.text?.muted || "#888" }]}>
                    Kopyaladığınız JSON yedeğini otomatik algılar, doğrular ve geri yükler.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleImportFromFile}
                style={[styles.modalActionBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={[styles.modalActionIconWrap, { backgroundColor: "#FF980020" }]}>
                  <AppIcon family="Ionicons" name="document-text" size={18} color="#FF9800" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalActionTitle, { color: theme.text?.primary || "#fff" }]}>
                    📂 Dosyadan (.json) Geri Yükle
                  </Text>
                  <Text style={[styles.modalActionDesc, { color: theme.text?.muted || "#888" }]}>
                    Cihazdaki kayıtlı `.json` yedek dosyasını seçip yükleyin.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Manuel JSON Yapıştır Açılır Bölümü */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowManualInput((prev) => !prev);
                }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.accent }}>
                  {showManualInput ? "▲ Manuel JSON Girişini Gizle" : "▼ Manuel Olarak JSON Metni Yapıştır"}
                </Text>
              </TouchableOpacity>

              {showManualInput && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={[
                      styles.manualJsonTextInput,
                      {
                        backgroundColor: theme.secondary,
                        borderColor: theme.border,
                        color: theme.text?.primary || "#fff",
                      },
                    ]}
                    placeholder="Buraya yedek JSON metnini yapıştırın..."
                    placeholderTextColor={theme.text?.muted || "#666"}
                    value={manualJsonText}
                    onChangeText={setManualJsonText}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleManualRestore}
                    disabled={!manualJsonText.trim()}
                    style={[
                      styles.manualRestoreBtn,
                      {
                        backgroundColor: manualJsonText.trim() ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={styles.manualRestoreBtnText}>Metinden Geri Yükle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  devTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  devTagText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  timerText: { fontSize: 12, fontWeight: "600" },
  headerTitle: { fontSize: 22, fontWeight: "900" },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsWrap: { marginBottom: 12 },
  tabsScroll: { paddingHorizontal: 16, gap: 8 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabChipText: { fontSize: 13 },
  contentScroll: { paddingHorizontal: 16 },
  tabContent: { gap: 14 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  heroLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10.5, fontWeight: "800" },
  heroPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 },
  heroPriceUsd: { fontSize: 32, fontWeight: "900" },
  heroPriceTry: { fontSize: 18, fontWeight: "800" },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  freeShieldBadge: {
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickMetricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  quickMetricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  quickMetricVal: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },
  quickMetricLbl: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  serviceOverviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  serviceOverviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceOverviewName: {
    fontSize: 14,
    fontWeight: "800",
  },
  serviceOverviewSub: {
    fontSize: 11,
    marginTop: 1,
  },
  serviceOverviewCost: {
    fontSize: 14,
    fontWeight: "900",
  },
  serviceOverviewDetailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  serviceDetailText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  auditTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  auditDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 14 },
  quotaItem: { marginBottom: 12 },
  quotaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  quotaLabel: { fontSize: 12.5, fontWeight: "700" },
  quotaVal: { fontSize: 12, fontWeight: "800" },
  quotaBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  quotaBarFill: { height: "100%", borderRadius: 3 },
  hotspotLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  hotspotLiveBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modernHotspotCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  modernHotspotTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modernHotspotIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modernHotspotName: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  modernMedalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modernMedalText: {
    fontSize: 10,
    fontWeight: "800",
  },
  modernHotspotSub: {
    fontSize: 11,
    marginTop: 3,
  },
  modernHotspotPercent: {
    fontSize: 16,
    fontWeight: "900",
  },
  modernHotspotTotalOps: {
    fontSize: 10.5,
    marginTop: 1,
  },
  dualBarContainer: {
    marginTop: 10,
  },
  dualBarBg: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    overflow: "hidden",
  },
  dualBarSegment: {
    height: "100%",
  },
  modernHotspotFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  microMetricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  microDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  microMetricLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  microMetricVal: {
    fontSize: 11,
    fontWeight: "800",
  },
  aiMetricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  aiMetricBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  aiBoxHeader: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.5, marginBottom: 4 },
  aiMetricBoxVal: { fontSize: 18, fontWeight: "900" },
  aiMetricBoxLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  aiUnitText: { fontSize: 9.5, marginTop: 2 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTitle: { fontSize: 13, fontWeight: "800" },
  logDetail: { fontSize: 11.5, marginTop: 2 },
  simulatorDesc: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  simCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  simHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  simUserCount: { fontSize: 14, fontWeight: "800" },
  simMonthlyUsd: { fontSize: 15, fontWeight: "900" },
  zoneCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  zoneTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoneName: { fontSize: 15, fontWeight: "900" },
  riskTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  riskTagText: { fontSize: 10, fontWeight: "900" },
  zoneDesc: { fontSize: 11.5, marginTop: 4 },
  zoneCounters: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  zoneCounterBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  zoneCounterVal: { fontSize: 14, fontWeight: "900" },
  zoneCounterLbl: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  zoneOptBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  zoneOptText: { fontSize: 11.5, lineHeight: 15 },
  ecoPriceStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  ecoPriceLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  ecoPriceUsd: { fontSize: 14.5, fontWeight: "900", marginTop: 2 },
  ecoPriceTry: { fontSize: 14.5, fontWeight: "900", marginTop: 2 },
  paramTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  feeInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: "900",
    marginRight: 8,
  },
  feeInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    padding: 0,
  },
  feeInputSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12.5,
  },
  simDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  simDetailText: {
    fontSize: 11.5,
  },
  miniActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniActionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  logGroupCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  logGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  logGroupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logGroupIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logGroupTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  logGroupOpsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  logGroupOpsBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  logGroupSubtotalText: {
    fontSize: 11,
    marginTop: 2,
  },
  logGroupChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  logGroupBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  emptyGroupText: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 12,
    textAlign: "center",
  },
  logDetailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logItemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logDateTimeTag: {
    fontSize: 10,
    fontWeight: "600",
  },
  logCostTag: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  dailyDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  dailyDayChipTitle: {
    fontSize: 13,
  },
  dailyDayChipSub: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 2,
  },
  dailyZoneCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  dailyZoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dailyZoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dailyZoneTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  dailyRankPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dailyRankPillText: {
    fontSize: 10,
    fontWeight: "900",
  },
  dailyZoneMetrics: {
    fontSize: 11,
    marginTop: 2,
  },
  dailyZoneCostTry: {
    fontSize: 14,
    fontWeight: "900",
  },
  dailyZoneCostUsd: {
    fontSize: 10.5,
    marginTop: 1,
  },
  dailyBarTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  dailyBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  hourlyChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 110,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  hourlyBarColumn: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  hourlyBarValText: {
    fontSize: 8,
    fontWeight: "800",
    marginBottom: 2,
  },
  hourlyBarBg: {
    width: 8,
    height: 70,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  hourlyBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  hourlyLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  timeBlockGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },
  timeBlockCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  timeBlockTitle: {
    fontSize: 11,
    fontWeight: "700",
  },
  timeBlockVal: {
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: 3,
  },
  trendChartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    paddingHorizontal: 2,
  },
  trendCostText: {
    fontSize: 9.5,
    fontWeight: "800",
    marginBottom: 4,
  },
  trendBarTrack: {
    width: 22,
    height: 68,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendBarFill: {
    width: "100%",
    borderRadius: 6,
  },
  trendDateText: {
    fontSize: 10,
    marginTop: 6,
  },
  ecosystemServiceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ecosystemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ecosystemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ecosystemName: {
    fontSize: 15,
    fontWeight: "800",
  },
  ecosystemCategory: {
    fontSize: 11.5,
    marginTop: 2,
  },
  ecosystemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ecosystemBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  ecosystemPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  ecosystemPriceLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  ecosystemPriceUsd: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  ecosystemPriceTry: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  ecosystemQuotaBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  ecosystemQuotaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ecosystemQuotaLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  ecosystemQuotaVal: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  ecosystemNotesBox: {
    marginTop: 10,
    paddingTop: 8,
  },
  ecosystemNotesText: {
    fontSize: 11.5,
    lineHeight: 16,
    fontStyle: "italic",
  },
  firebaseLimitCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  firebaseLimitTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  firebaseLimitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  firebaseLimitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  firebaseLimitItemKey: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  firebaseLimitItemVal: {
    fontSize: 11,
    fontWeight: "800",
  },
  geminiModelPriceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  geminiModelPriceName: {
    fontSize: 14,
    fontWeight: "800",
  },
  geminiModelPriceDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  geminiTokenPriceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  geminiTokenPriceItem: {
    fontSize: 11.5,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  modelRatioPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  simModeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  simModeTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  simModeSub: {
    fontSize: 11,
    marginTop: 2,
  },
  simModeVal: {
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 8,
  },
  // ── Yedekleme & Geri Yükleme Modalı Stilleri ──
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    opacity: 0.7,
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: "900",
  },
  modalSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backupSummaryBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  backupSummaryTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 10,
  },
  backupSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  backupSummaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  backupSummaryVal: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  backupSummaryLbl: {
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  modalSectionHeading: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  modalActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalActionTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  modalActionDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  manualJsonTextInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    minHeight: 80,
    marginBottom: 8,
  },
  manualRestoreBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  manualRestoreBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  // ── Bildirim Testi Stilleri ──
  notifTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notifTestIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  notifTestTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  notifTestSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});

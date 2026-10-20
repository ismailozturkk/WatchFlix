// __tests__/usageTrackerBackup.test.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { __resetAllMMKV } from "react-native-mmkv";
import { __resetStoreCaches } from "../services/storage/store";
import { __resetStores } from "../services/storage/instances";
import {
  getUsageStats,
  resetUsageStats,
  trackFirestoreRead,
  trackFirestoreWrite,
  trackFirestoreDelete,
  trackGeminiUsage,
  trackTmdbRequest,
  trackFunctionCall,
  trackRtdbEvent,
  trackNetworkRequest,
  exportUsageBackup,
  validateUsageBackup,
  importUsageBackup,
  getDailyAnalytics,
  calculateCostSummary,
  getTodayKey,
} from "../services/usageTrackerService";

beforeEach(() => {
  AsyncStorage.__reset();
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  resetUsageStats();
});

describe("Usage Tracker Backup & Restore System - Exhaustive Verification", () => {
  it("exports a pristine backup envelope with all stats, sessions, and logs", () => {
    // 1. Kapsamlı işlem simülasyonu
    trackFirestoreRead("posts", 15);
    trackFirestoreWrite("users", 2);
    trackFirestoreDelete("comments", 1);
    trackGeminiUsage({
      model: "gemini-2.5-flash",
      promptTokens: 500,
      outputTokens: 200,
      thoughtsTokens: 50,
      costUsd: 0.0002,
    });
    trackTmdbRequest("/movie/popular", true);
    trackFunctionCall("sendPushNotification", 120);
    trackRtdbEvent("presence", "user_online");
    trackNetworkRequest("https://api.themoviedb.org", true);

    const backupJson = exportUsageBackup({ format: "string", pretty: true });
    expect(typeof backupJson).toBe("string");

    const parsed = JSON.parse(backupJson);
    expect(parsed.app).toBe("seelogd");
    expect(parsed.type).toBe("usage_telemetry_backup");
    expect(parsed.version).toBe(1);
    expect(parsed.session.startedAt).toBeDefined();
    expect(parsed.summary.firestoreOps).toBe(18);
    expect(parsed.summary.geminiTokens).toBe(750);
    expect(parsed.summary.logCount).toBe(7);
    expect(parsed.stats.firestore.reads).toBe(15);
    expect(parsed.stats.firestore.writes).toBe(2);
    expect(parsed.stats.firestore.deletes).toBe(1);
    expect(parsed.stats.firestore.collections.posts.reads).toBe(15);
    expect(parsed.stats.gemini.promptTokens).toBe(500);
    expect(parsed.stats.rtdb.events).toBe(1);
    expect(parsed.stats.network.requests).toBe(1);
  });

  it("validates backup data correctly and rejects invalid or corrupted payloads", () => {
    expect(validateUsageBackup("").valid).toBe(false);
    expect(validateUsageBackup("{ invalid json ").valid).toBe(false);
    expect(validateUsageBackup(null).valid).toBe(false);
    expect(validateUsageBackup(123).valid).toBe(false);
    expect(validateUsageBackup({ unrelatedKey: 123 }).valid).toBe(false);

    const validObj = exportUsageBackup({ format: "object" });
    const validation = validateUsageBackup(validObj);
    expect(validation.valid).toBe(true);
    expect(validation.summary.startedAt).toBeDefined();
    expect(validation.summary.firestoreOps).toBeDefined();
    expect(validation.summary.geminiTokens).toBeDefined();
  });

  it("restores 100% of all complex nested data with ZERO data loss", () => {
    const fixedStartedAt = Date.now() - 3600000; // 1 saat önce başladı

    // Firestore testleri (Farklı koleksiyon ve zonelar)
    trackFirestoreRead("posts", 100); // social
    trackFirestoreRead("customLists", 50); // lists
    trackFirestoreWrite("messages", 20); // chat
    trackFirestoreWrite("users", 5); // profile
    trackFirestoreDelete("cineswipeRooms", 3); // games
    trackFirestoreRead("notifications", 10); // notifications

    // Gemini testleri (Çoklu modeller)
    trackGeminiUsage({
      model: "gemini-2.5-flash",
      promptTokens: 1200,
      outputTokens: 450,
      thoughtsTokens: 150,
    });
    trackGeminiUsage({
      model: "gemini-2.0-flash",
      promptTokens: 800,
      outputTokens: 300,
      thoughtsTokens: 0,
    });
    trackGeminiUsage({
      model: "gemini-1.5-pro",
      promptTokens: 2500,
      outputTokens: 1000,
      thoughtsTokens: 500,
    });

    // Cloud Functions testleri (Farklı fonksiyonlar)
    trackFunctionCall("callGemini", 450);
    trackFunctionCall("sendPushNotification", 80);
    trackFunctionCall("cleanOldChats", 1200);

    // TMDB testleri
    trackTmdbRequest("/movie/popular", false);
    trackTmdbRequest("/movie/popular", true);
    trackTmdbRequest("/tv/top_rated", true);

    // RTDB & Network
    trackRtdbEvent("typing", "user_typing");
    trackNetworkRequest("https://image.tmdb.org", false);

    // Başlangıç zamanını sabitle
    const originalStats = getUsageStats();
    originalStats.startedAt = fixedStartedAt;

    // Yedeği al (String olarak JSON)
    const backupJsonString = exportUsageBackup({ format: "string", pretty: true });

    // Bellekteki ve depodaki her şeyi tamamen sıfırla
    resetUsageStats();
    const blankStats = getUsageStats();
    expect(blankStats.firestore.reads).toBe(0);
    expect(blankStats.gemini.totalTokens).toBe(0);
    expect(blankStats.functions.totalCalls).toBe(0);
    expect(blankStats.recentLogs.length).toBe(0);

    // Yedeği geri yükle
    const restoreRes = importUsageBackup(backupJsonString);
    expect(restoreRes.success).toBe(true);

    const restoredStats = getUsageStats();

    // ── DERİN ALAN ALAN KONTROLLER ──────────────────────────────────────────

    // 1. Oturum Başlangıç Zamanı
    expect(restoredStats.startedAt).toBe(fixedStartedAt);

    // 2. Firestore Sayaçları ve Koleksiyonları
    expect(restoredStats.firestore.reads).toBe(160);
    expect(restoredStats.firestore.writes).toBe(25);
    expect(restoredStats.firestore.deletes).toBe(3);
    expect(restoredStats.firestore.collections.posts.reads).toBe(100);
    expect(restoredStats.firestore.collections.customLists.reads).toBe(50);
    expect(restoredStats.firestore.collections.messages.writes).toBe(20);
    expect(restoredStats.firestore.collections.cineswipeRooms.deletes).toBe(3);

    // 3. Firestore Zone Dağılımları
    expect(restoredStats.firestore.zones.social.reads).toBe(100);
    expect(restoredStats.firestore.zones.lists.reads).toBe(50);
    expect(restoredStats.firestore.zones.chat.writes).toBe(20);
    expect(restoredStats.firestore.zones.profile.writes).toBe(5);
    expect(restoredStats.firestore.zones.games.deletes).toBe(3);
    expect(restoredStats.firestore.zones.notifications.reads).toBe(10);

    // 4. Gemini Token ve Model Kırılımları
    expect(restoredStats.gemini.requests).toBe(3);
    expect(restoredStats.gemini.promptTokens).toBe(1200 + 800 + 2500);
    expect(restoredStats.gemini.outputTokens).toBe(450 + 300 + 1000);
    expect(restoredStats.gemini.thoughtsTokens).toBe(150 + 0 + 500);
    expect(restoredStats.gemini.totalTokens).toBe(4500 + 1750 + 650);
    expect(restoredStats.gemini.models["gemini-2.5-flash"].requests).toBe(1);
    expect(restoredStats.gemini.models["gemini-2.0-flash"].requests).toBe(1);
    expect(restoredStats.gemini.models["gemini-1.5-pro"].requests).toBe(1);

    // 5. Cloud Functions
    expect(restoredStats.functions.totalCalls).toBe(3);
    expect(restoredStats.functions.totalDurationMs).toBe(450 + 80 + 1200);
    expect(restoredStats.functions.callsByFunction.callGemini.count).toBe(1);
    expect(restoredStats.functions.callsByFunction.sendPushNotification.count).toBe(1);
    expect(restoredStats.functions.callsByFunction.cleanOldChats.count).toBe(1);

    // 6. TMDB & Önbellek
    expect(restoredStats.tmdb.totalRequests).toBe(3);
    expect(restoredStats.tmdb.cachedRequests).toBe(2);
    expect(restoredStats.tmdb.networkRequests).toBe(1);

    // 7. RTDB & Network
    expect(restoredStats.rtdb.events).toBe(1);
    expect(restoredStats.network.requests).toBe(1);

    // 8. Canlı Loglar (Tüm alanlar: id, time, dateStr, timeStr, type, zoneId, title, detail, cost)
    expect(restoredStats.recentLogs.length).toBe(originalStats.recentLogs.length);
    for (let i = 0; i < restoredStats.recentLogs.length; i++) {
      expect(restoredStats.recentLogs[i].id).toBe(originalStats.recentLogs[i].id);
      expect(restoredStats.recentLogs[i].time).toBe(originalStats.recentLogs[i].time);
      expect(restoredStats.recentLogs[i].type).toBe(originalStats.recentLogs[i].type);
      expect(restoredStats.recentLogs[i].title).toBe(originalStats.recentLogs[i].title);
      expect(restoredStats.recentLogs[i].detail).toBe(originalStats.recentLogs[i].detail);
      expect(restoredStats.recentLogs[i].cost).toBe(originalStats.recentLogs[i].cost);
      expect(restoredStats.recentLogs[i].zoneId).toBe(originalStats.recentLogs[i].zoneId);
    }

    // 9. Günlük Analitik Geçmişi (dailyHistory)
    const todayKey = getTodayKey();
    expect(restoredStats.dailyHistory[todayKey]).toBeDefined();
    expect(restoredStats.dailyHistory[todayKey].firestore.reads).toBe(160);
    expect(restoredStats.dailyHistory[todayKey].gemini.requests).toBe(3);
    expect(restoredStats.dailyHistory[todayKey].hourlyOps.length).toBe(24);

    // 10. Maliyet Hesaplama Fonksiyonu Tutarlılığı
    const originalCosts = calculateCostSummary(originalStats);
    const restoredCosts = calculateCostSummary(restoredStats);
    expect(restoredCosts.totalUsd).toBeCloseTo(originalCosts.totalUsd, 6);
    expect(restoredCosts.netPayableUsd).toBeCloseTo(originalCosts.netPayableUsd, 6);
    expect(restoredCosts.tmdb.cacheEfficiency).toBe(originalCosts.tmdb.cacheEfficiency);
  });
});

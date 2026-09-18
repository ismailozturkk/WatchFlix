import {
  getUsageStats,
  resetUsageStats,
  trackFirestoreRead,
  trackFirestoreWrite,
  trackFirestoreDelete,
  trackGeminiUsage,
  trackTmdbRequest,
  trackFunctionCall,
  getDailyAnalytics,
  calculateCostSummary,
  getTodayKey,
  PRICING,
  GEMINI_MODELS,
  ZONES,
} from "../services/usageTrackerService";
import { Keys, get, set } from "../services/storage";

describe("usageTrackerService - Durability & Telemetry Tests", () => {
  beforeEach(() => {
    resetUsageStats();
  });

  test("1. Initial state is populated with valid default structures", () => {
    const stats = getUsageStats();
    expect(stats).toBeDefined();
    expect(typeof stats.startedAt).toBe("number");
    expect(stats.firestore.reads).toBe(0);
    expect(stats.firestore.writes).toBe(0);
    expect(stats.gemini.requests).toBe(0);
    expect(stats.tmdb.totalRequests).toBe(0);
    expect(stats.dailyHistory).toBeDefined();
    expect(Array.isArray(stats.recentLogs)).toBe(true);
  });

  test("2. trackFirestoreRead updates firestore totals, collection, zone, and daily bucket", () => {
    trackFirestoreRead("Posts", 5);
    trackFirestoreRead("Users/friends", 3);

    const stats = getUsageStats();
    expect(stats.firestore.reads).toBe(8);
    expect(stats.firestore.collections["Posts"].reads).toBe(5);
    expect(stats.firestore.collections["Users/friends"].reads).toBe(3);

    // Zone check (Posts -> social, Users/friends -> profile)
    expect(stats.firestore.zones.social.reads).toBe(5);
    expect(stats.firestore.zones.profile.reads).toBe(3);

    // Daily bucket check
    const todayKey = getTodayKey();
    expect(stats.dailyHistory[todayKey]).toBeDefined();
    expect(stats.dailyHistory[todayKey].firestore.reads).toBe(8);
    expect(stats.dailyHistory[todayKey].zones.social.reads).toBe(5);
  });

  test("3. trackFirestoreWrite and trackFirestoreDelete update correctly", () => {
    trackFirestoreWrite("Lists/watchlist", 2);
    trackFirestoreDelete("Lists/watchlist", 1);

    const stats = getUsageStats();
    expect(stats.firestore.writes).toBe(2);
    expect(stats.firestore.deletes).toBe(1);
    expect(stats.firestore.collections["Lists/watchlist"].writes).toBe(2);
    expect(stats.firestore.collections["Lists/watchlist"].deletes).toBe(1);
    expect(stats.firestore.zones.lists.writes).toBe(2);
    expect(stats.firestore.zones.lists.deletes).toBe(1);
  });

  test("4. trackGeminiUsage accurately calculates 4x output cost, models, and tokens", () => {
    trackGeminiUsage({
      model: "gemini-2.5-flash",
      promptTokens: 1000,
      outputTokens: 200,
      thoughtsTokens: 50,
    });

    const stats = getUsageStats();
    expect(stats.gemini.requests).toBe(1);
    expect(stats.gemini.promptTokens).toBe(1000);
    expect(stats.gemini.outputTokens).toBe(200);
    expect(stats.gemini.thoughtsTokens).toBe(50);
    expect(stats.gemini.totalTokens).toBe(1250);

    const expectedPromptCost = (1000 / 1e6) * GEMINI_MODELS["gemini-2.5-flash"].inputPricePerMillion;
    const expectedOutputCost = (250 / 1e6) * GEMINI_MODELS["gemini-2.5-flash"].outputPricePerMillion;
    const expectedTotalCost = expectedPromptCost + expectedOutputCost;

    expect(stats.gemini.promptCostUsd).toBeCloseTo(expectedPromptCost, 6);
    expect(stats.gemini.outputCostUsd).toBeCloseTo(expectedOutputCost, 6);
    expect(stats.gemini.totalCostUsd).toBeCloseTo(expectedTotalCost, 6);

    // Model breakdown check
    expect(stats.gemini.models["gemini-2.5-flash"]).toBeDefined();
    expect(stats.gemini.models["gemini-2.5-flash"].requests).toBe(1);
    expect(stats.gemini.models["gemini-2.5-flash"].tokens).toBe(1250);
  });

  test("5. trackTmdbRequest accurately measures SWR cache ratio and efficiency", () => {
    trackTmdbRequest("/movie/popular", true); // cached
    trackTmdbRequest("/movie/top_rated", true); // cached
    trackTmdbRequest("/search/movie", false); // network
    trackTmdbRequest("/tv/popular", true); // cached

    const stats = getUsageStats();
    expect(stats.tmdb.totalRequests).toBe(4);
    expect(stats.tmdb.cachedRequests).toBe(3);
    expect(stats.tmdb.networkRequests).toBe(1);

    const summary = calculateCostSummary(stats);
    expect(summary.tmdb.cacheEfficiency).toBe(75);
  });

  test("6. calculateCostSummary returns complete, valid, null-safe objects with TRY rates", () => {
    trackFirestoreRead("posts", 100);
    trackFirestoreWrite("posts", 20);
    trackGeminiUsage({ promptTokens: 500, outputTokens: 100 });

    const stats = getUsageStats();
    const costSummary = calculateCostSummary(stats);

    expect(costSummary).toBeDefined();
    expect(typeof costSummary.firestore.totalCost).toBe("number");
    expect(typeof costSummary.firestore.totalCostTry).toBe("number");
    expect(typeof costSummary.firestore.readCostTry).toBe("number");
    expect(typeof costSummary.firestore.writeCostTry).toBe("number");
    expect(typeof costSummary.gemini.totalCost).toBe("number");
    expect(typeof costSummary.gemini.totalCostTry).toBe("number");
    expect(typeof costSummary.totalUsd).toBe("number");
    expect(typeof costSummary.totalTry).toBe("number");
    expect(typeof costSummary.netPayableUsd).toBe("number");
    expect(typeof costSummary.netPayableTry).toBe("number");

    // Free tier check (100 reads & 20 writes is within 50k/20k limit)
    expect(costSummary.netPayableUsd).toBe(costSummary.gemini.totalCost);
  });

  test("7. getDailyAnalytics properly aggregates and sorts historical days", () => {
    trackFirestoreRead("posts", 50);
    const stats = getUsageStats();
    const days = getDailyAnalytics(stats);

    expect(Array.isArray(days)).toBe(true);
    expect(days.length).toBeGreaterThanOrEqual(1);

    const today = days[0];
    expect(today.dateKey).toBe(getTodayKey());
    expect(today.firestore.reads).toBe(50);
    expect(today.hourlyOps).toBeDefined();
    expect(today.hourlyOps.length).toBe(24);
  });

  test("8. Persistence Durability: Data is retained on storage reload", () => {
    trackFirestoreRead("Users", 25);
    trackFirestoreWrite("Users", 10);
    trackGeminiUsage({ promptTokens: 2000, outputTokens: 500 });
    trackTmdbRequest("/trending/all", true);

    const savedRaw = get(Keys.usageStats);
    expect(savedRaw).toBeDefined();
    expect(savedRaw.firestore.reads).toBe(25);
    expect(savedRaw.firestore.writes).toBe(10);
    expect(savedRaw.gemini.requests).toBe(1);
    expect(savedRaw.tmdb.cachedRequests).toBe(1);
  });
});

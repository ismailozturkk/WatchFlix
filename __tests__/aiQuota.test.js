const {
  AI_PLAN_LIMITS,
  resolveAiPlan,
  readAiUsage,
  buildAiQuota,
} = require("../functions/aiQuota");

describe("AI plan quotas", () => {
  test("uses the configured daily and monthly limits", () => {
    expect(AI_PLAN_LIMITS).toEqual({
      free: { daily: 5, monthly: 30 },
      premium: { daily: 20, monthly: 300 },
      unlimited: { daily: 50, monthly: 900 },
    });
  });

  test("resolves free, premium and unlimited entitlements", () => {
    expect(resolveAiPlan()).toBe("free");
    expect(resolveAiPlan({ premium: true })).toBe("premium");
    expect(resolveAiPlan({ premium: true, premiumUnlimited: true })).toBe("unlimited");
    expect(resolveAiPlan({ premiumPlan: "unlimited" })).toBe("unlimited");
  });

  test("migrates today's legacy counter and resets stale periods", () => {
    expect(
      readAiUsage(
        { date: "2026-08-02", count: 4, monthKey: "2026-08", monthlyCount: 12 },
        "2026-08-02",
        "2026-08",
      ),
    ).toEqual({ dailyUsed: 4, monthlyUsed: 12 });

    expect(
      readAiUsage(
        { date: "2026-08-01", count: 5, monthKey: "2026-07", monthlyCount: 30 },
        "2026-08-02",
        "2026-08",
      ),
    ).toEqual({ dailyUsed: 0, monthlyUsed: 0 });
  });

  test("returns backward-compatible daily fields with monthly details", () => {
    expect(buildAiQuota("premium", 7, 42)).toEqual({
      plan: "premium",
      used: 7,
      limit: 20,
      remaining: 13,
      daily: { used: 7, limit: 20, remaining: 13 },
      monthly: { used: 42, limit: 300, remaining: 258 },
    });
  });
});

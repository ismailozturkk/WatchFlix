"use strict";

const AI_PLAN_LIMITS = Object.freeze({
  free: Object.freeze({ daily: 5, monthly: 30 }),
  premium: Object.freeze({ daily: 20, monthly: 300 }),
  unlimited: Object.freeze({ daily: 50, monthly: 900 }),
});

function resolveAiPlan(entitlements) {
  if (
    entitlements?.premiumUnlimited === true ||
    entitlements?.premiumPlan === "unlimited"
  ) {
    return "unlimited";
  }
  if (entitlements?.premium === true) return "premium";
  return "free";
}

function getAiPlanLimits(plan) {
  return AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.free;
}

function readAiUsage(data = {}, dayKey, monthKey) {
  const legacyDailyCount =
    data.date === dayKey && Number.isFinite(data.count) ? data.count : 0;
  const dailyUsed =
    data.dailyKey === dayKey && Number.isFinite(data.dailyCount)
      ? data.dailyCount
      : legacyDailyCount;
  const monthlyUsed =
    data.monthKey === monthKey && Number.isFinite(data.monthlyCount)
      ? data.monthlyCount
      : 0;

  return {
    dailyUsed: Math.max(0, dailyUsed),
    monthlyUsed: Math.max(0, monthlyUsed),
  };
}

function buildAiQuota(plan, dailyUsed, monthlyUsed) {
  const limits = getAiPlanLimits(plan);
  const daily = {
    used: dailyUsed,
    limit: limits.daily,
    remaining: Math.max(0, limits.daily - dailyUsed),
  };
  const monthly = {
    used: monthlyUsed,
    limit: limits.monthly,
    remaining: Math.max(0, limits.monthly - monthlyUsed),
  };

  return {
    plan,
    // Eski istemciler günlük kotayı bu alanlardan okumaya devam edebilir.
    used: daily.used,
    limit: daily.limit,
    remaining: daily.remaining,
    daily,
    monthly,
  };
}

module.exports = {
  AI_PLAN_LIMITS,
  resolveAiPlan,
  getAiPlanLimits,
  readAiUsage,
  buildAiQuota,
};

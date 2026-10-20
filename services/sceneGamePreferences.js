// services/sceneGamePreferences.js
//
// Sahne tahmin oyununun son ayarları (mod / zorluk / kaynak). Kullanıcı
// kapsamlı; anahtar adı geçişte korundu (bkz. registry: sceneGamePreferences).

import { Keys, get, set } from "./storage";

const normalizeId = (value, fallback) => {
  const normalized = String(value || "").trim();
  return normalized && normalized.length <= 80 ? normalized : fallback;
};

export async function loadSceneGamePreferences(uid) {
  const value = get(Keys.sceneGamePreferences, { uid });
  if (!value) return null;
  return {
    modeId: normalizeId(value?.modeId, "classic"),
    difficultyId: normalizeId(value?.difficultyId, "normal"),
    sourceId: normalizeId(value?.sourceId, "popular"),
    updatedAt: value?.updatedAt || null,
  };
}

export async function saveSceneGamePreferences(uid, preferences) {
  const value = {
    modeId: normalizeId(preferences?.modeId, "classic"),
    difficultyId: normalizeId(preferences?.difficultyId, "normal"),
    sourceId: normalizeId(preferences?.sourceId, "popular"),
    updatedAt: new Date().toISOString(),
  };
  return set(Keys.sceneGamePreferences, value, { uid }) ? value : null;
}

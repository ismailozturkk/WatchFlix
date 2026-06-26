import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "scene_game:last_settings:";
const FALLBACK_USER_KEY = "guest";

const storageKey = (uid) => `${STORAGE_PREFIX}${uid || FALLBACK_USER_KEY}`;

const normalizeId = (value, fallback) => {
  const normalized = String(value || "").trim();
  return normalized && normalized.length <= 80 ? normalized : fallback;
};

export async function loadSceneGamePreferences(uid) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return {
      modeId: normalizeId(value?.modeId, "classic"),
      difficultyId: normalizeId(value?.difficultyId, "normal"),
      sourceId: normalizeId(value?.sourceId, "popular"),
      updatedAt: value?.updatedAt || null,
    };
  } catch {
    return null;
  }
}

export async function saveSceneGamePreferences(uid, preferences) {
  const value = {
    modeId: normalizeId(preferences?.modeId, "classic"),
    difficultyId: normalizeId(preferences?.difficultyId, "normal"),
    sourceId: normalizeId(preferences?.sourceId, "popular"),
    updatedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

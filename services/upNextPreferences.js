import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "up-next:preferences:";
const FALLBACK_USER_KEY = "guest";

const storageKey = (uid) => `${STORAGE_PREFIX}${uid || FALLBACK_USER_KEY}`;

export function normalizeUpNextPreferences(value) {
  const hiddenShowIds = Array.isArray(value?.hiddenShowIds)
    ? [
        ...new Set(
          value.hiddenShowIds
            .filter((id) => id !== null && id !== undefined && id !== "")
            .map(String)
        ),
      ]
    : [];
  return {
    hiddenShowIds,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
  };
}

export async function loadUpNextPreferences(uid) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    return normalizeUpNextPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeUpNextPreferences(null);
  }
}

export async function saveUpNextPreferences(uid, preferences) {
  const normalized = {
    ...normalizeUpNextPreferences(preferences),
    updatedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

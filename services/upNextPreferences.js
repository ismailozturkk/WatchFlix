// services/upNextPreferences.js
//
// "Sıradaki" rayının kullanıcı tercihleri (gizlenen diziler). Anahtar zaten
// uid ile kapsanmıştı; MMKV geçişinde fiziksel ad korundu (bkz. registry:
// upNextPreferences), böylece göç düz kopya oldu.

import { Keys, get, set } from "./storage";

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
  return normalizeUpNextPreferences(get(Keys.upNextPreferences, { uid }));
}

export async function saveUpNextPreferences(uid, preferences) {
  const normalized = {
    ...normalizeUpNextPreferences(preferences),
    updatedAt: new Date().toISOString(),
  };
  return set(Keys.upNextPreferences, normalized, { uid }) ? normalized : null;
}

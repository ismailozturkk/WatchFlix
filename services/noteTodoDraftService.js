// Todo düzenleme modalındaki kaydedilmemiş değişikliklerin cihaz içi sahibi.
// Buluta yazmaz; kullanıcı "Kaydet" dediğinde ProfileNotesContext devralır.

import { Keys, get, set } from "./storage";

const readDrafts = () => {
  const value = get(Keys.noteTodoDrafts);
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

export const todoDraftKey = (noteId) => noteId ? `note:${noteId}` : "new";

export function getNoteTodoDraft(key) {
  return readDrafts()[key] || null;
}

export function saveNoteTodoDraft(key, draft) {
  if (!key || !draft || typeof draft !== "object") return false;
  return set(Keys.noteTodoDrafts, { ...readDrafts(), [key]: draft });
}

export function removeNoteTodoDraft(key) {
  if (!key) return false;
  const current = readDrafts();
  if (!Object.prototype.hasOwnProperty.call(current, key)) return true;
  const next = { ...current };
  delete next[key];
  return set(Keys.noteTodoDrafts, next);
}

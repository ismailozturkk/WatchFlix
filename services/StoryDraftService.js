// services/StoryDraftService.js
//
// Story taslakları. GİZLİLİK DÜZELTMESİ: kayıt eskiden uid'siz global bir
// anahtardaydı (`story_drafts_v1`), yani aynı cihazda hesap değiştiren kullanıcı
// öncekinin yayınlanmamış taslaklarını görüyordu. Artık kullanıcı kapsamlı;
// aktif uid'i depolama katmanı çözüyor, bu yüzden imzalar değişmedi.
//
// Fonksiyonlar async kaldı: çağrı yerlerinin tamamı `await` ile kullanıyor ve
// MMKV senkron olduğu için bu yalnızca bir mikro-görev maliyeti.

import { Keys, get, set } from "./storage";

const readAll = () => {
  const list = get(Keys.storyDrafts);
  return Array.isArray(list) ? list : [];
};

const writeAll = (list) => set(Keys.storyDrafts, list);

export const StoryDraftService = {
  /* En yeni üstte */
  async getDrafts() {
    return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async getDraftById(id) {
    return readAll().find((d) => d.id === id) || null;
  },

  async saveDraft(data) {
    const list = readAll();
    const now = Date.now();
    const draft = {
      id: `draft_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    list.push(draft);
    writeAll(list);
    return draft;
  },

  async updateDraft(id, data) {
    const list = readAll();
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updatedAt: Date.now() };
    writeAll(list);
    return list[idx];
  },

  async deleteDraft(id) {
    writeAll(readAll().filter((d) => d.id !== id));
  },
};

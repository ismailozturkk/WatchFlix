import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "story_drafts_v1";

const readAll = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeAll = async (list) => {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
};

export const StoryDraftService = {
  /* En yeni üstte */
  async getDrafts() {
    const list = await readAll();
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async getDraftById(id) {
    const list = await readAll();
    return list.find((d) => d.id === id) || null;
  },

  async saveDraft(data) {
    const list = await readAll();
    const now = Date.now();
    const draft = {
      id: `draft_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    list.push(draft);
    await writeAll(list);
    return draft;
  },

  async updateDraft(id, data) {
    const list = await readAll();
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updatedAt: Date.now() };
    await writeAll(list);
    return list[idx];
  },

  async deleteDraft(id) {
    const list = await readAll();
    await writeAll(list.filter((d) => d.id !== id));
  },
};

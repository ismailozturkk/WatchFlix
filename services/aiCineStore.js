// services/aiCineStore.js
//
// CineMatch Pro (yapılandırılmış AI) sohbet geçmişi — AsyncStorage kalıcılığı.
// Eski CineMatch (aiConversationsStore.js) ile AYRI bir anahtarda saklanır.
//
// Conversation = { id, title, messages: Message[], createdAt, updatedAt }
// Message = {
//   id, role: "user" | "assistant",
//   text?: string,          // user mesajı + history için
//   display?: string,       // baloncukta gösterilecek kullanıcı metni
//   aiResponse?: object,    // assistant: normalize edilmiş yapılandırılmış cevap
//   posterMap?: object,     // assistant: posterKey -> TMDB kartı
//   status?: "error", retry?: string,
// }

import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeId, summarizeTitle } from "./aiConversationsStore";

export { makeId, summarizeTitle };

const STORAGE_KEY = "@seelogd/ai_cine_conversations";
const MAX_CONVERSATIONS = 50;
let mutationQueue = Promise.resolve();

/** Tüm sohbetleri yükler (en yeni en üstte). */
export async function loadCineConversations() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

/** Tüm listeyi diske yazar (en yeni en üstte, MAX ile sınırlı). */
export async function persistCineConversations(list) {
  try {
    const trimmed = [...list]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, MAX_CONVERSATIONS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return list;
  }
}

/** Bir sohbeti listeye ekler/günceller. */
export function upsertCineConversation(list, conversation) {
  return [conversation, ...list.filter((c) => c.id !== conversation.id)].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );
}

/** Cevabı yeni sohbet olarak ekler; aynı id geldiyse mevcut sohbeti günceller. */
export function saveCineConversation(conversation) {
  const operation = mutationQueue.then(async () => {
    if (!conversation?.id) return loadCineConversations();

    const current = await loadCineConversations();
    const existing = current.find((item) => item.id === conversation.id);
    const now = Date.now();
    const merged = {
      ...existing,
      ...conversation,
      createdAt: existing?.createdAt || conversation.createdAt || now,
      updatedAt: conversation.updatedAt || now,
    };

    return persistCineConversations(upsertCineConversation(current, merged));
  });

  mutationQueue = operation.catch(() => []);
  return operation;
}

/** Bir sohbeti listeden çıkarır. */
export function removeCineConversation(list, id) {
  return list.filter((c) => c.id !== id);
}

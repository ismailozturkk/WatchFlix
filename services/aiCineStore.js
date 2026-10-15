// services/aiCineStore.js
//
// CineMatch Pro (yapılandırılmış AI) sohbet geçmişi — MMKV kalıcılığı.
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

import { Keys, get, set } from "./storage";
import { makeId, summarizeTitle } from "./aiConversationsStore";

export { makeId, summarizeTitle };

const MAX_CONVERSATIONS = 50;
let mutationQueue = Promise.resolve();

/** Tüm sohbetleri yükler (en yeni en üstte). */
export async function loadCineConversations() {
  const parsed = get(Keys.aiCineConversations);
  if (!Array.isArray(parsed)) return [];
  return [...parsed].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Geçerli bir saklama sınırı ya da varsayılan (Ayarlar > Yapay zeka > Saklanacak sohbet). */
const limitOf = (limit) => {
  const n = Math.floor(Number(limit));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_CONVERSATIONS) : MAX_CONVERSATIONS;
};

/** Tüm listeyi diske yazar (en yeni en üstte, `limit` ile sınırlı; en fazla MAX). */
export async function persistCineConversations(list, limit) {
  const trimmed = [...list]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, limitOf(limit));
  return set(Keys.aiCineConversations, trimmed) ? trimmed : list;
}

/** Kayıtlı sohbetleri yeni sınıra indirir (en eskiler silinir). Güncel listeyi döndürür. */
export function trimCineConversations(limit) {
  const operation = mutationQueue.then(async () => {
    const current = await loadCineConversations();
    if (current.length <= limitOf(limit)) return current;
    return persistCineConversations(current, limit);
  });
  mutationQueue = operation.catch(() => []);
  return operation;
}

/** Kayıtlı tüm sohbetleri siler. */
export function clearCineConversations() {
  const operation = mutationQueue.then(async () => {
    set(Keys.aiCineConversations, []);
    return [];
  });
  mutationQueue = operation.catch(() => []);
  return operation;
}

/** Bir sohbeti listeye ekler/günceller. */
export function upsertCineConversation(list, conversation) {
  return [conversation, ...list.filter((c) => c.id !== conversation.id)].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );
}

/** Cevabı yeni sohbet olarak ekler; aynı id geldiyse mevcut sohbeti günceller. */
export function saveCineConversation(conversation, { limit } = {}) {
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

    return persistCineConversations(upsertCineConversation(current, merged), limit);
  });

  mutationQueue = operation.catch(() => []);
  return operation;
}

/** Bir sohbeti listeden çıkarır. */
export function removeCineConversation(list, id) {
  return list.filter((c) => c.id !== id);
}

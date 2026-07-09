// services/aiConversationsStore.js
//
// Watchify AI asistanı sohbet geçmişi — AsyncStorage kalıcılığı.
//
// Veri modeli (tek JSON blob altında saklanır):
//   Conversation = {
//     id: string,
//     title: string,                 // ilk kullanıcı mesajından türetilir
//     messages: Message[],
//     createdAt: number,             // epoch ms
//     updatedAt: number,             // epoch ms
//   }
//   Message = {
//     id: string,
//     role: "user" | "assistant",
//     text: string,
//     cards?: Card[],                // yalnızca assistant mesajlarında (poster kartları)
//     status?: "error",
//   }
//   Card = { key, mediaType: "movie"|"tv", query, found, id?, title?, posterPath?, year?, rating? }
//
// Saklama: tüm sohbetler tek anahtarda. Veri küçük olduğundan basit ve hızlı.

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@whatchflix/ai_conversations";
const MAX_CONVERSATIONS = 50; // sınırsız büyümesini engelle

/** Basit, çakışması düşük id üretici. */
export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** İlk kullanıcı mesajından kısa bir başlık türetir. */
export function summarizeTitle(text = "") {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "…";
  return clean.length > 42 ? clean.slice(0, 42).trim() + "…" : clean;
}

/** Tüm sohbetleri yükler (en yeni en üstte). */
export async function loadConversations() {
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
export async function persistConversations(list) {
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

/**
 * Bir sohbeti listeye ekler/günceller ve döndürür (state + disk için).
 * Var olan id güncellenir, yoksa eklenir.
 */
export function upsertConversation(list, conversation) {
  const idx = list.findIndex((c) => c.id === conversation.id);
  if (idx === -1) return [conversation, ...list];
  const next = [...list];
  next[idx] = conversation;
  return next;
}

/** Bir sohbeti listeden çıkarır. */
export function removeConversation(list, id) {
  return list.filter((c) => c.id !== id);
}

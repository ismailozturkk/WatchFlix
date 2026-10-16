// services/userData/aiConversations.js
//
// CineMatch (AI) SOHBET GEÇMİŞİ — bulut şeması + yerel-öncelikli depo API'si.
// Firebase import etmez (saf mantık + enjekte edilen motor), bu yüzden Jest'te
// doğrudan test edilir.
//
// ── ŞEMA ─────────────────────────────────────────────────────────────────────
//
//   AiConversations/{uid}/items/{conversationId}      (sahibi okur/yazar)
//
//   {
//     v: 1,                       // şema sürümü
//     id, title,
//     messages: Message[],        // aiCineStore.js'in başındaki Message şekli
//     messageCount,               // saklanan mesaj sayısı (liste önizlemesi için)
//     createdAt, updatedAt,       // epoch ms
//   }
//
// BİR SOHBET = BİR BELGE. Mesajları alt koleksiyona bölmek ilk indirmede
// (sohbet sayısı + her sohbetin mesaj koleksiyonu) okuma sayısını ~20 kat
// artırırdı; tek belgede indirme = sohbet başına 1 okuma, her cevap = 1 yazma.
// Karşılığı: Firestore belge tavanı 1 MiB → aşağıdaki bütçe.
//
// ── BOYUT BÜTÇESİ ────────────────────────────────────────────────────────────
//
// Bir asistan mesajı yapılandırılmış cevap + TMDB kart haritası taşır (birkaç KB).
// Uzun bir sohbet 1 MiB'ı aşamaz; ayrıca yazma günlüğü (outbox) belgenin tamamını
// MMKV'de tutar. Bu yüzden belge `MAX_DOC_BYTES`ı geçerse EN ESKİ mesajlar
// (tam tur — kullanıcı + asistan çifti — olarak) belgeden düşer. Sohbetin
// başlığı ayrı saklandığı için kaybolmaz.
//
// ── ÇOK CİHAZ ────────────────────────────────────────────────────────────────
//
// Motorun genel kuralı geçerli: canlı dinleyici YOK, yerel kopya kaynak, bulut
// yedek + yeni cihaza taşıma. Başka cihazdaki değişiklikler `refresh` (geçmiş
// ekranında aşağı çek) ile görünür.

import { stripUndefined } from "./sanitize";

export const AI_CONVERSATION_SCHEMA = 1;

/** Kullanıcı başına saklanan en çok sohbet (Ayarlar'daki seçenekler bunun altında). */
export const MAX_CONVERSATIONS = 50;

/**
 * Tek sohbet belgesinin JSON'unun UTF-8 bayt üst sınırı. Firestore tavanı 1 MiB ama
 * kendi boyut hesabı JSON'dan büyük çıkar (sayılar 8 bayt, her alan adı +1, dizgeler
 * +1); sayı yoğun kartlar için ~2 kat pay bırakıldı.
 */
export const MAX_DOC_BYTES = 450_000;
/** Mesaj sayısı üst sınırı (bütçeden bağımsız ikinci koruma). */
export const MAX_MESSAGES = 200;

const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Geçerli bir saklama sınırı ya da varsayılan. */
export function limitOf(limit) {
  const n = Math.floor(Number(limit));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_CONVERSATIONS) : MAX_CONVERSATIONS;
}

/**
 * Firestore dizi içinde doğrudan dizi kabul etmez ("Nested arrays are not
 * supported"); tek bir kötü alan tüm batch'i düşürürdü. Model çıktısı serbest
 * biçimli olduğu için iç dizi bir düzey düzleştirilir. Girdiyi değiştirmez.
 */
export function flattenNestedArrays(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      if (Array.isArray(item)) out.push(...flattenNestedArrays(item));
      else out.push(flattenNestedArrays(item));
    }
    return out;
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = flattenNestedArrays(item);
    return out;
  }
  return value;
}

/**
 * Dizgenin UTF-8 bayt uzunluğu. Türkçe/İspanyolca vurgulu harf 2, CJK/emoji 3-4 bayt:
 * karakter sayısıyla bütçelemek ASCII dışı sohbetlerde Firestore tavanını aşardı.
 * (TextEncoder her Hermes sürümünde yok; elle sayılır.)
 */
export function utf8Length(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // vekil çift (emoji…): ikinci yarısını atla
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Belgenin yaklaşık boyutu (UTF-8 bayt). Serileştirilemiyorsa sonsuz. */
export const docBytes = (doc) => {
  try {
    return utf8Length(JSON.stringify(doc));
  } catch {
    return Infinity;
  }
};

/**
 * Mesaj listesini bütçeye sığdırır: en eski TURLAR (baştaki mesajlar, bir
 * sonraki kullanıcı mesajına kadar) düşer. Hiç sığmıyorsa son tur kalır.
 * @returns {{messages:object[], dropped:number}}
 */
export function fitMessages(messages, build, maxBytes = MAX_DOC_BYTES) {
  let list = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
  let dropped = messages.length - list.length;

  // Başlangıç: ilk mesaj kullanıcı mesajı olsun (yarım tur ile açılmasın).
  const trimLeadingAssistant = () => {
    let i = 0;
    while (i < list.length - 1 && list[i].role !== "user") i += 1;
    if (i > 0) {
      list = list.slice(i);
      dropped += i;
    }
  };
  trimLeadingAssistant();

  while (list.length > 1 && docBytes(build(list)) > maxBytes) {
    let next = 1;
    while (next < list.length - 1 && list[next].role !== "user") next += 1;
    dropped += next;
    list = list.slice(next);
  }
  return { messages: list, dropped };
}

/**
 * Ekranın kurduğu sohbet nesnesinden BULUTA/DİSKE yazılacak belgeyi üretir.
 * `existing` varsa oluşturulma zamanı korunur (ekran her kayıtta `createdAt: now`
 * gönderir). Geçersiz girdide null.
 */
export function toConversationDoc(conversation, existing = null, now = Date.now()) {
  if (!conversation || typeof conversation.id !== "string" || !conversation.id) return null;
  if (!Array.isArray(conversation.messages)) return null;

  const base = (messages) => ({
    v: AI_CONVERSATION_SCHEMA,
    id: conversation.id,
    title: String(conversation.title || existing?.title || "…"),
    messages,
    messageCount: messages.length,
    createdAt: num(existing?.createdAt, num(conversation.createdAt, now)),
    updatedAt: num(conversation.updatedAt, now),
  });

  const clean = stripUndefined(
    flattenNestedArrays(conversation.messages.filter((m) => m && typeof m === "object")),
  );
  const { messages } = fitMessages(clean, base);
  return base(messages);
}

const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

/**
 * @param {object} domain  createUserDataDomain(aiConversationsSpec, …)
 * @param {object} [legacy]  eski yerel depo (MMKV): { read(uid), clear(uid) }
 */
export function createAiConversationsApi(domain, legacy = null) {
  const view = (uid) => domain.getSnapshot(uid);
  const listOf = (uid) => (uid ? view(uid).lists.items : []);

  /** Saklama sınırını aşan en eski sohbetlerin silme değişiklikleri. */
  const overflowDeletes = (items, limit) =>
    [...items]
      .sort(byRecent)
      .slice(limitOf(limit))
      .map((conv) => ({ kind: "items", key: conv.id }));

  const api = {
    /** En yeni en üstte. Senkron — yerel kopyadan. */
    list: listOf,

    get(uid, id) {
      return uid && id ? view(uid).get("items", id) || null : null;
    },

    /**
     * Sohbeti ekler/günceller; sınırı aşan en eski sohbetleri AYNI adımda siler
     * (yerel + bulut). Güncel listeyi döndürür.
     */
    save(uid, conversation, { limit } = {}) {
      if (!uid) return [];
      const existing = api.get(uid, conversation?.id);
      const doc = toConversationDoc(conversation, existing);
      if (!doc) return listOf(uid);

      // Yeni belge henüz görünümde değil; sınır hesabına eklenmiş say. Kaydedilen
      // sohbet en yeni olduğundan kendi kendini silmez (updatedAt = şimdi).
      const withNew = [doc, ...listOf(uid).filter((c) => c.id !== doc.id)];
      const overflow = overflowDeletes(withNew, limit).filter((change) => change.key !== doc.id);
      domain.apply(uid, [{ kind: "items", doc }, ...overflow]);
      return listOf(uid);
    },

    remove(uid, id) {
      if (!uid || !id) return listOf(uid);
      domain.apply(uid, [{ kind: "items", key: id }]);
      return listOf(uid);
    },

    /** Tüm sohbetleri siler (yerel + bulut). */
    clearAll(uid) {
      if (!uid) return [];
      const changes = listOf(uid).map((conv) => ({ kind: "items", key: conv.id }));
      if (changes.length) domain.apply(uid, changes);
      return listOf(uid);
    },

    /** Yeni sınıra indirir (en eskiler silinir). Güncel listeyi döndürür. */
    trim(uid, limit) {
      if (!uid) return [];
      const changes = overflowDeletes(listOf(uid), limit);
      if (changes.length) domain.apply(uid, changes);
      return listOf(uid);
    },

    /**
     * Eski sürümün yerel (MMKV) geçmişini buluta taşır, sonra yerel anahtarı
     * siler. İdempotent: ikinci çağrıda okunacak bir şey kalmaz. Yazma günlüğüne
     * girdikten sonra silinir — ağ olmasa da kayıp yok (günlük MMKV'de kalıcı).
     * @returns {number} taşınan sohbet sayısı
     */
    migrateLegacy(uid) {
      if (!uid || !legacy) return 0;
      let old;
      try {
        old = legacy.read(uid);
      } catch {
        return 0;
      }
      if (!Array.isArray(old) || old.length === 0) return 0;

      const known = new Map(listOf(uid).map((conv) => [conv.id, conv]));
      const changes = [];
      for (const conv of old) {
        const existing = known.get(conv?.id);
        // Bulutta/yerelde daha yeni bir sürüm varsa eski kopya ezmez.
        if (existing && (existing.updatedAt || 0) >= (conv.updatedAt || 0)) continue;
        const doc = toConversationDoc(conv, existing || null, conv?.updatedAt || Date.now());
        if (doc) changes.push({ kind: "items", doc });
      }
      // Eski sürümde sınır 50 idi; yine de üstünü taşıma.
      changes.sort((a, b) => (b.doc.updatedAt || 0) - (a.doc.updatedAt || 0));
      const batch = changes.slice(0, MAX_CONVERSATIONS);
      if (batch.length) domain.apply(uid, batch);
      legacy.clear(uid);
      return batch.length;
    },
  };
  return api;
}

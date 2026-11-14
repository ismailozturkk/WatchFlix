// services/libraryCommentsIO.js
//
// Film/dizi YORUMLARININ dışa / içe aktarılması (Kütüphane yedeği v2).
//
// OKUMA: yorumların tek indeksi Users/{uid}/myComments aynasıdır (hesap silme de bununla yürür). Ayna metni
// ve tarihi taşır ama spoiler işaretini taşımaz: üst seviye yorumların asıl belgesi de okunur (sınırlı eşzamanlılık).
// Asıl belge silinmişse (ayna öksüz kalmış) yorum DOSYAYA GİRMEZ — artık var olmayan bir yorumu geri getirmeyiz.
// Gönderi (post) yorumları kapsam dışı: sosyal akışa aittir, film/dizi kütüphanesine değil.
//
// YAZMA: yalnız ÜST SEVİYE yorumlar geri yazılır. Yanıtlar başkasının yorumuna bağlıdır; ebeveyn silinmiş ya da
// sayaç kuralı (mediaCommentCounterOk) başkasının belgesine dokunmayı gerektirir → dosyada kalır, yazılmaz.
// Belge kimliği dosyadaki ÖZGÜN kimliktir: aynı dosyayı ikinci kez aktarmak hiçbir şeyi çoğaltmaz (transaction
// içinde "var mı" bakılır). Aynı başlığa birebir aynı metinle yazılmış başka bir yorum varsa (ör. hesap sıfırlandıktan
// sonra elle yeniden yazılmış) o da atlanır. Yazım biçimi services/mediaCommentsService.addMediaComment ile aynıdır.

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { identityAvatar } from "../utils/avatarPhotos";
import { cleanComments } from "../utils/libraryExport";
import { scopeWriteFields } from "../utils/commentScope";
import { isOfflineFirestoreError, isTransientFirestoreError, withRetry } from "./import/importRetry";
import { ImportError } from "./import/importErrors";

const READ_CONCURRENCY = 6;
const TX_RETRY = { retries: 3, baseMs: 400, maxMs: 4000, isRetryable: isTransientFirestoreError };
const collectionOf = (type) => (type === "tv" ? "TvComment" : "MovieComment");

const toIso = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const index = next++;
      out[index] = await fn(list[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

/**
 * Kullanıcının film/dizi yorumlarını dosya kaydı biçiminde okur. Hata fırlatmaz: okunamazsa `{ ok:false }`.
 * @returns {Promise<{ ok: boolean, comments: Array, error?: string }>}
 */
export async function readMyTitleComments(uid) {
  if (!uid) return { ok: false, comments: [], error: "no-user" };
  let mirror;
  try {
    const snap = await getDocs(collection(db, "Users", uid, "myComments"));
    mirror = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((c) => (c.kind === "movie" || c.kind === "tv") && c.targetId != null);
  } catch {
    return { ok: false, comments: [], error: "read-failed" };
  }

  const detailed = await mapLimit(mirror, READ_CONCURRENCY, async (entry) => {
    const coll = collectionOf(entry.kind);
    const ref = entry.parentId
      ? doc(db, coll, String(entry.targetId), "comments", String(entry.parentId), "replies", entry.id)
      : doc(db, coll, String(entry.targetId), "comments", entry.id);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null; // öksüz ayna: yorum artık yok
      const data = snap.data() || {};
      if (data.userId && data.userId !== uid) return null;
      return {
        id: entry.id,
        kind: entry.kind,
        targetId: entry.targetId,
        parentId: entry.parentId || null,
        text: data.text || entry.text,
        title: entry.title || "",
        poster: entry.poster || null,
        isSpoiler: data.isSpoiler === true,
        createdAt: toIso(data.timestamp) || toIso(entry.createdAt),
        scope: data.scope || entry.scope || null,
        seasonNumber: data.seasonNumber ?? entry.seasonNumber ?? null,
        episodeNumber: data.episodeNumber ?? entry.episodeNumber ?? null,
        scopeTitle: data.scopeTitle || entry.scopeTitle || null,
      };
    } catch {
      // Tek belge okunamadı (ağ dalgalanması): aynadaki bilgiyle yine dosyaya girer, spoiler bilinmez.
      return { ...entry, createdAt: toIso(entry.createdAt) };
    }
  });
  return { ok: true, comments: cleanComments(detailed.filter(Boolean)) };
}

/** "movie_550|metin" — aynı başlıkta birebir aynı metin. */
const textKey = (type, tmdbId, text) => `${type}_${tmdbId}|${String(text || "").trim()}`;

/**
 * Üst seviye yorumları geri yazar (sırayla; her biri kendi transaction'ında). Bağlantı koparsa ya da kullanıcı
 * durdurursa `ImportError` fırlatır; hatanın `stats` ve `processed` alanları kaldığı yeri taşır.
 * @param {string} uid
 * @param {Array} comments  dosya kayıtları (parentId'si dolu olanlar atlanır)
 * @param {{ userProfile?: object, signal?: { cancelled?: boolean },
 *   onProgress?: (done: number, total: number, detail: { comment: object, outcome: string }) => void }} [options]
 */
export async function restoreTitleComments(uid, comments, options = {}) {
  const { userProfile = {}, signal, onProgress } = options;
  const list = (Array.isArray(comments) ? comments : []).filter((c) => c && !c.parentId);
  const stats = { added: 0, existing: 0, duplicate: 0, failed: 0 };
  if (!uid || list.length === 0) return stats;

  const known = new Set();
  try {
    const snap = await getDocs(collection(db, "Users", uid, "myComments"));
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      if (!data.parentId) known.add(textKey(data.kind, data.targetId, data.text));
    });
  } catch (error) {
    if (isOfflineFirestoreError(error)) throw Object.assign(new ImportError("network", error?.message), { stats, processed: 0 });
    // Ayna okunamadıysa metin tekrarı denetimi atlanır; kimlik denetimi transaction'da yine var.
  }

  const avatar = identityAvatar(userProfile);
  const author = {
    userId: uid,
    username: userProfile.displayName || userProfile.name || "Kullanıcı",
    userHandle: userProfile.username || userProfile.userHandle || "",
    avatar: avatar.photoURL,
    authorPhotoURL: avatar.photoURL,
    avatarIndex: avatar.avatarIndex,
  };

  let processed = 0;
  let consecutiveFailures = 0;
  for (const comment of list) {
    if (signal?.cancelled) throw Object.assign(new ImportError("cancelled"), { stats, processed });
    const key = textKey(comment.type, comment.tmdbId, comment.text);
    let outcome;
    if (known.has(key)) {
      outcome = "duplicate";
    } else {
      const coll = collectionOf(comment.type);
      const targetId = String(comment.tmdbId);
      const commentRef = doc(db, coll, targetId, "comments", comment.id);
      const mirrorRef = doc(db, "Users", uid, "myComments", comment.id);
      const createdAt = comment.createdAt ? new Date(comment.createdAt) : null;
      const timestamp = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : serverTimestamp();
      // Kapsam alanları uygulamanın yazdığı biçimle birebir (utils/commentScope.scopeWriteFields).
      const scopeFields = comment.type === "tv" ? scopeWriteFields(comment.scope || { scope: "show" }) : {};
      try {
        outcome = await withRetry(
          () =>
            runTransaction(db, async (tx) => {
              const [commentSnap, mirrorSnap] = await Promise.all([tx.get(commentRef), tx.get(mirrorRef)]);
              if (commentSnap.exists()) {
                // Kendi yorumumuz zaten yerinde; ayna eksikse tamamlanır (sayaç değişmez).
                if (commentSnap.data()?.userId === uid && !mirrorSnap.exists()) {
                  tx.set(mirrorRef, {
                    kind: comment.type,
                    targetId,
                    parentId: null,
                    text: commentSnap.data()?.text || comment.text,
                    title: comment.title || "",
                    poster: comment.poster || null,
                    createdAt: timestamp,
                    restored: true,
                    ...scopeFields,
                  });
                }
                return "existing";
              }
              tx.set(commentRef, {
                ...author,
                text: comment.text,
                isSpoiler: comment.isSpoiler === true,
                parentId: null,
                likeCount: 0,
                likedBy: {},
                replyCount: 0,
                timestamp,
                restored: true,
                ...scopeFields,
              });
              tx.set(mirrorRef, {
                kind: comment.type,
                targetId,
                parentId: null,
                text: comment.text,
                title: comment.title || "",
                poster: comment.poster || null,
                createdAt: timestamp,
                restored: true,
                ...scopeFields,
              });
              if (!mirrorSnap.exists()) tx.set(doc(db, "Users", uid), { mediaCommentCount: increment(1) }, { merge: true });
              tx.set(
                doc(db, "Lists", uid),
                { activityIndex: { comments: arrayUnion(`${comment.type}_${targetId}`) }, updatedAt: serverTimestamp(), _schemaVersion: 3 },
                { merge: true },
              );
              return "added";
            }),
          { ...TX_RETRY, signal },
        );
        consecutiveFailures = 0;
      } catch (error) {
        if (error?.code === "cancelled" || isOfflineFirestoreError(error)) {
          const wrapped = error instanceof ImportError ? error : new ImportError(error?.code === "cancelled" ? "cancelled" : "network", error?.message);
          throw Object.assign(wrapped, { stats, processed });
        }
        outcome = "failed";
        consecutiveFailures += 1;
      }
    }
    stats[outcome] += 1;
    if (outcome === "added") known.add(key);
    processed += 1;
    onProgress?.(processed, list.length, { comment, outcome });
    if (consecutiveFailures >= 6) {
      throw Object.assign(new ImportError("saveInterrupted", "Too many comment failures."), { stats, processed });
    }
  }
  return stats;
}

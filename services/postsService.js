// services/postsService.js
//
// Firestore CRUD katmanı — UI hiçbir zaman Firestore'a doğrudan dokunmasın.
// Bütün koleksiyon yapısı `FIRESTORE_SCHEMA.txt`'te dokümante edilmeli.
//
// Posts/{postId}
//   authorId          : string
//   authorName        : string                (denormalize)
//   authorAvatarIndex : number 0-55           (utils/avatars.js -> getAvatarSource)
//   type              : 'review' | 'list' | 'text' | 'poll'
//   title, content    : string
//   mediaList         : Array<{ id, type, title, poster, year }>
//   userRating?       : 1-5
//   hasSpoiler?       : boolean
//   visibility        : 'public' | 'followers'
//   likesCount, commentsCount : number
//   createdAt, updatedAt      : Timestamp
//
//   /likes/{userId} → { userId, likedAt }
//   /comments/{commentId} → { authorId, authorName, authorAvatarIndex, text,
//                              parentId, likesCount, likedBy{uid:true}, createdAt }
//                              parentId != null → yanıt (flat model, aynı koleksiyon)
//
// Avatar NEDEN index? → utils/avatars.js başında detaylı açıklama var. TL;DR:
// 3 byte Firestore alanı + local resource + sabit snapshot (eski post eski avatar).
//
// Users/{uid}/likedPosts/{postId}  → { likedAt }
// Users/{uid}/bookmarks/{postId}   → { bookmarkedAt }
// Users/{uid}/following/{targetId} → { followedAt }
// Users/{uid}/followers/{followerId} → { followedAt }

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { i18nText } from "../utils/i18nText";
import { clampAvatarIndex, DEFAULT_AVATAR_INDEX } from "../utils/avatars";
// Paylaşım tipleri tek yerden gelir (composer + feed filtreleri aynı listeyi kullanır).
import { POST_TYPES } from "../utils/postComposer";
import {
  createSocialNotification,
  notifyOnComment,
} from "./socialNotificationsService";

const PAGE = 15;

const FEED_SORT_FIELDS = {
  recent: "createdAt",
  likes: "likesCount",
  comments: "commentsCount",
};

const getFeedSortField = (sort) => FEED_SORT_FIELDS[sort] || FEED_SORT_FIELDS.recent;

const comparePosts = (sort) => (a, b) => {
  if (sort === "likes") {
    return (b.likesCount || 0) - (a.likesCount || 0) || b._createdAtMs - a._createdAtMs;
  }
  if (sort === "comments") {
    return (b.commentsCount || 0) - (a.commentsCount || 0) || b._createdAtMs - a._createdAtMs;
  }
  return b._createdAtMs - a._createdAtMs;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Firestore Timestamp → millis (createdAt sıralama için)
const toMillis = (ts) => ts?.toMillis?.() ?? 0;

// Doküman snapshot → { id, ...data } + createdAt'i hem Timestamp olarak hem
// _createdAtMs olarak ekle ki UI relative time hesabını kolay yapsın.
const serializePost = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    ...data,
    _createdAtMs: toMillis(data.createdAt),
  };
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createPost(user, payload) {
  if (!user?.uid) throw new Error("createPost: user yok");
  if (!payload?.type || !POST_TYPES.includes(payload.type))
    throw new Error("createPost: geçersiz type");
  if (!payload?.title?.trim()) throw new Error("createPost: title boş olamaz");

  // Avatar index — payload'dan al, yoksa 0'a düşür. clamp güvenli.
  const authorAvatarIndex = clampAvatarIndex(
    payload.authorAvatarIndex ?? DEFAULT_AVATAR_INDEX,
  );

  const base = {
    authorId: user.uid,
    authorName: user.displayName || payload.authorName || i18nText("autoI18n.kullanici", "Kullanıcı"),
    authorAvatarIndex,
    type: payload.type,
    title: payload.title.trim(),
    content: (payload.content || "").trim(),
    mediaList: payload.mediaList || [],
    userRating: payload.userRating ?? null,
    hasSpoiler: !!payload.hasSpoiler,
    // Sıralı liste (#1, #2...) — yalnız "list" tipinde anlamlı.
    ranked: payload.type === "list" ? !!payload.ranked : false,
    visibility: payload.visibility || "public",
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Anket: seçenekler + boş oy haritası (oylar UI'da sayılır, sayaç yok).
  if (payload.type === "poll" && payload.poll) {
    base.poll = {
      type: payload.poll.type === "media" ? "media" : "text",
      question: (payload.poll.question || payload.title || "").trim(),
      options: Array.isArray(payload.poll.options) ? payload.poll.options : [],
      votes: {},
    };
  }
  const postRef = await addDoc(collection(db, "Posts"), base);

  // Kullanıcı dokümanını "denormalize cache" olarak güncelle: postsCount artır
  // ve avatarIndex'i son hâle senkronla (post'tan dolaylı olarak gelir).
  // Tek bir update — başarısız olursa sessiz geç (Users dokümanı yoksa
  // diğer akış zaten oluşturacak).
  updateDoc(doc(db, "Users", user.uid), {
    postsCount: increment(1),
    avatarIndex: authorAvatarIndex,
  }).catch(() => {});

  return postRef.id;
}

export async function deletePost(postId, uid) {
  // Sadece sahibi silebilir (security rules de zorunlu kılıyor).
  await deleteDoc(doc(db, "Posts", postId));
  updateDoc(doc(db, "Users", uid), { postsCount: increment(-1) }).catch(() => {});
}

/**
 * Post'u güncelle. Yalnız sahibi yapabilir (rules enforce).
 * Güncellenebilir alanlar: title, content, type, mediaList, userRating,
 * hasSpoiler, visibility. Counter / createdAt / authorId değiştirilemez.
 *
 * @param {string} postId
 * @param {Object} partial   Üstüne yazılacak alanlar
 */
export async function updatePost(postId, partial) {
  const ALLOWED = [
    "title",
    "content",
    "type",
    "mediaList",
    "userRating",
    "hasSpoiler",
    "ranked",
    "visibility",
  ];
  const safe = {};
  for (const key of ALLOWED) {
    if (partial[key] !== undefined) safe[key] = partial[key];
  }
  if (safe.title) safe.title = String(safe.title).trim();
  if (safe.content) safe.content = String(safe.content).trim();
  safe.updatedAt = serverTimestamp();
  await updateDoc(doc(db, "Posts", postId), safe);
}

// ─── READ: FEED ───────────────────────────────────────────────────────────────

/**
 * Public feed sayfasını çek.
 * @param {Object} opts
 * @param {'all'|'review'|'list'|'text'|'poll'} opts.filter
 * @param {'recent'|'likes'|'comments'} opts.sort
 * @param {DocumentSnapshot|null} opts.lastDoc Pagination kursoru
 * @returns {Promise<{posts: Array, lastDoc: DocumentSnapshot|null}>}
 */
export async function fetchFeed({ filter = "all", sort = "recent", lastDoc = null } = {}) {
  const sortField = getFeedSortField(sort);
  const base = [
    where("visibility", "==", "public"),
    orderBy(sortField, "desc"),
    ...(sortField === "createdAt" ? [] : [orderBy("createdAt", "desc")]),
  ];
  const typeFilter = POST_TYPES.includes(filter)
    ? [where("type", "==", filter)]
    : [];

  let q = query(collection(db, "Posts"), ...typeFilter, ...base, limit(PAGE));
  if (lastDoc) {
    q = query(
      collection(db, "Posts"),
      ...typeFilter,
      ...base,
      startAfter(lastDoc),
      limit(PAGE),
    );
  }

  const snap = await getDocs(q);
  return {
    posts: snap.docs.map(serializePost),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

/**
 * Tek bir post'u id ile getir (bildirim → post detay ekranı için).
 * @returns {Promise<Object|null>} serializePost şeklinde nesne, yoksa null.
 */
export async function fetchPost(postId) {
  if (!postId) return null;
  try {
    const snap = await getDoc(doc(db, "Posts", postId));
    if (!snap.exists()) return null;
    return serializePost(snap);
  } catch (e) {
    if (__DEV__) console.warn("fetchPost:", e?.message);
    return null;
  }
}

/**
 * "Takip Edilenler" feed'i. Firestore `in` operatörü max 30 ID alır,
 * o yüzden chunk halinde sorgu atıp client-side merge ediyoruz.
 */
export async function fetchFollowingFeed(uid, sort = "recent") {
  if (!uid) return { posts: [], lastDoc: null };
  const sortField = getFeedSortField(sort);
  const followSnap = await getDocs(collection(db, "Users", uid, "following"));
  const ids = followSnap.docs.map((d) => d.id);
  if (!ids.length) return { posts: [], lastDoc: null };

  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

  const snaps = await Promise.all(
    chunks.map((c) =>
      getDocs(
        query(
          collection(db, "Posts"),
          where("authorId", "in", c),
          orderBy(sortField, "desc"),
          ...(sortField === "createdAt" ? [] : [orderBy("createdAt", "desc")]),
          limit(PAGE),
        ),
      ),
    ),
  );

  const merged = snaps
    .flatMap((s) => s.docs.map(serializePost))
    .sort(comparePosts(sort))
    .slice(0, PAGE);

  return { posts: merged, lastDoc: null };
}

/**
 * Kullanıcının kendi profilindeki postlar.
 */
export async function fetchUserPosts(uid, lastDoc = null) {
  if (!uid) return { posts: [], lastDoc: null };
  const base = [where("authorId", "==", uid), orderBy("createdAt", "desc")];
  let q = query(collection(db, "Posts"), ...base, limit(PAGE));
  if (lastDoc) {
    q = query(collection(db, "Posts"), ...base, startAfter(lastDoc), limit(PAGE));
  }
  const snap = await getDocs(q);
  return {
    posts: snap.docs.map(serializePost),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

// ─── REAL-TIME (sadece feed ilk sayfası) ──────────────────────────────────────

/**
 * Public feed'in en yeni 15 post'unu canlı dinler.
 * Filtreli sekmelerde realtime devre dışı — onlar `fetchFeed` ile çekilir.
 *
 * @returns {Function} unsubscribe
 */
export function subscribeToFreshFeed(callback, { filter = "all" } = {}) {
  const typeFilter = POST_TYPES.includes(filter)
    ? [where("type", "==", filter)]
    : [];
  const q = query(
    collection(db, "Posts"),
    ...typeFilter,
    where("visibility", "==", "public"),
    orderBy("createdAt", "desc"),
    limit(PAGE),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(serializePost)),
    (err) => {
      if (__DEV__) console.warn("subscribeToFreshFeed error:", err.message);
    },
  );
}

// ─── LIKE / UNLIKE ────────────────────────────────────────────────────────────

/**
 * Atomic like toggle: like dokümanını yaz/sil + Post sayacını ±1 +
 * kullanıcının `likedPosts` set'ini güncelle. Hepsi tek batch'te.
 *
 * @param {string} postId
 * @param {string} uid
 * @param {boolean} currentlyLiked Bu çağrıdan ÖNCE beğeni durumu
 * @param {Object|null} notifyMeta  { toUid, fromName, fromAvatarIndex, postTitle }
 *   — verilirse (ve beğeni ekleniyorsa) post sahibine post_like bildirimi üretir.
 */
export async function toggleLike(postId, uid, currentlyLiked, notifyMeta = null, postMeta = null) {
  if (!uid) throw new Error("toggleLike: uid yok");
  const batch = writeBatch(db);
  const likeRef = doc(db, "Posts", postId, "likes", uid);
  const postRef = doc(db, "Posts", postId);
  const userLikeRef = doc(db, "Users", uid, "likedPosts", postId);

  // Post silinmiş olabilir (ör. Etkinliklerim → Beğeniler'den kaldırma):
  // update(postRef) NOT_FOUND atar ve batch atomik olduğu için likedPosts
  // temizliği de dahil HER ŞEY iptal olurdu — ölü beğeni asla kaldırılamazdı.
  const postExists = await getDoc(postRef)
    .then((s) => s.exists())
    .catch(() => false);

  if (currentlyLiked) {
    batch.delete(likeRef);
    batch.delete(userLikeRef);
    if (postExists) batch.update(postRef, { likesCount: increment(-1) });
  } else {
    if (!postExists) throw new Error("Post bulunamadı");
    batch.set(likeRef, { userId: uid, likedAt: serverTimestamp() });
    // Gösterim verisi ("Etkinliklerim → Beğeniler" için denormalize).
    batch.set(userLikeRef, {
      likedAt: serverTimestamp(),
      postTitle: postMeta?.title || "",
      postAuthorName: postMeta?.authorName || "",
      postType: postMeta?.type || "",
      postPoster: postMeta?.poster || null,
    });
    batch.update(postRef, { likesCount: increment(1) });
  }
  await batch.commit();

  // Beğeni eklendiyse post sahibine bildirim (best-effort, ana akışı bloklamaz).
  if (!currentlyLiked && notifyMeta?.toUid) {
    createSocialNotification({
      toUid: notifyMeta.toUid,
      fromUid: uid,
      fromName: notifyMeta.fromName,
      fromAvatarIndex: notifyMeta.fromAvatarIndex,
      type: "post_like",
      postId,
      text: notifyMeta.postTitle,
    }).catch(() => {});
  }
}

/**
 * Kullanıcının beğendiği tüm post ID'lerini Set olarak döner.
 * UI başlangıçta bir kez çağırır, sonra optimistic update ile günceller.
 */
export async function fetchMyLikedPostIds(uid) {
  if (!uid) return new Set();
  const snap = await getDocs(collection(db, "Users", uid, "likedPosts"));
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * Tek bir post'u kullanıcı beğenmiş mi? (post detay ekranı başlangıç durumu)
 */
export async function isPostLiked(postId, uid) {
  if (!postId || !uid) return false;
  try {
    const snap = await getDoc(doc(db, "Users", uid, "likedPosts", postId));
    return snap.exists();
  } catch {
    return false;
  }
}

// ─── BOOKMARK ─────────────────────────────────────────────────────────────────

export async function toggleBookmark(postId, uid, currently, postMeta = null) {
  if (!uid) throw new Error("toggleBookmark: uid yok");
  const ref = doc(db, "Users", uid, "bookmarks", postId);
  if (currently) await deleteDoc(ref);
  else
    await setDoc(ref, {
      postId,
      bookmarkedAt: serverTimestamp(),
      postTitle: postMeta?.title || "",
      postAuthorName: postMeta?.authorName || "",
      postType: postMeta?.type || "",
      postPoster: postMeta?.poster || null,
    });
}

export async function fetchMyBookmarkIds(uid) {
  if (!uid) return new Set();
  const snap = await getDocs(collection(db, "Users", uid, "bookmarks"));
  return new Set(snap.docs.map((d) => d.id));
}

// ─── POLL VOTE ────────────────────────────────────────────────────────────────
//
// Anket oyu: poll.votes.{uid} = optionId. Aynı seçeneğe tekrar oy → geri çeker
// (toggle). Sayaç yok; yüzdeler UI'da (tallyVotes) hesaplanır. Sahibi olmayan
// kullanıcı yalnız KENDİ oy anahtarını değiştirebilir (firestore.rules enforce).
export async function votePoll(postId, uid, optionId, currentVote = null) {
  if (!uid) throw new Error("votePoll: uid yok");
  const ref = doc(db, "Posts", postId);
  if (currentVote === optionId) {
    await updateDoc(ref, { [`poll.votes.${uid}`]: deleteField() });
  } else {
    await updateDoc(ref, { [`poll.votes.${uid}`]: optionId });
  }
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

export async function addComment(
  postId,
  user,
  text,
  { parentId = null, authorAvatarIndex = DEFAULT_AVATAR_INDEX, postTitle = "", postPoster = null } = {},
) {
  if (!user?.uid) throw new Error("addComment: user yok");
  if (!text?.trim()) throw new Error("addComment: text boş olamaz");

  const batch = writeBatch(db);
  const commRef = doc(collection(db, "Posts", postId, "comments"));
  batch.set(commRef, {
    authorId: user.uid,
    authorName: user.displayName || i18nText("autoI18n.kullanici", "Kullanıcı"),
    authorAvatarIndex: clampAvatarIndex(authorAvatarIndex),
    text: text.trim(),
    parentId,
    likesCount: 0,
    likedBy: {},
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "Posts", postId), {
    commentsCount: increment(1),
  });
  // "Etkinliklerim → Yorumlarım" için denormalize kopya (post yorumu).
  batch.set(doc(db, "Users", user.uid, "myComments", commRef.id), {
    kind: "post",
    targetId: postId,
    text: text.trim(),
    title: postTitle || "",
    poster: postPoster || null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  // Bildirimler: post sahibine (post_comment), yanıtsa parent sahibine
  // (comment_reply), metindeki @mention'lara (mention). Best-effort.
  notifyOnComment({
    postId,
    commentId: commRef.id,
    parentId,
    text: text.trim(),
    fromUid: user.uid,
    fromName: user.displayName || "",
    fromAvatarIndex: authorAvatarIndex,
  }).catch(() => {});

  return commRef.id;
}

export async function fetchComments(postId, lastDoc = null) {
  const base = [orderBy("createdAt", "desc")];
  let q = query(
    collection(db, "Posts", postId, "comments"),
    ...base,
    limit(20),
  );
  if (lastDoc) {
    q = query(
      collection(db, "Posts", postId, "comments"),
      ...base,
      startAfter(lastDoc),
      limit(20),
    );
  }
  const snap = await getDocs(q);
  return {
    comments: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

export async function deleteComment(postId, commentId, uid = null) {
  // Flat modelde yanıtlar aynı koleksiyonda parentId ile durur. Yalnız üst
  // yorumu silmek yanıtları orphan bırakır (UI'da kaybolur ama commentsCount
  // içinde sonsuza dek sayılırdı) — yanıtları da sil.
  let replyDocs = [];
  try {
    const repliesSnap = await getDocs(
      query(
        collection(db, "Posts", postId, "comments"),
        where("parentId", "==", commentId),
      ),
    );
    replyDocs = repliesSnap.docs;
  } catch {
    // Yanıtlar okunamadıysa en azından üst yorumu sil.
  }

  const batch = writeBatch(db);
  const postRef = doc(db, "Posts", postId);
  batch.delete(doc(db, "Posts", postId, "comments", commentId));
  // Sayaç, rules'taki counterOk (±1) kısıtına uymak için silinen yorum başına
  // AYRI increment(-1) operasyonuyla düşürülür (batch içinde sıralı uygulanır).
  batch.update(postRef, { commentsCount: increment(-1) });
  for (const replyDoc of replyDocs) {
    batch.delete(replyDoc.ref);
    batch.update(postRef, { commentsCount: increment(-1) });
  }
  // Denormalize kopyayı da kaldır (yalnız sahibinin kendi yorumu; yanıt
  // sahiplerinin myComments kopyalarına iznimiz yok — onlar best-effort
  // güncellemelerde zaten reddi yutuyor).
  if (uid) {
    batch.delete(doc(db, "Users", uid, "myComments", commentId));
  }
  await batch.commit();
}

/**
 * Yorum metnini güncelle. Yalnız sahibi yapabilir (rules enforce).
 * uid verilirse "Etkinliklerim → Yorumlarım" denormalize kopyası da
 * güncellenir (best-effort: eski yorumlarda kopya olmayabilir; kopya
 * güncellenemedi diye asıl düzenleme geri alınmaz).
 */
export async function updateComment(postId, commentId, text, uid = null) {
  if (!text?.trim()) throw new Error("updateComment: text boş olamaz");
  const t = text.trim();
  await updateDoc(doc(db, "Posts", postId, "comments", commentId), {
    text: t,
  });
  if (uid) {
    await updateDoc(doc(db, "Users", uid, "myComments", commentId), {
      text: t,
    }).catch(() => {});
  }
}

/**
 * Bir post yorumunu HEM asıl koleksiyonda HEM de "Etkinliklerim → Yorumlarım"
 * denormalize kopyasında ({Users}/{uid}/myComments) güncelle. Activity ekranından
 * düzenleme için: tek batch, iki yer senkron kalır.
 */
export async function editPostComment(postId, commentId, uid, text) {
  if (!text?.trim()) throw new Error("editPostComment: text boş olamaz");
  const t = text.trim();
  const batch = writeBatch(db);
  batch.update(doc(db, "Posts", postId, "comments", commentId), { text: t });
  if (uid) {
    batch.update(doc(db, "Users", uid, "myComments", commentId), { text: t });
  }
  await batch.commit();
}

/**
 * Bir post'un yorumlarını canlı dinler (createdAt artan — eskiden yeniye).
 * Flat model: hem üst yorumlar hem yanıtlar aynı koleksiyonda, parentId ile
 * ayrışır. UI parentId'ye göre gruplar.
 *
 * @returns {Function} unsubscribe
 */
export function subscribeToPostComments(postId, callback) {
  if (!postId) return () => {};
  const q = query(
    collection(db, "Posts", postId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (__DEV__) console.warn("subscribeToPostComments error:", err.message);
    },
  );
}

/**
 * Yorum beğenisi toggle — likedBy map'i + likesCount sayacını günceller.
 * Film yorum modeliyle aynı: doküman üzerinde likedBy.{uid} ve likesCount.
 * Sahibi olmayan kullanıcı da güncelleyebilsin diye rules'ta likesCount/likedBy
 * için ayrı izin var.
 *
 * @param {boolean} currentlyLiked Bu çağrıdan ÖNCE beğeni durumu
 */
export async function toggleCommentLike(postId, commentId, uid, currentlyLiked) {
  if (!uid) throw new Error("toggleCommentLike: uid yok");
  const ref = doc(db, "Posts", postId, "comments", commentId);
  if (currentlyLiked) {
    await updateDoc(ref, {
      likesCount: increment(-1),
      [`likedBy.${uid}`]: deleteField(),
    });
  } else {
    await updateDoc(ref, {
      likesCount: increment(1),
      [`likedBy.${uid}`]: true,
    });
  }
}

// ─── FOLLOW ───────────────────────────────────────────────────────────────────

/**
 * @param {boolean} currentlyFollowing Bu çağrıdan ÖNCE takip durumu
 */
export async function toggleFollow(currentUid, targetUid, currentlyFollowing) {
  if (!currentUid || !targetUid)
    throw new Error("toggleFollow: uid eksik");
  if (currentUid === targetUid)
    throw new Error("toggleFollow: kendini takip edemezsin");

  const batch = writeBatch(db);
  const followingRef = doc(db, "Users", currentUid, "following", targetUid);
  const followerRef = doc(db, "Users", targetUid, "followers", currentUid);
  const meRef = doc(db, "Users", currentUid);
  const themRef = doc(db, "Users", targetUid);

  if (currentlyFollowing) {
    batch.delete(followingRef);
    batch.delete(followerRef);
    batch.update(meRef, { followingCount: increment(-1) });
    batch.update(themRef, { followersCount: increment(-1) });
  } else {
    batch.set(followingRef, { followedAt: serverTimestamp() });
    batch.set(followerRef, { followedAt: serverTimestamp() });
    batch.update(meRef, { followingCount: increment(1) });
    batch.update(themRef, { followersCount: increment(1) });
  }
  await batch.commit();
}

export async function isFollowing(currentUid, targetUid) {
  if (!currentUid || !targetUid) return false;
  const snap = await getDoc(
    doc(db, "Users", currentUid, "following", targetUid),
  );
  return snap.exists();
}

// ─── REPORT ─────────────────────────────────────────────────────────────────
//
// Kullanıcı bir gönderiyi şikayet eder. Sadece create izinli (rules) — okuma
// yok. Moderasyon/inceleme manuel (konsol). Aynı kullanıcı aynı postu birden
// çok kez şikayet edebilir; deduplikasyon şimdilik gerekmiyor.
//
// PostReports/{autoId}
//   postId, postAuthorId, reporterId, reason, createdAt
export async function reportPost(postId, reporterId, meta = {}) {
  if (!postId) throw new Error("reportPost: postId eksik");
  if (!reporterId) throw new Error("reportPost: reporterId eksik");
  await addDoc(collection(db, "PostReports"), {
    postId,
    postAuthorId: meta.postAuthorId || null,
    reporterId,
    reason: meta.reason || "unspecified",
    createdAt: serverTimestamp(),
  });
}

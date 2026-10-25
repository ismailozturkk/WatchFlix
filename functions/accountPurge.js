// functions/accountPurge.js
//
// Hesap silmenin SUNUCU tarafı: kullanıcının buluttaki TÜM izlerini Admin SDK ile siler.
//
// NEDEN SUNUCUDA? İstemci tarafındaki silme (services/accountService.js) güvenlik
// kurallarına tabi: başkasının gönderisindeki beğenimi, günlük liderlik girdilerimi,
// turnuva oylarımı, başkalarının gelen kutusuna bıraktığım bildirimleri, geri
// bildirimlerimi ve ReferralAccounts/PromoCodes kayıtlarımı silemez (kural yok ya da
// bilerek kapalı). Kendi alt koleksiyon ağacını da yalnız bildiği adlarla gezer — adı
// listede olmayan bir alt koleksiyon sessizce kalırdı. Admin SDK kuralları aşar ve
// `recursiveDelete` bir dokümanın bütün alt ağacını (belge yok olsa bile) süpürür.
//
// İKİ YERDEN ÇAĞRILIR (functions/index.js):
//   1) deleteAccountData (callable) — kullanıcı "Hesabı sil" dediğinde, Auth kullanıcısı
//      silinmeden ÖNCE. Sonuç istemciye döner; eksik kalan olursa istemci kendi yoluna
//      düşer (idempotent).
//   2) purgeOnAuthUserDeleted (Auth onDelete) — Auth kullanıcısı silinince BİR KEZ DAHA.
//      İstemci silme sürerken açık kalan dinleyiciler (presence, senkron…) silinen
//      belgeleri geri yazabilir; bu son süpürme onları da temizler. Konsoldan silinen
//      hesaplar için de güvence.
//
// Her adım bağımsız sarmalanır: biri başarısız olursa kalanlar çalışır, sonuçta
// `failed` listesi döner. Tamamı idempotent — tekrar çağrılabilir.
//
// BİLİNÇLİ KAPSAM DIŞI (bu dosya silmez):
//   • RevenueCatWebhookEvents: abonelik olay kayıtları (muhasebe/idempotency), event id ile.
//   • tournaments/{id} belgesinin kendisi: ortak etkinlik; yalnız MEN oyum silinir.
//   • PostReports: gönderiye bağlı moderasyon kaydı — reporterId anonimleştirilir.
//   • Başkalarının BENİM yorumlarıma beğeni/yanıt bıraktığı izler yorumla birlikte gider;
//     benim başkalarının yorumlarındaki `likedBy.{uid}` işaretim taranamaz (alan yolu
//     sorgulanamıyor) — kullanıcı kimliği dışında kişisel veri taşımayan tek iz bu.
//
// ⚠ SENKRON TUTULACAK: kapsam website/delete-account.html'de madde madde yayınlanıyor
// ve istemci yedeği services/accountService.js'te. Buraya eklenen her koleksiyon orada
// da (en azından yedek yolda ya da sayfada) yer almalı.

const { FieldValue } = require("firebase-admin/firestore");

/**
 * Silme aşamaları, ÇALIŞMA SIRASIYLA. İstemci (services/accountService.js
 * SERVER_PURGE_PHASES) ilerleme çubuğunu bu listeyle çizer; eşitliği
 * __tests__/accountService.test.js korur. "profile" EN SON olmalı: aynaları
 * (myComments, likedPosts, myRatings, conversations) taşıyan Users/{uid} ağacını siler.
 */
const PURGE_PHASES = Object.freeze([
  "social",
  "comments",
  "content",
  "chats",
  "games",
  "records",
  "profile",
]);

const MEDIA_COMMENT_ROOTS = new Set(["MovieComment", "TvComment"]);
const NOT_FOUND = 5;
const FAILED_PRECONDITION = 9;
const SCENE_MODES = ["classic", "time_attack", "survival"];
const SCENE_DIFFICULTIES = ["easy", "normal", "hard"];

const isNotFound = (error) => error?.code === NOT_FOUND || error?.code === "not-found";
const isIndexMissing = (error) =>
  error?.code === FAILED_PRECONDITION || error?.code === "failed-precondition";

/** Birden çok referansı BulkWriter ile siler; ilk hatayı toplayıp en sonda fırlatır. */
async function deleteRefs(db, refs) {
  if (!refs.length) return;
  const writer = db.bulkWriter();
  let firstError = null;
  for (const ref of refs) {
    writer.delete(ref).catch((error) => {
      firstError = firstError || error;
    });
  }
  await writer.close();
  if (firstError) throw firstError;
}

/** Sayacı düşürür; belge yoksa (sahibi silmiş) sessizce geçer. */
async function decrement(ref, field, by = 1) {
  if (by <= 0) return;
  try {
    await ref.update({ [field]: FieldValue.increment(-by) });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
};

/**
 * @param {Object} deps
 * @param {import("firebase-admin/firestore").Firestore} deps.db
 * @param {import("firebase-admin/database").Database | null} [deps.rtdb]
 * @param {(message: string) => void} [deps.warn]
 * @param {string} uid
 * @param {Object} [options]
 * @param {string} [options.phase] PURGE_PHASES'ten biri; verilmezse hepsi sırayla.
 * @returns {Promise<{failed: string[], skipped: string[]}>}
 *   failed  : adım hata verdi (veri kalmış olabilir)
 *   skipped : koleksiyon-grubu taraması indeks yüzünden atlandı (yedek yol yine çalışır)
 */
async function purgeAccountData({ db, rtdb = null, warn = console.warn }, uid, { phase } = {}) {
  if (!uid || typeof uid !== "string") throw new Error("purgeAccountData: uid yok");
  if (phase && !PURGE_PHASES.includes(phase)) throw new Error(`purgeAccountData: bilinmeyen aşama ${phase}`);

  const failed = [];
  const skipped = [];
  const step = async (label, fn) => {
    try {
      return await fn();
    } catch (error) {
      if (isIndexMissing(error)) {
        skipped.push(label);
        warn(`[purge ${uid}] ${label}: indeks yok, atlandı`);
      } else {
        failed.push(label);
        warn(`[purge ${uid}] ${label}: ${error?.message || error}`);
      }
      return null;
    }
  };
  const userRef = db.doc(`Users/${uid}`);
  const sub = (name) => db.collection(`Users/${uid}/${name}`);

  // Aşamalı çalışma: istemci ilerleme göstermek için aşamaları tek tek çağırır; `phase`
  // verilmezse hepsi sırayla çalışır (Auth onDelete süpürmesi). Aşamalar birbirinin
  // ara durumuna BAĞLI DEĞİL — her biri ihtiyacı olan aynayı kendisi okur. Users/{uid}
  // ağacı (aynalar dahil) en son aşamada silindiği için sıra korunduğu sürece tutarlı.
  const runs = (name) => !phase || phase === name;

  // Koleksiyon-grubu taraması: `field == value` olan her belgeyi (hangi yolda olursa
  // olsun) siler. Aynalarda adı geçmeyen eski kayıtları yakalar; sayaç düşmez.
  const sweepGroup = (label, group, field, value = uid) =>
    step(label, async () => {
      const snap = await db.collectionGroup(group).where(field, "==", value).get();
      await deleteRefs(
        db,
        snap.docs.map((d) => d.ref),
      );
    });

  // ── 1) SOSYAL: karşılıklı izler ───────────────────────────────────────────
  // Her karşı taraf için: benim kaydımı sil, sonra sayacı düşür. Karşı taraf
  // hesabını silmişse sayaç güncellemesi NOT_FOUND verir — yutulur.
  if (runs("social")) {
  const reciprocal = async (label, subName, plan) => {
    await step(label, async () => {
      const snap = await sub(subName).get();
      for (const entry of snap.docs) {
        await step(`${label} ${entry.id}`, async () => {
          const { ref: theirDoc, counter, counterField } = plan(entry);
          if (!theirDoc) return;
          await theirDoc.delete();
          if (counter) await decrement(counter, counterField);
        });
      }
    });
  };
  await reciprocal("friends-reciprocal", "friends", (entry) => ({
    ref: db.doc(`Users/${entry.id}/friends/${uid}`),
    counter: db.doc(`Users/${entry.id}`),
    counterField: "friendsCount",
  }));
  await reciprocal("incoming-requests-reciprocal", "friendRequests", (entry) => {
    const fromUid = entry.get("fromUid") || entry.id.split("_")[0];
    if (!fromUid) return {};
    return {
      ref: db.doc(`Users/${fromUid}/sentRequests/${fromUid}_${uid}`),
      counter: entry.get("status") === "pending" ? db.doc(`Users/${fromUid}`) : null,
      counterField: "pendingRequestsOutCount",
    };
  });
  await reciprocal("outgoing-requests-reciprocal", "sentRequests", (entry) => {
    const toUid = entry.get("toUid") || entry.id.split("_")[1];
    if (!toUid) return {};
    return {
      ref: db.doc(`Users/${toUid}/friendRequests/${uid}_${toUid}`),
      counter: entry.get("status") === "pending" ? db.doc(`Users/${toUid}`) : null,
      counterField: "pendingRequestsInCount",
    };
  });
  await reciprocal("followers-reciprocal", "followers", (entry) => ({
    ref: db.doc(`Users/${entry.id}/following/${uid}`),
    counter: db.doc(`Users/${entry.id}`),
    counterField: "followingCount",
  }));
  await reciprocal("following-reciprocal", "following", (entry) => ({
    ref: db.doc(`Users/${entry.id}/followers/${uid}`),
    counter: db.doc(`Users/${entry.id}`),
    counterField: "followersCount",
  }));

  // Aynı izlerin geri kalanı (aynalarda adı geçmeyen eski kayıtlar): sayaç düşmez.
  await sweepGroup("sweep-friendRequests", "friendRequests", "fromUid");
  await sweepGroup("sweep-sentRequests", "sentRequests", "toUid");
  // Başkalarının gelen kutusuna bıraktığım bildirimler (beğeni, yorum, istek…).
  await sweepGroup("sweep-notifications", "notifications", "fromUid");
  }

  // ── 2) YORUMLAR ───────────────────────────────────────────────────────────
  // Aynalar (myComments) + koleksiyon-grubu taraması birleştirilir; ikisi de aynı
  // yola çıkarsa bir kez işlenir. Tarama indeks yüzünden düşerse ayna yeter.
  if (runs("comments")) {
  const postComments = new Map(); // yol → ref   Posts/{p}/comments/{c}
  const mediaComments = new Map(); // yol → ref   {Movie|Tv}Comment/{id}/comments/{c}
  const mediaReplies = new Map(); // yol → ref   .../comments/{c}/replies/{r}
  const addCommentRef = (ref) => {
    const root = ref.path.split("/")[0];
    if (root === "Posts") postComments.set(ref.path, ref);
    else if (MEDIA_COMMENT_ROOTS.has(root)) {
      (ref.parent.id === "replies" ? mediaReplies : mediaComments).set(ref.path, ref);
    }
  };

  await step("read-my-comments", async () => {
    const snap = await sub("myComments").get();
    for (const entry of snap.docs) {
      const data = entry.data() || {};
      const targetId = data.targetId == null ? null : String(data.targetId);
      if (!targetId) continue;
      if (data.kind === "post") {
        addCommentRef(db.doc(`Posts/${targetId}/comments/${entry.id}`));
      } else if (data.kind === "movie" || data.kind === "tv") {
        const root = data.kind === "tv" ? "TvComment" : "MovieComment";
        addCommentRef(
          data.parentId
            ? db.doc(`${root}/${targetId}/comments/${data.parentId}/replies/${entry.id}`)
            : db.doc(`${root}/${targetId}/comments/${entry.id}`),
        );
      }
    }
  });
  for (const [label, group, field] of [
    ["sweep-post-comments", "comments", "authorId"],
    ["sweep-media-comments", "comments", "userId"],
    ["sweep-media-replies", "replies", "userId"],
  ]) {
    await step(label, async () => {
      const snap = await db.collectionGroup(group).where(field, "==", uid).get();
      snap.docs.forEach((d) => addCommentRef(d.ref));
    });
  }

  // Post yorumu: üst yorumsa yanıtları da (aynı koleksiyonda parentId ile durur)
  // silinir; commentsCount silinen doküman sayısı kadar düşer.
  await step("post-comments", async () => {
    for (const ref of postComments.values()) {
      await step(`post-comment ${ref.path}`, async () => {
        const snap = await ref.get();
        if (!snap.exists) return;
        const refs = [ref];
        if (!snap.get("parentId")) {
          const replies = await ref.parent.where("parentId", "==", ref.id).get();
          replies.docs.forEach((d) => refs.push(d.ref));
        }
        await deleteRefs(db, refs);
        await decrement(ref.parent.parent, "commentsCount", refs.length);
      });
    }
  });

  // Medya yanıtlarım: önce (üst yorum başkasınınsa replyCount düşer), sonra
  // yorumlarım — recursiveDelete altındaki BAŞKALARININ yanıtlarını da götürür
  // (üstü gidince zaten görünmez olurlardı).
  await step("media-replies", async () => {
    for (const ref of mediaReplies.values()) {
      await step(`media-reply ${ref.path}`, async () => {
        await ref.delete();
        await decrement(ref.parent.parent, "replyCount");
      });
    }
  });
  await step("media-comments", async () => {
    for (const ref of mediaComments.values()) {
      await step(`media-comment ${ref.path}`, () => db.recursiveDelete(ref));
    }
  });
  }

  // ── 3) İÇERİK: gönderilerim, beğenilerim, puanlarım ───────────────────────
  if (runs("content")) {
  await step("posts", async () => {
    const snap = await db.collection("Posts").where("authorId", "==", uid).get();
    for (const post of snap.docs) {
      await step(`post ${post.id}`, () => db.recursiveDelete(post.ref));
    }
  });

  // ── BAŞKALARININ GÖNDERİLERİNDEKİ BEĞENİLERİM ─────────────────────────────
  // likedPosts aynası + koleksiyon-grubu taraması; likesCount beğeni başına düşer.
  await step("post-likes", async () => {
    const likeRefs = new Map();
    await step("read-liked-posts", async () => {
      const snap = await sub("likedPosts").get();
      snap.docs.forEach((d) => likeRefs.set(`Posts/${d.id}/likes/${uid}`, db.doc(`Posts/${d.id}/likes/${uid}`)));
    });
    await step("sweep-likes", async () => {
      const snap = await db.collectionGroup("likes").where("userId", "==", uid).get();
      snap.docs.forEach((d) => likeRefs.set(d.ref.path, d.ref));
    });
    for (const ref of likeRefs.values()) {
      await step(`post-like ${ref.path}`, async () => {
        const snap = await ref.get();
        if (!snap.exists) return;
        await ref.delete();
        await decrement(ref.parent.parent, "likesCount");
      });
    }
  });

  // ── PUANLAR (agregatla tutarlı) ───────────────────────────────────────────
  await step("ratings", async () => {
    const snap = await sub("myRatings").get();
    for (const mirror of snap.docs) {
      const key = mirror.id;
      await step(`rating ${key}`, async () => {
        const aggRef = db.doc(`Ratings/${key}`);
        const userRatingRef = db.doc(`Ratings/${key}/userRatings/${uid}`);
        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRatingRef);
          if (!userSnap.exists) return;
          const aggSnap = await tx.get(aggRef);
          const prev = clampRating(userSnap.get("rating"));
          if (aggSnap.exists) {
            tx.update(aggRef, {
              count: Math.max(0, (aggSnap.get("count") || 0) - 1),
              sum: Math.max(0, (aggSnap.get("sum") || 0) - prev),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          tx.delete(userRatingRef);
        });
      });
    }
  });

  }

  // ── 4) SOHBETLER: bire bir, gruplar, ortak listeler ───────────────────────
  if (runs("chats")) {
  // conversations: karşı tarafın gelen kutusundaki kaydım + sohbet kimlikleri.
  const chatIds = new Set();
  await step("conversations-reciprocal", async () => {
    const snap = await sub("conversations").get();
    for (const entry of snap.docs) {
      const other = entry.id;
      chatIds.add(uid > other ? `${uid}_${other}` : `${other}_${uid}`);
      await step(`conversation ${other}`, () =>
        db.doc(`Users/${other}/conversations/${uid}`).delete(),
      );
    }
  });
  await step("chats", async () => {
    await step("chats-query", async () => {
      const snap = await db.collection("chats").where("participants", "array-contains", uid).get();
      snap.docs.forEach((d) => chatIds.add(d.id));
    });
    for (const chatId of chatIds) {
      await step(`chat ${chatId}`, async () => {
        await db.recursiveDelete(db.doc(`chats/${chatId}`)); // messages + pins dahil
        if (rtdb) await rtdb.ref(`chatMeta/${chatId}`).remove();
      });
    }
  });

  // ── GRUPLAR ───────────────────────────────────────────────────────────────
  // Mesajlarım ve sabitlemelerim silinir (anonimleştirilmez: serbest metin göndereni
  // ele verebilir). Grup diğer üyeler için yaşar; kurucuysam sahiplik devredilir,
  // son üye bensem grup tümüyle gider.
  await step("groups", async () => {
    const snap = await db.collection("groups").where("members", "array-contains", uid).get();
    for (const group of snap.docs) {
      await step(`group ${group.id}`, async () => {
        const data = group.data() || {};
        const members = Array.isArray(data.members) ? data.members : [];
        const remaining = members.filter((m) => m && m !== uid);
        if (remaining.length === 0) {
          await db.recursiveDelete(group.ref);
          return;
        }
        const update = {
          members: FieldValue.arrayRemove(uid),
          admins: FieldValue.arrayRemove(uid),
          [`memberInfo.${uid}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (data.createdBy === uid) {
          const admins = Array.isArray(data.admins) ? data.admins : [];
          const heir = remaining.find((m) => admins.includes(m)) || remaining[0];
          update.createdBy = heir;
          update.admins = FieldValue.arrayRemove(uid, heir);
        }
        await group.ref.update(update);
      });
    }
  });
  // Mesaj ve sabitlemelerim (artık üyesi olmadığım gruplarda kalanlar dahil).
  await sweepGroup("sweep-messages", "messages", "senderId");
  await sweepGroup("sweep-pins-sender", "pins", "senderId");
  await sweepGroup("sweep-pins-by", "pins", "pinnedBy");

  // ── ORTAK LİSTELER ────────────────────────────────────────────────────────
  await step("shared-lists", async () => {
    const snap = await db.collection("SharedLists").where("memberIds", "array-contains", uid).get();
    for (const list of snap.docs) {
      await step(`shared-list ${list.id}`, async () => {
        if (list.get("ownerId") === uid) {
          await db.recursiveDelete(list.ref);
          return;
        }
        await list.ref.update({
          memberIds: FieldValue.arrayRemove(uid),
          [`members.${uid}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  });
  // Başkalarının listelerine eklediğim öğeler (ekleyen adı/avatarı taşırlar).
  await sweepGroup("sweep-shared-items", "items", "addedBy");
  }

  // ── 5) OYUN / LİDERLİK / TURNUVA ──────────────────────────────────────────
  if (runs("games")) {
  // Girdi kimliği = uid ve alanı uid; hem tarama hem bilinen tahtalar (günlük tahtalar
  // `scene_daily_<gün>` — tarama indeks yüzünden düşerse bilinen kimlikler kalır).
  await sweepGroup("sweep-leaderboard-entries", "entries", "uid");
  await step("leaderboards-known", async () => {
    const refs = [];
    for (const mode of SCENE_MODES) {
      for (const difficulty of SCENE_DIFFICULTIES) {
        refs.push(db.doc(`GameLeaderboards/scene_${mode}_${difficulty}/entries/${uid}`));
      }
    }
    await deleteRefs(db, refs);
  });
  // Turnuva oyları: istemci silemez (kural "oylar kalıcıdır"); hesap silinirken
  // kaldırılır. `onTournamentVoteWritten` silmeyi sayaçlara yansıtır.
  await step("tournament-votes", async () => {
    const periods = await db.collection("tournaments").listDocuments();
    await deleteRefs(
      db,
      periods.map((p) => p.collection("votes").doc(uid)),
    );
  });
  await step("cine-rooms", async () => {
    for (const field of ["hostUid", "guestUid"]) {
      const snap = await db.collection("CineRooms").where(field, "==", uid).get();
      for (const room of snap.docs) await db.recursiveDelete(room.ref);
    }
  });
  }

  // ── 6) KAYITLAR: geri bildirim, şikayetler, davet/promosyon ───────────────
  if (runs("records")) {
  await step("feedback", async () => {
    const snap = await db.collection("Feedback").where("uid", "==", uid).get();
    await deleteRefs(
      db,
      snap.docs.map((d) => d.ref),
    );
  });
  // Benim yaptığım şikayetler moderasyon kaydı olarak kalır, ama kimliğim çıkar.
  for (const collection of ["PostReports", "ContentReports"]) {
    await step(`${collection}-anonymize`, async () => {
      const snap = await db.collection(collection).where("reporterId", "==", uid).get();
      const writer = db.bulkWriter();
      snap.docs.forEach((d) =>
        writer.update(d.ref, { reporterId: "deleted-user" }).catch(() => {}),
      );
      await writer.close();
    });
  }
  // Hakkımdaki şikayetlerin konusu (hesap) artık yok.
  await step("ContentReports-about-me", async () => {
    const snap = await db.collection("ContentReports").where("targetUserId", "==", uid).get();
    await deleteRefs(
      db,
      snap.docs.map((d) => d.ref),
    );
  });

  // ── DAVET / PROMOSYON ─────────────────────────────────────────────────────
  await step("referral", async () => {
    const accountRef = db.doc(`ReferralAccounts/${uid}`);
    const account = await accountRef.get();
    const refs = [accountRef, db.doc(`Referrals/${uid}`)];
    if (account.get("code")) refs.push(db.doc(`ReferralCodes/${account.get("code")}`));
    const invited = await db.collection("Referrals").where("inviterUid", "==", uid).get();
    invited.docs.forEach((d) => refs.push(d.ref));
    await deleteRefs(db, refs);
  });
  await step("promo-redemptions", async () => {
    const codes = await db.collection("PromoCodes").listDocuments();
    await deleteRefs(
      db,
      codes.map((c) => c.collection("redemptions").doc(uid)),
    );
  });
  }

  // ── 7) PROFİL: kendi kök belgelerim (tüm alt ağaçlarıyla) ─────────────────
  // Lists: yanıt/wrapped/watchedTv/seasons… hangi alt koleksiyon olursa olsun gider.
  if (runs("profile")) {
  let usernameLower = null;
  await step("read-profile", async () => {
    const snap = await userRef.get();
    if (snap.exists) usernameLower = snap.get("usernameLower") || null;
  });
  for (const root of [
    "Lists",
    "Notes",
    "MediaNotes",
    "AiConversations",
    "PosterChoices",
    "Reminders",
    "UserStats",
    "SceneGame",
    "SceneGameHistory",
    "Presence",
    "AiUsage",
    "ProviderWatch",
  ]) {
    await step(`root ${root}`, () => db.recursiveDelete(db.doc(`${root}/${uid}`)));
  }
  await step("usernames", async () => {
    const refs = new Map();
    if (usernameLower) refs.set(usernameLower, db.doc(`Usernames/${usernameLower}`));
    const snap = await db.collection("Usernames").where("uid", "==", uid).get();
    snap.docs.forEach((d) => refs.set(d.id, d.ref));
    await deleteRefs(db, [...refs.values()]);
  });
  if (rtdb) {
    await step("presence-rtdb", () => rtdb.ref(`presence/${uid}`).remove());
  }
  // EN SON: profil ve tüm Users/{uid}/* alt koleksiyonları (friends, private/push,
  // myComments, gameStats… adı ne olursa olsun).
  await step("user-tree", () => db.recursiveDelete(userRef));
  }

  return { failed, skipped };
}

module.exports = { purgeAccountData, PURGE_PHASES };

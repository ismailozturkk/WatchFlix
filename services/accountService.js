// services/accountService.js
//
// Hesap silme — Firebase Auth kullanıcısını ve TÜM Firestore izlerini temizler.
//
// Aşamalar:
//   0) purgeOnServer(user) → `deleteAccountData` Cloud Function'ı (functions/accountPurge.js).
//                            ASIL silme yolu: Admin yetkisiyle çalışır, güvenlik kurallarının
//                            istemciye kapattığı izleri (başkasının gönderisindeki beğenim,
//                            günlük liderlik, turnuva oyu, başkalarının gelen kutusundaki
//                            bildirimlerim, geri bildirimler, davet kayıtları…) ve adı
//                            listede olmayan alt koleksiyonları da siler.
//   1) purgeUserData(uid)  → YEDEK: istemci kuralları içinde yapabildiği kadarını siler
//                            (kendi + karşılıklı). Sunucu yolu yoksa (fonksiyon deploy
//                            edilmemiş / çevrimdışı) ya da eksik bıraktıysa çalışır.
//   2) deleteAccount(...)  → reauth + purge + Firebase Auth kullanıcısını sil
//
// Auth kullanıcısı silinince sunucuda `purgeOnAuthUserDeleted` bir kez daha süpürür:
// silme sürerken açık kalan dinleyicilerin geri yazdığı belgeleri temizler.
//
// NEDEN reauth? Firebase, hesap silme gibi hassas işlemler için "yakın zamanda
// giriş" ister (auth/requires-recent-login). Yeniden doğrulama yolu hesabın
// SAĞLAYICISINA göre seçilir (providerData): parola hesaplarında e-posta+şifre,
// Google hesaplarında native Google akışıyla alınan taze bir idToken, Apple
// hesaplarında ise native Apple akışı ve yetki iptali için authorization code.
// kullanıcılar uygulama içinden hesabını hiç silemez (mağaza uyumluluk şartı).
//
// NEDEN purge önce, deleteUser sonra? Auth kullanıcısı silinince request.auth
// null olur ve güvenlik kuralları tüm yazmaları reddeder. O yüzden veriyi hâlâ
// kimlik doğrulanmışken sileriz.
//
// ⚠ SENKRON TUTULACAK: aşağıdaki kapsam website/delete-account.html sayfasında
// (TR + EN blokları, "Silinen veriler" listesi ve "Silinmeyen kayıtlar" tablosu)
// madde madde YAYINLANIYOR. Google Play / App Store hesap silme beyanı oraya
// bakar — bu listeyi değiştiren her PR sayfayı da güncellemeli.
//
// Silinen veriler:
//   KENDİ:
//     Users/{uid} + alt koleksiyonlar (friends, friendRequests, sentRequests,
//                  blocked, notifications, following, followers,
//                  likedPosts, bookmarks, myComments, conversations,
//                  gameProfile, gameStats, gameSessions)
//     Usernames/{usernameLower}
//     Lists/{uid} (+ watchedTv/{showId}/seasons, wrapped alt koleksiyonları)
//     Notes/{uid}/items
//     MediaNotes/{uid}/items (film/dizi sayfasına bağlı notlar)
//     AiConversations/{uid}/items (CineMatch AI sohbet geçmişi)
//     PosterChoices/{uid} (özel afiş seçimleri)
//     Reminders/{uid} (movies, tvShows/{showId}/episodes)
//     UserStats/{uid}
//     Presence/{uid} (Firestore kalıntı) + RTDB /presence/{uid}
//     SceneGame/{uid}, SceneGameHistory/{uid},
//     GameLeaderboards/{boardId}/entries/{uid} (tüm mod×zorluk board'ları)
//     Ratings/{mediaKey}/userRatings/{uid} + agregat düşümü (myRatings üzerinden)
//     Posts (authorId == uid) + her postun likes/comments alt koleksiyonu
//     chats (participants array-contains uid ∪ conversations index'i) + messages
//     SharedLists (ownerId == uid) + items alt koleksiyonu
//     AiUsage/{uid} (AI günlük kota sayacı) + ProviderWatch/{uid} (streaming
//                  uygunluk snapshot'ı) — ikisini de Cloud Function yazar
//   KARŞILIKLI (başka kullanıcıların dokümanlarındaki izler):
//     - Arkadaşların friends/{uid} kaydı + friendsCount--
//     - Bana istek atanların sentRequests kaydı + pendingRequestsOutCount--
//     - İstek attıklarımın friendRequests kaydı + pendingRequestsInCount--
//     - Takipçilerin following/{uid} kaydı + followingCount--
//     - Takip ettiklerimin followers/{uid} kaydı + followersCount--
//     - Konuştuklarımın conversations/{uid} kaydı
//     - Başkalarının postlarına yazdığım yorumlar + altlarındaki yanıtlar,
//       Posts.commentsCount düşümüyle (myComments mirror'ı üzerinden bulunur)
//     - MovieComment/TvComment yorumlarım ve yanıtlarım + replyCount düşümü
//     - Grup mesajlarım ve sabitlemelerim + grup üyeliğim. Grup diğer üyeler
//       için yaşamaya devam eder; kurucusuysam sahiplik kalan bir üyeye
//       devredilir, son üye bensem grup tümüyle silinir.
//     - Üyesi olduğum SharedLists'teki memberIds/members kaydım (ayrılırım)
//     - Başkalarının gönderilerindeki beğenilerim (Posts/{id}/likes/{uid}) + likesCount--
//     - Günlük meydan okuma girdilerim (GameLeaderboards/scene_daily_<gün>/entries/{uid})
//   SUNUCU YOLUNA (functions/accountPurge.js) ÖZGÜ — kurallar istemciye izin vermez,
//   bu yüzden bu yedek yolda SİLİNMEZ:
//     - Başkalarının gelen kutusuna bıraktığım bildirimler (notifications.fromUid)
//     - tournaments/*/votes/{uid}: kural "oylar kalıcıdır" (delete kapalı)
//     - Feedback/{id}: kural yalnız create + kendi kaydını okuma
//     - PostReports/ContentReports: reporterId anonimleştirilir (kayıt kalır)
//     - ReferralAccounts/Referrals/PromoCodes: yalnız Admin SDK'ya açık
//     - CineRooms (host/guest benim), `scene_daily_*` tahtalarının 90 günden eskileri
//     - Başkalarının BENİM medya yorumuma yazdığı yanıtlar (kural yalnız yazarına
//       silme izni verir; sunucu yorumla birlikte alt ağacı siler)
//     - Adı bu listede olmayan Users/{uid} alt koleksiyonları (recursiveDelete)
//   YEDEK YOLDA da kalabilen sınır:
//     - myComments mirror'ı HİÇ yazılmamış çok eski medya yorumları: tarama
//       yalnız mirror'da adı geçen medya hedeflerinde yapılır (bkz. aşağıdaki
//       "media-comments" adımının başındaki not). Sunucu yolu bunları
//       koleksiyon-grubu taramasıyla (comments.userId) yakalar.

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  increment,
  arrayRemove,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { ref as rtdbRef, remove as rtdbRemove } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { auth, db, rtdb, fns } from "../firebase";
import { dailyBoardId, dayKeyOf, previousDayKey } from "../utils/dailyChallenge";
import { removeMyRating } from "./ratingsService";
import { reauthenticateWithGoogle } from "./googleAuthService";
import {
  reauthenticateWithApple,
  revokeAppleAuthorization,
} from "./appleAuthService";
// Post yorumu silme mantığı (yanıtları kaskatlı sil + commentsCount düş +
// mirror'ı kaldır) postsService'te zaten var — purge onu yeniden kullanır.
import { deleteComment } from "./postsService";
import { deleteSharedList, leaveSharedList } from "./sharedListsService";
// Yerel-öncelikli veri katmanı (notlar, hatırlatıcılar…). Bu dosyadaki
// `purgeUserData` BULUTU siler; yerel kopya + bekleyen yazımlar için ayrı ad.
import { purgeUserData as purgeLocalUserData } from "./userData";
import { deleteCollection, deleteRefsInChunks } from "./firestoreBulk";
import { purgeUserScope } from "./storage";
import { resetWatchLedger } from "../utils/watchBadgeLedger";
import { QUICK_BOARD_IDS } from "../utils/gameBoards";

// Sunucu silme aşamaları, ÇALIŞMA SIRASIYLA (functions/accountPurge.js PURGE_PHASES ile
// aynı; eşitliği __tests__/deleteAccountProgress.test.js korur). Her aşama ayrı
// çağrılır, böylece ilerleme gerçek aşama geçişlerinden çizilir.
export const SERVER_PURGE_PHASES = Object.freeze([
  "social",
  "comments",
  "content",
  "chats",
  "games",
  "records",
  "profile",
]);

/**
 * İlerleme ekranının aşamaları, sırayla. `fallback` (istemci yedeği) yalnız sunucu
 * ulaşılamaz/eksikse araya girer — `onProgress` o anki gerçek listeyi (`stages`) verir.
 */
export const DELETE_STAGES = Object.freeze([
  "verify",
  "local",
  ...SERVER_PURGE_PHASES,
  "account",
]);

const SERVER_PURGE_TIMEOUT_MS = 9 * 60 * 1000; // fonksiyonun timeoutSeconds'ı (540) ile eşit
const DAILY_LOOKBACK_DAYS = 90; // yedek yolun geriye doğru deneyeceği günlük tahta sayısı

// Bir işi sarmalar; hata olursa tüm akışı çökertmek yerine loglar ve devam eder.
// Hesap silmede "kısmî temizlik > hiç temizlememe" mantığı geçerli.
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    if (__DEV__) console.warn(`[deleteAccount] ${label}:`, e?.message || e);
    return null;
  }
}

// Toplu silme yardımcıları services/firestoreBulk.js'te (friendsService de kullanır);
// hesap sıfırlama bunları buradan alıyor, o yüzden yeniden dışa aktarılır.
export { deleteCollection, deleteRefsInChunks };

const reqId = (fromUid, toUid) => `${fromUid}_${toUid}`;

// ── ETKİNLİKLERİM parçaları ───────────────────────────────────────────────────
// Hesabı SİLME (purgeUserData) ve hesabı SIFIRLAMA (services/accountResetService.js)
// aynı gövdeleri kullanır: yorumlarım, gönderilerim, puanlarım, beğenilerim. Eskiden
// purgeUserData'nın içinde satır içiydi; sıfırlama kopyalamasın diye ayrıldı.
// Her biri bağımsız ve idempotent; hata yutulur (`safe`), akış durmaz.

// ── YORUMLARIM (başkalarının postları + film/dizi sayfaları) ──────────────
// myComments mirror'ı asıl yorum dokümanlarına giden TEK indeks: istemcide
// "bütün Posts/*/comments içinde authorId == uid" araması ancak collection
// group sorgusuyla olurdu. O yol seçilmedi çünkü (a) collectionGroup("comments")
// hem Posts hem MovieComment/TvComment alt koleksiyonlarını kapsar, (b)
// çalışması için collection-group kapsamlı tek alan indeksi + `match
// /{path=**}/comments/{id}` altında bir `list` izni gerekir; ikincisi bugün
// yol-bazlı olan kural yüzeyini gereksizce genişletirdi. Mirror zaten her
// yorumda yazılıyor (postsService#addComment + components/Comment.js) →
// ucuz ve yeterli olan yol bu.
//
// SIRA: mirror "users-sub myComments" adımında siliniyor, o yüzden burada
// ÖNCE okunur; ayrıca post yorumları kendi postlarım silinmeden işlenmeli
// (post dokümanı gidince commentsCount batch'i NOT_FOUND ile düşerdi).
/** Yorum aynasını (Users/{uid}/myComments) okur: silme bu listeyle yürür. */
export async function readMyComments(uid) {
  const myComments = [];
  await safe("read-my-comments", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "myComments"));
    snap.docs.forEach((d) => myComments.push({ id: d.id, ...(d.data() || {}) }));
  });
  return myComments;
}

/** Başkalarının postlarına ve film/dizi sayfalarına yazdığım yorumlar (+ yanıtlar). */
export async function purgeMyComments(uid, myComments) {
  // Post yorumlarım: deleteComment yanıtları da kaskatlı siler ve commentsCount'u
  // silinen doküman başına increment(-1) ile düşürür (rules counterOk ±1).
  await safe("post-comments", async () => {
    for (const c of myComments) {
      if (c.kind !== "post" || !c.targetId) continue;
      await safe(`post-comment ${c.id}`, async () => {
        try {
          await deleteComment(c.targetId, c.id, uid);
        } catch {
          // Post dokümanı yoksa (yazarı silmiş, alt koleksiyon orphan kalmış)
          // sayaç batch'i düşer; en azından yorumun kendisini bırakma.
          await deleteDoc(doc(db, "Posts", c.targetId, "comments", c.id));
        }
      });
    }
  });

  // Film/dizi yorumlarım. Mirror: kind 'movie' | 'tv', targetId = medya id.
  // Yanıtlar {coll}/{targetId}/comments/{parentId}/replies/{replyId} altında
  // durduğu için yol YALNIZ parentId ile kurulabilir; bu alan artık mirror'a
  // yazılıyor (components/Comment.js). parentId taşımayan ESKİ mirror'larda
  // üst seviye yol denenir, doküman yoksa hedef derin taramaya alınır.
  await safe("media-comments", async () => {
    const targets = new Map(); // "MovieComment/603" → { coll, targetId }
    const deepScan = new Set(); // parentId'si bilinmeyen yanıtlar için hedefler

    for (const c of myComments) {
      if (c.kind !== "movie" && c.kind !== "tv") continue;
      if (c.targetId == null) continue;
      const coll = c.kind === "tv" ? "TvComment" : "MovieComment";
      const targetId = String(c.targetId);
      const key = `${coll}/${targetId}`;
      targets.set(key, { coll, targetId });

      if (c.parentId) {
        await safe(`media-reply ${c.id}`, async () => {
          await deleteDoc(
            doc(db, coll, targetId, "comments", c.parentId, "replies", c.id),
          );
          await updateDoc(doc(db, coll, targetId, "comments", c.parentId), {
            replyCount: increment(-1),
          }).catch(() => {});
        });
        continue;
      }

      const exists = await safe(`media-comment-read ${c.id}`, async () => {
        const snap = await getDoc(doc(db, coll, targetId, "comments", c.id));
        return snap.exists();
      });
      // exists === null → okuma başarısız; hedef zaten aşağıdaki süpürmede.
      if (exists === false) deepScan.add(key);
    }

    // Süpürme: her hedefte userId == uid olan ÜST SEVİYE yorumlar (mirror'ı
    // eksik kalmış eski kayıtlar dahil) + altlarındaki kendi yanıtlarım.
    // Tek alan eşitlik sorgusu — ek composite index gerektirmez.
    for (const { coll, targetId } of targets.values()) {
      await safe(`media-sweep ${coll}/${targetId}`, async () => {
        const mine = await getDocs(
          query(
            collection(db, coll, targetId, "comments"),
            where("userId", "==", uid),
          ),
        );
        for (const c of mine.docs) {
          // Kendi yanıtlarım: BAŞKALARININ yanıtlarını kural gereği silemem
          // (yalnız yazarı silebilir) — onlar orphan kalır; tekil yorum
          // silmede de durum aynı (components/Comment.js#handleDelete).
          await safe(`media-own-replies ${c.id}`, async () => {
            const rs = await getDocs(
              query(
                collection(db, coll, targetId, "comments", c.id, "replies"),
                where("userId", "==", uid),
              ),
            );
            await deleteRefsInChunks(rs.docs.map((r) => r.ref));
          });
        }
        await deleteRefsInChunks(mine.docs.map((c) => c.ref));
      });
    }

    // Derin tarama: yalnız yukarıda çözülemeyen hedeflerde çalışır (mirror'da
    // parentId yok + üst seviyede doküman yok → başkasının yorumuna yazılmış
    // eski bir yanıt). Hedefin yorumları listelenir, her birinin replies'ı
    // userId == uid ile sorgulanır.
    for (const key of deepScan) {
      const { coll, targetId } = targets.get(key) || {};
      if (!coll) continue;
      await safe(`media-deep ${key}`, async () => {
        const parents = await getDocs(collection(db, coll, targetId, "comments"));
        for (const p of parents.docs) {
          await safe(`media-deep-reply ${p.id}`, async () => {
            const rs = await getDocs(
              query(
                collection(db, coll, targetId, "comments", p.id, "replies"),
                where("userId", "==", uid),
              ),
            );
            for (const r of rs.docs) {
              await deleteDoc(r.ref);
              // Sayaç yanıt başına ±1 oynar (rules counterOk) — toplu
              // increment(-n) reddedilirdi.
              await updateDoc(p.ref, { replyCount: increment(-1) }).catch(() => {});
            }
          });
        }
      });
    }
  });
}

/** Kendi gönderilerim (likes + comments alt koleksiyonlarıyla). */
export async function purgeMyPosts(uid) {
  // ── KENDİ POSTLARI (likes + comments alt koleksiyonlarıyla) ───────────────
  await safe("posts", async () => {
    const snap = await getDocs(
      query(collection(db, "Posts"), where("authorId", "==", uid)),
    );
    for (const d of snap.docs) {
      await safe(`post ${d.id}`, async () => {
        await deleteCollection(collection(db, "Posts", d.id, "likes"));
        await deleteCollection(collection(db, "Posts", d.id, "comments"));
        await deleteDoc(d.ref);
      });
    }
  });
}

/** Puanlarım — agregatlarla tutarlı (removeMyRating). */
export async function purgeMyRatings(uid) {
  // ── PUANLAR (Ratings agregatlarıyla tutarlı silme) ────────────────────────
  // myRatings mirror'ı üzerinden her oy removeMyRating transaction'ı ile
  // kaldırılır: Ratings/{key}/userRatings/{uid} silinir + agregat count/sum
  // düşer + mirror silinir. Doğrudan koleksiyon silseydik silinen kullanıcının
  // oyları site geneli ortalamalarda sonsuza dek sayılmaya devam ederdi.
  await safe("ratings", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "myRatings"));
    for (const d of snap.docs) {
      const data = d.data() || {};
      const mediaType = data.mediaType;
      const mediaId = data.mediaId;
      if (!mediaType || mediaId == null) {
        // Meta eksikse en azından mirror'ı bırakma.
        await safe(`rating-mirror ${d.id}`, () => deleteDoc(d.ref));
        continue;
      }
      await safe(`rating ${d.id}`, () =>
        removeMyRating({ mediaType, mediaId, uid }),
      );
    }
  });
}

/** Başkalarının gönderilerindeki beğenilerim (likesCount düşümüyle). */
export async function purgeMyPostLikes(uid) {
  // ── BAŞKALARININ GÖNDERİLERİNDEKİ BEĞENİLERİM ─────────────────────────────
  // likedPosts yalnız aynadır; asıl beğeni Posts/{id}/likes/{uid} ve sayaç
  // likesCount. Aynayı silip bunları bırakmak beğenimi gönderide yaşatıyordu.
  // Kural: beğeni sahibi kendi beğenisini siler, sayaç ±1 (toggleLike ile aynı).
  // Ayna burada okunur — "users-sub likedPosts" adımı onu silmeden ÖNCE.
  await safe("post-likes", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "likedPosts"));
    for (const d of snap.docs) {
      await safe(`post-like ${d.id}`, async () => {
        const postRef = doc(db, "Posts", d.id);
        const likeRef = doc(db, "Posts", d.id, "likes", uid);
        const [likeSnap, postSnap] = await Promise.all([getDoc(likeRef), getDoc(postRef)]);
        if (!likeSnap.exists()) return;
        const batch = writeBatch(db);
        batch.delete(likeRef);
        if (postSnap.exists()) batch.update(postRef, { likesCount: increment(-1) });
        await batch.commit();
      });
    }
  });
}

/**
 * Kullanıcının tüm Firestore izlerini temizler. Her bölüm bağımsız sarmalanır;
 * biri başarısız olsa bile diğerleri çalışır. Idempotent — tekrar çağrılabilir.
 *
 * @param {string} uid
 */
export async function purgeUserData(uid) {
  if (!uid) throw new Error("purgeUserData: uid yok");

  // Usernames temizliği için usernameLower'ı önceden oku.
  let usernameLower = null;
  await safe("read-profile", async () => {
    const uSnap = await getDoc(doc(db, "Users", uid));
    if (uSnap.exists()) usernameLower = uSnap.data().usernameLower || null;
  });

  // ── KARŞILIKLI TEMİZLİK (başka kullanıcıların dokümanları) ────────────────

  // 1) Arkadaşlar: her arkadaşın bende olan kaydını sil + sayaç düş.
  await safe("friends-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "friends"));
    for (const d of snap.docs) {
      const friendUid = d.id;
      await safe(`friend ${friendUid}`, async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "Users", friendUid, "friends", uid));
        batch.update(doc(db, "Users", friendUid), {
          friendsCount: increment(-1),
        });
        await batch.commit();
      });
    }
  });

  // 2) Bana gelen istekler: gönderenin sentRequests kopyasını sil + sayaç düş.
  await safe("incoming-requests-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "friendRequests"));
    for (const d of snap.docs) {
      const data = d.data();
      const fromUid = data.fromUid || d.id.split("_")[0];
      if (!fromUid) continue;
      await safe(`incoming ${fromUid}`, async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "Users", fromUid, "sentRequests", reqId(fromUid, uid)));
        if (data.status === "pending") {
          batch.update(doc(db, "Users", fromUid), {
            pendingRequestsOutCount: increment(-1),
          });
        }
        await batch.commit();
      });
    }
  });

  // 3) Benim gönderdiğim istekler: alıcının friendRequests kopyasını sil + sayaç.
  await safe("outgoing-requests-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "sentRequests"));
    for (const d of snap.docs) {
      const data = d.data();
      const toUid = data.toUid || d.id.split("_")[1];
      if (!toUid) continue;
      await safe(`outgoing ${toUid}`, async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "Users", toUid, "friendRequests", reqId(uid, toUid)));
        if (data.status === "pending") {
          batch.update(doc(db, "Users", toUid), {
            pendingRequestsInCount: increment(-1),
          });
        }
        await batch.commit();
      });
    }
  });

  // 4) Takipçilerim: takipçinin following/{uid} kaydını sil + followingCount--.
  await safe("followers-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "followers"));
    for (const d of snap.docs) {
      const followerUid = d.id;
      await safe(`follower ${followerUid}`, async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "Users", followerUid, "following", uid));
        batch.update(doc(db, "Users", followerUid), {
          followingCount: increment(-1),
        });
        await batch.commit();
      });
    }
  });

  // 5) Takip ettiklerim: hedefin followers/{uid} kaydını sil + followersCount--.
  await safe("following-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "following"));
    for (const d of snap.docs) {
      const targetUid = d.id;
      await safe(`following ${targetUid}`, async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "Users", targetUid, "followers", uid));
        batch.update(doc(db, "Users", targetUid), {
          followersCount: increment(-1),
        });
        await batch.commit();
      });
    }
  });

  // ── YORUMLARIM (başkalarının postları + film/dizi sayfaları) ──────────────
  // myComments mirror'ı asıl yorum dokümanlarına giden TEK indeks: istemcide
  // "bütün Posts/*/comments içinde authorId == uid" araması ancak collection
  // group sorgusuyla olurdu. O yol seçilmedi çünkü (a) collectionGroup("comments")
  // hem Posts hem MovieComment/TvComment alt koleksiyonlarını kapsar, (b)
  // çalışması için collection-group kapsamlı tek alan indeksi + `match
  // /{path=**}/comments/{id}` altında bir `list` izni gerekir; ikincisi bugün
  // yol-bazlı olan kural yüzeyini gereksizce genişletirdi. Mirror zaten her
  // yorumda yazılıyor (postsService#addComment + components/Comment.js) →
  // ucuz ve yeterli olan yol bu.
  //
  // SIRA: mirror "users-sub myComments" adımında siliniyor, o yüzden burada
  // ÖNCE okunur; ayrıca post yorumları kendi postlarım silinmeden işlenmeli
  // (post dokümanı gidince commentsCount batch'i NOT_FOUND ile düşerdi).
  // ── ETKİNLİKLERİM: yorumlar → gönderiler → puanlar → beğeniler (SIRA ve gerekçeler
  // ilgili parçanın başlık notunda: aynalar "users-sub" adımında silinmeden ÖNCE okunur).
  const myComments = await readMyComments(uid);
  await purgeMyComments(uid, myComments);
  await purgeMyPosts(uid);
  await purgeMyRatings(uid);
  await purgeMyPostLikes(uid);

  // ── KONUŞMALAR INDEX'İ (karşılıklı) + chatId türetimi ─────────────────────
  // conversations hem karşı tarafın gelen kutusundaki kaydımı silmek hem de
  // participants alanı olmayan eski chat dokümanlarını yakalamak için
  // chats temizliğinden ÖNCE okunur.
  const conversationChatIds = new Set();
  await safe("conversations-reciprocal", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "conversations"));
    for (const d of snap.docs) {
      const otherUid = d.id;
      // ChatScreen (screens/chat/ChatScreen.js:751-757) chatId'yi HER ZAMAN
      // "büyük_küçük" sırasıyla kurar. .sort() artan sıra verdiği için buradaki
      // türetim hiçbir zaman gerçek dokümana isabet etmiyor, dolayısıyla
      // participants alanı olmayan eski chat'leri yakalayan yedek yol ölüydü.
      conversationChatIds.add(
        uid > otherUid ? `${uid}_${otherUid}` : `${otherUid}_${uid}`,
      );
      await safe(`conversation ${otherUid}`, () =>
        deleteDoc(doc(db, "Users", otherUid, "conversations", uid)),
      );
    }
  });

  // ── KENDİ Users ALT KOLEKSİYONLARI ────────────────────────────────────────
  const userSubcols = [
    "friends",
    "friendRequests",
    "sentRequests",
    "blocked",
    // Push token'ları burada (private/push). Silinmezse hesap gittikten sonra
    // cihaz token'ı artık olarak kalır ve o cihaza bildirim gitmeye devam eder.
    "private",
    "notifications",
    "following",
    "followers",
    "likedPosts",
    "bookmarks",
    "myComments",
    // Puan aynası: removeMyRating (yukarıda) başarısız olursa ayna kalmasın.
    "myRatings",
    "conversations",
    // Grup okunmamış sayaçları (groupInbox/{groupId}); sunucu süpürmesi Users
    // ağacını recursiveDelete ile zaten götürür.
    "groupInbox",
    // Şikâyet edilip gizlenen gönderiler (hiddenPostsService).
    "hiddenPosts",
    "gameProfile",
    "gameStats",
    "gameSessions",
  ];
  for (const sub of userSubcols) {
    await safe(`users-sub ${sub}`, () =>
      deleteCollection(collection(db, "Users", uid, sub)),
    );
  }

  // ── OYUN VERİLERİ (kök koleksiyonlar + leaderboard girdileri) ─────────────
  await safe("scene-game", () => deleteDoc(doc(db, "SceneGame", uid)));
  await safe("scene-game-history", () =>
    deleteDoc(doc(db, "SceneGameHistory", uid)),
  );
  // Board id'leri deterministik: scene_{mode}_{difficulty}
  // (services/sceneGameService.js#leaderboardBoardId). deleteDoc idempotent —
  // hiç oynanmamış kombinasyonlarda sessiz no-op.
  await safe("game-leaderboards", async () => {
    const modes = ["classic", "time_attack", "survival"];
    const difficulties = ["easy", "normal", "hard"];
    for (const m of modes) {
      for (const dLevel of difficulties) {
        await safe(`leaderboard scene_${m}_${dLevel}`, () =>
          deleteDoc(doc(db, "GameLeaderboards", `scene_${m}_${dLevel}`, "entries", uid)),
        );
        await safe(`leaderboard poster_${m}_${dLevel}`, () =>
          deleteDoc(doc(db, "GameLeaderboards", `poster_${m}_${dLevel}`, "entries", uid)),
        );
      }
    }
    // Hızlı oyun tabloları (utils/gameBoards: quick_<oyun>).
    for (const boardId of QUICK_BOARD_IDS) {
      await safe(`leaderboard ${boardId}`, () => deleteDoc(doc(db, "GameLeaderboards", boardId, "entries", uid)));
    }
  });

  // Günlük meydan okuma tahtaları (`scene_daily_<gün>`): her gün ayrı tahta. İstemci
  // koleksiyon grubunu tarayamaz (kural yok); son DAILY_LOOKBACK_DAYS günü dener.
  // Daha eskisi ve tüm kalanı sunucu yolunun işi (Admin `entries` taraması).
  await safe("daily-leaderboards", async () => {
    let dayKey = dayKeyOf();
    for (let i = 0; i < DAILY_LOOKBACK_DAYS && dayKey; i += 1) {
      const key = dayKey;
      await safe(`daily-leaderboard ${key}`, () =>
        deleteDoc(doc(db, "GameLeaderboards", dailyBoardId(key), "entries", uid)),
      );
      dayKey = previousDayKey(key);
    }
  });

  // ── Lists (+ watchedTv/{showId}/seasons) ──────────────────────────────────
  await safe("lists", async () => {
    const watchedTv = await getDocs(collection(db, "Lists", uid, "watchedTv"));
    for (const show of watchedTv.docs) {
      await safe(`watchedTv ${show.id}`, () =>
        deleteCollection(
          collection(db, "Lists", uid, "watchedTv", show.id, "seasons"),
        ),
      );
    }
    await deleteCollection(collection(db, "Lists", uid, "watchedTv"));
    // Yeni model: film/öntanımlı listeler + özel liste öğeleri ayrı koleksiyonlarda.
    // wrapped: yıllık özet dokümanları (wrappedService) — parent silinince
    // orphan kalmasın.
    for (const sub of ["favorites", "watchList", "watchedMovies", "customItems", "wrapped"]) {
      await safe(`lists-sub ${sub}`, () =>
        deleteCollection(collection(db, "Lists", uid, sub)),
      );
    }
    await deleteDoc(doc(db, "Lists", uid));
  });

  // ── Notes/{uid}/items + Notes/{uid} ───────────────────────────────────────
  await safe("notes", async () => {
    await deleteCollection(collection(db, "Notes", uid, "items"));
    await deleteDoc(doc(db, "Notes", uid));
  });

  // ── MediaNotes/{uid}/items (film/dizi sayfasına bağlı notlar) ──────────────
  // Genel notlardan (Notes) AYRI koleksiyon. Kök belge yok, yalnız alt
  // koleksiyon. delete-account.html "tüm notlarınız" diyor — bu adım olmadan
  // sayfadaki vaat eksik kalıyordu.
  await safe("media-notes", () =>
    deleteCollection(collection(db, "MediaNotes", uid, "items")),
  );

  // ── AiConversations/{uid}/items (CineMatch sohbet geçmişi) ─────────────────
  // Yerel-öncelikli alan (services/userData); `purgeLocalUserData` yerel kopyayı
  // ve bekleyen yazımları temizler — burası bulutu siler. Kök belge yok
  // (yalnız alt koleksiyon), bu yüzden ayrıca deleteDoc gerekmez.
  await safe("ai-conversations", () =>
    deleteCollection(collection(db, "AiConversations", uid, "items")),
  );

  // ── PosterChoices/{uid} (özel afiş seçimleri, TEK belge) ───────────────────
  // Yerel-öncelikli alan; yerel kopyayı `purgeLocalUserData` temizler.
  await safe("poster-choices", () => deleteDoc(doc(db, "PosterChoices", uid)));

  // ── Reminders (movies, tvShows/{showId}/episodes) + Reminders/{uid} ───────
  await safe("reminders", async () => {
    await deleteCollection(collection(db, "Reminders", uid, "movies"));
    const tvShows = await getDocs(collection(db, "Reminders", uid, "tvShows"));
    for (const show of tvShows.docs) {
      await safe(`reminder-tv ${show.id}`, () =>
        deleteCollection(
          collection(db, "Reminders", uid, "tvShows", show.id, "episodes"),
        ),
      );
    }
    await deleteCollection(collection(db, "Reminders", uid, "tvShows"));
    await deleteDoc(doc(db, "Reminders", uid));
  });

  // ── UserStats / Presence ──────────────────────────────────────────────────
  await safe("userstats", () => deleteDoc(doc(db, "UserStats", uid)));
  // Firestore Presence: eski model kalıntısı; asıl presence RTDB'de.
  await safe("presence", () => deleteDoc(doc(db, "Presence", uid)));
  await safe("presence-rtdb", async () => {
    if (rtdb) await rtdbRemove(rtdbRef(rtdb, `presence/${uid}`));
  });

  // ── Sohbetler + messages ──────────────────────────────────────────────────
  // İki kaynaktan chatId topla: participants sorgusu (yeni dokümanlar) +
  // conversations index'inden türetilen id'ler (participants alanı olmayan
  // eski dokümanlar). Sorgu, rules'taki participants tabanlı read izniyle
  // çalışır; başarısız olsa bile türetilmiş id'lerle silme devam eder.
  await safe("chats", async () => {
    const chatIds = new Set(conversationChatIds);
    await safe("chats-query", async () => {
      const snap = await getDocs(
        query(
          collection(db, "chats"),
          where("participants", "array-contains", uid),
        ),
      );
      snap.docs.forEach((d) => chatIds.add(d.id));
    });
    for (const chatId of chatIds) {
      await safe(`chat ${chatId}`, async () => {
        await deleteCollection(collection(db, "chats", chatId, "messages"));
        await safe(`chat-pins ${chatId}`, () =>
          deleteCollection(collection(db, "chats", chatId, "pins")),
        );
        await deleteDoc(doc(db, "chats", chatId));
        // RTDB typing/presence metası (varsa).
        if (rtdb) {
          await safe(`chatMeta ${chatId}`, () =>
            rtdbRemove(rtdbRef(rtdb, `chatMeta/${chatId}`)),
          );
        }
      });
    }
  });

  // ── GRUP SOHBETLERİ ───────────────────────────────────────────────────────
  // POLİTİKA: mesajlar SİLİNİR, anonimleştirilmez. Serbest metin mesaj içeriği
  // göndereni ele verebildiği için "silinmiş kullanıcı" etiketiyle bırakmak
  // gerçek anonimleştirme sayılmaz — mağaza/GDPR uyumu için silme seçildi.
  // Grup, diğer üyeler için olduğu gibi yaşamaya devam eder.
  //
  // SIRA ÖNEMLİ: pins → messages → üyelik.
  //   • Pin silme izni pin'in işaret ettiği mesajın senderId'sine bakar (rules);
  //     mesaj önce gitseydi o get başarısız olur, pin silinemezdi.
  //   • Üyelikten çıkınca alt koleksiyonlara okuma/yazma hakkı biter.
  await safe("groups", async () => {
    const snap = await getDocs(
      query(collection(db, "groups"), where("members", "array-contains", uid)),
    );
    for (const g of snap.docs) {
      await safe(`group ${g.id}`, async () => {
        const data = g.data() || {};

        // 1) Sabitlemelerim + benim mesajlarıma ait sabitlemeler.
        for (const field of ["pinnedBy", "senderId"]) {
          await safe(`group-pins ${g.id} ${field}`, async () => {
            const pins = await getDocs(
              query(collection(db, "groups", g.id, "pins"), where(field, "==", uid)),
            );
            await deleteRefsInChunks(pins.docs.map((d) => d.ref));
          });
        }

        // 2) Mesajlarım.
        await safe(`group-messages ${g.id}`, async () => {
          const msgs = await getDocs(
            query(
              collection(db, "groups", g.id, "messages"),
              where("senderId", "==", uid),
            ),
          );
          await deleteRefsInChunks(msgs.docs.map((d) => d.ref));
        });

        // 3) Üyelik.
        const members = Array.isArray(data.members) ? data.members : [];
        const remaining = members.filter((m) => m && m !== uid);
        if (remaining.length === 0) {
          // Gruptaki son üye bendim → grup tümüyle gider. Mesaj/pin'ler zaten
          // benimdi ve yukarıda silindi; yine de alt koleksiyonları süpür
          // (Firestore doküman silince alt koleksiyonu silmez).
          await safe(`group-delete ${g.id}`, async () => {
            await deleteCollection(collection(db, "groups", g.id, "messages"));
            await deleteCollection(collection(db, "groups", g.id, "pins"));
            await deleteDoc(g.ref);
          });
          return;
        }

        const update = {
          members: arrayRemove(uid),
          admins: arrayRemove(uid),
          [`memberInfo.${uid}`]: deleteField(),
          updatedAt: serverTimestamp(),
        };
        if (data.createdBy === uid) {
          // Kurucu ayrılıyor: sahiplik devredilmezse grup YÖNETİLEMEZ hâle
          // gelir — yönetim kuralları createdBy'ın üye listesinde olmasını
          // şart koşar (firestore.rules → groups update). Öncelik mevcut bir
          // yöneticide, yoksa kalan ilk üyede.
          const admins = Array.isArray(data.admins) ? data.admins : [];
          const heir = remaining.find((m) => admins.includes(m)) || remaining[0];
          update.createdBy = heir;
          // Kurucu admins içinde tutulmaz (setGroupAdminRole ile aynı normalizasyon).
          update.admins = arrayRemove(uid, heir);
        }
        await safe(`group-leave ${g.id}`, () => updateDoc(g.ref, update));
      });
    }
  });

  // ── ORTAK LİSTELER ────────────────────────────────────────────────────────
  // Üyesi olduklarımdan ayrılırım — kural üyenin YALNIZ kendini çıkarmasına
  // izin verir (leaveSharedList). Kurucusu olduklarım, kendi postlarımla aynı
  // mantıkla (içerik bana ait) öğeleriyle birlikte silinir.
  await safe("shared-lists", async () => {
    const snap = await getDocs(
      query(
        collection(db, "SharedLists"),
        where("memberIds", "array-contains", uid),
      ),
    );
    for (const d of snap.docs) {
      const isOwner = (d.data() || {}).ownerId === uid;
      await safe(`shared-list ${d.id}`, () =>
        isOwner ? deleteSharedList(d.id) : leaveSharedList(d.id, uid),
      );
    }
  });

  // ── Username rezervasyonu ─────────────────────────────────────────────────
  if (usernameLower) {
    await safe("username", () =>
      deleteDoc(doc(db, "Usernames", usernameLower)),
    );
  }

  // ── Users/{uid} dokümanının kendisi ───────────────────────────────────────
  await safe("user-doc", () => deleteDoc(doc(db, "Users", uid)));

  // ── EN SON: Cloud Function'ın yazdığı sayaç / snapshot dokümanları ────────
  // SIRA ŞART: kural bu silmeleri yalnız Users/{uid} ARTIK YOKKEN kabul eder
  // (firestore.rules → AiUsage / ProviderWatch). NEDEN? AiUsage günlük AI
  // kotasıdır; koşulsuz bir delete izni "sil = kotayı sıfırla" exploit'i
  // açardı. Profil dokümanı yoksa kullanıcı zaten hesabını siliyordur.
  await safe("ai-usage", () => deleteDoc(doc(db, "AiUsage", uid)));
  await safe("provider-watch", () => deleteDoc(doc(db, "ProviderWatch", uid)));
}

/**
 * `deleteAccountData` Cloud Function'ını çağırır (functions/accountPurge.js).
 * Taze kimlik belirteci şart (sunucu `auth_time`ı denetler), bu yüzden belirteç
 * yenilenir. Hiçbir hata akışı durdurmaz: `complete: false` dönerse çağıran istemci
 * yedek silmeyi çalıştırır.
 *
 * @param {Object} [options]
 * @param {string} [options.phase] SERVER_PURGE_PHASES'ten biri; verilmezse sunucu hepsini çalıştırır.
 * @param {boolean} [options.refreshToken=true] Aşamalı çağrılarda belirteç bir kez yenilenir.
 * @returns {Promise<{complete: boolean, failed: string[]}>}
 */
export async function purgeOnServer(user = auth.currentUser, { phase, refreshToken = true } = {}) {
  try {
    if (refreshToken) await user.getIdToken(true);
    const { data } = await httpsCallable(fns, "deleteAccountData", {
      timeout: SERVER_PURGE_TIMEOUT_MS,
    })(phase ? { phase } : undefined);
    const failed = Array.isArray(data?.failed) ? data.failed : [];
    if (failed.length > 0 && __DEV__) console.warn("[deleteAccount] sunucu eksik:", failed);
    return { complete: failed.length === 0, failed };
  } catch (e) {
    if (__DEV__) console.warn("[deleteAccount] sunucu silmesi çağrılamadı:", e?.message || e);
    return { complete: false, failed: ["server-unavailable"] };
  }
}

// ── Yeniden doğrulama ───────────────────────────────────────────────────────

export const DeleteAccountCode = {
  NO_SESSION: "delete-account/no-session",
  NEEDS_PASSWORD: "delete-account/needs-password",
};

function deleteAccountError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Hesabın giriş yöntemleri. UI silme kartını buna göre çizer: parolası olanlara
 * şifre alanı, sosyal sağlayıcı hesaplarına sağlayıcı doğrulama butonu.
 *
 * @param {import("firebase/auth").User} [user] Varsayılan: auth.currentUser
 * @returns {{providerIds: string[], hasPassword: boolean, hasGoogle: boolean, hasApple: boolean}}
 */
export function getSignInMethods(user = auth.currentUser) {
  const providerIds = [
    ...new Set((user?.providerData || []).map((item) => item.providerId)),
  ];
  return {
    providerIds,
    hasPassword: providerIds.includes(EmailAuthProvider.PROVIDER_ID),
    hasGoogle: providerIds.includes(GoogleAuthProvider.PROVIDER_ID),
    hasApple: providerIds.includes("apple.com"),
  };
}

/**
 * Silme öncesi yeniden doğrulama. Sağlayıcıya göre yol seçer:
 *   - Apple varsa   → native Apple akışı (silmede yetki iptali için kod gerekir)
 *   - parola varsa  → e-posta + şifre (şifre zorunlu)
 *   - yoksa Google  → native hesap seçici + taze idToken
 *   - hiçbiri yoksa → doğrulama yapılamaz; deleteUser'ın kendi kararına bırak
 *
 * Apple bağlıysa diğer yöntemlerden önce Apple tercih edilir. Apple'ın hesap
 * silme yetkilendirmesini iptal etmek için taze authorization code gerekir.
 *
 * @param {Object} [params]
 * @param {string} [params.password]
 * @returns {Promise<{cancelled: boolean, appleAuthorizationCode?: string}>}
 *   { cancelled: true } — iptal bir hata değildir, çağıran sessizce durmalı.
 */
export async function reauthenticateForDeletion({ password } = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw deleteAccountError(
      DeleteAccountCode.NO_SESSION,
      "Oturum bulunamadı, lütfen tekrar giriş yapın.",
    );
  }

  const { hasPassword, hasGoogle, hasApple } = getSignInMethods(user);

  if (hasApple) {
    return await reauthenticateWithApple();
  }

  if (hasPassword && user.email) {
    if (!password) {
      throw deleteAccountError(
        DeleteAccountCode.NEEDS_PASSWORD,
        "Devam etmek için şifreni gir.",
      );
    }
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    return { cancelled: false };
  }

  if (hasGoogle) {
    return await reauthenticateWithGoogle();
  }

  // Bilinmeyen/başka bir sağlayıcı: burada durdurmak yerine devam et. Oturum
  // yeterince tazeyse silme çalışır; değilse deleteUser zaten
  // auth/requires-recent-login fırlatır ve UI kullanıcıyı yönlendirir.
  return { cancelled: false };
}

/** Silinen hesabın cihazdaki tüm yerel izleri (hata yutulur: hesap zaten gitti). */
function purgeDeviceResidue(uid) {
  try {
    resetWatchLedger(uid);
    purgeUserScope(uid);
  } catch (error) {
    if (__DEV__) console.warn("[deleteAccount] cihaz kalıntıları:", error?.message || error);
  }
}

/**
 * Hesabı tamamen siler: reauth → Firestore purge → Auth kullanıcısını sil.
 * Başarılı olduğunda Firebase otomatik sign-out yapar (onAuthStateChanged null).
 *
 * @param {Object} params
 * @param {string} [params.password]  Parola hesapları için yeniden doğrulama.
 * @param {boolean} [params.reauthenticated]  Çağıran az önce doğruladıysa true
 *   (sosyal akışta UI ayrı bir adımda doğruluyor). Hesap seçicinin ikinci kez
 *   açılmasını önler.
 * @param {string} [params.appleAuthorizationCode] Apple yetkisini iptal etmek
 *   için ayrı doğrulama adımından alınan tek kullanımlık kod.
 * @param {(event: {stage: string, stages: string[]}) => void} [params.onProgress]
 *   Her aşama BAŞLARKEN çağrılır; `stages` o anki gerçek aşama listesidir (sunucu yoksa
 *   `fallback` eklenir). Hataları yutulur — arayüz akışı bozamaz.
 * @returns {Promise<{cancelled: boolean}>} Doğrulama iptal edilirse
 *   { cancelled: true } döner ve HİÇBİR veri silinmez.
 */
export async function deleteAccount({
  password,
  reauthenticated = false,
  appleAuthorizationCode,
  onProgress,
} = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw deleteAccountError(
      DeleteAccountCode.NO_SESSION,
      "Oturum bulunamadı, lütfen tekrar giriş yapın.",
    );
  }
  const uid = user.uid;

  let stages = [...DELETE_STAGES];
  const report = (stage) => {
    try {
      onProgress?.({ stage, stages: [...stages] });
    } catch {
      // Arayüz hatası silmeyi durdurmasın.
    }
  };

  // 1) Yeniden doğrulama (requires-recent-login hatasını önler).
  report("verify");
  let authorizationCode = appleAuthorizationCode;
  if (!reauthenticated) {
    const { cancelled, appleAuthorizationCode: freshAppleCode } =
      await reauthenticateForDeletion({ password });
    if (cancelled) return { cancelled: true };
    authorizationCode = freshAppleCode;
  }

  // Apple bağlı hesapta uygulama hesabını silmeden önce Apple oturum yetkisini
  // de iptal et. Başarısızsa veriye dokunma; kullanıcı güvenle tekrar deneyebilir.
  if (getSignInMethods(user).hasApple) {
    await revokeAppleAuthorization(authorizationCode);
  }

  // 1.5) Yerel kopya VE bekleyen yazımlar, bulut silinmeden ÖNCE gider: yazma
  // günlüğü açık kalırsa arka plan işçisi silinen hesabın belgelerini bulutta
  // geri oluşturabilirdi (silme ile deleteUser arasındaki pencerede).
  report("local");
  purgeLocalUserData(uid);

  // 2) Firestore izlerini temizle (hâlâ kimlik doğrulanmışken). Önce sunucu, aşama
  // aşama (her aşama ilerlemeye yansır); hepsi tam bittiyse istemci yedeği çalıştırılmaz.
  // Sunucu yoksa ya da eksik bıraktıysa yedek, istemcinin yapabildiğini yapar —
  // kısmî temizlik > hiç yok.
  let needFallback = false;
  try {
    await user.getIdToken(true); // sunucu auth_time'ı denetler; belirteç bir kez yenilenir
  } catch {
    needFallback = true;
  }
  const ranPhases = [];
  if (!needFallback) {
    for (const phase of SERVER_PURGE_PHASES) {
      report(phase);
      const server = await purgeOnServer(user, { phase, refreshToken: false });
      ranPhases.push(phase);
      if (!server.complete) needFallback = true;
      // Sunucuya hiç ulaşılamıyorsa kalan aşamaları boşuna deneme.
      if (server.failed.includes("server-unavailable")) break;
    }
  }
  if (needFallback) {
    // Hiç koşmamış sunucu aşamaları listeden düşer, yedek hesap kapanışından önce araya girer.
    stages = stages.filter((stage) => !SERVER_PURGE_PHASES.includes(stage) || ranPhases.includes(stage));
    stages.splice(stages.indexOf("account"), 0, "fallback");
    report("fallback");
    await purgeUserData(uid);
  }

  // 3) Auth kullanıcısını sil — bu işlem oturumu da kapatır.
  report("account");
  try {
    await deleteUser(user);
  } catch (error) {
    if (error?.code !== "auth/requires-recent-login") throw error;
    // Buraya düşmek kötü: veri (2)'de silindi, hesap duruyor. Sahibi olmadığı
    // bir Auth kaydı bırakmamak için bir kez daha doğrulayıp tekrar dene.
    // Doğrulama da başarısız olursa kullanıcıya ORİJİNAL kodu göster ki UI
    // "yeniden doğrula" adımına yönlendirebilsin.
    let reauthOk = false;
    try {
      const retry = await reauthenticateForDeletion({ password });
      reauthOk = !retry.cancelled;
      if (reauthOk && retry.appleAuthorizationCode) {
        await revokeAppleAuthorization(retry.appleAuthorizationCode);
      }
    } catch {
      reauthOk = false;
    }
    if (!reauthOk) throw error;
    await deleteUser(user);
  }

  // 4) Cihazdaki kalıntılar. Çıkış yolu (AuthContext → clearUserScope) `keepOnLogout`
  // anahtarlara dokunmaz: rozet defteri, yıllık hedef, bingo, hızlı oyunlar, takip edilen
  // kişiler… Silinmiş hesabın dönüşü yok, bu yüzden hepsi burada gider. Rozet defteri
  // canlı kancanın belleğindeki kopyayla birlikte (resetWatchLedger) silinir.
  purgeDeviceResidue(uid);

  return { cancelled: false };
}

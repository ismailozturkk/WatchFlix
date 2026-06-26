// services/accountService.js
//
// Hesap silme — Firebase Auth kullanıcısını ve TÜM Firestore izlerini temizler.
//
// İki aşama:
//   1) purgeUserData(uid)  → Firestore'daki bütün veriyi siler (kendi + karşılıklı)
//   2) deleteAccount(...)  → reauth + purge + Firebase Auth kullanıcısını sil
//
// NEDEN reauth? Firebase, hesap silme gibi hassas işlemler için "yakın zamanda
// giriş" ister (auth/requires-recent-login). E-posta/şifre ile yeniden doğrularız.
//
// NEDEN purge önce, deleteUser sonra? Auth kullanıcısı silinince request.auth
// null olur ve güvenlik kuralları tüm yazmaları reddeder. O yüzden veriyi hâlâ
// kimlik doğrulanmışken sileriz.
//
// Silinen veriler:
//   KENDİ:
//     Users/{uid} + alt koleksiyonlar (friends, friendRequests, sentRequests,
//                  blocked, notifications, following, followers,
//                  likedPosts, bookmarks)
//     Usernames/{usernameLower}
//     Lists/{uid} (+ watchedTv/{showId}/seasons alt koleksiyonu)
//     Notes/{uid}/items
//     Reminders/{uid} (movies, tvShows/{showId}/episodes)
//     UserStats/{uid}
//     Presence/{uid}
//     Posts (authorId == uid) + her postun likes/comments alt koleksiyonu
//     chats (participants array-contains uid) + messages
//   KARŞILIKLI (başka kullanıcıların dokümanlarındaki izler):
//     - Arkadaşların friends/{uid} kaydı + friendsCount--
//     - Bana istek atanların sentRequests kaydı + pendingRequestsOutCount--
//     - İstek attıklarımın friendRequests kaydı + pendingRequestsInCount--
//     - Takipçilerin following/{uid} kaydı + followingCount--
//     - Takip ettiklerimin followers/{uid} kaydı + followersCount--

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  writeBatch,
  increment,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const CHUNK = 450; // Firestore batch limiti 500 — güvenli pay bıraktık.

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

// Verilen referansları 450'lik batch'ler hâlinde siler.
async function deleteRefsInChunks(refs) {
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Bir koleksiyonun tüm (üst seviye) dokümanlarını siler. Alt koleksiyonları
// otomatik silmez — onları çağıran taraf ayrıca temizlemeli.
async function deleteCollection(colRef) {
  const snap = await getDocs(colRef);
  if (!snap.empty) await deleteRefsInChunks(snap.docs.map((d) => d.ref));
  return snap.docs;
}

const reqId = (fromUid, toUid) => `${fromUid}_${toUid}`;

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

  // ── KENDİ Users ALT KOLEKSİYONLARI ────────────────────────────────────────
  const userSubcols = [
    "friends",
    "friendRequests",
    "sentRequests",
    "blocked",
    "notifications",
    "following",
    "followers",
    "likedPosts",
    "bookmarks",
  ];
  for (const sub of userSubcols) {
    await safe(`users-sub ${sub}`, () =>
      deleteCollection(collection(db, "Users", uid, sub)),
    );
  }

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
    await deleteDoc(doc(db, "Lists", uid));
  });

  // ── Notes/{uid}/items + Notes/{uid} ───────────────────────────────────────
  await safe("notes", async () => {
    await deleteCollection(collection(db, "Notes", uid, "items"));
    await deleteDoc(doc(db, "Notes", uid));
  });

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
  await safe("presence", () => deleteDoc(doc(db, "Presence", uid)));

  // ── Sohbetler (participants array-contains uid) + messages ─────────────────
  await safe("chats", async () => {
    const snap = await getDocs(
      query(
        collection(db, "chats"),
        where("participants", "array-contains", uid),
      ),
    );
    for (const d of snap.docs) {
      await safe(`chat ${d.id}`, async () => {
        await deleteCollection(collection(db, "chats", d.id, "messages"));
        await deleteDoc(d.ref);
      });
    }
  });

  // ── Username rezervasyonu ─────────────────────────────────────────────────
  if (usernameLower) {
    await safe("username", () =>
      deleteDoc(doc(db, "Usernames", usernameLower)),
    );
  }

  // ── EN SON: Users/{uid} dokümanının kendisi ───────────────────────────────
  await safe("user-doc", () => deleteDoc(doc(db, "Users", uid)));
}

/**
 * Hesabı tamamen siler: reauth → Firestore purge → Auth kullanıcısını sil.
 * Başarılı olduğunda Firebase otomatik sign-out yapar (onAuthStateChanged null).
 *
 * @param {Object} params
 * @param {string} params.password  E-posta/şifre hesapları için yeniden doğrulama.
 */
export async function deleteAccount({ password } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Oturum bulunamadı, lütfen tekrar giriş yapın.");
  const uid = user.uid;

  // 1) Yeniden doğrulama (requires-recent-login hatasını önler).
  if (user.email && password) {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  }

  // 2) Firestore izlerini temizle (hâlâ kimlik doğrulanmışken).
  await purgeUserData(uid);

  // 3) Auth kullanıcısını sil — bu işlem oturumu da kapatır.
  await deleteUser(user);
}

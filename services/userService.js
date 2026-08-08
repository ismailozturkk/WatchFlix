// services/userService.js
//
// User profil CRUD + Usernames reservation (atomic).
//
// ── Şema ─────────────────────────────────────────────────────────────────────
// Users/{uid}
//   uid, username, usernameLower, email, displayName, bio?,
//   avatarIndex, birthDate?      ← "YYYY-MM-DD"; yetişkin içerik kapısı
//                                  (utils/ageGate.js) yaşı buradan türetir.
//                                  Bu alan eklenmeden önceki hesaplarda YOK.
//   friendsCount, postsCount, followersCount, followingCount,
//   pendingRequestsInCount, pendingRequestsOutCount, unreadNotifsCount,
//   isOnline, lastActiveAt, lastSeen,
//   privacy: { profile, lists, posts, onlineStatus },
//   listVisible: { ...map },
//   createdAt, updatedAt,
//   _schemaVersion           ← migration tracking için
//
// Usernames/{usernameLower}
//   uid, reservedAt

import {
  doc,
  deleteField,
  FieldPath,
  getDoc,
  setDoc,
  updateDoc,
    collection,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { clampAvatarIndex, DEFAULT_AVATAR_INDEX } from "../utils/avatars";
import { parseBirthDate } from "../utils/ageGate";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

export const SCHEMA_VERSION = 2;

// Profil hataları koda bağlanır: UI, metne regex atmak yerine koda bakar ve
// kendi dilinde mesaj basar. (Mesajlar geriye dönük uyumluluk için aynı.)
export const UserProfileErrorCode = {
  USERNAME_TAKEN: "profile/username-taken",
  INVALID_USERNAME: "profile/invalid-username",
  MISSING_UID: "profile/missing-uid",
};

export class UserProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "UserProfileError";
    this.code = code;
  }
}

export const DEFAULT_PRIVACY = {
  profile: "public",
  lists: "public",
  posts: "public",
  onlineStatus: "everyone",
};

const DEFAULT_LIST_VISIBLE = {
  watchedMovies: true,
  watchedTv: true,
  watchList: true,
  favorites: true,
};

// ── Username helpers ────────────────────────────────────────────────────────

export function normalizeUsername(username) {
  return (username || "").trim().toLowerCase();
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(username) {
  return USERNAME_REGEX.test((username || "").trim());
}

/**
 * Username arama — usernameLower üzerinden prefix sorgu.
 * Single-field index Firestore'da otomatik, ek ayar gerek yok.
 */
export async function searchUsersByUsername(searchTerm, { excludeUid, max = 20 } = {}) {
  const q = normalizeUsername(searchTerm);
  if (!q) return [];
  const usersRef = collection(db, "Users");
  const snap = await getDocs(
    query(
      usersRef,
      where("usernameLower", ">=", q),
      where("usernameLower", "<=", q + ""),
      limit(max),
    ),
  );
  const results = [];
  snap.forEach((d) => {
    if (d.id === excludeUid) return;
    results.push({ uid: d.id, ...d.data() });
  });
  return results;
}

/**
 * Username serbest mi? Usernames/{lower} dokümanı yoksa serbest.
 */
export async function isUsernameAvailable(username, { excludeUid } = {}) {
  const lower = normalizeUsername(username);
  if (!isValidUsername(username)) return false;
  const snap = await getDoc(doc(db, "Usernames", lower));
  if (!snap.exists()) return true;
  // Kendi rezervasyonun senin için "dolu" değildir. excludeUid verilmezse eski
  // davranış korunur; profil tamamlama/retry akışları uid'yi geçer, aksi halde
  // kullanıcı kendi username'ini "alınmış" görüp ilerleyemez.
  return !!excludeUid && snap.data()?.uid === excludeUid;
}

// ── Profile CRUD ────────────────────────────────────────────────────────────

/**
 * Kayıt sırasında çağrılır. Username'i atomic olarak rezerve eder + Users doc'u
 * oluşturur. Username çakışırsa transaction rollback olur, hiçbir şey yazılmaz.
 *
 * @param {Object} params
 * @param {string} params.uid Firebase Auth uid'si
 * @param {string} params.username      "Ahmet_42" (görüntü)
 * @param {string} params.email
 * @param {string} params.displayName
 * @param {number} params.avatarIndex
 * @param {string} [params.birthDate] "YYYY-MM-DD" — yetişkin içerik kapısı
 *   yaşı bundan türetir. Biçim bozuksa alan hiç yazılmaz (kayıt düşmez);
 *   zorunluluğu kayıt ekranları uyguluyor.
 */
export async function createUserProfile({
  uid,
  username,
  email,
  displayName,
  birthDate,
  avatarIndex = DEFAULT_AVATAR_INDEX,
  // GA4 `sign_up` olayının `method` parametresi: "email" | "google".
  // Kayıt hunisinde hangi yöntemin dönüştüğünü ayırt etmek için.
  method = "unknown",
}) {
  if (!uid)
    throw new UserProfileError(
      UserProfileErrorCode.MISSING_UID,
      "createUserProfile: uid yok",
    );
  if (!isValidUsername(username))
    throw new UserProfileError(
      UserProfileErrorCode.INVALID_USERNAME,
      "Geçersiz kullanıcı adı (3-20 char, a-z 0-9 _)",
    );

  const usernameLower = normalizeUsername(username);
  // Doğrulanmamış bir değer Firestore'a girmesin; `undefined` yazmak da
  // setDoc'u düşürür, o yüzden alan ya geçerli ya da hiç yok.
  const dogumTarihi = parseBirthDate(birthDate) ? birthDate.trim() : null;

  // Bu çağrı hem YENİ profil açar hem de var olanın kimlik alanlarını tazeler
  // (Google bağlayan eski kullanıcı). `sign_up` yalnız gerçekten yeni profil
  // açıldığında gitmeli, yoksa kayıt sayısı her tazelemede şişer.
  // Transaction yeniden denenebildiği için bayrak her denemede sıfırlanır.
  let profileCreated = false;

  await runTransaction(db, async (tx) => {
    profileCreated = false;
    const usernameRef = doc(db, "Usernames", usernameLower);
    const userRef = doc(db, "Users", uid);

    // Firestore kuralı: bir transaction'daki TÜM okumalar yazımlardan önce.
    const [usernameSnap, userSnap] = await Promise.all([
      tx.get(usernameRef),
      tx.get(userRef),
    ]);

    if (usernameSnap.exists() && usernameSnap.data().uid !== uid) {
      throw new UserProfileError(
        UserProfileErrorCode.USERNAME_TAKEN,
        "Bu kullanıcı adı zaten alınmış",
      );
    }

    const existing = userSnap.exists() ? userSnap.data() : null;
    const previousLower = existing?.usernameLower;

    // Username değiştiyse eski rezervasyonu bırakmayacağız; yoksa o username
    // herkes için kalıcı olarak yanar. Ama önce OKU: var olmayan bir dokümana
    // tx.delete atmak kuralda `resource.data.uid` null üzerinden değerlendiği
    // için reddedilir ve tüm transaction'ı düşürür.
    // (Tüm okumalar yazımlardan önce bitmeli — bu yüzden burada.)
    let staleRef = null;
    if (existing && previousLower && previousLower !== usernameLower) {
      const ref = doc(db, "Usernames", previousLower);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data()?.uid === uid) staleRef = ref;
    }

    // ── Buradan sonrası yazım ──────────────────────────────────────────────

    // Rezervasyon zaten bizimse DOKUNMA. /Usernames'te `allow update` kuralı
    // yok; var olan bir dokümana tx.set atmak PERMISSION_DENIED ile tüm
    // transaction'ı düşürür — kendi username'iyle tekrar deneyen kullanıcı
    // (tam da desteklemek istediğimiz yol) buraya çarpıyordu.
    if (!usernameSnap.exists()) {
      tx.set(usernameRef, { uid, reservedAt: serverTimestamp() });
    }

    const identity = {
      uid,
      username: username.trim(),
      usernameLower,
      email,
      displayName: displayName || username,
      // Var olan profilde bu alan varsa ve bu çağrıda gelmediyse SİLİNMEMELİ —
      // merge yolundan geçen eski hesabın yaş kaydı düşerse kapı açılır.
      ...(dogumTarihi ? { birthDate: dogumTarihi } : {}),
      updatedAt: serverTimestamp(),
    };

    if (existing) {
      // Profil zaten var: yalnızca kimlik alanlarını tazele. Sayaçlar, bio,
      // avatar, privacy ve createdAt EZİLMEZ — bu yoldan geçen mevcut bir
      // hesabın (ör. Google bağlayan eski kullanıcı) tüm verisi sıfırlanıyordu.
      tx.set(userRef, identity, { merge: true });
      if (staleRef) tx.delete(staleRef);
      return;
    }

    tx.set(userRef, {
      ...identity,
      bio: "",
      avatarIndex: clampAvatarIndex(avatarIndex),

      friendsCount: 0,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      pendingRequestsInCount: 0,
      pendingRequestsOutCount: 0,
      unreadNotifsCount: 0,

      // NOT: isOnline/lastActiveAt/lastSeen ARTIK Presence/{uid}'de.
      // Bkz. services/presenceService.js

      privacy: DEFAULT_PRIVACY,
      listVisible: DEFAULT_LIST_VISIBLE,

      createdAt: serverTimestamp(),
      _schemaVersion: SCHEMA_VERSION,
    });

    profileCreated = true;
  });

  if (profileCreated) {
    trackEvent(ANALYTICS_EVENTS.SIGNUP, { method });
  }
}

/**
 * Profili al.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "Users", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/**
 * Tek alan güncelleme — updatedAt otomatik.
 */
export async function updateUserProfile(uid, partial) {
  await updateDoc(doc(db, "Users", uid), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
  // İsim değiştiyse Firebase Auth displayName'i de güncelle → yeni paylaşılan
  // postlar/yorumlar güncel ismi alır (createPost user.displayName okuyor).
  if (
    typeof partial.displayName === "string" &&
    auth.currentUser?.uid === uid
  ) {
    updateProfile(auth.currentUser, { displayName: partial.displayName }).catch(
      () => {},
    );
  }
}

/**
 * Username değiştir — eski rezervasyonu sil + yeni rezerve et.
 */
export async function changeUsername(uid, newUsername) {
  if (!isValidUsername(newUsername))
    throw new Error("Geçersiz kullanıcı adı");
  const newLower = normalizeUsername(newUsername);

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, "Users", uid);
    const newUsernameRef = doc(db, "Usernames", newLower);

    const [userSnap, newUsernameSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(newUsernameRef),
    ]);

    if (!userSnap.exists()) throw new Error("Profil bulunamadı");
    if (newUsernameSnap.exists() && newUsernameSnap.data().uid !== uid) {
      throw new Error("Bu kullanıcı adı zaten alınmış");
    }

    const oldLower = userSnap.data().usernameLower;

    // Eski rezervasyonu SİLMEDEN ÖNCE OKU. Rules `allow delete: resource.data.uid
    // == request.auth.uid` diyor; doküman yoksa (migrasyonu hiç çalışmamış eski
    // hesap, ya da migrasyonun rezervasyon adımı ağ hatasıyla düşmüş hesap)
    // resource null olduğu için delete reddedilir ve transaction atomik olduğundan
    // kullanıcı adı değişimi tümüyle iptal olur — kullanıcı adını bir daha
    // değiştiremez. Tüm okumalar yazımlardan ÖNCE bitmeli, bu yüzden burada.
    let staleUsernameRef = null;
    if (oldLower && oldLower !== newLower) {
      const ref = doc(db, "Usernames", oldLower);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data()?.uid === uid) staleUsernameRef = ref;
    }

    // ── Buradan sonrası yazım ────────────────────────────────────────────────

    // Rules yalnız create/delete'e izin veriyor ("Update yok") — doküman
    // zaten kendi uid'imizle varsa tx.set bir update sayılır ve
    // PERMISSION_DENIED tüm transaction'ı düşürür. createUserProfile'daki
    // guard'ın aynısı.
    if (!newUsernameSnap.exists()) {
      tx.set(newUsernameRef, { uid, reservedAt: serverTimestamp() });
    }
    if (staleUsernameRef) {
      tx.delete(staleUsernameRef);
    }
    tx.update(userRef, {
      username: newUsername.trim(),
      usernameLower: newLower,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Avatar değiştir — Users.avatarIndex'i set et.
 * (Eski post'lardaki authorAvatarIndex değişmez — bilinçli snapshot davranışı.)
 */
export async function setAvatarIndex(uid, avatarIndex) {
  await updateUserProfile(uid, {
    avatarIndex: clampAvatarIndex(avatarIndex),
  });
}

/**
 * Liste paylaşım bayrağını yeni ada taşır (`listVisible` haritası ADA bağlı).
 *
 * Liste yeniden adlandırıldığında çağrılır: taşınmazsa bayrak eski adda kalır,
 * liste de arkadaş profilinden sessizce düşerdi (FriendProfileScreen görünür
 * listeleri bu haritadan süzüyor).
 *
 * FieldPath: ad noktalıysa ("S.W.A.T.") string anahtar iç içe map'e çözülürdü.
 */
export async function moveListVisibility(uid, fromName, toName) {
  if (!uid || !fromName || !toName || fromName === toName) return;
  const snap = await getDoc(doc(db, "Users", uid));
  const raw = snap.exists() ? snap.data().listVisible : null;
  // Eski array formatı burada dönüştürülmez (migrateUserIfNeeded'ın işi);
  // yalnız map biçiminde güvenle taşınabilir.
  const wasVisible = !Array.isArray(raw) && raw?.[fromName] === true;
  await updateDoc(
    doc(db, "Users", uid),
    new FieldPath("listVisible", toName),
    wasVisible,
    new FieldPath("listVisible", fromName),
    deleteField(),
  );
}

/**
 * Privacy ayarlarını güncelle (kısmi merge).
 */
export async function updatePrivacy(uid, partialPrivacy) {
  const ref = doc(db, "Users", uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data().privacy || DEFAULT_PRIVACY : DEFAULT_PRIVACY;
  await updateDoc(ref, {
    privacy: { ...current, ...partialPrivacy },
    updatedAt: serverTimestamp(),
  });
}

// ── Migration ───────────────────────────────────────────────────────────────

/**
 * Eski şemadan yeni şemaya geçiş. UserProfileContext ilk açılışta çağırır.
 *
 * Yapılanlar:
 *   1. _schemaVersion < 2 ise eksik alanları doldur (counter, privacy, listVisible)
 *   2. usernameLower yoksa hesapla
 *   3. Usernames/{lower} rezervasyonu yoksa oluştur (geçmişe dönük)
 *   4. friends[] array varsa /friends/{uid} subcollection'a kopyala
 *   5. friendRequests.receivedRequest[] varsa /friendRequests/{id} subcoll'a
 *   6. friendRequests.sendRequest[] varsa /sentRequests/{id} subcoll'a
 *
 * Idempotent — defalarca çağrılabilir.
 */
export async function migrateUserIfNeeded(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return { migrated: false, reason: "no-doc" };

  const data = snap.data();
  if (data._schemaVersion >= SCHEMA_VERSION) {
    return { migrated: false, reason: "up-to-date" };
  }

  const updates = {};

  // 1) usernameLower
  if (!data.usernameLower && data.username) {
    updates.usernameLower = normalizeUsername(data.username);
  }

  // 2) Counters
  if (typeof data.friendsCount !== "number") {
    updates.friendsCount = Array.isArray(data.friends) ? data.friends.length : 0;
  }
  if (typeof data.postsCount !== "number") updates.postsCount = 0;
  if (typeof data.followersCount !== "number") updates.followersCount = 0;
  if (typeof data.followingCount !== "number") updates.followingCount = 0;
  if (typeof data.pendingRequestsInCount !== "number") {
    updates.pendingRequestsInCount =
      data.friendRequests?.receivedRequest?.length || 0;
  }
  if (typeof data.pendingRequestsOutCount !== "number") {
    updates.pendingRequestsOutCount =
      data.friendRequests?.sendRequest?.length || 0;
  }
  if (typeof data.unreadNotifsCount !== "number") updates.unreadNotifsCount = 0;

  // 3) Privacy
  if (!data.privacy || typeof data.privacy !== "object") {
    updates.privacy = DEFAULT_PRIVACY;
  }

  // 4) listVisible — array formatından map'e dönüştür
  if (Array.isArray(data.listVisible)) {
    const map = {};
    data.listVisible.forEach((entry) => {
      const k = Object.keys(entry)[0];
      const v = entry[k];
      if (k) map[k] = !!v;
    });
    updates.listVisible = { ...DEFAULT_LIST_VISIBLE, ...map };
  } else if (!data.listVisible) {
    updates.listVisible = DEFAULT_LIST_VISIBLE;
  }

  // 5) avatarIndex (null → 0)
  if (typeof data.avatarIndex !== "number") {
    updates.avatarIndex = DEFAULT_AVATAR_INDEX;
  }

  // 6) bio
  if (typeof data.bio !== "string") updates.bio = "";

  // 7) Username reservation — yoksa oluştur
  const lowerForReservation = updates.usernameLower || data.usernameLower;
  if (lowerForReservation) {
    const usernameSnap = await getDoc(doc(db, "Usernames", lowerForReservation));
    if (!usernameSnap.exists()) {
      await setDoc(doc(db, "Usernames", lowerForReservation), {
        uid,
        reservedAt: serverTimestamp(),
      });
    }
  }

  // 8) Alan güncellemeleri — _schemaVersion HARİÇ. Versiyon damgası en sona
  //    bırakılıyor: aşağıdaki friends kopyalaması ağ hatasıyla yarıda kalırsa
  //    versiyon eski kalmalı ki bir sonraki açılışta migrasyon baştan denensin.
  //    (Adımların hepsi idempotent.) Eskiden versiyon burada yazıldığı için
  //    yarım migrasyon "tamam" işaretleniyor ve arkadaş listesi kalıcı olarak
  //    boş kalıyordu.
  updates.updatedAt = serverTimestamp();

  await updateDoc(userRef, updates);

  // 9) friends[] → /friends subcollection (lazy, sadece eksikse)
  if (Array.isArray(data.friends) && data.friends.length > 0) {
    // Firestore batch limiti 500 — 400'de chunk'ı yazıp yeni batch açıyoruz.
    // Eskiden burada `break` vardı; 400'den fazla arkadaşı olan kullanıcının
    // kalanı hiç taşınmıyordu.
    let batch = writeBatch(db);
    let writesQueued = 0;
    for (const f of data.friends) {
      if (!f?.uid) continue;
      const fRef = doc(db, "Users", uid, "friends", f.uid);
      const fSnap = await getDoc(fRef);
      if (!fSnap.exists()) {
        batch.set(fRef, {
          friendUid: f.uid,
          friendName: f.displayName || "",
          friendUsername: f.username || "",
          friendAvatarIndex: clampAvatarIndex(f.avatarIndex),
          friendsSince: serverTimestamp(),
        });
        writesQueued++;
      }
      if (writesQueued >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        writesQueued = 0;
      }
    }
    if (writesQueued > 0) await batch.commit();
  }

  // 10) Her şey bittikten SONRA versiyonu yükselt.
  await updateDoc(userRef, {
    _schemaVersion: SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
  });

  return {
    migrated: true,
    fieldsAdded: [...Object.keys(updates), "_schemaVersion"],
  };
}

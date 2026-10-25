// services/accountResetService.js
//
// Hesabı SIFIRLA — hesap (giriş, profil kimliği, arkadaşlar, gönderiler, sohbetler)
// durur; kişisel kütüphane ve ilerleme sıfırlanır. "Hesabı sil"in (accountService)
// hafif kardeşi: aynı doğrulama, aynı ilerleme listesi arayüzü, ama oturum açık kalır.
//
// SİLİNEN (bulut + bu cihazdaki kopya):
//   Lists/{uid}  → favoriler, izlenecekler, izlenen filmler/diziler (+ sezon alt
//                  koleksiyonları), özel listeler, Wrapped özetleri; kök belge
//                  (sayaçlar, statusIndex, istatistik) yeniden BOŞ kurulur
//   ETKİNLİKLERİM (Profil > Etkinliklerim'in altı sekmesi):
//                  puanlar (Ratings agregatı düşer, ratingsService.removeMyRating), yorumlar
//                  (post + film/dizi yorumları ve yanıtları), gönderiler (likes/comments ile),
//                  beğeniler ve kaydedilenler (+ ayna koleksiyonları myComments|likedPosts|
//                  bookmarks|myRatings), gönderi sayacı (postsCount → 0); gönderi ve story
//                  TASLAKLARI (yerel)
//   ROZETLER      → yalnız bu cihazdadır (defter): utils/watchBadgeLedger.resetWatchLedger
//                  anahtarları siler VE canlı kancanın bellekteki rozet kümesini boşaltır
//                  (yoksa bir sonraki mutabakat onu yeniden tohumlardı)
//   Notes, MediaNotes, Reminders, AiConversations (CineMatch sohbet geçmişi)
//   SceneGame, SceneGameHistory, GameLeaderboards girdileri, Users/{uid}/gameProfile|
//                  gameStats|gameSessions, UserStats/{uid}
//   Yalnız bu cihazda duran ilerleme: yıllık hedef, bingo, hızlı oyunlar, Günün Sorusu,
//                  "Önce hangisi?", takip edilen kişiler, son CineSwipe sonucu, CineMatch sohbet
//                  kopyası, içerik-etkinlik (puanladım/yorumladım) önbelleği
//
// KALAN: Firebase Auth hesabı, profil kimliği (isim, kullanıcı adı, avatar, bio, doğum
//   tarihi, dört favori, sosyal hesaplar, kimlik rozetleri), arkadaşlar/takip, sohbetler,
//   gruplar ve ortak listeler, ayarlar, abonelik/yetki. Günlük premium haklar da kalır —
//   `premiumDailyUsage` bilerek SİLİNMEZ (sıfırlamak günlük hakkı yenilemenin yolu olmasın).
//
// SIRA: önce eşitleme işçisi durdurulur (yoksa yerel yazma günlüğü silinen belgeleri
// bulutta geri yaratırdı), sonra bulut, en sonda yerel kopya + işçi yeniden başlar.
// Her adım bağımsız: biri düşerse diğerleri çalışır, sonunda `RESET_INCOMPLETE` fırlatılır
// (idempotent — kullanıcı tekrar deneyebilir). Sunucu yolu YOK: bu veriler istemci
// kurallarının zaten silmeye izin verdiği yerler (hesap silmenin yedek yolu ile aynı).

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { dailyBoardId, dayKeyOf, previousDayKey } from "../utils/dailyChallenge";
import { resetWatchLedger } from "../utils/watchBadgeLedger";
import {
  deleteCollection,
  purgeMyComments,
  purgeMyPostLikes,
  purgeMyPosts,
  purgeMyRatings,
  readMyComments,
  reauthenticateForDeletion,
} from "./accountService";
import { ensureListsRoot } from "./listItemsService";
import { setLocalList } from "./listSyncService";
import { purgeUserData as purgeLocalUserData, startUserData, stopUserData } from "./userData";
import { Keys, remove as removeStored } from "./storage";

/** İlerleme ekranı aşamaları, çalışma sırasıyla (metinler resetAccountCopy.js'te). */
export const RESET_STAGES = Object.freeze([
  "verify",
  "library",
  "activity",
  "notes",
  "games",
  "local",
]);

export const ResetAccountCode = Object.freeze({
  NO_SESSION: "reset-account/no-session",
  INCOMPLETE: "reset-account/incomplete",
});

/** Bu cihazda duran, buluta yazılmayan ilerleme anahtarları. */
// (Rozet defteri burada DEĞİL: `resetWatchLedger` ile, canlı kancayı da boşaltarak silinir.)
const LOCAL_PROGRESS_KEYS = Object.freeze([
  Keys.yearlyGoals,
  Keys.cinemaBingo,
  Keys.cinemaBingoMonthly,
  Keys.quickGames,
  Keys.dailyPoll,
  Keys.olderGame,
  Keys.followedPeople,
  Keys.cineLastResult,
  Keys.cineResultHistory,
  Keys.aiCineConversations,
  // Etkinliklerim > Taslaklar / Story + not madde taslakları.
  Keys.postDrafts,
  Keys.storyDrafts,
  Keys.noteTodoDrafts,
  // "Puanladım / yorumladım" işaretleri ve liste durumu önbelleği (canlı kök belge yeniden doldurur).
  Keys.mediaActivity,
  Keys.listStatus,
]);

const LIST_SLOTS = Object.freeze(["favorites", "watchList", "watchedMovies", "watchedTv"]);
const DAILY_LOOKBACK_DAYS = 90;

function resetError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

/**
 * Hesabı sıfırlar: doğrulama → bulut → yerel. Doğrulama iptal edilirse
 * `{ cancelled: true }` döner ve HİÇBİR veri silinmez.
 *
 * @param {object} [params]
 * @param {string}  [params.password]          parola hesapları için
 * @param {boolean} [params.reauthenticated]   çağıran az önce sağlayıcıyla doğruladıysa true
 * @param {(event: {stage: string, stages: string[]}) => void} [params.onProgress]
 * @returns {Promise<{cancelled: boolean}>}
 * @throws ResetAccountCode.INCOMPLETE (`error.failed`: adımlar) — bir kısım silinemedi
 */
export async function resetAccount({ password, reauthenticated = false, onProgress } = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw resetError(ResetAccountCode.NO_SESSION, "Oturum bulunamadı, lütfen tekrar giriş yapın.");
  }
  const uid = user.uid;
  const stages = [...RESET_STAGES];
  const report = (stage) => {
    try {
      onProgress?.({ stage, stages: [...stages] });
    } catch {
      // Arayüz hatası sıfırlamayı durdurmasın.
    }
  };
  const failed = [];
  const step = async (label, fn) => {
    try {
      return await fn();
    } catch (error) {
      failed.push(label);
      if (__DEV__) console.warn(`[resetAccount] ${label}:`, error?.message || error);
      return null;
    }
  };

  // 1) Doğrulama. Hata (yanlış şifre, iptal…) buradan çıkar, hiçbir şey silinmemiştir.
  report("verify");
  if (!reauthenticated) {
    const { cancelled } = await reauthenticateForDeletion({ password });
    if (cancelled) return { cancelled: true };
  }

  // 2) İşçiyi durdur: bekleyen yazımlar silinen belgeleri geri yaratmasın.
  stopUserData(uid);

  // 3) Kütüphane: listeler + kök belge.
  report("library");
  await step("lists", async () => {
    const watchedTv = await getDocs(collection(db, "Lists", uid, "watchedTv"));
    for (const show of watchedTv.docs) {
      // Eski model: sezonlar alt koleksiyondaydı (yeni modelde belge içinde gömülü).
      await step(`watchedTv ${show.id}`, () =>
        deleteCollection(collection(db, "Lists", uid, "watchedTv", show.id, "seasons")),
      );
    }
    await deleteCollection(collection(db, "Lists", uid, "watchedTv"));
    for (const sub of ["favorites", "watchList", "watchedMovies", "customItems", "wrapped"]) {
      await step(`lists-sub ${sub}`, () => deleteCollection(collection(db, "Lists", uid, sub)));
    }
    await deleteDoc(doc(db, "Lists", uid));
  });
  await step("lists-root", () => ensureListsRoot(uid));

  // 4) Etkinliklerim: yorumlar → gönderiler → puanlar → beğeniler (hesap silmeyle AYNI
  // parçalar, aynı sıra: aynalar silinmeden önce okunur, yorumlar gönderilerden önce
  // işlenir). Sonra ayna koleksiyonları ve gönderi sayacı.
  report("activity");
  const myComments = await readMyComments(uid);
  await step("comments", () => purgeMyComments(uid, myComments));
  await step("posts", () => purgeMyPosts(uid));
  await step("ratings", () => purgeMyRatings(uid));
  await step("post-likes", () => purgeMyPostLikes(uid));
  for (const sub of ["myComments", "likedPosts", "bookmarks", "myRatings"]) {
    await step(`users-sub ${sub}`, () => deleteCollection(collection(db, "Users", uid, sub)));
  }
  // Etkinliklerim'deki "Postlar" sayısı Users/{uid}.postsCount'tan okunur.
  await step("posts-count", () => updateDoc(doc(db, "Users", uid), { postsCount: 0 }));

  // 5) Notlar, hatırlatıcılar, yapay zeka sohbetleri.
  report("notes");
  await step("notes", async () => {
    await deleteCollection(collection(db, "Notes", uid, "items"));
    await deleteDoc(doc(db, "Notes", uid));
  });
  await step("media-notes", () => deleteCollection(collection(db, "MediaNotes", uid, "items")));
  await step("ai-conversations", () =>
    deleteCollection(collection(db, "AiConversations", uid, "items")),
  );
  await step("reminders", async () => {
    await deleteCollection(collection(db, "Reminders", uid, "movies"));
    const tvShows = await getDocs(collection(db, "Reminders", uid, "tvShows"));
    for (const show of tvShows.docs) {
      await step(`reminder-tv ${show.id}`, () =>
        deleteCollection(collection(db, "Reminders", uid, "tvShows", show.id, "episodes")),
      );
    }
    await deleteCollection(collection(db, "Reminders", uid, "tvShows"));
    await deleteDoc(doc(db, "Reminders", uid));
  });

  // 6) Oyunlar + istatistik özeti.
  report("games");
  for (const sub of ["gameProfile", "gameStats", "gameSessions"]) {
    await step(`users-sub ${sub}`, () => deleteCollection(collection(db, "Users", uid, sub)));
  }
  await step("scene-game", () => deleteDoc(doc(db, "SceneGame", uid)));
  await step("scene-game-history", () => deleteDoc(doc(db, "SceneGameHistory", uid)));
  await step("game-leaderboards", async () => {
    for (const mode of ["classic", "time_attack", "survival"]) {
      for (const level of ["easy", "normal", "hard"]) {
        await step(`leaderboard scene_${mode}_${level}`, () =>
          deleteDoc(doc(db, "GameLeaderboards", `scene_${mode}_${level}`, "entries", uid)),
        );
      }
    }
  });
  await step("daily-leaderboards", async () => {
    let dayKey = dayKeyOf();
    for (let i = 0; i < DAILY_LOOKBACK_DAYS && dayKey; i += 1) {
      const key = dayKey;
      await step(`daily-leaderboard ${key}`, () =>
        deleteDoc(doc(db, "GameLeaderboards", dailyBoardId(key), "entries", uid)),
      );
      dayKey = previousDayKey(key);
    }
  });
  await step("userstats", () => deleteDoc(doc(db, "UserStats", uid)));

  // 7) Bu cihazdaki kopya + işçiyi yeniden başlat. Bulut boşaldığı için yerel haritalar
  // da boş yazılır: ListStatusContext abonesi ekranı anında boşaltır.
  report("local");
  await step("local", async () => {
    purgeLocalUserData(uid);
    LIST_SLOTS.forEach((listKey) => setLocalList(uid, listKey, {}));
    LOCAL_PROGRESS_KEYS.forEach((descriptor) => removeStored(descriptor, { uid }));
    resetWatchLedger(uid);
  });
  startUserData(uid);

  if (failed.length) {
    throw resetError(ResetAccountCode.INCOMPLETE, "Bazı veriler sıfırlanamadı.", { failed });
  }
  return { cancelled: false };
}

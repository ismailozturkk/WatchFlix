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
//   Users/{uid}/myRatings + Ratings/*/userRatings/{uid}  → agregatlarla tutarlı
//                  (ratingsService.removeMyRating)
//   Notes, MediaNotes, Reminders, AiConversations (CineMatch sohbet geçmişi)
//   SceneGame, SceneGameHistory, GameLeaderboards girdileri, Users/{uid}/gameProfile|
//                  gameStats|gameSessions, UserStats/{uid}
//   Yalnız bu cihazda duran ilerleme: rozet defteri, yıllık hedef, bingo, hızlı oyunlar,
//                  Günün Sorusu, "Önce hangisi?", takip edilen kişiler, son CineSwipe sonucu, CineMatch sohbet kopyası
//
// KALAN: Firebase Auth hesabı, profil kimliği (isim, kullanıcı adı, avatar, bio, doğum
//   tarihi, dört favori, sosyal hesaplar), arkadaşlar/takip, gönderiler/yorumlar/sohbetler,
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
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { dailyBoardId, dayKeyOf, previousDayKey } from "../utils/dailyChallenge";
import { removeMyRating } from "./ratingsService";
import { deleteCollection, reauthenticateForDeletion } from "./accountService";
import { ensureListsRoot } from "./listItemsService";
import { setLocalList } from "./listSyncService";
import { purgeUserData as purgeLocalUserData, startUserData, stopUserData } from "./userData";
import { Keys, remove as removeStored } from "./storage";

/** İlerleme ekranı aşamaları, çalışma sırasıyla (metinler resetAccountCopy.js'te). */
export const RESET_STAGES = Object.freeze([
  "verify",
  "library",
  "ratings",
  "notes",
  "games",
  "local",
]);

export const ResetAccountCode = Object.freeze({
  NO_SESSION: "reset-account/no-session",
  INCOMPLETE: "reset-account/incomplete",
});

/** Bu cihazda duran, buluta yazılmayan ilerleme anahtarları. */
const LOCAL_PROGRESS_KEYS = Object.freeze([
  Keys.watchLedger,
  Keys.watchCatalogSeen,
  Keys.yearlyGoals,
  Keys.cinemaBingo,
  Keys.cinemaBingoMonthly,
  Keys.quickGames,
  Keys.dailyPoll,
  Keys.olderGame,
  Keys.followedPeople,
  Keys.cineLastResult,
  Keys.aiCineConversations,
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

  // 4) Puanlar: her oy agregatı düşürerek kaldırılır.
  report("ratings");
  await step("ratings", async () => {
    const snap = await getDocs(collection(db, "Users", uid, "myRatings"));
    for (const entry of snap.docs) {
      const data = entry.data() || {};
      if (!data.mediaType || data.mediaId == null) {
        await step(`rating-mirror ${entry.id}`, () => deleteDoc(entry.ref));
        continue;
      }
      await step(`rating ${entry.id}`, () =>
        removeMyRating({ mediaType: data.mediaType, mediaId: data.mediaId, uid }),
      );
    }
  });

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
  });
  startUserData(uid);

  if (failed.length) {
    throw resetError(ResetAccountCode.INCOMPLETE, "Bazı veriler sıfırlanamadı.", { failed });
  }
  return { cancelled: false };
}

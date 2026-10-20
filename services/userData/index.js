// services/userData/index.js
//
// YEREL-ÖNCELİKLİ KULLANICI VERİSİ — uygulamanın varsayılan kablolaması.
//
// Ekranlar/context'ler YALNIZ buradan içe aktarır; motor (createDomain), işçi
// (syncWorker) ve günlük (outbox) Firebase'siz, enjekte edilebilir parçalar.
//
//   notesDomain · mediaNotesDomain · remindersDomain   okuma (senkron) + apply
//   aiConversationsDomain · aiConversations            AI sohbet geçmişi (+ depo API'si)
//   remindersActions                                    hatırlatıcı yazma
//   startUserData(uid)                                  giriş: işçi + indirme
//   clearUserLocal(uid)                                 çıkış
//   purgeUserData(uid)                                  hesap silme
//
// Tam mimari: docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md

import { auth } from "../../firebase";
import { getIsOnline, subscribeOnline } from "../../context/ConnectivityContext";
import * as snapshot from "../snapshotCache";
import { Keys, get as readKey, remove as removeKey } from "../storage";
import { cacheKeys } from "../../utils/cacheKeys";
import * as outbox from "./outbox";
import { createFirestoreRemote } from "./firestoreRemote";
import { createSyncWorker } from "./syncWorker";
import { marker } from "./hydrationMarker";
import { createUserDataDomain } from "./createDomain";
import { createAiConversationsApi } from "./aiConversations";
import {
  aiConversationsSpec,
  createRemindersActions,
  mediaNotesSpec,
  notesSpec,
  remindersSpec,
} from "./domains";

const remote = createFirestoreRemote();

/** Firebase oturumu bu uid için çözüldü mü (token'sız yazma/okuma denemeyelim). */
const isAuthed = (uid) => auth.currentUser?.uid === uid;

const worker = createSyncWorker({
  remote,
  outbox,
  isOnline: getIsOnline,
  isAuthed,
  // Onay sırası kuralı: günlükten silmeden önce yerel kontrol noktası diskte.
  beforeAck: () => snapshot.flushSnapshotWrites(),
});

const deps = {
  snapshot,
  outbox,
  remote,
  requestFlush: (uid) => worker.requestFlush(uid),
  canFetch: (uid) => getIsOnline() && isAuthed(uid),
  marker,
};

export const notesDomain = createUserDataDomain(notesSpec, deps);
export const mediaNotesDomain = createUserDataDomain(mediaNotesSpec, deps);
export const remindersDomain = createUserDataDomain(remindersSpec, deps);
export const aiConversationsDomain = createUserDataDomain(aiConversationsSpec, deps);
export const ALL_DOMAINS = Object.freeze([
  notesDomain,
  mediaNotesDomain,
  remindersDomain,
  aiConversationsDomain,
]);

export const remindersActions = createRemindersActions(remindersDomain);

/**
 * AI sohbet geçmişi. Bulut öncesi sürümün yerel (MMKV) geçmişi ilk girişte
 * buluta taşınır ve yerel anahtar silinir (`migrateLegacy`).
 */
export const aiConversations = createAiConversationsApi(aiConversationsDomain, {
  read: (uid) => readKey(Keys.aiCineConversations, { uid }),
  clear: (uid) => removeKey(Keys.aiCineConversations, { uid }),
});

let activeUid = null;

/** Hazır olmayan alanları (yerel kopya yok) tek seferlik indirmeyi dener. */
export function retryUserData() {
  if (!activeUid) return;
  for (const domain of ALL_DOMAINS) domain.ensureHydrated(activeUid);
}

/** Ağ geldi / uygulama öne geldi / arka plana gidiyor: bekleyen yazımları hemen dene. */
export function nudgeUserData() {
  worker.nudge();
}

/**
 * Oturum açıldı. Yerel kopyası olan alanlar için AĞ TRAFİĞİ OLUŞMAZ; yalnız
 * kopyası olmayanlar (yeni cihaz / sıfırlama / yeni hesap) bir kez indirilir.
 */
export function startUserData(uid) {
  if (!uid) return;
  activeUid = uid;
  worker.start(uid);
  retryUserData();
  // İndirme başladıktan SONRA: taşınan sohbetler indirme günlüğüne düşer ve
  // gelen bulut verisinin üstüne bindirilir (createDomain.js "İNDİRME SIRASINDA").
  try {
    aiConversations.migrateLegacy(uid);
  } catch {
    // eski geçmiş taşınamadı: yerel anahtar yerinde kalır, bir sonraki girişte tekrar
  }
}

export function stopUserData(uid) {
  if (activeUid === uid) activeUid = null;
  worker.stop(uid);
}

/** Çıkıştan ÖNCE: bekleyen yazımları en çok `timeoutMs` bekleyerek göndermeyi dene. */
export function flushUserData(uid, { timeoutMs = 4000 } = {}) {
  return worker.flushNow(uid, { timeoutMs });
}

/**
 * Listeler (Lists/{uid}/*) bu motorun alanı DEĞİL — kendi katmanı var
 * (ListStatusContext + listSyncService) — ama yerel kopyaları da kalıcı
 * dizinde durduğu için çıkışta aynı şekilde silinir.
 */
const LIST_SLOTS = ["root", "favorites", "watchList", "watchedMovies", "watchedTv"];

/**
 * Çıkış: bu kullanıcının YEREL kopyası silinir (cihazda özel veri kalmasın).
 * Yazma günlüğüne dokunulmaz — onaysız değişiklik, aynı hesapla tekrar
 * girildiğinde buluta gider.
 */
export function clearUserLocal(uid) {
  if (!uid) return;
  stopUserData(uid);
  for (const domain of ALL_DOMAINS) domain.clearLocal(uid);
  for (const name of LIST_SLOTS) snapshot.dropSnapshot(cacheKeys.lists(uid, name));
}

/** Hesap silindi: yerel kopya VE bekleyen yazımlar (gidecek bir yer kalmadı). */
export function purgeUserData(uid) {
  if (!uid) return;
  clearUserLocal(uid);
  outbox.clear(uid);
}

/**
 * Yerel kopyayı bulutla DEĞİŞTİRİR ("Verileri indir" / önbellek ekranı).
 * Çevrimdışıysa hiçbir şey yapmaz — yerel veri korunur.
 * @param {string} uid
 * @param {string[]} [names] alan adları; verilmezse hepsi
 * @returns {Promise<boolean>} hepsi başarılı mı
 */
export async function resyncUserData(uid, names) {
  if (!uid) return false;
  const targets = names?.length
    ? ALL_DOMAINS.filter((domain) => names.includes(domain.name))
    : ALL_DOMAINS;
  const results = await Promise.all(targets.map((domain) => domain.resync(uid)));
  return results.every(Boolean);
}

/** Yalnız test: "uygulama kapandı, yeniden açıldı" — bellek düşer, disk + MMKV kalır. */
export function __resetUserDataMemory() {
  activeUid = null;
  for (const domain of ALL_DOMAINS) domain.__resetMemory();
  outbox.__resetMemory();
}

export const getSyncStatus = (uid) => worker.getStatus(uid);
export const subscribeSyncStatus = (listener) => worker.subscribeStatus(listener);

// Bağlantı geri geldi: bekleyen yazımları boşalt, eksik indirmeleri tamamla.
subscribeOnline(() => {
  nudgeUserData();
  retryUserData();
});

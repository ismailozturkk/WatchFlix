// services/photoRevalidation.js
//
// Adresi değişmeden içeriği yenilenen fotoğrafların (Google profil resmi)
// arka plan denetimi ve sürüm deposu. Neden gerektiği ve kararlar:
// utils/photoRevalidation.js.
//
//   - Sürüm deposu: adres → { v: sürüm, h: md5, at: son denetim }. Cihaz
//     düzeyindedir (görsel önbelleği de öyle; hesap değişince aynı dosyalar
//     kullanılır) ve `cache` deposundadır: "Önbelleği temizle" ikisini birlikte
//     siler. Görseller `useFreshPhotoSource` ile abone olur.
//   - Denetim: adres ağdan önbelleğe uğramadan indirilir, md5 kayıtlıyla
//     karşılaştırılır; farklıysa dosya `Image.writeToCacheAsync` ile yeni
//     sürümün anahtarına yazılır ve aboneler o anahtara geçer — yeni resim
//     diskten anında çizilir.

import { Image } from "expo-image";
import { Directory, File, Paths } from "expo-file-system";
import { Keys, get, set } from "./storage";
import {
  PHOTO_CHECK_RETRY_MS,
  PHOTO_CHECK_TTL_MS,
  isPhotoCheckDue,
  isRevalidatedPhoto,
  photoCacheKey,
  planPhotoCheck,
  prunePhotoEntries,
} from "../utils/photoRevalidation";

const TEMP_DIRNAME = "photo-check";
const MAX_PARALLEL = 2;
// Uzun bir yorum/liderlik listesi onlarca yabancı avatarı aynı anda denetime
// sokmasın: oturum başına üst sınır. Öncelikli (kendi fotoğrafım) sayılmaz.
const MAX_CHECKS_PER_SESSION = 80;
// Ara katman (iOS URLCache) eski yanıtı vermesin.
const NO_CACHE_HEADERS = { "Cache-Control": "no-cache", Pragma: "no-cache" };

let entries = null;
const listeners = new Set();
const queue = [];
const queued = new Set();
const failedAt = new Map();
let running = 0;
let budget = MAX_CHECKS_PER_SESSION;
let seq = 0;

function load() {
  if (!entries) {
    const stored = get(Keys.photoVersions);
    entries = stored && typeof stored === "object" ? { ...stored } : {};
  }
  return entries;
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Bir abonenin hatası diğerlerini durdurmasın.
    }
  });
}

export function subscribePhotoVersions(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Adresin önbellekteki son sürümü (0 = sürümsüz, adresin kendisi). */
export function getPhotoVersion(uri) {
  return load()[uri]?.v || 0;
}

/**
 * Adresi denetim sırasına koy; vadesi gelmediyse, yakın zamanda düştüyse ya da
 * zaten sıradaysa hiçbir şey yapmaz. Senkron ve ucuz — her render'da çağrılabilir.
 *
 * @param {string} uri
 * @param {{maxAgeMs?:number, priority?:boolean}} [options] `priority`: sıranın
 *   başına geçer, oturum sınırına sayılmaz (kendi fotoğrafım).
 */
export function requestPhotoCheck(uri, { maxAgeMs = PHOTO_CHECK_TTL_MS, priority = false } = {}) {
  if (!isRevalidatedPhoto(uri) || queued.has(uri)) return;
  const now = Date.now();
  if (!isPhotoCheckDue(load()[uri], now, maxAgeMs)) return;
  if (now - (failedAt.get(uri) || 0) < PHOTO_CHECK_RETRY_MS) return;
  if (!priority) {
    if (budget <= 0) return;
    budget -= 1;
  }
  queued.add(uri);
  if (priority) queue.unshift(uri);
  else queue.push(uri);
  pump();
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const uri = queue.shift();
    running += 1;
    checkPhoto(uri)
      .catch(() => {
        failedAt.set(uri, Date.now());
      })
      .finally(() => {
        running -= 1;
        queued.delete(uri);
        pump();
      });
  }
}

async function checkPhoto(uri) {
  const dir = new Directory(Paths.cache, TEMP_DIRNAME);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `${Date.now().toString(36)}-${(seq += 1)}.img`);
  try {
    const file = await File.downloadFileAsync(uri, target, {
      headers: NO_CACHE_HEADERS,
      idempotent: true,
    });
    const md5 = file.md5 || file.info({ md5: true })?.md5;
    if (!md5) throw new Error("photo md5 unavailable");

    const plan = planPhotoCheck(load()[uri], md5, Date.now());
    if (plan.changed) {
      // Tohumlama düşse de yeni sürüme geçilir: görsel yeni anahtarla ağdan
      // iner (bir indirme fazlası) — eski kopyada kalmaktan iyidir.
      await Image.writeToCacheAsync(file.uri, photoCacheKey(uri, plan.entry.v)).catch(() => {});
    }
    entries = prunePhotoEntries({ ...load(), [uri]: plan.entry });
    failedAt.delete(uri);
    set(Keys.photoVersions, entries);
    if (plan.changed) emit();
  } finally {
    try {
      if (target.exists) target.delete();
    } catch {
      // Geçici dosya kalırsa önbellek klasöründedir; sistem temizler.
    }
  }
}

/** Yalnız testler için: modül durumunu sıfırla. */
export function __resetPhotoRevalidationForTests() {
  entries = null;
  listeners.clear();
  queue.length = 0;
  queued.clear();
  failedAt.clear();
  running = 0;
  budget = MAX_CHECKS_PER_SESSION;
  seq = 0;
}

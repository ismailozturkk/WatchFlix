// services/cacheInspector.js
//
// Uygulamadaki TÜM önbelleği kategori kategori ölçer ve temizler. "Önbellek"
// ekranı bunu kullanır. İki kaynak okunur:
//
//   Dosya sistemi (<cache>/...):
//     datacache/<ns>   → profil, notlar, hatırlatıcılar, listeler, generic network JSON
//     pets/            → pet sprite'ları
//     (diğer her şey)  → çoğunlukla expo-image disk cache = posterler/görseller
//
//   MMKV `cache` deposu (yalnız yeniden üretilebilir veri):
//     apicache_movie_* → film içerikleri (TMDB)
//     apicache_tv_*    → dizi içerikleri (TMDB)
//     feed_cache_v1    → gönderiler
//     list_status_cache_*, media_activity_cache_*, cache_watchedTvShows
//
// MMKV GEÇİŞİ — iki eski kusur burada kapandı:
//   1. Önbellek anahtarları eskiden ayarlarla AYNI AsyncStorage kovasındaydı;
//      "hepsini temizle" elle bakımı yapılan bir anahtar süzgeci demekti ve
//      süzgece eklenmeyen her yeni önbellek anahtarı sonsuza dek diskte kalırdı.
//      Örnek: `media_activity_cache_*` ne ölçülüyor ne temizleniyordu.
//   2. Anahtar önekleri ("apicache_", "feed_cache_v1", ...) bu dosyada ve üç
//      başka dosyada ayrı ayrı yazılıydı. Artık hepsi registry'den geliyor.

import { File, Directory, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as cacheStore from "../utils/cacheStore";
import { DATACACHE_DIRNAME } from "../utils/cacheStore";
import * as petCache from "./petCache";
import { PETS_DIRNAME } from "./petCache";
import { clearCachedByPrefix, cachedByteSize } from "../utils/apiCache";
import {
  Keys,
  remove as removeKey,
  clearAllCacheStorage,
  scopedByteSize,
  keyByteSize,
  getActiveUser,
} from "./storage";

const leaf = (uri) => uri.replace(/\/+$/, "").split("/").pop();

function recurseSize(dir) {
  let total = 0;
  try {
    if (!dir.exists) return 0;
    for (const item of dir.list()) {
      if (item instanceof File) total += item.size ?? 0;
      else total += recurseSize(item);
    }
  } catch {
    // yok say
  }
  return total;
}

// Dosya sistemi kovaları: { datacache:{ns:bytes}, pets, images }
function fsBuckets() {
  const out = { datacache: {}, pets: 0, images: 0 };
  try {
    const root = new Directory(Paths.cache);
    if (!root.exists) return out;
    for (const child of root.list()) {
      if (child instanceof File) {
        out.images += child.size ?? 0;
        continue;
      }
      const name = leaf(child.uri);
      if (name === DATACACHE_DIRNAME) {
        for (const ns of child.list()) {
          if (ns instanceof Directory) out.datacache[leaf(ns.uri)] = recurseSize(ns);
        }
      } else if (name === PETS_DIRNAME) {
        out.pets += recurseSize(child);
      } else {
        // expo-image disk cache + diğer geçici dosyalar
        out.images += recurseSize(child);
      }
    }
  } catch {
    // yok say
  }
  return out;
}

// MMKV `cache` deposu kovaları (byte ≈ key+value uzunluğu)
function keyValueBuckets() {
  const movie = cachedByteSize("movie_");
  const tv = cachedByteSize("tv_");
  // apicache'in geri kalanı (providers_, discovery_v2_ ...) — eski davranışla
  // aynı: diğer içerik dizi kovasına sayılır.
  const digerIcerik = cachedByteSize("") - movie - tv;

  return {
    movie,
    tv: tv + Math.max(0, digerIcerik) + keyByteSize(Keys.watchedTvShows),
    posts: keyByteSize(Keys.feed),
    listStatus: scopedByteSize(Keys.listStatus),
    // Geçiş öncesinde bu kova HİÇ ölçülmüyordu: kullanıcı "Önbellek" ekranında
    // gerçekte kapladığından az bir toplam görüyordu.
    activity: scopedByteSize(Keys.mediaActivity),
  };
}

/**
 * Kategori bazlı önbellek dökümü.
 * @returns {Promise<{ total:number, categories: {id:string, bytes:number}[] }>}
 */
export async function getBreakdown() {
  const fs = fsBuckets();
  const kv = keyValueBuckets();
  const dc = fs.datacache;

  const categories = [
    { id: "images", bytes: fs.images },
    { id: "pets", bytes: fs.pets },
    { id: "tvContent", bytes: kv.tv },
    { id: "movieContent", bytes: kv.movie },
    { id: "posts", bytes: kv.posts },
    { id: "lists", bytes: (dc.lists || 0) + kv.listStatus },
    { id: "reminders", bytes: dc.reminders || 0 },
    { id: "notes", bytes: dc.notes || 0 },
    { id: "profile", bytes: dc.profile || 0 },
    { id: "activity", bytes: (dc.activity || 0) + kv.activity },
    { id: "networkData", bytes: (dc.network || 0) + (dc.tmdbLookup || 0) },
  ];
  const total = categories.reduce((a, c) => a + c.bytes, 0);
  return { total, categories };
}

/** Tek bir kategoriyi temizle. */
export async function clearCategory(id) {
  const uid = getActiveUser();
  switch (id) {
    case "images":
      try {
        await Image.clearDiskCache();
      } catch {}
      try {
        await Image.clearMemoryCache();
      } catch {}
      break;
    case "pets":
      petCache.clearAllPets();
      break;
    case "tvContent":
      clearCachedByPrefix("tv_");
      removeKey(Keys.watchedTvShows);
      break;
    case "movieContent":
      clearCachedByPrefix("movie_");
      break;
    case "posts":
      removeKey(Keys.feed);
      break;
    case "lists":
      cacheStore.clearNamespace("lists");
      removeKey(Keys.listStatus, { uid });
      break;
    case "reminders":
      cacheStore.clearNamespace("reminders");
      break;
    case "notes":
      cacheStore.clearNamespace("notes");
      break;
    case "profile":
      cacheStore.clearNamespace("profile");
      // Türetilmiş istatistik anlık görüntüsü de profil verisidir; ayrı bir
      // "stats" seçeneği yok, burada temizlenmezse ölçüde ve temizlikte
      // görünmez bir kalıntı olurdu (bkz. utils/cacheKeys.js: stats).
      cacheStore.clearNamespace("stats");
      break;
    case "activity":
      cacheStore.clearNamespace("activity");
      removeKey(Keys.mediaActivity, { uid });
      break;
    case "networkData":
      cacheStore.clearNamespace("network");
      cacheStore.clearNamespace("tmdbLookup");
      break;
    default:
      break;
  }
}

/**
 * Tüm önbelleği temizle (ayarlar/veri/oturum DOKUNULMAZ — sadece cache).
 *
 * Anahtar/değer tarafı artık tek çağrı: önbellek AYRI bir MMKV deposunda
 * olduğu için "hepsini sil" tanım gereği eksiksiz. Eski sürümde burası elle
 * bakılan bir anahtar listesiydi ve listeye girmeyen her şey diskte kalıyordu.
 */
export async function clearAllCaches() {
  try {
    await Image.clearMemoryCache();
  } catch {}
  try {
    await Image.clearDiskCache();
  } catch {}
  petCache.clearAllPets();
  cacheStore.clearAll();
  clearAllCacheStorage();
}

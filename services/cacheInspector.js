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
//   AsyncStorage:
//     apicache_movie_* → film içerikleri (TMDB)
//     apicache_tv_*    → dizi içerikleri (TMDB)
//     feed_cache_v1    → gönderiler
//     list_status_cache_*, cache_watchedTvShows → izleme listesi

import { File, Directory, Paths } from "expo-file-system";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as cacheStore from "../utils/cacheStore";
import { DATACACHE_DIRNAME } from "../utils/cacheStore";
import * as petCache from "./petCache";
import { PETS_DIRNAME } from "./petCache";
import { clearCachedByPrefix } from "../utils/apiCache";

const leaf = (uri) => uri.replace(/\/+$/, "").split("/").pop();
const WATCHED_TV_CACHE_KEY = "cache_watchedTvShows";

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

// AsyncStorage kovaları (byte ≈ key+value uzunluğu)
async function asyncBuckets() {
  const res = { movie: 0, tv: 0, posts: 0, listStatus: 0 };
  try {
    const keys = await AsyncStorage.getAllKeys();
    const want = keys.filter(
      (k) =>
        k.startsWith("apicache_") ||
        k === "feed_cache_v1" ||
        k.startsWith("list_status_cache_") ||
        k === WATCHED_TV_CACHE_KEY,
    );
    if (!want.length) return res;
    const pairs = await AsyncStorage.multiGet(want);
    for (const [k, v] of pairs) {
      const size = (k?.length || 0) + (v?.length || 0);
      if (k.startsWith("apicache_movie_")) res.movie += size;
      else if (k.startsWith("apicache_tv_") || k === WATCHED_TV_CACHE_KEY) res.tv += size;
      else if (k.startsWith("apicache_")) res.tv += size; // diğer içerik → diziye say
      else if (k === "feed_cache_v1") res.posts += size;
      else if (k.startsWith("list_status_cache_")) res.listStatus += size;
    }
  } catch {
    // yok say
  }
  return res;
}

/**
 * Kategori bazlı önbellek dökümü.
 * @returns {Promise<{ total:number, categories: {id:string, bytes:number}[] }>}
 */
export async function getBreakdown() {
  const fs = fsBuckets();
  const as = await asyncBuckets();
  const dc = fs.datacache;

  const categories = [
    { id: "images", bytes: fs.images },
    { id: "pets", bytes: fs.pets },
    { id: "tvContent", bytes: as.tv },
    { id: "movieContent", bytes: as.movie },
    { id: "posts", bytes: as.posts },
    { id: "lists", bytes: (dc.lists || 0) + as.listStatus },
    { id: "reminders", bytes: dc.reminders || 0 },
    { id: "notes", bytes: dc.notes || 0 },
    { id: "profile", bytes: dc.profile || 0 },
    { id: "activity", bytes: dc.activity || 0 },
    { id: "networkData", bytes: (dc.network || 0) + (dc.tmdbLookup || 0) },
  ];
  const total = categories.reduce((a, c) => a + c.bytes, 0);
  return { total, categories };
}

async function removeAsyncKeys(predicate) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const target = keys.filter(predicate);
    if (target.length) await AsyncStorage.multiRemove(target);
  } catch {
    // yok say
  }
}

/** Tek bir kategoriyi temizle. */
export async function clearCategory(id) {
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
      await clearCachedByPrefix("tv_");
      await removeAsyncKeys((k) => k === WATCHED_TV_CACHE_KEY);
      break;
    case "movieContent":
      await clearCachedByPrefix("movie_");
      break;
    case "posts":
      await removeAsyncKeys((k) => k === "feed_cache_v1");
      break;
    case "lists":
      cacheStore.clearNamespace("lists");
      await removeAsyncKeys((k) => k.startsWith("list_status_cache_"));
      break;
    case "reminders":
      cacheStore.clearNamespace("reminders");
      break;
    case "notes":
      cacheStore.clearNamespace("notes");
      break;
    case "profile":
      cacheStore.clearNamespace("profile");
      break;
    case "activity":
      cacheStore.clearNamespace("activity");
      break;
    case "networkData":
      cacheStore.clearNamespace("network");
      cacheStore.clearNamespace("tmdbLookup");
      break;
    default:
      break;
  }
}

/** Tüm önbelleği temizle (ayarlar/oturum DOKUNULMAZ — sadece cache). */
export async function clearAllCaches() {
  try {
    await Image.clearMemoryCache();
  } catch {}
  try {
    await Image.clearDiskCache();
  } catch {}
  petCache.clearAllPets();
  cacheStore.clearAll();
  await clearCachedByPrefix(""); // tüm apicache_*
  await removeAsyncKeys(
    (k) =>
      k === "feed_cache_v1" ||
      k === WATCHED_TV_CACHE_KEY ||
      k.startsWith("list_status_cache_"),
  );
}

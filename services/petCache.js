// services/petCache.js
//
// Pet sprite sheet'leri (her biri ~1.5-2.5 MB, toplam ~51 MB) artık bundle'da
// DEĞİL — Cloudflare R2'de (/pets/<id>.webp) barınır ve istek üzerine cihazın
// ÖNBELLEK dizinine indirilir. Kullanıcı tek tek indirebilir / önbellekten silebilir.
//
// Neden cache dizini (Paths.cache): silinebilir + yeniden indirilebilir; düşük
// depolamada OS kendisi de temizleyebilir (pet kaybolursa tekrar indirilir).
//
// expo-file-system v19 (SDK 54) yeni API'si: File/Directory/Paths sınıfları.
// exists/size/delete/create senkron; sadece downloadFileAsync async.

import { File, Directory, Paths } from "expo-file-system";
import { petUrl } from "../utils/r2";

// İndirilen petlerin tutulduğu klasör: <cache>/pets/
export const PETS_DIRNAME = "pets";
const PETS_DIR = new Directory(Paths.cache, PETS_DIRNAME);

function ensureDir() {
  try {
    if (!PETS_DIR.exists) PETS_DIR.create({ intermediates: true });
  } catch {
    // klasör zaten varsa / yarış durumunda sessizce geç
  }
}

function petFile(id) {
  return new File(PETS_DIR, `${id}.webp`);
}

/** Bu pet cihazda indirilmiş mi? (senkron) */
export function isPetCached(id) {
  try {
    return petFile(id).exists;
  } catch {
    return false;
  }
}

/** Pet'in local dosya URI'si (varlık kontrolü YAPMAZ; render için cachedPets ile kullan). */
export function petUriFor(id) {
  return petFile(id).uri;
}

/** Pet dosyasının boyutu (byte). Yoksa 0. */
export function getPetSize(id) {
  try {
    return petFile(id).size ?? 0;
  } catch {
    return 0;
  }
}

/** Pet'i R2'den indir ve local URI döndür. */
export async function downloadPet(id) {
  ensureDir();
  const file = petFile(id);
  // idempotent: dosya zaten varsa hata vermeyip üzerine yazar.
  await File.downloadFileAsync(petUrl(id), file, { idempotent: true });
  return file.uri;
}

/** Pet'i önbellekten sil. */
export function deletePet(id) {
  try {
    const file = petFile(id);
    if (file.exists) file.delete();
  } catch {
    // silinemezse sessizce geç
  }
}

/**
 * Verilen id listesi için önbellek durumunu tara.
 * @returns {{ cached: Record<string,true>, sizes: Record<string,number>, totalBytes: number }}
 */
export function scanCached(ids) {
  const cached = {};
  const sizes = {};
  let totalBytes = 0;
  for (const id of ids) {
    try {
      const file = petFile(id);
      if (file.exists) {
        const s = file.size ?? 0;
        cached[id] = true;
        sizes[id] = s;
        totalBytes += s;
      }
    } catch {
      // tek bir pet hatası taramayı bozmasın
    }
  }
  return { cached, sizes, totalBytes };
}

/** Tüm indirilen petleri sil (klasörü komple kaldırır). */
export function clearAllPets() {
  try {
    if (PETS_DIR.exists) PETS_DIR.delete();
  } catch {
    // sessizce geç
  }
}

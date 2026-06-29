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
    // .exists kontrolü ya da create yarış durumunda patlarsa ikinci kez dene.
    try {
      PETS_DIR.create({ intermediates: true });
    } catch {
      // klasör zaten varsa sessizce geç
    }
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// İçerik gerçekten WebP mi? (sihirli bayt: "RIFF" .... "WEBP"). R2 hız sınırı /
// erişim engelinde sunucu .webp yerine KÜÇÜK bir hata gövdesi döndürebilir; bu
// fonksiyon onu yakalar (yoksa geçersiz dosya "cache" işaretlenip boş render olur).
function isWebp(b) {
  return (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50  // "WEBP"
  );
}

/**
 * Pet'i R2'den indir ve local URI döndür. Başarısızsa AÇIKLAYICI bir hata fırlatır
 * (çağıran kullanıcıya gösterir — artık jenerik "internet kontrol et" değil, gerçek
 * sebep: HTTP hatası / boş yanıt / geçersiz içerik).
 *
 * NOT: `File.downloadFileAsync` (expo-file-system 19 + new arch) release APK'de
 * jenerik "...has been rejected" ile patlayabiliyor ve gerçek hatayı (HTTP durumu)
 * gizliyor. Bunun yerine `fetch` ile indirip diske `write` ediyoruz: petler küçük
 * (~1.5-2.5 MB) olduğu için bellek sorunu olmaz, üstelik HTTP 403/429 (R2 .r2.dev
 * hız sınırı) gibi gerçek sebepler görünür olur.
 * Adımlar: 1) fetch (HTTP durum kontrolü)  2) bytes>0  3) WebP doğrula  4) diske yaz
 * Ağ/boş yanıt hatalarında bir kez yeniden dener; içerik/HTTP hatası tekrar denenmez.
 */
export async function downloadPet(id) {
  ensureDir();
  const file = petFile(id);
  const url = petUrl(id);
  let lastErr;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try { if (file.exists) file.delete(); } catch { /* yarım dosyayı temizle */ }

    let bytes;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // 403/429 → R2 .r2.dev erişim/hız sınırı. Tekrar denemek hızlı çözmez.
        throw new Error(`Sunucu hatası HTTP ${res.status} — R2 erişim/hız sınırı olabilir`);
      }
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      lastErr = new Error(`İndirme başarısız: ${e?.message || e}`);
      // HTTP durum hatası içerikseldir → tekrar deneme; salt ağ hatası → bir kez dene.
      if (String(e?.message || "").includes("HTTP")) throw lastErr;
      await wait(700);
      continue;
    }

    if (!bytes || bytes.length <= 0) {
      lastErr = new Error("Sunucudan boş yanıt geldi");
      await wait(700);
      continue;
    }

    if (!isWebp(bytes)) {
      // Küçük/geçersiz gövde → neredeyse kesin sunucu taraflı (R2 .r2.dev hız sınırı
      // veya erişim engeli). Yeniden denemek hızlı çözmez → açıkça bildir.
      throw new Error(`Geçersiz içerik (${bytes.length}B) — R2 erişim/hız sınırı olabilir`);
    }

    try {
      file.create({ overwrite: true });
      file.write(bytes);
    } catch (e) {
      lastErr = new Error(`Diske yazılamadı: ${e?.message || e}`);
      await wait(700);
      continue;
    }

    if (!file.exists || (file.size ?? 0) <= 0) {
      lastErr = new Error("Dosya diske yazılamadı");
      await wait(700);
      continue;
    }

    return file.uri; // başarı
  }
  throw lastErr || new Error("İndirme başarısız");
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

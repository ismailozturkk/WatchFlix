// services/serverClock.js
//
// SUNUCU SAATİ — seri günü cihaz saatinden değil buradan türer (utils/streakBridge).
// Cihaz saatini ileri almak seriyi ilerletmez, geri almak geçmiş günü doldurmaz.
//
// YÖNTEM: zaten konuştuğumuz Google uç noktasına (Firestore) kimliksiz, gövdesiz bir
// HEAD isteği atılır ve yanıtın `Date` başlığı okunur (saniye çözünürlüğü; gün sınırı
// için fazlasıyla yeterli). Hiçbir kullanıcı verisi gönderilmez. Gidiş-dönüş süresinin
// yarısı eklenir.
//
// MONOTON SAAT: eşitlemeden sonra "şimdi" = sunucu anı + o andan beri geçen süre
// (performance.now — cihaz saatinden bağımsız). Uygulama açıkken saati değiştirmek
// hiçbir şeyi oynatmaz. Uygulama her öne geldiğinde yeniden eşitlenir.
//
// AĞ YOKSA: son bilinen fark (bellekte) ya da cihaz saati; `dogrulandi()` false döner
// ve defter gelecekteki günleri temizlemez (watchBadgeLedger zamanaHazirla). Saat
// doğrulanınca ileri alınmış saatle atılmış damgalar silinir; buluta yazılan belgeyi
// Firestore kuralı da sunucu saatine göre denetler (firestore.rules streakDocOk).

const SAAT_URL = "https://firestore.googleapis.com/";
const ZAMAN_ASIMI_MS = 4000;

let capa = null; // { sunucu: ms, perf: ms }
let fark = 0; // sunucu − cihaz (ms), ağ yokken yedek
let suren = null;

const perfNow = () => {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  } catch {
    // yok
  }
  return null;
};

/** Sunucu saatini bir kez ölçer. Başarılıysa true. */
export async function syncServerClock() {
  if (suren) return suren;
  suren = (async () => {
    const kontrol = typeof AbortController !== "undefined" ? new AbortController() : null;
    const zamanlayici = kontrol ? setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS) : null;
    try {
      const p0 = perfNow();
      const t0 = Date.now();
      const yanit = await fetch(SAAT_URL, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
        signal: kontrol?.signal,
      });
      const p1 = perfNow();
      const t1 = Date.now();
      const tarih = Date.parse(yanit.headers.get("date") || "");
      if (!Number.isFinite(tarih)) return false;
      const gidisDonus = p0 !== null && p1 !== null ? p1 - p0 : t1 - t0;
      // Date başlığı saniyeye yuvarlanmış: ortalama +500 ms düzeltme.
      const sunucu = tarih + 500 + Math.max(0, gidisDonus) / 2;
      capa = { sunucu, perf: p1 };
      fark = sunucu - t1;
      return true;
    } catch {
      return false;
    } finally {
      if (zamanlayici) clearTimeout(zamanlayici);
      suren = null;
    }
  })();
  return suren;
}

/** Sunucu saatine göre şimdi (ms). */
export function serverNow() {
  if (capa && capa.perf !== null) {
    const p = perfNow();
    if (p !== null && p >= capa.perf) return capa.sunucu + (p - capa.perf);
  }
  return Date.now() + fark;
}

/** Bu oturumda sunucuyla eşitlendi mi. */
export const serverClockVerified = () => capa !== null;

/** Eşitleme sürüyorsa onun sonucunu, sürmüyorsa hemen döner. */
export const serverClockReady = () => suren || Promise.resolve(capa !== null);

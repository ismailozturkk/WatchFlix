// utils/profileBanner.js
//
// Profil kapağı (banner): profilin en üstünde duran film/dizi sahnesi (TMDB
// "backdrop" görseli). Users/{uid}.profileBanner'da yalnız şu biçim durur:
//
//   { id: number, type: "movie" | "tv", title: string, path: "/abc.jpg" }
//
// Tam adres DEĞİL yalnız TMDB yolu saklanır: görsel kalitesi cihaz ayarına göre
// (buildTmdbUrl) seçilir ve kural (firestore.rules → profileBannerOk) keyfî bir
// adresin (izleme pikseli, uygunsuz içerik) yazılmasını engelleyebilir.
// Kapak yoksa alan null'dır.
//
// Saf modül: Firebase/RN'ye dokunmaz (jest'te doğrudan sınanır).

export const BANNER_TITLE_MAX = 200;
const PATH_RE = /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const TYPES = new Set(["movie", "tv"]);

/** Başkasının yazdığı veri de buradan geçer: geçersizse null. */
export function normalizeProfileBanner(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const type = raw.type === "tv" ? "tv" : raw.type === "movie" ? "movie" : null;
  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !TYPES.has(type) || !PATH_RE.test(path)) return null;
  const title = String(raw.title ?? "").trim().slice(0, BANNER_TITLE_MAX);
  return { id, type, title, path };
}

export const readProfileBanner = (profile) => normalizeProfileBanner(profile?.profileBanner);

export function profileBannersEqual(a, b) {
  const x = normalizeProfileBanner(a);
  const y = normalizeProfileBanner(b);
  if (!x || !y) return !x && !y;
  return x.id === y.id && x.type === y.type && x.path === y.path;
}

/** Firestore'a yazılacak değer: geçerli kapak ya da null (kaldırıldı). */
export const toBannerPayload = (banner) => normalizeProfileBanner(banner);

/**
 * TMDB /images yanıtından kapak adayları: yazısız (dil yok) sahneler önce, sonra
 * oy ortalamasına göre. Yinelenen yollar atılır.
 */
export function pickBannerCandidates(images, { limit = 24 } = {}) {
  const list = Array.isArray(images?.backdrops) ? images.backdrops : [];
  const seen = new Set();
  return list
    .filter((img) => typeof img?.file_path === "string" && PATH_RE.test(img.file_path))
    .filter((img) => (seen.has(img.file_path) ? false : (seen.add(img.file_path), true)))
    .map((img, index) => ({
      path: img.file_path,
      textless: img.iso_639_1 == null,
      score: Number(img.vote_average) || 0,
      index,
    }))
    .sort((a, b) => (a.textless === b.textless ? b.score - a.score || a.index - b.index : a.textless ? -1 : 1))
    .slice(0, limit)
    .map(({ path, textless }) => ({ path, textless }));
}

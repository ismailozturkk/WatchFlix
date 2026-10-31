// Herkese aynı görünen tablolar (maliyet analizi Aşama 3).
//
// 1) Top 100 sayaçları — kişisel veri YOK ("bu yapımın N Seelogd oyu var"). Firebase Hosting CDN'i
//    arkasında tek JSON (seelogd.com/api/top100). CDN 10 dk saklar; fonksiyon örneği de 60 sn
//    bellekte tutar (CDN'i atlayıp doğrudan fonksiyon adresine gelen isteğe her seferinde 120 okuma
//    ödenmesin). Eskiden Top 100'ü açan HER kullanıcı 120 okuma yapıyordu.
//
// 2) Liderlik tabloları — ad/avatar/foto içerir, yalnız oturumlu okur (kurallar). CDN'e konmaz
//    (önbellekteki yanıt oturumsuz isteğe de verilirdi). Bunun yerine tablo başına tek "anlık görüntü"
//    belgesi: BoardSnapshots/{boardId} = ilk 50 girdi + builtAt. İstemci 50 yerine 1 belge okur;
//    bayatsa (10 dk) getBoardSnapshot callable'ı yeniden kurar. "Genel" tablo 8 oyunun tablosundan
//    oluşuyordu: açılış başına 400 okuma → 8.

const TOP100_COUNTER_LIMIT = 120; // istemci: services/top100Service.js TOP100_COUNTER_READ ile aynı
const TOP100_MEMORY_MS = 60 * 1000;
const TOP100_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

const BOARD_SNAPSHOT_LIMIT = 50; // istemci: utils/gameBoards.js BOARD_LIMIT ile aynı
const BOARD_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const SCENE_BOARD_ID = "scene_guess";
const BOARD_ID_RE = /^(poster_classic_normal|quick_[a-z0-9_]{1,32}|scene_daily_\d{4}-\d{2}-\d{2})$/;

/** Tablo kimliği → kaynak koleksiyon ve sıralama alanı; tanınmıyorsa null (keyfi koleksiyon okunmasın). */
function boardSource(boardId) {
  if (boardId === SCENE_BOARD_ID) return { collection: "SceneGame", orderField: "bestScore" };
  if (typeof boardId === "string" && BOARD_ID_RE.test(boardId)) {
    return { collection: `GameLeaderboards/${boardId}/entries`, orderField: "score" };
  }
  return null;
}

const isFreshSnapshot = (builtAt, now = Date.now()) =>
  Number.isFinite(builtAt) && now - builtAt >= 0 && now - builtAt < BOARD_SNAPSHOT_TTL_MS;

/** Firestore Timestamp'leri ms'ye çevirir: anlık görüntü belgesi de callable yanıtı da düz kalsın. */
function plain(value) {
  if (value == null) return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/** Sorgu belgeleri → [{ id, data }] (istemci satır eşleyicileri id + data bekler). */
const snapshotEntries = (docs) => docs.map((d) => ({ id: d.id, data: plain(d.data()) }));

/** Top100Hype belgeleri → { mediaKey: { count } } (negatif/bozuk sayaç 0). */
function top100Payload(docs) {
  const counters = {};
  docs.forEach((d) => {
    const count = Math.max(0, Math.trunc(Number(d.data()?.count)) || 0);
    counters[d.id] = { count };
  });
  return counters;
}

module.exports = {
  TOP100_COUNTER_LIMIT,
  TOP100_MEMORY_MS,
  TOP100_CACHE_CONTROL,
  BOARD_SNAPSHOT_LIMIT,
  BOARD_SNAPSHOT_TTL_MS,
  boardSource,
  isFreshSnapshot,
  plain,
  snapshotEntries,
  top100Payload,
};

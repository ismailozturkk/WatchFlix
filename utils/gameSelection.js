// utils/gameSelection.js
//
// Oyun motorunun "NE seçilsin" kararları — ağ, Firebase ve React içermez, jest'te
// doğrudan çalışır. Servis (services/sceneGameService) ve kanca (hooks/useSceneGame)
// yalnızca veri taşır; seçim kuralları burada tek yerde durur:
//
//   • pickWeightedPages  → TMDB sayfalarını ilk sayfalara doğru ağırlıklı seçer
//   • recognitionWeight  → bir yapımın "ne kadar bilindik" olduğu
//   • weightedOrder      → bilindik olanlar öne gelen, ama hep aynı başlıkları
//                          çıkarmayan sıralama (Efraimidis–Spirakis)
//   • pickTextlessPoster → yazısız (başlıksız) afişi seç
//   • pickSceneImage     → zorluğa göre sahne karesi seç
//
// Günlük Meydan Okuma "herkeste aynı sorular" vaadi taşır: ağırlık (`bias`) 0
// verilince `weightedOrder` BİREBİR eski `source.shuffle` yoluna düşer, yani
// günlük sorular bu değişiklikle kaymaz.

import { keyOfItem } from "./seededRandom";

/* ── Sayfa seçimi ──────────────────────────────────────────────────────────── */

// Kaynak başına "hâlâ tanınır" son sayfa. TMDB'de 50. popüler sayfa ~1000.
// sıradaki, çoğu oyuncunun hiç duymadığı bir yapımdır; eskiden sayfalar 1–50
// arasından DÜZGÜN seçiliyordu ve havuzun büyük kısmı bu yüzden tanınmıyordu.
const MAX_PAGE_BY_SOURCE = {
  popular: 15, // karışık trending
  trending: 15,
  popular_movie: 25,
  popular_tv: 25,
  top_rated_movie: 20,
  top_rated_tv: 15,
};
const DEFAULT_MAX_PAGE = 15;

export const maxPageForSource = (source) => MAX_PAGE_BY_SOURCE[source] || DEFAULT_MAX_PAGE;

// Sayfa p'nin ağırlığı 1 / p^PAGE_DECAY. 1.2 ile 25 sayfalık kaynakta çekilen
// sayfaların ~%49'u ilk 3 sayfadan (ilk 60 yapım), ~%79'u ilk 10 sayfadan, yalnız
// ~%17'si 12. sayfanın ötesinden gelir (simülasyonla ölçüldü; düzgün dağılımda
// ilk 3 sayfa %12, 12. sayfa ötesi %52 idi). Uç sayfalar seyrek ama kapalı değil:
// çeşitlilik tamamen ölmesin.
const PAGE_DECAY = 1.2;

/**
 * `1..maxPage` arasından `count` FARKLI sayfa; küçük numaralar daha olası.
 * Ağırlıklı örnekleme (değiştirmesiz): anahtar = log(u) / w, büyük olan kazanır.
 *
 * @param {object} [opts]
 * @param {Set<number>} [opts.exclude] Zaten çekilmiş sayfalar (havuz büyütülürken).
 * @param {() => number} [opts.rng] [0,1) üreteç (test için).
 */
export function pickWeightedPages(count, maxPage, { exclude, rng = Math.random } = {}) {
  const candidates = [];
  for (let page = 1; page <= maxPage; page += 1) {
    if (exclude && exclude.has(page)) continue;
    const u = Math.min(Math.max(rng(), Number.EPSILON), 1 - Number.EPSILON);
    candidates.push({ page, key: Math.log(u) / (1 / page ** PAGE_DECAY) });
  }
  return candidates
    .sort((a, b) => b.key - a.key)
    .slice(0, Math.max(0, count))
    .map((entry) => entry.page);
}

/* ── Bilindiklik ağırlığı ──────────────────────────────────────────────────── */

/**
 * Bir yapımın tanınırlık ağırlığı (≥ 1). İki sinyal çarpılır:
 *   • oy sayısı  → "herkes izlemiş" (kalıcı tanınırlık; popülerlik gibi günlük
 *                  dalgalanmaz)
 *   • popülerlik → şu an konuşuluyor
 * Logaritmik: 20.000 oylu bir yapım 200 oyluya göre ~8 kat, 5 oyluya göre ~25
 * kat olasıdır — baskın ama tek başına tüm soruları götürmez.
 */
export function recognitionWeight(item) {
  const votes = Math.max(0, Number(item?.voteCount) || 0);
  const popularity = Math.max(0, Number(item?.popularity) || 0);
  return (1 + Math.log10(1 + votes)) ** 2 * (1 + Math.log10(1 + popularity));
}

/**
 * Listeyi, bilindik olanlar daha olası biçimde öne gelecek şekilde sıralar.
 *
 * @param {Array} list
 * @param {{shuffle:Function, float:Function}} source utils/seededRandom kaynağı
 * @param {string} salt Kararı adlandırır ("correct:3"); kararlı kaynakta aynı
 *   tuz herkeste aynı sıralamayı verir.
 * @param {number} bias 0 = düz rastgele (eski davranış, günlük/kişisel liste),
 *   1 = tam bilindiklik ağırlığı. Ara değerler ağırlığı üstle yumuşatır.
 */
export function weightedOrder(list, source, salt, bias = 1, weightFn = recognitionWeight) {
  if (!(bias > 0) || list.length < 2) return source.shuffle(list, salt);
  return list
    .map((item) => {
      const key = keyOfItem(item);
      const weight = Math.max(1e-6, weightFn(item) ** bias);
      return { item, key, rank: Math.log(source.float(`${salt}|${key}`)) / weight };
    })
    .sort((a, b) => b.rank - a.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.item);
}

/* ── Görsel seçimi ─────────────────────────────────────────────────────────── */

const POSTER_MIN_WIDTH = 500;
const POSTER_MIN_RATIO = 0.55; // 2:3 afiş = 0.667
const POSTER_MAX_RATIO = 0.8;
const POSTER_TOP_CHOICES = 3;
const SCENE_MAX_HINTS = 5;

/**
 * TMDB `/images` cevabını oyunun ihtiyacı kadarına indirger (bellekte tutulur,
 * bu yüzden alan ve adet sınırlıdır).
 */
export function distillImages(data) {
  const pick = (list, cap, fields) =>
    (Array.isArray(list) ? list : []).slice(0, cap).map((image) => {
      const out = {};
      fields.forEach((field) => {
        out[field] = image?.[field] ?? null;
      });
      return out;
    });
  return {
    backdrops: pick(data?.backdrops, 24, ["file_path", "width", "aspect_ratio", "iso_639_1"]),
    posters: pick(data?.posters, 16, [
      "file_path",
      "width",
      "aspect_ratio",
      "iso_639_1",
      "vote_average",
      "vote_count",
    ]),
  };
}

// Oy ortalamasını az oyla şişirmemek için oy sayısıyla tartılır.
const posterQuality = (poster) =>
  (Number(poster.vote_average) || 0) * Math.log10(2 + (Number(poster.vote_count) || 0));

/**
 * Yazısız afiş. TMDB'de `iso_639_1 === null` görsel dilsizdir, yani üstünde
 * başlık/slogan yoktur. Eskiden varsayılan (başlıklı) afiş gösteriliyordu ve
 * başlık görünür görünmez soru çözülüyordu.
 *
 * Önce genişlik + en-boy oranı uygun olanlar, hiçbiri yoksa dilsiz olan herhangi
 * biri; en iyi `POSTER_TOP_CHOICES` arasından kaynakla seçilir (aynı yapım hep
 * aynı afişle gelmesin; kararlı kaynakta herkeste aynı kalsın).
 *
 * @returns {string|null} file_path ya da yazısız afiş yoksa null
 */
export function pickTextlessPoster(posters, source, salt = "") {
  const textless = (Array.isArray(posters) ? posters : []).filter(
    (poster) => poster && poster.file_path && !poster.iso_639_1,
  );
  if (textless.length === 0) return null;

  const fits = (poster) => {
    const ratio = Number(poster.aspect_ratio) || 0;
    return !ratio || (ratio >= POSTER_MIN_RATIO && ratio <= POSTER_MAX_RATIO);
  };
  const strict = textless.filter(
    (poster) => (Number(poster.width) || 0) >= POSTER_MIN_WIDTH && fits(poster),
  );
  const pool = strict.length > 0 ? strict : textless.filter(fits);
  if (pool.length === 0) return null;

  const ranked = [...pool].sort((a, b) => posterQuality(b) - posterQuality(a));
  const top = ranked.slice(0, POSTER_TOP_CHOICES);
  return top[source.int(0, top.length - 1, salt)].file_path;
}

/**
 * Zorluğa göre sahne karesi (Part 9): TMDB backdrop listesi kabaca oya göre
 * sıralıdır, indeks büyüdükçe kare daha az tanınır.
 *   easy   → ilk 3 kare, normal → 2. kare ve sonrası, hard → 4. kare ve sonrası.
 * Diğer kareler ipucu (joker) olarak döner.
 *
 * @returns {{mainImage:string, hints:string[]}|null} kare yoksa null
 */
export function pickSceneImage(backdrops, difficulty, source, salt = "") {
  const all = Array.isArray(backdrops) ? backdrops.filter((b) => b && b.file_path) : [];
  if (all.length === 0) return null;

  // Kalite (Part 10.4): yeterli genişlik, yazısız, ~16:9.
  const quality = all.filter(
    (b) =>
      (Number(b.width) || 0) >= 1280 &&
      !b.iso_639_1 &&
      (Number(b.aspect_ratio) || 0) >= 1.6 &&
      (Number(b.aspect_ratio) || 0) <= 2.0,
  );
  const pool = quality.length > 0 ? quality : all;
  if (pool.length === 1) return { mainImage: pool[0].file_path, hints: [] };

  const last = pool.length - 1;
  let minIndex;
  let maxIndex;
  if (difficulty === "easy") {
    minIndex = 0;
    maxIndex = Math.min(2, last);
  } else if (difficulty === "hard") {
    minIndex = Math.min(3, last);
    maxIndex = last;
  } else {
    minIndex = Math.min(1, last);
    maxIndex = last;
  }
  const index = source.int(minIndex, maxIndex, salt);
  return {
    mainImage: pool[index].file_path,
    hints: pool
      .filter((_, i) => i !== index)
      .map((b) => b.file_path)
      .slice(0, SCENE_MAX_HINTS),
  };
}

// utils/tvGraphShare.js
//
// Dizi BÖLÜM GRAFİĞİ paylaşımı (TvGraphDetailScreen → sohbet kartı / Paylaşımlar gönderisi). SAF: React/Firebase yok,
// jest ile test edilir (__tests__/tvGraphShare.test.js).
//
// Gövde (anlık görüntü — alıcı yeniden TMDB/OMDb çekmeden çizer; dizi sonradan puan alsa da kart paylaşıldığı gibi kalır;
// `poster_path` gönderenin ÖZEL AFİŞİ, seçimi yoksa TMDB afişi — bkz. buildTvGraphShare `resolvePoster`):
//   { v, type:"tvGraph", id, title, poster_path?, years?, rating?, seasons:[{ s, r:[puan] }], totalSeasons, totalEpisodes, host? }
//   r: bölüm puanları ekrandaki sırayla (0–10, tek ondalık); 0 = puan yok ("–"). Firestore iç içe diziyi saklayamaz,
//   bu yüzden sezon başına nesne. Hiç puanı olmayan sezon (duyurulmuş, yayınlanmamış) gönderilmez.
//   Gönderide (Posts.tvGraph) aynı gövde v/type/host olmadan durur (postTvGraphOf).
//
// YERLEŞİM — sezon uzunlukları diziden diziye çok farklı (5 sezon × 7–16 bölüm drama, 36 × 22 sitcom, 2 × 60 anime).
// planTvGraphLayout verilen kutuya (genişlik + en çok yükseklik) EN BÜYÜK kareyi veren düzeni seçer:
//   columns  klasik grafik (TvGraphDetailScreen gibi): sütun = sezon, satır = bölüm. Çok sezonda sezonlar alt alta
//            "bant"lara bölünür (1–18 üstte, 19–36 altta).
//   rows     her sezon bir şerit (solda "S3"), bölümler soldan sağa; uzun sezon `perLine` bölümde alta kayar. Tüm
//            şeritler aynı `perLine`ı kullanır, böylece bölüm numaraları alt alta hizalı kalır.
// Klasik görünüm hafif öncelikli (aynı boyda kare veriyorsa o seçilir). En iyi düzen bile `minCell`in altında kalıyorsa
// en sık düzen (rows) `minCell` ile çizilir ve taşan kısım kesilir (`overflow`; kart "tamamı için aç" der).

export const TV_GRAPH_SHARE_TYPE = "tvGraph";
export const MAX_TVGRAPH_SEASONS = 60;
export const MAX_TVGRAPH_EPISODES = 200; // sezon başına
export const MAX_TVGRAPH_CELLS = 2000; // toplam bölüm (≈ 20 KB)
const MAX_TITLE = 90;
const MAX_HOST = 40;
const MAX_YEARS = 16;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const intIn = (value, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Bölüm puanı → 0–10, tek ondalık; puansız / bozuk → 0. */
export function graphRating(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(10, Math.round(n * 10) / 10) : 0;
}

function sanitizeSeasons(raw) {
  const seen = new Set();
  let budget = MAX_TVGRAPH_CELLS;
  const seasons = [];
  (Array.isArray(raw) ? raw : [])
    .filter(isObject)
    .map((season) => ({ s: intIn(season.s, 0, 9999), r: Array.isArray(season.r) ? season.r : [] }))
    .filter((season) => season.s !== null && !seen.has(season.s) && seen.add(season.s))
    .sort((a, b) => a.s - b.s)
    .forEach((season) => {
      if (seasons.length >= MAX_TVGRAPH_SEASONS || budget <= 0) return;
      const r = season.r.slice(0, Math.min(MAX_TVGRAPH_EPISODES, budget)).map(graphRating);
      if (!r.some((value) => value > 0)) return;
      budget -= r.length;
      seasons.push({ s: season.s, r });
    });
  return seasons;
}

/** Bilinmeyen/bozuk gövde → null; geçerliyse temizlenmiş kopya (utils/chatShare.sanitizeShare buradan çağırır). */
export function sanitizeTvGraphShare(raw) {
  if (!isObject(raw)) return null;
  const id = intIn(raw.id, 1, 1e9);
  const title = clip(raw.title, MAX_TITLE);
  const seasons = sanitizeSeasons(raw.seasons);
  if (!id || !title || seasons.length === 0) return null;
  const episodes = seasons.reduce((sum, season) => sum + season.r.length, 0);
  const share = {
    v: 1,
    type: TV_GRAPH_SHARE_TYPE,
    id,
    title,
    seasons,
    // Kesilen sezon/bölüm varsa kart "36 sezon" der ama 30'unu çizer.
    totalSeasons: Math.max(seasons.length, intIn(raw.totalSeasons, 0, 9999) || 0),
    totalEpisodes: Math.max(episodes, intIn(raw.totalEpisodes, 0, 99999) || 0),
  };
  if (typeof raw.poster_path === "string" && /^\/[\w.-]{1,100}$/.test(raw.poster_path)) share.poster_path = raw.poster_path;
  const years = clip(raw.years, MAX_YEARS);
  if (years) share.years = years;
  const rating = graphRating(raw.rating);
  if (rating) share.rating = rating;
  const host = clip(raw.host, MAX_HOST);
  if (host) share.host = host;
  return share;
}

/** Gönderi alanı (Posts.tvGraph): gövdenin v/type/host'suz hâli; geçersizse null. */
export function postTvGraphOf(raw) {
  const share = sanitizeTvGraphShare(raw);
  if (!share) return null;
  const { v: _v, type: _type, host: _host, ...rest } = share;
  return rest;
}

const yearOf = (date) => (typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : "");

/** "2008–2013" · devam eden "2019–" · tek yıl "2020". */
export function graphYears(show) {
  const first = yearOf(show?.first_air_date);
  if (!first) return "";
  const ended = show?.status === "Ended" || show?.status === "Canceled";
  if (!ended) return `${first}–`;
  const last = yearOf(show?.last_air_date);
  return last && last !== first ? `${first}–${last}` : first;
}

/**
 * TvGraphDetailScreen verisi → paylaşım gövdesi.
 * @param {object} show     TMDB dizi detayı (vote_average ekranda IMDb ana puanıyla değiştirilmiş hâli)
 * @param {Array}  seasons  TMDB sezon detayları (episodes[].vote_average IMDb ile birleştirilmiş), ekrandaki sırayla
 * @param {Function} [resolvePoster]  context/PosterChoicesContext.usePosterResolver — (type, id, path) → yol.
 *   Gönderenin ÖZEL AFİŞİ gövdeye yazılır: alıcı (sohbet / akış) gönderenin ekranda gördüğü afişi görür; seçim
 *   yoksa ya da Premium bittiyse çözücü TMDB yolunu döndürür.
 */
export function buildTvGraphShare({ show, seasons, host, resolvePoster } = {}) {
  const list = (Array.isArray(seasons) ? seasons : []).filter((season) => isObject(season) && season.season_number > 0);
  return sanitizeTvGraphShare({
    id: show?.id,
    title: show?.name || show?.original_name,
    poster_path: (resolvePoster && show?.id ? resolvePoster("tv", show.id, show.poster_path) : null) || show?.poster_path,
    years: graphYears(show),
    rating: show?.vote_average,
    seasons: list.map((season) => ({
      s: season.season_number,
      r: (Array.isArray(season.episodes) ? season.episodes : []).map((episode) => episode?.vote_average),
    })),
    totalSeasons: list.length,
    totalEpisodes: list.reduce((sum, season) => sum + (Array.isArray(season.episodes) ? season.episodes.length : 0), 0),
    host,
  });
}

// ─── Yerleşim ────────────────────────────────────────────────────────────────

/**
 * Birden çok satıra bölünen sezonda bölümler satırlara EŞİT dağıtılır: 13 bölüm 10 + 3 değil 7 + 6, 22 bölüm
 * 8 + 7 + 7. Satır sayısı ve en uzun satır (`perLine`'ı aşmaz) değişmez; son satırda tek başına kalan 2–3
 * karelik "yetim" satır oluşmaz.
 */
export function balancedLineSize(count, perLine, lines) {
  if (!(lines > 1)) return Math.min(perLine, count);
  return Math.min(perLine, Math.ceil(count / lines));
}

/**
 * Satır başına en çok `maxPerRow` bölümle dengeli bölündüğünde en uzun satırın boyu. Plan bu değerle kurulursa
 * satır sayıları değişmez ama kareler kullanılmayan sağ boşluğu da doldurur (13 bölüm → 7 + 6 ise ızgara 7 kare
 * genişliğinde planlanır, 10 değil).
 */
export function balancedEpisodesPerRow(seasons, maxPerRow) {
  const cap = Math.max(1, Math.round(maxPerRow) || 1);
  let longest = 0;
  (Array.isArray(seasons) ? seasons : []).forEach((season) => {
    const count = season?.r?.length || 0;
    if (!count) return;
    longest = Math.max(longest, balancedLineSize(count, cap, Math.ceil(count / cap)));
  });
  return longest || cap;
}

export const TV_GRAPH_LAYOUT = Object.freeze({
  gapRatio: 0.1, // kare arası boşluk / kare
  stripGapRatio: 0.35, // rows: sezon şeritleri arası / kare
  headerH: 13, // columns: sezon başlığı satırı
  bandGap: 6, // columns: bantlar arası
  labelW: 24, // rows: soldaki "S12" sütunu
  textMinCell: 18, // bu boydan küçük karede puan yazılmaz (yalnız renk)
});

// Aynı boyda kare veren düzenlerden klasik görünüm öne geçsin; kayan şerit en son tercih.
const PREFERENCE = { columns: 1, bands: 0.94, rows: 0.96, wrapped: 0.9 };

const spanOf = (count, ratio) => count + Math.max(0, count - 1) * ratio;

function columnsCandidate(lengths, bands, box) {
  const per = Math.ceil(lengths.length / bands);
  const groups = [];
  for (let start = 0; start < lengths.length; start += per) {
    const seasons = [];
    for (let i = start; i < Math.min(lengths.length, start + per); i += 1) seasons.push(i);
    groups.push({ seasons, rows: Math.max(...seasons.map((i) => lengths[i])) });
  }
  if (groups.length !== bands) return null; // 5 sezon / 4 bant → 3 bant: zaten denendi
  const { gapRatio: k } = box;
  const byWidth = box.width / spanOf(per, k);
  const fixedH = groups.length * box.headerH + (groups.length - 1) * box.bandGap;
  const byHeight = (box.maxHeight - fixedH) / groups.reduce((sum, group) => sum + spanOf(group.rows, k), 0);
  return { mode: "columns", per, groups, fit: Math.min(byWidth, byHeight), pref: bands === 1 ? PREFERENCE.columns : PREFERENCE.bands };
}

function rowsCandidate(lengths, perLine, box) {
  const { gapRatio: k, stripGapRatio: k2 } = box;
  const lines = lengths.map((length) => Math.ceil(length / perLine));
  const byWidth = (box.width - box.labelW) / spanOf(perLine, k);
  const byHeight = box.maxHeight / (lines.reduce((sum, count) => sum + spanOf(count, k), 0) + (lengths.length - 1) * k2);
  const wrapped = lines.some((count) => count > 1);
  return {
    mode: "rows",
    perLine,
    lines,
    byWidth,
    byHeight,
    fit: Math.min(byWidth, byHeight),
    pref: wrapped ? PREFERENCE.wrapped : PREFERENCE.rows,
  };
}

function measure(candidate, cell, box) {
  const gap = cell * box.gapRatio;
  if (candidate.mode === "columns") {
    const height =
      candidate.groups.reduce((sum, group) => sum + box.headerH + group.rows * cell + (group.rows - 1) * gap, 0) +
      (candidate.groups.length - 1) * box.bandGap;
    return { gap, width: candidate.per * cell + (candidate.per - 1) * gap, height };
  }
  const stripGap = cell * box.stripGapRatio;
  const height =
    candidate.lines.reduce((sum, count) => sum + count * cell + (count - 1) * gap, 0) + (candidate.lines.length - 1) * stripGap;
  return { gap, stripGap, width: box.labelW + candidate.perLine * cell + (candidate.perLine - 1) * gap, height };
}

/**
 * Kutuya en iyi oturan düzen.
 * @param {Array<{s:number, r:number[]}>} seasons
 * @param {{width:number, maxHeight?:number, maxCell?:number, minCell?:number,
 *   layoutMode?:"auto"|"columns"|"rows", episodesPerRow?:number, fillRowsWidth?:boolean}} options
 * @returns {null | {mode:"columns"|"rows", cell, gap, width, height, overflow, showText, labelStep,
 *   groups?:Array<{seasons:number[], rows:number}>, per?, perLine?, lines?:number[], stripGap?, headerH, labelW, bandGap}}
 */
export function planTvGraphLayout(
  seasons,
  {
    width,
    maxHeight = Infinity,
    maxCell = 30,
    minCell = 5,
    layoutMode = "auto",
    episodesPerRow,
    fillRowsWidth = false,
    ...rest
  } = {},
) {
  const lengths = (Array.isArray(seasons) ? seasons : []).map((season) => season?.r?.length || 0);
  if (!(width > 0) || lengths.length === 0 || lengths.some((length) => length === 0)) return null;
  const box = { ...TV_GRAPH_LAYOUT, ...rest, width, maxHeight };
  const maxEpisodes = Math.max(...lengths);
  const forcedMode = layoutMode === "columns" || layoutMode === "rows" ? layoutMode : null;
  const fixedPerLine = Number.isFinite(episodesPerRow)
    ? Math.max(1, Math.min(maxEpisodes, Math.round(episodesPerRow)))
    : null;

  const candidates = [];
  if (forcedMode !== "rows") {
    for (let bands = 1; bands <= Math.min(lengths.length, 4); bands += 1) {
      const candidate = columnsCandidate(lengths, bands, box);
      if (candidate) candidates.push(candidate);
    }
  }
  if (forcedMode !== "columns") {
    if (fixedPerLine) {
      candidates.push(rowsCandidate(lengths, fixedPerLine, box));
    } else {
      for (let perLine = 1; perLine <= maxEpisodes; perLine += 1) {
        candidates.push(rowsCandidate(lengths, perLine, box));
      }
    }
  }

  // Sohbetin yoğun yatay grafiğinde yüksekliğe bütün sezonları sığdırmak için
  // kareleri küçültme. On kare kullanılabilir genişliği doldursun; fazla sezonlar
  // maxHeight'ta kesilip tam grafik ekranından açılır.
  const cellOf = (candidate) =>
    Math.min(fillRowsWidth && candidate.mode === "rows" ? candidate.byWidth : candidate.fit, maxCell);
  let best = null;
  let bestScore = -Infinity;
  candidates.forEach((candidate) => {
    const score = cellOf(candidate) * candidate.pref;
    if (cellOf(candidate) > 0 && score > bestScore + 1e-9) {
      best = candidate;
      bestScore = score;
    }
  });
  // Klasik grafik puan yazısını taşıyabiliyor ve en iyiden çok küçük değilse o (alışılmış görünüm).
  const classic = candidates.find((candidate) => candidate.mode === "columns");
  if (best && classic && cellOf(classic) >= box.textMinCell && cellOf(classic) >= cellOf(best) * 0.8) {
    best = classic;
  }
  // Kare tavana dayandıysa (az bölümlü dizi) en derli toplu (en alçak) düzen: 1 × 5 bölüm uzun bir sütun değil tek şerit.
  // Yalnız sezonu bölmeyen düzenler yarışır (3 × 10 bölüm 9 + 1 diye kaymasın).
  if (best && cellOf(best) >= maxCell) {
    const heightOf = (candidate) => measure(candidate, maxCell, box).height;
    const capped = candidates.filter((candidate) => cellOf(candidate) >= maxCell && candidate.pref !== PREFERENCE.wrapped);
    if (!capped.length) capped.push(best);
    const lowest = capped.reduce((low, candidate) => (heightOf(candidate) < heightOf(low) ? candidate : low), capped[0]);
    best = classic && capped.includes(classic) && heightOf(classic) <= heightOf(lowest) * 1.3 ? classic : lowest;
  }

  let cell = best ? cellOf(best) : 0;
  if (!best || cell < minCell) {
    // Hiçbir düzen sığmıyor: en sık düzen (rows) en küçük kareyle, genişliği dolduran `perLine` ile; alt taraf kesilir.
    cell = minCell;
    const widthFit = Math.max(
      1,
      Math.min(
        maxEpisodes,
        Math.floor((width - box.labelW + cell * box.gapRatio) / (cell * (1 + box.gapRatio))),
      ),
    );
    const perLine = fixedPerLine || widthFit;
    best = rowsCandidate(lengths, perLine, box);
  }
  cell = Math.floor(cell * 10) / 10;
  const size = measure(best, cell, box);
  // Sezon / şerit etiketi sığmıyorsa yalnız her `labelStep`te bir yazılır.
  const labelStep =
    best.mode === "columns"
      ? Math.max(1, Math.ceil(16 / (cell + size.gap)))
      : Math.max(1, Math.ceil(9 / (cell + size.stripGap)));
  return {
    mode: best.mode,
    cell,
    ...size,
    overflow: size.height > maxHeight + 0.5,
    showText: cell >= box.textMinCell,
    labelStep,
    headerH: box.headerH,
    bandGap: box.bandGap,
    labelW: box.labelW,
    ...(best.mode === "columns" ? { per: best.per, groups: best.groups } : { perLine: best.perLine, lines: best.lines }),
  };
}

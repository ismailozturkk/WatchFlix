// utils/commentScope.js
//
// Dizi yorumlarının KAPSAM (scope) modeli.
//
// Bir dizi yorumu üç yerden birine "referans verir":
//   • show    → dizinin geneli          (scopeKey: "show")
//   • season  → belirli bir sezon        (scopeKey: "s2")
//   • episode → belirli bir bölüm        (scopeKey: "s2e5")
//
// Yorumların TAMAMI eskisi gibi tek koleksiyonda durur
// (TvComment/{tvId}/comments/{commentId}); kapsam yalnızca doküman ALANIDIR.
// Böylece dizi sayfasındaki tek onSnapshot bütün sezon/bölüm yorumlarını da
// getirir, filtreleme istemcide yapılır ve ek composite index gerekmez.
//
// Bu dosya SAF JS'tir (RN / Firebase / i18n importu yok) — jest ile test edilir.
// Kullanıcıya görünen metinler çağıran tarafından `labels` ile verilir.

export const COMMENT_SCOPE = Object.freeze({
  SHOW: "show",
  SEASON: "season",
  EPISODE: "episode",
});

// Filtre tipleri (üst filtre çubuğu + kapsam sayfası ortak kullanır).
//   ALL         → her şey
//   SHOW        → yalnız dizi geneli yorumları
//   SEASON      → sezonun kendisi + o sezonun bütün bölüm yorumları
//   SEASON_ONLY → yalnız "sezon geneli" yorumları (bölümler hariç)
//   EPISODE     → yalnız tek bölüm
export const SCOPE_FILTER = Object.freeze({
  ALL: "all",
  SHOW: "show",
  SEASON: "season",
  SEASON_ONLY: "seasonOnly",
  EPISODE: "episode",
});

export const ALL_SCOPE_FILTER = Object.freeze({
  type: SCOPE_FILTER.ALL,
  seasonNumber: null,
  episodeNumber: null,
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Ham veriyi (Firestore dokümanı, TMDB objesi veya elle kurulmuş kapsam)
 * tutarlı bir kapsam nesnesine indirger.
 *
 * Tolerans kuralları — eski kayıtlar ve yarım veri asla render'ı bozmasın:
 *   • `scope` alanı yoksa sayı alanlarından türetilir (legacy yorumlar → show),
 *   • "episode" ama bölüm/sezon numarası yoksa bir üst kapsama düşer,
 *   • "season" ama sezon numarası yoksa dizi geneline düşer.
 *
 * @returns {{scope: string, seasonNumber: number|null, episodeNumber: number|null, title: string|null}}
 */
export function normalizeScope(raw) {
  const seasonNumber = toNumber(raw?.seasonNumber ?? raw?.season_number);
  const episodeNumber = toNumber(raw?.episodeNumber ?? raw?.episode_number);

  let scope = raw?.scope;
  if (scope !== COMMENT_SCOPE.SEASON && scope !== COMMENT_SCOPE.EPISODE) {
    if (scope !== COMMENT_SCOPE.SHOW) {
      // Alan hiç yok / tanınmıyor → sayılardan türet.
      scope =
        seasonNumber != null && episodeNumber != null
          ? COMMENT_SCOPE.EPISODE
          : seasonNumber != null
            ? COMMENT_SCOPE.SEASON
            : COMMENT_SCOPE.SHOW;
    }
  }

  if (scope === COMMENT_SCOPE.EPISODE && episodeNumber == null) {
    scope = seasonNumber == null ? COMMENT_SCOPE.SHOW : COMMENT_SCOPE.SEASON;
  }
  if (scope === COMMENT_SCOPE.SEASON && seasonNumber == null) {
    scope = COMMENT_SCOPE.SHOW;
  }

  // Başlık iki adla gelebilir: Firestore alanı `scopeTitle`, bu fonksiyonun
  // kendi çıktısı ise `title`. İkisi de okunmazsa normalize İDEMPOTENT olmaz —
  // üretimde her kapsam en az iki kez normalize edildiği için (ekran →
  // ScopedCommentButton → Comment → scopeWriteFields) başlık sessizce düşerdi.
  const rawTitle = raw?.scopeTitle ?? raw?.title;
  const title =
    typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : null;

  return {
    scope,
    seasonNumber: scope === COMMENT_SCOPE.SHOW ? null : seasonNumber,
    episodeNumber: scope === COMMENT_SCOPE.EPISODE ? episodeNumber : null,
    title,
  };
}

/** Kapsamın tek dizgeli kimliği: "show" | "s2" | "s2e5". */
export function scopeKey(raw) {
  const s = normalizeScope(raw);
  if (s.scope === COMMENT_SCOPE.EPISODE) {
    return `s${s.seasonNumber}e${s.episodeNumber}`;
  }
  if (s.scope === COMMENT_SCOPE.SEASON) return `s${s.seasonNumber}`;
  return "show";
}

/** scopeKey → kapsam nesnesi (bozuk anahtarlar dizi geneline düşer). */
export function parseScopeKey(key) {
  if (typeof key !== "string") return normalizeScope(null);
  const episodeMatch = /^s(-?\d+)e(-?\d+)$/.exec(key);
  if (episodeMatch) {
    return normalizeScope({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: Number(episodeMatch[1]),
      episodeNumber: Number(episodeMatch[2]),
    });
  }
  const seasonMatch = /^s(-?\d+)$/.exec(key);
  if (seasonMatch) {
    return normalizeScope({
      scope: COMMENT_SCOPE.SEASON,
      seasonNumber: Number(seasonMatch[1]),
    });
  }
  return normalizeScope(null);
}

/**
 * Firestore'a yazılacak kapsam alanları. `scopeKey` sorgulanabilir tek alan
 * olarak da saklanır (ileride sunucu tarafı filtre gerekirse hazır dursun).
 */
export function scopeWriteFields(raw) {
  const s = normalizeScope(raw);
  return {
    scope: s.scope,
    seasonNumber: s.seasonNumber,
    episodeNumber: s.episodeNumber,
    scopeKey: scopeKey(s),
    scopeTitle: s.title,
  };
}

/** İki kapsam aynı yeri mi gösteriyor? */
export function isSameScope(a, b) {
  return scopeKey(a) === scopeKey(b);
}

export function makeScopeFilter(type, seasonNumber = null, episodeNumber = null) {
  const season = toNumber(seasonNumber);
  const episode = toNumber(episodeNumber);
  switch (type) {
    case SCOPE_FILTER.SHOW:
      return { type: SCOPE_FILTER.SHOW, seasonNumber: null, episodeNumber: null };
    case SCOPE_FILTER.SEASON:
    case SCOPE_FILTER.SEASON_ONLY:
      if (season == null) return { ...ALL_SCOPE_FILTER };
      return { type, seasonNumber: season, episodeNumber: null };
    case SCOPE_FILTER.EPISODE:
      if (season == null || episode == null) return { ...ALL_SCOPE_FILTER };
      return {
        type: SCOPE_FILTER.EPISODE,
        seasonNumber: season,
        episodeNumber: episode,
      };
    default:
      return { ...ALL_SCOPE_FILTER };
  }
}

/** Bir kapsamı "tam olarak burayı göster" filtresine çevirir (rozete tıklama). */
export function filterForScope(raw) {
  const s = normalizeScope(raw);
  if (s.scope === COMMENT_SCOPE.EPISODE) {
    return makeScopeFilter(SCOPE_FILTER.EPISODE, s.seasonNumber, s.episodeNumber);
  }
  if (s.scope === COMMENT_SCOPE.SEASON) {
    return makeScopeFilter(SCOPE_FILTER.SEASON, s.seasonNumber);
  }
  return makeScopeFilter(SCOPE_FILTER.SHOW);
}

/**
 * Filtre, YENİ yorum yazarken hangi hedefi ima eder?
 * "Tümü" filtresinde hedef dizi genelidir; sezon filtresinde sezon, bölüm
 * filtresinde bölüm. Böylece kullanıcı bir sezonu süzüp doğrudan yazabilir.
 */
export function scopeForFilter(filter) {
  const f = filter || ALL_SCOPE_FILTER;
  if (f.type === SCOPE_FILTER.EPISODE) {
    return normalizeScope({
      scope: COMMENT_SCOPE.EPISODE,
      seasonNumber: f.seasonNumber,
      episodeNumber: f.episodeNumber,
    });
  }
  if (f.type === SCOPE_FILTER.SEASON || f.type === SCOPE_FILTER.SEASON_ONLY) {
    return normalizeScope({
      scope: COMMENT_SCOPE.SEASON,
      seasonNumber: f.seasonNumber,
    });
  }
  return normalizeScope(null);
}

export function isAllFilter(filter) {
  return !filter || filter.type === SCOPE_FILTER.ALL;
}

/** TMDB incelemeleri dizi genelidir — yalnız "Tümü" ve "Dizi" filtrelerinde görünür. */
export function filterAllowsShowLevelSources(filter) {
  return isAllFilter(filter) || filter.type === SCOPE_FILTER.SHOW;
}

/** Verilen kapsam bu filtreye giriyor mu? */
export function scopeMatchesFilter(raw, filter) {
  const f = filter || ALL_SCOPE_FILTER;
  if (f.type === SCOPE_FILTER.ALL) return true;

  const s = normalizeScope(raw);
  switch (f.type) {
    case SCOPE_FILTER.SHOW:
      return s.scope === COMMENT_SCOPE.SHOW;
    case SCOPE_FILTER.SEASON:
      // Sezonun kendisi + bu sezona ait bölümler.
      return s.seasonNumber === f.seasonNumber && s.scope !== COMMENT_SCOPE.SHOW;
    case SCOPE_FILTER.SEASON_ONLY:
      return s.scope === COMMENT_SCOPE.SEASON && s.seasonNumber === f.seasonNumber;
    case SCOPE_FILTER.EPISODE:
      return (
        s.scope === COMMENT_SCOPE.EPISODE &&
        s.seasonNumber === f.seasonNumber &&
        s.episodeNumber === f.episodeNumber
      );
    default:
      return true;
  }
}

/**
 * Yorum listesinden kapsam sayaç ağacı çıkarır — filtre çipleri ve kapsam
 * sayfası bu özeti kullanır.
 *
 * @returns {{
 *   total: number,
 *   show: number,
 *   seasonTotal: number,
 *   seasons: Array<{
 *     seasonNumber: number,
 *     total: number,        // sezon geneli + bölümler
 *     seasonOnly: number,   // yalnız sezon geneli
 *     episodeTotal: number,
 *     episodes: Array<{ episodeNumber: number, count: number, title: string|null }>,
 *     title: string|null,
 *   }>,
 *   byKey: Object<string, number>,
 * }}
 */
export function summarizeScopes(items) {
  const list = Array.isArray(items) ? items : [];
  const seasonMap = new Map();
  const byKey = Object.create(null);
  let show = 0;

  list.forEach((item) => {
    const s = normalizeScope(item);
    const key = scopeKey(s);
    byKey[key] = (byKey[key] || 0) + 1;

    if (s.scope === COMMENT_SCOPE.SHOW) {
      show += 1;
      return;
    }

    let bucket = seasonMap.get(s.seasonNumber);
    if (!bucket) {
      bucket = {
        seasonNumber: s.seasonNumber,
        total: 0,
        seasonOnly: 0,
        episodeTotal: 0,
        episodes: new Map(),
        title: null,
      };
      seasonMap.set(s.seasonNumber, bucket);
    }
    bucket.total += 1;

    if (s.scope === COMMENT_SCOPE.SEASON) {
      bucket.seasonOnly += 1;
      if (!bucket.title && s.title) bucket.title = s.title;
      return;
    }

    bucket.episodeTotal += 1;
    const episode = bucket.episodes.get(s.episodeNumber) || {
      episodeNumber: s.episodeNumber,
      count: 0,
      title: null,
    };
    episode.count += 1;
    if (!episode.title && s.title) episode.title = s.title;
    bucket.episodes.set(s.episodeNumber, episode);
  });

  const seasons = [...seasonMap.values()]
    .map((bucket) => ({
      ...bucket,
      episodes: [...bucket.episodes.values()].sort(
        (a, b) => a.episodeNumber - b.episodeNumber,
      ),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  return {
    total: list.length,
    show,
    seasonTotal: list.length - show,
    seasons,
    byKey,
  };
}

/** Özetten tek bir sezon kovası (yoksa boş kova). */
export function seasonBucket(summary, seasonNumber) {
  const empty = {
    seasonNumber,
    total: 0,
    seasonOnly: 0,
    episodeTotal: 0,
    episodes: [],
    title: null,
  };
  if (!summary || seasonNumber == null) return empty;
  return (
    (summary.seasons || []).find((s) => s.seasonNumber === seasonNumber) || empty
  );
}

/** Filtrenin kapsadığı yorum sayısı (özet üzerinden, listeyi taramadan). */
export function countForFilter(summary, filter) {
  if (!summary) return 0;
  const f = filter || ALL_SCOPE_FILTER;
  switch (f.type) {
    case SCOPE_FILTER.SHOW:
      return summary.show || 0;
    case SCOPE_FILTER.SEASON:
      return seasonBucket(summary, f.seasonNumber).total;
    case SCOPE_FILTER.SEASON_ONLY:
      return seasonBucket(summary, f.seasonNumber).seasonOnly;
    case SCOPE_FILTER.EPISODE: {
      const bucket = seasonBucket(summary, f.seasonNumber);
      const episode = bucket.episodes.find(
        (e) => e.episodeNumber === f.episodeNumber,
      );
      return episode ? episode.count : 0;
    }
    default:
      return summary.total || 0;
  }
}

const DEFAULT_LABELS = Object.freeze({
  show: "Dizi",
  seasonPrefix: "S",
  episodePrefix: "B",
});

/**
 * Rozet metni: "Dizi" | "S2" | "S2·B5".
 * `labels` ile dil değiştirilir (en: { show: "Show", episodePrefix: "E" }).
 */
export function shortScopeLabel(raw, labels) {
  const l = { ...DEFAULT_LABELS, ...(labels || {}) };
  const s = normalizeScope(raw);
  if (s.scope === COMMENT_SCOPE.EPISODE) {
    return `${l.seasonPrefix}${s.seasonNumber}·${l.episodePrefix}${s.episodeNumber}`;
  }
  if (s.scope === COMMENT_SCOPE.SEASON) {
    return `${l.seasonPrefix}${s.seasonNumber}`;
  }
  return l.show;
}

// Biçim dizgelerindeki yer tutucular. Tek süslü parantez ({season}) TERCİH
// EDİLİR: i18next'in varsayılan ayracı çift süslüdür ({{...}}) ve değişkeni
// dışarıdan almadığı bir anahtarı boş dizgeye çevirir. Her iki yazım da
// desteklenir ki eski/elle yazılmış metinler de bozulmasın.
const SEASON_TOKEN = /\{\{?\s*season\s*\}?\}/g;
const EPISODE_TOKEN = /\{\{?\s*episode\s*\}?\}/g;

/**
 * Uzun etiket: "Dizi geneli" | "2. Sezon" | "2. Sezon · 5. Bölüm — Adı".
 * Biçim dizgeleri çağırandan gelir ({season}, {episode}).
 */
export function longScopeLabel(raw, texts) {
  const s = normalizeScope(raw);
  const t = {
    show: "Dizi geneli",
    season: "{season}. Sezon",
    episode: "{season}. Sezon · {episode}. Bölüm",
    ...(texts || {}),
  };
  const fill = (template) =>
    String(template)
      .replace(SEASON_TOKEN, String(s.seasonNumber))
      .replace(EPISODE_TOKEN, String(s.episodeNumber));

  if (s.scope === COMMENT_SCOPE.EPISODE) {
    const base = fill(t.episode);
    return s.title ? `${base} — ${s.title}` : base;
  }
  if (s.scope === COMMENT_SCOPE.SEASON) {
    const base = fill(t.season);
    return s.title && s.title !== base ? `${base} — ${s.title}` : base;
  }
  return t.show;
}

/** Filtreyi başlıkta göstermek için etiket (SEASON_ONLY ayrı metin alır). */
export function filterLabel(filter, texts) {
  const f = filter || ALL_SCOPE_FILTER;
  const t = { all: "Tümü", seasonOnly: "{season}. Sezon (genel)", ...(texts || {}) };
  if (f.type === SCOPE_FILTER.ALL) return t.all;
  if (f.type === SCOPE_FILTER.SEASON_ONLY) {
    return String(t.seasonOnly).replace(SEASON_TOKEN, String(f.seasonNumber));
  }
  return longScopeLabel(scopeForFilter(f), texts);
}

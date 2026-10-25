// services/userData/domains.js
//
// Yerel-öncelikli alanların TANIMLARI (saf veri + saf fonksiyonlar; Firebase
// import etmez, bu yüzden Jest'te doğrudan test edilir).
//
// Yeni bir kullanıcı-sahipli koleksiyon eklemek = buraya bir `DomainSpec` +
// `utils/cacheStore.js` DURABLE_NAMESPACES + `utils/cacheKeys.js` anahtarı.
//
// ÖN KOŞUL (alan seçerken): koleksiyona YALNIZ bu kullanıcının istemcisi yazıyor
// olmalı. Cloud Function, başka kullanıcı ya da başka bir ekranın transaction'ı
// aynı belgeyi değiştiriyorsa yerel kopya bayatlar → o veri bu modele girmez
// (profil belgesi, arkadaşlar, sohbetler, gönderiler, ortak listeler…).
// Bkz. docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md "Sınıflandırma".

import { cacheKeys } from "../../utils/cacheKeys";

const BATCH_CHUNK = 450; // Firestore batch tavanı 500; pay bırak.

/** Aynı anda en çok bu kadar alt koleksiyon okunur (dizi başına episodes). */
const FETCH_CONCURRENCY = 5;

async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** İşlemleri Firestore batch tavanına göre parçalayıp gönderir. */
async function commitChunked(remote, ops) {
  for (let i = 0; i < ops.length; i += BATCH_CHUNK) {
    await remote.commit(ops.slice(i, i + BATCH_CHUNK));
  }
}

/* ================================================================== */
/* NOTLAR — Notes/{uid}/items/{noteId}                                 */
/* ================================================================== */

/**
 * Eski şema: Notes/{uid}.notes[] (dizi). Yalnız alt koleksiyon BOŞ çıkarsa ve
 * tek seferlik indirmede bir kez bakılır; bulununca alt koleksiyona taşınır.
 */
export async function fetchNotesFromCloud(uid, remote) {
  let docs = await remote.fetchCollection(`Notes/${uid}/items`);
  if (docs.length === 0) {
    try {
      const legacy = await remote.fetchDoc(`Notes/${uid}`);
      const old = Array.isArray(legacy?.notes) ? legacy.notes.filter((n) => n?.id) : [];
      if (old.length > 0) {
        await commitChunked(
          remote,
          old.map((note) => ({
            path: `Notes/${uid}/items/${note.id}`,
            op: "set",
            data: note,
          })),
        );
        docs = old.map((note) => ({ id: String(note.id), data: note }));
      }
    } catch {
      // eski şema yok / okunamadı: boş liste ile devam
    }
  }
  return { items: docs.map(({ id, data }) => ({ ...data, id })) };
}

export const notesSpec = {
  name: "notes",
  kinds: {
    items: {
      cacheKey: (uid) => cacheKeys.notes(uid),
      keyOf: (doc) => doc.id,
      pathOf: (uid, key) => `Notes/${uid}/items/${key}`,
      // Şekil dataDownloader/eski bağlam ile aynı: createdAt azalan.
      compare: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    },
  },
  fetchCloud: fetchNotesFromCloud,
};

/* ================================================================== */
/* MEDYA NOTLARI — MediaNotes/{uid}/items/{type_id}                    */
/* ================================================================== */

export const mediaNotesSpec = {
  name: "mediaNotes",
  kinds: {
    items: {
      cacheKey: (uid) => cacheKeys.mediaNotes(uid),
      keyOf: (doc) => doc.id,
      pathOf: (uid, key) => `MediaNotes/${uid}/items/${key}`,
      compare: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    },
  },
  fetchCloud: async (uid, remote) => {
    const docs = await remote.fetchCollection(`MediaNotes/${uid}/items`);
    return { items: docs.map(({ id, data }) => ({ ...data, id })) };
  },
};

/* ================================================================== */
/* AI SOHBETLERİ — AiConversations/{uid}/items/{conversationId}        */
/* ================================================================== */

// Şema, boyut bütçesi ve depo API'si: services/userData/aiConversations.js.
// Yalnız bu kullanıcının istemcisi yazar (Cloud Function'ın AiUsage kotası
// AYRI bir koleksiyondur) — ön koşul sağlanıyor.
export const aiConversationsSpec = {
  name: "aiConversations",
  kinds: {
    items: {
      cacheKey: (uid) => cacheKeys.aiConversations(uid),
      keyOf: (doc) => doc.id,
      pathOf: (uid, key) => `AiConversations/${uid}/items/${key}`,
      // Geçmiş ekranının sırası: en son konuşulan en üstte.
      compare: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    },
  },
  fetchCloud: async (uid, remote) => {
    const docs = await remote.fetchCollection(`AiConversations/${uid}/items`);
    return { items: docs.map(({ id, data }) => ({ ...data, id })) };
  },
};

/* ================================================================== */
/* ÖZEL AFİŞLER — PosterChoices/{uid} (TEK belge)                      */
/* ================================================================== */

// Seçimler tek belgede: arkadaş profili onu TEK okumayla alır (alt koleksiyonda
// seçim başına bir okuma olurdu). Motorun "öğe" kavramına tek öğe olarak oturur:
// anahtar hep "all", her yazım tam belge `set` (idempotent; son yazan kazanır).
// Şema ve tavan: utils/posterChoices.js. Yalnız bu kullanıcının istemcisi yazar.
export const posterChoicesSpec = {
  name: "posterChoices",
  kinds: {
    doc: {
      cacheKey: (uid) => cacheKeys.posterChoices(uid),
      keyOf: (doc) => doc.id,
      pathOf: (uid) => `PosterChoices/${uid}`,
    },
  },
  fetchCloud: async (uid, remote) => {
    const data = await remote.fetchDoc(`PosterChoices/${uid}`);
    return { doc: data ? [{ ...data, id: "all" }] : [] };
  },
};

/* ================================================================== */
/* HATIRLATICILAR — Reminders/{uid}/movies + tvShows/{id}/episodes     */
/* ================================================================== */

/** Bölüm yerel anahtarı: "{showId}/{episodeId}". */
export const episodeKey = (showId, episodeId) => `${showId}/${episodeId}`;

const splitEpisodeKey = (key) => {
  const at = key.indexOf("/");
  return [key.slice(0, at), key.slice(at + 1)];
};

/**
 * Eski şema: Reminders/{uid}.{movieReminders[], tvReminders[]}. Saf dönüşüm —
 * hem yazılacak işlemleri hem de yerel belgeleri üretir.
 */
export function legacyRemindersToDocs(uid, old) {
  const ops = [];
  const movies = [];
  const episodes = [];

  for (const movie of old?.movieReminders || []) {
    if (movie?.movieId == null) continue;
    movies.push(movie);
    ops.push({
      path: `Reminders/${uid}/movies/${String(movie.movieId)}`,
      op: "set",
      data: movie,
    });
  }

  for (const show of old?.tvReminders || []) {
    if (show?.showId == null) continue;
    ops.push({
      path: `Reminders/${uid}/tvShows/${String(show.showId)}`,
      op: "set",
      data: {
        showId: show.showId,
        showName: show.showName,
        showPosterPath: show.showPosterPath || "",
      },
    });
    for (const season of show.seasons || []) {
      for (const ep of season.episodes || []) {
        const epId = String(
          ep.episodeId || `${show.showId}-${season.seasonNumber}-${ep.episodeNumber}`,
        );
        const doc = {
          ...ep,
          episodeId: epId,
          showId: show.showId,
          showName: show.showName,
          showPosterPath: show.showPosterPath || "",
          seasonNumber: season.seasonNumber,
          seasonPosterPath: season.seasonPosterPath || null,
        };
        episodes.push(doc);
        ops.push({
          path: `Reminders/${uid}/tvShows/${String(show.showId)}/episodes/${epId}`,
          op: "set",
          data: doc,
        });
      }
    }
  }
  return { ops, movies, episodes };
}

export async function fetchRemindersFromCloud(uid, remote) {
  const [movieDocs, showDocs] = await Promise.all([
    remote.fetchCollection(`Reminders/${uid}/movies`),
    remote.fetchCollection(`Reminders/${uid}/tvShows`),
  ]);

  if (movieDocs.length === 0 && showDocs.length === 0) {
    try {
      const legacy = await remote.fetchDoc(`Reminders/${uid}`);
      if (legacy && (legacy.movieReminders?.length || legacy.tvReminders?.length)) {
        const converted = legacyRemindersToDocs(uid, legacy);
        await commitChunked(remote, converted.ops);
        return { movies: converted.movies, episodes: converted.episodes };
      }
    } catch {
      // eski şema yok / okunamadı: boş liste ile devam
    }
  }

  const perShow = await mapLimited(showDocs, FETCH_CONCURRENCY, (show) =>
    remote.fetchCollection(`Reminders/${uid}/tvShows/${show.id}/episodes`),
  );

  return {
    movies: movieDocs.map(({ data }) => data),
    episodes: perShow.flatMap((eps) => eps.map(({ data }) => data)),
  };
}

export const remindersSpec = {
  name: "reminders",
  kinds: {
    movies: {
      // Disk biçimi bağlam öncesiyle AYNI (dizi) → güncellemede indirme yok.
      cacheKey: (uid) => cacheKeys.reminders(uid, "movies"),
      keyOf: (doc) => doc.movieId,
      pathOf: (uid, key) => `Reminders/${uid}/movies/${key}`,
    },
    episodes: {
      cacheKey: (uid) => cacheKeys.reminders(uid, "episodes"),
      keyOf: (doc) =>
        doc.showId == null || doc.episodeId == null
          ? null
          : episodeKey(doc.showId, doc.episodeId),
      pathOf: (uid, key) => {
        const [showId, epId] = splitEpisodeKey(key);
        return `Reminders/${uid}/tvShows/${showId}/episodes/${epId}`;
      },
    },
  },
  fetchCloud: fetchRemindersFromCloud,
};

/**
 * Hatırlatıcı eylemleri. Okuma YAPMAZ: eski kod her çan için `getDoc` ile "var
 * mı?" ve "dizide başka bölüm kaldı mı?" diye soruyordu; ikisi de yerel kopyadan
 * bilinir.
 *
 * Firestore'da `tvShows/{showId}` belgesi, o dizinin en az bir bölümü
 * olduğu sürece vardır. Yerelde bölüm sayısından türetilir:
 *   ilk bölüm eklenirken  → dizi belgesi yazılır
 *   son bölüm silinirken  → dizi belgesi silinir
 */
export function createRemindersActions(domain) {
  const showDocPath = (uid, showId) => `Reminders/${uid}/tvShows/${showId}`;
  const siblingsOf = (uid, showId, exceptKey) =>
    domain
      .getSnapshot(uid)
      .lists.episodes.filter(
        (ep) =>
          String(ep.showId) === String(showId) &&
          episodeKey(ep.showId, ep.episodeId) !== exceptKey,
      );

  const api = {
    /** @param {object} movie { movieId, movieName, releaseDate, … } */
    setMovie(uid, movie) {
      if (!uid || movie?.movieId == null || movie.movieId === "") return false;
      return domain.apply(uid, [{ kind: "movies", doc: movie }]);
    },

    removeMovie(uid, movieId) {
      if (!uid || movieId == null) return false;
      return domain.apply(uid, [{ kind: "movies", key: movieId }]);
    },

    /** Varsa kaldırır, yoksa ekler. @returns {boolean} işlemden sonra VAR mı */
    toggleMovie(uid, movie) {
      const has = api.hasMovie(uid, movie?.movieId);
      if (has) api.removeMovie(uid, movie.movieId);
      else api.setMovie(uid, movie);
      return !has;
    },

    hasMovie(uid, movieId) {
      if (!uid || movieId == null) return false;
      return domain.getSnapshot(uid).has("movies", movieId);
    },

    /** @param {object} episode episodeId/showId/showName/showPosterPath/… */
    setEpisode(uid, episode) {
      if (!uid || episode?.showId == null || episode?.episodeId == null) return false;
      const key = episodeKey(episode.showId, episode.episodeId);
      const first = siblingsOf(uid, episode.showId, key).length === 0;
      return domain.apply(uid, [
        {
          kind: "episodes",
          doc: episode,
          remoteOps: first
            ? [
                {
                  path: showDocPath(uid, episode.showId),
                  op: "set",
                  data: {
                    showId: episode.showId,
                    showName: episode.showName || "",
                    showPosterPath: episode.showPosterPath || "",
                  },
                },
              ]
            : [],
        },
      ]);
    },

    removeEpisode(uid, showId, episodeId) {
      if (!uid || showId == null || episodeId == null) return false;
      const key = episodeKey(showId, episodeId);
      const last = siblingsOf(uid, showId, key).length === 0;
      return domain.apply(uid, [
        {
          kind: "episodes",
          key,
          remoteOps: last ? [{ path: showDocPath(uid, showId), op: "delete" }] : [],
        },
      ]);
    },

    hasEpisode(uid, showId, episodeId) {
      if (!uid || showId == null || episodeId == null) return false;
      return domain.getSnapshot(uid).has("episodes", episodeKey(showId, episodeId));
    },

    /** @returns {boolean} işlemden sonra VAR mı */
    toggleEpisode(uid, episode) {
      const has = api.hasEpisode(uid, episode?.showId, episode?.episodeId);
      if (has) api.removeEpisode(uid, episode.showId, episode.episodeId);
      else api.setEpisode(uid, episode);
      return !has;
    },
  };
  return api;
}

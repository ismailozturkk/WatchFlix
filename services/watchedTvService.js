// services/watchedTvService.js
//
// İzlenen DİZİLER için TEK yazma kaynağı. Kanonik model: HER DİZİ İÇİN TEK DOKÜMAN
//   Lists/{uid}/watchedTv/{showId}
//     id, name, showEpisodeCount, showSeasonCount, imagePath, addedShowDate,
//     genres[], type:"tv", listOrder, watchedSeasonCount, watchedEpisodeCount,
//     totalMinutes,
//     seasons: [{ seasonNumber, seasonPosterPath, seasonEpisodes, addedSeasonDate,
//                 episodes:[{ episodeNumber, episodePosterPath, episodeName,
//                             episodeRatings, episodeMinutes, episodeWatchTime }] }]
//
// Sezonlar/bölümler doküman İÇİNE gömülüdür (ayrı alt-koleksiyon YOK): tek koleksiyon
// listener'ı (ListStatusContext, ProfileStatsContext) tüm detayı verir → istatistik ve
// liste ekranları ek okuma olmadan çalışır. Eski kök-dizi `watchedTv[]` modelinin
// problemi TÜM dizileri tek devasa array'de tutup her dokunuşta hepsini yeniden
// yazmaktı; burada yalnızca ilgili DİZİNİN dokümanı yazılır.
//
// Bölüm dizisi güncellemeleri `runTransaction` ile yapılır (oku→değiştir→yaz):
// aynı dizide eşzamanlı işaretlemede read-modify-write yarışı (veri kaybı) olmaz.

import {
  doc,
  collection,
  runTransaction,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// Doküman id şeması: `tv_${showId}` — TÜM liste öğesi koleksiyonlarıyla aynı
// (`${type}_${id}`). favorites/watchList film+dizi karışık tuttuğu için type
// prefix'i zorunlu; tutarlılık için watchedTv de aynı şemayı kullanır.
const showRef = (uid, showId) =>
  doc(db, "Lists", uid, "watchedTv", `tv_${showId}`);
// Eski ayrı seasons alt-koleksiyonu BARE id altındaydı (`watchedTv/${id}/seasons`);
// legacy okuma için bare path korunur (migrateSeasonSubdocs).
const seasonsCol = (uid, showId) =>
  collection(db, "Lists", uid, "watchedTv", String(showId), "seasons");

function normalizeEpisode(ep, watchDate) {
  return {
    episodeNumber: ep.episodeNumber,
    episodePosterPath: ep.episodePosterPath || null,
    episodeName: ep.episodeName || "Unknown",
    episodeRatings: ep.episodeRatings || 0,
    episodeMinutes: ep.episodeMinutes || 0,
    episodeWatchTime: watchDate || ep.episodeWatchTime || null,
  };
}

function recomputeAggregates(seasons) {
  let watchedEpisodeCount = 0;
  let totalMinutes = 0;
  seasons.forEach((s) => {
    const eps = s.episodes || [];
    watchedEpisodeCount += eps.length;
    totalMinutes += eps.reduce((a, e) => a + (e.episodeMinutes || 0), 0);
  });
  return {
    watchedSeasonCount: seasons.length,
    watchedEpisodeCount,
    totalMinutes,
  };
}

// İki sezon dizisini BİRLEŞTİRİR (seasonNumber'a göre; bölümler episodeNumber
// union'ı). İkilenen bare+tv_ doküman birleştirmesinde veri kaybını önler.
function mergeSeasons(a, b) {
  const bySeason = new Map();
  [...(a || []), ...(b || [])].forEach((s) => {
    if (!s || s.seasonNumber == null) return;
    const existing = bySeason.get(s.seasonNumber);
    if (!existing) {
      bySeason.set(s.seasonNumber, { ...s, episodes: [...(s.episodes || [])] });
      return;
    }
    const epNums = new Set(existing.episodes.map((e) => e.episodeNumber));
    (s.episodes || []).forEach((e) => {
      if (!epNums.has(e.episodeNumber)) {
        existing.episodes.push(e);
        epNums.add(e.episodeNumber);
      }
    });
    existing.seasonPosterPath =
      existing.seasonPosterPath ?? s.seasonPosterPath ?? null;
    existing.seasonEpisodes =
      existing.seasonEpisodes || s.seasonEpisodes || existing.episodes.length;
    existing.addedSeasonDate =
      existing.addedSeasonDate || s.addedSeasonDate || null;
  });
  return [...bySeason.values()]
    .map((s) => ({
      ...s,
      episodes: (s.episodes || []).sort((x, y) => x.episodeNumber - y.episodeNumber),
    }))
    .sort((x, y) => x.seasonNumber - y.seasonNumber);
}

/**
 * watchedTv doküman girdilerini show id'sine göre TEKİLLEŞTİRİR (ikileme önleme).
 * Aynı dizi hem bare (`1399`) hem yeni (`tv_1399`) doküman olarak durduğunda
 * tek kayda indirir: `tv_` (yeni şema) önceliklidir, ikisi de aynıysa daha çok
 * bölümlü olan seçilir. Migration ikilemeyi kalıcı temizleyene kadar UI'da
 * çiftlenmeyi engeller. entries: [[docId, data], ...] → temiz data[] döner.
 */
export function dedupeWatchedTvEntries(entries) {
  const byId = new Map();
  (entries || []).forEach(([docId, data]) => {
    if (!data) return;
    const bareId = String(docId).replace(/^tv_/, "");
    const id = data.id ?? bareId;
    const key = String(id);
    const isTv = String(docId).startsWith("tv_");
    const cur = { ...data, id, _isTv: isTv };
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, cur);
      return;
    }
    const epCount = (x) =>
      (x.seasons || []).reduce((a, s) => a + (s.episodes?.length || 0), 0);
    if ((isTv && !prev._isTv) || (isTv === prev._isTv && epCount(cur) > epCount(prev))) {
      byId.set(key, cur);
    }
  });
  return [...byId.values()].map(({ _isTv, ...s }) => s);
}

function buildShowMeta(showMeta, watchDate) {
  return {
    id: showMeta.id,
    name: showMeta.name || "",
    showEpisodeCount: showMeta.showEpisodeCount || 0,
    showSeasonCount: showMeta.showSeasonCount || 0,
    imagePath: showMeta.imagePath || null,
    addedShowDate: watchDate || null,
    genres: showMeta.genres || [],
    type: "tv",
  };
}

/**
 * Bir sezona bir veya daha çok bölüm ekler (transaction; dedupe episodeNumber).
 * showMeta: { id, name, showEpisodeCount, showSeasonCount, imagePath, genres }
 * seasonMeta: { seasonNumber, seasonPosterPath, seasonEpisodes }
 */
export async function markEpisodes(uid, showMeta, seasonMeta, episodes, watchDate) {
  if (!uid || showMeta?.id == null || seasonMeta?.seasonNumber == null) return;
  if (!Array.isArray(episodes) || episodes.length === 0) return;
  const ref = showRef(uid, showMeta.id);
  const newEps = episodes.map((e) => normalizeEpisode(e, watchDate));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    let seasons = data?.seasons ? [...data.seasons] : [];

    const idx = seasons.findIndex((s) => s.seasonNumber === seasonMeta.seasonNumber);
    const existing = idx !== -1 ? seasons[idx].episodes || [] : [];
    const existingNums = new Set(existing.map((e) => e.episodeNumber));
    const toAdd = newEps.filter((e) => !existingNums.has(e.episodeNumber));

    if (toAdd.length === 0 && snap.exists()) return; // değişiklik yok

    const mergedEps = [...existing, ...toAdd].sort(
      (a, b) => a.episodeNumber - b.episodeNumber,
    );
    const seasonObj = {
      seasonNumber: seasonMeta.seasonNumber,
      seasonPosterPath:
        idx !== -1
          ? seasons[idx].seasonPosterPath ?? seasonMeta.seasonPosterPath ?? null
          : seasonMeta.seasonPosterPath || null,
      seasonEpisodes: seasonMeta.seasonEpisodes || mergedEps.length,
      addedSeasonDate:
        idx !== -1 ? seasons[idx].addedSeasonDate || watchDate || null : watchDate || null,
      episodes: mergedEps,
    };

    if (idx !== -1) seasons[idx] = seasonObj;
    else seasons.push(seasonObj);
    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    tx.set(
      ref,
      {
        ...(snap.exists() ? {} : buildShowMeta(showMeta, watchDate)),
        ...(snap.exists() && !data.name ? { name: showMeta.name || "" } : {}),
        seasons,
        ...recomputeAggregates(seasons),
      },
      { merge: true },
    );
  });
}

/** Tek bir bölümün işaretini kaldırır (boş sezon→çıkar, son bölüm→show'u sil). */
export async function unmarkEpisode(uid, showId, seasonNumber, episodeNumber) {
  if (!uid || showId == null || seasonNumber == null) return;
  const ref = showRef(uid, showId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const seasons = snap.data().seasons || [];
    const idx = seasons.findIndex((s) => s.seasonNumber === seasonNumber);
    if (idx === -1) return;

    const remainingEps = (seasons[idx].episodes || []).filter(
      (e) => e.episodeNumber !== episodeNumber,
    );
    if (remainingEps.length === (seasons[idx].episodes || []).length) return; // yok

    let newSeasons;
    if (remainingEps.length === 0) {
      newSeasons = seasons.filter((s) => s.seasonNumber !== seasonNumber);
    } else {
      newSeasons = seasons.map((s, i) =>
        i === idx ? { ...s, episodes: remainingEps } : s,
      );
    }

    if (newSeasons.length === 0) {
      tx.delete(ref);
      return;
    }
    tx.update(ref, {
      seasons: newSeasons,
      ...recomputeAggregates(newSeasons),
    });
  });
}

/** Bir sezonun tüm bölümlerini işaretler (markEpisodes wrapper'ı). */
export async function markSeason(uid, showMeta, seasonMeta, episodes, watchDate) {
  return markEpisodes(uid, showMeta, seasonMeta, episodes, watchDate);
}

/** Bir sezonun işaretini komple kaldırır. */
export async function unmarkSeason(uid, showId, seasonNumber) {
  if (!uid || showId == null || seasonNumber == null) return;
  const ref = showRef(uid, showId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const seasons = snap.data().seasons || [];
    const newSeasons = seasons.filter((s) => s.seasonNumber !== seasonNumber);
    if (newSeasons.length === seasons.length) return; // yok

    if (newSeasons.length === 0) {
      tx.delete(ref);
      return;
    }
    tx.update(ref, {
      seasons: newSeasons,
      ...recomputeAggregates(newSeasons),
    });
  });
}

/**
 * Diziyi komple işaretler (tüm sezonların bölümleriyle — üzerine yazar).
 * seasonsWithEpisodes: [{ seasonNumber, seasonPosterPath, seasonEpisodes, episodes:[...] }]
 */
export async function markShow(uid, showMeta, seasonsWithEpisodes, watchDate) {
  if (!uid || showMeta?.id == null || !Array.isArray(seasonsWithEpisodes)) return;
  const seasons = [];
  for (const sea of seasonsWithEpisodes) {
    if (sea?.seasonNumber == null) continue;
    const eps = (sea.episodes || []).map((e) => normalizeEpisode(e, watchDate));
    if (eps.length === 0) continue;
    seasons.push({
      seasonNumber: sea.seasonNumber,
      seasonPosterPath: sea.seasonPosterPath || null,
      seasonEpisodes: sea.seasonEpisodes || eps.length,
      addedSeasonDate: watchDate || null,
      episodes: eps.sort((a, b) => a.episodeNumber - b.episodeNumber),
    });
  }
  if (seasons.length === 0) return;
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  await setDoc(
    showRef(uid, showMeta.id),
    {
      ...buildShowMeta(showMeta, watchDate),
      seasons,
      ...recomputeAggregates(seasons),
    },
    // Manuel liste sırası gibi show metadata alanlarını tam işaretlemede koru.
    { merge: true },
  );
}

/** Dizinin tüm izlenme kaydını siler. */
export async function unmarkShow(uid, showId) {
  if (!uid || showId == null) return;
  await deleteDoc(showRef(uid, showId));
}

/**
 * İzlenen diziler ekranındaki manuel sırayı show belgelerinde saklar.
 *
 * Eski model tek bir watchedTv[] dizisini yeniden yazıyordu. Yeni modelde her
 * dizi ayrı belge olduğu için taşınan aralıktaki belgelerin `listOrder` alanı
 * batch ile güncellenir. İlk sıralamada eski belgelerde listOrder bulunmuyorsa
 * bütün liste bir kez normalize edilir.
 */
export async function reorderWatchedShows(
  uid,
  orderedShows,
  fromIndex,
  toIndex,
) {
  if (!uid || !Array.isArray(orderedShows) || orderedShows.length === 0) return;

  const hasCompleteOrder = orderedShows.every((show) =>
    Number.isFinite(show?.listOrder),
  );
  const start = hasCompleteOrder ? Math.min(fromIndex, toIndex) : 0;
  const end = hasCompleteOrder
    ? Math.max(fromIndex, toIndex)
    : orderedShows.length - 1;
  const writes = orderedShows
    .map((show, index) => ({ id: show?.id, index }))
    .filter(({ id, index }) => id != null && index >= start && index <= end);

  // Firestore batch limiti 500; güvenli pay bırakarak büyük listeleri böl.
  const CHUNK_SIZE = 450;
  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + CHUNK_SIZE).forEach(({ id, index }) => {
      batch.update(showRef(uid, id), { listOrder: index });
    });
    await batch.commit();
  }
}

/**
 * Eski BARE doc id'li (`watchedTv/1399`) show doküman'larını yeni `tv_${id}`
 * şemasına taşır VE bare+tv_ İKİLEMESİNİ giderir (ikileme = listelerde/
 * istatistikte aynı dizinin iki kez görünmesi).
 *
 * pendingRekey: [{ docId (bare), data (bare doc), existing (tv_ doc | null) }]
 *   - existing yok  → bare'i tv_ olarak kopyala, bare'i sil.
 *   - existing var  → tv_ kanonik; bare'in sezonlarını tv_'ye BİRLEŞTİR
 *                     (veri kaybı yok), bare'i sil.
 */
export async function migrateWatchedTvDocIds(uid, pendingRekey) {
  if (!uid || !Array.isArray(pendingRekey) || pendingRekey.length === 0) return false;
  for (let i = 0; i < pendingRekey.length; i += 200) {
    const batch = writeBatch(db);
    pendingRekey.slice(i, i + 200).forEach(({ docId, data, existing }) => {
      const id = data?.id ?? docId;
      const tvRef = doc(db, "Lists", uid, "watchedTv", `tv_${id}`);
      if (existing) {
        const seasons = mergeSeasons(existing.seasons || [], data?.seasons || []);
        batch.set(
          tvRef,
          {
            ...data, // bare metadata (eksik alanlar için)
            ...existing, // tv_ metadata öncelikli (daha güncel)
            seasons,
            ...recomputeAggregates(seasons),
          },
          { merge: true },
        );
      } else {
        batch.set(tvRef, data, { merge: true });
      }
      batch.delete(doc(db, "Lists", uid, "watchedTv", docId));
    });
    await batch.commit();
  }
  return true;
}

/**
 * Eski kök-dizi modelindeki ({ ..., seasons:[{ seasonNumber, episodes:[...] }] })
 * tek bir diziyi tek-doküman modeline taşır (yalnız subcollection'da olmayanlar için).
 */
export async function migrateLegacyShow(uid, legacyShow) {
  if (!uid || legacyShow?.id == null || !Array.isArray(legacyShow.seasons)) return;
  const seasons = [];
  for (const sea of legacyShow.seasons) {
    if (sea?.seasonNumber == null) continue;
    const eps = (sea.episodes || []).map((e) => ({
      episodeNumber: e.episodeNumber,
      episodePosterPath: e.episodePosterPath || null,
      episodeName: e.episodeName || "Unknown",
      episodeRatings: e.episodeRatings || 0,
      episodeMinutes: e.episodeMinutes || 0,
      episodeWatchTime:
        e.episodeWatchTime || sea.addedSeasonDate || legacyShow.addedShowDate || null,
    }));
    if (eps.length === 0) continue;
    seasons.push({
      seasonNumber: sea.seasonNumber,
      seasonPosterPath: sea.seasonPosterPath || null,
      seasonEpisodes: sea.seasonEpisodes || eps.length,
      addedSeasonDate: sea.addedSeasonDate || legacyShow.addedShowDate || null,
      episodes: eps.sort((a, b) => a.episodeNumber - b.episodeNumber),
    });
  }
  if (seasons.length === 0) return; // taşınacak gerçek veri yok
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  await setDoc(showRef(uid, legacyShow.id), {
    ...buildShowMeta(
      {
        id: legacyShow.id,
        name: legacyShow.name,
        showEpisodeCount: legacyShow.showEpisodeCount,
        showSeasonCount: legacyShow.showSeasonCount,
        imagePath: legacyShow.imagePath,
        genres: legacyShow.genres,
      },
      legacyShow.addedShowDate || null,
    ),
    seasons,
    ...recomputeAggregates(seasons),
  });
}

/**
 * Eski SeasonItem'ın yazdığı `watchedTv/{showId}/seasons/{n}` AYRI alt-koleksiyon
 * doküman'larını show doküman'ına GÖMER (yeni model) ve alt-koleksiyonu siler.
 * `seasons` alanı zaten varsa hiçbir şey yapmaz. Bir şey taşındıysa true döner.
 */
export async function migrateSeasonSubdocs(uid, showId) {
  if (!uid || showId == null) return false;
  const ref = showRef(uid, showId);
  const seasonsSnap = await getDocs(seasonsCol(uid, showId));
  if (seasonsSnap.empty) return false;

  const seasons = seasonsSnap.docs
    .map((d) => d.data())
    .filter((s) => s && s.seasonNumber != null && (s.episodes || []).length > 0)
    .map((s) => ({
      seasonNumber: s.seasonNumber,
      seasonPosterPath: s.seasonPosterPath || null,
      seasonEpisodes: s.seasonEpisodes || (s.episodes || []).length,
      addedSeasonDate: s.addedSeasonDate || null,
      episodes: (s.episodes || [])
        .map((e) => ({
          episodeNumber: e.episodeNumber,
          episodePosterPath: e.episodePosterPath || null,
          episodeName: e.episodeName || "Unknown",
          episodeRatings: e.episodeRatings || 0,
          episodeMinutes: e.episodeMinutes || 0,
          episodeWatchTime: e.episodeWatchTime || s.addedSeasonDate || null,
        }))
        .sort((a, b) => a.episodeNumber - b.episodeNumber),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const batch = writeBatch(db);
  if (seasons.length > 0) {
    batch.set(ref, { seasons, ...recomputeAggregates(seasons) }, { merge: true });
  }
  seasonsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return seasons.length > 0;
}

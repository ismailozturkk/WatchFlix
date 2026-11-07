// services/dailyFrameService.js
//
// "Günün Karesi"nin ağ katmanı: günün bulmacasını kurar (TMDB movie/top_rated yuvası + dilsiz sahne kareleri) ve
// tahmin kutusu için film arar. Kurallar (yuva permütasyonu, kare sırası) utils/dailyFrame.js'te, saf ve testli.
//
// HERKESE AYNI BULMACA: yuva gün numarasından türer, sayfa kimliğe göre sıralanır, kareler dilsiz görsellerden
// rastgelelik olmadan seçilir — dil yalnız başlık metnini değiştirir. Kurulan bulmaca o gün (gün + dil anahtarıyla)
// cihazda saklanır: gün içinde TMDB oynasa da oyun ortasında kare değişmez, çevrimdışı da açılır.
// Yuvadaki filmin 6 nitelikli karesi yoksa aynı sayfanın sıradaki filmine geçilir (en çok FRAME_PROBE_MAX aday).

import axios from "axios";
import { cachedRead } from "../utils/cachedRead";
import { tmdbLanguageOf } from "../utils/appLanguages";
import { dayKeyOf } from "../utils/dailyChallenge";
import {
  FRAME_PAGES,
  candidateOrder,
  puzzleNumberOf,
  selectFrames,
  slotOfPuzzle,
  slotPosition,
} from "../utils/dailyFrame";
import { fetchTitleImages } from "./sceneGameService";

const TMDB = "https://api.themoviedb.org/3/";
const TIMEOUT_MS = 12000;
const CACHE_NS = "game";
const PUZZLE_MAX_AGE = 24 * 60 * 60 * 1000;
export const FRAME_PROBE_BATCH = 4;
export const FRAME_PROBE_MAX = 20;
export const FRAME_SEARCH_LIMIT = 8;

// v2: bulmaca `directors` taşır (6. kare ipucu). v1 önbelleği yönetmensizdi.
const puzzleCacheKey = (dayKey, language) => `frame:daily:${dayKey}:${language}:v2`;
export const FRAME_MAX_DIRECTORS = 2;

async function tmdbGet(apiKey, path, params = {}) {
  const response = await axios.get(TMDB + path, { params, headers: { Authorization: apiKey }, timeout: TIMEOUT_MS });
  return response.data;
}

const yearOf = (raw) => String(raw?.release_date || "").slice(0, 4);

function toPuzzle(raw, frames, dayKey, number, directors = []) {
  return {
    dayKey,
    number,
    answerKey: `movie_${raw.id}`,
    id: raw.id,
    title: raw.title || raw.original_title || "",
    originalTitle: raw.original_title || raw.title || "",
    year: yearOf(raw),
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids : [],
    posterPath: raw.poster_path || null,
    directors,
    frames,
  };
}

/**
 * Yönetmen adları (6. kare ipucu). İpucu oyunu taşımaz: alınamazsa boş liste, bulmaca yine kurulur.
 * Adlar dilden bağımsız (kişi adı çevrilmez); ikili yönetmenlerde en çok FRAME_MAX_DIRECTORS.
 */
export async function fetchDirectors(apiKey, movieId) {
  try {
    const data = await tmdbGet(apiKey, `movie/${movieId}/credits`);
    const names = (data?.crew || []).filter((p) => p?.job === "Director" && p.name).map((p) => p.name);
    return [...new Set(names)].slice(0, FRAME_MAX_DIRECTORS);
  } catch {
    return [];
  }
}

/**
 * Bir sayfanın adayları arasından 6 karesi olan ilk film. Adaylar gruplar halinde paralel sorulur; grup içinde sıra
 * korunur (ilk uygun = yuvaya en yakın), böylece sonuç ağ hızından bağımsız.
 */
async function firstWithFrames(apiKey, ordered, imagesOf) {
  const limit = Math.min(ordered.length, FRAME_PROBE_MAX);
  for (let start = 0; start < limit; start += FRAME_PROBE_BATCH) {
    const batch = ordered.slice(start, Math.min(start + FRAME_PROBE_BATCH, limit));
    const results = await Promise.all(
      batch.map((raw) =>
        Promise.resolve(imagesOf(apiKey, { type: "movie", id: raw.id }))
          .then((images) => (images ? selectFrames(images.backdrops) : null))
          .catch(() => null),
      ),
    );
    const index = results.findIndex(Boolean);
    if (index >= 0) return { raw: batch[index], frames: results[index] };
  }
  return null;
}

/**
 * Günün bulmacası (ağdan). Yuvanın sayfası yetmezse sonraki sayfa denenir (en çok 3 sayfa).
 * @returns {Promise<object>} hata: `code` = "frame_unavailable"
 */
export async function buildDailyFramePuzzle(apiKey, language = "tr", dayKey = dayKeyOf(), { imagesOf = fetchTitleImages } = {}) {
  const number = puzzleNumberOf(dayKey);
  const { page, index } = slotPosition(slotOfPuzzle(number));
  const lang = tmdbLanguageOf(language);
  for (let step = 0; step < 3; step += 1) {
    const targetPage = ((page - 1 + step) % FRAME_PAGES) + 1;
    const data = await tmdbGet(apiKey, "movie/top_rated", { page: targetPage, language: lang });
    const usable = (data?.results || []).filter((raw) => raw && !raw.adult && raw.id);
    const ordered = candidateOrder(usable, step === 0 ? index : 0);
    const hit = await firstWithFrames(apiKey, ordered, imagesOf);
    if (hit) return toPuzzle(hit.raw, hit.frames, dayKey, number, await fetchDirectors(apiKey, hit.raw.id));
  }
  throw Object.assign(new Error("Daily frame is unavailable"), { code: "frame_unavailable" });
}

/** Günün bulmacası; gün içinde bir kez kurulan sonuç cihazda saklanır (çevrimdışı dahil). */
export async function loadDailyFramePuzzle(apiKey, language = "tr", dayKey = dayKeyOf()) {
  const { data } = await cachedRead(
    CACHE_NS,
    puzzleCacheKey(dayKey, language),
    () => buildDailyFramePuzzle(apiKey, language, dayKey),
    { maxAge: PUZZLE_MAX_AGE, fallbackToCache: true },
  );
  if (!data || !Array.isArray(data.frames) || data.dayKey !== dayKey) {
    throw Object.assign(new Error("Daily frame is unavailable"), { code: "frame_unavailable" });
  }
  return data;
}

/**
 * Tahmin kutusu: film araması (diziler / kişiler yok). Yetişkin sonuç elenir; aynı kimlik bir kez.
 * @returns {Promise<Array<{key, id, title, year, posterPath}>>}
 */
export async function searchFrameMovies(apiKey, language, text) {
  const q = String(text || "").trim();
  if (q.length < 2) return [];
  const data = await tmdbGet(apiKey, "search/movie", { query: q, page: 1, language: tmdbLanguageOf(language) });
  const seen = new Set();
  const out = [];
  (data?.results || []).forEach((raw) => {
    if (!raw?.id || raw.adult || seen.has(raw.id)) return;
    seen.add(raw.id);
    out.push({
      key: `movie_${raw.id}`,
      id: raw.id,
      title: raw.title || raw.original_title || "",
      year: yearOf(raw),
      posterPath: raw.poster_path || null,
    });
  });
  return out.slice(0, FRAME_SEARCH_LIMIT);
}

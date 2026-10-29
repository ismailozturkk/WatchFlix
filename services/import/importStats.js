// services/import/importStats.js
//
// Kaynak bazında (letterboxd / imdb) BİRİKİMLİ aktarım istatistikleri:
// Users/{uid}/private/importStats (yalnız sahibi okur/yazar).
//
// Sayılan şey "dosyada kaç satır vardı" değil, aktarımın kütüphaneye EKLEDİĞİ kayıtlardır:
// aynı dosya ikinci kez aktarılınca hiçbir şey eklenmediği için toplam şişmez; yeni
// dosya (ör. sonraki ayın dışa aktarımı) yalnız yeni kayıtlarını üstüne ekler.
// Sıfırlama o kaynağın toplamını sıfırlar.

import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export const IMPORT_SOURCES = Object.freeze(["letterboxd", "imdb"]);
export const HISTORY_LIMIT = 12;

const COUNTERS = ["titles", "watchEvents", "ratings", "reviews", "lists", "listItems"];

export const emptySourceStats = () => ({
  ...Object.fromEntries(COUNTERS.map((key) => [key, 0])),
  imports: 0,
  firstImportAt: null,
  lastImportAt: null,
  createdLists: [],
  history: [],
});

const statsRef = (uid) => doc(db, "Users", uid, "private", "importStats");

const num = (value) => Math.max(0, Number(value) || 0);

/** Belgeden okunan ham veriyi güvenli biçime getirir (eksik/bozuk alanlar sıfır). */
export function normalizeSourceStats(raw) {
  const base = emptySourceStats();
  if (!raw || typeof raw !== "object") return base;
  COUNTERS.forEach((key) => {
    base[key] = num(raw[key]);
  });
  base.imports = num(raw.imports);
  base.firstImportAt = typeof raw.firstImportAt === "string" ? raw.firstImportAt : null;
  base.lastImportAt = typeof raw.lastImportAt === "string" ? raw.lastImportAt : null;
  base.createdLists = Array.isArray(raw.createdLists) ? raw.createdLists.filter((name) => typeof name === "string") : [];
  base.history = Array.isArray(raw.history) ? raw.history.filter((entry) => entry && typeof entry.at === "string") : [];
  return base;
}

export const hasAnyImportedData = (stats) => COUNTERS.some((key) => num(stats?.[key]) > 0);

/**
 * Saf birleştirme: bir aktarım oturumunun eklediklerini mevcut toplamın üstüne ekler.
 * @param {Object} current   normalizeSourceStats çıktısı
 * @param {Object} delta     { titles, watchEvents, ratings, reviews, lists, listItems, createdLists }
 * @param {{ at: string, newSession: boolean }} meta
 */
export function mergeSourceStats(current, delta = {}, { at, newSession = true } = {}) {
  const next = normalizeSourceStats(current);
  COUNTERS.forEach((key) => {
    next[key] += num(delta[key]);
  });
  next.createdLists = [...new Set([...next.createdLists, ...(delta.createdLists || [])])];
  const added = Object.fromEntries(COUNTERS.map((key) => [key, num(delta[key])]));
  if (newSession) {
    next.imports += 1;
    next.firstImportAt = next.firstImportAt || at;
    next.history = [{ at, ...added }, ...next.history].slice(0, HISTORY_LIMIT);
  } else if (next.history.length) {
    // Kaldığı yerden sürdürülen oturum: aynı geçmiş satırına eklenir.
    const [head, ...rest] = next.history;
    next.history = [{ ...head, ...Object.fromEntries(COUNTERS.map((key) => [key, num(head[key]) + added[key]])) }, ...rest];
  } else {
    next.history = [{ at, ...added }];
  }
  next.lastImportAt = at;
  return next;
}

export async function loadImportStats(uid) {
  if (!uid) return {};
  const snap = await getDoc(statsRef(uid));
  const data = snap.exists() ? snap.data() || {} : {};
  return Object.fromEntries(IMPORT_SOURCES.map((source) => [source, normalizeSourceStats(data[source])]));
}

/**
 * Kaynak bazında eklenenleri belgeye işler.
 * @param {string} uid
 * @param {Record<string, Object>} deltaBySource  { letterboxd: {...}, imdb: {...} }
 * @param {{ newSession?: boolean, at?: string }} [options]
 */
export async function recordImportStats(uid, deltaBySource, { newSession = true, at = new Date().toISOString() } = {}) {
  const sources = Object.keys(deltaBySource || {}).filter((source) => IMPORT_SOURCES.includes(source));
  if (!uid || sources.length === 0) return null;
  let result = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef(uid));
    const data = snap.exists() ? snap.data() || {} : {};
    const patch = {};
    sources.forEach((source) => {
      patch[source] = mergeSourceStats(data[source], deltaBySource[source], { at, newSession });
    });
    tx.set(statsRef(uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    result = patch;
  });
  return result;
}

/** Sıfırlamadan sonra kaynağın toplamını boşaltır. */
export async function clearImportStats(uid, source) {
  if (!uid || !IMPORT_SOURCES.includes(source)) return;
  await runTransaction(db, async (tx) => {
    tx.set(statsRef(uid), { [source]: emptySourceStats(), updatedAt: serverTimestamp() }, { merge: true });
  });
}

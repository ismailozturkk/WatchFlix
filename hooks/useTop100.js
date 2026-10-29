// hooks/useTop100.js
//
// "Seelogd Top 100"ün veri bağı: TMDB havuzu + topluluk sayaçları (services/top100Service) → sıralı liste
// (utils/top100.rankTop100), cihazdaki kendi oylarım (Keys.top100Votes) ve oy verme.
//
// AKIŞ
//   • Havuz + sayaçlar modül belleğinde CACHE_MS boyunca paylaşılır: Eğlence kartı ile ekran aynı yükü iki kez yapmaz.
//   • Oy iyimserdir: sayaç ve kendi puanım anında güncellenir, sıralama yeniden hesaplanır; transaction düşerse ikisi
//     de geri alınır ve hata fırlatılır (çağıran toast gösterir).
//   • Arama sonucundan oy verilen yapım havuzda yoksa `extras`a eklenir; böylece sıralamaya hemen girer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApiSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { Keys, get, set, useStored } from "../services/storage";
import {
  castTop100Vote,
  fetchTop100Counters,
  fetchMyTop100Vote,
  fetchTop100Details,
  fetchTop100Pool,
} from "../services/top100Service";
import { applyVote, asCounter, normalizeMyVotes, rankTop100 } from "../utils/top100";

const CACHE_MS = 10 * 60 * 1000;
let memory = null; // { language, at, pool, counters }

/** Yalnız testler: modül önbelleğini sıfırlar. */
export function __resetTop100Memory() {
  memory = null;
}

async function loadAll(apiKey, language) {
  const [pool, counters] = await Promise.all([
    fetchTop100Pool(apiKey, language),
    fetchTop100Counters().catch(() => ({})), // sayaç okunamazsa liste yine TMDB'yle kurulur
  ]);
  const inPool = new Set(pool.map((item) => item.key));
  const missing = Object.keys(counters).filter((key) => counters[key].count > 0 && !inPool.has(key));
  const details = missing.length ? await fetchTop100Details(apiKey, language, missing) : [];
  return { pool: [...pool, ...details], counters };
}

/**
 * @returns {{
 *   status: "loading"|"ready"|"error", ranked: object[], counters: Record<string,{sum:number,count:number}>,
 *   myVotes: Record<string,number>, totalVotes: number, refresh: () => void,
 *   vote: (item: object, score: number) => Promise<{ rank: number|null }>, rankOf: (key: string) => number|null,
 * }}
 */
export default function useTop100() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();

  const fresh = memory && memory.language === language && Date.now() - memory.at < CACHE_MS ? memory : null;
  const [pool, setPool] = useState(fresh?.pool || []);
  const [counters, setCounters] = useState(fresh?.counters || {});
  const [extras, setExtras] = useState({});
  const [status, setStatus] = useState(fresh ? "ready" : "loading");
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!API_KEY) return undefined;
    const cached = memory && memory.language === language && Date.now() - memory.at < CACHE_MS ? memory : null;
    if (cached && nonce === 0) {
      setPool(cached.pool);
      setCounters(cached.counters);
      setStatus("ready");
      return undefined;
    }
    let cancelled = false;
    if (!cached) setStatus("loading");
    loadAll(API_KEY, language)
      .then((result) => {
        memory = { language, at: Date.now(), ...result };
        if (cancelled) return;
        setPool(result.pool);
        setCounters(result.counters);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled && !cached) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [API_KEY, language, nonce]);

  const raw = useStored(Keys.top100Votes, { uid });
  const myVotes = useMemo(() => normalizeMyVotes(raw), [raw]);

  const ranked = useMemo(
    () => rankTop100([...pool, ...Object.values(extras)], counters),
    [pool, extras, counters],
  );
  const rankIndex = useMemo(() => {
    const map = new Map();
    ranked.forEach((row) => map.set(row.key, row.rank));
    return map;
  }, [ranked]);
  const rankOf = useCallback((key) => rankIndex.get(key) ?? null, [rankIndex]);

  const totalVotes = useMemo(
    () => Object.values(counters).reduce((acc, counter) => acc + (counter?.count || 0), 0),
    [counters],
  );

  const writeMine = useCallback(
    (key, score) => {
      const next = { ...normalizeMyVotes(get(Keys.top100Votes, { uid })) };
      if (score) next[key] = score;
      else delete next[key];
      set(Keys.top100Votes, next, { uid });
    },
    [uid],
  );

  const vote = useCallback(
    async (item, score) => {
      if (!uid || !item?.key) throw new Error("top100_no_user");
      const key = item.key;
      const previous = myVotes[key] ?? null;
      const before = asCounter(counters[key]);
      const optimistic = applyVote(before, previous, score);

      const known = pool.some((row) => row.key === key);
      if (!known) setExtras((prev) => (prev[key] ? prev : { ...prev, [key]: item }));
      setCounters((prev) => ({ ...prev, [key]: optimistic }));
      writeMine(key, score);

      try {
        const result = await castTop100Vote({ uid, type: item.media_type, id: item.id, score });
        const settled = { ...counters, [key]: result.counter };
        if (memory && memory.language === language) {
          memory = {
            ...memory,
            counters: { ...memory.counters, [key]: result.counter },
            pool: known || memory.pool.some((row) => row.key === key) ? memory.pool : [...memory.pool, item],
          };
        }
        if (alive.current) setCounters((prev) => ({ ...prev, [key]: result.counter }));
        const next = rankTop100([...pool, ...Object.values(extras), ...(known ? [] : [item])], settled);
        return { rank: next.find((row) => row.key === key)?.rank ?? null };
      } catch (error) {
        if (alive.current) setCounters((prev) => ({ ...prev, [key]: before }));
        writeMine(key, previous);
        throw error;
      }
    },
    [uid, myVotes, counters, pool, extras, language, writeMine],
  );

  // Oy sayfası açılınca: başka cihazdan verilmiş oyu yerel kayda getirir (puan seçicisi doğru başlasın).
  const syncMyVote = useCallback(
    async (key) => {
      try {
        const server = await fetchMyTop100Vote(uid, key);
        if (server && server !== normalizeMyVotes(get(Keys.top100Votes, { uid }))[key]) writeMine(key, server);
        return server;
      } catch {
        return null;
      }
    },
    [uid, writeMine],
  );

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { status, ranked, counters, myVotes, totalVotes, refresh, vote, rankOf, syncMyVote };
}

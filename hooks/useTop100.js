// hooks/useTop100.js
//
// "Seelogd Top 100"ün veri bağı: TMDB havuzu + topluluk sayaçları (services/top100Service) → hibrit oy sayısına
// göre sıralı liste (utils/top100.rankTop100), cihazdaki kendi oylarım (Keys.top100Hype) ve oy aç/kapa.
//
// AKIŞ
//   • Havuz + sayaçlar modül belleğinde CACHE_MS boyunca paylaşılır: Eğlence kartı ile ekran aynı yükü iki kez yapmaz.
//   • Oy iyimserdir: sayaç ve kendi oyum anında değişir, sıralama yeniden hesaplanır; transaction düşerse ikisi de
//     geri alınır ve hata fırlatılır (çağıran toast gösterir).
//   • Arama sonucundan oy verilen yapım havuzda yoksa `extras`a eklenir; böylece sıralamaya hemen girer.
//   • Aynı yapıma üst üste dokunuş: yazım sürerken ikinci dokunuş yok sayılır (sayaç tutarlı kalsın).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApiSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { Keys, get, set, useStored } from "../services/storage";
import {
  fetchMyTop100Hype,
  fetchTop100Counters,
  fetchTop100Details,
  fetchTop100Pool,
  setTop100Hype,
} from "../services/top100Service";
import { applyHype, asCounter, normalizeMyHype, rankTop100 } from "../utils/top100";

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
 *   status: "loading"|"ready"|"error", ranked: object[], counters: Record<string,{count:number}>,
 *   myHype: Record<string,true>, totalVotes: number, refresh: () => void,
 *   toggleHype: (item: object) => Promise<{ hyped: boolean, rank: number|null }>, rankOf: (key: string) => number|null,
 *   syncMyHype: (keys: string[]) => void,
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
  const busy = useRef(new Set());
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

  const raw = useStored(Keys.top100Hype, { uid });
  const myHype = useMemo(() => normalizeMyHype(raw), [raw]);

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
    (key, hyped) => {
      const next = { ...normalizeMyHype(get(Keys.top100Hype, { uid })) };
      if (hyped) next[key] = true;
      else delete next[key];
      set(Keys.top100Hype, next, { uid });
    },
    [uid],
  );

  const toggleHype = useCallback(
    async (item) => {
      if (!uid || !item?.key) throw new Error("top100_no_user");
      const key = item.key;
      if (busy.current.has(key)) return { hyped: !!myHype[key], rank: rankOf(key) };
      busy.current.add(key);
      const was = !!myHype[key];
      const before = asCounter(counters[key]);
      const optimistic = applyHype(before, was, !was);

      const known = pool.some((row) => row.key === key);
      if (!known) setExtras((prev) => (prev[key] ? prev : { ...prev, [key]: item }));
      setCounters((prev) => ({ ...prev, [key]: optimistic }));
      writeMine(key, !was);

      try {
        const result = await setTop100Hype({ uid, type: item.media_type, id: item.id, hyped: !was });
        if (memory && memory.language === language) {
          memory = {
            ...memory,
            counters: { ...memory.counters, [key]: result.counter },
            pool: memory.pool.some((row) => row.key === key) ? memory.pool : [...memory.pool, item],
          };
        }
        if (alive.current) setCounters((prev) => ({ ...prev, [key]: result.counter }));
        if (result.hyped !== !was) writeMine(key, result.hyped);
        const next = rankTop100([...pool, ...Object.values(extras), ...(known ? [] : [item])], {
          ...counters,
          [key]: result.counter,
        });
        return { hyped: result.hyped, rank: next.find((row) => row.key === key)?.rank ?? null };
      } catch (error) {
        if (alive.current) setCounters((prev) => ({ ...prev, [key]: before }));
        writeMine(key, was);
        throw error;
      } finally {
        busy.current.delete(key);
      }
    },
    [uid, myHype, counters, pool, extras, language, rankOf, writeMine],
  );

  // Başka cihazdan verilmiş oyları görünen yapımlar için yerel kayda getirir (en fazla bir kez / yapım).
  const synced = useRef(new Set());
  const syncMyHype = useCallback(
    (keys) => {
      if (!uid) return;
      (keys || []).forEach((key) => {
        if (synced.current.has(key)) return;
        synced.current.add(key);
        fetchMyTop100Hype(uid, key)
          .then((server) => {
            if (server === null) return;
            const local = !!normalizeMyHype(get(Keys.top100Hype, { uid }))[key];
            if (server !== local && !busy.current.has(key)) writeMine(key, server);
          })
          .catch(() => {});
      });
    },
    [uid, writeMine],
  );

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { status, ranked, counters, myHype, totalVotes, refresh, toggleHype, rankOf, syncMyHype };
}

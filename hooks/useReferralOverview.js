// hooks/useReferralOverview.js
//
// Davet ekranının ve Premium sayfasının veri kaynağı: tek callable (getReferralOverview).
// Sunucudaki her şeyi (kod, davet ettiklerim, kazanılan aylar, davet indirimim) tek
// seferde okur; ekran açılınca yüklenir, `reload` ile yenilenir.
//
// Yükleme hatası ekranı bozmaz: `error` dolar, `data` önceki değerde kalır.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchReferralOverview } from "../services/referralService";

export default function useReferralOverview({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && uid));
  const [error, setError] = useState(null);
  // Hızlı iki çağrıdan eskisinin cevabı yenisini ezmesin.
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    if (!uid) return null;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const next = await fetchReferralOverview();
      if (request !== requestRef.current) return null;
      setData(next);
      setError(null);
      return next;
    } catch (err) {
      if (request === requestRef.current) setError(err);
      return null;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!enabled || !uid) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    reload();
    return () => {
      requestRef.current += 1; // çıkışta/oturum değişince eski cevabı yok say
    };
  }, [enabled, uid, reload]);

  return { data, loading, error, reload };
}

// components/import/useImportJob.js
//
// İçe aktarma işinin ekran tarafı: işi başlatır / kaldığı yerden sürdürür, ilerleme
// olaylarını seyrelterek duruma yazar, durdurmayı yönetir ve iş sürerken ekranı açık tutar.
//
// Seyreltme: eşleştirme 5 paralel istekle önbellekten saniyede yüzlerce olay üretebilir;
// her olayda yeniden çizim sayfayı kilitlerdi. Olaylar indirgeyicide anında işlenir, ekrana
// en çok ~11 kez/sn yansır; aşama değişimi ve bitiş beklemeden yansır.
//
// Ekranı açık tutma: büyük arşivde kayıt dakikalar sürer; ekran kilitlenince iOS uygulamayı
// askıya alır ve transaction'lar düşerdi.

import { useCallback, useEffect, useRef, useState } from "react";
import { createImportProgress, reduceImportProgress } from "../../services/import/importProgress";
import { estimateJobTotals, runImportJob } from "../../services/import/importRunner";
import { createImportSignal } from "../../services/import/importRetry";

const FLUSH_MS = 90;
const KEEP_AWAKE_TAG = "seelogd-import";

// expo-keep-awake `expo` paketinin bağımlılığı olarak kurulu ve bağlı. Modül yoksa
// (test ortamı) aktarım ekranı açık tutmadan da çalışır.
function setKeepAwake(active) {
  try {
    const keepAwake = require("expo-keep-awake");
    const result = active
      ? keepAwake.activateKeepAwakeAsync?.(KEEP_AWAKE_TAG)
      : keepAwake.deactivateKeepAwake?.(KEEP_AWAKE_TAG);
    result?.catch?.(() => {});
  } catch {
    // isteğe bağlı
  }
}

export default function useImportJob() {
  const [progress, setProgress] = useState(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const progressRef = useRef(null);
  const timerRef = useRef(null);
  const signalRef = useRef(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      signalRef.current?.cancel();
      setKeepAwake(false);
    };
  }, []);

  const flush = useCallback(() => {
    timerRef.current = null;
    if (mountedRef.current) setProgress(progressRef.current);
  }, []);

  const dispatch = useCallback((event, runId) => {
    if (runId !== runIdRef.current) return;
    progressRef.current = reduceImportProgress(progressRef.current, event);
    if (event.type === "stage" || event.type === "finalized") {
      clearTimeout(timerRef.current);
      flush();
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(flush, FLUSH_MS);
    }
  }, [flush]);

  /**
   * İşi yürütür. Asla fırlatmaz: `{ result }`, `{ error }` ya da iş bu arada
   * sıfırlandıysa `{ stale: true }` döner.
   * @param {Object} job  importRunner.createImportJob
   * @param {{ resume?: boolean }} [options]  resume: ilerleme durumunu koru
   */
  const run = useCallback(async (job, { resume = false } = {}) => {
    const runId = ++runIdRef.current;
    const signal = createImportSignal();
    signalRef.current = signal;
    if (!resume || !progressRef.current) {
      progressRef.current = createImportProgress(estimateJobTotals(job));
    }
    setProgress(progressRef.current);
    setRunning(true);
    setCancelling(false);
    setKeepAwake(true);
    try {
      const result = await runImportJob(job, { signal, onEvent: (event) => dispatch(event, runId) });
      return runId === runIdRef.current ? { result } : { stale: true };
    } catch (error) {
      return runId === runIdRef.current ? { error } : { stale: true };
    } finally {
      if (runId === runIdRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        signalRef.current = null;
        setKeepAwake(false);
        if (mountedRef.current) {
          setProgress(progressRef.current);
          setRunning(false);
          setCancelling(false);
        }
      }
    }
  }, [dispatch]);

  /** Bir sonraki öğe sınırında durdurur; o ana dek yazılanlar korunur. */
  const cancel = useCallback(() => {
    const signal = signalRef.current;
    if (!signal || signal.cancelled) return;
    signal.cancel();
    setCancelling(true);
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    signalRef.current?.cancel();
    signalRef.current = null;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    progressRef.current = null;
    setProgress(null);
    setRunning(false);
    setCancelling(false);
    setKeepAwake(false);
  }, []);

  return { progress, running, cancelling, run, cancel, reset };
}

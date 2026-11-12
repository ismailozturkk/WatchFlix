// utils/afterInteractions.js
//
// "Ekran yerleşsin, sonra şu işi yap" için tek kapı.
//
// Neden: React Native 0.86'da `InteractionManager` KULLANIMDAN KALKTI ve bir
// koçana (stub) dönüştü — `runAfterInteractions` artık animasyonu/geçişi
// BEKLEMİYOR, işi yalnız bir sonraki `setImmediate`'te çalıştırıyor. Projede
// "geçiş bitince ağır işi başlat" niyetiyle yazılmış 11 çağrı vardı; hepsi
// sessizce "hemen çalıştır"a dönüşmüştü.
//
// Bu yardımcı işi JS iş parçacığı boşa çıkınca (`requestIdleCallback`) çalıştırır;
// boşluk gelmezse en geç `timeout` ms sonra yine çalıştırır (iş asla askıda kalmaz).
// `requestIdleCallback` yoksa (eski ortam / test) `setTimeout(0)`'a düşer.
//
// Dönen nesne eski API ile aynı şekilde: `{ cancel() }`.

const DEFAULT_TIMEOUT_MS = 500;

/**
 * @param {() => void} task
 * @param {{ timeout?: number }} [options]
 * @returns {{ cancel: () => void }}
 */
export function runAfterInteractions(task, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    task();
  };

  if (typeof globalThis.requestIdleCallback === "function") {
    const id = globalThis.requestIdleCallback(run, { timeout });
    return {
      cancel() {
        done = true;
        globalThis.cancelIdleCallback?.(id);
      },
    };
  }

  const id = setTimeout(run, 0);
  return {
    cancel() {
      done = true;
      clearTimeout(id);
    },
  };
}

export default runAfterInteractions;

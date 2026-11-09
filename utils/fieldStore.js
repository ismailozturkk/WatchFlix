// utils/fieldStore.js
//
// Büyük bir context değerine ALAN BAZINDA abone olmak için küçük bir depo.
//
// NEDEN: MovieContext / TvShowContext 60+ alanlı tek bir değer yayınlıyor.
// `useContext` ile okuyan her raf, bir başka rafın "daha fazla yükleniyor"
// bayrağı değişse bile yeniden çiziliyordu (ana ekranda 10 raf birden).
// `useFields(store, keys)` yalnız listelenen alanlardan biri değişince render
// eder.
//
// FONKSİYONLAR: bu context'lerdeki yükleyiciler (loadMore*, fetch*…) useCallback
// değil; değer her yeniden hesaplandığında yeni kimlik alırlar. Kimlikle
// karşılaştırılsalar seçici hiçbir şey kazandırmazdı. Bu yüzden fonksiyon
// alanları için anahtar başına SABİT bir sarmalayıcı döner; çağrıldığında
// depodaki EN GÜNCEL fonksiyonu çağırır (bayat kapanış yok). Sonuç: fonksiyon
// alanları hiçbir zaman yeniden render sebebi değildir.
//
// Kullanım (sağlayıcı):
//   const store = useFieldStore(contextValue);
//   <FieldsContext.Provider value={store}>…
// Kullanım (tüketici):
//   const { a, b } = useFields(useContext(FieldsContext), ["a", "b"]);

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

export function createFieldStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Sağlayıcı tarafı: değeri depoya commit sonrası (boyamadan önce) yayınlar. */
export function useFieldStore(value) {
  const ref = useRef(null);
  if (!ref.current) ref.current = createFieldStore(value);
  const store = ref.current;
  useLayoutEffect(() => {
    store.set(value);
  }, [store, value]);
  return store;
}

/**
 * Tüketici tarafı: yalnız `keys` alanlarını döndürür; biri (kimlikçe)
 * değişmedikçe aynı nesneyi döndürür → render yok.
 */
export function useFields(store, keys) {
  const cacheRef = useRef(null);
  const wrappersRef = useRef({});

  const getSnapshot = () => {
    const source = store.get() || {};
    const prev = cacheRef.current;
    let changed = prev === null;
    const next = {};
    for (const key of keys) {
      const raw = source[key];
      let val = raw;
      if (typeof raw === "function") {
        val = wrappersRef.current[key];
        if (!val) {
          val = (...args) => {
            const fn = store.get()?.[key];
            return typeof fn === "function" ? fn(...args) : undefined;
          };
          wrappersRef.current[key] = val;
        }
      }
      next[key] = val;
      if (!changed && prev[key] !== val) changed = true;
    }
    if (!changed) return prev;
    cacheRef.current = next;
    return next;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

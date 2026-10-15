// services/userData/createDomain.js
//
// YEREL-ÖNCELİKLİ VERİ ALANI (domain) MOTORU — React'ten ve Firebase'den bağımsız.
//
// Bir "alan", kullanıcının KENDİ yazdığı, başkasının dokunmadığı bir Firestore
// koleksiyon kümesidir (notlar, medya notları, hatırlatıcılar). Alanın kuralı:
//
//   OKUMA   yerel kopyadan, SENKRON. Açılışta ve sonrasında buluttan okuma YOK.
//   YAZMA   önce yerelde + kalıcı günlükte (anında), buluta arka planda.
//   İNDİRME yalnızca "yerel kopya yok" iken, TEK SEFER: yeni telefon, uygulamayı
//           sıfırlama, hesap değiştirme, sistemin dosyayı silmesi, elle
//           "yeniden indir".
//
// ── DEĞİŞMEZ KURAL ───────────────────────────────────────────────────────────
//
//   Bir kind'ın anlık görüntü dosyası ANCAK alan tam indirildiyse vardır.
//   Dosyanın varlığı = "bu cihazda hidrate edildi". Bu yüzden alan hazır
//   değilken (`ready=false`) diske ANLIK GÖRÜNTÜ YAZILMAZ; o dönemin değişiklikleri
//   yalnız yazma günlüğündedir ve indirme tamamlanınca üstüne bindirilir. Yarım
//   bir kopyayı diske yazmak, bir sonraki açılışta "tam" sanılıp eksik veriyle
//   çalışmaya yol açardı.
//
// ── İNDİRME SIRASINDA YAPILAN YEREL DEĞİŞİKLİK ───────────────────────────────
//
//   İndirme saniyeler sürebilir; o sırada kullanıcı not ekleyebilir. Sonuç =
//   bulut + günlükteki bekleyen işlemler + indirme sırasındaki `journal`.
//   `journal` şart: indirme sırasında yazılıp ONAYLANAN (günlükten silinen) bir
//   işlem, indirme daha önce okuduğu için bulut cevabında yoktur; günlükte de
//   artık yoktur — journal olmazsa yerelden kaybolurdu.

import { stripUndefined } from "./sanitize";

const EMPTY_LIST = Object.freeze([]);

/**
 * Başarısız bir ARKA PLAN denemesinden sonra yeniden denemeden önce beklenen süre.
 * Aynı alanı N bileşen mount olurken tetikleyebilir (her çan simgesi); sürekli
 * hata veren bir indirme okuma fırtınasına dönmesin diye. `force` bunu atlar.
 */
export const RETRY_COOLDOWN_MS = 30000;

/**
 * @typedef {object} KindSpec
 * @property {(uid:string)=>[string,string]} cacheKey  utils/cacheKeys anahtarı
 * @property {(doc:object)=>string|number} keyOf       belge → yerel anahtar
 * @property {(uid:string,key:string)=>string} pathOf  yerel anahtar → Firestore yolu
 * @property {(a:object,b:object)=>number} [compare]   görünüm sıralaması
 *
 * @typedef {object} DomainSpec
 * @property {string} name
 * @property {Record<string,KindSpec>} kinds
 * @property {(uid:string, remote:object)=>Promise<Record<string,object[]>>} fetchCloud
 * @property {number} [version]  veri modeli sürümü; yükselirse herkes bir kez daha doğrulanır
 */

/**
 * @param {DomainSpec} spec
 * @param {object} deps
 * @param {{seed:Function, publish:Function, dropSnapshot:Function}} deps.snapshot
 * @param {object} deps.outbox
 * @param {object} deps.remote
 * @param {(uid:string)=>void} deps.requestFlush
 * @param {(uid:string)=>boolean} deps.canFetch  çevrimiçi + oturum açık mı
 * @param {{get:Function,set:Function,clear:Function}} deps.marker  "buluttan tam
 *   doğrulandı" işareti (hydrationMarker.js)
 */
export function createUserDataDomain(spec, deps) {
  const { name, kinds } = spec;
  const kindNames = Object.keys(kinds);
  const { snapshot, outbox, remote, requestFlush, canFetch, marker } = deps;
  const version = spec.version || 1;

  /** uid → durum */
  const states = new Map();
  const listeners = new Set();

  const emptyView = Object.freeze({
    uid: null,
    ready: true,
    hydrating: false,
    waiting: false,
    error: null,
    rev: 0,
    lists: Object.freeze(Object.fromEntries(kindNames.map((k) => [k, EMPTY_LIST]))),
    get: () => undefined,
    has: () => false,
  });

  const keyOf = (kind, doc) => {
    const raw = kinds[kind].keyOf(doc);
    return raw === undefined || raw === null || raw === "" ? null : String(raw);
  };

  function emit() {
    for (const fn of Array.from(listeners)) {
      try {
        fn();
      } catch {
        // dinleyici hatası motoru düşürmesin
      }
    }
  }

  function buildView(st) {
    const lists = {};
    const frozenMaps = {};
    for (const kind of kindNames) {
      const items = Array.from(st.maps[kind].values());
      const compare = kinds[kind].compare;
      if (compare) items.sort(compare);
      lists[kind] = Object.freeze(items);
      frozenMaps[kind] = st.maps[kind];
    }
    st.rev += 1;
    return Object.freeze({
      uid: st.uid,
      ready: st.ready,
      hydrating: st.hydrating,
      // Yerel kopya yok VE indirme sürmüyor: çevrimdışı yeni cihaz / hata.
      // Arayüz "yükleniyor" değil "henüz indirilemedi" gösterebilsin diye ayrı.
      waiting: !st.ready && !st.hydrating,
      error: st.error,
      rev: st.rev,
      lists: Object.freeze(lists),
      get: (kind, key) => frozenMaps[kind]?.get(String(key)),
      has: (kind, key) => !!frozenMaps[kind]?.has(String(key)),
    });
  }

  /** Bir işlem listesini haritalara uygular (yerinde). Değişiklik oldu mu döner. */
  function applyOps(maps, ops) {
    let changed = false;
    for (const op of ops || []) {
      if (!op?.kind || !maps[op.kind]) continue;
      if (op.op === "set" && op.data) {
        maps[op.kind].set(String(op.key), op.data);
        changed = true;
      } else if (op.op === "delete") {
        changed = maps[op.kind].delete(String(op.key)) || changed;
      }
    }
    return changed;
  }

  function persist(st, onlyKinds = kindNames, immediate = false) {
    for (const kind of onlyKinds) {
      snapshot.publish(kinds[kind].cacheKey(st.uid), st.view.lists[kind], { immediate });
    }
  }

  /**
   * Yerel durumu SENKRON kurar (diskten + günlük bindirmesi). Çağrı başına
   * ucuz: ikinci çağrıdan itibaren bellekteki durum döner.
   */
  function load(uid) {
    let st = states.get(uid);
    if (st) return st;

    st = {
      uid,
      ready: false,
      // Kopya bu motorun kendi tam indirmesinden mi geldi? İşaretsiz (güncellemeden
      // gelen eski dinleyici dönemi) kopya anında GÖSTERİLİR ama bir kez doğrulanır.
      verified: false,
      lastFailureAt: 0,
      hydrating: false,
      error: null,
      rev: 0,
      maps: {},
      journal: null,
      promise: null,
      cancelled: false,
      view: null,
    };

    let allCached = true;
    for (const kind of kindNames) {
      const seeded = snapshot.seed(kinds[kind].cacheKey(uid));
      const map = new Map();
      if (seeded.hasCache && Array.isArray(seeded.data)) {
        for (const doc of seeded.data) {
          const key = doc ? keyOf(kind, doc) : null;
          if (key) map.set(key, doc);
        }
      } else {
        allCached = false;
      }
      st.maps[kind] = map;
    }
    st.ready = allCached;
    st.verified = allCached && marker.get(uid, name) === version;

    // Günlükteki onaysız işlemler yerel durumun PARÇASI: anlık görüntü
    // ertelenmiş yazıldığı için süreç ölmüşse diskten geri kalmış olabilir.
    const changed = applyOps(st.maps, outbox.overlayOps(uid, name));
    st.view = buildView(st);
    states.set(uid, st);

    // Yalnız hazırsa diske indir: hazır değilken anlık görüntü yazmak
    // "hidrate edildi" işaretini yanlış koyardı (dosyanın başındaki kural).
    if (changed && st.ready) persist(st);
    return st;
  }

  /**
   * Değişiklikleri TEK adımda uygular: yerel harita + kalıcı günlük + (hazırsa)
   * anlık görüntü + arka plan gönderimi. Hiçbir adım ağı beklemez.
   *
   * @param {string} uid
   * @param {Array<{kind:string, doc?:object, key?:string|number,
   *   remoteOps?:Array<{path:string, op:"set"|"delete", data?:object}>}>} changes
   *   `doc` verilirse yaz/güncelle, verilmezse `key` sil. `remoteOps` yalnız
   *   buluta giden, yerelde karşılığı olmayan yan yazımlar (ör. dizi belgesi).
   */
  function apply(uid, changes) {
    if (!uid || !Array.isArray(changes) || changes.length === 0) return false;
    const st = load(uid);
    const cloned = new Set();
    const ops = [];

    for (const change of changes) {
      const def = kinds[change.kind];
      if (!def) continue;
      const doc = change.doc ? stripUndefined(change.doc) : null;
      const key = doc ? keyOf(change.kind, doc) : change.key == null ? null : String(change.key);
      if (!key) continue;

      if (!cloned.has(change.kind)) {
        // Kopyala-yaz: görünümün (useSyncExternalStore) elindeki harita değişmesin.
        st.maps[change.kind] = new Map(st.maps[change.kind]);
        cloned.add(change.kind);
      }
      const path = def.pathOf(uid, key);
      if (doc) {
        st.maps[change.kind].set(key, doc);
        ops.push({ path, op: "set", data: doc, domain: name, kind: change.kind, key });
      } else {
        st.maps[change.kind].delete(key);
        ops.push({ path, op: "delete", domain: name, kind: change.kind, key });
      }
      for (const extra of change.remoteOps || []) {
        if (!extra?.path) continue;
        ops.push(
          extra.op === "set"
            ? { path: extra.path, op: "set", data: stripUndefined(extra.data) }
            : { path: extra.path, op: "delete" },
        );
      }
    }
    if (ops.length === 0) return false;

    // YAZMA-ÖNCESİ GÜNLÜK: dönmeden önce diskte (MMKV senkron).
    outbox.enqueue(uid, ops);
    if (st.journal) st.journal.push(...ops.filter((op) => op.kind));

    st.view = buildView(st);
    if (st.ready) persist(st, Array.from(cloned));
    emit();
    requestFlush(uid);
    return true;
  }

  /**
   * Buluttan TEK SEFERLİK tam indirme. Yerel kopya VAR ve bu cihazda bir kez
   * doğrulanmışsa (ve `force` değilse) hiçbir şey yapmaz — açılışta ağ
   * trafiği olmamasının garantisi budur.
   *
   * Kopya var ama doğrulanmamışsa (eski sürümden güncelleme) alan hazır
   * görünmeye DEVAM eder, indirme arka planda bir kez çalışır.
   *
   * @returns {Promise<boolean>} alan hazır mı
   */
  async function ensureHydrated(uid, { force = false } = {}) {
    if (!uid) return false;
    const st = load(uid);
    if (st.ready && st.verified && !force) return true;
    if (st.promise) return st.promise;
    // Başarısız arka plan denemesinden sonra bekle (okuma fırtınası olmasın).
    if (!force && st.lastFailureAt && Date.now() - st.lastFailureAt < RETRY_COOLDOWN_MS) {
      return st.ready;
    }
    if (!canFetch(uid)) return st.ready; // çevrimdışı / oturum henüz yok: sonra

    st.hydrating = true;
    st.error = null;
    st.journal = [];
    st.view = buildView(st);
    emit();

    st.promise = (async () => {
      try {
        const cloud = await spec.fetchCloud(uid, remote);
        if (st.cancelled) return false;

        const maps = {};
        for (const kind of kindNames) {
          const map = new Map();
          for (const doc of cloud?.[kind] || []) {
            const key = doc ? keyOf(kind, doc) : null;
            if (key) map.set(key, doc);
          }
          maps[kind] = map;
        }
        // Bulut + günlükteki bekleyenler + indirme sırasındaki yerel işlemler.
        applyOps(maps, outbox.overlayOps(uid, name));
        applyOps(maps, st.journal);

        st.maps = maps;
        st.ready = true;
        st.verified = true;
        st.lastFailureAt = 0;
        st.view = buildView(st);
        persist(st, kindNames, true);
        // İşaret, anlık görüntü diske indikten SONRA: yarım yazım "doğrulandı"
        // sayılmasın.
        marker.set(uid, name, version);
      } catch (error) {
        st.error = String(error?.code || error?.message || "hydrate-failed").slice(0, 120);
        st.lastFailureAt = Date.now();
      } finally {
        st.hydrating = false;
        st.journal = null;
        st.promise = null;
        st.view = buildView(st);
        emit();
      }
      return st.ready;
    })();
    return st.promise;
  }

  /**
   * Yerel kopyayı bulutla DEĞİŞTİRİR ("yeniden indir"). Önce günlüğü boşaltmaya
   * çalışmaz; bekleyen işlemler indirmenin üstüne bindirilir, kaybolmaz.
   */
  function resync(uid) {
    return ensureHydrated(uid, { force: true });
  }

  /**
   * Bu kullanıcının yerel kopyasını siler (çıkış). YAZMA GÜNLÜĞÜNE DOKUNMAZ:
   * onaysız değişiklik bir sonraki girişte buluta gider.
   */
  function clearLocal(uid) {
    if (!uid) return;
    const st = states.get(uid);
    if (st) st.cancelled = true;
    for (const kind of kindNames) snapshot.dropSnapshot(kinds[kind].cacheKey(uid));
    marker.clear(uid, name);
    states.delete(uid);
    emit();
  }

  function getSnapshot(uid) {
    return uid ? load(uid).view : emptyView;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    name,
    kindNames,
    getSnapshot,
    subscribe,
    apply,
    ensureHydrated,
    resync,
    clearLocal,
    /** Yalnız test/tanı. */
    __peekState: (uid) => states.get(uid),
    /** Yalnız test: süreç ölümünü taklit — bellekteki durum düşer, disk kalır. */
    __resetMemory: () => states.clear(),
  };
}

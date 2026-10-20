// utils/toastStore.js
//
// Toast'ın SAF mantığı: ne gösterilir, ne zaman gösterilir, ne zaman kapanır.
// React / React Native içermez → düğüm ortamında test edilir (bkz. __tests__/toastStore.test.js).
// Görünüm components/toast/* içindedir; bu dosya yalnız durum makinesidir.
//
// ESKİ KÜTÜPHANE (react-native-toast-message) NEDEN BIRAKILDI:
//   • Kuyruk yoktu: yeni toast görünenin metnini anında ezerdi; ardışık iki toast'tan
//     ilki okunamadan kaybolurdu (kendi kaynağında "TODO: use a queue").
//   • Animasyon RN Animated ile, Android'de JS iş parçacığında (useNativeDriver: false):
//     JS meşgulken (liste yükleme, TMDB) kare atlıyordu.
//   • Tek örnek kökte durur; iOS/Android native Modal'ın ARKASINDA kalırdı, yani her
//     alt sayfadan (BottomSheetModal) verilen toast görünmezdi.
//   • Aynı toast art arda gelince (hızlı dokunuş) üst üste yığılır, süre uzamazdı.
//
// MODEL
//   • Tek görünür toast + sınırlı bekleme kuyruğu.
//   • Yeni toast, görünenden ÖNCELİKLİYSE (ya da görünen asgari süresini doldurduysa)
//     onun yerini alır; değilse sırada bekler. Hata > uyarı > başarı > bilgi; rozet/premium
//     kutlamaları en üstte ve en az 2,4 sn ekranda kalır.
//   • Aynı içerik (aynı anahtar) görünürken tekrar gelirse yeni toast AÇILMAZ: süre
//     yenilenir, sayaç artar (×2) ve son verilen eylem/dokunuş işleyicisi geçerli olur.
//   • Süre okuma süresine göre hesaplanır (kısa metin kısa, uzun metin uzun); eylem
//     düğmesi ("Geri Al") varsa en az 6 sn.
//   • Birden çok "host" olabilir: kökteki ve her native Modal'ın içindeki. Toast, en son
//     kaydolan (en üstteki) host'ta çizilir; modal kapanınca bir önceki host devralır.

/** Tür kayıt defteri. `priority` yüksek olan düşüğün yerini asgari süre beklemeden alır. */
export const TOAST_KINDS = Object.freeze({
  success: { priority: 2, durationScale: 1, minVisibleMs: 700, haptic: null },
  error: { priority: 4, durationScale: 1.25, minVisibleMs: 900, haptic: "error" },
  warning: { priority: 3, durationScale: 1.15, minVisibleMs: 800, haptic: "warning" },
  info: { priority: 1, durationScale: 1, minVisibleMs: 700, haptic: null },
  // Yükleniyor: kendiliğinden kapanmaz; `update(id, …)` sonucu gösterir. Başka her toast
  // onun yerini alabilir (öncelik en düşük) — işlem bitince sonuç yine ayrı toast olur.
  loading: { priority: 1, durationScale: 1, minVisibleMs: 400, haptic: null, sticky: true },
  // Kutlamalar: bildirimden uzun kalır, sıradan toast üstüne binmez.
  badge: { priority: 5, durationScale: 1, minVisibleMs: 2400, haptic: "success", fixedMs: 5200 },
  premium: { priority: 5, durationScale: 1, minVisibleMs: 2400, haptic: "success", fixedMs: 5600 },
});

export const DEFAULT_KIND = "info";

// Zamanlama sabitleri (ms).
export const EXIT_GAP_MS = 170; // bir toast kapandıktan sonra sıradakinin açılış gecikmesi
export const QUEUE_MAX = 4;
export const QUEUE_TTL_MS = 9000; // sırada bu kadar bekleyen toast bayatlar, atılır
export const STICKY_MAX_LIFE_MS = 60000; // "yükleniyor" asılı kalırsa güvenlik kapısı
export const MIN_RESUME_MS = 1400; // basılı tutulduktan sonra kalan süre en az bu kadar
const MIN_DURATION_MS = 2400;
const MAX_DURATION_MS = 6500;
const ACTION_MIN_MS = 6000;
const TEXT_MAX = 240;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Düz yazıya çevirir: undefined/boş → "", Error → mesajı, fazla boşluk tek boşluk. */
export function cleanToastText(value, max = TEXT_MAX) {
  if (value == null) return "";
  let text = value;
  if (typeof text === "object") text = text.message ?? "";
  text = String(text).replace(/\s+/g, " ").trim();
  if (text.length > max) text = `${text.slice(0, max - 1).trimEnd()}…`;
  return text;
}

/** Okuma süresi: kısa metne kısa, uzun metne uzun süre. */
export function readingDurationMs(title, message) {
  const length = (title ? title.length : 0) + (message ? message.length : 0);
  return clamp(Math.round(1900 + length * 38), MIN_DURATION_MS, MAX_DURATION_MS);
}

/** Eylem düğmesi: { label, onPress, icon? }; etiketsiz eylem yok sayılır. */
export function normalizeAction(action) {
  if (!action || typeof action !== "object") return null;
  const label = cleanToastText(action.label, 24);
  if (!label) return null;
  return {
    label,
    onPress: typeof action.onPress === "function" ? action.onPress : null,
    icon: typeof action.icon === "string" ? action.icon : null,
  };
}

/**
 * Hem ESKİ (`{ type, text1, text2, visibilityTime, onPress, props: { action } }` —
 * react-native-toast-message imzası) hem YENİ (`{ kind, title, message, duration,
 * action }`) girdiyi tek biçime getirir. Gösterilecek metin yoksa `null`.
 */
export function normalizeToast(input, id) {
  const raw = input && typeof input === "object" ? input : {};
  const props = raw.props && typeof raw.props === "object" ? raw.props : {};

  const kindName = String(raw.kind ?? raw.type ?? DEFAULT_KIND);
  const kind = TOAST_KINDS[kindName] ? kindName : DEFAULT_KIND;
  const def = TOAST_KINDS[kind];

  let title = cleanToastText(raw.title ?? raw.text1, 120);
  let message = cleanToastText(raw.message ?? raw.text2);
  if (!title && message) {
    title = message;
    message = "";
  }
  if (title && message === title) message = "";
  if (!title) return null;

  const action = normalizeAction(raw.action ?? props.action);

  // Süre: açık değer > kutlama sabiti > okuma süresi. `null` = kendiliğinden kapanmaz.
  const explicit = raw.duration ?? raw.visibilityTime;
  let durationMs;
  if (raw.autoHide === false || raw.sticky === true || explicit === Infinity) {
    durationMs = null;
  } else if (Number.isFinite(explicit)) {
    durationMs = clamp(explicit, 800, 30000);
  } else if (def.sticky) {
    durationMs = null;
  } else if (def.fixedMs) {
    durationMs = def.fixedMs;
  } else {
    durationMs = Math.round(readingDurationMs(title, message) * def.durationScale);
    if (action) durationMs = Math.max(durationMs, ACTION_MIN_MS);
  }

  // Rozet kartı verisi (`gorunum`, `ek`, `ipucu`) ve her türün serbest verisi:
  // eylem ayrı alana alındığı için `props`un kalanı `data`dır.
  const { action: _legacyAction, ...data } = props;

  let haptic = def.haptic;
  if (raw.haptic === false) haptic = null;
  else if (typeof raw.haptic === "string") haptic = raw.haptic;
  else if (raw.haptic === true && !haptic) haptic = "success";

  return {
    id,
    key: raw.key != null ? String(raw.key) : `${kind}|${title}|${message}`,
    kind,
    title,
    message,
    action,
    icon: typeof raw.icon === "string" ? raw.icon : null,
    data,
    durationMs,
    priority: def.priority,
    minVisibleMs: def.minVisibleMs,
    haptic,
    swipeable: raw.swipeable !== false,
    onPress: typeof raw.onPress === "function" ? raw.onPress : null,
    onShow: typeof raw.onShow === "function" ? raw.onShow : null,
    onHide: typeof raw.onHide === "function" ? raw.onHide : null,
  };
}

function safely(fn, ...args) {
  if (typeof fn !== "function") return;
  try {
    fn(...args);
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[toast] callback:", error?.message);
  }
}

/**
 * Toast deposu. `deps` yalnız testler için (sahte saat/zamanlayıcı).
 *
 * Görünür durum `getSnapshot()` ile okunur (React `useSyncExternalStore` uyumlu:
 * değişmedikçe AYNI nesne döner). Anlık anlık değişen şeyler (kalan süre) anlık
 * görüntüde YOKTUR; çizim tarafı `pause`/`resume`un döndürdüğü değeri kullanır.
 */
export function createToastStore(deps = {}) {
  // Saat ve zamanlayıcılar ÇAĞRI ANINDA çözülür (yakalanmaz): testler sahte zamanlayıcıyı
  // depo yüklendikten sonra kurabilsin.
  const now = () => (deps.now ? deps.now() : Date.now());
  const setT = (fn, ms) => (deps.setTimeout || setTimeout)(fn, ms);
  const clearT = (handle) => (deps.clearTimeout || clearTimeout)(handle);

  let seq = 0;
  let rev = 0;
  let current = null; // gösterilen toast (+ çalışma alanları)
  let queue = []; // { toast, at }
  let hosts = [];
  let life = null; // { handle, startedAt, remaining, paused }
  let gateHandle = null; // asgari süre dolunca beklemekte olanı öne alır
  let gapHandle = null; // kapanış ile sıradaki açılış arasındaki boşluk
  let durationScale = 1;
  let effects = {};
  let snapshot = buildSnapshot();
  const listeners = new Set();

  function buildSnapshot() {
    return {
      toast: current,
      queued: queue.length,
      hostId: hosts.length ? hosts[hosts.length - 1] : null,
      rev,
    };
  }

  function emit() {
    rev += 1;
    snapshot = buildSnapshot();
    listeners.forEach((listener) => listener());
  }

  // ── Ömür zamanlayıcısı ──────────────────────────────────────────────────
  function clearLife() {
    if (life) clearT(life.handle);
    life = null;
  }

  function startLife(toast, ms) {
    clearLife();
    if (ms == null) {
      // Asılı kalan "yükleniyor"a güvenlik kapısı.
      ms = STICKY_MAX_LIFE_MS;
    } else {
      ms = Math.max(1, Math.round(ms * durationScale));
    }
    const id = toast.id;
    life = {
      handle: setT(() => dismiss(id, "timeout"), ms),
      startedAt: now(),
      remaining: ms,
      paused: false,
    };
  }

  function clearGate() {
    if (gateHandle != null) clearT(gateHandle);
    gateHandle = null;
  }

  function clearGap() {
    if (gapHandle != null) clearT(gapHandle);
    gapHandle = null;
  }

  // ── Gösterme / bitirme ──────────────────────────────────────────────────
  function present(toast) {
    const runtime = {
      ...toast,
      shownAt: now(),
      // Çizim tarafı ilerleme çubuğunu `resumeFrom / totalMs` oranından başlatır
      // (bump/host devrinde oran 1'den küçük olabilir). Süre çarpanı uygulanmış değerler.
      totalMs: toast.durationMs == null ? null : Math.round(toast.durationMs * durationScale),
      resumeFrom: toast.durationMs == null ? null : Math.round(toast.durationMs * durationScale),
      count: 1,
    };
    current = runtime;
    startLife(runtime, toast.durationMs);
    safely(effects.onPresent, runtime);
    safely(runtime.onShow);
  }

  function finish(toast, reason) {
    clearLife();
    safely(toast.onHide, reason);
  }

  function pruneQueue() {
    const cutoff = now() - QUEUE_TTL_MS;
    queue = queue.filter((entry) => entry.at >= cutoff);
  }

  function enqueue(toast) {
    // Aynı anahtarlı bekleyen varsa en yeni hâliyle değiştir (sıradaki yerini korur).
    const existing = queue.findIndex((entry) => entry.toast.key === toast.key);
    if (existing >= 0) {
      queue[existing] = { toast: { ...toast, id: queue[existing].toast.id }, at: now() };
      return queue[existing].toast.id;
    }
    queue.push({ toast, at: now() });
    while (queue.length > QUEUE_MAX) {
      // En düşük öncelikliyi (eşitlikte en eskiyi) at.
      let drop = 0;
      for (let i = 1; i < queue.length; i += 1) {
        if (queue[i].toast.priority < queue[drop].toast.priority) drop = i;
      }
      const [removed] = queue.splice(drop, 1);
      safely(removed.toast.onHide, "dropped");
    }
    return toast.id;
  }

  // Sıradan bir sonrakini seç: en yüksek öncelik; ≥3 olanlar FIFO (hiçbir hata/uyarı
  // kaybolmasın), düşük öncelikliler "en yeni kazanır" (art arda gelen bilgi/başarı
  // toast'larının yalnız sonuncusu anlamlı) ve aynı öncelikteki eskileri atılır.
  // `minPriority`: yalnız bu öncelik ve üstündekiler adaydır (asgari süre sonrası öne
  // alma, görünenden DÜŞÜK öncelikliyi görünenin üstüne çıkarmamalı).
  function takeNext(minPriority = 0) {
    pruneQueue();
    let best = -1;
    for (let i = 0; i < queue.length; i += 1) {
      const a = queue[i].toast;
      if (a.priority < minPriority) continue;
      if (best < 0) {
        best = i;
        continue;
      }
      const b = queue[best].toast;
      if (a.priority > b.priority) best = i;
      else if (a.priority === b.priority && a.priority < 3) best = i; // en yeni
    }
    if (best < 0) return null;
    const [picked] = queue.splice(best, 1);
    if (picked.toast.priority < 3) {
      queue = queue.filter((entry) => {
        if (entry.toast.priority !== picked.toast.priority) return true;
        safely(entry.toast.onHide, "dropped");
        return false;
      });
    }
    return picked.toast;
  }

  function scheduleNext() {
    clearGap();
    if (!queue.length) return;
    gapHandle = setT(() => {
      gapHandle = null;
      if (current) return;
      const next = takeNext();
      if (next) {
        present(next);
        emit();
      }
    }, EXIT_GAP_MS);
  }

  // Görünen toast'ın asgari süresi dolunca bekleyen EŞİT öncelikliyi öne al. Düşük
  // öncelikli olan görünen kendiliğinden kapanana kadar bekler (hata okunurken
  // araya "Kaydedildi" girmesin); yüksek olan zaten beklemeden geçmişti.
  function scheduleGate() {
    clearGate();
    if (!current || !queue.some((entry) => entry.toast.priority >= current.priority)) return;
    const wait = Math.max(0, current.minVisibleMs - (now() - current.shownAt));
    gateHandle = setT(() => {
      gateHandle = null;
      if (!current) return;
      const next = takeNext(current.priority);
      if (!next) return;
      const old = current;
      finish(old, "replaced");
      present(next);
      emit();
      scheduleGate();
    }, wait + 1);
  }

  // Yeni gelen toast görünenin üstüne hemen çıkar mı?
  //   • daha önemliyse: evet
  //   • eşitse: görünenin asgari süresi dolmuşsa evet (en yeni kazanır)
  //   • daha önemsizse: hayır, görünen bitince sırayla gösterilir
  function shouldWait(next) {
    if (!current) return false;
    if (next.priority > current.priority) return false;
    if (next.priority < current.priority) return true;
    return now() - current.shownAt < current.minVisibleMs;
  }

  // ── Genel API ───────────────────────────────────────────────────────────
  function show(input) {
    const requestedId = input && typeof input === "object" && input.id != null ? String(input.id) : null;
    const toast = normalizeToast(input, requestedId || `t${(seq += 1)}`);
    if (!toast) return null;

    if (current) {
      // Aynı kimlik: yerinde güncelle.
      if (requestedId && current.id === requestedId) return applyToCurrent(toast, { restart: true });
      // Aynı içerik zaten ekranda: yeni toast açma, sayacı artır.
      if (!requestedId && current.key === toast.key) return applyToCurrent(toast, { bump: true });
    }
    if (requestedId) {
      const queued = queue.findIndex((entry) => entry.toast.id === requestedId);
      if (queued >= 0) {
        queue[queued] = { toast, at: now() };
        return requestedId;
      }
    }

    if (!current) {
      clearGap();
      present(toast);
      emit();
      return toast.id;
    }

    if (shouldWait(toast)) {
      const id = enqueue(toast);
      emit();
      scheduleGate();
      return id;
    }

    const old = current;
    finish(old, "replaced");
    present(toast);
    emit();
    scheduleGate();
    return toast.id;
  }

  function applyToCurrent(next, { bump = false, restart = false } = {}) {
    const previous = current;
    const kindChanged = previous.kind !== next.kind;
    current = {
      ...previous,
      ...next,
      id: previous.id,
      shownAt: previous.shownAt,
      count: bump ? previous.count + 1 : 1,
      totalMs: next.durationMs == null ? null : Math.round(next.durationMs * durationScale),
      resumeFrom: next.durationMs == null ? null : Math.round(next.durationMs * durationScale),
    };
    startLife(current, next.durationMs);
    if (kindChanged || restart) safely(effects.onPresent, current);
    emit();
    return current.id;
  }

  /** Var olan toast'ı yerinde değiştirir; ekranda/sırada yoksa yeni toast olarak açar. */
  function update(id, patch) {
    if (id == null) return null;
    const key = String(id);
    if (current && current.id === key) {
      // Tür değişirse (yükleniyor → başarı/hata) yeni türün kendi titreşimi geçerli
      // olsun; aynı türde güncellemede ilk titreşim tercihi korunur.
      const sameKind = patch?.kind == null && patch?.type == null
        ? true
        : (patch.kind ?? patch.type) === current.kind;
      const merged = normalizeToast(
        {
          kind: current.kind,
          title: current.title,
          message: current.message,
          action: current.action,
          icon: current.icon,
          props: current.data,
          ...(sameKind ? { haptic: current.haptic ?? false } : null),
          onPress: current.onPress,
          onHide: current.onHide,
          ...patch,
        },
        key,
      );
      if (!merged) return key;
      return applyToCurrent(merged, { restart: true });
    }
    const queued = queue.findIndex((entry) => entry.toast.id === key);
    if (queued >= 0) {
      const base = queue[queued].toast;
      const merged = normalizeToast(
        {
          kind: base.kind,
          title: base.title,
          message: base.message,
          action: base.action,
          props: base.data,
          ...patch,
        },
        key,
      );
      if (merged) queue[queued] = { toast: merged, at: now() };
      emit();
      return key;
    }
    return show({ ...patch, id: key });
  }

  /** Görünen (ya da `id`li) toast'ı kapatır; sırada bekleyen varsa gösterilir. */
  function dismiss(id, reason = "api") {
    const key = id == null ? null : String(id);
    if (current && (key == null || current.id === key)) {
      const old = current;
      current = null;
      clearGate();
      finish(old, reason);
      emit();
      scheduleNext();
      return true;
    }
    if (key != null) {
      const queued = queue.findIndex((entry) => entry.toast.id === key);
      if (queued >= 0) {
        const [removed] = queue.splice(queued, 1);
        safely(removed.toast.onHide, "cancelled");
        emit();
        return true;
      }
    }
    return false;
  }

  /** Görünen ve bekleyen her şeyi kaldırır. */
  function clear() {
    clearGate();
    clearGap();
    const waiting = queue;
    queue = [];
    waiting.forEach((entry) => safely(entry.toast.onHide, "cancelled"));
    if (current) {
      const old = current;
      current = null;
      finish(old, "cleared");
    }
    emit();
  }

  /**
   * Parmak kartın üstündeyken süre akmasın. Kalan süreyi (ms) döndürür; çizim
   * tarafı ilerleme çubuğunu dondurur.
   */
  function pause(id) {
    if (!current || !life || life.paused) return null;
    if (id != null && current.id !== String(id)) return null;
    clearT(life.handle);
    life.remaining = Math.max(0, life.remaining - (now() - life.startedAt));
    life.paused = true;
    return life.remaining;
  }

  /** Bırakınca kalan süreyi (en az MIN_RESUME_MS) yeniden başlatır; yeni kalanı döndürür. */
  function resume(id) {
    if (!current || !life || !life.paused) return null;
    if (id != null && current.id !== String(id)) return null;
    const remaining = Math.max(life.remaining, MIN_RESUME_MS);
    const toastId = current.id;
    life = {
      handle: setT(() => dismiss(toastId, "timeout"), remaining),
      startedAt: now(),
      remaining,
      paused: false,
    };
    // Kalıcı ("yükleniyor") toast'ta ilerleme çubuğu yok; dönüş değeri anlamsız.
    return current.resumeFrom == null ? null : remaining;
  }

  // ── Host kaydı ──────────────────────────────────────────────────────────
  /** Bir host (kök ya da modal içi) kaydolur; kayıt iptali fonksiyonunu döndürür. */
  // Host değişince devralan host'taki ilerleme çubuğu kalan süreden başlasın.
  function refreshResumeFrom() {
    if (!current || !life || current.resumeFrom == null) return;
    const left = life.paused ? life.remaining : Math.max(0, life.remaining - (now() - life.startedAt));
    current = { ...current, resumeFrom: Math.max(1, Math.round(left)) };
  }

  function registerHost(hostId) {
    const key = String(hostId);
    hosts = hosts.filter((h) => h !== key).concat(key);
    refreshResumeFrom();
    emit();
    return () => {
      const before = hosts.length;
      hosts = hosts.filter((h) => h !== key);
      if (hosts.length !== before) {
        refreshResumeFrom();
        emit();
      }
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Erişilebilirlik (ekran okuyucu) açıkken süreleri uzatmak için. */
  function setDurationScale(scale) {
    durationScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  /** `{ onPresent(toast) }` — bir toast SIRA ALDIĞINDA tam bir kez (titreşim, duyuru). */
  function setEffects(next) {
    effects = next || {};
  }

  return {
    show,
    update,
    dismiss,
    clear,
    pause,
    resume,
    registerHost,
    subscribe,
    getSnapshot: () => snapshot,
    setDurationScale,
    setEffects,
  };
}

/** Uygulamanın tek deposu. */
export const toastStore = createToastStore();

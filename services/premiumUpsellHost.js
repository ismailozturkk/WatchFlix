// services/premiumUpsellHost.js
//
// Premium yükseltme sayfasını (components/premium/PremiumUpsellSheet.js)
// React DIŞINDAN açabilmek için ince imperatif köprü — AppAlert ile aynı desen:
// kapılar (hooks/usePremiumGate.js) bir bileşen ağacında olmayabilir, ama tek
// bir `<PremiumUpsellHost />` App.js'te asılıdır ve buradan gelen istekleri çizer.
//
// Host henüz mount olmadıysa (açılışta erken bir kapı) istekler kuyruğa alınır
// ve host hazır olunca sırayla verilir; hiçbiri kaybolmaz.
//
// Saf modül: RN/React importu yok (jest doğrudan test eder).

let listener = null;
const queue = [];

/**
 * @typedef {object} UpsellRequest
 * @property {string} featureId   utils/premiumFeatures.js kimliği
 * @property {string} plan        kullanıcının mevcut planı
 * @property {number} [used]      sayılı özellikte sahip olunan adet / günlük kullanım
 * @property {() => void} [onUpgrade]  "Planları gör"e basılınca (sayfa kapandıktan sonra)
 * @property {() => void} [onDismiss]  "Şimdi değil" / dışarı dokunuş / geri
 */

/** Yükseltme sayfasını göster. */
export function presentUpsell(request) {
  if (!request || !request.featureId) return;
  if (listener) listener(request);
  else queue.push(request);
}

/**
 * Host'u kaydeder. Kuyrukta bekleyen istekler SIRAYLA host'a verilir (host kendi
 * içinde görünür olanın arkasına dizer). Geri dönen fonksiyon kaydı kaldırır.
 */
export function registerUpsellHost(fn) {
  listener = fn;
  while (queue.length) fn(queue.shift());
  return () => {
    if (listener === fn) listener = null;
  };
}

/**
 * Aynı sayfayı isteyen ikinci isteği birincisine katar (bkz. upsellKeyFor):
 * görünen alan birincinin, callback'ler ikisinin de — sırayla çalışır. Böylece
 * ekran kapısının "geri dön"ü kaybolmaz, ama kullanıcı iki sayfa görmez.
 *
 * @param {UpsellRequest} base
 * @param {UpsellRequest} extra
 * @returns {UpsellRequest}
 */
export function mergeUpsellRequests(base, extra) {
  const chain = (first, second) =>
    first && second
      ? () => {
          first();
          second();
        }
      : first || second;
  return {
    ...base,
    onUpgrade: chain(base.onUpgrade, extra.onUpgrade),
    onDismiss: chain(base.onDismiss, extra.onDismiss),
  };
}

/**
 * "Önce pencere kalksın, SONRA devam et" kapısı. iOS kapanmakta olan bir Modal'ın
 * üstüne ikincisini sunamaz (ekran kilitlenmiş gibi kalır); bu yüzden sayfa
 * kapanırken çağıranın callback'i ve sıradaki istek, pencere gerçekten kalktığı
 * bildirilince (`finish`) çalışır.
 *
 * Bildirim hiç gelmezse (beklenmedik bir durumda) `fallbackMs` sonra aynı devam
 * eder: host sonsuza dek kilitli kalmaz. `finish` birden çok kez çağrılabilir;
 * iş yalnız bir kez çalışır.
 *
 * @param {number} fallbackMs
 * @returns {{ begin: (next: () => void) => void, finish: () => void, cancel: () => void }}
 */
export function createCloseGate(fallbackMs) {
  let pending = null;
  let timer = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const finish = () => {
    const next = pending;
    if (!next) return;
    pending = null;
    clear();
    next();
  };

  return {
    /** Kapanış başladı: `next`, `finish` ya da yedek süre dolunca çalışır. */
    begin(next) {
      clear();
      pending = next;
      timer = setTimeout(finish, fallbackMs);
    },
    finish,
    /** Bekleyen işi çalıştırmadan bırakır (host kaldırılırken). */
    cancel() {
      pending = null;
      clear();
    },
  };
}

/** Test yardımcısı. */
export function __resetUpsellHostForTests() {
  listener = null;
  queue.length = 0;
}

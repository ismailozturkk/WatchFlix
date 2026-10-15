// utils/entranceGate.js
//
// "İlk yükleme" giriş animasyonu penceresi (saf JS — RN import'u yok).
//
// Sorun: StaggerItem her bağlanışında (mount) animasyon oynatır. Izgara listeleri
// ise ilk açılıştan SONRA da öğe bağlar: arama yazılınca / filtre değişince
// satırların anahtarı değişip yeniden bağlanır, kaydırınca pencereye yeni
// satırlar girer. Hepsinde animasyon oynarsa her tuş vuruşunda posterler yeniden
// solar ve kaydırırken boşluklar görünür.
//
// Çözüm: veri hazır olduğu andan itibaren kısa bir pencere açık tutulur; yalnız
// bu pencerede bağlanan öğeler animasyonlu girer, pencere kapandıktan sonra
// bağlananlar doğrudan tam görünür çizilir. Pencere ekran ömründe BİR kez düşer.
//
// Kullanım: hooks/useEntranceGate.js

// Animasyonun toplamı (en geç gecikme + süre) ≈ 480 + 360 ms; pencere bunu
// ve ilk satır grubunun bağlanma gecikmesini rahat karşılar.
export const ENTRANCE_WINDOW_MS = 1100;

export function createEntranceGate(windowMs = ENTRANCE_WINDOW_MS) {
  let closed = false;
  let timer = null;

  return {
    // Pencereyi başlatır. Tekrar çağrılırsa (ready birkaç kez döner) süre
    // uzamaz; kapandıktan sonra hiçbir şey yapmaz.
    start() {
      if (closed || timer) return;
      timer = setTimeout(() => {
        closed = true;
        timer = null;
      }, windowMs);
    },
    // Ekrandan çıkarken zamanlayıcıyı bırakır. Pencereyi KAPATMAZ: geliştirme
    // modunda efektler "bağla → temizle → bağla" çalışır, ikincisi start() ile
    // yeniden zamanlayabilmeli.
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
    isOpen() {
      return !closed;
    },
  };
}

// Öğe sırasından kademeli gecikme indeksi: ızgarada soldan sağa, yukarıdan
// aşağı dalga. StaggerItem `maxStaggered` ile üst sınırı zaten uygular.
export function gridEntranceIndex(rowIndex, colIndex, columns) {
  const r = Number.isFinite(rowIndex) && rowIndex > 0 ? rowIndex : 0;
  const c = Number.isFinite(colIndex) && colIndex > 0 ? colIndex : 0;
  const cols = Number.isFinite(columns) && columns > 0 ? columns : 1;
  return r * cols + c;
}

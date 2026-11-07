// utils/measureWindowRect.js
//
// Bir native görünümün pencere koordinatlarındaki dikdörtgenini ölçer.
// Galeri "paylaşılan öğe" geçişi bunu kullanır: dokunulan afiş / arka plan
// nereden kalktıysa galeri görseli oradan uçarak açılır, kapanınca oraya döner
// (bkz. components/modals/ImageGalleryModal.js).
//
// Ölçüm başarısızsa (görünüm yok, ekran dışı, sıfır boyut) `null` döner —
// çağıran taraf düz solma geçişine düşer, hiçbir şey kırılmaz.

/**
 * @param {any} node  `ref.current` (View / Animated.View; `collapsable={false}` olmalı)
 * @param {(rect: {x:number,y:number,width:number,height:number}|null) => void} callback
 */
export function measureWindowRect(node, callback) {
  if (!node || typeof node.measureInWindow !== "function") {
    callback(null);
    return;
  }
  try {
    node.measureInWindow((x, y, width, height) => {
      const ok = [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
      callback(ok ? { x, y, width, height } : null);
    });
  } catch {
    callback(null);
  }
}

/** Pencere koordinatındaki dikdörtgeni başka bir pencere dikdörtgenine göreli yapar. */
export function relativeRect(rect, container) {
  if (!rect) return null;
  return {
    x: rect.x - (container?.x || 0),
    y: rect.y - (container?.y || 0),
    width: rect.width,
    height: rect.height,
  };
}

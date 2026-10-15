// utils/nativeSwitchLayout.js
//
// iOS'taki SİSTEM anahtarının (UISwitch) yerleşim kutusunu `size` prop'una
// oturtan SAF hesap. RN/Expo importu YOK — jest yalnız saf JS modüllerini
// çalıştırır; çizen bileşen components/SwitchToggle.js.
//
// ── NEDEN GEREKLİ ────────────────────────────────────────────────────────────
//
// Özel (Android) anahtar `size × size*1.61` bir kutudur ve ekranlar o orana göre
// kurulu. Sistem anahtarı ise sabit oranlı değil: iOS 18–25'te 51×31, Liquid Glass
// gelen iOS 26+'da belirgin biçimde DAHA GENİŞ (≈63×28). Eski kod anahtarı tek
// ölçekle (`size/31`) büyütüp kutuyu yine `size*1.61` bıraktığı için `transform`
// yerleşimi etkilemediğinden anahtar kutusundan yanlara taşıyor, yanındaki metni
// ya da kart kenarını eziyordu.
//
// Çare: kutu anahtarın GERÇEK (ölçekli) boyunu bildirsin, ölçek de hem yüksekliğe
// hem GENİŞLİK bütçesine sığacak biçimde seçilsin.

/** RN'nin ölçtüğü kutu genişliğine kattığı pay (RN: "Apple borders'ı hesaba katmıyor"). */
export const SWITCH_BOX_PAD = 2;

/** iOS 18–25 UISwitch: 51×31 (+RN payı). */
export const CLASSIC_SWITCH_BOX = { width: 51 + SWITCH_BOX_PAD, height: 31 };

/**
 * iOS 26+ (Liquid Glass) UISwitch: ≈63×28 (+RN payı). Cihazda ölçülemediği için
 * YALNIZ ilk çizimdeki tahmin; bileşen `onLayout` ile gerçek değeri okuyup
 * bunun yerine koyar, yani tahmin yanlışsa yalnız ilk kare yanlış durur.
 */
export const GLASS_SWITCH_BOX = { width: 63 + SWITCH_BOX_PAD, height: 28 };

/**
 * Ölçeklenmiş anahtarın genişliği `size` ile bu oranın çarpımını aşmaz.
 * Özel anahtar 1.61 idi; sistem anahtarının doğal oranı daha geniş olduğundan
 * 1.75 tanınır (size 36 → en çok 63 pt = iOS 26'nın doğal genişliği).
 */
export const MAX_SWITCH_ASPECT = 1.75;

/** `Platform.Version` ("26.0", "18.5" ya da sayı) → ana sürüm; okunamazsa 0. */
export function iosMajorVersion(version) {
  const major = parseInt(String(version ?? ""), 10);
  return Number.isFinite(major) ? major : 0;
}

/** Ölçüm gelene kadar kullanılacak tahmini yerleşim kutusu. */
export function guessNativeSwitchBox(iosMajor) {
  return iosMajor >= 26 ? GLASS_SWITCH_BOX : CLASSIC_SWITCH_BOX;
}

function usable(box) {
  return !!box && Number.isFinite(box.width) && Number.isFinite(box.height) && box.width > 0 && box.height > 0;
}

/**
 * @param {object} girdi
 * @param {number} girdi.size            İstenen anahtar yüksekliği (özel anahtarla aynı anlam)
 * @param {{width:number,height:number}} [girdi.native] Sistem anahtarının ÖLÇÜLEN yerleşim kutusu
 * @returns {{scale:number, width:number, height:number, boxHeight:number}}
 *   `width`/`height` ölçeklenmiş anahtarın gerçek boyu; `boxHeight` satır yüksekliğini
 *   özel anahtarla aynı tutmak için en az `size`. Dış kutu `width × boxHeight` olmalı.
 */
export function planNativeSwitch({ size, native } = {}) {
  const box = usable(native) ? native : CLASSIC_SWITCH_BOX;
  const target = Number.isFinite(size) && size > 0 ? size : 36;
  const scale = Math.min(target / box.height, (target * MAX_SWITCH_ASPECT) / box.width);
  const width = box.width * scale;
  const height = box.height * scale;
  return { scale, width, height, boxHeight: Math.max(target, height) };
}

/** İki ölçü, ihmal edilebilir fark içinde aynı mı (onLayout → state döngüsünü keser). */
export function sameSwitchBox(a, b) {
  if (!usable(a) || !usable(b)) return false;
  return Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

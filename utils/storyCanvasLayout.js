// utils/storyCanvasLayout.js
//
// Story tasarım ekranının (screens/story/StoryShareScreen.js) ölçü matematiği.
// Saf JS — RN importu yok, jest'te doğrudan test edilir.
//
// NEDEN var: ekran eskiden tuval boyutunu modül yüklenirken Dimensions + sabit
// header/alt çubuk yüksekliğiyle hesaplıyordu. Gerçek alt çubuk (home
// indicator / 3 tuşlu navigasyon dolgusuyla) sabit 100px'den uzundu; tuval
// çubuğun altına taşıyordu. Yazı boyutu/dolgu/köşe sabit pikseldi ama konumlar
// tuval oranıydı; küçük telefonda başlık daha çok satıra bölünüp alttaki
// satırın üstüne biniyordu. Burada ölçüler EKRANDAN ölçülen alana göre
// hesaplanır ve içerik tek bir referans genişliğe göre ölçeklenir.

/** İçerik boyutlarının (yazı, dolgu, köşe, filigran) tasarlandığı tuval genişliği. */
export const STORY_REF_W = 360;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Ölçülen boş alana (header ile alt çubuk arası) sığan 9:16 tuval.
 * Genişlik ve yükseklikten hangisi kısıtlıyorsa o belirler; oran hiç bozulmaz.
 */
export function fitStoryCanvas(
  areaW,
  areaH,
  { sidePad = 16, topGap = 16, bottomGap = 12, minW = 120 } = {}
) {
  const availW = Math.max(0, areaW - sidePad * 2);
  const availH = Math.max(0, areaH - topGap - bottomGap);
  let w = availW;
  let h = (w * 16) / 9;
  if (h > availH) {
    h = availH;
    w = (h * 9) / 16;
  }
  w = Math.max(minW, Math.floor(w));
  h = Math.floor((w * 16) / 9);
  return { w, h };
}

/** Tuval genişliğinden içerik ölçeği (1 = referans genişlik). */
export function storyScale(canvasW) {
  return clamp(canvasW / STORY_REF_W, 0.6, 1.5);
}

/**
 * Ayar sayfası açıkken tuvalin küçülme oranı ve sayfanın konumu.
 * Sayfa en az `minSheetH` yüksekliğinde kalır; kısa ekranda tuval daha çok
 * küçülür (alt sınır `minShrink`), uzun ekranda tercih edilen orana döner.
 */
export function planStorySheet({
  areaY,
  topGap,
  canvasH,
  containerH,
  preferredShrink = 0.5,
  minShrink = 0.3,
  minSheetH = 320,
  gap = 16,
}) {
  const fixed = areaY + topGap + gap;
  const maxShrink =
    canvasH > 0 ? (containerH - minSheetH - fixed) / canvasH : preferredShrink;
  const shrink = clamp(
    Math.min(preferredShrink, maxShrink),
    minShrink,
    preferredShrink
  );
  const sheetTop = fixed + Math.round(canvasH * shrink);
  return { shrink, sheetTop, sheetH: containerH - sheetTop };
}

/**
 * Klavye açıkken sayfayı klavyenin üstüne oturtur. `visibleH` kök görünümün
 * klavyeyle örtüşmeyen yüksekliği; sayfa görünür alanda en az `minSheetH`
 * kalacak kadar yukarı çıkar (tuvalin bir kısmını örtebilir) ve altı
 * klavyenin üst kenarına dayanır.
 */
export function liftSheetForKeyboard({
  sheetTop,
  containerH,
  visibleH,
  minSheetH = 300,
  minTop = 0,
}) {
  const vis = clamp(visibleH, 0, containerH);
  const top = clamp(
    Math.min(sheetTop, vis - minSheetH),
    minTop,
    Math.max(minTop, sheetTop)
  );
  return { top, bottom: containerH - vis };
}

/**
 * Varsayılan içerik bloklarını (poster + yazılar) üst üste binmeden alt alta
 * dizer. `items`: [{ id, h, flex? }] — h ölçülmüş piksel yüksekliği, flex
 * işaretli blok (poster) sığmayınca küçülebilir. Dönen `tops` piksel cinsinden
 * üst kenarlardır; `resized` küçülen bloğun yeni yüksekliği.
 *
 * Yığın dikeyde ortalanır (`bias` < 0.5 → biraz yukarı kayık), alt/üst
 * kenar boşlukları korunur (alt boşluk filigranı içerir).
 */
export function stackBlocksVertically(
  items,
  canvasH,
  { gap = 10, marginTop = 0, marginBottom = 0, bias = 0.4, minFlexH = 0 } = {}
) {
  const avail = Math.max(0, canvasH - marginTop - marginBottom);
  let total =
    items.reduce((s, it) => s + it.h, 0) + gap * Math.max(0, items.length - 1);

  const resized = {};
  if (total > avail) {
    const flex = items.find((it) => it.flex);
    if (flex) {
      const newH = Math.max(minFlexH, flex.h - (total - avail));
      if (newH < flex.h) {
        resized[flex.id] = newH;
        total -= flex.h - newH;
      }
    }
  }

  let y = marginTop + Math.max(0, avail - total) * bias;
  const tops = {};
  for (const it of items) {
    tops[it.id] = y;
    y += (resized[it.id] ?? it.h) + gap;
  }
  return { tops, resized, total };
}

/**
 * Başlık uzunluğuna göre varsayılan yazı boyutu (referans piksel). Uzun
 * başlıklar küçük tuvalde 4–5 satıra yayılıp yığını taşırmasın.
 */
export function storyTitleSize(title) {
  const len = String(title || "").length;
  if (len > 48) return 18;
  if (len > 32) return 21;
  if (len > 22) return 24;
  return 26;
}

/* ── Alt eylem çubuğu (Paylaş / Sticker / Galeri / Düzenle) ──
   Eskiden `pencere < 400` eşiğiyle iki sabit düzen vardı. 400–440 dp arasında
   (iPhone Plus/Pro/Pro Max, geniş Android) Paylaş düğmesine kalan genişlik
   "Tasarımı Paylaş" için yetmiyor, metin "Tasarımı P…" diye kırpılıyordu.
   Burada genişlik gerçekten hesaplanır; metin sığmıyorsa kısa etikete düşülür. */

/* Kalın (800–900) sistem yazısında ortalama harf genişliği / yazı boyutu.
   Ölçüm yok, bilinçli olarak biraz geniş tutulur: sığar diye varsayıp
   kırpılmaktansa kısa etiketi seçmek yeğdir. */
const TITLE_EM = 0.6;
const SUB_EM = 0.55;
const estimateTextW = (text, size, em) => String(text || "").length * size * em;

/* İki düzen: geniş (büyük simge, geniş dolgu) ve sıkı (küçük simge). `rowH`
   = simge + iki dikey dolgu; ekran, ölçüm gelmeden önceki alt çubuk
   yüksekliğini buradan tahmin eder. */
const ACTION_ROOMY = { icon: 42, padX: 16, padY: 12, gap: 12, titleSize: 16 };
const ACTION_SNUG = { icon: 36, padX: 10, padY: 10, gap: 8, titleSize: 14 };

/**
 * @param {number} winW  pencere genişliği (dp)
 * @param {object} [o]
 * @param {string[]} [o.titles]  paylaş düğmesi başlıkları, uzundan kısaya
 * @param {string} [o.variantTitle]  düzen (geniş/sıkı) seçimini belirleyen metin;
 *   verilmezse titles[0]. Meşgulken başlık değişse bile çubuk yüksekliği
 *   sıçramasın diye çağıran boştaki uzun başlığı verir.
 * @param {string} [o.sub]  uzun başlıkla birlikte gösterilen alt satır
 * @param {number} [o.sidePad]  çubuğun yatay dolgusu (ekranda 16)
 * @returns {{ secondaryW:number, gap:number, rowH:number, pad:{x:number,y:number},
 *   icon:number, innerGap:number, titleSize:number, title:string,
 *   showSub:boolean, shareW:number, copyW:number }}
 */
export function planStoryActionBar(
  winW,
  { titles = [], variantTitle, sub = "", sidePad = 16, secondaryCount = 3 } = {}
) {
  const w = Math.max(240, Number(winW) || 0);
  const gap = w < 360 ? 6 : 8;
  const secondaryW = clamp(Math.round(w * 0.13), 46, 56);
  const shareW =
    w - sidePad * 2 - secondaryW * secondaryCount - gap * secondaryCount;

  const layout = (v) => ({
    v,
    copyW: shareW - v.padX * 2 - v.icon - v.gap,
  });
  const roomy = layout(ACTION_ROOMY);
  const snug = layout(ACTION_SNUG);
  const fits = (l, text) =>
    estimateTextW(text, l.v.titleSize, TITLE_EM) <= l.copyW;

  const longest = variantTitle ?? titles[0];
  // Uzun başlık hangi düzende sığıyorsa o düzen; hiçbirinde sığmıyorsa yeterince
  // geniş olan düzen (kısa etiket zaten sığar).
  let chosen;
  if (longest && fits(roomy, longest)) chosen = roomy;
  else if (longest && fits(snug, longest)) chosen = snug;
  else chosen = shareW >= 200 ? roomy : snug;

  const title =
    titles.find((t) => fits(chosen, t)) ?? titles[titles.length - 1] ?? "";
  const showSub =
    chosen === roomy &&
    !!sub &&
    title === longest &&
    estimateTextW(sub, 11, SUB_EM) <= chosen.copyW;

  return {
    secondaryW,
    gap,
    rowH: chosen.v.icon + chosen.v.padY * 2,
    pad: { x: chosen.v.padX, y: chosen.v.padY },
    icon: chosen.v.icon,
    innerGap: chosen.v.gap,
    titleSize: chosen.v.titleSize,
    title,
    showSub,
    shareW,
    copyW: chosen.copyW,
  };
}

/**
 * Taslaklar ızgarası: sütun sayısı ve kart genişliği pencereden hesaplanır
 * (modül yüklenirken `Dimensions` okumak katlanır/bölünmüş ekranda eskir).
 */
export function storyDraftGrid(winW, { pad = 12, gap = 10 } = {}) {
  const w = Math.max(0, Number(winW) || 0);
  const cols = w >= 960 ? 6 : w >= 700 ? 5 : w >= 520 ? 4 : 3;
  const itemW = Math.floor((w - pad * 2 - gap * (cols - 1)) / cols);
  return { cols, itemW, itemH: Math.round((itemW * 16) / 9) };
}

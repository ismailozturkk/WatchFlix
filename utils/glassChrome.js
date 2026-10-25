// utils/glassChrome.js
//
// "Bu dokunulabilir / kutu / yazı alanı iOS Liquid Glass'a çevrilsin mi, çevrilirse
// nasıl?" kararının SAF mantığı (RN/Expo importu yok; jest'te çalışır). Çizen
// bileşenler components/common/{GlassTouchable,GlassPressable,GlassBox,
// GlassTextInput}.js; ortak kanca components/common/glassChrome.js.
//
// ── MODEL ────────────────────────────────────────────────────────────────────
//
// Bu katman "yerine geçen" bileşenler içindir: bir TouchableOpacity / Pressable /
// View / TextInput'un ESKİ stili aynen verilir, cam çizilebiliyorsa stilin
// "kabuk" kısmı (dolgu rengi, çerçeve rengi, gölge) camın kendisine devredilir,
// yerleşim kısmı (boyut, dolgu boşluğu, düzen) dokunulmadan kalır. Cam
// çizilemiyorsa iOS 18–25'te ve Efektler: Kapalı'da hiçbir şey değişmez; Android'de
// aynı plan "buzlu cam" katmanıyla çizilir (aşağıda, frostedFill / frostedAppearance).
//
//   dolgu rengi  → camın tonu (tintColor); vurgu rengi canlı, yüzey rengi hafif ton
//   çerçeve      → HER ZAMAN düşer (kalınlığı saydam kalır, boyut değişmesin). Cam
//                  dokununca esneyip büyür/küçülür, RN çerçevesi ise yerinde SABİT
//                  kalır: camın çevresinde ondan kopuk ikinci bir halka görünür. Cam
//                  kendi kenar ışığını çizer. "Anlamlı" çerçevenin (vurgu rengi:
//                  seçili çip, hata/odak) rengi kaybolmasın diye TONA taşınır; buzlu
//                  camda (Android) ayrıca kenar ışığının rengi olur (`rim`)
//   gölge        → düşer (cam kendi derinliğini çizer; GlassSurface kural 4)
//   opaklık      → cam yolunda stilden düşer (basılı-durum saydamlığı; GlassSurface
//                  kural 1). STATİK kısık öğe (opaklık < 1: devre dışı / yükleniyor)
//                  cama ÇEVRİLMEZ: cam opaklıkla solmaz, içerik rengini de bu katman
//                  değiştiremez — eski, kısık görünüm okunaklı kalır ve etkinleşince
//                  cama dönüşür
//   köşe         → camın yarıçapı; ölçülünce boyutun yarısıyla sınırlanır
//
// CAMA ÇEVRİLMEYENLER (null döner → eski görünüm): köşesiz kutu, dolgusuz ve
// çerçevesiz kutu (yalın metin/ikon dokunuşu), tam ekran örtü/arka plan, gizli
// ya da kısık (opaklık < 1) öğe, kesikli çerçeve, çözümlenemeyen (animasyonlu/nesne)
// renk.

const TRANSPARENT_ALPHA = 0.02;

/** Vurgu (canlı) dolgunun camdaki opaklığı: üstündeki beyaz yazı okunur kalsın. */
export const GLASS_ACCENT_TINT_ALPHA = 0.9;
/** Kart / alan gibi yüzey dolguları. */
export const GLASS_SURFACE_TINT_ALPHA = 0.55;
/** Cam arama/yazı alanı: dinlenme tonunun opaklığı (tema yüzeyi) ve odaktaki vurgu tonu. */
export const GLASS_FIELD_TINT_ALPHA = 0.55;
export const GLASS_FIELD_FOCUS_TINT_ALPHA = 0.22;
/**
 * Durum bildiren (canlı) çerçevenin camdaki ton opaklığı; çerçevenin kendi
 * alfasıyla orantılı (accent@0.55 "işaretli" çip, tam accent "seçili"den hafif).
 */
export const GLASS_STATE_TINT_ALPHA = 0.3;
const STATE_TINT_MIN_ALPHA = 0.16;
/**
 * Android buzlu cam: opak nötr yüzeyin opaklığı. Arkada blur yok; düz sayfa
 * zemininde yüzey ayırt edilsin, metin okunaklı kalsın diye camdakinden (0.55) yüksek.
 */
export const FROSTED_SURFACE_TINT_ALPHA = 0.8;
/** Çok şeffaf nötr dolgu (cam zaten şeffaf): ton hiç verilmez. */
const NEUTRAL_MIN_TINT_ALPHA = 0.2;
/** Yarı saydam vurgu dolgusunun (seçili çip) alt sınırı. */
const TRANSLUCENT_ACCENT_MIN_ALPHA = 0.2;

const NAMED = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
};

/** "#rgb" "#rgba" "#rrggbb" "#rrggbbaa" "rgb()" "rgba()" + transparent/white/black → {r,g,b,a} | null */
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (NAMED[value]) return { ...NAMED[value] };
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 1000) / 1000 : 1,
    };
  }
  const match = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!match) return null;
  const [, r, g, b, a] = match;
  return { r: +r, g: +g, b: +b, a: a === undefined ? 1 : Math.min(1, +a) };
}

export function formatColor({ r, g, b }, a) {
  const clamped = Math.max(0, Math.min(1, a));
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(clamped * 1000) / 1000})`;
}

function hsl({ r, g, b }) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return { s, l };
}

function sameRgb(a, b) {
  return a && b && a.r === b.r && a.g === b.g && a.b === b.b;
}

/** Canlı (vurgu) renk mi: yeterince doygun ve ne siyaha ne beyaza yakın. */
export function isVividColor(color) {
  const { s, l } = hsl(color);
  return s >= 0.28 && l >= 0.12 && l <= 0.9;
}

/** Koyu mu (yarı saydam poster örtüsü gibi)? */
export function isDarkColor(color) {
  return hsl(color).l < 0.25;
}

/**
 * Çerçeve rengi "nötr" mü (gri / siyah / beyaz, tema ayracı) → cam kenarı
 * yeterli, çerçeve düşer. Canlı renk (vurgu, hata kırmızısı, başarı yeşili) bir
 * DURUM bildirir (seçili çip, geçersiz alan) ve cam üstünde de çizilmeye devam eder.
 * Tema renklerine bakılmaz: tema ayracı hep nötrdür, böylece bu karar tema
 * bağlamı (ThemeContext) gerektirmez ve saf kalır.
 */
export function isNeutralBorder(border, themeBorder) {
  if (!border) return true;
  if (themeBorder && sameRgb(border, themeBorder)) return true;
  return !isVividColor(border);
}

const SHADOW_KEYS = [
  "shadowColor",
  "shadowOffset",
  "shadowOpacity",
  "shadowRadius",
  "elevation",
];

/**
 * @param {object|null} flat  Düzleştirilmiş stil
 * @param {object} options
 * @param {"button"|"field"|"card"} [options.role]
 * @param {object} [options.theme]    { border } — tema çerçeve rengi (hex/rgba)
 * @param {string} [options.tint]     Ton zorla (dolgu rengini ezer)
 * @param {boolean} [options.frosted] Android buzlu cam: opak nötr yüzey daha opak kalır
 * @returns {null | {radius:number, tint:string|undefined, scheme:"dark"|undefined,
 *   inset:number, dropBorder:boolean, rim:string|undefined}}
 *   `rim`: durum bildiren çerçevenin rengi (buzlu camın kenar ışığı olur).
 */
export function planGlassChrome(flat, options = {}) {
  if (!flat || typeof flat !== "object") return null;
  const { role = "button", theme = {}, tint: tintOverride, frosted = false } = options;

  const radius = flat.borderRadius;
  if (typeof radius !== "number" || !(radius > 0)) return null;

  // Tam ekran örtü / arka plan: cam değil, katman.
  if (
    flat.position === "absolute" &&
    flat.top === 0 &&
    flat.left === 0 &&
    flat.right === 0 &&
    flat.bottom === 0
  ) {
    return null;
  }
  if (flat.borderStyle === "dashed" || flat.borderStyle === "dotted") return null;

  const rawOpacity = flat.opacity;
  if (rawOpacity !== undefined && typeof rawOpacity !== "number") return null;
  const opacity = rawOpacity === undefined ? 1 : rawOpacity;
  if (opacity < 1) return null; // gizli (≈0) ya da kısık: eski görünüm kalır

  let bg = null;
  if (flat.backgroundColor !== undefined && flat.backgroundColor !== null) {
    bg = parseColor(flat.backgroundColor);
    if (!bg) return null; // animasyonlu / çözümlenemeyen renk
  }
  const borderWidth = typeof flat.borderWidth === "number" ? flat.borderWidth : 0;
  let border = null;
  if (flat.borderColor !== undefined && flat.borderColor !== null) {
    border = parseColor(flat.borderColor);
    if (!border) return null;
  }

  const hasFill = !!bg && bg.a > TRANSPARENT_ALPHA;
  const hasBorder = borderWidth > 0 && !!border && border.a > TRANSPARENT_ALPHA;
  if (!hasFill && !hasBorder) return null;

  const themeBorder = parseColor(theme.border);
  const stateBorder = hasBorder && !isNeutralBorder(border, themeBorder) ? border : null;
  const vividFill = hasFill && isVividColor(bg);

  let tintColor;
  let scheme;
  if (typeof tintOverride === "string") {
    tintColor = parseColor(tintOverride);
  } else if (vividFill) {
    // Dolgu durumu zaten taşıyor (dolu vurgu düğmesi, seçili çip zemini).
    tintColor =
      bg.a >= 0.9
        ? { ...bg, a: role === "button" ? GLASS_ACCENT_TINT_ALPHA : 0.7 }
        : { ...bg, a: Math.max(TRANSLUCENT_ACCENT_MIN_ALPHA, bg.a) };
  } else if (stateBorder) {
    // Nötr (ya da hiç) dolgu + renkli çerçeve: durumu yalnız çerçeve söylüyordu;
    // çerçeve camda çizilmediği için renk tona geçer.
    tintColor = {
      ...stateBorder,
      a: Math.max(STATE_TINT_MIN_ALPHA, GLASS_STATE_TINT_ALPHA * stateBorder.a),
    };
  } else if (hasFill) {
    if (bg.a >= 0.9) {
      tintColor = { ...bg, a: frosted ? FROSTED_SURFACE_TINT_ALPHA : GLASS_SURFACE_TINT_ALPHA };
    } else if (bg.a >= NEUTRAL_MIN_TINT_ALPHA) {
      tintColor = { ...bg };
    }
  }
  if (hasFill && bg.a < 0.95 && isDarkColor(bg)) scheme = "dark";
  return {
    radius,
    tint: tintColor ? formatColor(tintColor, tintColor.a) : undefined,
    scheme,
    inset: hasBorder ? borderWidth : 0,
    dropBorder: hasBorder,
    rim: stateBorder ? formatColor(stateBorder, stateBorder.a) : undefined,
  };
}

/**
 * Cam yolunda öğenin KENDİ stilinden kabuk kısmını çıkarır; yerleşim kalır.
 * Çerçeve genişliği korunur (boyut değişmesin), yalnız rengi saydamlaşır.
 * `keepOpacity` (buzlu cam): basılı-durum saydamlığı kalır — Android'de opaklık
 * kuralı yok, dokunma geri bildirimi eski düğmedeki gibi sürer.
 */
export function stripChrome(flat, plan, { keepOpacity = false } = {}) {
  if (!flat || !plan) return flat;
  const next = { ...flat };
  delete next.backgroundColor;
  for (const key of SHADOW_KEYS) delete next[key];
  if (flat.opacity !== undefined && !keepOpacity) delete next.opacity;
  if (plan.dropBorder) next.borderColor = "transparent";
  return next;
}

// ── ANDROID BUZLU CAM GÖRÜNÜMÜ ──────────────────────────────────────────────
//
// UIGlassEffect'in Android karşılığı yok; gerçek blur da yalnız arkasında bir
// BlurTargetView olan (ve onun KARDEŞİ duran) yüzeyde mümkün (bkz.
// components/common/BlurTarget.js). Ekran içindeki düğme/alan/kartlar için bu
// yüzden camın görsel DİLİ taklit edilir: yarı saydam yüzey + ince kenar ışığı +
// üstten inen parlama. Tek View + tek degrade; öğe başına native efekt yok.

/**
 * Çağıranın eski çerçeve rengi bir DURUM bildiriyorsa (canlı: odak, seçili,
 * etkin filtre) o renk, nötrse undefined. Buzlu camın kenar ışığı bununla
 * renklenir; böylece eski görünümdeki vurgu çerçevesi Android'de de kaybolmaz.
 */
export function stateBorderColor(color) {
  const parsed = parseColor(color);
  if (!parsed || parsed.a <= TRANSPARENT_ALPHA || isNeutralBorder(parsed)) return undefined;
  return formatColor(parsed, parsed.a);
}

/** Opak nötr yüzey rengini buzlu cam opaklığına indirir; vurgu ve yarı saydam olduğu gibi. */
export function frostedFill(color) {
  const parsed = parseColor(color);
  if (!parsed) return color;
  if (parsed.a < 0.9) return formatColor(parsed, parsed.a);
  if (isVividColor(parsed)) return formatColor(parsed, Math.min(parsed.a, 0.94));
  return formatColor(parsed, FROSTED_SURFACE_TINT_ALPHA);
}

/**
 * Buzlu camın kenar ışığı + parlama renkleri.
 * @param {object} girdi
 * @param {string} [girdi.fill]          Yüzeyin dolgusu (canlıysa parlama güçlenir)
 * @param {"light"|"dark"} [girdi.scheme] Yüzey görünümü (tema / poster üstü koyu)
 * @param {string} [girdi.rim]           Durum rengi (seçili / hata / odak) — kenar ışığını ezer
 * @returns {{rim: string, sheen: [string, string]}}
 */
export function frostedAppearance({ fill, scheme = "dark", rim } = {}) {
  const parsed = parseColor(fill);
  if (parsed && parsed.a >= 0.6 && isVividColor(parsed)) {
    return {
      rim: rim ?? "rgba(255, 255, 255, 0.24)",
      sheen: ["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0)"],
    };
  }
  if (scheme === "light") {
    return {
      rim: rim ?? "rgba(0, 0, 0, 0.08)",
      sheen: ["rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0)"],
    };
  }
  return {
    rim: rim ?? "rgba(255, 255, 255, 0.13)",
    sheen: ["rgba(255, 255, 255, 0.09)", "rgba(255, 255, 255, 0)"],
  };
}

/** Cam köşesini ölçülen boyutun yarısıyla sınırlar (hap = 999 gibi değerler). */
export function clampRadius(radius, width, height) {
  if (!(width > 0) || !(height > 0)) return radius;
  return Math.min(radius, Math.min(width, height) / 2);
}

// TextInput stilinin hangi kısmı KUTUya (cam), hangisi YAZIya ait.
const INPUT_BOX_KEYS = new Set([
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderTopWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderStyle",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "shadowColor",
  "shadowOffset",
  "shadowOpacity",
  "shadowRadius",
  "elevation",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "zIndex",
  "opacity",
  "overflow",
  "aspectRatio",
]);

/**
 * @returns {{box: object, text: object}} `box` cam kutusuna, `text` içteki
 *   TextInput'a gider. Dolgu boşlukları (padding) YAZIDA kalır: dokunma alanı
 *   kutuyu doldursun.
 */
export function splitInputStyle(flat) {
  const box = {};
  const text = {};
  for (const [key, value] of Object.entries(flat || {})) {
    if (INPUT_BOX_KEYS.has(key)) box[key] = value;
    else text[key] = value;
  }
  return { box, text };
}

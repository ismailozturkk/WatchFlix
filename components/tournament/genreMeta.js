// components/tournament/genreMeta.js
//
// Turnuva TÜRLERİNİN görsel kimliği (ayın türü → renk + animasyonlu ikon).
// Hub kartı (TournamentWidget), turnuva ekranının hero'su ve eleme ağacı
// (BracketTree) buradan okur: karta basıp ekrana girince aynı renk dili sürer.
// Faz kimliği (mavi=seçim, turuncu=oylama…) phaseMeta.js'te kalır; o artık
// yalnız faz çipini ve sohbet kartını boyar.
//
//   gradient → kartın/hero'nun gradyanı (üstünde her şey beyaz; 3 durak, koyuya iner)
//   ink      → beyaz zemin üstündeki ok/simge rengi (HubArrow)
//   glow     → koyu zeminde vurgu (ikon parıltısı, ağaçta kazananın yolu)
//   icon     → köşedeki animasyonlu simge
//   motion   → GLYPH_MOTIONS anahtarı (simgenin hareketi)
//
// Anahtar tournamentEngine SCHEDULE[].key'dir; genreId'ye bağlanmaz (Bilim
// Kurgu/Fantastik ve Aksiyon/Macera aynı TMDB TV türünü paylaşır).
//
// Saf modül (RN importu yok) → __tests__/tournamentGenreMeta.test.js node'da sınar.

export const GENRE_META = {
  scifi: {
    gradient: ["#4F46E5", "#3730A3", "#1E1B4B"], ink: "#3730A3", glow: "#67E8F9",
    icon: { family: "Ionicons", name: "planet" }, motion: "orbit",
  },
  romance: {
    gradient: ["#FB7185", "#E11D48", "#9F1239"], ink: "#E11D48", glow: "#FECDD3",
    icon: { family: "Ionicons", name: "heart" }, motion: "beat",
  },
  action: {
    gradient: ["#F97316", "#DC2626", "#7F1D1D"], ink: "#DC2626", glow: "#FDE68A",
    icon: { family: "Ionicons", name: "flash" }, motion: "jolt",
  },
  comedy: {
    gradient: ["#F59E0B", "#F97316", "#DB2777"], ink: "#EA580C", glow: "#FEF08A",
    icon: { family: "Ionicons", name: "happy" }, motion: "wobble",
  },
  adventure: {
    gradient: ["#10B981", "#0F766E", "#134E4A"], ink: "#0F766E", glow: "#A7F3D0",
    icon: { family: "Ionicons", name: "compass" }, motion: "swing",
  },
  crime: {
    gradient: ["#64748B", "#334155", "#0F172A"], ink: "#334155", glow: "#FACC15",
    icon: { family: "Ionicons", name: "finger-print" }, motion: "scan",
  },
  animation: {
    gradient: ["#A855F7", "#EC4899", "#F97316"], ink: "#C026D3", glow: "#FBCFE8",
    icon: { family: "Ionicons", name: "color-palette" }, motion: "bounce",
  },
  thriller: {
    gradient: ["#0E7490", "#155E75", "#0B2530"], ink: "#155E75", glow: "#5EEAD4",
    icon: { family: "Ionicons", name: "eye" }, motion: "blink",
  },
  drama: {
    gradient: ["#C026D3", "#86198F", "#4A044E"], ink: "#86198F", glow: "#F5D0FE",
    icon: { family: "MaterialCommunityIcons", name: "drama-masks" }, motion: "sway",
  },
  horror: {
    gradient: ["#B91C1C", "#5B0E0E", "#140606"], ink: "#991B1B", glow: "#FB923C",
    icon: { family: "MaterialCommunityIcons", name: "ghost" }, motion: "haunt",
  },
  fantasy: {
    gradient: ["#8B5CF6", "#5B21B6", "#0E7490"], ink: "#5B21B6", glow: "#FDE68A",
    icon: { family: "Ionicons", name: "color-wand" }, motion: "twinkle",
  },
  family: {
    gradient: ["#2DD4BF", "#0EA5E9", "#2563EB"], ink: "#0284C7", glow: "#FEF3C7",
    icon: { family: "Ionicons", name: "balloon" }, motion: "rise",
  },
};

// Takvimde olmayan bir tür (ileride eklenip burada unutulursa) kartı boyasız
// bırakmasın: eski oylama gradyanına yakın nötr bir kimlik.
export const FALLBACK_GENRE_META = {
  gradient: ["#2563EB", "#7C3AED", "#4C1D95"], ink: "#4F46E5", glow: "#C7D2FE",
  icon: { family: "Ionicons", name: "trophy" }, motion: "sway",
};

/** SCHEDULE girişinden (getScheduleEntry) türün görsel kimliği. */
export const genreMetaFor = (entry) => GENRE_META[entry?.key] || FALLBACK_GENRE_META;

// ─── Simge hareketleri ────────────────────────────────────────────────────────
// Her hareket TEK bir döngüsel ilerlemeden (t: 0→1, `period` ms, doğrusal)
// örneklenen anahtar karelerdir: `input` durakları, her dönüşüm için aynı
// uzunlukta değer dizisi (rotate derece, translate dp). Duraklar arası
// yumuşak (ease-in-out) geçilir → CSS @keyframes gibi.
//
// KURAL (bkz. reanimated ilk-değer kaybolması): her dizinin İLK ve SON değeri
// dinlenme durumudur (scale 1, açı/kayma 0, opaklık 1). Böylece döngü dikişsiz
// döner, "hareketi azalt" açıkken (değer 0 ya da 1'e atlar) simge düz durur ve
// Reanimated ilk değeri geri yazsa bile simge GÖRÜNÜR kalır.
//
// `extra`: simgenin yanında çizilen süs (yörünge uydusu, iz tarayıcı, kıvılcım,
// kalp halkası) — GenreGlyph çizer.
export const GLYPH_MOTIONS = {
  orbit: {
    period: 4200, extra: "orbit",
    input: [0, 0.5, 1], translateY: [0, -2.5, 0], rotate: [0, -10, 0],
  },
  beat: {
    period: 1500, extra: "ripple",
    input: [0, 0.12, 0.24, 0.36, 0.5, 1], scale: [1, 1.2, 1, 1.12, 1, 1],
  },
  jolt: {
    period: 1900,
    input: [0, 0.05, 0.1, 0.15, 0.2, 0.26, 1],
    rotate: [0, -14, 12, -8, 5, 0, 0],
    scale: [1, 1.16, 1.1, 1.05, 1.02, 1, 1],
    opacity: [1, 0.55, 1, 0.7, 1, 1, 1],
  },
  wobble: {
    period: 1800,
    input: [0, 0.12, 0.24, 0.36, 0.48, 0.6, 1],
    rotate: [0, -16, 13, -9, 5, 0, 0],
    translateY: [0, -5, 0, -3, 0, 0, 0],
  },
  swing: {
    period: 2800,
    input: [0, 0.16, 0.32, 0.46, 0.58, 0.68, 1],
    rotate: [0, -38, 26, -14, 7, 0, 0],
  },
  scan: {
    period: 2600, extra: "scan",
    input: [0, 0.7, 0.78, 0.86, 1], scale: [1, 1, 1.12, 1, 1],
  },
  bounce: {
    period: 1500,
    input: [0, 0.18, 0.36, 0.42, 0.5, 0.58, 1],
    translateY: [0, -8, 0, 1.5, 0, 0, 0],
    scaleX: [1, 0.92, 1, 1.18, 0.96, 1, 1],
    scaleY: [1, 1.1, 1, 0.8, 1.05, 1, 1],
  },
  blink: {
    period: 3400,
    input: [0, 0.04, 0.08, 0.12, 0.16, 0.4, 0.55, 0.7, 0.85, 1],
    scaleY: [1, 0.1, 1, 0.1, 1, 1, 1, 1, 1, 1],
    translateX: [0, 0, 0, 0, 0, -3, -3, 3, 0, 0],
  },
  sway: {
    period: 3200,
    input: [0, 0.25, 0.5, 0.75, 1], rotate: [0, -10, 0, 10, 0], translateY: [0, -2, 0, -2, 0],
  },
  haunt: {
    period: 2800,
    input: [0, 0.25, 0.5, 0.6, 0.63, 0.66, 0.7, 0.85, 1],
    translateY: [0, -5, 0, 2, 2, 2, 2, 1, 0],
    rotate: [0, -6, 0, 5, 5, 5, 5, 3, 0],
    opacity: [1, 1, 1, 1, 0.35, 1, 0.55, 1, 1],
  },
  twinkle: {
    period: 2400, extra: "sparkle",
    input: [0, 0.14, 0.28, 0.4, 1], rotate: [0, -22, 12, 0, 0],
  },
  rise: {
    period: 3000,
    input: [0, 0.25, 0.5, 0.75, 1], translateY: [0, -3, -6, -3, 0], rotate: [0, 6, 0, -6, 0],
  },
};

/** Anahtar kare dizileri dışındaki alanlar (döngü süresi, süs, duraklar). */
export const MOTION_META_FIELDS = ["period", "extra", "input"];

/** Hareket dizilerinin dinlenme değeri (her dizinin ilk ve son elemanı). */
export const REST_VALUE = { scale: 1, scaleX: 1, scaleY: 1, rotate: 0, translateX: 0, translateY: 0, opacity: 1 };

/**
 * t (0..1) anında anahtar kare örneği: duraklar arası ease-in-out.
 * UI thread'de (useAnimatedStyle) ve düz JS'te çağrılabilir.
 */
export function sampleKeyframes(t, input, output) {
  "worklet";
  const n = input.length;
  if (t <= input[0]) return output[0];
  if (t >= input[n - 1]) return output[n - 1];
  let i = 1;
  while (i < n - 1 && t > input[i]) i += 1;
  const a = input[i - 1];
  const b = input[i];
  const f = b > a ? (t - a) / (b - a) : 1;
  const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  return output[i - 1] + (output[i] - output[i - 1]) * e;
}

/** "#RRGGBB" iki rengi t oranında karıştırır (0 = a, 1 = b). */
export function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((k) => parseInt(String(h).slice(k, k + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x
    .map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Eleme ağacının "arena" zemini: türün renginden koyulaştırılmış iki durak.
 * Tema (açık/koyu) ne olursa olsun koyu kalır → üstündeki beyaz/glow okunur.
 */
export const arenaColors = (meta) => [
  mixHex(meta.gradient[0], "#05070D", 0.68),
  mixHex(meta.gradient[meta.gradient.length - 1], "#05070D", 0.8),
];

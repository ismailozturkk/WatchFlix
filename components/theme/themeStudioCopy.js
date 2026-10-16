// components/theme/themeStudioCopy.js
//
// Tema stüdyosunun (özel tema oluşturucu) metinleri. CacheManagerModal ve
// ThemePreviewCard gibi yerel tr/en/es kopyaları burada tek yerde toplandı; iki dil
// aynı anahtar kümesine sahip olmak zorunda (bkz. __tests__/themeStudioCopy.test.js).

import { copyLanguage } from "../../utils/appLanguages";

const tr = {
  // sekmeler
  tabSetup: "Kur",
  tabDiscover: "Keşfet",
  tabFine: "İnce ayar",

  // üst çubuk
  undo: "Geri al",
  redo: "Yinele",
  resetToStart: "Başlangıca dön",

  // önizleme + okunabilirlik
  sceneHome: "Ana ekran",
  sceneDetail: "Detay",
  readability: "Okunabilirlik",
  levelGreat: "Mükemmel",
  levelOk: "İyi",
  levelLow: "Sınırda",
  levelFail: "Zayıf",
  issuesOne: "1 sorun",
  issuesMany: "{n} sorun",
  checkTitle: "Başlık yazısı",
  checkCard: "Kart yazısı",
  checkMuted: "Soluk yazı",
  checkAccent: "Vurgu / zemin",
  checkButton: "Düğme yazısı (beyaz)",
  fixReadability: "Okunurluğu düzelt",
  fixed: "Okunabilirlik düzeltildi",
  nothingToFix: "Her şey okunaklı",

  // isim
  suggestName: "İsim öner",

  // Kur
  sectionColors: "Renkler",
  sectionColorsSub: "İki renk seç, geri kalanı uyumlansın",
  bgSub: "Seçince tüm palet uyumlanır",
  accentSub: "Düğmeler ve vurgular",
  readyBackgrounds: "Hazır zeminler",
  readyAccents: "Hazır vurgular",
  harmonyTitle: "Uyumlu vurgu önerileri",
  harmonyHint: "Zemininin tonuna göre hesaplandı",
  harmonyComplementary: "Tamamlayıcı",
  harmonySplit: "Bölünmüş",
  harmonyTriadic: "Üçlü",
  harmonyAnalogousR: "Yakın +",
  harmonyAnalogousL: "Yakın −",
  harmonyMono: "Tek ton",
  sectionStyle: "Stil",
  styleContrast: "Kontrast",
  styleSurfaces: "Yüzeyler",
  contrastSoft: "Yumuşak",
  contrastBalanced: "Dengeli",
  contrastHigh: "Yüksek",
  surfacesNeutral: "Nötr",
  surfacesTinted: "Renkli",
  styleHint: "Stili değiştirmek paleti zemin + vurgudan yeniden türetir; geri alabilirsin.",
  rebuild: "Paleti yeniden üret",
  bgMatched: "Palet yeni zeminle uyumlandı",

  // Keşfet
  discoverTitle: "Rastgele keşfet",
  discoverSub: "Bir ruh hali seç, Karıştır'a bas, beğendiğine dokun",
  shuffle: "Karıştır",
  shuffleAgain: "Yeni adaylar",
  moodMix: "Karışık",
  moodMidnight: "Gece",
  moodAmoled: "AMOLED",
  moodForest: "Orman",
  moodSunset: "Gün batımı",
  moodOcean: "Okyanus",
  moodMocha: "Kahve",
  moodNeon: "Neon",
  moodPastel: "Pastel",
  moodPaper: "Kâğıt",
  lockBg: "Zemini kilitle",
  lockAccent: "Vurguyu kilitle",
  lockHint: "Kilitli renk karıştırırken sabit kalır",
  lockedBoth: "İkisi de kilitli — yalnız stil değişir",
  applied: "Uygulandı",
  startFrom: "Hazır temalardan başla",

  // İnce ayar
  fineHint: "Bir renge dokun, ayarla. Bağlı renkler kaynağını izler.",
  fineLinked: "Bağlı",

  // çıkış koruması
  leaveTitle: "Değişiklikler kaybolsun mu?",
  leaveBody: "Kaydetmediğin değişiklikler silinecek.",
  leaveKeep: "Düzenlemeye devam",
  leaveDiscard: "Vazgeç ve çık",

  // isim önerisi parçaları
  polarityDark: "Koyu",
  polarityLight: "Açık",
  hueGray: "Gri",
  hueRed: "Kırmızı",
  hueOrange: "Turuncu",
  hueYellow: "Sarı",
  hueGreen: "Yeşil",
  hueTeal: "Turkuaz",
  hueBlue: "Mavi",
  hueViolet: "Mor",
  huePink: "Pembe",
};

const en = {
  tabSetup: "Setup",
  tabDiscover: "Discover",
  tabFine: "Fine-tune",

  undo: "Undo",
  redo: "Redo",
  resetToStart: "Back to start",

  sceneHome: "Home",
  sceneDetail: "Detail",
  readability: "Readability",
  levelGreat: "Excellent",
  levelOk: "Good",
  levelLow: "Borderline",
  levelFail: "Poor",
  issuesOne: "1 issue",
  issuesMany: "{n} issues",
  checkTitle: "Title text",
  checkCard: "Card text",
  checkMuted: "Muted text",
  checkAccent: "Accent on background",
  checkButton: "Button label (white)",
  fixReadability: "Fix readability",
  fixed: "Readability fixed",
  nothingToFix: "Everything is readable",

  suggestName: "Suggest a name",

  sectionColors: "Colors",
  sectionColorsSub: "Pick two colors and the rest follows",
  bgSub: "Re-tunes the whole palette",
  accentSub: "Buttons and highlights",
  readyBackgrounds: "Ready backgrounds",
  readyAccents: "Ready accents",
  harmonyTitle: "Matching accent ideas",
  harmonyHint: "Calculated from your background's hue",
  harmonyComplementary: "Complement",
  harmonySplit: "Split",
  harmonyTriadic: "Triad",
  harmonyAnalogousR: "Near +",
  harmonyAnalogousL: "Near −",
  harmonyMono: "Mono",
  sectionStyle: "Style",
  styleContrast: "Contrast",
  styleSurfaces: "Surfaces",
  contrastSoft: "Soft",
  contrastBalanced: "Balanced",
  contrastHigh: "High",
  surfacesNeutral: "Neutral",
  surfacesTinted: "Tinted",
  styleHint: "Changing the style rebuilds the palette from background + accent; you can undo it.",
  rebuild: "Rebuild palette",
  bgMatched: "Palette matched to the new background",

  discoverTitle: "Random discovery",
  discoverSub: "Pick a mood, hit Shuffle, tap the one you like",
  shuffle: "Shuffle",
  shuffleAgain: "New candidates",
  moodMix: "Mix",
  moodMidnight: "Midnight",
  moodAmoled: "AMOLED",
  moodForest: "Forest",
  moodSunset: "Sunset",
  moodOcean: "Ocean",
  moodMocha: "Mocha",
  moodNeon: "Neon",
  moodPastel: "Pastel",
  moodPaper: "Paper",
  lockBg: "Lock background",
  lockAccent: "Lock accent",
  lockHint: "A locked color stays put while shuffling",
  lockedBoth: "Both locked — only the style varies",
  applied: "Applied",
  startFrom: "Start from a built-in theme",

  fineHint: "Tap a color to adjust it. Linked colors follow their source.",
  fineLinked: "Linked",

  leaveTitle: "Discard changes?",
  leaveBody: "Your unsaved changes will be lost.",
  leaveKeep: "Keep editing",
  leaveDiscard: "Discard",

  polarityDark: "Dark",
  polarityLight: "Light",
  hueGray: "Gray",
  hueRed: "Red",
  hueOrange: "Orange",
  hueYellow: "Yellow",
  hueGreen: "Green",
  hueTeal: "Teal",
  hueBlue: "Blue",
  hueViolet: "Violet",
  huePink: "Pink",
};

const es = {
  tabSetup: "Ajustar",
  tabDiscover: "Descubrir",
  tabFine: "Ajuste fino",

  undo: "Deshacer",
  redo: "Rehacer",
  resetToStart: "Volver al inicio",

  sceneHome: "Inicio",
  sceneDetail: "Detalle",
  readability: "Legibilidad",
  levelGreat: "Excelente",
  levelOk: "Buena",
  levelLow: "Justa",
  levelFail: "Deficiente",
  issuesOne: "1 problema",
  issuesMany: "{n} problemas",
  checkTitle: "Texto de títulos",
  checkCard: "Texto de tarjetas",
  checkMuted: "Texto atenuado",
  checkAccent: "Acento sobre fondo",
  checkButton: "Texto de botón (blanco)",
  fixReadability: "Corregir la legibilidad",
  fixed: "Legibilidad corregida",
  nothingToFix: "Todo se lee bien",

  suggestName: "Sugerir un nombre",

  sectionColors: "Colores",
  sectionColorsSub: "Elige dos colores y el resto se adapta",
  bgSub: "Reajusta toda la paleta",
  accentSub: "Botones y elementos destacados",
  readyBackgrounds: "Fondos predefinidos",
  readyAccents: "Acentos predefinidos",
  harmonyTitle: "Ideas de acentos a juego",
  harmonyHint: "Calculadas según el tono de tu fondo",
  harmonyComplementary: "Complementario",
  harmonySplit: "Dividido",
  harmonyTriadic: "Tríada",
  harmonyAnalogousR: "Cercano +",
  harmonyAnalogousL: "Cercano −",
  harmonyMono: "Monotono",
  sectionStyle: "Estilo",
  styleContrast: "Contraste",
  styleSurfaces: "Superficies",
  contrastSoft: "Suave",
  contrastBalanced: "Equilibrado",
  contrastHigh: "Alto",
  surfacesNeutral: "Neutras",
  surfacesTinted: "Con color",
  styleHint: "Cambiar el estilo reconstruye la paleta a partir del fondo y el acento; puedes deshacerlo.",
  rebuild: "Reconstruir la paleta",
  bgMatched: "Paleta ajustada al nuevo fondo",

  discoverTitle: "Descubrimiento aleatorio",
  discoverSub: "Elige un ambiente, pulsa Mezclar y toca el que te guste",
  shuffle: "Mezclar",
  shuffleAgain: "Nuevos candidatos",
  moodMix: "Mezcla",
  moodMidnight: "Medianoche",
  moodAmoled: "AMOLED",
  moodForest: "Bosque",
  moodSunset: "Atardecer",
  moodOcean: "Océano",
  moodMocha: "Moca",
  moodNeon: "Neón",
  moodPastel: "Pastel",
  moodPaper: "Papel",
  lockBg: "Fijar el fondo",
  lockAccent: "Fijar el acento",
  lockHint: "Un color fijado no cambia al mezclar",
  lockedBoth: "Ambos fijados: solo varía el estilo",
  applied: "Aplicado",
  startFrom: "Empezar desde un tema predefinido",

  fineHint: "Toca un color para ajustarlo. Los colores vinculados siguen a su origen.",
  fineLinked: "Vinculado",

  leaveTitle: "¿Descartar los cambios?",
  leaveBody: "Perderás los cambios que no hayas guardado.",
  leaveKeep: "Seguir editando",
  leaveDiscard: "Descartar",

  polarityDark: "Oscuro",
  polarityLight: "Claro",
  hueGray: "Gris",
  hueRed: "Rojo",
  hueOrange: "Naranja",
  hueYellow: "Amarillo",
  hueGreen: "Verde",
  hueTeal: "Turquesa",
  hueBlue: "Azul",
  hueViolet: "Violeta",
  huePink: "Rosa",
};

export const STUDIO_COPY = { tr, en, es };

/**
 * Dile göre sözlük. Eski çağrılar `isEn` boolean'ı geçiyordu (true → İngilizce);
 * artık uygulama dili de verilebilir ("tr" | "en" | "es"; bilinmeyen → İngilizce).
 */
export const getStudioCopy = (language) =>
  typeof language === "boolean"
    ? language ? en : tr
    : STUDIO_COPY[copyLanguage(language, Object.keys(STUDIO_COPY))];

const cap = (id) => id.charAt(0).toUpperCase() + id.slice(1);

/** "{n}" yer tutucusunu doldurur. */
export const fillCopy = (text, values = {}) =>
  String(text).replace(/\{(\w+)\}/g, (_, k) => (k in values ? String(values[k]) : `{${k}}`));

export const moodLabel = (copy, moodId) => copy[`mood${cap(moodId)}`] || moodId;
export const harmonyLabel = (copy, harmonyId) => copy[`harmony${cap(harmonyId)}`] || harmonyId;
export const hueLabel = (copy, family) => copy[`hue${cap(family)}`] || family;

/**
 * Tema için isim önerisi: ruh hali biliniyorsa "Okyanus · Turuncu", yoksa
 * "Koyu · Turuncu". Ayırıcı dilden bağımsız olduğu için çekim eki sorunu yok.
 */
export function suggestedThemeName(copy, { moodId, polarity, family }) {
  const head = moodId ? moodLabel(copy, moodId) : polarity === "light" ? copy.polarityLight : copy.polarityDark;
  return `${head} · ${hueLabel(copy, family)}`;
}

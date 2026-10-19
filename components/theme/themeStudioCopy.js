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
  sectionColorsSub: "Ana renk ve vurgu seç, üç ton uyumlansın",
  bgSub: "Seçince üç ton da uyumlanır",
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
  styleHint: "Stili değiştirmek üç tonu da ana renk + vurgudan yeniden türetir; geri alabilirsin.",
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
  lockBg: "Ana rengi kilitle",
  lockAccent: "Vurguyu kilitle",
  lockHint: "Kilitli renk karıştırırken sabit kalır",
  lockedBoth: "İkisi de kilitli — yalnız stil değişir",
  applied: "Uygulandı",
  startFrom: "Hazır temalardan başla",

  // üç ton + hazır temalar
  headerSub: "Bir renk seç, üç tonu biz kuralım",
  tabPresets: "Hazır",
  toneLight: "Açık",
  toneMid: "Orta",
  toneDark: "Koyu",
  toneSectionTitle: "Üç ton",
  toneSectionSub: "Açık, orta ve koyu zemin — her birini ayrı ayarla",
  toneBgTitle: "Zemin · {tone}",
  toneBgSub: "Yalnız bu tonun zemini",
  previewTone: "Önizlenen ton",
  baseTitle: "Ana renk",
  baseSub: "Üç tonun hepsi buna uyumlanır",
  readyBases: "Hazır ana renkler",
  presetsTitle: "Hazır temalar",
  presetsSub: "Birini seç, üç tonuyla yüklensin; sonra istediğini ayarla",
  presetLoaded: "Hazır tema üç tonuyla yüklendi",
  nameSet: "Üç ton",
  presetDefault: "Varsayılan",
  presetBlue: "Mavi",
  presetGreen: "Yeşil",
  presetPurple: "Gece Moru",
  presetCrimson: "Kızıl Sinema",
  presetOcean: "Okyanus",
  presetForest: "Orman",
  presetMocha: "Kahve",
  presetSunset: "Gün Batımı",
  moodSlate: "Arduvaz",
  moodSand: "Kum",
  moodLavender: "Lavanta",
  moodMint: "Nane",
  moodRose: "Gül",
  moodCobalt: "Kobalt",
  moodEmber: "Köz",
  moodAurora: "Aurora",

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
  sectionColorsSub: "Pick a main color and an accent; all three tones follow",
  bgSub: "Re-tunes all three tones",
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
  lockBg: "Lock main color",
  lockAccent: "Lock accent",
  lockHint: "A locked color stays put while shuffling",
  lockedBoth: "Both locked — only the style varies",
  applied: "Applied",
  startFrom: "Start from a built-in theme",

  // üç ton + hazır temalar
  headerSub: "Pick a color, we build the three tones",
  tabPresets: "Presets",
  toneLight: "Light",
  toneMid: "Mid",
  toneDark: "Dark",
  toneSectionTitle: "Three tones",
  toneSectionSub: "Light, mid and dark backgrounds — tune each one",
  toneBgTitle: "Background · {tone}",
  toneBgSub: "Only this tone's background",
  previewTone: "Previewed tone",
  baseTitle: "Main color",
  baseSub: "All three tones follow it",
  readyBases: "Ready main colors",
  presetsTitle: "Preset themes",
  presetsSub: "Pick one to load it with all three tones, then tweak anything",
  presetLoaded: "Preset loaded with all three tones",
  nameSet: "Tri-tone",
  presetDefault: "Default",
  presetBlue: "Blue",
  presetGreen: "Green",
  presetPurple: "Midnight Purple",
  presetCrimson: "Crimson Cinema",
  presetOcean: "Ocean",
  presetForest: "Forest",
  presetMocha: "Mocha",
  presetSunset: "Sunset",
  moodSlate: "Slate",
  moodSand: "Sand",
  moodLavender: "Lavender",
  moodMint: "Mint",
  moodRose: "Rose",
  moodCobalt: "Cobalt",
  moodEmber: "Ember",
  moodAurora: "Aurora",

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
  sectionColorsSub: "Elige un color principal y un acento; los tres tonos se adaptan",
  bgSub: "Reajusta los tres tonos",
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
  lockBg: "Fijar el color principal",
  lockAccent: "Fijar el acento",
  lockHint: "Un color fijado no cambia al mezclar",
  lockedBoth: "Ambos fijados: solo varía el estilo",
  applied: "Aplicado",
  startFrom: "Empezar desde un tema predefinido",

  // üç ton + hazır temalar
  headerSub: "Elige un color y creamos los tres tonos",
  tabPresets: "Listos",
  toneLight: "Claro",
  toneMid: "Medio",
  toneDark: "Oscuro",
  toneSectionTitle: "Tres tonos",
  toneSectionSub: "Fondos claro, medio y oscuro — ajusta cada uno",
  toneBgTitle: "Fondo · {tone}",
  toneBgSub: "Solo el fondo de este tono",
  previewTone: "Tono en la vista previa",
  baseTitle: "Color principal",
  baseSub: "Los tres tonos se adaptan a él",
  readyBases: "Colores principales listos",
  presetsTitle: "Temas predefinidos",
  presetsSub: "Elige uno para cargarlo con sus tres tonos y luego ajusta lo que quieras",
  presetLoaded: "Tema cargado con sus tres tonos",
  nameSet: "Tres tonos",
  presetDefault: "Predeterminado",
  presetBlue: "Azul",
  presetGreen: "Verde",
  presetPurple: "Púrpura medianoche",
  presetCrimson: "Cine carmesí",
  presetOcean: "Océano",
  presetForest: "Bosque",
  presetMocha: "Moca",
  presetSunset: "Atardecer",
  moodSlate: "Pizarra",
  moodSand: "Arena",
  moodLavender: "Lavanda",
  moodMint: "Menta",
  moodRose: "Rosa",
  moodCobalt: "Cobalto",
  moodEmber: "Brasa",
  moodAurora: "Aurora",

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
export const toneLabel = (copy, tone) => copy[`tone${cap(tone)}`] || tone;
export const presetLabel = (copy, presetId) => copy[`preset${cap(presetId)}`] || presetId;

/**
 * Tema için isim önerisi: ruh hali biliniyorsa "Okyanus · Turuncu", yoksa
 * "Koyu · Turuncu". Ayırıcı dilden bağımsız olduğu için çekim eki sorunu yok.
 */
export function suggestedThemeName(copy, { moodId, polarity, family }) {
  const head = moodId ? moodLabel(copy, moodId) : polarity === "light" ? copy.polarityLight : copy.polarityDark;
  return `${head} · ${hueLabel(copy, family)}`;
}

/**
 * Üç tonlu tema için isim önerisi: ruh hali biliniyorsa "Okyanus · Turuncu",
 * yoksa "Üç ton · Turuncu". (Tek tonlu `suggestedThemeName` kutupluluk söylerdi;
 * üç tonda kutupluluk anlamsız.)
 */
export function suggestedBundleName(copy, { moodId, family }) {
  const head = moodId ? moodLabel(copy, moodId) : copy.nameSet;
  return `${head} · ${hueLabel(copy, family)}`;
}

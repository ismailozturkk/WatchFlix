// utils/typographyRoles.js
//
// Tipografi kararlarının SAF mantığı. Burada React/RN/Expo importu YOK —
// jest.config.js yalnızca saf JS modüllerini test edebiliyor (bkz. Part 23),
// bu yüzden "hangi metin hangi rolde" ve "hangi rol hangi aileyi kullanır"
// kararları burada, native tarafa dokunan ince kabuk ise
// components/typography/AppText.js içinde durur.
//
// NEDEN VAR: tek bir uygulama fontu, metnin puntosuna bakan bir sezgisele
// bağlıydı ve metnin büyük kısmı sessizce Inter'e düşüyordu — yani kullanıcı
// bir font seçiyor ama ekranın üçte ikisi değişmiyordu. Artık üç AYRI rol var
// ve her rolün fontunu kullanıcı kendisi seçiyor:
//
//   heading  BAŞLIK      ekran/bölüm/kart başlıkları, büyük puntolu vurgular
//   body     NORMAL YAZI gövde, açıklama, etiket, buton, kullanıcı metni
//   numeric  RAKAM       sayaçlar, puanlar, süreler, yüzdeler, tarih rakamları
//
// Rol tespiti metnin KENDİ stilinden ve içeriğinden türetilir; otomatik kural
// yanıldığında çağıran taraf <Text fontRole="body"> ile kararı ezebilir.

export const TEXT_ROLES = ["heading", "body", "numeric"];

export const DEFAULT_FONT_PRESET = "system";

/** Rol → varsayılan preset. Üçü de "system": kimseye sessizce font dayatmayız. */
export const DEFAULT_FONT_ROLES = Object.freeze({
  heading: DEFAULT_FONT_PRESET,
  body: DEFAULT_FONT_PRESET,
  numeric: DEFAULT_FONT_PRESET,
});

// ── PRESET KATALOĞU ──────────────────────────────────────────────────────────
//
// `bestFor`, fontun hangi rol seçicilerinde gösterileceğini belirler. Bir font
// birden fazla role uygunsa (Inter, Oswald gibi) ilgili sekmelerin tamamında
// görünür; yalnız başlığa uygun dekoratif fontlar gövde/rakam seçeneklerine
// karışmaz.
export const FONT_PRESETS = Object.freeze([
  {
    id: "system",
    previewFontFamily: null,
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "Sistem", en: "System", es: "Sistema", pt: "Sistema", de: "System" },
    descriptions: {
      tr: "Cihazın doğal yazı tipi",
      en: "The device's native typeface",
      es: "La tipografía nativa del dispositivo",
      pt: "A fonte nativa do dispositivo",
      de: "Die native Schrift des Geräts",
    },
  },
  {
    id: "bebasNeue",
    previewFontFamily: "BebasNeue_400Regular",
    bestFor: ["heading", "numeric"],
    names: { tr: "Bebas Neue", en: "Bebas Neue", es: "Bebas Neue", pt: "Bebas Neue", de: "Bebas Neue" },
    descriptions: {
      tr: "Dar ve sinematik",
      en: "Condensed and cinematic",
      es: "Condensada y cinematográfica",
      pt: "Condensada e cinematográfica",
      de: "Schmal und filmisch",
    },
  },
  {
    id: "playfairDisplay",
    previewFontFamily: "PlayfairDisplay_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Playfair Display", en: "Playfair Display", es: "Playfair Display", pt: "Playfair Display", de: "Playfair Display" },
    descriptions: {
      tr: "Editoryal ve zarif",
      en: "Editorial and elegant",
      es: "Editorial y elegante",
      pt: "Editorial e elegante",
      de: "Redaktionell und elegant",
    },
  },
  {
    id: "unbounded",
    previewFontFamily: "Unbounded_700Bold",
    bestFor: ["heading", "numeric"],
    names: { tr: "Unbounded", en: "Unbounded", es: "Unbounded", pt: "Unbounded", de: "Unbounded" },
    descriptions: {
      tr: "Geniş ve fütüristik",
      en: "Wide and futuristic",
      es: "Ancha y futurista",
      pt: "Larga e futurista",
      de: "Breit und futuristisch",
    },
  },
  {
    id: "spaceMono",
    previewFontFamily: "SpaceMono_700Bold",
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "Space Mono", en: "Space Mono", es: "Space Mono", pt: "Space Mono", de: "Space Mono" },
    descriptions: {
      tr: "Teknik ve monospace",
      en: "Technical monospace",
      es: "Técnica y monoespaciada",
      pt: "Técnica e monoespaçada",
      de: "Technische Festbreitenschrift",
    },
  },
  {
    id: "oswald",
    previewFontFamily: "Oswald_700Bold",
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "Oswald", en: "Oswald", es: "Oswald", pt: "Oswald", de: "Oswald" },
    descriptions: {
      tr: "Güçlü ve kompakt",
      en: "Strong and compact",
      es: "Fuerte y compacta",
      pt: "Forte e compacta",
      de: "Kräftig und kompakt",
    },
  },
  {
    id: "michroma",
    previewFontFamily: "Michroma_400Regular",
    bestFor: ["heading", "numeric"],
    names: { tr: "Michroma", en: "Michroma", es: "Michroma", pt: "Michroma", de: "Michroma" },
    descriptions: {
      tr: "Teknolojik ve geniş",
      en: "Tech-forward and wide",
      es: "Tecnológica y ancha",
      pt: "Tecnológica e larga",
      de: "Technisch und breit",
    },
  },
  {
    id: "limelight",
    previewFontFamily: "Limelight_400Regular",
    bestFor: ["heading"],
    names: { tr: "Limelight", en: "Limelight", es: "Limelight", pt: "Limelight", de: "Limelight" },
    descriptions: {
      tr: "Klasik sinema afişi",
      en: "Classic cinema poster",
      es: "Cartel de cine clásico",
      pt: "Cartaz de cinema clássico",
      de: "Klassisches Kinoplakat",
    },
  },
  {
    id: "monoton",
    previewFontFamily: "Monoton_400Regular",
    bestFor: ["heading", "numeric"],
    names: { tr: "Monoton", en: "Monoton", es: "Monoton", pt: "Monoton", de: "Monoton" },
    descriptions: {
      tr: "Neon çizgili retro",
      en: "Striped neon retro",
      es: "Retro de neón rayado",
      pt: "Retrô de neon listrado",
      de: "Gestreifter Retro-Neon",
    },
  },
  {
    id: "tiltWarp",
    previewFontFamily: "TiltWarp_400Regular",
    bestFor: ["heading"],
    names: { tr: "Tilt Warp", en: "Tilt Warp", es: "Tilt Warp", pt: "Tilt Warp", de: "Tilt Warp" },
    descriptions: {
      tr: "Dinamik ve eğlenceli",
      en: "Dynamic and playful",
      es: "Dinámica y divertida",
      pt: "Dinâmica e divertida",
      de: "Dynamisch und verspielt",
    },
  },
  {
    id: "righteous",
    previewFontFamily: "Righteous_400Regular",
    bestFor: ["heading", "numeric"],
    names: { tr: "Righteous", en: "Righteous", es: "Righteous", pt: "Righteous", de: "Righteous" },
    descriptions: {
      tr: "Yuvarlak retro modern",
      en: "Rounded retro-modern",
      es: "Retromoderna y redondeada",
      pt: "Retromoderna e arredondada",
      de: "Abgerundet, retro-modern",
    },
  },
  {
    id: "bungee",
    previewFontFamily: "Bungee_400Regular",
    bestFor: ["heading"],
    names: { tr: "Bungee", en: "Bungee", es: "Bungee", pt: "Bungee", de: "Bungee" },
    descriptions: {
      tr: "Kalın afiş karakteri",
      en: "Bold poster character",
      es: "Carácter de cartel en negrita",
      pt: "Caráter de cartaz em negrito",
      de: "Fette Plakatschrift",
    },
  },
  {
    id: "audiowide",
    previewFontFamily: "Audiowide_400Regular",
    bestFor: ["heading", "numeric"],
    names: { tr: "Audiowide", en: "Audiowide", es: "Audiowide", pt: "Audiowide", de: "Audiowide" },
    descriptions: {
      tr: "Dijital ve sportif",
      en: "Digital and sporty",
      es: "Digital y deportiva",
      pt: "Digital e esportiva",
      de: "Digital und sportlich",
    },
  },
  {
    id: "barlow",
    previewFontFamily: "Barlow_700Bold",
    bestFor: ["body"],
    names: { tr: "Barlow", en: "Barlow", es: "Barlow", pt: "Barlow", de: "Barlow" },
    descriptions: { tr: "Dar ve şehirli", en: "Condensed and urban", es: "Condensada y urbana", pt: "Condensada e urbana", de: "Schmal und urban" },
  },
  {
    id: "alegreya",
    previewFontFamily: "Alegreya_700Bold",
    bestFor: ["body"],
    names: { tr: "Alegreya", en: "Alegreya", es: "Alegreya", pt: "Alegreya", de: "Alegreya" },
    descriptions: { tr: "Akıcı ve edebî serif", en: "Flowing literary serif", es: "Serif literaria y fluida", pt: "Serifa literária e fluida", de: "Fließende literarische Serife" },
  },
  {
    id: "bitter",
    previewFontFamily: "Bitter_700Bold",
    bestFor: ["body"],
    names: { tr: "Bitter", en: "Bitter", es: "Bitter", pt: "Bitter", de: "Bitter" },
    descriptions: { tr: "Tok ve köşeli slab serif", en: "Solid angular slab serif", es: "Slab serif firme y angulosa", pt: "Slab serif firme e angulosa", de: "Solide, kantige Slab-Serife" },
  },
  {
    id: "breeSerif",
    previewFontFamily: "BreeSerif_400Regular",
    bestFor: ["heading", "body"],
    names: { tr: "Bree Serif", en: "Bree Serif", es: "Bree Serif", pt: "Bree Serif", de: "Bree Serif" },
    descriptions: { tr: "Yumuşak ve kıvrımlı serif", en: "Soft curving serif", es: "Serif suave y curvada", pt: "Serifa suave e curvada", de: "Weiche, geschwungene Serife" },
  },
  {
    id: "comfortaa",
    previewFontFamily: "Comfortaa_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Comfortaa", en: "Comfortaa", es: "Comfortaa", pt: "Comfortaa", de: "Comfortaa" },
    descriptions: { tr: "Tam yuvarlak ve oyuncu", en: "Fully rounded and playful", es: "Totalmente redondeada y desenfadada", pt: "Totalmente arredondada e descontraída", de: "Rundum abgerundet und verspielt" },
  },
  {
    id: "josefinSans",
    previewFontFamily: "JosefinSans_700Bold",
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "Josefin Sans", en: "Josefin Sans", es: "Josefin Sans", pt: "Josefin Sans", de: "Josefin Sans" },
    descriptions: { tr: "İnce, uzun ve vintage", en: "Tall, refined and vintage", es: "Alta, refinada y vintage", pt: "Alta, refinada e vintage", de: "Hoch, fein und vintage" },
  },
  {
    id: "lexend",
    previewFontFamily: "Lexend_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Lexend", en: "Lexend", es: "Lexend", pt: "Lexend", de: "Lexend" },
    descriptions: { tr: "Geniş ve yüksek okunaklı", en: "Wide and highly legible", es: "Ancha y muy legible", pt: "Larga e muito legível", de: "Breit und sehr gut lesbar" },
  },
  {
    id: "quicksand",
    previewFontFamily: "Quicksand_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Quicksand", en: "Quicksand", es: "Quicksand", pt: "Quicksand", de: "Quicksand" },
    descriptions: { tr: "Hafif, yuvarlak ve modern", en: "Light, rounded and modern", es: "Ligera, redondeada y moderna", pt: "Leve, arredondada e moderna", de: "Leicht, abgerundet und modern" },
  },
  {
    id: "vollkorn",
    previewFontFamily: "Vollkorn_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Vollkorn", en: "Vollkorn", es: "Vollkorn", pt: "Vollkorn", de: "Vollkorn" },
    descriptions: { tr: "Güçlü kitap karakteri", en: "Strong bookish character", es: "Carácter fuerte de libro", pt: "Caráter forte de livro", de: "Kräftiger Buchcharakter" },
  },
  {
    id: "zillaSlab",
    previewFontFamily: "ZillaSlab_700Bold",
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "Zilla Slab", en: "Zilla Slab", es: "Zilla Slab", pt: "Zilla Slab", de: "Zilla Slab" },
    descriptions: { tr: "Modern ve belirgin slab", en: "Modern distinctive slab", es: "Slab moderna y distintiva", pt: "Slab moderna e marcante", de: "Moderne, markante Slab" },
  },
  {
    id: "robotoMono",
    previewFontFamily: "RobotoMono_700Bold",
    bestFor: ["heading"],
    names: { tr: "Roboto Mono", en: "Roboto Mono", es: "Roboto Mono", pt: "Roboto Mono", de: "Roboto Mono" },
    descriptions: { tr: "Dengeli sabit aralıklı", en: "Balanced monospaced", es: "Monoespaciada equilibrada", pt: "Monoespaçada equilibrada", de: "Ausgewogene Festbreitenschrift" },
  },
  {
    id: "ibmPlexMono",
    previewFontFamily: "IBMPlexMono_700Bold",
    bestFor: ["heading"],
    names: { tr: "IBM Plex Mono", en: "IBM Plex Mono", es: "IBM Plex Mono", pt: "IBM Plex Mono", de: "IBM Plex Mono" },
    descriptions: { tr: "Teknik sabit aralıklı", en: "Technical monospaced", es: "Monoespaciada técnica", pt: "Monoespaçada técnica", de: "Technische Festbreitenschrift" },
  },
  {
    id: "jetBrainsMono",
    previewFontFamily: "JetBrainsMono_700Bold",
    bestFor: ["heading", "body", "numeric"],
    names: { tr: "JetBrains Mono", en: "JetBrains Mono", es: "JetBrains Mono", pt: "JetBrains Mono", de: "JetBrains Mono" },
    descriptions: { tr: "Net ve güçlü rakamlar", en: "Clear and strong numerals", es: "Números claros y contundentes", pt: "Números claros e marcantes", de: "Klare und kräftige Ziffern" },
  },
  {
    id: "exo2",
    previewFontFamily: "Exo2_700Bold",
    bestFor: ["heading", "body"],
    names: { tr: "Exo 2", en: "Exo 2", es: "Exo 2", pt: "Exo 2", de: "Exo 2" },
    descriptions: { tr: "Fütüristik ama okunaklı", en: "Futuristic yet legible", es: "Futurista pero legible", pt: "Futurista, mas legível", de: "Futuristisch und doch lesbar" },
  },
  {
    id: "oxanium",
    previewFontFamily: "Oxanium_700Bold",
    bestFor: ["heading", "numeric"],
    names: { tr: "Oxanium", en: "Oxanium", es: "Oxanium", pt: "Oxanium", de: "Oxanium" },
    descriptions: { tr: "Dijital gösterge karakteri", en: "Digital display character", es: "Carácter de pantalla digital", pt: "Caráter de tela digital", de: "Charakter einer digitalen Anzeige" },
  },
  {
    id: "matemasie",
    previewFontFamily: "Matemasie_400Regular",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Matemasie", en: "Matemasie", es: "Matemasie", pt: "Matemasie", de: "Matemasie" },
    descriptions: { tr: "Organik ve deneysel", en: "Organic and experimental", es: "Orgánica y experimental", pt: "Orgânica e experimental", de: "Organisch und experimentell" },
  },
  {
    id: "novaFlat",
    previewFontFamily: "NovaFlat_400Regular",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Nova Flat", en: "Nova Flat", es: "Nova Flat", pt: "Nova Flat", de: "Nova Flat" },
    descriptions: { tr: "Kesik köşeli bilim kurgu", en: "Cut-corner sci-fi", es: "Ciencia ficción de esquinas cortadas", pt: "Ficção científica de cantos cortados", de: "Sci-Fi mit abgeschnittenen Ecken" },
  },
  {
    id: "newRocker",
    previewFontFamily: "NewRocker_400Regular",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "New Rocker", en: "New Rocker", es: "New Rocker", pt: "New Rocker", de: "New Rocker" },
    descriptions: { tr: "Gotik rock karakteri", en: "Gothic rock character", es: "Carácter rock gótico", pt: "Caráter de rock gótico", de: "Gotischer Rock-Charakter" },
  },
  {
    id: "blaka",
    previewFontFamily: "Blaka_400Regular",
    bestFor: ["heading", "body"],
    featured: true,
    names: { tr: "Blaka", en: "Blaka", es: "Blaka", pt: "Blaka", de: "Blaka" },
    descriptions: { tr: "Keskin ve yoğun display", en: "Sharp dense display", es: "Display afilada y densa", pt: "Display afiada e densa", de: "Scharfe, dichte Displayschrift" },
  },
  {
    id: "novaSquare",
    previewFontFamily: "NovaSquare_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Nova Square", en: "Nova Square", es: "Nova Square", pt: "Nova Square", de: "Nova Square" },
    descriptions: { tr: "Kare ve teknolojik", en: "Squared and technical", es: "Cuadrada y técnica", pt: "Quadrada e técnica", de: "Quadratisch und technisch" },
  },
  {
    id: "bitcountSingle",
    previewFontFamily: "BitcountSingle_700Bold",
    bestFor: ["heading", "body"],
    featured: true,
    names: { tr: "Bitcount Single", en: "Bitcount Single", es: "Bitcount Single", pt: "Bitcount Single", de: "Bitcount Single" },
    descriptions: { tr: "Piksel sayaç estetiği", en: "Pixel counter aesthetic", es: "Estética de marcador de píxeles", pt: "Estética de placar de pixels", de: "Pixelzähler-Ästhetik" },
  },
  {
    id: "kablammo",
    previewFontFamily: "Kablammo_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Kablammo", en: "Kablammo", es: "Kablammo", pt: "Kablammo", de: "Kablammo" },
    descriptions: { tr: "Patlayan çizgi roman stili", en: "Explosive comic style", es: "Estilo cómic explosivo", pt: "Estilo de quadrinhos explosivo", de: "Explosiver Comic-Stil" },
  },
  {
    id: "denkOne",
    previewFontFamily: "DenkOne_400Regular",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Denk One", en: "Denk One", es: "Denk One", pt: "Denk One", de: "Denk One" },
    descriptions: { tr: "Kalın ve kıvrımlı", en: "Bold and curving", es: "Gruesa y curvada", pt: "Grossa e curvada", de: "Fett und geschwungen" },
  },
  {
    id: "rubikGemstones",
    previewFontFamily: "RubikGemstones_400Regular",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Rubik Gemstones", en: "Rubik Gemstones", es: "Rubik Gemstones", pt: "Rubik Gemstones", de: "Rubik Gemstones" },
    descriptions: { tr: "Mücevher dokulu display", en: "Gem-textured display", es: "Display con textura de gema", pt: "Display com textura de gema", de: "Display mit Edelstein-Textur" },
  },
  {
    id: "tourney",
    previewFontFamily: "Tourney_700Bold",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Tourney", en: "Tourney", es: "Tourney", pt: "Tourney", de: "Tourney" },
    descriptions: { tr: "Çizgili spor tabelası", en: "Striped sports signage", es: "Rotulación deportiva rayada", pt: "Sinalização esportiva listrada", de: "Gestreifte Sportbeschilderung" },
  },
  {
    id: "butcherman",
    previewFontFamily: "Butcherman_400Regular",
    bestFor: ["numeric"],
    featured: true,
    names: { tr: "Butcherman", en: "Butcherman", es: "Butcherman", pt: "Butcherman", de: "Butcherman" },
    descriptions: { tr: "Korku filmi afişi", en: "Horror movie poster", es: "Cartel de película de terror", pt: "Cartaz de filme de terror", de: "Horrorfilm-Plakat" },
  },
  {
    id: "chakraPetch",
    previewFontFamily: "ChakraPetch_700Bold",
    bestFor: ["heading", "body", "numeric"],
    featured: true,
    names: { tr: "Chakra Petch", en: "Chakra Petch", es: "Chakra Petch", pt: "Chakra Petch", de: "Chakra Petch" },
    descriptions: { tr: "Köşeli dijital sans", en: "Angular digital sans", es: "Sans digital angulosa", pt: "Sans digital angulosa", de: "Kantige digitale Groteske" },
  },
  {
    id: "fascinateInline",
    previewFontFamily: "FascinateInline_400Regular",
    bestFor: ["heading"],
    featured: true,
    names: { tr: "Fascinate Inline", en: "Fascinate Inline", es: "Fascinate Inline", pt: "Fascinate Inline", de: "Fascinate Inline" },
    descriptions: { tr: "İçi çizgili retro afiş", en: "Inline retro poster", es: "Cartel retro con línea interior", pt: "Cartaz retrô com linha interna", de: "Retro-Plakat mit Innenlinie" },
  },
  {
    id: "rubikDoodleShadow",
    previewFontFamily: "RubikDoodleShadow_400Regular",
    bestFor: ["heading"],
    featured: true,
    names: { tr: "Rubik Doodle", en: "Rubik Doodle", es: "Rubik Doodle", pt: "Rubik Doodle", de: "Rubik Doodle" },
    descriptions: { tr: "Karalama gölgeli başlık", en: "Doodle-shadow heading", es: "Titular con sombra de garabato", pt: "Título com sombra de rabisco", de: "Überschrift mit Kritzel-Schatten" },
  },
  {
    id: "brunoAceSC",
    previewFontFamily: "BrunoAceSC_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Bruno Ace SC", en: "Bruno Ace SC", es: "Bruno Ace SC", pt: "Bruno Ace SC", de: "Bruno Ace SC" },
    descriptions: { tr: "Yarış ve bilim kurgu", en: "Racing sci-fi", es: "Ciencia ficción de carreras", pt: "Ficção científica de corrida", de: "Racing-Sci-Fi" },
  },
  {
    id: "climateCrisis",
    previewFontFamily: "ClimateCrisis_400Regular",
    bestFor: ["heading"],
    featured: true,
    names: { tr: "Climate Crisis", en: "Climate Crisis", es: "Climate Crisis", pt: "Climate Crisis", de: "Climate Crisis" },
    descriptions: { tr: "Ağır ve dalgalı display", en: "Heavy wavy display", es: "Display gruesa y ondulada", pt: "Display pesada e ondulada", de: "Schwere, wellige Displayschrift" },
  },
  {
    id: "ribeyeMarrow",
    previewFontFamily: "RibeyeMarrow_400Regular",
    bestFor: ["heading"],
    featured: true,
    names: { tr: "Ribeye Marrow", en: "Ribeye Marrow", es: "Ribeye Marrow", pt: "Ribeye Marrow", de: "Ribeye Marrow" },
    descriptions: { tr: "İskelet çizgili retro", en: "Skeletal-line retro", es: "Retro de línea esquelética", pt: "Retrô de linha esquelética", de: "Retro mit Skelettlinien" },
  },
  {
    id: "rubikWetPaint",
    previewFontFamily: "RubikWetPaint_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Rubik Wet Paint", en: "Rubik Wet Paint", es: "Rubik Wet Paint", pt: "Rubik Wet Paint", de: "Rubik Wet Paint" },
    descriptions: { tr: "Akan boya dokusu", en: "Dripping paint texture", es: "Textura de pintura goteando", pt: "Textura de tinta escorrendo", de: "Textur aus tropfender Farbe" },
  },
  {
    id: "sancreek",
    previewFontFamily: "Sancreek_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Sancreek", en: "Sancreek", es: "Sancreek", pt: "Sancreek", de: "Sancreek" },
    descriptions: { tr: "Süslü western gölgesi", en: "Ornate western shadow", es: "Sombra western ornamentada", pt: "Sombra western ornamentada", de: "Verzierter Western-Schatten" },
  },
  {
    id: "bungeeShade",
    previewFontFamily: "BungeeShade_400Regular",
    bestFor: ["heading", "numeric"],
    featured: true,
    names: { tr: "Bungee Shade", en: "Bungee Shade", es: "Bungee Shade", pt: "Bungee Shade", de: "Bungee Shade" },
    descriptions: { tr: "Hacimli tabela gölgesi", en: "Dimensional sign shadow", es: "Sombra de rótulo con volumen", pt: "Sombra de letreiro com volume", de: "Dimensionaler Schildschatten" },
  },
  {
    id: "gluten",
    previewFontFamily: "Gluten_700Bold",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Gluten", en: "Gluten", es: "Gluten", pt: "Gluten", de: "Gluten" },
    descriptions: { tr: "Esnek ve oyuncu yazı", en: "Flexible playful writing", es: "Escritura flexible y juguetona", pt: "Escrita flexível e brincalhona", de: "Flexible, verspielte Schrift" },
  },
  {
    id: "gloriaHallelujah",
    previewFontFamily: "GloriaHallelujah_400Regular",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Gloria Hallelujah", en: "Gloria Hallelujah", es: "Gloria Hallelujah", pt: "Gloria Hallelujah", de: "Gloria Hallelujah" },
    descriptions: { tr: "Doğal el yazısı", en: "Natural handwriting", es: "Letra manuscrita natural", pt: "Letra manuscrita natural", de: "Natürliche Handschrift" },
  },
  {
    id: "carattere",
    previewFontFamily: "Carattere_400Regular",
    bestFor: ["body", "numeric"],
    featured: true,
    names: { tr: "Carattere", en: "Carattere", es: "Carattere", pt: "Carattere", de: "Carattere" },
    descriptions: { tr: "Akıcı kaligrafik yazı", en: "Flowing calligraphic writing", es: "Escritura caligráfica fluida", pt: "Escrita caligráfica fluida", de: "Fließende kalligrafische Schrift" },
  },
  {
    id: "offside",
    previewFontFamily: "Offside_400Regular",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Offside", en: "Offside", es: "Offside", pt: "Offside", de: "Offside" },
    descriptions: { tr: "Yuvarlak teknik yazı", en: "Rounded technical writing", es: "Escritura técnica redondeada", pt: "Escrita técnica arredondada", de: "Abgerundete technische Schrift" },
  },
  {
    id: "indieFlower",
    previewFontFamily: "IndieFlower_400Regular",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Indie Flower", en: "Indie Flower", es: "Indie Flower", pt: "Indie Flower", de: "Indie Flower" },
    descriptions: { tr: "Rahat günlük el yazısı", en: "Casual diary handwriting", es: "Letra de diario, desenfadada", pt: "Letra de diário, descontraída", de: "Lockere Tagebuch-Handschrift" },
  },
  {
    id: "sairaStencilOne",
    previewFontFamily: "SairaStencilOne_400Regular",
    bestFor: ["body", "numeric"],
    featured: true,
    names: { tr: "Saira Stencil", en: "Saira Stencil", es: "Saira Stencil", pt: "Saira Stencil", de: "Saira Stencil" },
    descriptions: { tr: "Endüstriyel şablon", en: "Industrial stencil", es: "Plantilla industrial", pt: "Estêncil industrial", de: "Industrielle Schablonenschrift" },
  },
  {
    id: "courgette",
    previewFontFamily: "Courgette_400Regular",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Courgette", en: "Courgette", es: "Courgette", pt: "Courgette", de: "Courgette" },
    descriptions: { tr: "Yumuşak fırça yazısı", en: "Soft brush writing", es: "Escritura suave a pincel", pt: "Escrita suave a pincel", de: "Weiche Pinselschrift" },
  },
  {
    id: "julee",
    previewFontFamily: "Julee_400Regular",
    bestFor: ["body"],
    featured: true,
    names: { tr: "Julee", en: "Julee", es: "Julee", pt: "Julee", de: "Julee" },
    descriptions: { tr: "Hareketli el yazısı", en: "Lively handwriting", es: "Letra manuscrita animada", pt: "Letra manuscrita animada", de: "Lebhafte Handschrift" },
  },
]);

export const FONT_PRESET_BY_ID = Object.freeze(
  Object.fromEntries(FONT_PRESETS.map((preset) => [preset.id, preset])),
);

// hasOwnProperty.call: "toString" gibi prototip anahtarlarının geçerli bir
// preset gibi görünmesini engeller (Object.hasOwn Hermes sürümüne bağlı).
export const isValidPresetId = (id) =>
  typeof id === "string" &&
  Object.prototype.hasOwnProperty.call(FONT_PRESET_BY_ID, id);

// ── AİLE TABLOSU ─────────────────────────────────────────────────────────────
//
// Her ağırlık AYRI bir dosya/aile adı olarak yüklenir; RN'e fontWeight vermek
// yerine doğru aile adını veririz (aksi halde sentetik kalınlık üstüne biner).
const singleWeightFamily = (fontFamily) => ({
  normal: {
    400: fontFamily,
    500: fontFamily,
    600: fontFamily,
    700: fontFamily,
    800: fontFamily,
  },
});

// Yeni katalog ailelerinde uygulama boyutunu kontrollü tutmak için yalnız
// regular + bold dosyaları paketlenir; ara ağırlıklar en yakın dosyaya düşer.
const dualWeightFamily = (regular, bold) => ({
  normal: {
    400: regular,
    500: regular,
    600: bold,
    700: bold,
    800: bold,
  },
});

export const FONT_FAMILY_MAP = Object.freeze({
  bebasNeue: singleWeightFamily("BebasNeue_400Regular"),
  playfairDisplay: {
    normal: {
      400: "PlayfairDisplay_400Regular",
      500: "PlayfairDisplay_500Medium",
      600: "PlayfairDisplay_600SemiBold",
      700: "PlayfairDisplay_700Bold",
      800: "PlayfairDisplay_800ExtraBold",
    },
    italic: {
      400: "PlayfairDisplay_400Regular_Italic",
      500: "PlayfairDisplay_400Regular_Italic",
      600: "PlayfairDisplay_700Bold_Italic",
      700: "PlayfairDisplay_700Bold_Italic",
      800: "PlayfairDisplay_700Bold_Italic",
    },
  },
  unbounded: {
    normal: {
      400: "Unbounded_400Regular",
      500: "Unbounded_500Medium",
      600: "Unbounded_600SemiBold",
      700: "Unbounded_700Bold",
      800: "Unbounded_800ExtraBold",
    },
  },
  spaceMono: {
    normal: {
      400: "SpaceMono_400Regular",
      500: "SpaceMono_400Regular",
      600: "SpaceMono_700Bold",
      700: "SpaceMono_700Bold",
      800: "SpaceMono_700Bold",
    },
    italic: {
      400: "SpaceMono_400Regular_Italic",
      500: "SpaceMono_400Regular_Italic",
      600: "SpaceMono_700Bold_Italic",
      700: "SpaceMono_700Bold_Italic",
      800: "SpaceMono_700Bold_Italic",
    },
  },
  oswald: {
    normal: {
      400: "Oswald_400Regular",
      500: "Oswald_500Medium",
      600: "Oswald_600SemiBold",
      700: "Oswald_700Bold",
      800: "Oswald_700Bold",
    },
  },
  michroma: singleWeightFamily("Michroma_400Regular"),
  limelight: singleWeightFamily("Limelight_400Regular"),
  monoton: singleWeightFamily("Monoton_400Regular"),
  tiltWarp: singleWeightFamily("TiltWarp_400Regular"),
  righteous: singleWeightFamily("Righteous_400Regular"),
  bungee: singleWeightFamily("Bungee_400Regular"),
  audiowide: singleWeightFamily("Audiowide_400Regular"),
  barlow: dualWeightFamily("Barlow_400Regular", "Barlow_700Bold"),
  alegreya: dualWeightFamily("Alegreya_400Regular", "Alegreya_700Bold"),
  bitter: dualWeightFamily("Bitter_400Regular", "Bitter_700Bold"),
  breeSerif: singleWeightFamily("BreeSerif_400Regular"),
  comfortaa: dualWeightFamily("Comfortaa_400Regular", "Comfortaa_700Bold"),
  josefinSans: dualWeightFamily("JosefinSans_400Regular", "JosefinSans_700Bold"),
  lexend: dualWeightFamily("Lexend_400Regular", "Lexend_700Bold"),
  quicksand: dualWeightFamily("Quicksand_400Regular", "Quicksand_700Bold"),
  vollkorn: dualWeightFamily("Vollkorn_400Regular", "Vollkorn_700Bold"),
  zillaSlab: dualWeightFamily("ZillaSlab_400Regular", "ZillaSlab_700Bold"),
  robotoMono: dualWeightFamily("RobotoMono_400Regular", "RobotoMono_700Bold"),
  ibmPlexMono: dualWeightFamily("IBMPlexMono_400Regular", "IBMPlexMono_700Bold"),
  jetBrainsMono: dualWeightFamily(
    "JetBrainsMono_400Regular",
    "JetBrainsMono_700Bold",
  ),
  exo2: dualWeightFamily("Exo2_400Regular", "Exo2_700Bold"),
  oxanium: dualWeightFamily("Oxanium_400Regular", "Oxanium_700Bold"),
  matemasie: singleWeightFamily("Matemasie_400Regular"),
  novaFlat: singleWeightFamily("NovaFlat_400Regular"),
  newRocker: singleWeightFamily("NewRocker_400Regular"),
  blaka: singleWeightFamily("Blaka_400Regular"),
  novaSquare: singleWeightFamily("NovaSquare_400Regular"),
  bitcountSingle: dualWeightFamily(
    "BitcountSingle_400Regular",
    "BitcountSingle_700Bold",
  ),
  kablammo: singleWeightFamily("Kablammo_400Regular"),
  denkOne: singleWeightFamily("DenkOne_400Regular"),
  rubikGemstones: singleWeightFamily("RubikGemstones_400Regular"),
  tourney: dualWeightFamily("Tourney_400Regular", "Tourney_700Bold"),
  butcherman: singleWeightFamily("Butcherman_400Regular"),
  chakraPetch: dualWeightFamily(
    "ChakraPetch_400Regular",
    "ChakraPetch_700Bold",
  ),
  fascinateInline: singleWeightFamily("FascinateInline_400Regular"),
  rubikDoodleShadow: singleWeightFamily("RubikDoodleShadow_400Regular"),
  brunoAceSC: singleWeightFamily("BrunoAceSC_400Regular"),
  climateCrisis: singleWeightFamily("ClimateCrisis_400Regular"),
  ribeyeMarrow: singleWeightFamily("RibeyeMarrow_400Regular"),
  rubikWetPaint: singleWeightFamily("RubikWetPaint_400Regular"),
  sancreek: singleWeightFamily("Sancreek_400Regular"),
  bungeeShade: singleWeightFamily("BungeeShade_400Regular"),
  gluten: dualWeightFamily("Gluten_400Regular", "Gluten_700Bold"),
  gloriaHallelujah: singleWeightFamily("GloriaHallelujah_400Regular"),
  carattere: singleWeightFamily("Carattere_400Regular"),
  offside: singleWeightFamily("Offside_400Regular"),
  indieFlower: singleWeightFamily("IndieFlower_400Regular"),
  sairaStencilOne: singleWeightFamily("SairaStencilOne_400Regular"),
  courgette: singleWeightFamily("Courgette_400Regular"),
  julee: singleWeightFamily("Julee_400Regular"),
});

/**
 * Tabloların ürettiği TÜM aile adları. context/TypographyContext.js'teki
 * useFonts() manifesti bununla birebir aynı olmak ZORUNDA: eksik kalan bir ad
 * çalışma anında hata vermez, sessizce sistem fontuna düşer — yani "font
 * uygulanmıyor" şikayetini geri getirir. __tests__/typographyRoles.test.js bu
 * eşitliği manifest dosyasını okuyarak doğrular.
 */
export const REQUIRED_FONT_FAMILIES = Object.freeze(
  Array.from(
    new Set(
      Object.values(FONT_FAMILY_MAP).flatMap((family) =>
        Object.values(family).flatMap((variants) => Object.values(variants)),
      ),
    ),
  ).sort(),
);

// ── AĞIRLIK ──────────────────────────────────────────────────────────────────

/**
 * fontWeight'i tablo kovalarına indirger.
 * Kod tabanında üç biçim birden var: yok (=400), "bold", ve 650/850/900 gibi
 * ara değerler — üçü de doğru çözülmeli.
 */
export const normalizeWeight = (fontWeight) => {
  if (fontWeight === "bold") return 700;
  if (fontWeight === "normal") return 400;
  const parsed = Number.parseInt(fontWeight, 10);
  if (!Number.isFinite(parsed)) return 400;
  if (parsed <= 400) return 400;
  if (parsed <= 500) return 500;
  if (parsed <= 600) return 600;
  if (parsed <= 700) return 700;
  return 800;
};

// ── İÇERİK ANALİZİ ───────────────────────────────────────────────────────────

/** İçerik dizesini metne indirger; React elementleri okunamaz (null döner). */
const asText = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    let out = "";
    for (const part of value) {
      const text = asText(part);
      if (text === null) return null;
      out += text;
    }
    return out;
  }
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  return null; // React elementi vb. — içeriğe göre karar veremeyiz.
};

// Rakamın yanında duran ama onu "yazı" yapmayan glifler: para birimleri,
// yaklaşıklık/artı-eksi işaretleri, puan yıldızı, ayraçlar. Yüzde işareti
// Türkçe'de ÖNDE (%75), İngilizce'de ARKADA (75%) durur — ikisi de rakamdır.
const NUMERIC_ORNAMENTS = /[\s.,:;%+\-–—/()[\]★☆≈~<>°'"₺$€£¥#]/g;

/**
 * İçerik "rakam" mı? Süslemeler soyulduktan sonra geriye yalnızca rakam
 * kalıyorsa evet. "8.7", "%75", "★ 8.7", "≈1.234", "2026", "12:30" -> RAKAM.
 * "24 film", "3 sa 25 dk", "Sezon 2" -> rakam DEĞİL (harf var).
 */
export const isNumericContent = (value) => {
  const text = asText(value);
  if (text === null) return false;
  const stripped = text.replace(NUMERIC_ORNAMENTS, "");
  return stripped.length > 0 && /^\d+$/.test(stripped);
};

/**
 * Metinde harf var mı. `\p{L}` unicode özellik kaçışı BİLEREK kullanılmadı:
 * Hermes'te destek sürüme bağlı ve bir regex hatası uygulamayı açılışta
 * düşürür. Büyük/küçük hâli farklı olan tek şey harftir — rakam, noktalama ve
 * emoji için ikisi de aynıdır.
 */
const harfIceriyor = (text) => text.toLowerCase() !== text.toUpperCase();

/** Ne harf ne rakam: saf emoji/simge. Bunlara font uygulamak anlamsızdır. */
const isSymbolOnlyContent = (text) =>
  text.length > 0 && !/\d/.test(text) && !harfIceriyor(text);

/** Avatar baş harfi gibi tek karakterlik metin — geniş display fontu taşırır. */
const isSingleLetterContent = (text) => {
  const trimmed = text.trim();
  return trimmed.length === 1 && harfIceriyor(trimmed);
};

// ── ROL TESPİTİ ──────────────────────────────────────────────────────────────
//
// Sıralama önemli: erken kural sonrakini ezer. Eşikler kod tabanındaki 1899
// gerçek metin stili taranarak seçildi (bkz. yorumlar).
export const HEADING_MIN_SIZE = 20;
export const HEADING_SEMIBOLD_MIN_SIZE = 17;
export const HEADING_BOLD_MIN_SIZE = 15;
/** Stilde fontSize yoksa RN varsayılanı. */
export const DEFAULT_FONT_SIZE = 14;

/**
 * Bir metnin rolünü belirler.
 *
 * @param {object}  input
 * @param {string}  [input.explicitRole]  çağıranın verdiği `fontRole` — her şeyi ezer
 * @param {boolean} [input.isInput]       TextInput mi (kullanıcı yazısı)
 * @param {number}  [input.fontSize]      stildeki (veya miras alınan) punto
 * @param {*}       [input.fontWeight]    stildeki (veya miras alınan) ağırlık
 * @param {string}  [input.textTransform] stildeki textTransform
 * @param {*}       [input.content]       metnin çocukları
 * @returns {"heading"|"body"|"numeric"}
 */
export function resolveTextRole({
  explicitRole,
  isInput = false,
  fontSize,
  fontWeight,
  textTransform,
  content,
} = {}) {
  // (0) Açık karar her zaman kazanır. Otomatik kuralın yanıldığı yerler için
  //     tek kaçış kapısı budur (kullanıcının yazdığı not başlığı, anket sorusu,
  //     profil adı gibi "başlık imzalı ama kullanıcı metni" olan yerler).
  if (TEXT_ROLES.includes(explicitRole)) return explicitRole;

  const text = asText(content);

  // (1) Kullanıcının yazdığı metin asla başlık değildir. Ayrıca girdinin fontu
  //     yazılan içeriğe göre tuş tuş değişmemeli — bu yüzden içeriğe BAKMAYIZ.
  if (isInput) return "body";

  if (text !== null) {
    // (2) Saf rakam (süslemeler soyulduktan sonra) -> RAKAM.
    if (isNumericContent(text)) return "numeric";
    // (3) Saf emoji/simge veya tek harf (avatar baş harfi): gövde. Geniş bir
    //     display fontu tek harfi dairesinden taşırır, emojide zaten karşılığı
    //     olmadığı için sistem glifine düşer.
    if (isSymbolOnlyContent(text) || isSingleLetterContent(text)) return "body";
  }

  // (4) Büyük harfe çevrilmiş metin -> BAŞLIK. Uygulamadaki bölüm başlıklarının
  //     çoğu 10–14px ve AĞIRLIKSIZ; onları yakalayan tek güvenilir sinyal bu
  //     (ör. ProfileScreen sectionTitle 14/-, CalendarWidget sectionTitle 13/-).
  if (textTransform === "uppercase") return "heading";

  const size = Number.isFinite(Number(fontSize))
    ? Number(fontSize)
    : DEFAULT_FONT_SIZE;
  const weight = normalizeWeight(fontWeight);

  // (5) Punto + ağırlık eşikleri. Eski "fontSize>=13 && weight>=500" kuralı
  //     BİLEREK terk edildi: 208 gövde stilini (satır etiketi, buton yazısı,
  //     kullanıcı adı) başlık sayıyordu.
  if (size >= HEADING_MIN_SIZE) return "heading";
  if (size >= HEADING_SEMIBOLD_MIN_SIZE && weight >= 600) return "heading";
  if (size >= HEADING_BOLD_MIN_SIZE && weight >= 700) return "heading";

  return "body";
}

// ── AİLE ÇÖZÜMÜ ──────────────────────────────────────────────────────────────

/** Ailenin GERÇEK bir italik varyantı var mı (yoksa RN'in eğmesine izin verilir). */
export const hasItalicVariant = (presetId) =>
  Boolean(FONT_FAMILY_MAP[presetId]?.italic);

/**
 * İç içe <Text>'te sistem fontuna DÖNMEK için aileyi açıkça yazmak gerekir mi?
 *
 * React Native'de iç Text, dış Text'in fontFamily'sini native olarak miras alır
 * (Fabric TextAttributes::apply / Android span mirası). Bu yüzden "aile
 * yazmamak" sistem fontuna dönmek DEĞİLDİR — dış metnin özel ailesinde kalmak
 * demektir. Rolleri bağımsız seçilebilir kılmanın tek yolu, sistem rolüne düşen
 * iç parçaya platformun kendi ailesini AÇIKÇA yazmaktır.
 *
 * Örnek: BAŞLIK = Monoton, RAKAM = Sistem iken "3/5" rozet sayacı bir başlığın
 * içindeyse, aile yazılmazsa Monoton ile çizilirdi.
 */
export const needsSystemFamilyReset = (ownFamily, inheritedFamily) =>
  !ownFamily && Boolean(inheritedFamily);

/**
 * Rol + preset + ağırlıktan gerçek fontFamily adını üretir.
 * "system" preset'inde (veya bilinmeyen id'de) null döner — o zaman RN'in
 * kendi fontu ve kendi fontWeight'i olduğu gibi kalır.
 */
export function resolveFontFamily({ presetId, fontWeight, italic = false }) {
  const family = FONT_FAMILY_MAP[presetId];
  if (!family) return null;
  const variants = (italic && family.italic) || family.normal;
  const weight = normalizeWeight(fontWeight);
  return variants[weight] || variants[400] || null;
}

/** Preset bu rolde kullanılmaya uygun mu? */
export const isPresetRecommendedFor = (presetId, role) =>
  Boolean(FONT_PRESET_BY_ID[presetId]?.bestFor?.includes(role));

/** Bilinmeyen/eksik değerleri güvenli varsayılana çeken rol haritası. */
export function normalizeFontRoles(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const role of TEXT_ROLES) {
    result[role] =
      isValidPresetId(source[role]) && isPresetRecommendedFor(source[role], role)
      ? source[role]
      : DEFAULT_FONT_ROLES[role];
  }
  return result;
}

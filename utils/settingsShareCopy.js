// utils/settingsShareCopy.js
//
// "Görünümümü paylaş" metinleri (5 dil) + bölüm özetleri. Balon, gönderme ve
// uygulama sayfaları ALICININ dilinde çizer; gönderenin dili yalnız gelen kutusu
// önizlemesinde (`text`, utils/chatShare.js) kalır.
//
// Özetler saf: gövdedeki değerden kısa bir satır üretir (ör. "Okyanus · Koyu",
// "Kar, Ambiyans", "3 bölüm gizli"). Tema adları uygulama çevirilerinden (`t`).

import { copyLanguage } from "./appLanguages";
import { FONT_PRESETS, TEXT_ROLES } from "./typographyRoles";
import { familyOfTheme, LEGACY_PRESET_THEME_KEYS, parseCustomSelection } from "../theme/colors";
import { DEFAULT_TONE, isTone, toneLabel as toneLabelFor } from "../theme/toneModel";
import { countHiddenSections } from "./sectionVisibility";
import { sharedFontRolesOf, sharedThemeOf } from "./settingsShare";

export const SETTINGS_SHARE_COPY = {
  tr: {
    kicker: "Görünüm ayarları",
    from: (name) => `Paylaşan: ${name}`,
    groups: (n) => `${n} ayar grubu`,
    sections: {
      theme: "Tema",
      fonts: "Yazı tipi",
      effects: "Efektler",
      posters: "Afiş ve köşeler",
      lists: "Liste görünümü",
      home: "Ana ekran bölümleri",
    },
    descriptions: {
      theme: "Renkler ve ton",
      fonts: "Başlık, yazı ve rakam fontları",
      effects: "Kar, ambiyans ve ikon arka planı",
      posters: "Köşe yuvarlaklığı, afiş boyutu ve düzeni",
      lists: "Sütun sayısı, ızgara ve afiş rozetleri",
      home: "Gizlenen ve gösterilen raflar",
    },
    reviewAndApply: "İncele ve uygula",
    outgoingNote: "Arkadaşın istediklerini seçip uygulayabilir",
    applyToMe: "Bende uygula",
    outgoingChangedNote: "Ayarların değişti — bu görünüme geri dönebilirsin",
    applyTitle: "Ayarları uygula",
    applySubtitle: "Uygulamak istediklerini seç",
    sameAsYours: "Zaten aynı",
    premium: "Premium",
    selectAll: "Tümünü seç",
    selectNone: "Seçimi temizle",
    applySelected: (n) => (n > 0 ? `Seçilenleri uygula (${n})` : "Bir ayar seç"),
    applyNote: "Uyguladıktan sonra çıkan bildirimden geri alabilirsin.",
    cancel: "Vazgeç",
    applied: (n) => `${n} ayar grubu uygulandı`,
    appliedPartial: (n, failed) => `${n} ayar grubu uygulandı, ${failed} uygulanamadı`,
    applyFailed: "Ayarlar uygulanamadı",
    undone: "Önceki ayarların geri yüklendi",
    nothingNew: "Bu ayarların hepsi zaten sende aynı",
    shareRowTitle: "Görünümümü paylaş",
    shareRowSub: "Tema, yazı tipi ve düzeni arkadaşına gönder",
    shareTitle: "Görünümünü paylaş",
    shareSubtitle: "Göndermek istediğin ayarları seç",
    sendToChat: "Sohbete gönder",
    previewLabel: "Önizleme",
    includedLabel: "Paylaşılacaklar",
    themeNotIncluded: "Tema gönderilmeyecek",
    sendSelected: (n) => (n > 0 ? `Sohbete gönder (${n})` : "Bir ayar seç"),
    shareNote: "Arkadaşın her birini ayrı ayrı seçip uygulayabilir.",
    customTheme: "Özel tema",
    roles: { heading: "Başlık", body: "Yazı", numeric: "Rakam" },
    effects: { snow: "Kar", ambient: "Ambiyans", icon: "İkon arka planı" },
    effectsOff: "Tüm efektler kapalı",
    radius: { sharp: "Keskin köşeler", subtle: "Hafif köşeler", normal: "Normal köşeler", soft: "Yumuşak köşeler", round: "Yuvarlak köşeler" },
    allRounded: "Tüm kartlar yuvarlak",
    smallPosters: "Küçük afişler",
    xsmallPosters: "Daha küçük afişler",
    columns: (lists, seeAll) => `Listeler ${lists} sütun · Tümü ${seeAll} sütun`,
    badges: (n) => (n > 0 ? `${n} afiş rozeti` : "Afiş rozetleri kapalı"),
    hidden: (n) => (n > 0 ? `${n} bölüm gizli` : "Tüm bölümler görünür"),
  },
  en: {
    kicker: "Appearance settings",
    from: (name) => `Shared by ${name}`,
    groups: (n) => `${n} setting group${n === 1 ? "" : "s"}`,
    sections: {
      theme: "Theme",
      fonts: "Fonts",
      effects: "Effects",
      posters: "Posters & corners",
      lists: "List layout",
      home: "Home sections",
    },
    descriptions: {
      theme: "Colors and tone",
      fonts: "Heading, body and number fonts",
      effects: "Snow, ambient and icon background",
      posters: "Corner rounding, poster size and layout",
      lists: "Columns, grid and poster badges",
      home: "Hidden and visible rails",
    },
    reviewAndApply: "Review & apply",
    outgoingNote: "Your friend can pick what to apply",
    applyToMe: "Apply to me",
    outgoingChangedNote: "Your settings changed — you can switch back to this look",
    applyTitle: "Apply settings",
    applySubtitle: "Pick what you want to apply",
    sameAsYours: "Already the same",
    premium: "Premium",
    selectAll: "Select all",
    selectNone: "Clear selection",
    applySelected: (n) => (n > 0 ? `Apply selected (${n})` : "Pick a setting"),
    applyNote: "You can undo from the notification that appears after applying.",
    cancel: "Cancel",
    applied: (n) => `${n} setting group${n === 1 ? "" : "s"} applied`,
    appliedPartial: (n, failed) => `${n} applied, ${failed} couldn't be applied`,
    applyFailed: "Couldn't apply the settings",
    undone: "Your previous settings are back",
    nothingNew: "You already have all of these settings",
    shareRowTitle: "Share my look",
    shareRowSub: "Send your theme, fonts and layout to a friend",
    shareTitle: "Share your look",
    shareSubtitle: "Pick the settings you want to send",
    sendToChat: "Send to chat",
    previewLabel: "Preview",
    includedLabel: "What to share",
    themeNotIncluded: "Theme won't be sent",
    sendSelected: (n) => (n > 0 ? `Send to chat (${n})` : "Pick a setting"),
    shareNote: "Your friend can pick and apply each one separately.",
    customTheme: "Custom theme",
    roles: { heading: "Heading", body: "Body", numeric: "Numbers" },
    effects: { snow: "Snow", ambient: "Ambient", icon: "Icon background" },
    effectsOff: "All effects off",
    radius: { sharp: "Sharp corners", subtle: "Subtle corners", normal: "Normal corners", soft: "Soft corners", round: "Round corners" },
    allRounded: "All cards rounded",
    smallPosters: "Small posters",
    xsmallPosters: "Smaller posters",
    columns: (lists, seeAll) => `Lists ${lists} columns · See all ${seeAll} columns`,
    badges: (n) => (n > 0 ? `${n} poster badge${n === 1 ? "" : "s"}` : "Poster badges off"),
    hidden: (n) => (n > 0 ? `${n} section${n === 1 ? "" : "s"} hidden` : "All sections visible"),
  },
  es: {
    kicker: "Ajustes de apariencia",
    from: (name) => `Compartido por ${name}`,
    groups: (n) => `${n} grupo${n === 1 ? "" : "s"} de ajustes`,
    sections: {
      theme: "Tema",
      fonts: "Fuentes",
      effects: "Efectos",
      posters: "Pósteres y esquinas",
      lists: "Vista de listas",
      home: "Secciones de inicio",
    },
    descriptions: {
      theme: "Colores y tono",
      fonts: "Fuentes de títulos, texto y números",
      effects: "Nieve, ambiente y fondo de iconos",
      posters: "Redondeo, tamaño y disposición de pósteres",
      lists: "Columnas, cuadrícula e insignias",
      home: "Carruseles ocultos y visibles",
    },
    reviewAndApply: "Revisar y aplicar",
    outgoingNote: "Tu amigo puede elegir qué aplicar",
    applyToMe: "Aplicar en mí",
    outgoingChangedNote: "Tus ajustes cambiaron: puedes volver a este aspecto",
    applyTitle: "Aplicar ajustes",
    applySubtitle: "Elige lo que quieres aplicar",
    sameAsYours: "Ya es igual",
    premium: "Premium",
    selectAll: "Seleccionar todo",
    selectNone: "Quitar selección",
    applySelected: (n) => (n > 0 ? `Aplicar selección (${n})` : "Elige un ajuste"),
    applyNote: "Puedes deshacerlo desde la notificación que aparece al aplicar.",
    cancel: "Cancelar",
    applied: (n) => `${n} grupo${n === 1 ? "" : "s"} de ajustes aplicado${n === 1 ? "" : "s"}`,
    appliedPartial: (n, failed) => `${n} aplicados, ${failed} no se pudieron aplicar`,
    applyFailed: "No se pudieron aplicar los ajustes",
    undone: "Se restauraron tus ajustes anteriores",
    nothingNew: "Ya tienes todos estos ajustes",
    shareRowTitle: "Compartir mi apariencia",
    shareRowSub: "Envía tu tema, fuentes y diseño a un amigo",
    shareTitle: "Compartir tu apariencia",
    shareSubtitle: "Elige los ajustes que quieres enviar",
    sendToChat: "Enviar al chat",
    previewLabel: "Vista previa",
    includedLabel: "Qué compartir",
    themeNotIncluded: "El tema no se enviará",
    sendSelected: (n) => (n > 0 ? `Enviar al chat (${n})` : "Elige un ajuste"),
    shareNote: "Tu amigo puede elegir y aplicar cada uno por separado.",
    customTheme: "Tema personalizado",
    roles: { heading: "Título", body: "Texto", numeric: "Números" },
    effects: { snow: "Nieve", ambient: "Ambiente", icon: "Fondo de iconos" },
    effectsOff: "Todos los efectos desactivados",
    radius: { sharp: "Esquinas rectas", subtle: "Esquinas leves", normal: "Esquinas normales", soft: "Esquinas suaves", round: "Esquinas redondas" },
    allRounded: "Todas las tarjetas redondeadas",
    smallPosters: "Pósteres pequeños",
    xsmallPosters: "Pósteres más pequeños",
    columns: (lists, seeAll) => `Listas ${lists} columnas · Ver todo ${seeAll} columnas`,
    badges: (n) => (n > 0 ? `${n} insignia${n === 1 ? "" : "s"} de póster` : "Insignias desactivadas"),
    hidden: (n) => (n > 0 ? `${n} sección${n === 1 ? "" : "es"} oculta${n === 1 ? "" : "s"}` : "Todas las secciones visibles"),
  },
  pt: {
    kicker: "Ajustes de aparência",
    from: (name) => `Compartilhado por ${name}`,
    groups: (n) => `${n} grupo${n === 1 ? "" : "s"} de ajustes`,
    sections: {
      theme: "Tema",
      fonts: "Fontes",
      effects: "Efeitos",
      posters: "Pôsteres e cantos",
      lists: "Visual das listas",
      home: "Seções da tela inicial",
    },
    descriptions: {
      theme: "Cores e tom",
      fonts: "Fontes de títulos, texto e números",
      effects: "Neve, ambiente e fundo de ícones",
      posters: "Arredondamento, tamanho e layout dos pôsteres",
      lists: "Colunas, grade e selos dos pôsteres",
      home: "Faixas ocultas e visíveis",
    },
    reviewAndApply: "Revisar e aplicar",
    outgoingNote: "Seu amigo pode escolher o que aplicar",
    applyToMe: "Aplicar em mim",
    outgoingChangedNote: "Suas configurações mudaram — você pode voltar a este visual",
    applyTitle: "Aplicar ajustes",
    applySubtitle: "Escolha o que você quer aplicar",
    sameAsYours: "Já é igual",
    premium: "Premium",
    selectAll: "Selecionar tudo",
    selectNone: "Limpar seleção",
    applySelected: (n) => (n > 0 ? `Aplicar seleção (${n})` : "Escolha um ajuste"),
    applyNote: "Você pode desfazer pela notificação que aparece depois de aplicar.",
    cancel: "Cancelar",
    applied: (n) => `${n} grupo${n === 1 ? "" : "s"} de ajustes aplicado${n === 1 ? "" : "s"}`,
    appliedPartial: (n, failed) => `${n} aplicados, ${failed} não puderam ser aplicados`,
    applyFailed: "Não foi possível aplicar os ajustes",
    undone: "Seus ajustes anteriores voltaram",
    nothingNew: "Você já tem todos esses ajustes",
    shareRowTitle: "Compartilhar meu visual",
    shareRowSub: "Envie seu tema, fontes e layout para um amigo",
    shareTitle: "Compartilhar seu visual",
    shareSubtitle: "Escolha os ajustes que quer enviar",
    sendToChat: "Enviar no chat",
    previewLabel: "Prévia",
    includedLabel: "O que compartilhar",
    themeNotIncluded: "O tema não será enviado",
    sendSelected: (n) => (n > 0 ? `Enviar no chat (${n})` : "Escolha um ajuste"),
    shareNote: "Seu amigo pode escolher e aplicar cada um separadamente.",
    customTheme: "Tema personalizado",
    roles: { heading: "Título", body: "Texto", numeric: "Números" },
    effects: { snow: "Neve", ambient: "Ambiente", icon: "Fundo de ícones" },
    effectsOff: "Todos os efeitos desligados",
    radius: { sharp: "Cantos retos", subtle: "Cantos leves", normal: "Cantos normais", soft: "Cantos suaves", round: "Cantos redondos" },
    allRounded: "Todos os cartões arredondados",
    smallPosters: "Pôsteres pequenos",
    xsmallPosters: "Pôsteres menores",
    columns: (lists, seeAll) => `Listas ${lists} colunas · Ver tudo ${seeAll} colunas`,
    badges: (n) => (n > 0 ? `${n} selo${n === 1 ? "" : "s"} de pôster` : "Selos desligados"),
    hidden: (n) => (n > 0 ? `${n} seç${n === 1 ? "ão oculta" : "ões ocultas"}` : "Todas as seções visíveis"),
  },
  de: {
    kicker: "Darstellung",
    from: (name) => `Geteilt von ${name}`,
    groups: (n) => `${n} Einstellungsgruppe${n === 1 ? "" : "n"}`,
    sections: {
      theme: "Design",
      fonts: "Schriften",
      effects: "Effekte",
      posters: "Poster & Ecken",
      lists: "Listenansicht",
      home: "Startseiten-Bereiche",
    },
    descriptions: {
      theme: "Farben und Ton",
      fonts: "Schriften für Titel, Text und Zahlen",
      effects: "Schnee, Ambiente und Symbolhintergrund",
      posters: "Eckenrundung, Postergröße und Anordnung",
      lists: "Spalten, Raster und Poster-Abzeichen",
      home: "Ausgeblendete und sichtbare Reihen",
    },
    reviewAndApply: "Ansehen & übernehmen",
    outgoingNote: "Dein Freund kann auswählen, was er übernimmt",
    applyToMe: "Bei mir übernehmen",
    outgoingChangedNote: "Deine Einstellungen haben sich geändert – du kannst zu diesem Look zurück",
    applyTitle: "Einstellungen übernehmen",
    applySubtitle: "Wähle aus, was du übernehmen möchtest",
    sameAsYours: "Bereits gleich",
    premium: "Premium",
    selectAll: "Alle auswählen",
    selectNone: "Auswahl aufheben",
    applySelected: (n) => (n > 0 ? `Auswahl übernehmen (${n})` : "Wähle eine Einstellung"),
    applyNote: "Du kannst es über die Meldung nach dem Übernehmen rückgängig machen.",
    cancel: "Abbrechen",
    applied: (n) => `${n} Einstellungsgruppe${n === 1 ? "" : "n"} übernommen`,
    appliedPartial: (n, failed) => `${n} übernommen, ${failed} nicht möglich`,
    applyFailed: "Einstellungen konnten nicht übernommen werden",
    undone: "Deine vorherigen Einstellungen sind zurück",
    nothingNew: "Du hast all diese Einstellungen bereits",
    shareRowTitle: "Meinen Look teilen",
    shareRowSub: "Sende Design, Schriften und Layout an Freunde",
    shareTitle: "Deinen Look teilen",
    shareSubtitle: "Wähle die Einstellungen, die du senden möchtest",
    sendToChat: "In den Chat senden",
    previewLabel: "Vorschau",
    includedLabel: "Was geteilt wird",
    themeNotIncluded: "Design wird nicht gesendet",
    sendSelected: (n) => (n > 0 ? `In den Chat senden (${n})` : "Wähle eine Einstellung"),
    shareNote: "Dein Freund kann jede einzeln auswählen und übernehmen.",
    customTheme: "Eigenes Design",
    roles: { heading: "Titel", body: "Text", numeric: "Zahlen" },
    effects: { snow: "Schnee", ambient: "Ambiente", icon: "Symbolhintergrund" },
    effectsOff: "Alle Effekte aus",
    radius: { sharp: "Eckige Ecken", subtle: "Leicht gerundete Ecken", normal: "Normale Ecken", soft: "Weiche Ecken", round: "Runde Ecken" },
    allRounded: "Alle Karten abgerundet",
    smallPosters: "Kleine Poster",
    xsmallPosters: "Kleinere Poster",
    columns: (lists, seeAll) => `Listen ${lists} Spalten · Alle ${seeAll} Spalten`,
    badges: (n) => (n > 0 ? `${n} Poster-Abzeichen` : "Poster-Abzeichen aus"),
    hidden: (n) => (n > 0 ? `${n} Bereich${n === 1 ? "" : "e"} ausgeblendet` : "Alle Bereiche sichtbar"),
  },

  it: {
  kicker: "Impostazioni aspetto",
  from: name => `Condiviso da ${name}`,
  groups: n => `${n} gruppo di impostazioni${n === 1 ? "" : "s"}`,
  sections: {
    theme: "Tema",
    fonts: "Caratteri",
    effects: "Effetti",
    posters: "Poster e angoli",
    lists: "Layout elenco",
    home: "Sezioni home"
  },
  descriptions: {
    theme: "Colori e toni",
    fonts: "Caratteri di intestazione, corpo e numeri",
    effects: "Sfondo neve, ambiente e icone",
    posters: "Arrotondamento angoli, dimensioni e layout del poster",
    lists: "Colonne, griglia e badge poster",
    home: "Binari nascosti e visibili"
  },
  reviewAndApply: "Rivedi e applica",
  outgoingNote: "Il tuo amico può scegliere cosa applicare",
  applyToMe: "Candidati a me",
  outgoingChangedNote: "Le tue impostazioni sono cambiate: puoi tornare a questo aspetto",
  applyTitle: "Applica impostazioni",
  applySubtitle: "Scegli cosa vuoi applicare",
  sameAsYours: "Già lo stesso",
  premium: "Premium",
  selectAll: "Seleziona tutto",
  selectNone: "Cancella selezione",
  applySelected: n => n > 0 ? `Applica selezionato (${n})` : "Scegli un'impostazione",
  applyNote: "Puoi annullare dalla notifica visualizzata dopo l'applicazione.",
  cancel: "Annulla",
  applied: n => `${n} gruppo di impostazioni${n === 1 ? "" : "s"} applicato`,
  appliedPartial: (n, failed) => `${n} applicato, ${failed} non può essere applicato`,
  applyFailed: "Impossibile applicare le impostazioni",
  undone: "Le tue impostazioni precedenti sono tornate",
  nothingNew: "Disponi già di tutte queste impostazioni",
  shareRowTitle: "Condividi il mio look",
  shareRowSub: "Invia il tema, i caratteri e il layout a un amico",
  shareTitle: "Condividi il tuo look",
  shareSubtitle: "Scegli le impostazioni che desideri inviare",
  sendToChat: "Invia alla chat",
  previewLabel: "Anteprima",
  includedLabel: "Cosa condividere",
  themeNotIncluded: "Il tema non verrà inviato",
  sendSelected: n => n > 0 ? `Invia alla chat (${n})` : "Scegli un'impostazione",
  shareNote: "Il tuo amico può sceglierli e applicarli separatamente.",
  customTheme: "Tema personalizzato",
  roles: {
    heading: "Intestazione",
    body: "Corpo",
    numeric: "Numeri"
  },
  effects: {
    snow: "Neve",
    ambient: "Ambiente",
    icon: "Icon background"
  },
  effectsOff: "Tutti gli effetti disattivati",
  radius: {
    sharp: "Angoli vivi",
    subtle: "Angoli sottili",
    normal: "Angoli normali",
    soft: "Angoli morbidi",
    round: "Angoli arrotondati"
  },
  allRounded: "Tutte le carte arrotondate",
  smallPosters: "Poster piccoli",
  xsmallPosters: "Poster più piccoli",
  columns: (lists, seeAll) => `Elenchi ${lists} colonne · Visualizza tutte le ${seeAll} colonne`,
  badges: n => n > 0 ? `${n} badge poster${n === 1 ? "" : "s"}` : "Distintivi poster disattivati",
  hidden: n => n > 0 ? `${n} sezione${n === 1 ? "" : "s"} nascosta` : "Tutte le sezioni visibili"
},
  fr: {
    kicker: "Réglages d'apparence",
    from: (name) => `Partagé par ${name}`,
    groups: (n) => `${n} groupe${n === 1 ? "" : "s"} de réglages`,
    sections: {
      theme: "Thème",
      fonts: "Polices",
      effects: "Effets",
      posters: "Affiches et coins",
      lists: "Disposition des listes",
      home: "Sections de l'accueil",
    },
    descriptions: {
      theme: "Couleurs et ton",
      fonts: "Polices des titres, du texte et des chiffres",
      effects: "Neige, ambiance et fond d'icônes",
      posters: "Arrondi des coins, taille et disposition des affiches",
      lists: "Colonnes, grille et badges d'affiche",
      home: "Sections masquées et visibles",
    },
    reviewAndApply: "Vérifier et appliquer",
    outgoingNote: "Ton ami peut choisir ce qu'il applique",
    applyToMe: "Appliquer chez moi",
    outgoingChangedNote: "Tes réglages ont changé — tu peux revenir à ce style",
    applyTitle: "Appliquer les réglages",
    applySubtitle: "Choisis ce que tu veux appliquer",
    sameAsYours: "Déjà identique",
    premium: "Premium",
    selectAll: "Tout sélectionner",
    selectNone: "Effacer la sélection",
    applySelected: (n) => (n > 0 ? `Appliquer la sélection (${n})` : "Choisis un réglage"),
    applyNote: "Tu peux annuler depuis la notification qui apparaît après l'application.",
    cancel: "Annuler",
    applied: (n) => `Appliqué : ${n} groupe${n === 1 ? "" : "s"} de réglages`,
    appliedPartial: (n, failed) => `${n} appliqués, ${failed} n'ont pas pu être appliqués`,
    applyFailed: "Impossible d'appliquer les réglages",
    undone: "Tes réglages précédents sont rétablis",
    nothingNew: "Tu as déjà tous ces réglages",
    shareRowTitle: "Partager mon style",
    shareRowSub: "Envoie ton thème, tes polices et ta disposition à un ami",
    shareTitle: "Partage ton style",
    shareSubtitle: "Choisis les réglages à envoyer",
    sendToChat: "Envoyer dans une discussion",
    previewLabel: "Aperçu",
    includedLabel: "Quoi partager",
    themeNotIncluded: "Le thème ne sera pas envoyé",
    sendSelected: (n) => (n > 0 ? `Envoyer dans la discussion (${n})` : "Choisis un réglage"),
    shareNote: "Ton ami peut choisir et appliquer chacun séparément.",
    customTheme: "Thème personnalisé",
    roles: { heading: "Titre", body: "Texte", numeric: "Chiffres" },
    effects: { snow: "Neige", ambient: "Ambiance", icon: "Icon background" },
    effectsOff: "Tous les effets désactivés",
    radius: { sharp: "Coins nets", subtle: "Coins discrets", normal: "Coins normaux", soft: "Coins doux", round: "Coins ronds" },
    allRounded: "Toutes les cartes arrondies",
    smallPosters: "Petites affiches",
    xsmallPosters: "Affiches plus petites",
    columns: (lists, seeAll) => `Listes ${lists} colonnes · Tout voir ${seeAll} colonnes`,
    badges: (n) => (n > 0 ? `${n} badge${n === 1 ? "" : "s"} d'affiche` : "Badges d'affiche désactivés"),
    hidden: (n) => (n > 0 ? `Masqué : ${n} section${n === 1 ? "" : "s"}` : "Toutes les sections visibles"),
  },
  ja: {
    kicker: "外観設定",
    from: (name) => `${name}さんがシェア`,
    groups: (n) => `設定グループ${n}件${n === 1 ? "" : ""}`,
    sections: {
      theme: "テーマ",
      fonts: "フォント",
      effects: "エフェクト",
      posters: "ポスターと角",
      lists: "リストのレイアウト",
      home: "ホームのセクション",
    },
    descriptions: {
      theme: "色とトーン",
      fonts: "見出し、本文、数字のフォント",
      effects: "雪、アンビエント、アイコン背景",
      posters: "角の丸み、ポスターのサイズ、レイアウト",
      lists: "列数、グリッド、ポスターバッジ",
      home: "非表示と表示のレール",
    },
    reviewAndApply: "確認して適用",
    outgoingNote: "友だちは適用する項目を選べます",
    applyToMe: "自分に適用",
    outgoingChangedNote: "設定が変わりました — この見た目に戻せます",
    applyTitle: "設定を適用",
    applySubtitle: "適用したい項目を選んでください",
    sameAsYours: "すでに同じです",
    premium: "Premium",
    selectAll: "すべて選択",
    selectNone: "選択を解除",
    applySelected: (n) => (n > 0 ? `選択した項目を適用(${n})` : "設定を選んでください"),
    applyNote: "適用後に表示される通知から元に戻せます。",
    cancel: "キャンセル",
    applied: (n) => `設定グループ${n}件${n === 1 ? "" : ""}を適用しました`,
    appliedPartial: (n, failed) => `${n}件適用、${failed}件は適用できませんでした`,
    applyFailed: "設定を適用できませんでした",
    undone: "以前の設定に戻しました",
    nothingNew: "これらの設定はすべて適用済みです",
    shareRowTitle: "自分の見た目をシェア",
    shareRowSub: "テーマ、フォント、レイアウトを友だちに送る",
    shareTitle: "見た目をシェア",
    shareSubtitle: "送りたい設定を選んでください",
    sendToChat: "チャットに送信",
    previewLabel: "プレビュー",
    includedLabel: "シェアする内容",
    themeNotIncluded: "テーマは送信されません",
    sendSelected: (n) => (n > 0 ? `チャットに送信(${n})` : "設定を選んでください"),
    shareNote: "友だちは各項目を個別に選んで適用できます。",
    customTheme: "カスタムテーマ",
    roles: { heading: "見出し", body: "本文", numeric: "数字" },
    effects: { snow: "雪", ambient: "アンビエンス", icon: "Icon background" },
    effectsOff: "すべてのエフェクトがオフ",
    radius: { sharp: "シャープな角", subtle: "控えめな角", normal: "普通の角", soft: "やわらかい角", round: "丸い角" },
    allRounded: "すべてのカードを丸く",
    smallPosters: "小さいポスター",
    xsmallPosters: "より小さいポスター",
    columns: (lists, seeAll) => `リスト${lists}列 · すべて見る${seeAll}列`,
    badges: (n) => (n > 0 ? `ポスターバッジ${n}件${n === 1 ? "" : ""}` : "ポスターバッジはオフ"),
    hidden: (n) => (n > 0 ? `${n}セクション${n === 1 ? "" : ""}を非表示` : "すべてのセクションを表示中"),
  }};

export const getSettingsShareCopy = (language) =>
  SETTINGS_SHARE_COPY[copyLanguage(language, Object.keys(SETTINGS_SHARE_COPY))];

const LEGACY_LABEL_KEYS = { purple: "purpleTheme", amber: "amberTheme" };

const toneLabel = (tone, t) => (isTone(tone) ? toneLabelFor(t, tone) : "");

/** Paylaşılan temanın adı ve tonu ("Mavi · Koyu", "Okyanus · Açık", "Gece Moru"). */
export function themeLabel(share, { language, t } = {}) {
  const shared = sharedThemeOf(share);
  if (!shared) return "";
  const copy = getSettingsShareCopy(language);
  if (shared.entry) {
    const tone = parseCustomSelection(shared.selection)?.tone || DEFAULT_TONE;
    return [shared.entry.name || copy.customTheme, toneLabel(tone, t)].filter(Boolean).join(" · ");
  }
  const family = familyOfTheme(shared.builtin);
  if (family) {
    const name = t?.[family.family.labelKey] || family.family.fallback;
    return `${name} · ${toneLabel(family.tone, t)}`;
  }
  if (LEGACY_PRESET_THEME_KEYS.includes(shared.builtin)) return t?.[LEGACY_LABEL_KEYS[shared.builtin]] || shared.builtin;
  return shared.builtin;
}

/** Yazı tipi preset'inin bu dildeki adı. */
export function fontName(presetId, language) {
  const preset = FONT_PRESETS.find((item) => item.id === presetId);
  if (!preset) return presetId;
  return preset.names[copyLanguage(language, Object.keys(preset.names))] || preset.names.en || presetId;
}

/** Yazı tipi preset'inin önizleme ailesi (sistem fontunda null). */
export function fontFamilyOf(presetId) {
  return FONT_PRESETS.find((item) => item.id === presetId)?.previewFontFamily || null;
}

function fontsSummary(share, language, copy) {
  const roles = sharedFontRolesOf(share);
  if (!roles) return "";
  const names = TEXT_ROLES.map((role) => fontName(roles[role], language));
  // Üç rol aynı fontsa tek ad yeter.
  if (names.every((name) => name === names[0])) return names[0];
  return TEXT_ROLES.map((role, index) => `${copy.roles[role]} ${names[index]}`).join(" · ");
}

function effectsSummary(values, copy) {
  const on = [
    values.showSnow === true ? copy.effects.snow : null,
    values.showAmbientBackground === true ? copy.effects.ambient : null,
    values.showIconBackground === true ? copy.effects.icon : null,
  ].filter(Boolean);
  return on.length ? on.join(", ") : copy.effectsOff;
}

// Kademe adları utils/posterCorners ile aynı sırada (grid ölçeği 2/6/10/15/20).
const RADIUS_BUCKET = { 2: "sharp", 6: "subtle", 10: "normal", 15: "soft", 20: "round" };

function postersSummary(values, copy) {
  const parts = [];
  const bucket = RADIUS_BUCKET[values.listsPosterRadius];
  if (bucket) parts.push(copy.radius[bucket]);
  if (values.allCornersRounded === true) parts.push(copy.allRounded);
  if (values.railPosterSize === "small") parts.push(copy.smallPosters);
  else if (values.railPosterSize === "xsmall") parts.push(copy.xsmallPosters);
  return parts.join(" · ");
}

function listsSummary(values, copy) {
  const parts = [];
  if (values.listsGridColumns || values.seeAllGridColumns) {
    parts.push(copy.columns(values.listsGridColumns || 3, values.seeAllGridColumns || 3));
  }
  if (values.posterBadges && typeof values.posterBadges === "object") {
    parts.push(copy.badges(Object.values(values.posterBadges).filter((v) => v === true).length));
  } else if (typeof values.posterBadges === "boolean") {
    parts.push(copy.badges(values.posterBadges ? 1 : 0));
  }
  return parts.join(" · ");
}

/**
 * Bölümün kısa özeti (satırın alt yazısı). Değer yoksa bölüm açıklamasına düşer.
 * @param {object} share  sanitizeSettingsShare çıktısı
 */
export function sectionSummary(share, sectionId, { language, t } = {}) {
  const copy = getSettingsShareCopy(language);
  const values = share?.sections?.[sectionId];
  if (!values) return copy.descriptions[sectionId] || "";
  let line = "";
  if (sectionId === "theme") line = themeLabel(share, { language, t });
  else if (sectionId === "fonts") line = fontsSummary(share, language, copy);
  else if (sectionId === "effects") line = effectsSummary(values, copy);
  else if (sectionId === "posters") line = postersSummary(values, copy);
  else if (sectionId === "lists") line = listsSummary(values, copy);
  else if (sectionId === "home") line = copy.hidden(countHiddenSections(values.sectionVisibility));
  return line || copy.descriptions[sectionId] || "";
}

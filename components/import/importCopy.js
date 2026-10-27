// components/import/importCopy.js
//
// Letterboxd / IMDb içe aktarma akışının TÜM kullanıcı metinleri (Ayarlar satırı, içe aktarma
// sayfası, yardım sayfası, hata iletileri). Eskiden dosyalara sabit Türkçe gömülüydü; yabancı
// dil kullanıcısı akışın talimatlarını ve hatalarını kendi dilinde göremiyordu.
//
// Seçici: `getImportCopy(language)` (bilinmeyen dil → İngilizce).
// Metinlerde `**kalın**` işareti vardır: ekran bunu `renderRich` ile kalın/vurgulu parçalara böler
// (dosya adları dilin kendi cümlesinde istediği yere konabilsin diye).
//
// Hata iletileri: servisler (`services/import/*`) `ImportError(code)` fırlatır; ekran
// `importErrorText(error, copy)` ile kodu bu tablodan çözer. Servis metni arayüze sızmaz.

import { copyLanguage } from "../../utils/appLanguages";

const TR = {
  rowTitle: "Letterboxd & IMDb'den aktar",
  rowSub: "İzleme geçmişini ve puanlarını Seelogd'a taşı",
  title: "Letterboxd / IMDb aktar",
  inputDesc:
    "İndirdiğin ZIP dosyasını veya CSV'leri seç. İzlenenler, puanlar, incelemeler ve izleme listesi mevcut kayıtların korunarak birleştirilir.",
  howTo: "Nasıl alınır?",
  pickBtn: "Letterboxd ZIP veya CSV seç",
  autoPackLead: "Otomatik paket çözücü:",
  autoPackBody:
    "ZIP arşivindeki **watched.csv**, **diary.csv**, **ratings.csv** ve **watchlist.csv** otomatik taranır.",
  orPaste: "VEYA METİN OLARAK YAPIŞTIR",
  pastePlaceholder: "CSV metnini buraya yapıştır...",
  pasteBtn: "Panodan yapıştır",
  parseBtn: "Verileri ayrıştır ve önizle",
  clipboardName: "Pano içeriği",
  pastedTextName: "Yapıştırılan metin",
  csvFileName: "CSV dosyası",

  bundleDetected: "Letterboxd paketi algılandı",
  customLists: "Özel Letterboxd listeleri",
  customListsMeta: (lists, items) => `${lists} liste · ${items} içerik`,
  watchedMovies: "İzlenen filmler",
  watchlist: "İzleme listesi",
  ratingsBadge: (n) => `⭐ ${n} film puanı`,
  reviewsBadge: (n) => `✍️ ${n} inceleme`,
  sampleTitle: "Örnek içerikler:",
  fileDetected: (source) => `${source} dosyası algılandı`,
  totalItems: "Toplam içerik",
  singleRatings: (n) => `⭐ ${n} puan`,
  targetTitle: "Hedef listeyi seç:",
  targetWatched: "İzlenenler",
  targetWatchlist: "İzleme listesi",
  targetFavorites: "Favoriler",
  back: "Geri dön",
  start: (n) => `Aktarımı başlat (${n})`,

  matching: "İçerikler TMDB ile eşleştiriliyor...",
  matchingProgress: (current, total, item) => `Eşleştiriliyor: ${current} / ${total}\n${item}`,
  saving: "Seelogd listelerine, puanlarına ve incelemelerine kaydediliyor...",
  savingProgress: (saved, total) => `Kaydediliyor: ${saved} / ${total}`,
  mergingLists: "Özel Letterboxd listeleri birleştiriliyor...",
  percent: (n) => `%${n}`,
  importingTitle: "Kütüphanen hazırlanıyor",
  importingHint: "Uygulamadan çıkmadan işlemin tamamlanmasını bekle.",
  stageMatching: "Eşleştir",
  stageSaving: "Kaydet",
  stageLists: "Listeler",

  successTitle: "Aktarım başarıyla tamamlandı!",
  resultDetails: "Aktarım özeti",
  successTotal: (n) => `Toplam **${n}** içerik güvenle işlendi.`,
  addedWatchEvents: (n) => `🎬 ${n} eksik izleme kaydı eklendi.`,
  addedRatings: (n) => `⭐ ${n} eksik puan profiline işlendi.`,
  addedReviews: (n) => `✍️ ${n} eksik inceleme yorumlarına aktarıldı.`,
  preserved: "🛡️ Mevcut puan ve yorumların değiştirilmedi.",
  unchanged: (n) => `✓ ${n} içerik zaten günceldi.`,
  checkedWatchlist: (n) => `📌 ${n} izleme listesi kaydı kontrol edildi.`,
  checkedFavorites: (n) => `❤️ ${n} favori kaydı kontrol edildi.`,
  mergedCustomLists: (lists, items) => `📚 ${lists} özel liste, ${items} yeni içerikle birleştirildi.`,
  skippedUnmatched: (n) => `⚠️ ${n} içerik TMDB ile eşleşmediği için atlandı.`,
  done: "Tamam",

  pasteEmpty: "Lütfen geçerli bir CSV verisi gir.",
  invalidFileTitle: "Geçersiz dosya biçimi",
  invalidFileBody: "Seçilen dosya metin tabanlı bir CSV dosyası değil.",
  csvErrorTitle: "CSV doğrulama hatası",
  csvErrorFallback: "Lütfen dosya biçimini kontrol et.",
  loadedTitle: (name) => `${name} yüklendi`,
  loadedBody: (n) => `${n} içerik başarıyla ayrıştırıldı.`,
  clipboardEmpty: "Panoda yapıştırılacak metin bulunamadı.",
  bundleLoadedTitle: "Letterboxd paketi yüklendi",
  bundleLoadedBody: (items, ratings) => `${items} içerik ve ${ratings} puan tespit edildi.`,
  filesMergedTitle: "Letterboxd dosyaları birleştirildi",
  filesMergedBody: (n) => `${n} içerik hazırlandı.`,
  emptyFileTitle: "Dosya boş",
  emptyFileBody: "Seçilen dosyanın içi boş görünüyor.",
  loadFailedTitle: "İçerik yüklenemedi",
  loadFailedFallback: "Lütfen geçerli bir ZIP veya CSV dosyası seç.",
  nothingToImport: "Aktarılacak içerik bulunamadı.",
  importFailedTitle: "İçe aktarma sırasında hata oluştu",
  importFailedBody: (message) =>
    `${message} Tamamlanan kayıtlar korunur; güvenle yeniden deneyebilirsin.`,
  unexpected: "Beklenmeyen bir hata oluştu.",

  errors: {
    zipOpen: "ZIP arşivi açılamadı. Dosya bozuk olabilir; yeniden indirmeyi dene.",
    notLetterboxdCsv: "Geçerli bir Letterboxd CSV biçimi bulunamadı.",
    notImdbCsv: "Geçerli bir IMDb CSV biçimi bulunamadı.",
    noBundle: "Geçerli bir Letterboxd dosya paketi bulunamadı.",
    noBundleItems: "Pakette aktarılabilecek geçerli bir film verisi bulunamadı.",
    zipNoCsv: "ZIP arşivinde CSV biçiminde dosya bulunamadı.",
    emptyHeaders: "Dosya boş veya sütun başlıkları okunamadı.",
    unrecognizedCsv:
      "Uyumsuz CSV biçimi! Bu dosya Letterboxd veya IMDb dışa aktarımına ait görünmüyor. Lütfen Letterboxd ZIP dosyasını veya doğru CSV'yi seç.",
    noItemsInFile: "Dosyada aktarılabilecek film veya dizi kaydı bulunamadı.",
    noTmdbMatch: "TMDB veritabanında eşleşen film bulunamadı.",
  },

  help: {
    title: "Dışa aktarma rehberi",
    tipLead: "İpucu: ",
    tipBody:
      "CSV dosyanı doğrudan telefonuna indirip \"{{pick}}\" düğmesine dokunarak saniyeler içinde içe aktarabilirsin.",
    letterboxd: [
      {
        title: "Ayarlara git",
        body: "Letterboxd web sitesinde profil simgene dokun ve **Settings** (Ayarlar) sayfasını aç.",
      },
      {
        title: "Export Your Data (Verilerini dışa aktar)",
        body: "**Import & Export** sekmesine dokun ve **Export Your Data** düğmesine bas.",
      },
      {
        title: "ZIP veya CSV dosyasını seç",
        body: "İndirdiğin **.zip** dosyasını doğrudan seçebilirsin. Uygulama **watched.csv**, **diary.csv**, **ratings.csv** ve **watchlist.csv** dosyalarını otomatik tarar.",
      },
    ],
    imdb: [
      {
        title: "IMDb listene git",
        body: "IMDb web sitesinde **Your Ratings** (Puanların) veya **Your Watchlist** sayfasına git.",
      },
      {
        title: "Dışa aktar (Export) düğmesine dokun",
        body: "Listenin sağ üst köşesindeki üç nokta menüsünden veya sayfanın sonundaki **Export** seçeneğinden dışa aktar.",
      },
      {
        title: "Seelogd'a yükle",
        body: "İnen **ratings.csv** dosyasını \"{{pick}}\" düğmesine dokunarak doğrudan seç.",
      },
    ],
  },
};

const EN = {
  rowTitle: "Import from Letterboxd & IMDb",
  rowSub: "Bring your watch history and ratings into Seelogd",
  title: "Import Letterboxd / IMDb",
  inputDesc:
    "Pick the ZIP file or CSVs you downloaded. Watched titles, ratings, reviews and your watchlist are merged without overwriting what you already have.",
  howTo: "How to get it?",
  pickBtn: "Choose Letterboxd ZIP or CSV",
  autoPackLead: "Automatic bundle reader:",
  autoPackBody:
    "**watched.csv**, **diary.csv**, **ratings.csv** and **watchlist.csv** inside the ZIP are scanned automatically.",
  orPaste: "OR PASTE AS TEXT",
  pastePlaceholder: "Paste your CSV text here...",
  pasteBtn: "Paste from clipboard",
  parseBtn: "Parse data & preview",
  clipboardName: "Clipboard content",
  pastedTextName: "Pasted text",
  csvFileName: "CSV file",

  bundleDetected: "Letterboxd bundle detected",
  customLists: "Custom Letterboxd lists",
  customListsMeta: (lists, items) => `${lists} lists · ${items} titles`,
  watchedMovies: "Watched movies",
  watchlist: "Watchlist",
  ratingsBadge: (n) => `⭐ ${n} movie ratings`,
  reviewsBadge: (n) => `✍️ ${n} reviews`,
  sampleTitle: "Sample titles:",
  fileDetected: (source) => `${source} file detected`,
  totalItems: "Total titles",
  singleRatings: (n) => `⭐ ${n} ratings`,
  targetTitle: "Choose the target list:",
  targetWatched: "Watched",
  targetWatchlist: "Watchlist",
  targetFavorites: "Favorites",
  back: "Back",
  start: (n) => `Start import (${n})`,

  matching: "Matching titles with TMDB...",
  matchingProgress: (current, total, item) => `Matching: ${current} / ${total}\n${item}`,
  saving: "Saving to your Seelogd lists, ratings and reviews...",
  savingProgress: (saved, total) => `Saving: ${saved} / ${total}`,
  mergingLists: "Merging custom Letterboxd lists...",
  percent: (n) => `${n}%`,
  importingTitle: "Preparing your library",
  importingHint: "Keep the app open until the import is complete.",
  stageMatching: "Match",
  stageSaving: "Save",
  stageLists: "Lists",

  successTitle: "Import completed successfully!",
  resultDetails: "Import summary",
  successTotal: (n) => `**${n}** titles were processed safely.`,
  addedWatchEvents: (n) => `🎬 ${n} missing watch records added.`,
  addedRatings: (n) => `⭐ ${n} missing ratings added to your profile.`,
  addedReviews: (n) => `✍️ ${n} missing reviews added to your comments.`,
  preserved: "🛡️ Your existing ratings and comments were left untouched.",
  unchanged: (n) => `✓ ${n} titles were already up to date.`,
  checkedWatchlist: (n) => `📌 ${n} watchlist entries checked.`,
  checkedFavorites: (n) => `❤️ ${n} favorite entries checked.`,
  mergedCustomLists: (lists, items) => `📚 ${lists} custom lists merged with ${items} new titles.`,
  skippedUnmatched: (n) => `⚠️ ${n} titles were skipped because they did not match TMDB.`,
  done: "Done",

  pasteEmpty: "Please enter valid CSV data.",
  invalidFileTitle: "Invalid file format",
  invalidFileBody: "The selected file is not a text-based CSV file.",
  csvErrorTitle: "CSV validation error",
  csvErrorFallback: "Please check the file format.",
  loadedTitle: (name) => `${name} loaded`,
  loadedBody: (n) => `${n} titles parsed successfully.`,
  clipboardEmpty: "There is no text on the clipboard to paste.",
  bundleLoadedTitle: "Letterboxd bundle loaded",
  bundleLoadedBody: (items, ratings) => `${items} titles and ${ratings} ratings found.`,
  filesMergedTitle: "Letterboxd files combined",
  filesMergedBody: (n) => `${n} titles are ready.`,
  emptyFileTitle: "File is empty",
  emptyFileBody: "The selected file looks empty.",
  loadFailedTitle: "Couldn't load the content",
  loadFailedFallback: "Please choose a valid ZIP or CSV file.",
  nothingToImport: "There is nothing to import.",
  importFailedTitle: "Something went wrong during the import",
  importFailedBody: (message) =>
    `${message} Records that were already completed are kept; you can safely try again.`,
  unexpected: "An unexpected error occurred.",

  errors: {
    zipOpen: "The ZIP archive could not be opened. The file may be corrupted; try downloading it again.",
    notLetterboxdCsv: "No valid Letterboxd CSV format was found.",
    notImdbCsv: "No valid IMDb CSV format was found.",
    noBundle: "No valid Letterboxd file bundle was found.",
    noBundleItems: "The bundle has no valid movie data to import.",
    zipNoCsv: "No CSV files were found inside the ZIP archive.",
    emptyHeaders: "The file is empty or its column headers could not be read.",
    unrecognizedCsv:
      "Unrecognized CSV format! This file doesn't look like a Letterboxd or IMDb export. Please choose the Letterboxd ZIP file or the correct CSV.",
    noItemsInFile: "No movie or series entries to import were found in the file.",
    noTmdbMatch: "No matching movies were found in the TMDB database.",
  },

  help: {
    title: "Export guide",
    tipLead: "Tip: ",
    tipBody:
      "Download your CSV straight to your phone and tap \"{{pick}}\" to import it in seconds.",
    letterboxd: [
      {
        title: "Go to Settings",
        body: "On the Letterboxd website, tap your profile icon and open the **Settings** page.",
      },
      {
        title: "Export Your Data",
        body: "Open the **Import & Export** tab and press the **Export Your Data** button.",
      },
      {
        title: "Choose the ZIP or CSV file",
        body: "You can pick the downloaded **.zip** file directly. The app scans **watched.csv**, **diary.csv**, **ratings.csv** and **watchlist.csv** automatically.",
      },
    ],
    imdb: [
      {
        title: "Go to your IMDb list",
        body: "On the IMDb website, open the **Your Ratings** or **Your Watchlist** page.",
      },
      {
        title: "Tap the Export button",
        body: "Export from the three-dot menu at the top right of the list, or from the **Export** option at the bottom of the page.",
      },
      {
        title: "Upload to Seelogd",
        body: "Pick the downloaded **ratings.csv** directly by tapping the \"{{pick}}\" button.",
      },
    ],
  },
};

const ES = {
  rowTitle: "Importar desde Letterboxd e IMDb",
  rowSub: "Trae tu historial y tus puntuaciones a Seelogd",
  title: "Importar Letterboxd / IMDb",
  inputDesc:
    "Elige el archivo ZIP o los CSV que descargaste. Lo visto, las puntuaciones, las reseñas y la lista de seguimiento se combinan sin tocar lo que ya tienes.",
  howTo: "¿Cómo conseguirlo?",
  pickBtn: "Elegir ZIP o CSV de Letterboxd",
  autoPackLead: "Lector automático del paquete:",
  autoPackBody:
    "Los archivos **watched.csv**, **diary.csv**, **ratings.csv** y **watchlist.csv** del ZIP se analizan automáticamente.",
  orPaste: "O PEGA EL TEXTO",
  pastePlaceholder: "Pega aquí el texto del CSV...",
  pasteBtn: "Pegar del portapapeles",
  parseBtn: "Analizar datos y previsualizar",
  clipboardName: "Contenido del portapapeles",
  pastedTextName: "Texto pegado",
  csvFileName: "Archivo CSV",

  bundleDetected: "Paquete de Letterboxd detectado",
  customLists: "Listas personalizadas de Letterboxd",
  customListsMeta: (lists, items) => `${lists} listas · ${items} títulos`,
  watchedMovies: "Películas vistas",
  watchlist: "Lista de seguimiento",
  ratingsBadge: (n) => `⭐ ${n} puntuaciones de películas`,
  reviewsBadge: (n) => `✍️ ${n} reseñas`,
  sampleTitle: "Títulos de ejemplo:",
  fileDetected: (source) => `Archivo de ${source} detectado`,
  totalItems: "Total de títulos",
  singleRatings: (n) => `⭐ ${n} puntuaciones`,
  targetTitle: "Elige la lista de destino:",
  targetWatched: "Vistos",
  targetWatchlist: "Lista de seguimiento",
  targetFavorites: "Favoritos",
  back: "Volver",
  start: (n) => `Iniciar importación (${n})`,

  matching: "Emparejando títulos con TMDB...",
  matchingProgress: (current, total, item) => `Emparejando: ${current} / ${total}\n${item}`,
  saving: "Guardando en tus listas, puntuaciones y reseñas de Seelogd...",
  savingProgress: (saved, total) => `Guardando: ${saved} / ${total}`,
  mergingLists: "Combinando las listas personalizadas de Letterboxd...",
  percent: (n) => `${n} %`,
  importingTitle: "Preparando tu biblioteca",
  importingHint: "Mantén la aplicación abierta hasta que termine la importación.",
  stageMatching: "Emparejar",
  stageSaving: "Guardar",
  stageLists: "Listas",

  successTitle: "¡Importación completada con éxito!",
  resultDetails: "Resumen de importación",
  successTotal: (n) => `Se procesaron **${n}** títulos sin problemas.`,
  addedWatchEvents: (n) => `🎬 Se añadieron ${n} registros de visionado que faltaban.`,
  addedRatings: (n) => `⭐ Se añadieron ${n} puntuaciones que faltaban a tu perfil.`,
  addedReviews: (n) => `✍️ Se añadieron ${n} reseñas que faltaban a tus comentarios.`,
  preserved: "🛡️ Tus puntuaciones y comentarios existentes no se modificaron.",
  unchanged: (n) => `✓ ${n} títulos ya estaban al día.`,
  checkedWatchlist: (n) => `📌 Se revisaron ${n} entradas de la lista de seguimiento.`,
  checkedFavorites: (n) => `❤️ Se revisaron ${n} entradas de favoritos.`,
  mergedCustomLists: (lists, items) =>
    `📚 ${lists} listas personalizadas combinadas con ${items} títulos nuevos.`,
  skippedUnmatched: (n) => `⚠️ Se omitieron ${n} títulos porque no coincidían con TMDB.`,
  done: "Listo",

  pasteEmpty: "Introduce datos CSV válidos.",
  invalidFileTitle: "Formato de archivo no válido",
  invalidFileBody: "El archivo seleccionado no es un CSV de texto.",
  csvErrorTitle: "Error de validación del CSV",
  csvErrorFallback: "Revisa el formato del archivo.",
  loadedTitle: (name) => `${name} cargado`,
  loadedBody: (n) => `${n} títulos analizados correctamente.`,
  clipboardEmpty: "No hay texto en el portapapeles para pegar.",
  bundleLoadedTitle: "Paquete de Letterboxd cargado",
  bundleLoadedBody: (items, ratings) => `Se encontraron ${items} títulos y ${ratings} puntuaciones.`,
  filesMergedTitle: "Archivos de Letterboxd combinados",
  filesMergedBody: (n) => `${n} títulos listos.`,
  emptyFileTitle: "El archivo está vacío",
  emptyFileBody: "El archivo seleccionado parece estar vacío.",
  loadFailedTitle: "No se pudo cargar el contenido",
  loadFailedFallback: "Elige un archivo ZIP o CSV válido.",
  nothingToImport: "No hay nada que importar.",
  importFailedTitle: "Ocurrió un error durante la importación",
  importFailedBody: (message) =>
    `${message} Los registros ya completados se conservan; puedes volver a intentarlo sin problema.`,
  unexpected: "Ocurrió un error inesperado.",

  errors: {
    zipOpen: "No se pudo abrir el archivo ZIP. Puede estar dañado; prueba a descargarlo de nuevo.",
    notLetterboxdCsv: "No se encontró un formato CSV de Letterboxd válido.",
    notImdbCsv: "No se encontró un formato CSV de IMDb válido.",
    noBundle: "No se encontró un paquete de archivos de Letterboxd válido.",
    noBundleItems: "El paquete no tiene datos de películas válidos para importar.",
    zipNoCsv: "No se encontraron archivos CSV dentro del ZIP.",
    emptyHeaders: "El archivo está vacío o no se pudieron leer los encabezados de las columnas.",
    unrecognizedCsv:
      "¡Formato CSV no compatible! Este archivo no parece una exportación de Letterboxd o IMDb. Elige el ZIP de Letterboxd o el CSV correcto.",
    noItemsInFile: "No se encontraron películas ni series para importar en el archivo.",
    noTmdbMatch: "No se encontraron películas coincidentes en la base de datos de TMDB.",
  },

  help: {
    title: "Guía de exportación",
    tipLead: "Consejo: ",
    tipBody:
      "Descarga el CSV directamente en tu teléfono y toca \"{{pick}}\" para importarlo en segundos.",
    letterboxd: [
      {
        title: "Ve a Ajustes",
        body: "En el sitio web de Letterboxd, toca el icono de tu perfil y abre la página **Settings** (Ajustes).",
      },
      {
        title: "Export Your Data (Exporta tus datos)",
        body: "Abre la pestaña **Import & Export** y pulsa el botón **Export Your Data**.",
      },
      {
        title: "Elige el archivo ZIP o CSV",
        body: "Puedes elegir directamente el archivo **.zip** descargado. La app analiza automáticamente **watched.csv**, **diary.csv**, **ratings.csv** y **watchlist.csv**.",
      },
    ],
    imdb: [
      {
        title: "Ve a tu lista de IMDb",
        body: "En el sitio web de IMDb, abre la página **Your Ratings** (Tus puntuaciones) o **Your Watchlist**.",
      },
      {
        title: "Toca el botón Exportar (Export)",
        body: "Exporta desde el menú de tres puntos de la esquina superior derecha de la lista o desde la opción **Export** al final de la página.",
      },
      {
        title: "Súbelo a Seelogd",
        body: "Elige directamente el **ratings.csv** descargado tocando el botón \"{{pick}}\".",
      },
    ],
  },
};

const PT = {
  rowTitle: "Importar do Letterboxd e do IMDb",
  rowSub: "Traga seu histórico e suas notas para o Seelogd",
  title: "Importar Letterboxd / IMDb",
  inputDesc:
    "Escolha o arquivo ZIP ou os CSVs que você baixou. O que você assistiu, as notas, as resenhas e a lista para assistir são combinados sem apagar o que você já tem.",
  howTo: "Como obter?",
  pickBtn: "Escolher ZIP ou CSV do Letterboxd",
  autoPackLead: "Leitor automático do pacote:",
  autoPackBody:
    "Os arquivos **watched.csv**, **diary.csv**, **ratings.csv** e **watchlist.csv** dentro do ZIP são analisados automaticamente.",
  orPaste: "OU COLE COMO TEXTO",
  pastePlaceholder: "Cole o texto do CSV aqui...",
  pasteBtn: "Colar da área de transferência",
  parseBtn: "Analisar dados e pré-visualizar",
  clipboardName: "Conteúdo da área de transferência",
  pastedTextName: "Texto colado",
  csvFileName: "Arquivo CSV",

  bundleDetected: "Pacote do Letterboxd detectado",
  customLists: "Listas personalizadas do Letterboxd",
  customListsMeta: (lists, items) => `${lists} listas · ${items} títulos`,
  watchedMovies: "Filmes assistidos",
  watchlist: "Lista para assistir",
  ratingsBadge: (n) => `⭐ ${n} notas de filmes`,
  reviewsBadge: (n) => `✍️ ${n} resenhas`,
  sampleTitle: "Títulos de exemplo:",
  fileDetected: (source) => `Arquivo do ${source} detectado`,
  totalItems: "Total de títulos",
  singleRatings: (n) => `⭐ ${n} notas`,
  targetTitle: "Escolha a lista de destino:",
  targetWatched: "Assistidos",
  targetWatchlist: "Lista para assistir",
  targetFavorites: "Favoritos",
  back: "Voltar",
  start: (n) => `Iniciar importação (${n})`,

  matching: "Associando títulos ao TMDB...",
  matchingProgress: (current, total, item) => `Associando: ${current} / ${total}\n${item}`,
  saving: "Salvando em suas listas, notas e resenhas do Seelogd...",
  savingProgress: (saved, total) => `Salvando: ${saved} / ${total}`,
  mergingLists: "Combinando as listas personalizadas do Letterboxd...",
  percent: (n) => `${n}%`,
  importingTitle: "Preparando sua biblioteca",
  importingHint: "Mantenha o aplicativo aberto até a importação terminar.",
  stageMatching: "Associar",
  stageSaving: "Salvar",
  stageLists: "Listas",

  successTitle: "Importação concluída com sucesso!",
  resultDetails: "Resumo da importação",
  successTotal: (n) => `**${n}** títulos foram processados com segurança.`,
  addedWatchEvents: (n) => `🎬 ${n} registros de exibição que faltavam foram adicionados.`,
  addedRatings: (n) => `⭐ ${n} notas que faltavam foram adicionadas ao seu perfil.`,
  addedReviews: (n) => `✍️ ${n} resenhas que faltavam foram adicionadas aos seus comentários.`,
  preserved: "🛡️ Suas notas e comentários existentes não foram alterados.",
  unchanged: (n) => `✓ ${n} títulos já estavam atualizados.`,
  checkedWatchlist: (n) => `📌 ${n} itens da lista para assistir foram verificados.`,
  checkedFavorites: (n) => `❤️ ${n} favoritos foram verificados.`,
  mergedCustomLists: (lists, items) =>
    `📚 ${lists} listas personalizadas combinadas com ${items} títulos novos.`,
  skippedUnmatched: (n) => `⚠️ ${n} títulos foram ignorados porque não correspondiam ao TMDB.`,
  done: "Concluir",

  pasteEmpty: "Informe dados CSV válidos.",
  invalidFileTitle: "Formato de arquivo inválido",
  invalidFileBody: "O arquivo selecionado não é um CSV em formato de texto.",
  csvErrorTitle: "Erro de validação do CSV",
  csvErrorFallback: "Verifique o formato do arquivo.",
  loadedTitle: (name) => `${name} carregado`,
  loadedBody: (n) => `${n} títulos analisados com sucesso.`,
  clipboardEmpty: "Não há texto na área de transferência para colar.",
  bundleLoadedTitle: "Pacote do Letterboxd carregado",
  bundleLoadedBody: (items, ratings) => `${items} títulos e ${ratings} notas encontrados.`,
  filesMergedTitle: "Arquivos do Letterboxd combinados",
  filesMergedBody: (n) => `${n} títulos prontos.`,
  emptyFileTitle: "Arquivo vazio",
  emptyFileBody: "O arquivo selecionado parece estar vazio.",
  loadFailedTitle: "Não foi possível carregar o conteúdo",
  loadFailedFallback: "Escolha um arquivo ZIP ou CSV válido.",
  nothingToImport: "Não há nada para importar.",
  importFailedTitle: "Ocorreu um erro durante a importação",
  importFailedBody: (message) =>
    `${message} Os registros já concluídos são mantidos; você pode tentar novamente com segurança.`,
  unexpected: "Ocorreu um erro inesperado.",

  errors: {
    zipOpen: "Não foi possível abrir o arquivo ZIP. Ele pode estar corrompido; tente baixá-lo novamente.",
    notLetterboxdCsv: "Nenhum formato CSV válido do Letterboxd foi encontrado.",
    notImdbCsv: "Nenhum formato CSV válido do IMDb foi encontrado.",
    noBundle: "Nenhum pacote de arquivos válido do Letterboxd foi encontrado.",
    noBundleItems: "O pacote não tem dados de filmes válidos para importar.",
    zipNoCsv: "Nenhum arquivo CSV foi encontrado dentro do ZIP.",
    emptyHeaders: "O arquivo está vazio ou não foi possível ler os cabeçalhos das colunas.",
    unrecognizedCsv:
      "Formato CSV incompatível! Este arquivo não parece ser uma exportação do Letterboxd ou do IMDb. Escolha o ZIP do Letterboxd ou o CSV correto.",
    noItemsInFile: "Nenhum filme ou série para importar foi encontrado no arquivo.",
    noTmdbMatch: "Nenhum filme correspondente foi encontrado no banco de dados do TMDB.",
  },

  help: {
    title: "Guia de exportação",
    tipLead: "Dica: ",
    tipBody:
      "Baixe o CSV direto no celular e toque em \"{{pick}}\" para importar em segundos.",
    letterboxd: [
      {
        title: "Vá em Configurações",
        body: "No site do Letterboxd, toque no ícone do seu perfil e abra a página **Settings** (Configurações).",
      },
      {
        title: "Export Your Data (Exporte seus dados)",
        body: "Abra a aba **Import & Export** e toque no botão **Export Your Data**.",
      },
      {
        title: "Escolha o arquivo ZIP ou CSV",
        body: "Você pode escolher diretamente o arquivo **.zip** baixado. O app analisa automaticamente **watched.csv**, **diary.csv**, **ratings.csv** e **watchlist.csv**.",
      },
    ],
    imdb: [
      {
        title: "Vá até sua lista do IMDb",
        body: "No site do IMDb, abra a página **Your Ratings** (Suas notas) ou **Your Watchlist**.",
      },
      {
        title: "Toque no botão Exportar (Export)",
        body: "Exporte pelo menu de três pontos no canto superior direito da lista ou pela opção **Export** no fim da página.",
      },
      {
        title: "Envie para o Seelogd",
        body: "Escolha direto o **ratings.csv** baixado tocando no botão \"{{pick}}\".",
      },
    ],
  },
};

const DE = {
  rowTitle: "Von Letterboxd & IMDb importieren",
  rowSub: "Übertrage deinen Verlauf und deine Bewertungen zu Seelogd",
  title: "Letterboxd / IMDb importieren",
  inputDesc:
    "Wähle die heruntergeladene ZIP-Datei oder die CSVs aus. Gesehenes, Bewertungen, Rezensionen und Merkliste werden zusammengeführt, ohne deine vorhandenen Einträge zu überschreiben.",
  howTo: "So geht's",
  pickBtn: "Letterboxd-ZIP oder CSV wählen",
  autoPackLead: "Automatischer Paket-Reader:",
  autoPackBody:
    "**watched.csv**, **diary.csv**, **ratings.csv** und **watchlist.csv** im ZIP-Archiv werden automatisch eingelesen.",
  orPaste: "ODER ALS TEXT EINFÜGEN",
  pastePlaceholder: "CSV-Text hier einfügen...",
  pasteBtn: "Aus der Zwischenablage einfügen",
  parseBtn: "Daten analysieren & Vorschau",
  clipboardName: "Inhalt der Zwischenablage",
  pastedTextName: "Eingefügter Text",
  csvFileName: "CSV-Datei",

  bundleDetected: "Letterboxd-Paket erkannt",
  customLists: "Eigene Letterboxd-Listen",
  customListsMeta: (lists, items) => `${lists} Listen · ${items} Titel`,
  watchedMovies: "Gesehene Filme",
  watchlist: "Merkliste",
  ratingsBadge: (n) => `⭐ ${n} Filmbewertungen`,
  reviewsBadge: (n) => `✍️ ${n} Rezensionen`,
  sampleTitle: "Beispieltitel:",
  fileDetected: (source) => `${source}-Datei erkannt`,
  totalItems: "Titel insgesamt",
  singleRatings: (n) => `⭐ ${n} Bewertungen`,
  targetTitle: "Zielliste wählen:",
  targetWatched: "Gesehen",
  targetWatchlist: "Merkliste",
  targetFavorites: "Favoriten",
  back: "Zurück",
  start: (n) => `Import starten (${n})`,

  matching: "Titel werden mit TMDB abgeglichen...",
  matchingProgress: (current, total, item) => `Abgleich: ${current} / ${total}\n${item}`,
  saving: "Wird in deinen Seelogd-Listen, Bewertungen und Rezensionen gespeichert...",
  savingProgress: (saved, total) => `Speichern: ${saved} / ${total}`,
  mergingLists: "Eigene Letterboxd-Listen werden zusammengeführt...",
  percent: (n) => `${n} %`,
  importingTitle: "Deine Bibliothek wird vorbereitet",
  importingHint: "Lass die App geöffnet, bis der Import abgeschlossen ist.",
  stageMatching: "Abgleich",
  stageSaving: "Speichern",
  stageLists: "Listen",

  successTitle: "Import erfolgreich abgeschlossen!",
  resultDetails: "Importübersicht",
  successTotal: (n) => `Insgesamt wurden **${n}** Titel sicher verarbeitet.`,
  addedWatchEvents: (n) => `🎬 ${n} fehlende Seheinträge hinzugefügt.`,
  addedRatings: (n) => `⭐ ${n} fehlende Bewertungen in dein Profil übernommen.`,
  addedReviews: (n) => `✍️ ${n} fehlende Rezensionen zu deinen Kommentaren hinzugefügt.`,
  preserved: "🛡️ Deine vorhandenen Bewertungen und Kommentare wurden nicht verändert.",
  unchanged: (n) => `✓ ${n} Titel waren bereits aktuell.`,
  checkedWatchlist: (n) => `📌 ${n} Merklisten-Einträge geprüft.`,
  checkedFavorites: (n) => `❤️ ${n} Favoriten-Einträge geprüft.`,
  mergedCustomLists: (lists, items) =>
    `📚 ${lists} eigene Listen mit ${items} neuen Titeln zusammengeführt.`,
  skippedUnmatched: (n) => `⚠️ ${n} Titel wurden übersprungen, weil sie nicht mit TMDB übereinstimmten.`,
  done: "Fertig",

  pasteEmpty: "Bitte gib gültige CSV-Daten ein.",
  invalidFileTitle: "Ungültiges Dateiformat",
  invalidFileBody: "Die gewählte Datei ist keine textbasierte CSV-Datei.",
  csvErrorTitle: "CSV-Prüfung fehlgeschlagen",
  csvErrorFallback: "Bitte prüfe das Dateiformat.",
  loadedTitle: (name) => `${name} geladen`,
  loadedBody: (n) => `${n} Titel erfolgreich analysiert.`,
  clipboardEmpty: "In der Zwischenablage ist kein Text zum Einfügen.",
  bundleLoadedTitle: "Letterboxd-Paket geladen",
  bundleLoadedBody: (items, ratings) => `${items} Titel und ${ratings} Bewertungen gefunden.`,
  filesMergedTitle: "Letterboxd-Dateien zusammengeführt",
  filesMergedBody: (n) => `${n} Titel sind bereit.`,
  emptyFileTitle: "Datei ist leer",
  emptyFileBody: "Die gewählte Datei scheint leer zu sein.",
  loadFailedTitle: "Inhalt konnte nicht geladen werden",
  loadFailedFallback: "Bitte wähle eine gültige ZIP- oder CSV-Datei.",
  nothingToImport: "Es gibt nichts zu importieren.",
  importFailedTitle: "Beim Import ist ein Fehler aufgetreten",
  importFailedBody: (message) =>
    `${message} Bereits abgeschlossene Einträge bleiben erhalten; du kannst es bedenkenlos erneut versuchen.`,
  unexpected: "Ein unerwarteter Fehler ist aufgetreten.",

  errors: {
    zipOpen: "Das ZIP-Archiv konnte nicht geöffnet werden. Die Datei ist möglicherweise beschädigt; lade sie erneut herunter.",
    notLetterboxdCsv: "Es wurde kein gültiges Letterboxd-CSV-Format gefunden.",
    notImdbCsv: "Es wurde kein gültiges IMDb-CSV-Format gefunden.",
    noBundle: "Es wurde kein gültiges Letterboxd-Dateipaket gefunden.",
    noBundleItems: "Das Paket enthält keine gültigen Filmdaten zum Importieren.",
    zipNoCsv: "Im ZIP-Archiv wurden keine CSV-Dateien gefunden.",
    emptyHeaders: "Die Datei ist leer oder die Spaltenüberschriften konnten nicht gelesen werden.",
    unrecognizedCsv:
      "CSV-Format nicht erkannt! Diese Datei sieht nicht nach einem Letterboxd- oder IMDb-Export aus. Bitte wähle die Letterboxd-ZIP-Datei oder die richtige CSV.",
    noItemsInFile: "In der Datei wurden keine importierbaren Filme oder Serien gefunden.",
    noTmdbMatch: "In der TMDB-Datenbank wurden keine passenden Filme gefunden.",
  },

  help: {
    title: "Export-Anleitung",
    tipLead: "Tipp: ",
    tipBody:
      "Lade die CSV direkt auf dein Handy und tippe auf „{{pick}}“, um sie in Sekunden zu importieren.",
    letterboxd: [
      {
        title: "Öffne die Einstellungen",
        body: "Tippe auf der Letterboxd-Website auf dein Profilsymbol und öffne die Seite **Settings** (Einstellungen).",
      },
      {
        title: "Export Your Data (Deine Daten exportieren)",
        body: "Öffne den Tab **Import & Export** und tippe auf die Schaltfläche **Export Your Data**.",
      },
      {
        title: "ZIP- oder CSV-Datei wählen",
        body: "Du kannst die heruntergeladene **.zip**-Datei direkt auswählen. Die App liest **watched.csv**, **diary.csv**, **ratings.csv** und **watchlist.csv** automatisch ein.",
      },
    ],
    imdb: [
      {
        title: "Öffne deine IMDb-Liste",
        body: "Öffne auf der IMDb-Website die Seite **Your Ratings** (Deine Bewertungen) oder **Your Watchlist**.",
      },
      {
        title: "Tippe auf „Export“",
        body: "Exportiere über das Drei-Punkte-Menü oben rechts in der Liste oder über die Option **Export** am Ende der Seite.",
      },
      {
        title: "Zu Seelogd hochladen",
        body: "Wähle die heruntergeladene **ratings.csv** direkt aus, indem du auf „{{pick}}“ tippst.",
      },
    ],
  },
};

export const IMPORT_COPY = { tr: TR, en: EN, es: ES, pt: PT, de: DE };

export function getImportCopy(language) {
  return IMPORT_COPY[copyLanguage(language, Object.keys(IMPORT_COPY))];
}

/** `**kalın**` işaretli metni [{ text, strong }] parçalarına böler. */
export function splitRich(text) {
  const parts = String(text ?? "").split(/\*\*(.+?)\*\*/g);
  return parts
    .map((value, index) => ({ text: value, strong: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

/** Yardım metnindeki `{{pick}}` yer tutucusunu seç düğmesinin adıyla doldurur. */
export function withPickLabel(text, copy) {
  return String(text ?? "").split("{{pick}}").join(copy.pickBtn);
}

/**
 * Bir hatayı kullanıcı dilindeki metne çevirir. Servislerin `ImportError.code`'u tablodan
 * çözülür; tanınmayan hata (dosya sistemi, JSZip …) `fallback` ile gösterilir.
 */
export function importErrorText(error, copy, fallback = copy.unexpected) {
  const code = error && typeof error === "object" ? error.code : null;
  if (code && Object.prototype.hasOwnProperty.call(copy.errors, code)) return copy.errors[code];
  return fallback;
}

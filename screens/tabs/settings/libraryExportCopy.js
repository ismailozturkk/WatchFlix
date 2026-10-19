// screens/tabs/settings/libraryExportCopy.js
//
// "Kütüphaneni Dışa Aktar" ekranının metinleri (yerel tr/en/es üçlüsü; üç dilin aynı şekle sahip olduğu
// __tests__/copyTablesSpanish.test.js'te bekçilenir). Hata kodları services/libraryExportFiles.js sözleşmesindendir.
// Biçim ayrıntısı: utils/libraryExport.js.

import { copyLanguage } from "../../../utils/appLanguages";

const tr = {
  title: "Kütüphaneni Dışa Aktar",
  rowTitle: "Kütüphaneni Dışa Aktar",
  rowSub: "Listelerini, izleme geçmişini ve puanlarını JSON ya da CSV olarak al",
  heroTitle: "Verilerin senin",
  heroText:
    "İzlediklerin, listelerin, izleme tarihlerin ve puanların dosya olarak cihazına çıkar. Başka bir uygulamaya taşıyabilir ya da yedek olarak saklayabilirsin.",

  sectionIncluded: "Neler dahil",
  films: (n) => (n === 1 ? "1 izlenen film" : `${n} izlenen film`),
  shows: (n, episodes) => `${n} dizi · ${episodes} bölüm`,
  watchList: (n) => (n === 1 ? "1 izlenecek" : `${n} izlenecek`),
  favorites: (n) => (n === 1 ? "1 favori" : `${n} favori`),
  customLists: (lists, items) => `${lists} özel liste · ${items} içerik`,
  ratings: (n) => (n === 1 ? "1 puan" : `${n} puan`),
  loading: "Kütüphanen yükleniyor…",
  empty: "Dışa aktarılacak bir şey yok. Film ya da dizi ekleyince burada görünür.",
  notIncluded: "Dahil değil: yorumlar, gönderiler, notlar, hatırlatıcılar, sohbetler ve hesap bilgileri.",

  sectionExport: "Dışa aktar",
  jsonTitle: "Tam yedek (JSON)",
  jsonSub: "Her şey: listeler, izleme tarihleri, dizilerde bölüm geçmişi, puanlar",
  zipTitle: "Tablo ve Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + Letterboxd'a aktarılabilir CSV'ler",
  ready: "Dışa aktarma hazır",

  noteLetterboxd:
    "Letterboxd yalnız film tanır: diziler JSON ve library.csv'de yer alır, Letterboxd dosyalarında yer almaz. Letterboxd'a yüklemek için letterboxd.com'da Settings > Import & Export bölümünü kullan; izlenenleri ve izleme listesini ayrı ayrı içe aktar.",
  notePrivacy: "Dosya yalnız cihazında oluşturulur. Nereye göndereceğini paylaşım sayfasından sen seçersin.",

  errWrite: "Dosya oluşturulamadı",
  errSharing: "Bu cihazda paylaşım kullanılamıyor",
  errZip: "ZIP dosyası oluşturulamadı",
  errEmpty: "Dışa aktarılacak veri yok",

  readme: [
    "Seelogd kütüphane dışa aktarması",
    "",
    "library.csv                  Tüm listeler tek tabloda (Excel / Google Sheets).",
    "letterboxd-watched*.csv      İzlediğin filmler (tarih, puan, tekrar izleme). Letterboxd'a aktarılabilir.",
    "letterboxd-watchlist*.csv    İzleme listendeki filmler. Letterboxd'a aktarılabilir.",
    "",
    "Letterboxd: letterboxd.com > Settings > Import & Export. Dosyalar tmdbID ile eşleşir.",
    "Letterboxd yalnız film tanır; diziler library.csv ve JSON yedeğinde bulunur.",
    "Büyük kütüphaneler 1 MB sınırı için -1, -2 ... diye parçalanır; hepsini sırayla yükle.",
  ].join("\n"),
};

const en = {
  title: "Export Your Library",
  rowTitle: "Export Your Library",
  rowSub: "Get your lists, watch history and ratings as JSON or CSV",
  heroTitle: "Your data is yours",
  heroText:
    "Your watched titles, lists, watch dates and ratings come out as files on your device. Move them to another app or keep them as a backup.",

  sectionIncluded: "What's included",
  films: (n) => (n === 1 ? "1 watched film" : `${n} watched films`),
  shows: (n, episodes) => `${n} shows · ${episodes} episodes`,
  watchList: (n) => (n === 1 ? "1 on your watchlist" : `${n} on your watchlist`),
  favorites: (n) => (n === 1 ? "1 favorite" : `${n} favorites`),
  customLists: (lists, items) => `${lists} custom lists · ${items} titles`,
  ratings: (n) => (n === 1 ? "1 rating" : `${n} ratings`),
  loading: "Loading your library…",
  empty: "Nothing to export yet. Add a movie or show and it will appear here.",
  notIncluded: "Not included: comments, posts, notes, reminders, chats and account details.",

  sectionExport: "Export",
  jsonTitle: "Full backup (JSON)",
  jsonSub: "Everything: lists, watch dates, episode history for shows, ratings",
  zipTitle: "Spreadsheet and Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + CSVs you can import into Letterboxd",
  ready: "Export ready",

  noteLetterboxd:
    "Letterboxd only knows films: shows are in the JSON and library.csv but not in the Letterboxd files. To upload, use Settings > Import & Export on letterboxd.com; import the watched films and the watchlist separately.",
  notePrivacy: "The file is created on your device only. You choose where to send it from the share sheet.",

  errWrite: "Couldn't create the file",
  errSharing: "Sharing isn't available on this device",
  errZip: "Couldn't create the ZIP file",
  errEmpty: "There is no data to export",

  readme: [
    "Seelogd library export",
    "",
    "library.csv                  All lists in one table (Excel / Google Sheets).",
    "letterboxd-watched*.csv      Films you watched (date, rating, rewatch). Importable into Letterboxd.",
    "letterboxd-watchlist*.csv    Films on your watchlist. Importable into Letterboxd.",
    "",
    "Letterboxd: letterboxd.com > Settings > Import & Export. Files match films by tmdbID.",
    "Letterboxd only knows films; shows are in library.csv and the JSON backup.",
    "Large libraries are split as -1, -2 ... to stay under the 1 MB limit; upload them in order.",
  ].join("\n"),
};

const es = {
  title: "Exportar tu biblioteca",
  rowTitle: "Exportar tu biblioteca",
  rowSub: "Obtén tus listas, historial y puntuaciones en JSON o CSV",
  heroTitle: "Tus datos son tuyos",
  heroText:
    "Lo que has visto, tus listas, las fechas y tus puntuaciones salen como archivos en tu dispositivo. Llévalos a otra app o guárdalos como copia de seguridad.",

  sectionIncluded: "Qué se incluye",
  films: (n) => (n === 1 ? "1 película vista" : `${n} películas vistas`),
  shows: (n, episodes) => `${n} series · ${episodes} episodios`,
  watchList: (n) => (n === 1 ? "1 pendiente" : `${n} pendientes`),
  favorites: (n) => (n === 1 ? "1 favorito" : `${n} favoritos`),
  customLists: (lists, items) => `${lists} listas propias · ${items} títulos`,
  ratings: (n) => (n === 1 ? "1 puntuación" : `${n} puntuaciones`),
  loading: "Cargando tu biblioteca…",
  empty: "Aún no hay nada que exportar. Añade una película o serie y aparecerá aquí.",
  notIncluded: "No se incluye: comentarios, publicaciones, notas, recordatorios, chats ni datos de la cuenta.",

  sectionExport: "Exportar",
  jsonTitle: "Copia completa (JSON)",
  jsonSub: "Todo: listas, fechas, historial de episodios de las series, puntuaciones",
  zipTitle: "Hoja de cálculo y Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + CSV importables en Letterboxd",
  ready: "Exportación lista",

  noteLetterboxd:
    "Letterboxd solo conoce películas: las series están en el JSON y en library.csv, pero no en los archivos de Letterboxd. Para subirlos usa Settings > Import & Export en letterboxd.com; importa las vistas y la lista de pendientes por separado.",
  notePrivacy: "El archivo se crea solo en tu dispositivo. Tú eliges adónde enviarlo desde el menú de compartir.",

  errWrite: "No se pudo crear el archivo",
  errSharing: "Compartir no está disponible en este dispositivo",
  errZip: "No se pudo crear el archivo ZIP",
  errEmpty: "No hay datos que exportar",

  readme: [
    "Exportación de la biblioteca de Seelogd",
    "",
    "library.csv                  Todas las listas en una tabla (Excel / Google Sheets).",
    "letterboxd-watched*.csv      Películas vistas (fecha, puntuación, repetición). Importable en Letterboxd.",
    "letterboxd-watchlist*.csv    Películas pendientes. Importable en Letterboxd.",
    "",
    "Letterboxd: letterboxd.com > Settings > Import & Export. Los archivos coinciden por tmdbID.",
    "Letterboxd solo conoce películas; las series están en library.csv y en la copia JSON.",
    "Las bibliotecas grandes se dividen como -1, -2 ... por el límite de 1 MB; súbelas en orden.",
  ].join("\n"),
};

const pt = {
  title: "Exportar sua biblioteca",
  rowTitle: "Exportar sua biblioteca",
  rowSub: "Obtenha suas listas, histórico e notas em JSON ou CSV",
  heroTitle: "Seus dados são seus",
  heroText:
    "O que você assistiu, suas listas, as datas e suas notas saem como arquivos no seu dispositivo. Leve-os para outro app ou guarde-os como cópia de segurança.",

  sectionIncluded: "O que está incluído",
  films: (n) => (n === 1 ? "1 filme assistido" : `${n} filmes assistidos`),
  shows: (n, episodes) => `${n} séries · ${episodes} episódios`,
  watchList: (n) => (n === 1 ? "1 para assistir" : `${n} para assistir`),
  favorites: (n) => (n === 1 ? "1 favorito" : `${n} favoritos`),
  customLists: (lists, items) => `${lists} listas próprias · ${items} títulos`,
  ratings: (n) => (n === 1 ? "1 nota" : `${n} notas`),
  loading: "Carregando sua biblioteca…",
  empty: "Ainda não há nada para exportar. Adicione um filme ou uma série e aparecerá aqui.",
  notIncluded: "Não estão incluídos: comentários, publicações, notas, lembretes, conversas nem dados da conta.",

  sectionExport: "Exportar",
  jsonTitle: "Cópia completa (JSON)",
  jsonSub: "Tudo: listas, datas, histórico de episódios das séries, notas",
  zipTitle: "Planilha e Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + CSVs importáveis no Letterboxd",
  ready: "Exportação pronta",

  noteLetterboxd:
    "O Letterboxd só conhece filmes: as séries estão no JSON e no library.csv, mas não nos arquivos do Letterboxd. Para enviá-los use Settings > Import & Export em letterboxd.com; importe os assistidos e a lista para assistir separadamente.",
  notePrivacy: "O arquivo é criado só no seu dispositivo. Você escolhe para onde enviá-lo no menu de compartilhar.",

  errWrite: "Não foi possível criar o arquivo",
  errSharing: "O compartilhamento não está disponível neste dispositivo",
  errZip: "Não foi possível criar o arquivo ZIP",
  errEmpty: "Não há dados para exportar",

  readme: [
    "Exportação da biblioteca do Seelogd",
    "",
    "library.csv                  Todas as listas em uma tabela (Excel / Google Sheets).",
    "letterboxd-watched*.csv      Filmes assistidos (data, nota, reassistido). Importável no Letterboxd.",
    "letterboxd-watchlist*.csv    Filmes para assistir. Importável no Letterboxd.",
    "",
    "Letterboxd: letterboxd.com > Settings > Import & Export. Os arquivos são associados por tmdbID.",
    "O Letterboxd só conhece filmes; as séries estão no library.csv e na cópia JSON.",
    "Bibliotecas grandes são divididas como -1, -2 ... pelo limite de 1 MB; envie-as em ordem.",
  ].join("\n"),
};

export const LIBRARY_EXPORT_COPY = { tr, en, es, pt };

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getLibraryExportCopy = (language) =>
  LIBRARY_EXPORT_COPY[copyLanguage(language, Object.keys(LIBRARY_EXPORT_COPY))];

/** Hizmet hata kodu → kullanıcı metni. */
export function exportErrorMessage(copy, code) {
  switch (code) {
    case "sharing-unavailable":
      return copy.errSharing;
    case "zip-failed":
      return copy.errZip;
    case "empty":
      return copy.errEmpty;
    default:
      return copy.errWrite;
  }
}

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
  selectAll: "Tümünü seç",
  selectNone: "Temizle",
  noneSelected: "En az bir içerik seç",
  infoLabel: "Bilgi",
  sectionsSelected: "{n}/{total} içerik seçili",
  statFilms: "Film",
  statShows: "Dizi",
  statEpisodes: "Bölüm",
  statRatings: "Puan",
  heroText:
    "İzlediklerin, listelerin, izleme tarihlerin ve puanların dosya olarak cihazına çıkar. Başka bir uygulamaya taşıyabilir ya da yedek olarak saklayabilirsin.",

  sectionIncluded: "Neler dahil",
  films: (n) => (n === 1 ? "1 izlenen film" : `${n} izlenen film`),
  shows: (n, episodes) => `${n} dizi · ${episodes} bölüm`,
  watchList: (n) => (n === 1 ? "1 izlenecek" : `${n} izlenecek`),
  favorites: (n) => (n === 1 ? "1 favori" : `${n} favori`),
  customLists: (lists, items) => `${lists} özel liste · ${items} içerik`,
  ratings: (n) => (n === 1 ? "1 puan" : `${n} puan`),
  comments: (n) => (n === 1 ? "1 yorum" : `${n} yorum`),
  statComments: "Yorum",
  commentsLoading: "Yorumların okunuyor…",
  commentsFailed: "Yorumların okunamadı; bu dosyaya girmeyecek. Bağlantını kontrol edip ekrana yeniden gir.",
  readmeComments: "comments.csv                 Film ve dizilere yazdığın yorumlar (tarih, spoiler, yanıt).",
  loading: "Kütüphanen yükleniyor…",
  empty: "Dışa aktarılacak bir şey yok. Film ya da dizi ekleyince burada görünür.",
  notIncluded: "Dahil değil: gönderiler ve gönderi yorumları, notlar, hatırlatıcılar, sohbetler ve hesap bilgileri.",

  sectionExport: "Dışa aktar",
  jsonTitle: "Tam yedek (JSON)",
  jsonSub: "Her şey: listeler, izleme tarihleri, dizilerde bölüm geçmişi, puanlar, yorumlar. Geri yüklenebilir.",
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
  selectAll: "Select all",
  selectNone: "Clear",
  noneSelected: "Select at least one item",
  infoLabel: "Info",
  sectionsSelected: "{n}/{total} items selected",
  statFilms: "Films",
  statShows: "Shows",
  statEpisodes: "Episodes",
  statRatings: "Ratings",
  heroText:
    "Your watched titles, lists, watch dates and ratings come out as files on your device. Move them to another app or keep them as a backup.",

  sectionIncluded: "What's included",
  films: (n) => (n === 1 ? "1 watched film" : `${n} watched films`),
  shows: (n, episodes) => `${n} shows · ${episodes} episodes`,
  watchList: (n) => (n === 1 ? "1 on your watchlist" : `${n} on your watchlist`),
  favorites: (n) => (n === 1 ? "1 favorite" : `${n} favorites`),
  customLists: (lists, items) => `${lists} custom lists · ${items} titles`,
  ratings: (n) => (n === 1 ? "1 rating" : `${n} ratings`),
  comments: (n) => (n === 1 ? "1 comment" : `${n} comments`),
  statComments: "Comments",
  commentsLoading: "Reading your comments…",
  commentsFailed: "Couldn't read your comments; they won't be in this file. Check your connection and reopen this screen.",
  readmeComments: "comments.csv                 Comments you wrote on films and shows (date, spoiler, reply).",
  loading: "Loading your library…",
  empty: "Nothing to export yet. Add a movie or show and it will appear here.",
  notIncluded: "Not included: posts and post comments, notes, reminders, chats and account details.",

  sectionExport: "Export",
  jsonTitle: "Full backup (JSON)",
  jsonSub: "Everything: lists, watch dates, episode history for shows, ratings, comments. Restorable.",
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
  selectAll: "Seleccionar todo",
  selectNone: "Borrar",
  noneSelected: "Selecciona al menos un elemento",
  infoLabel: "Información",
  sectionsSelected: "{n}/{total} elementos seleccionados",
  statFilms: "Películas",
  statShows: "Series",
  statEpisodes: "Episodios",
  statRatings: "Puntuaciones",
  heroText:
    "Lo que has visto, tus listas, las fechas y tus puntuaciones salen como archivos en tu dispositivo. Llévalos a otra app o guárdalos como copia de seguridad.",

  sectionIncluded: "Qué se incluye",
  films: (n) => (n === 1 ? "1 película vista" : `${n} películas vistas`),
  shows: (n, episodes) => `${n} series · ${episodes} episodios`,
  watchList: (n) => (n === 1 ? "1 pendiente" : `${n} pendientes`),
  favorites: (n) => (n === 1 ? "1 favorito" : `${n} favoritos`),
  customLists: (lists, items) => `${lists} listas propias · ${items} títulos`,
  ratings: (n) => (n === 1 ? "1 puntuación" : `${n} puntuaciones`),
  comments: (n) => (n === 1 ? "1 comentario" : `${n} comentarios`),
  statComments: "Comentarios",
  commentsLoading: "Leyendo tus comentarios…",
  commentsFailed: "No se pudieron leer tus comentarios; no estarán en este archivo. Revisa la conexión y vuelve a abrir esta pantalla.",
  readmeComments: "comments.csv                 Comentarios que escribiste en películas y series (fecha, spoiler, respuesta).",
  loading: "Cargando tu biblioteca…",
  empty: "Aún no hay nada que exportar. Añade una película o serie y aparecerá aquí.",
  notIncluded: "No se incluye: publicaciones y sus comentarios, notas, recordatorios, chats ni datos de la cuenta.",

  sectionExport: "Exportar",
  jsonTitle: "Copia completa (JSON)",
  jsonSub: "Todo: listas, fechas, historial de episodios de las series, puntuaciones, comentarios. Se puede restaurar.",
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
  selectAll: "Selecionar tudo",
  selectNone: "Limpar",
  noneSelected: "Selecione pelo menos um item",
  infoLabel: "Informação",
  sectionsSelected: "{n}/{total} itens selecionados",
  statFilms: "Filmes",
  statShows: "Séries",
  statEpisodes: "Episódios",
  statRatings: "Notas",
  heroText:
    "O que você assistiu, suas listas, as datas e suas notas saem como arquivos no seu dispositivo. Leve-os para outro app ou guarde-os como cópia de segurança.",

  sectionIncluded: "O que está incluído",
  films: (n) => (n === 1 ? "1 filme assistido" : `${n} filmes assistidos`),
  shows: (n, episodes) => `${n} séries · ${episodes} episódios`,
  watchList: (n) => (n === 1 ? "1 para assistir" : `${n} para assistir`),
  favorites: (n) => (n === 1 ? "1 favorito" : `${n} favoritos`),
  customLists: (lists, items) => `${lists} listas próprias · ${items} títulos`,
  ratings: (n) => (n === 1 ? "1 nota" : `${n} notas`),
  comments: (n) => (n === 1 ? "1 comentário" : `${n} comentários`),
  statComments: "Comentários",
  commentsLoading: "Lendo seus comentários…",
  commentsFailed: "Não foi possível ler seus comentários; eles não estarão neste arquivo. Verifique a conexão e abra esta tela de novo.",
  readmeComments: "comments.csv                 Comentários que você escreveu em filmes e séries (data, spoiler, resposta).",
  loading: "Carregando sua biblioteca…",
  empty: "Ainda não há nada para exportar. Adicione um filme ou uma série e aparecerá aqui.",
  notIncluded: "Não estão incluídos: publicações e seus comentários, notas, lembretes, conversas nem dados da conta.",

  sectionExport: "Exportar",
  jsonTitle: "Cópia completa (JSON)",
  jsonSub: "Tudo: listas, datas, histórico de episódios das séries, notas, comentários. Pode ser restaurado.",
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

const de = {
  title: "Deine Bibliothek exportieren",
  rowTitle: "Deine Bibliothek exportieren",
  rowSub: "Hol dir deine Listen, deinen Sehverlauf und deine Bewertungen als JSON oder CSV",
  heroTitle: "Deine Daten gehören dir",
  selectAll: "Alle auswählen",
  selectNone: "Leeren",
  noneSelected: "Wähle mindestens einen Eintrag",
  infoLabel: "Info",
  sectionsSelected: "{n}/{total} Einträge ausgewählt",
  statFilms: "Filme",
  statShows: "Serien",
  statEpisodes: "Folgen",
  statRatings: "Bewertungen",
  heroText:
    "Deine gesehenen Titel, Listen, Sehdaten und Bewertungen werden als Dateien auf deinem Gerät ausgegeben. Nimm sie in eine andere App mit oder bewahre sie als Sicherung auf.",

  sectionIncluded: "Was enthalten ist",
  films: (n) => (n === 1 ? "1 gesehener Film" : `${n} gesehene Filme`),
  shows: (n, episodes) => `${n} Serien · ${episodes} Folgen`,
  watchList: (n) => (n === 1 ? "1 auf deiner Merkliste" : `${n} auf deiner Merkliste`),
  favorites: (n) => (n === 1 ? "1 Favorit" : `${n} Favoriten`),
  customLists: (lists, items) => `${lists} eigene Listen · ${items} Titel`,
  ratings: (n) => (n === 1 ? "1 Bewertung" : `${n} Bewertungen`),
  comments: (n) => (n === 1 ? "1 Kommentar" : `${n} Kommentare`),
  statComments: "Kommentare",
  commentsLoading: "Deine Kommentare werden gelesen…",
  commentsFailed: "Deine Kommentare konnten nicht gelesen werden und fehlen in dieser Datei. Prüfe die Verbindung und öffne den Bildschirm erneut.",
  readmeComments: "comments.csv                 Deine Kommentare zu Filmen und Serien (Datum, Spoiler, Antwort).",
  loading: "Deine Bibliothek wird geladen…",
  empty: "Noch nichts zu exportieren. Füge einen Film oder eine Serie hinzu, dann erscheint er hier.",
  notIncluded: "Nicht enthalten: Beiträge und Beitragskommentare, Notizen, Erinnerungen, Chats und Kontodaten.",

  sectionExport: "Exportieren",
  jsonTitle: "Vollständige Sicherung (JSON)",
  jsonSub: "Alles: Listen, Sehdaten, Folgenverlauf bei Serien, Bewertungen, Kommentare. Wiederherstellbar.",
  zipTitle: "Tabelle und Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + CSVs, die du in Letterboxd importieren kannst",
  ready: "Export bereit",

  noteLetterboxd:
    "Letterboxd kennt nur Filme: Serien stehen in der JSON und der library.csv, aber nicht in den Letterboxd-Dateien. Zum Hochladen nutze Settings > Import & Export auf letterboxd.com; importiere die gesehenen Filme und die Merkliste getrennt.",
  notePrivacy: "Die Datei wird nur auf deinem Gerät erstellt. Wohin du sie sendest, wählst du im Teilen-Menü.",

  errWrite: "Die Datei konnte nicht erstellt werden",
  errSharing: "Teilen ist auf diesem Gerät nicht verfügbar",
  errZip: "Die ZIP-Datei konnte nicht erstellt werden",
  errEmpty: "Es gibt keine Daten zum Exportieren",

  readme: [
    "Seelogd library export",
    "",
    "library.csv                  Alle Listen in einer Tabelle (Excel / Google Sheets).",
    "letterboxd-watched*.csv      Von dir gesehene Filme (Datum, Bewertung, erneutes Ansehen). In Letterboxd importierbar.",
    "letterboxd-watchlist*.csv    Filme auf deiner Merkliste. In Letterboxd importierbar.",
    "",
    "Letterboxd: letterboxd.com > Settings > Import & Export. Die Dateien ordnen Filme über die tmdbID zu.",
    "Letterboxd kennt nur Filme; Serien stehen in der library.csv und in der JSON-Sicherung.",
    "Große Bibliotheken werden als -1, -2 ... aufgeteilt, um unter dem 1-MB-Limit zu bleiben; lade sie der Reihe nach hoch.",
  ].join("\n"),
};
const it = {
  title: "Esporta la tua libreria",
  rowTitle: "Esporta la tua libreria",
  rowSub: "Ottieni i tuoi elenchi, la cronologia delle visualizzazioni e le valutazioni in formato JSON o CSV",
  heroTitle: "I tuoi dati sono tuoi",
  selectAll: "Seleziona tutto",
  selectNone: "Cancella",
  noneSelected: "Seleziona almeno un elemento",
  infoLabel: "Informazioni",
  sectionsSelected: "{n}/{total} items selected",
  statFilms: "Film",
  statShows: "Serie TV",
  statEpisodes: "Episodi",
  statRatings: "Valutazioni",
  heroText: "I titoli, gli elenchi, le date di visione e le valutazioni guardati vengono visualizzati come file sul tuo dispositivo. Spostali in un'altra app o conservali come backup.",
  sectionIncluded: "Cosa è incluso",
  films: n => n === 1 ? "1 film guardato" : `${n} film guardati`,
  shows: (n, episodes) => `${n} programmi · ${episodes} episodi`,
  watchList: n => n === 1 ? "1 nella tua lista di titoli" : `${n} nella tua lista di titoli`,
  favorites: n => n === 1 ? "1 preferito" : `${n} preferiti`,
  customLists: (lists, items) => `${lists} elenchi personalizzati · ${items} titoli`,
  ratings: n => n === 1 ? "1 valutazione" : `${n} valutazioni`,
  comments: (n) => (n === 1 ? "1 commento" : `${n} commenti`),
  statComments: "Commenti",
  commentsLoading: "Lettura dei tuoi commenti…",
  commentsFailed: "Impossibile leggere i tuoi commenti; non saranno in questo file. Controlla la connessione e riapri questa schermata.",
  readmeComments: "comments.csv                 Commenti che hai scritto su film e serie TV (data, spoiler, risposta).",
  loading: "Caricamento della libreria…",
  empty: "Ancora niente da esportare. Aggiungi un film o un programma e verrà visualizzato qui.",
  notIncluded: "Non inclusi: post e relativi commenti, note, promemoria, chat e dettagli dell'account.",
  sectionExport: "Esportare",
  jsonTitle: "Backup completo (JSON)",
  jsonSub: "Tutto: elenchi, date di visione, cronologia degli episodi per serie TV, valutazioni, commenti. Ripristinabile.",
  zipTitle: "Foglio di calcolo e cassetta delle lettere (ZIP)",
  zipSub: "Library.csv (Excel/Fogli) + CSV che puoi importare in Letterboxd",
  ready: "Esportazione pronta",
  noteLetterboxd: "Letterboxd riconosce solo i film: gli serie TV sono in JSON e Library.csv ma ​​non nei file Letterboxd. Per caricare, utilizza Impostazioni > Importa ed esporta su letterboxd.com; importare separatamente i film visti e la watchlist.",
  notePrivacy: "Il file viene creato solo sul tuo dispositivo. Scegli dove inviarlo dal foglio di condivisione.",
  errWrite: "Impossibile creare il file",
  errSharing: "La condivisione non è disponibile su questo dispositivo",
  errZip: "Impossibile creare il file ZIP",
  errEmpty: "Non ci sono dati da esportare",
  readme: ["Libreria Seelogd export", "", "library.csv Tutti gli elenchi in una tabella (Excel/Fogli Google).", "letterboxd-watched*.csv Film che hai guardato (data, valutazione, riguarda). Importabile in Letterboxd.", "letterboxd-watchlist*.csv Film nella tua watchlist. Importabile in Letterboxd.", "", "Letterboxd: letterboxd.com > Impostazioni > Importa ed esporta. I file corrispondono ai film per tmdbID.", "Letterboxd conosce solo i film; gli serie TV sono in libreria.csv e nel backup JSON.", "Le librerie di grandi dimensioni sono suddivise in -1, -2... per rimanere sotto il limite di 1 MB; caricali in ordine."].join("\n")
};
const fr = {
  title: "Exporter ta bibliothèque",
  rowTitle: "Exporter ta bibliothèque",
  rowSub: "Récupère tes listes, ton historique et tes notes en JSON ou CSV",
  heroTitle: "Tes données t'appartiennent",
  selectAll: "Tout sélectionner",
  selectNone: "Effacer",
  noneSelected: "Sélectionne au moins un élément",
  infoLabel: "Infos",
  sectionsSelected: "{n}/{total} éléments sélectionnés",
  statFilms: "Films",
  statShows: "Séries",
  statEpisodes: "Épisodes",
  statRatings: "Notes",
  heroText:
    "Tes titres vus, listes, dates de visionnage et notes sortent sous forme de fichiers sur ton appareil. Transfère-les vers une autre app ou garde-les en sauvegarde.",

  sectionIncluded: "Ce qui est inclus",
  films: (n) => (n === 1 ? "1 film vu" : `${n} films vus`),
  shows: (n, episodes) => `${n} séries · ${episodes} épisodes`,
  watchList: (n) => (n === 1 ? "1 dans ta liste à voir" : `${n} dans ta liste à voir`),
  favorites: (n) => (n === 1 ? "1 favori" : `${n} favoris`),
  customLists: (lists, items) => `${lists} listes perso · ${items} titres`,
  ratings: (n) => (n === 1 ? "1 note" : `${n} notes`),
  comments: (n) => (n === 1 ? "1 commentaire" : `${n} commentaires`),
  statComments: "Commentaires",
  commentsLoading: "Lecture de tes commentaires…",
  commentsFailed: "Impossible de lire tes commentaires ; ils ne seront pas dans ce fichier. Vérifie ta connexion et rouvre cet écran.",
  readmeComments: "comments.csv                 Commentaires écrits sur des films et séries (date, spoiler, réponse).",
  loading: "Chargement de ta bibliothèque…",
  empty: "Rien à exporter pour l'instant. Ajoute un film ou une série et il apparaîtra ici.",
  notIncluded: "Non inclus : publications et leurs commentaires, notes, rappels, discussions et informations du compte.",

  sectionExport: "Exporter",
  jsonTitle: "Sauvegarde complète (JSON)",
  jsonSub: "Tout : listes, dates de visionnage, historique des épisodes, notes, commentaires. Restaurable.",
  zipTitle: "Tableur et Letterboxd (ZIP)",
  zipSub: "library.csv (Excel / Sheets) + CSV importables dans Letterboxd",
  ready: "Export prêt",

  noteLetterboxd:
    "Letterboxd ne connaît que les films : les séries sont dans le JSON et library.csv mais pas dans les fichiers Letterboxd. Pour les importer, utilise Settings > Import & Export sur letterboxd.com ; importe séparément les films vus et la liste à voir.",
  notePrivacy: "Le fichier est créé uniquement sur ton appareil. Tu choisis où l'envoyer depuis la feuille de partage.",

  errWrite: "Impossible de créer le fichier",
  errSharing: "Le partage n'est pas disponible sur cet appareil",
  errZip: "Impossible de créer le fichier ZIP",
  errEmpty: "Il n'y a aucune donnée à exporter",

  readme: [
    "Export de la bibliothèque Seelogd",
    "",
    "library.csv                  Toutes les listes dans un seul tableau (Excel / Google Sheets).",
    "letterboxd-watched*.csv      Films vus (date, note, revisionnage). Importables dans Letterboxd.",
    "letterboxd-watchlist*.csv    Films de ta liste à voir. Importables dans Letterboxd.",
    "",
    "Letterboxd : letterboxd.com > Settings > Import & Export. Les fichiers associent les films par tmdbID.",
    "Letterboxd ne connaît que les films ; les séries sont dans library.csv et la sauvegarde JSON.",
    "Les grandes bibliothèques sont découpées en -1, -2 ... pour rester sous la limite de 1 Mo ; importe-les dans l'ordre.",
  ].join("\n"),
};
const ja = {
  title: "ライブラリを書き出す",
  rowTitle: "ライブラリを書き出す",
  rowSub: "リスト、視聴履歴、評価をJSONまたはCSVで取得",
  heroTitle: "あなたのデータはあなたのもの",
  selectAll: "すべて選択",
  selectNone: "クリア",
  noneSelected: "少なくとも1項目を選んでください",
  infoLabel: "情報",
  sectionsSelected: "{total}項目中{n}項目を選択中",
  statFilms: "映画",
  statShows: "TV番組",
  statEpisodes: "エピソード",
  statRatings: "評価",
  heroText:
    "視聴済み作品、リスト、視聴日、評価が端末上のファイルとして書き出されます。別のアプリに移したり、バックアップとして保管したりできます。",

  sectionIncluded: "含まれるもの",
  films: (n) => (n === 1 ? "視聴済みの映画1本" : `視聴済みの映画${n}本`),
  shows: (n, episodes) => `番組${n}本 · ${episodes}話`,
  watchList: (n) => (n === 1 ? "ウォッチリストに1件" : `ウォッチリストに${n}件`),
  favorites: (n) => (n === 1 ? "お気に入り1件" : `お気に入り${n}件`),
  customLists: (lists, items) => `カスタムリスト${lists}件 · ${items}作品`,
  ratings: (n) => (n === 1 ? "評価1件" : `評価${n}件`),
  comments: (n) => (n === 1 ? "コメント1件" : `コメント${n}件`),
  statComments: "コメント",
  commentsLoading: "コメントを読み込み中…",
  commentsFailed: "コメントを読み込めなかったため、このファイルには含まれません。接続を確認して、この画面を開き直してください。",
  readmeComments: "comments.csv                 映画や番組に書いたコメント(日付、ネタバレ、返信)。",
  loading: "ライブラリを読み込み中…",
  empty: "まだ書き出すものがありません。映画や番組を追加するとここに表示されます。",
  notIncluded: "含まれないもの:投稿と投稿へのコメント、メモ、リマインダー、チャット、アカウント情報。",

  sectionExport: "書き出し",
  jsonTitle: "フルバックアップ(JSON)",
  jsonSub: "すべて:リスト、視聴日、番組のエピソード履歴、評価、コメント。復元できます。",
  zipTitle: "スプレッドシートとLetterboxd(ZIP)",
  zipSub: "library.csv(Excel / スプレッドシート)+Letterboxdに取り込めるCSV",
  ready: "書き出しの準備ができました",

  noteLetterboxd:
    "Letterboxdは映画にしか対応していません:番組はJSONとlibrary.csvには含まれますが、Letterboxd用ファイルには含まれません。アップロードするにはletterboxd.comの Settings > Import & Export を使い、視聴済みの映画とウォッチリストを別々に取り込んでください。",
  notePrivacy: "ファイルはこの端末上にのみ作成されます。送り先はシェアシートから選べます。",

  errWrite: "ファイルを作成できませんでした",
  errSharing: "この端末ではシェアを利用できません",
  errZip: "ZIPファイルを作成できませんでした",
  errEmpty: "書き出すデータがありません",

  readme: [
    "Seelogd ライブラリの書き出し",
    "",
    "library.csv                  すべてのリストを1つの表に(Excel / Googleスプレッドシート)。",
    "letterboxd-watched*.csv      視聴済みの映画(日付、評価、再視聴)。Letterboxdに取り込めます。",
    "letterboxd-watchlist*.csv    ウォッチリストの映画。Letterboxdに取り込めます。",
    "",
    "Letterboxd:letterboxd.com > Settings > Import & Export。ファイルはtmdbIDで映画を照合します。",
    "Letterboxdは映画にしか対応していません。番組はlibrary.csvとJSONバックアップに含まれます。",
    "大きなライブラリは1 MBの上限を超えないよう -1、-2 ... に分割されます。順番にアップロードしてください。",
  ].join("\n"),
};

export const LIBRARY_EXPORT_COPY = { tr, en, es, pt, de ,
  it: it,
  fr,
  ja};

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

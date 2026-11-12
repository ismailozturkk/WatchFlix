// screens/tabs/settings/sensitiveContentCopy.js
//
// Ayarlar > Hassas İçerikler metinleri: yerel tr/en/es/pt/de. Anahtar eşitliği
// __tests__/copyTablesSpanish.test.js'te bekçilenir. Kategoriler
// utils/sensitiveContent.js → SENSITIVE_CATEGORIES ile aynı sırada; her biri
// [ad, açıklama].

import { copyLanguage } from "../../../utils/appLanguages";

const tr = {
  title: "Hassas İçerikler",
  rowAllHidden: "Hepsi gizli",
  rowSomeShown: "{n} kategori gösteriliyor",
  intro:
    "Açtığın kategoriler keşif, arama, öneri ve raflarda görünür. Kapalı olanlar gizlenir. Hepsi varsayılan olarak kapalıdır.",
  categories: {
    adult: ["Yetişkin içerik (18+)", "Cinsel içerikli ve 18+ olarak işaretli yapımlar"],
    drugs: ["Uyuşturucu ve madde kullanımı", "Uyuşturucu, bağımlılık ve kartel temalı yapımlar"],
    gore: ["Kan ve vahşet", "Aşırı kan, işkence ve vahşet içeren yapımlar"],
    war: ["Savaş", "Savaş türündeki film ve diziler"],
  },
  note:
    "Eşleştirme TMDB etiketleri, türleri ve açıklamalara göre yapılır; bazı yapımlar gözden kaçabilir. Kendi listelerin ve doğrudan açtığın sayfalar etkilenmez.",
};

const en = {
  title: "Sensitive Content",
  rowAllHidden: "All hidden",
  rowSomeShown: "{n} categories shown",
  intro:
    "Categories you turn on appear in discovery, search, recommendations and rails. Turned-off ones are hidden. All are off by default.",
  categories: {
    adult: ["Adult content (18+)", "Sexual content and titles marked 18+"],
    drugs: ["Drugs and substance use", "Titles about drugs, addiction and cartels"],
    gore: ["Gore and brutality", "Titles with graphic blood, torture and brutality"],
    war: ["War", "Movies and shows in the war genre"],
  },
  note:
    "Matching uses TMDB keywords, genres and descriptions, so some titles may slip through. Your own lists and pages you open directly are not affected.",
};

const es = {
  title: "Contenido sensible",
  rowAllHidden: "Todo oculto",
  rowSomeShown: "{n} categorías visibles",
  intro:
    "Las categorías que actives aparecerán en descubrir, búsqueda, recomendaciones y carruseles. Las desactivadas se ocultan. Todas están desactivadas por defecto.",
  categories: {
    adult: ["Contenido adulto (18+)", "Contenido sexual y títulos marcados como 18+"],
    drugs: ["Drogas y consumo de sustancias", "Títulos sobre drogas, adicción y cárteles"],
    gore: ["Sangre y violencia extrema", "Títulos con sangre explícita, tortura y brutalidad"],
    war: ["Guerra", "Películas y series del género bélico"],
  },
  note:
    "La detección usa etiquetas, géneros y descripciones de TMDB; algunos títulos pueden escaparse. Tus listas y las páginas que abres directamente no se ven afectadas.",
};

const pt = {
  title: "Conteúdo sensível",
  rowAllHidden: "Tudo oculto",
  rowSomeShown: "{n} categorias visíveis",
  intro:
    "As categorias que você ativar aparecem em descobrir, busca, recomendações e trilhos. As desativadas ficam ocultas. Todas começam desativadas.",
  categories: {
    adult: ["Conteúdo adulto (18+)", "Conteúdo sexual e títulos marcados como 18+"],
    drugs: ["Drogas e uso de substâncias", "Títulos sobre drogas, vício e cartéis"],
    gore: ["Sangue e violência extrema", "Títulos com sangue explícito, tortura e brutalidade"],
    war: ["Guerra", "Filmes e séries do gênero guerra"],
  },
  note:
    "A detecção usa palavras-chave, gêneros e descrições do TMDB; alguns títulos podem escapar. Suas listas e as páginas que você abre diretamente não são afetadas.",
};

const de = {
  title: "Sensible Inhalte",
  rowAllHidden: "Alles ausgeblendet",
  rowSomeShown: "{n} Kategorien sichtbar",
  intro:
    "Aktivierte Kategorien erscheinen in Entdecken, Suche, Empfehlungen und Leisten. Deaktivierte werden ausgeblendet. Standardmäßig ist alles aus.",
  categories: {
    adult: ["Erwachseneninhalte (18+)", "Sexuelle Inhalte und als 18+ markierte Titel"],
    drugs: ["Drogen und Substanzkonsum", "Titel über Drogen, Sucht und Kartelle"],
    gore: ["Blut und Brutalität", "Titel mit drastischem Blut, Folter und Brutalität"],
    war: ["Krieg", "Filme und Serien aus dem Kriegsgenre"],
  },
  note:
    "Die Erkennung nutzt TMDB-Schlagwörter, Genres und Beschreibungen; manche Titel können durchrutschen. Deine eigenen Listen und direkt geöffnete Seiten sind nicht betroffen.",
};
const it = {
  title: "Contenuti sensibili",
  rowAllHidden: "Tutto nascosto",
  rowSomeShown: "{n} categorie mostrate",
  intro: "Le categorie attivate vengono visualizzate nella scoperta, nella ricerca, nei consigli e nelle guide. Quelli spenti sono nascosti. Sono tutti disattivati ​​per impostazione predefinita.",
  categories: {
    adult: ["Contenuti per adulti (18+)", "Contenuti e titoli di natura sessuale contrassegnati come 18+"],
    drugs: ["Droghe e uso di sostanze", "Titoli su droga, dipendenze e cartelli"],
    gore: ["Sangue e brutalità", "Titoli con immagini esplicite di sangue, tortura e brutalità"],
    war: ["Guerra", "Film e programmi di genere bellico"]
  },
  note: "La corrispondenza utilizza parole chiave, generi e descrizioni TMDB, quindi alcuni titoli potrebbero sfuggire. I tuoi elenchi e le pagine che apri direttamente non sono interessati."
};

export const SENSITIVE_CONTENT_COPY = Object.freeze({ tr, en, es, pt, de ,
  it: it});

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getSensitiveContentCopy = (language) =>
  SENSITIVE_CONTENT_COPY[copyLanguage(language, Object.keys(SENSITIVE_CONTENT_COPY))];

/** Ayarlar ana ekranındaki satırın alt yazısı. */
export const sensitiveRowSubtitle = (copy, sensitiveContent) => {
  const n = Object.values(sensitiveContent || {}).filter((v) => v === true).length;
  return n === 0 ? copy.rowAllHidden : copy.rowSomeShown.replace("{n}", String(n));
};

// utils/tasteMatchCopy.js
//
// Arkadaş profilindeki "Zevk uyumu" kartının ve "Birlikte izleyelim" bölümünün metinleri (tr / en / es).
// Saf veri: RN içe aktarması yok. __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.

import { copyLanguage } from "./appLanguages";

export const TASTE_MATCH_COPY = {
  tr: {
    title: "Zevk uyumu",
    tiers: {
      veryHigh: "Zevkleriniz çok yakın",
      high: "Epey benzer zevkleriniz var",
      medium: "Kısmen örtüşüyorsunuz",
      low: "Zevkleriniz farklı",
    },
    limited: "Bazı veriler eksik olduğu için yaklaşık bir sonuç",
    noData: {
      hidden: (name) => `${name} izleme listelerini paylaşmıyor; karşılaştırma yapılamıyor`,
      notEnough: "Karşılaştırma için ikinizin de biraz daha izleme kaydı olmalı",
    },
    rows: {
      overlap: (n) => (n === 1 ? "1 ortak izlenen" : `${n} ortak izlenen`),
      favorites: (n) => (n === 1 ? "1 ortak favori" : `${n} ortak favori`),
      genres: (list) => `Ortak türler: ${list}`,
      ratings: (percent, pairs) => `Puanlarda %${percent} uyum · ${pairs} ortak puan`,
    },
    together: {
      title: "Birlikte izleyelim",
      both: (n) => `İkinizin de listesinde ${n} yapım var`,
      mixed: (n) => `İkinizin de henüz izlemediği ${n} aday`,
      none: "Ortak bir aday bulunamadı",
      noneHint: "İzleme listelerine birkaç yapım ekleyince burada önerilir",
      hiddenList: (name) => `${name} izleme listesini paylaşmıyor; yalnız senin listenden aday çıkarılır`,
      sources: { both: "İkinizin listesinde", mine: "Senin listenden", theirs: "Onun listesinden" },
      action: (name) => `Oda kur, ${name} adlı kişiye davet gönder`,
      actionHint: "CineSwipe'ta aynı desteyi kaydırın; ikinizin de beğendiği yapımlar eşleşir",
      limit: (n) => `İlk ${n} aday odaya alınır`,
      needFriend: "Davet göndermek için önce arkadaş olmalısınız",
    },
  },
  en: {
    title: "Taste match",
    tiers: {
      veryHigh: "Your tastes are very close",
      high: "You have quite similar tastes",
      medium: "You partly overlap",
      low: "Your tastes differ",
    },
    limited: "An approximate result because some data is missing",
    noData: {
      hidden: (name) => `${name} doesn't share watch lists, so there's nothing to compare`,
      notEnough: "You both need a few more watched titles to compare",
    },
    rows: {
      overlap: (n) => (n === 1 ? "1 title you both watched" : `${n} titles you both watched`),
      favorites: (n) => (n === 1 ? "1 shared favorite" : `${n} shared favorites`),
      genres: (list) => `Shared genres: ${list}`,
      ratings: (percent, pairs) => `${percent}% agreement on ratings · ${pairs} rated by both`,
    },
    together: {
      title: "Let's watch together",
      both: (n) => `${n} titles are on both your lists`,
      mixed: (n) => `${n} candidates neither of you has watched`,
      none: "No shared candidates found",
      noneHint: "Add a few titles to your watchlists and they'll show up here",
      hiddenList: (name) => `${name} doesn't share their watchlist; candidates come from your list only`,
      sources: { both: "On both lists", mine: "From your list", theirs: "From their list" },
      action: (name) => `Create a room and invite ${name}`,
      actionHint: "Swipe the same deck in CineSwipe; titles you both like become matches",
      limit: (n) => `The first ${n} candidates go into the room`,
      needFriend: "You need to be friends to send an invite",
    },
  },
  es: {
    title: "Afinidad de gustos",
    tiers: {
      veryHigh: "Vuestros gustos son muy parecidos",
      high: "Tenéis gustos bastante parecidos",
      medium: "Coincidís en parte",
      low: "Vuestros gustos son distintos",
    },
    limited: "Resultado aproximado porque faltan algunos datos",
    noData: {
      hidden: (name) => `${name} no comparte sus listas, así que no hay nada que comparar`,
      notEnough: "Ambos necesitáis algunos títulos vistos más para comparar",
    },
    rows: {
      overlap: (n) => (n === 1 ? "1 título visto por ambos" : `${n} títulos vistos por ambos`),
      favorites: (n) => (n === 1 ? "1 favorito en común" : `${n} favoritos en común`),
      genres: (list) => `Géneros en común: ${list}`,
      ratings: (percent, pairs) => `${percent}% de acuerdo en puntuaciones · ${pairs} puntuados por ambos`,
    },
    together: {
      title: "Veamos algo juntos",
      both: (n) => `Hay ${n} títulos en las listas de los dos`,
      mixed: (n) => `${n} candidatos que ninguno de los dos ha visto`,
      none: "No se encontraron candidatos en común",
      noneHint: "Añade algunos títulos a vuestras listas de pendientes y aparecerán aquí",
      hiddenList: (name) => `${name} no comparte su lista de pendientes; los candidatos salen solo de la tuya`,
      sources: { both: "En las dos listas", mine: "De tu lista", theirs: "De su lista" },
      action: (name) => `Crear una sala e invitar a ${name}`,
      actionHint: "Deslizad el mismo mazo en CineSwipe; los títulos que os gusten a los dos coinciden",
      limit: (n) => `Los primeros ${n} candidatos entran en la sala`,
      needFriend: "Tenéis que ser amigos para enviar una invitación",
    },
  },
  pt: {
    title: "Afinidade de gostos",
    tiers: {
      veryHigh: "Seus gostos são muito parecidos",
      high: "Vocês têm gostos bem parecidos",
      medium: "Vocês coincidem em parte",
      low: "Seus gostos são diferentes",
    },
    limited: "Resultado aproximado porque faltam alguns dados",
    noData: {
      hidden: (name) => `${name} não compartilha as listas, então não há o que comparar`,
      notEnough: "Os dois precisam de mais alguns títulos assistidos para comparar",
    },
    rows: {
      overlap: (n) => (n === 1 ? "1 título assistido pelos dois" : `${n} títulos assistidos pelos dois`),
      favorites: (n) => (n === 1 ? "1 favorito em comum" : `${n} favoritos em comum`),
      genres: (list) => `Gêneros em comum: ${list}`,
      ratings: (percent, pairs) => `${percent}% de concordância nas notas · ${pairs} avaliados pelos dois`,
    },
    together: {
      title: "Vamos assistir juntos",
      both: (n) => `Há ${n} títulos nas listas dos dois`,
      mixed: (n) => `${n} candidatos que nenhum dos dois assistiu`,
      none: "Nenhum candidato em comum foi encontrado",
      noneHint: "Adicione alguns títulos às listas para assistir de vocês e eles aparecerão aqui",
      hiddenList: (name) => `${name} não compartilha a lista para assistir; os candidatos vêm só da sua`,
      sources: { both: "Nas duas listas", mine: "Da sua lista", theirs: "Da lista dele(a)" },
      action: (name) => `Criar uma sala e convidar ${name}`,
      actionHint: "Deslizem o mesmo baralho no CineSwipe; os títulos que os dois curtirem dão match",
      limit: (n) => `Os primeiros ${n} candidatos entram na sala`,
      needFriend: "Vocês precisam ser amigos para enviar um convite",
    },
  },
  de: {
    title: "Geschmacks-Match",
    tiers: {
      veryHigh: "Euer Geschmack liegt sehr nah beieinander",
      high: "Ihr habt einen recht ähnlichen Geschmack",
      medium: "Ihr überschneidet euch teilweise",
      low: "Euer Geschmack unterscheidet sich",
    },
    limited: "Ein ungefähres Ergebnis, weil einige Daten fehlen",
    noData: {
      hidden: (name) => `${name} teilt keine Merklisten, daher gibt es nichts zu vergleichen`,
      notEnough: "Ihr braucht beide noch ein paar gesehene Titel für einen Vergleich",
    },
    rows: {
      overlap: (n) => (n === 1 ? "1 Titel, den ihr beide gesehen habt" : `${n} Titel, die ihr beide gesehen habt`),
      favorites: (n) => (n === 1 ? "1 gemeinsamer Favorit" : `${n} gemeinsame Favoriten`),
      genres: (list) => `Gemeinsame Genres: ${list}`,
      ratings: (percent, pairs) => `${percent} % Übereinstimmung bei Bewertungen · ${pairs} von beiden bewertet`,
    },
    together: {
      title: "Lasst uns gemeinsam schauen",
      both: (n) => `${n} Titel stehen auf euren beiden Listen`,
      mixed: (n) => `${n} Kandidaten, die keiner von euch gesehen hat`,
      none: "Keine gemeinsamen Kandidaten gefunden",
      noneHint: "Füge deinen Merklisten ein paar Titel hinzu, dann erscheinen sie hier",
      hiddenList: (name) => `${name} teilt die Merkliste nicht; die Kandidaten stammen nur aus deiner Liste`,
      sources: { both: "Auf beiden Listen", mine: "Aus deiner Liste", theirs: "Aus ihrer Liste" },
      action: (name) => `Raum erstellen und ${name} einladen`,
      actionHint: "Wischt in CineSwipe dasselbe Deck; Titel, die euch beiden gefallen, werden zu Matches",
      limit: (n) => `Die ersten ${n} Kandidaten kommen in den Raum`,
      needFriend: "Ihr müsst befreundet sein, um eine Einladung zu senden",
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getTasteMatchCopy = (language) =>
  TASTE_MATCH_COPY[copyLanguage(language, Object.keys(TASTE_MATCH_COPY))];

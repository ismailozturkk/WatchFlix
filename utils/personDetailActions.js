// utils/personDetailActions.js
//
// Oyuncu / yönetmen sayfasındaki (screens/actor/ActorViewScreen.js) "Yapay Zeka"
// ve "Sohbete gönder" düğmelerinin SAF çekirdeği (React/Firebase yok, jest ile
// test edilir).
//
//   • personKnownFor     → kişinin en bilinen yapımları (oy sayısına göre).
//   • buildPersonAiRequest → AI'a giden ayrıntılı istek + balonda görünen kısa metin
//     (film/dizi detayındaki utils/detailAiRequest ile aynı ikili).
//   • buildPersonChatMedia → sohbete gidecek tekli `media` mesajı. Sohbet aramasında
//     seçilen kişiyle (screens/chat/ChatScreen.js toChatMedia) AYNI şema; kartı
//     components/chat/SharedMediaMessage çizer, dokununca ActorViewScreen açılır.

import { i18nText } from "./i18nText";

const MAX_KNOWN_FOR = 4;
const MAX_TITLE = 90;

const titleOf = (credit) => {
  const raw = credit?.title || credit?.name;
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE) : "";
};

/**
 * Kişinin en bilinen yapım adları. Oyuncuda rol aldığı yapımlar; yönetmen /
 * yazar gibi ekipte kendi bölümündeki işler (yoksa rol aldıkları). Sıralama oy
 * sayısına göre: popülerlik günlük oynar, oy sayısı "en bilinen"i daha iyi
 * yakalar. Aynı ad (film + aynı adlı dizi, birden çok ekip görevi) bir kez sayılır.
 */
export function personKnownFor(person, limit = MAX_KNOWN_FOR) {
  if (!person) return [];
  const cast = [
    ...(person.movie_credits?.cast || []),
    ...(person.tv_credits?.cast || []),
  ];
  const department = person.known_for_department;
  const crew =
    department && department !== "Acting"
      ? [
          ...(person.movie_credits?.crew || []),
          ...(person.tv_credits?.crew || []),
        ].filter((credit) => credit?.department === department)
      : [];
  const pool = crew.length ? crew : cast;

  const seen = new Set();
  const titles = [];
  [...pool]
    .sort((a, b) => (b?.vote_count || 0) - (a?.vote_count || 0))
    .forEach((credit) => {
      if (titles.length >= limit) return;
      const title = titleOf(credit);
      const key = title.toLocaleLowerCase();
      if (!title || seen.has(key)) return;
      seen.add(key);
      titles.push(title);
    });
  return titles;
}

/**
 * AI isteği. Bilinen yapımlar ada parantez içinde eklenir: aynı adlı iki kişiyi
 * (ör. iki "Chris Evans") modelin karıştırmaması için.
 */
export function buildPersonAiRequest(person) {
  const name = typeof person?.name === "string" ? person.name.trim() : "";
  if (!name) return { prompt: "", display: "" };
  const knownFor = personKnownFor(person, 3);
  const namedPerson = knownFor.length ? `${name} (${knownFor.join(", ")})` : name;
  return {
    prompt: i18nText(
      "autoI18n.kisi_ai_prompt",
      "{{name}} hakkında spoiler vermeden bilgi ver. Kısa biyografisini, kariyerinin dönüm noktalarını, en bilinen yapımlarını, önemli ödüllerini, tarzını ve işlerini izlemeye nereden başlanabileceğini kısa başlıklarla anlat.",
      { name: namedPerson },
    ),
    display: i18nText("autoI18n.kisi_ai_display", "{{name}} hakkında bilgi verir misin?", { name }),
  };
}

/** Sohbete gönderilecek tekli kişi kartı; kimliği/adı yoksa null. */
export function buildPersonChatMedia(person) {
  const name = typeof person?.name === "string" ? person.name.trim() : "";
  if (!person?.id || !name) return null;
  const knownFor = personKnownFor(person).join(", ");
  return {
    id: person.id,
    media_type: "person",
    title: name.slice(0, MAX_TITLE),
    poster_path: person.profile_path || null,
    // Kişi kartında overview "bilinen yapımlar" satırıdır (SharedMediaMessage).
    overview: knownFor || null,
    known_for_department: person.known_for_department || null,
  };
}

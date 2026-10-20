// utils/worldTour.js
//
// Film / Dizi ana ekranındaki "Dünya Turu" rafının SAF mantığı (React/RN importu yok — jest doğrudan okur).
//
// FİKİR: tür ya da puan değil ÜLKE/DİL üzerinden keşif. Raf, çip satırındaki dillerden birini seçtirir
// (Korece, Japonca, Türkçe…) ve o dilde çekilmiş, popüler ve iyi puanlı yapımları gösterir. Mevcut
// raflar zaten "ne kadar iyi / ne kadar popüler / hangi tür" sorularını yanıtlıyor; bu "nerenin işi"
// sorusunu ekler.
//
// TMDB: `/discover` içindeki `with_original_language` TEK bir ISO 639-1 kodu alır (pipe ile birden çok dil
// güvenilir değil), bu yüzden raf bir dil seçtirir, hepsini karıştırmaz. Ana liste dili (İngilizce) bilerek
// çiplerde YOK: ana akış zaten onunla dolu.
//
// DİL: tr/en/es/pt/de; bilinmeyen dil İngilizce (utils/appLanguages.pickByLanguage).
//
// YENİ DİL ÇİPİ: aşağıdaki listeye bir giriş ekle (kod, bayrak, beş dilde ad). __tests__/worldTour.test.js
// her girişin tüm dillerde dolu olduğunu ve kodların tekrar etmediğini doğrular.
import { pickByLanguage } from "./appLanguages";

const tri = (tr, en, es, pt, de) => ({ tr, en, es: es ?? en, pt: pt ?? en, de: de ?? en });

/** Çip sırası = ekrandaki sıra. İlk giriş varsayılandır. */
export const WORLD_TOUR_LANGUAGES = Object.freeze([
  { code: "ko", flag: "🇰🇷", name: tri("Korece", "Korean", "Coreano", "Coreano", "Koreanisch") },
  { code: "ja", flag: "🇯🇵", name: tri("Japonca", "Japanese", "Japonés", "Japonês", "Japanisch") },
  { code: "tr", flag: "🇹🇷", name: tri("Türkçe", "Turkish", "Turco", "Turco", "Türkisch") },
  { code: "fr", flag: "🇫🇷", name: tri("Fransızca", "French", "Francés", "Francês", "Französisch") },
  { code: "es", flag: "🇪🇸", name: tri("İspanyolca", "Spanish", "Español", "Espanhol", "Spanisch") },
  { code: "hi", flag: "🇮🇳", name: tri("Hintçe", "Hindi", "Hindi", "Hindi", "Hindi") },
  { code: "it", flag: "🇮🇹", name: tri("İtalyanca", "Italian", "Italiano", "Italiano", "Italienisch") },
  { code: "de", flag: "🇩🇪", name: tri("Almanca", "German", "Alemán", "Alemão", "Deutsch") },
]);

export const WORLD_TOUR_DEFAULT = WORLD_TOUR_LANGUAGES[0].code;

const BY_CODE = new Map(WORLD_TOUR_LANGUAGES.map((entry) => [entry.code, entry]));

export const isWorldTourLanguage = (code) => BY_CODE.has(code);

/** Bilinmeyen/boş kod → varsayılan (kayıtlı ya da rota parametresinden gelen değer asla ağa çıplak gitmesin). */
export const normalizeWorldTourLanguage = (code) => (BY_CODE.has(code) ? code : WORLD_TOUR_DEFAULT);

/** "Korece" (uygulama diline göre). */
export function worldTourName(code, language) {
  const entry = BY_CODE.get(normalizeWorldTourLanguage(code));
  return pickByLanguage(language, entry.name);
}

/** Çip etiketi: "🇰🇷 Korece". */
export function worldTourChipLabel(code, language) {
  const entry = BY_CODE.get(normalizeWorldTourLanguage(code));
  return `${entry.flag} ${pickByLanguage(language, entry.name)}`;
}

const TITLE = tri("Dünya Turu", "World Tour", "Vuelta al mundo", "Volta ao mundo", "Weltreise");
export const worldTourTitle = (language) => pickByLanguage(language, TITLE);

/** "Tümü" ekranının başlığı: "Dünya Turu · Korece". */
export const worldTourSeeAllTitle = (code, language) =>
  `${worldTourTitle(language)} · ${worldTourName(code, language)}`;

const EMPTY = tri(
  "Bu dilde şu an gösterilecek bir şey yok",
  "Nothing to show in this language right now",
  "Ahora mismo no hay nada en este idioma",
  "Nada para mostrar neste idioma agora",
  "In dieser Sprache gibt es gerade nichts zu zeigen",
);
export const worldTourEmptyText = (language) => pickByLanguage(language, EMPTY);

/**
 * `/discover` parametreleri (ekran rafı ve "Tümü" ekranı AYNI kuralı kullanır).
 * Eşikler: çok az oy almış tek tük kayıt öne çıkmasın (vote_count) ve "seçki" hissi bozulmasın
 * (vote_average); Hint/Türk yapımlarında oy sayısı daha az olduğundan eşik düşük tutuldu.
 */
export function worldTourDiscoverParams(code) {
  return {
    with_original_language: normalizeWorldTourLanguage(code),
    sort_by: "popularity.desc",
    "vote_count.gte": 150,
    "vote_average.gte": 6.5,
  };
}

// utils/universeQuotes.js
//
// Gizli replikler: arama kutusuna bir evrenin meşhur repliği yazılırsa ("Winter is coming",
// "May the force be with you"…) o evren kalıcı olarak açılır — detaydaki kapı sorusunun yanında
// ikinci, ipucusuz bir keşif yolu (universeUnlocks.js). Ekranda hiçbir yerde listelenmez.
//
// Eşleştirme kapı sorularıyla aynı normalize biçimde (büyük/küçük harf, Türkçe/aksanlı harf,
// noktalama ve kesme işareti yok sayılır). Yazarken yalnız TAM eşleşme; arama tuşuna basınca
// uzun replikte birkaç harf hatası hoş görülür (her 12 harfe 1). Repliğin parçası açmaz.
//
// Replikler kısa ve evrene özgü seçildi; yaygın bir arama sorgusuyla (yapım adı) çakışmasın diye
// hiçbiri bir film/dizi adı değil.

import { normalizeAnswer } from "./universeRiddles";
import { isUniverseId } from "./universeUnlocks";

export const UNIVERSE_QUOTES = Object.freeze({
  starWars: ["may the force be with you", "guc seninle olsun", "i am your father", "ben senin babanim"],
  matrix: ["there is no spoon", "kasik yok"],
  harryPotter: ["expecto patronum", "wingardium leviosa", "i solemnly swear that i am up to no good"],
  lotr: ["you shall not pass", "gecemezsin", "my precious", "kiymetlim", "kiymetlimiz"],
  dune: ["the spice must flow", "baharat akmali", "fear is the mind killer"],
  batman: ["why so serious", "neden bu kadar ciddi", "neden bu kadar ciddisin"],
  spiderMan: ["with great power comes great responsibility", "buyuk guc buyuk sorumluluk getirir"],
  interstellar: ["do not go gentle into that good night"],
  bladeRunner: ["like tears in rain", "tears in rain", "yagmurdaki gozyaslari gibi"],
  jurassicPark: ["life finds a way", "hayat bir yolunu bulur"],
  avatar: ["i see you", "seni goruyorum"],
  madMax: ["witness me", "sahit ol"],
  pirates: ["why is the rum gone", "rom neden bitti"],
  titanic: ["im the king of the world", "i m the king of the world", "dunyanin kraliyim"],
  backToTheFuture: ["great scott", "1 21 gigawatts"],
  shining: ["heres johnny", "all work and no play makes jack a dull boy"],
  breakingBad: ["i am the one who knocks", "say my name", "kapiyi calan benim", "adimi soyle"],
  got: ["winter is coming", "kis geliyor", "valar morghulis", "you know nothing jon snow"],
  vikings: ["valhalla awaits"],
  sherlock: ["the game is on", "elementary my dear watson"],
  strangerThings: ["friends dont lie", "arkadaslar yalan soylemez"],
  lastOfUs: ["endure and survive"],
  dark: ["the beginning is the end and the end is the beginning", "baslangic sondur ve son baslangictir"],
  squidGame: ["red light green light", "kirmizi isik yesil isik"],
  witcher: ["toss a coin to your witcher"],
  fallout: ["war never changes", "savas asla degismez"],
  moneyHeist: ["bella ciao"],
  deathNote: ["i am justice", "ben adaletim"],
  aot: ["shinzou wo sasageyo", "sasageyo", "tatakae"],
  naruto: ["dattebayo"],
  onePiece: ["kaizoku ou ni ore wa naru", "gomu gomu no", "i m gonna be king of the pirates"],
  fma: ["equivalent exchange", "esdeger takas"],
  rickAndMorty: ["wubba lubba dub dub"],
  jujutsuKaisen: ["ryoiki tenkai"],
});

let INDEX = null;
const index = () => {
  if (INDEX) return INDEX;
  INDEX = [];
  for (const id of Object.keys(UNIVERSE_QUOTES)) {
    if (!isUniverseId(id)) continue;
    for (const q of UNIVERSE_QUOTES[id]) INDEX.push([normalizeAnswer(q).replace(/ /g, ""), id]);
  }
  return INDEX;
};

function withinEdits(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return false;
  }
  return prev[b.length] <= max;
}

/**
 * Metin bir evrenin gizli repliği mi? Evren kimliği ya da null.
 * `lenient`: arama tuşuna basıldı — uzun replikte harf hatası hoş görülür.
 */
export function matchUniverseQuote(text, { lenient = false } = {}) {
  // Boşluksuz karşılaştırma: "here's johnny" / "heres johnny" / "heresjohnny" aynı.
  const s = normalizeAnswer(text).replace(/ /g, "");
  if (s.length < 6) return null;
  for (const [q, id] of index()) {
    if (s === q) return id;
  }
  if (!lenient) return null;
  for (const [q, id] of index()) {
    const tol = Math.floor(q.length / 12);
    if (tol > 0 && withinEdits(s, q, tol)) return id;
  }
  return null;
}

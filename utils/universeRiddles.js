// utils/universeRiddles.js
//
// Gizli evrenlerin kapı soruları. Bir evren İZLEMEKLE açılmaz: yapım izlendi işaretlenince
// detay sayfasında gizli bir kart belirir; dokununca o evrenden, izleyenin kesin bileceği bir
// soru sorulur (karakter adı, yer adı, sayı). Doğru cevap evreni açar (universeUnlocks.js).
//
// Kurallar:
//   • cevaplar dilden bağımsız ÖZEL ADLAR ya da SAYILAR (çeviri gerektirmesin); yerelleştirilmiş
//     ad varsa (Konoha → Gizli Yaprak) `answers`a eşanlamlı olarak eklenir
//   • soru metni çevrilir: autoI18n.evren_soru_<id>, burada yalnız Türkçe yedek
//   • ipucu YOK — bilemeyen izleyerek ya da araştırarak öğrenir
//
// Eşleştirme (`matchesRiddle`): büyük/küçük harf, Türkçe/aksanlı harfler ve noktalama yok
// sayılır; "Aunt May" / "May Teyze" gibi en çok 3 kelimelik cevapta doğru kelime geçmesi yeter;
// uzun cevaplarda 1 (9+ harfte 2) harf hatası hoş görülür.

import { i18nText } from "./i18nText";

export const UNIVERSE_RIDDLES = Object.freeze({
  // filmler
  starWars: { q: "Darth Vader'ın maskenin ardındaki asıl adı ne?", answers: ["anakin", "anakin skywalker"] },
  matrix: { q: "Neo'ya kırmızı ve mavi hapı uzatan adam kim?", answers: ["morpheus", "morfeus", "morfeo"] },
  harryPotter: { q: "Harry'nin kar beyazı baykuşunun adı ne?", answers: ["hedwig", "hedvig", "edvige", "edwiges"] },
  lotr: { q: "Frodo'nun yanından hiç ayrılmayan sadık bahçıvanın adı ne?", answers: ["sam", "samwise", "sam gamgee", "samsagaz", "samvise"] },
  dune: { q: "Baharatın çıkarıldığı çöl gezegeninin adı ne?", answers: ["arrakis", "dune"] },
  batman: { q: "Bruce Wayne'in yıllardır yanından ayrılmayan uşağı kim?", answers: ["alfred", "alfred pennyworth"] },
  spiderMan: { q: "Peter Parker'ı büyüten teyzesinin adı ne?", answers: ["may", "may parker"] },
  interstellar: { q: "Cooper'ın, odasındaki \"hayalet\"le konuşan kızının adı ne?", answers: ["murph", "murphy"] },
  bladeRunner: { q: "İlk filmde kopyaları avlayan Blade Runner'ın soyadı ne?", answers: ["deckard", "rick deckard"] },
  jurassicPark: { q: "Parkı kuran milyarderin soyadı ne?", answers: ["hammond", "john hammond"] },
  avatar: { q: "Na'vi'lerin yaşadığı yemyeşil ayın adı ne?", answers: ["pandora"] },
  madMax: { q: "Fury Road'da savaş tankerini kaçıran tek kollu komutan kim?", answers: ["furiosa"] },
  pirates: { q: "Jack Sparrow'un gemisini elinden alan lanetli kaptan kim?", answers: ["barbossa", "hector barbossa"] },
  inception: { q: "Cobb'un rüyalarına durmadan giren eşinin adı ne?", answers: ["mal", "mallorie", "mal cobb"] },
  titanic: { q: "Rose'un gemide tanıştığı genç ressamın adı ne?", answers: ["jack", "jack dawson"] },
  backToTheFuture: { q: "Zaman makinesi saatte kaç mile ulaşınca zamanda yolculuk eder?", answers: ["88", "141", "142"] }, // 88 mph ≈ 141,6 km/s
  shining: { q: "Torrance ailesinin kışı geçirdiği otelin adı ne?", answers: ["overlook"] },
  // diziler
  breakingBad: { q: "Walter White'ın uyuşturucu dünyasındaki takma adı ne?", answers: ["heisenberg"] },
  got: { q: "Daenerys'in üç ejderhasından en büyüğünün adı ne?", answers: ["drogon"] },
  vikings: { q: "Çiftçilikten krallığa yükselen efsanevi Viking kim?", answers: ["ragnar", "ragnar lothbrok", "ragnar lodbrok"] },
  prisonBreak: { q: "Michael'ın idamdan kurtarmak için hapse girdiği ağabeyinin adı ne?", answers: ["lincoln", "linc", "lincoln burrows"] },
  sherlock: { q: "Sherlock ile Watson'ın Baker Street'teki kapı numarası ne?", answers: ["221b", "221"] },
  strangerThings: { q: "Dizinin geçtiği Indiana kasabasının adı ne?", answers: ["hawkins"] },
  lastOfUs: { q: "Joel'in ülkeyi boydan boya geçerek koruduğu bağışıklı kızın adı ne?", answers: ["ellie", "ellie williams"] },
  dark: { q: "Mağaranın ve nükleer santralin bulunduğu kasabanın adı ne?", answers: ["winden"] },
  squidGame: { q: "Gi-hun'un oyunlardaki oyuncu numarası kaç?", answers: ["456"] },
  witcher: { q: "Geralt'ın kaderle bağlı olduğu prensesin adı ne?", answers: ["ciri", "cirilla"] },
  fallout: { q: "Lucy'nin büyüdüğü sığınağın (Vault) numarası kaç?", answers: ["33"] },
  moneyHeist: { q: "Hikâyeyi anlatan soyguncu hangi şehrin adını taşıyor?", answers: ["tokyo", "tokio", "toquio"] },
  // anime
  deathNote: { q: "Light'a defteri düşüren, elma seven ölüm meleğinin adı ne?", answers: ["ryuk", "ryuuk", "ryuku"] },
  aot: { q: "İnsanlığı koruyan üç duvardan en dıştakinin adı ne?", answers: ["maria"] },
  naruto: { q: "Naruto'nun büyüdüğü gizli köyün adı ne?", answers: ["konoha", "konohagakure", "yaprak", "leaf", "hoja", "foglia", "blatt", "folha"] },
  onePiece: { q: "Luffy'nin ekibine ilk katılan, üç kılıçla dövüşen yoldaşı kim?", answers: ["zoro", "zorro", "roronoa zoro"] },
  fma: { q: "Ruhu bir zırha bağlanan, Edward'ın küçük kardeşi kim?", answers: ["alphonse", "al", "alphonse elric", "alfons"] },
  rickAndMorty: { q: "Rick'in kızının, Morty'nin annesinin adı ne?", answers: ["beth", "beth smith"] },
  demonSlayer: { q: "Tanjiro'nun iblise dönüşen, ağzında bambu taşıyan kız kardeşi kim?", answers: ["nezuko"] },
  ghibli: { q: "Bu dünyaları çizen stüdyonun en ünlü kurucu yönetmeni kim?", answers: ["miyazaki", "hayao miyazaki"] },
  hunterXHunter: { q: "Gon'un suikastçı bir aileden gelen en yakın arkadaşı kim?", answers: ["killua", "kilua", "killua zoldyck"] },
  jujutsuKaisen: { q: "Yuji'nin içinde yaşayan \"Lanetlerin Kralı\"nın adı ne?", answers: ["sukuna", "ryomen sukuna"] },
  arcane: { q: "Ablası Vi'nin Jinx'e hâlâ seslendiği çocukluk adı ne?", answers: ["powder", "polvorita", "polvo", "polvora", "toz"] },
});

/** Evrenin kapı sorusu (çevrilmiş), yoksa null. */
export function riddleQuestion(id) {
  const r = UNIVERSE_RIDDLES[id];
  return r ? i18nText(`autoI18n.evren_soru_${id}`, r.q) : null;
}

const FOLD = { ı: "i", İ: "i", I: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ç: "c", Ç: "c", ö: "o", Ö: "o", ü: "u", Ü: "u", ß: "ss" };

/** Karşılaştırma biçimi: küçük harf, aksansız, yalnız harf/rakam + tek boşluk; baştaki "the" atılır. */
export function normalizeAnswer(text) {
  const s = String(text || "")
    .replace(/[ıİIşŞğĞçÇöÖüÜß]/g, (ch) => FOLD[ch])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return s.replace(/^the /, "");
}

function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

const tolerance = (ans) => (/^[0-9]+[a-z]?$/.test(ans) ? 0 : ans.length >= 9 ? 2 : ans.length >= 5 ? 1 : 0);

const isNumeric = (ans) => /^[0-9]+[a-z]?$/.test(ans);

const close = (word, ans) => {
  if (word === ans || word.replace(/ /g, "") === ans.replace(/ /g, "")) return true;
  // Türkçe ek bitişik yazılmışsa ("Hawkinste", "Pandoraya", "Konohada"): en çok 3 harflik ek hoş görülür.
  if (!isNumeric(ans) && ans.length >= 4 && word.startsWith(ans) && word.length - ans.length <= 3) return true;
  const tol = tolerance(ans);
  return tol > 0 && Math.abs(word.length - ans.length) <= tol && editDistance(word, ans) <= tol;
};

/** Cevap doğru mu? */
export function matchesRiddle(id, text) {
  const r = UNIVERSE_RIDDLES[id];
  const input = normalizeAnswer(text);
  if (!r || !input) return false;
  const words = input.split(" ");
  return r.answers.some((raw) => {
    const ans = normalizeAnswer(raw);
    if (close(input, ans)) return true;
    // Kısa cümle içinde geçiyorsa ("May Teyze", "Vault 33", "Gizli Yaprak Köyü"): en çok 3 kelime,
    // cevabın kelimeleri sırayla bitişik geçmeli.
    if (words.length > 3) return false;
    const n = ans.split(" ").length;
    for (let i = 0; i + n <= words.length; i += 1) {
      if (close(words.slice(i, i + n).join(" "), ans)) return true;
    }
    return false;
  });
}

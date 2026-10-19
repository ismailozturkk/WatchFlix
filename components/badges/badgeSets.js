// components/badges/badgeSets.js
//
// KOLEKSİYONLAR — rozetlerin ÜSTÜNDEKİ kademe.
//
// Aile içi kademe ekseni doldu: `kademeSekli` beş şekil + beş renk taşıyor ve
// katalogun kendi testi 7-gen ile 8-gen'in çıplak gözle ayrılamadığını ölçüyor.
// Yani "daha yüksek kademe" görsel olarak yeni bir şey söylemiyor. Yeni kademe
// ailenin İÇİNE değil ÜSTÜNE kuruldu: bir koleksiyon, tek bir sayacı büyüterek
// değil BAŞKA ROZETLERİ toplayarak açılır.
//
// İKİ FAYDASI VAR:
//   • Var olan rozetlerin hepsini daha değerli yapar — tek başına "önemsiz"
//     görünen bir mevsimsel rozet artık bir setin eksik parçasıdır.
//   • Yeni ölçüt, yeni sayaç, yeni Firestore alanı GEREKTİRMEZ. Girdi zaten
//     hesaplanmış rozet listesidir; maliyeti bir dizi taraması kadardır.
//
// KATALOGDAN AYRI DURUR: `WATCH_BADGES` içine konsaydı `getProgress(stats)`
// sözleşmesini bozardı (koleksiyonun girdisi stats değil, rozetlerin kendisi)
// ve katalog testlerindeki sayımlar anlamını yitirirdi.
//
// NADİRLİK: legendary YOK. Panteon üç legendary rozeti birden istediği hâlde
// epic'te bırakıldı — kota (3) katalogun enflasyona karşı tek sigortası ve
// koleksiyonlar o sigortayı dolaylı yoldan delmemeli.

import { RARITY } from "@theme/badgeTokens";
import { BOLUM, WATCH_BADGES, WATCH_BADGE_BY_ID } from "./watchBadgeCatalog";

const idler = (fn) => WATCH_BADGES.filter(fn).map((b) => b.id);

// Dört klasik tür uzmanlığı. `set_uzman` bunlara AYRI kaldı: v2'de tür bölümüne
// on iki uzmanlık daha eklendi, "bölümdeki tüm tekil tür rozetleri" tanımı
// otomatik olarak 16'ya çıkıp "dört tür uzmanlığı" cümlesini yalana çevirirdi.
// Yeni on iki rozet `set_tur_hakimi`de (hepsi birlikte).
const KLASIK_TUR_UZMANLIKLARI = ["korku_25", "animasyon_40", "belgesel_20", "komedi_75"];

// Her ailenin BELİRLİ kademesi. 3 kademeli ailelerde 4. kademe yoktur; bu
// yüzden "kademe >= n" değil "o ailenin n. kademesi VARSA" mantığı kullanılır.
const kademeIdleri = (tier) => idler((b) => b.family && b.tier === tier);

// Her ailenin ZİRVESİ (aile uzunluğu 3–5 arasında değiştiği için sabit tier ile
// bulunamaz).
const zirveIdleri = () => {
  const enYuksek = new Map();
  for (const b of WATCH_BADGES) {
    if (!b.family) continue;
    const m = enYuksek.get(b.family);
    if (!m || b.tier > m.tier) enYuksek.set(b.family, b);
  }
  return [...enYuksek.values()].map((b) => b.id);
};

/**
 * Koleksiyonlar. `uyeler` ÇALIŞMA ANINDA hesaplanır (fonksiyon), sabit dizi
 * değil: katalog büyüdüğünde set kendiliğinden güncellenir, elle liste bakımı
 * gerekmez — ve bir rozet katalogdan çıkarsa sette hayalet id kalmaz.
 */
export const BADGE_SETS = [
  {
    id: "set_ilk_adim",
    icon: "footsteps-outline", iconSolid: "footsteps", rarity: RARITY.uncommon,
    tr: "Merdivenin Başı", en: "First Rungs", es: "Primeros peldaños", pt: "Primeiros degraus",
    descTr: "Her ailenin ilk kademesini aç", descEn: "Unlock the first tier of every family", descEs: "Desbloquea el primer nivel de cada familia", descPt: "Desbloqueie o primeiro nível de cada família",
    uyeler: () => kademeIdleri(1),
  },
  {
    id: "set_mevsim",
    icon: "snow-outline", iconSolid: "snow", rarity: RARITY.rare,
    tr: "Mevsim Kolyesi", en: "Season Necklace", es: "Collar de temporadas", pt: "Colar de temporadas",
    descTr: "Tüm mevsimsel rozetleri topla", descEn: "Collect every seasonal badge", descEs: "Reúne todas las insignias de temporada", descPt: "Reúna todos os emblemas de temporada",
    uyeler: () => idler((b) => b.section === BOLUM.MEVSIM),
  },
  {
    id: "set_uzman",
    icon: "ribbon-outline", iconSolid: "ribbon", rarity: RARITY.rare,
    tr: "Tür Uzmanı", en: "Genre Specialist", es: "Especialista en géneros", pt: "Especialista em gêneros",
    descTr: "Dört tür uzmanlık rozetini de kazan", descEn: "Earn all four genre specialist badges", descEs: "Consigue las cuatro insignias de especialista en géneros", descPt: "Conquiste os quatro emblemas de especialista em gêneros",
    // Tür ailesinin kademeleri DEĞİL, tek tek tür rozetleri (korku/animasyon/
    // belgesel/komedi): çeşitlilik değil DERİNLİK ölçen set budur.
    uyeler: () => idler((b) => KLASIK_TUR_UZMANLIKLARI.includes(b.id)),
  },
  {
    id: "set_tur_hakimi",
    icon: "color-palette-outline", iconSolid: "color-palette", rarity: RARITY.epic,
    tr: "Tür Hâkimi", en: "Genre Master", es: "Maestro de géneros", pt: "Mestre dos gêneros",
    descTr: "Tüm tür uzmanlık rozetlerini kazan", descEn: "Earn every genre specialist badge", descEs: "Consigue todas las insignias de especialista en géneros", descPt: "Conquiste todos os emblemas de especialista em gêneros",
    // Bölümdeki HER tekil tür rozeti (klasik dört + v2'nin on ikisi). Tanım
    // çalışma anında çözülür: yeni bir tür uzmanlığı eklendiğinde set kendiliğinden büyür.
    uyeler: () => idler((b) => b.section === BOLUM.TUR && !b.family),
  },
  {
    id: "set_baslangic",
    icon: "thumbs-up-outline", iconSolid: "thumbs-up", rarity: RARITY.uncommon,
    tr: "Sağlam Başlangıç", en: "Strong Start", es: "Buen comienzo", pt: "Bom começo",
    descTr: "Başlangıç bölümündeki tüm rozetleri kazan", descEn: "Earn every Getting Started badge", descEs: "Consigue todas las insignias de Primeros pasos", descPt: "Conquiste todos os emblemas de Primeiros passos",
    // Yeni kullanıcının ilk günlerinde tamamlayabileceği tek koleksiyon: yedi küçük
    // rozet, hepsi birkaç işaretlemeye sığar.
    uyeler: () => idler((b) => b.section === BOLUM.BASLANGIC),
  },
  {
    id: "set_baglilik",
    icon: "ribbon-outline", iconSolid: "ribbon", rarity: RARITY.rare,
    tr: "Vefalı Seyirci", en: "Faithful Viewer", es: "Espectador leal", pt: "Espectador fiel",
    descTr: "Bağlılık bölümündeki tüm rozetleri kazan", descEn: "Earn every Devotion badge", descEs: "Consigue todas las insignias de Fidelidad", descPt: "Conquiste todos os emblemas de Dedicação",
    uyeler: () => idler((b) => b.section === BOLUM.BAGLILIK),
  },
  {
    id: "set_kesif",
    icon: "compass-outline", iconSolid: "compass", rarity: RARITY.uncommon,
    tr: "Kâşif", en: "Explorer", es: "Explorador", pt: "Explorador",
    descTr: "Keşif bölümündeki tüm rozetleri kazan", descEn: "Earn every Discover badge", descEs: "Consigue todas las insignias de Descubre", descPt: "Conquiste todos os emblemas de Descobrir",
    // Uygulamanın izleme dışı yüzünü gezmiş olmanın bitiş çizgisi. Üç üye (arkadaş,
    // ortak liste, gönderi) başka birinin ya da topluluğun varlığını ister — yine de
    // uncommon: hiçbiri tarihe/kullanıcı girdisine bağlı sahtelenebilir bir sayı değil
    // ve koleksiyonlar legendary'ye dokunmaz.
    uyeler: () => idler((b) => b.section === BOLUM.KESIF),
  },
  {
    id: "set_yari_yol",
    icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.rare,
    tr: "Yarı Yol", en: "Halfway", es: "A medio camino", pt: "Na metade do caminho",
    descTr: "Her ailenin 3. kademesine ulaş", descEn: "Reach the 3rd tier of every family", descEs: "Llega al tercer nivel de cada familia", descPt: "Chegue ao terceiro nível de cada família",
    uyeler: () => kademeIdleri(3),
  },
  {
    id: "set_sir",
    icon: "eye-outline", iconSolid: "eye", rarity: RARITY.epic,
    tr: "Sır Toplayıcı", en: "Secret Keeper", es: "Guardián de secretos", pt: "Guardião de segredos",
    descTr: "Tüm gizli rozetleri ortaya çıkar", descEn: "Uncover every hidden badge", descEs: "Descubre todas las insignias ocultas", descPt: "Descubra todos os emblemas ocultos",
    uyeler: () => idler((b) => b.hidden),
  },
  {
    id: "set_panteon",
    icon: "trophy-outline", iconSolid: "trophy", rarity: RARITY.epic,
    tr: "Panteon", en: "Pantheon", es: "Panteón", pt: "Panteão",
    descTr: "Her ailenin zirvesine ulaş", descEn: "Reach the peak of every family", descEs: "Llega a la cima de cada familia", descPt: "Chegue ao topo de cada família",
    uyeler: zirveIdleri,
  },
  // ── ROZET SAYISI MERDİVENİ ─────────────────────────────────────────────────
  // "Toplam N rozet aç." Diğer koleksiyonlar BELİRLİ rozetleri ister; bunlar
  // herhangi N tanesini. İki işi var:
  //   • Her rozet, hangisi olursa olsun, bir sonraki eşiğe yaklaştırır. Yani
  //     kullanıcı hangi türde, hangi bölümde ilerlerse ilerlesin "Rozet
  //     Koleksiyoncusu 48/50" gibi yakın bir ödül hep ufukta olur — kataloğun
  //     büyük kısmı kilitliyken bile umut kaybolmaz.
  //   • Katalog büyüdükçe merdiven kendiliğinden anlam kazanır; eşikler sabit,
  //     üyeler değil (üye listesi 140+ id olurdu ve sayfada hiçbir şey anlatmazdı).
  //
  // Sayım KATALOG rozetleridir (koleksiyon/mühür/prestij değil): ekrandaki "x/154"
  // sayacıyla birebir aynı sayı. `esik` verilen set, üye listesini göstermez.
  {
    id: "set_sayi_10", esik: 10,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.uncommon,
    tr: "İlk On", en: "First Ten", es: "Los diez primeros", pt: "Os dez primeiros",
    descTr: "Toplam 10 rozet kazan", descEn: "Earn 10 badges in total", descEs: "Consigue 10 insignias en total", descPt: "Conquiste 10 emblemas no total",
    uyeler: () => idler(() => true),
  },
  {
    id: "set_sayi_25", esik: 25,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.uncommon,
    tr: "Rozet Meraklısı", en: "Badge Enthusiast", es: "Aficionado a las insignias", pt: "Aficionado por emblemas",
    descTr: "Toplam 25 rozet kazan", descEn: "Earn 25 badges in total", descEs: "Consigue 25 insignias en total", descPt: "Conquiste 25 emblemas no total",
    uyeler: () => idler(() => true),
  },
  {
    id: "set_sayi_50", esik: 50,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.rare,
    tr: "Rozet Koleksiyoncusu", en: "Badge Collector", es: "Coleccionista de insignias", pt: "Colecionador de emblemas",
    descTr: "Toplam 50 rozet kazan", descEn: "Earn 50 badges in total", descEs: "Consigue 50 insignias en total", descPt: "Conquiste 50 emblemas no total",
    uyeler: () => idler(() => true),
  },
  {
    id: "set_sayi_75", esik: 75,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.rare,
    tr: "Rozet Ustası", en: "Badge Master", es: "Maestro de insignias", pt: "Mestre dos emblemas",
    descTr: "Toplam 75 rozet kazan", descEn: "Earn 75 badges in total", descEs: "Consigue 75 insignias en total", descPt: "Conquiste 75 emblemas no total",
    uyeler: () => idler(() => true),
  },
  {
    id: "set_sayi_100", esik: 100,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.epic,
    tr: "Yüzlük Vitrin", en: "Century Showcase", es: "Vitrina de cien", pt: "Vitrine de cem",
    descTr: "Toplam 100 rozet kazan", descEn: "Earn 100 badges in total", descEs: "Consigue 100 insignias en total", descPt: "Conquiste 100 emblemas no total",
    uyeler: () => idler(() => true),
  },
  {
    id: "set_sayi_125", esik: 125,
    icon: "podium-outline", iconSolid: "podium", rarity: RARITY.epic,
    tr: "Neredeyse Hepsi", en: "Almost Everything", es: "Casi todas", pt: "Quase todos",
    descTr: "Toplam 125 rozet kazan", descEn: "Earn 125 badges in total", descEs: "Consigue 125 insignias en total", descPt: "Conquiste 125 emblemas no total",
    uyeler: () => idler(() => true),
  },
];

export const BADGE_SET_IDS = Object.freeze(BADGE_SETS.map((s) => s.id));

/**
 * Defterin `known` listesine yazılacak koleksiyon id'leri: hepsi, AMA üyelerinden
 * birinin KAYNAĞI henüz yüklenmemişse (ve o üye defterde kazanılmış da değilse) o
 * koleksiyon hariç. `bilinenRozetIdleri` (watchBadgeCatalog) ile aynı gerekçe —
 * üyeler henüz "hak edilmedi" görünürken koleksiyon `known`a girerse, kaynaklar
 * yüklenince eski kullanıcıya koleksiyon kutlaması yağar.
 *
 * Defterde ZATEN kazanılmış üye kaynağın hazır olmasına bağlı değildir: kaynak
 * yüklenmemişken son eksik rozet gerçekten kazanılırsa koleksiyonun kutlanması gerekir;
 * onu da hariç tutmak gerçek bir başarıyı sessizce yutardı.
 *
 * Eşikli ("herhangi N rozet") koleksiyonlar hariç tutulmaz: yüklenmemiş kaynak onları
 * yalnız GEÇİKTİRİR, ve gerçek bir eşik geçişini sessiz emmek, yanlış bir kutlamadan
 * daha kötü bir hata olurdu.
 *
 * @param {Record<string, boolean>} [kesifHazir] stats.kesifHazir
 * @param {Set<string>|string[]} [kazanilmis]    defterdeki monoton "earned" kümesi
 */
export function bilinenSetIdleri(kesifHazir, kazanilmis) {
  const hazir = kesifHazir || {};
  const defter = kazanilmis instanceof Set ? kazanilmis : new Set(kazanilmis || []);
  return BADGE_SETS
    .filter((s) => (
      s.esik > 0
      || s.uyeler().every((id) => {
        const kaynak = WATCH_BADGE_BY_ID[id]?.kaynak;
        return !kaynak || hazir[kaynak] === true || defter.has(id);
      })
    ))
    .map((s) => s.id);
}

export const BADGE_SET_BY_ID = Object.freeze(
  BADGE_SETS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}),
);

/**
 * Koleksiyonları ROZET ŞEKLİNDE değerlendirir — dönen nesneler WatchBadgeCard'ın
 * beklediği alanların tamamını taşır, böylece ekranda tek satır değişiklik
 * olmadan çizilirler.
 *
 * @param {Array} degerlendirilmis evaluateWatchBadges() çıktısı
 * @param {Set<string>|string[]} kazanilmis defterdeki monoton "earned" kümesi
 */
export function evaluateBadgeSets(degerlendirilmis, kazanilmis) {
  const acikSet = new Set((degerlendirilmis || []).filter((b) => b.acik).map((b) => b.id));
  const defter = kazanilmis instanceof Set ? kazanilmis : new Set(kazanilmis || []);

  return BADGE_SETS.map((s) => {
    const uyeler = s.uyeler();
    const sayilan = uyeler.filter((id) => acikSet.has(id)).length;
    // `esik`li set "herhangi N tanesi" der: hedef eşiğin kendisi, ilerleme de o
    // eşiğe KIRPILIR (kart 130/125 göstermesin). Eşik üye sayısından büyükse
    // (katalog küçüldüyse) ulaşılamaz bir hedef kurmamak için üye sayısına iner.
    const esikli = Number.isFinite(s.esik) && s.esik > 0;
    const target = esikli ? Math.min(s.esik, uyeler.length) : uyeler.length;
    const ilerleme = esikli ? Math.min(sayilan, target) : sayilan;
    // Defter üyeliği burada da kazandırır: koleksiyonu bir kez tamamlayan
    // kullanıcı, sonradan bir kaydını silse bile koleksiyonu kaybetmez.
    const acik = defter.has(s.id) || (target > 0 && ilerleme >= target);
    return {
      ...s,
      section: BOLUM.SET,
      family: null,
      tier: 0,
      hidden: false,
      birim: null,
      // Eşikli sette üye listesi GÖSTERİLMEZ (140+ rozetin tamamı olurdu) ama dizi
      // boş olarak kalır, null değil: detay sayfası `uyeIdleri` varlığına bakıp
      // koleksiyon bloğunu kuruyor, null olsaydı sete "Tek kademeli rozet" yazardı.
      uyeIdleri: esikli ? [] : uyeler,
      esikli,
      ham: ilerleme,
      target,
      ilerleme,
      oran: target > 0 ? Math.min(1, ilerleme / target) : 0,
      acik,
    };
  });
}

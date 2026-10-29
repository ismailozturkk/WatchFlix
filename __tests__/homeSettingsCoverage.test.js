// __tests__/homeSettingsCoverage.test.js
//
// KAPSAM BEKÇİSİ. Yetişkin içerik ayarı Film/Dizi ana ekranında iki yolla
// uygulanıyor (bkz. utils/homeContentSettings.js):
//   • `/discover` tabanlı liste → önbellek anahtarı `adultScoped` ile kapsamlanır
//   • diğer uçlar (trending, now_playing …) → anahtar kapsamsız, `dropAdult` süzer
//
// Yeni bir liste anahtarı eklenip hangi sınıfa girdiği düşünülmezse, ayar o liste
// için sessizce işlemez — bu sistemin kapatmaya çalıştığı hatanın kendisi. Bu test
// bağlamlardaki HER `movie_*` / `tv_*` anahtar ailesini sınıflandırmaya zorlar.

import fs from "fs";
import path from "path";

const kok = path.join(__dirname, "..");
const oku = (...parca) => fs.readFileSync(path.join(kok, ...parca), "utf8");

// `/discover` kullanan, yetişkin izniyle KAPSAMLANMASI gereken aileler.
const KAPSAMLI = [
  "movie_bests_",
  "movie_provider_",
  "movie_genres_content_",
  "movie_upcoming_",
  "tv_bests_",
  "tv_provider_",
  "tv_genres_content_",
  "tv_upcoming_",
];

// Ayardan bağımsız uçlar / liste olmayan kayıtlar: kapsamsız kalmaları bilinçli.
const KAPSAMSIZ = [
  "movie_trends_", // trending: include_adult yok sayılır → dropAdult
  "movie_now_playing_",
  "movie_providers_", // platform KATALOĞU (liste değil)
  "movie_genres_", // tür adları
  "movie_oscar_",
  "movie_collection_",
  "tv_trends_",
  "tv_airing_today_",
  "tv_on_the_air_",
  "tv_providers_",
  "tv_genres_",
  "tv_emmy_",
];

const BAGLAMLAR = [
  ["context", "MovieContex.js"],
  ["context", "TvShowContex.js"],
];

// Şablon dizgesinde `movie_xxx_${…}` ailesinin adı: ilk `${`'a kadar olan kısım.
const aileler = (kaynak) => {
  const bulunan = new Map();
  const desen = /`((?:movie|tv)_[a-z_]+?)\$\{/g;
  let eslesme;
  while ((eslesme = desen.exec(kaynak))) {
    const ad = eslesme[1].endsWith("_") ? eslesme[1] : `${eslesme[1]}_`;
    const bas = Math.max(0, eslesme.index - 14);
    const once = kaynak.slice(bas, eslesme.index);
    bulunan.set(ad, [...(bulunan.get(ad) || []), once]);
  }
  return bulunan;
};

// EN ÖZGÜL ön ek kazanır: `movie_genres_content_` (liste, kapsamlı) ile
// `movie_genres_` (tür adları, kapsamsız) aynı öneki paylaşıyor.
const sinifi = (ad) => {
  const adaylar = [
    ...KAPSAMLI.filter((k) => ad.startsWith(k)).map((k) => ({ k, sinif: "kapsamli" })),
    ...KAPSAMSIZ.filter((k) => ad.startsWith(k)).map((k) => ({ k, sinif: "kapsamsiz" })),
  ].sort((a, b) => b.k.length - a.k.length);
  return adaylar[0]?.sinif ?? null;
};

describe("sınıflandırma", () => {
  test("özgül ön ek genel olana baskın gelir", () => {
    expect(sinifi("movie_genres_content_")).toBe("kapsamli");
    expect(sinifi("movie_genres_")).toBe("kapsamsiz");
    expect(sinifi("tv_provider_")).toBe("kapsamli");
    expect(sinifi("tv_providers_")).toBe("kapsamsiz");
    expect(sinifi("movie_yeni_aile_")).toBeNull();
  });
});

describe.each(BAGLAMLAR)("%s/%s", (...parca) => {
  const kaynak = oku(...parca);
  const bulunan = aileler(kaynak);

  test("her anahtar ailesi sınıflandırılmış (kapsamlı ya da bilinçli kapsamsız)", () => {
    const bilinmeyen = [...bulunan.keys()].filter((ad) => sinifi(ad) === null);
    // Yeni bir `movie_*` / `tv_*` ailesi eklendiyse: `/discover` kullanıyorsa
    // KAPSAMLI'ya (ve adultKey'e), kullanmıyorsa KAPSAMSIZ'a yaz.
    expect(bilinmeyen).toEqual([]);
  });

  test("`/discover` aileleri adultKey(...) içinden geçer", () => {
    for (const [ad, oncekiler] of bulunan) {
      if (sinifi(ad) !== "kapsamli") continue;
      for (const once of oncekiler) {
        expect({ aile: ad, kapsamli: /adultKey\(\s*$/.test(once) }).toEqual({
          aile: ad,
          kapsamli: true,
        });
      }
    }
  });

  test("kapsamsız aileler adultKey'e SARILMAZ (çevrimdışı kopya kaybolmasın)", () => {
    for (const [ad, oncekiler] of bulunan) {
      if (sinifi(ad) !== "kapsamsiz") continue;
      for (const once of oncekiler) {
        expect({ aile: ad, kapsamli: /adultKey\(\s*$/.test(once) }).toEqual({
          aile: ad,
          kapsamli: false,
        });
      }
    }
  });

  test("içerik ayarına bağlı efektler adultContent'i bağımlılık olarak taşır", () => {
    // Her kapsamlı ailenin yüklendiği efekt, ayar değişince yeniden çalışmalı.
    expect(kaynak).toMatch(/useHomeDataSettings\(\)/);
    const efektBagimliliklari = kaynak.match(/\}, \[[^\]]*\]\);/g) || [];
    const adultliEfekt = efektBagimliliklari.filter((b) => b.includes("adultContent"));
    // best/bests, genres, (film: upcoming) + tekil sağlayıcı efekti.
    expect(adultliEfekt.length).toBeGreaterThanOrEqual(3);
  });

  test("platform efekti dizi kimliğine değil providersKey içeriğine bağlı", () => {
    expect(kaynak).toMatch(/activeSections\.providers, language, providersKey\]/);
    expect(kaynak).not.toMatch(/activeSections\.providers, language, streamingProviderIds\]/);
  });
});

describe("keşif rayı (components/DiscoveryMediaRail)", () => {
  const kaynak = oku("components", "DiscoveryMediaRail.js");

  test("önbellek anahtarı yetişkin izniyle kapsamlanır", () => {
    expect(kaynak).toMatch(/adultScoped\(\s*`discovery_v2_/);
  });

  test("yükleme geri çağrısı adultContent'e bağlı (ayar değişince ray yeniden yüklenir)", () => {
    expect(kaynak).toMatch(/\[\s*API_KEY,\s*adultContent,/);
  });

  test("sonuçlar dropAdult'tan geçer", () => {
    expect(kaynak).toMatch(/dropAdult\(data\.results/);
  });
});

describe("çevrimdışı indirme (services/dataDownloader)", () => {
  const kaynak = oku("services", "dataDownloader.js");

  // İndirilen kayıt, ekranların okuduğu ANAHTARA düşmeli; yoksa "Verileri indir"
  // yetişkin izni açık kullanıcıda hiç kullanılmaz ya da yanlış kovaya yazılır.
  test.each(KAPSAMLI.filter((a) => !a.includes("provider_") && !a.includes("upcoming_")))(
    "%s anahtarı adultScoped ile yazılır",
    (aile) => {
      const kullanimlar = [...kaynak.matchAll(new RegExp(`\`${aile}`, "g"))];
      expect(kullanimlar.length).toBeGreaterThan(0);
      for (const k of kullanimlar) {
        const once = kaynak.slice(Math.max(0, k.index - 16), k.index);
        expect({ aile, kapsamli: /adultScoped\(\s*$/.test(once) }).toEqual({
          aile,
          kapsamli: true,
        });
      }
    },
  );
});

describe("çizim ayarları (poster kalitesi, ray boyutu/köşesi, rozetler)", () => {
  test("ortak yatay ray ayar anahtarını FlatList extraData'sına verir", () => {
    const kaynak = oku("components", "PaginatedRail.js");
    expect(kaynak).toMatch(/useHomeRenderKey\(\)/);
    expect(kaynak).toMatch(/extraData=\{renderKey\}/);
  });

  // Bu liste renderItem'ı useCallback ile SABİTLİYOR — extraData olmazsa poster
  // kalitesi değişince hücrelere dokunulmaz.
  test("renderItem'ı memo'lu devam eden diziler rayı da anahtarı alır", () => {
    const kaynak = oku("screens", "tv", "TvOngoingSection.js");
    expect(kaynak).toMatch(/useHomeRenderKey\(\)/);
    expect(kaynak).toMatch(/extraData=\{renderKey\}/);
  });
});

// __tests__/copyTablesSpanish.test.js
//
// Yerel `{ tr, en, es }` metin tablolarının DENGESİ.
//
// NEDEN: bu modüller i18n paketlerine bağlı değil (i18nKeys.test.js onları görmez).
// Bir dile anahtar eklemeyi unutan geliştirici, `copyLanguage` yedeği sayesinde
// ekranın patlamadığını, yalnız o dilde İngilizce metin göründüğünü fark etmez.
// Burada her tablonun üç dili aynı anahtar kümesine, aynı yer tutucu kümesine ve
// (işlevlerde) aynı parametre sayısına sahip olması zorlanır; ES değerleri boş olamaz.
const { BACKUP_COPY } = require("../screens/tabs/settings/backupCopy");
const { STUDIO_COPY } = require("../components/theme/themeStudioCopy");
const { AI_COPY } = require("../utils/aiCopy");
const { ONBOARDING_COPY } = require("../screens/onboarding/onboardingCopy");
const { FAVORITES_COPY } = require("../utils/favoritesCopy");
const { SECTION_VISIBILITY_COPY } = require("../screens/tabs/settings/sectionVisibilityCopy");
const { DISCOVER_FILTERS_COPY } = require("../screens/shared/discoverFiltersCopy");
const { getWrappedStrings } = require("../utils/wrappedStrings");
const { YEARLY_GOAL_COPY } = require("../components/profile/yearlyGoalCopy");
const { FOLLOWED_PEOPLE_COPY } = require("../utils/followedPeopleCopy");
const { PROVIDER_WATCH_COPY } = require("../utils/providerWatchCopy");
const { LIBRARY_EXPORT_COPY } = require("../screens/tabs/settings/libraryExportCopy");
const { TASTE_MATCH_COPY } = require("../utils/tasteMatchCopy");
const { MEDIA_LINK_COPY } = require("../utils/mediaLinkCopy");
const { EXTERNAL_ENTRY_COPY } = require("../utils/externalEntryCopy");
const { WATCH_PICKER_COPY } = require("../utils/watchPickerCopy");
const { LIST_SORT_FILTER_COPY } = require("../utils/listSortFilterCopy");
const { RATING_SUMMARY_COPY } = require("../utils/ratingSummaryCopy");
const { EXTERNAL_RATINGS_COPY } = require("../utils/externalRatingsCopy");

// `{ad}`, `{{ad}}`, `%d` biçimli yer tutucuları çıkarır.
const yerTutucular = (metin) =>
  (String(metin).match(/\{\{?[A-Za-z0-9_]+\}?\}|%[sd]/g) || []).sort().join("|");

// Nesneyi "a.b.c" yaprak listesine indirger; diziler ve işlevler yaprak sayılır.
function yapraklar(nesne, onek = "", toplam = {}) {
  for (const ad of Object.keys(nesne || {})) {
    const deger = nesne[ad];
    const yol = onek ? `${onek}.${ad}` : ad;
    if (deger && typeof deger === "object" && !Array.isArray(deger)) yapraklar(deger, yol, toplam);
    else toplam[yol] = deger;
  }
  return toplam;
}

function karsilastir(tablolar) {
  const { tr, en, es } = Object.fromEntries(
    Object.entries(tablolar).map(([dil, tablo]) => [dil, yapraklar(tablo)]),
  );
  const sorunlar = [];
  for (const [dil, tablo] of [["en", en], ["es", es]]) {
    for (const anahtar of Object.keys(tr)) {
      if (!(anahtar in tablo)) sorunlar.push(`${dil}: eksik ${anahtar}`);
    }
    for (const anahtar of Object.keys(tablo)) {
      if (!(anahtar in tr)) sorunlar.push(`${dil}: fazla ${anahtar}`);
    }
  }
  for (const anahtar of Object.keys(es)) {
    const trDeger = tr[anahtar];
    const esDeger = es[anahtar];
    if (typeof trDeger === "function") {
      if (typeof esDeger !== "function") sorunlar.push(`es: ${anahtar} işlev olmalı`);
      else if (esDeger.length !== trDeger.length) sorunlar.push(`es: ${anahtar} parametre sayısı`);
    } else if (typeof trDeger === "string") {
      if (typeof esDeger !== "string") sorunlar.push(`es: ${anahtar} metin olmalı`);
      else {
        if (!esDeger.trim() && trDeger.trim()) sorunlar.push(`es: ${anahtar} boş`);
        if (yerTutucular(trDeger) !== yerTutucular(esDeger)) sorunlar.push(`es: ${anahtar} yer tutucu`);
      }
    } else if (Array.isArray(trDeger)) {
      if (!Array.isArray(esDeger) || esDeger.length !== trDeger.length) {
        sorunlar.push(`es: ${anahtar} dizi uzunluğu`);
      }
    }
  }
  return sorunlar;
}

const TABLOLAR = {
  "Yedekleme (backupCopy)": () => BACKUP_COPY,
  "Tema Stüdyosu (themeStudioCopy)": () => STUDIO_COPY,
  "Yapay zeka (aiCopy)": () => AI_COPY,
  "Onboarding (onboardingCopy)": () => ONBOARDING_COPY,
  "Favoriler (favoritesCopy)": () => FAVORITES_COPY,
  "Ekran bölümleri (sectionVisibilityCopy)": () => SECTION_VISIBILITY_COPY,
  "Ne izlesem? (discoverFiltersCopy)": () => DISCOVER_FILTERS_COPY,
  "Yıllık izleme hedefi (yearlyGoalCopy)": () => YEARLY_GOAL_COPY,
  "Oyuncu / yönetmen takibi (followedPeopleCopy)": () => FOLLOWED_PEOPLE_COPY,
  "Platformlarımda süzgeci (providerWatchCopy)": () => PROVIDER_WATCH_COPY,
  "Kütüphane dışa aktarma (libraryExportCopy)": () => LIBRARY_EXPORT_COPY,
  "Zevk uyumu (tasteMatchCopy)": () => TASTE_MATCH_COPY,
  "Bağlantıdan aç (mediaLinkCopy)": () => MEDIA_LINK_COPY,
  "Dış giriş: paylaşım + kısayollar (externalEntryCopy)": () => EXTERNAL_ENTRY_COPY,
  "Ne izlesem? (watchPickerCopy)": () => WATCH_PICKER_COPY,
  "Sırala ve filtrele (listSortFilterCopy)": () => LIST_SORT_FILTER_COPY,
  "Puan özeti (ratingSummaryCopy)": () => RATING_SUMMARY_COPY,
  "Harici puanlar (externalRatingsCopy)": () => EXTERNAL_RATINGS_COPY,
  "Wrapped (wrappedStrings)": () => ({
    tr: getWrappedStrings("tr"),
    en: getWrappedStrings("en"),
    es: getWrappedStrings("es"),
  }),
};

describe("yerel metin tablolarında tr / en / es dengesi", () => {
  for (const [ad, al] of Object.entries(TABLOLAR)) {
    it(`${ad}: üç dilde aynı anahtar, yer tutucu ve parametre sayısı`, () => {
      const tablo = al();
      expect(Object.keys(tablo)).toEqual(expect.arrayContaining(["tr", "en", "es"]));
      expect(karsilastir(tablo)).toEqual([]);
    });
  }

  it("tarama gerçekten çalışıyor (boş tablo sessizce yeşile dönmesin)", () => {
    expect(Object.keys(yapraklar(BACKUP_COPY.es)).length).toBeGreaterThan(30);
    expect(Object.keys(yapraklar(STUDIO_COPY.es)).length).toBeGreaterThan(50);
    expect(Object.keys(yapraklar(AI_COPY.es)).length).toBeGreaterThan(100);
  });

  it("karşılaştırıcı gerçek bir eksiği yakalıyor (pozitif kontrol)", () => {
    const sorunlar = karsilastir({
      tr: { a: "x", b: "{n} adet", c: (n) => n },
      en: { a: "x", b: "{n} items", c: (n) => n },
      es: { a: "", b: "elementos", d: "fazla" },
    });
    expect(sorunlar).toEqual(
      expect.arrayContaining(["es: eksik c", "es: fazla d", "es: a boş", "es: b yer tutucu"]),
    );
  });
});

describe("İspanyolca kopya gerçekten İspanyolca", () => {
  it("Wrapped metinleri Türkçe değil", () => {
    const tr = getWrappedStrings("tr");
    const es = getWrappedStrings("es");
    expect(JSON.stringify(es)).not.toBe(JSON.stringify(tr));
    // Türkçeye özgü harfler (ğ ş ı İ) İspanyolca kopyada çıkmamalı.
    const metinler = Object.values(yapraklar(es)).filter((d) => typeof d === "string");
    expect(metinler.filter((m) => /[ğşıİ]/.test(m))).toEqual([]);
  });

  it("bilinmeyen dil İngilizce kopyayı alır, Türkçeyi değil", () => {
    expect(getWrappedStrings("de")).toEqual(getWrappedStrings("en"));
  });
});

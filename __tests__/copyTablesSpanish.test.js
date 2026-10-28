// __tests__/copyTablesSpanish.test.js
//
// Yerel `{ tr, en, es, pt, de }` metin tablolarının DENGESİ.
//
// NEDEN: bu modüller i18n paketlerine bağlı değil (i18nKeys.test.js onları görmez).
// Bir dile anahtar eklemeyi unutan geliştirici, `copyLanguage` yedeği sayesinde
// ekranın patlamadığını, yalnız o dilde İngilizce metin göründüğünü fark etmez.
// Burada her tablonun dilleri aynı anahtar kümesine, aynı yer tutucu kümesine ve
// (işlevlerde) aynı parametre sayısına sahip olması zorlanır; ES/PT değerleri boş olamaz.
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
const { REFERRAL_COPY } = require("../utils/referralCopy");
const { IMPORT_COPY } = require("../components/import/importCopy");
const { BINGO_COPY } = require("../utils/cinemaBingoCopy");
const { DUEL_COPY } = require("../utils/dailyDuelCopy");
const { OLDER_COPY } = require("../utils/olderGameCopy");
const { POLL_COPY } = require("../utils/dailyPollCopy");
const { QUICK_COPY } = require("../utils/quickGamesCopy");
const { DAILY_LIMIT_COPY } = require("../utils/dailyLimitCopy");
const { AUTH_EMAIL_COPY } = require("../utils/authEmailCopy");
const { RESET_ACCOUNT_COPY } = require("../screens/tabs/profile/resetAccountCopy");
const { DELETE_ACCOUNT_COPY } = require("../screens/tabs/profile/deleteAccountCopy");
const { LIST_VISIBILITY_COPY } = require("../screens/tabs/profile/listVisibilityCopy");
const { SEARCH_HEADER_COPY } = require("../components/search/searchHeaderCopy");
const { UPCOMING_FILTERS_COPY } = require("../utils/upcomingFiltersCopy");
const { POSTER_CHOICES_COPY } = require("../utils/posterChoicesCopy");
const { BADGE_SHOWCASE_COPY } = require("../utils/badgeShowcaseCopy");

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

// tr dışındaki her dil (en, es, pt …) tr ile karşılaştırılır. Yeni dil: buraya ekle.
const KARSILASTIRILAN = ["en", "es", "pt", "de"];

function karsilastir(tablolar) {
  const yap = Object.fromEntries(
    Object.entries(tablolar).map(([dil, tablo]) => [dil, yapraklar(tablo)]),
  );
  const tr = yap.tr;
  const sorunlar = [];
  for (const dil of KARSILASTIRILAN) {
    const tablo = yap[dil];
    if (!tablo) continue;
    for (const anahtar of Object.keys(tr)) {
      if (!(anahtar in tablo)) sorunlar.push(`${dil}: eksik ${anahtar}`);
    }
    for (const anahtar of Object.keys(tablo)) {
      if (!(anahtar in tr)) sorunlar.push(`${dil}: fazla ${anahtar}`);
    }
  }
  // En dışındaki yabancı dillerde değer kontrolü (en eski davranışı korur: yalnız anahtar kümesi).
  for (const dil of ["es", "pt", "de"]) {
    const tablo = yap[dil];
    if (!tablo) continue;
    for (const anahtar of Object.keys(tablo)) {
      const trDeger = tr[anahtar];
      const deger = tablo[anahtar];
      if (typeof trDeger === "function") {
        if (typeof deger !== "function") sorunlar.push(`${dil}: ${anahtar} işlev olmalı`);
        else if (deger.length !== trDeger.length) sorunlar.push(`${dil}: ${anahtar} parametre sayısı`);
      } else if (typeof trDeger === "string") {
        if (typeof deger !== "string") sorunlar.push(`${dil}: ${anahtar} metin olmalı`);
        else {
          if (!deger.trim() && trDeger.trim()) sorunlar.push(`${dil}: ${anahtar} boş`);
          if (yerTutucular(trDeger) !== yerTutucular(deger)) sorunlar.push(`${dil}: ${anahtar} yer tutucu`);
        }
      } else if (Array.isArray(trDeger)) {
        if (!Array.isArray(deger) || deger.length !== trDeger.length) {
          sorunlar.push(`${dil}: ${anahtar} dizi uzunluğu`);
        }
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
  "Arkadaş daveti (referralCopy)": () => REFERRAL_COPY,
  "Letterboxd / IMDb içe aktarma (importCopy)": () => IMPORT_COPY,
  "Sinema Bingosu (cinemaBingoCopy)": () => BINGO_COPY,
  "Günlük düello (dailyDuelCopy)": () => DUEL_COPY,
  "Önce hangisi? (olderGameCopy)": () => OLDER_COPY,
  "Günün sorusu (dailyPollCopy)": () => POLL_COPY,
  "Hızlı oyunlar (quickGamesCopy)": () => QUICK_COPY,
  "Günlük izleme sınırı (dailyLimitCopy)": () => DAILY_LIMIT_COPY,
  "E-posta doğrulama / sıfırlama (authEmailCopy)": () => AUTH_EMAIL_COPY,
  "Hesabı sıfırla (resetAccountCopy)": () => RESET_ACCOUNT_COPY,
  "Hesabı sil (deleteAccountCopy)": () => DELETE_ACCOUNT_COPY,
  "Profilinde görünen listeler (listVisibilityCopy)": () => LIST_VISIBILITY_COPY,
  "Arama ekranı başlığı (searchHeaderCopy)": () => SEARCH_HEADER_COPY,
  "Yaklaşan Filmler süzgeci (upcomingFiltersCopy)": () => UPCOMING_FILTERS_COPY,
  "Özel afişler (posterChoicesCopy)": () => POSTER_CHOICES_COPY,
  "Rozet vitrini ve arama (badgeShowcaseCopy)": () => BADGE_SHOWCASE_COPY,
  "Wrapped (wrappedStrings)": () => ({
    tr: getWrappedStrings("tr"),
    en: getWrappedStrings("en"),
    es: getWrappedStrings("es"),
    pt: getWrappedStrings("pt"),
    de: getWrappedStrings("de"),
  }),
};

describe("yerel metin tablolarında tr / en / es / pt / de dengesi", () => {
  for (const [ad, al] of Object.entries(TABLOLAR)) {
    it(`${ad}: beş dilde aynı anahtar, yer tutucu ve parametre sayısı`, () => {
      const tablo = al();
      expect(Object.keys(tablo)).toEqual(expect.arrayContaining(["tr", "en", "es", "pt", "de"]));
      expect(karsilastir(tablo)).toEqual([]);
    });
  }

  it("tarama gerçekten çalışıyor (boş tablo sessizce yeşile dönmesin)", () => {
    expect(Object.keys(yapraklar(BACKUP_COPY.es)).length).toBeGreaterThan(30);
    expect(Object.keys(yapraklar(STUDIO_COPY.es)).length).toBeGreaterThan(50);
    expect(Object.keys(yapraklar(AI_COPY.es)).length).toBeGreaterThan(100);
    expect(Object.keys(yapraklar(AI_COPY.pt)).length).toBeGreaterThan(100);
    expect(Object.keys(yapraklar(AI_COPY.de)).length).toBeGreaterThan(100);
  });

  it("karşılaştırıcı gerçek bir eksiği yakalıyor (pozitif kontrol)", () => {
    const sorunlar = karsilastir({
      tr: { a: "x", b: "{n} adet", c: (n) => n },
      en: { a: "x", b: "{n} items", c: (n) => n },
      es: { a: "", b: "elementos", d: "fazla" },
      pt: { a: "x", b: "{n} itens", c: "metin" },
    });
    expect(sorunlar).toEqual(
      expect.arrayContaining(["es: eksik c", "es: fazla d", "es: a boş", "es: b yer tutucu", "pt: c işlev olmalı"]),
    );
  });
});

describe.each(["pt", "de"])("%s kopyası gerçekten o dilde (Türkçe/İspanyolca sızıntısı yok)", (dilKodu) => {
  it("hiçbir tabloda Türkçeye özgü harf (ğ ş ı İ) ya da İspanyolca işareti (ñ ¿ ¡) yok", () => {
    const sorunlu = [];
    for (const [ad, al] of Object.entries(TABLOLAR)) {
      const pt = al()[dilKodu];
      if (!pt) continue;
      for (const [yol, deger] of Object.entries(yapraklar(pt))) {
        const metinler = Array.isArray(deger) ? deger : [deger];
        for (const m of metinler) {
          if (typeof m !== "string") continue;
          // Dil adları ("Türkçe") ve kişi adı ("İsmail Öztürk") yabancı harf taşıyabilir.
          const temiz = m.replace(/Türkçe|İsmail Öztürk/g, "");
          if (/[ğşıİñ¿¡]/.test(temiz)) sorunlu.push(`${ad}: ${yol}`);
        }
      }
    }
    expect(sorunlu).toEqual([]);
  });

  it("Wrapped metinleri ne Türkçe ne İspanyolca", () => {
    expect(JSON.stringify(getWrappedStrings(dilKodu))).not.toBe(JSON.stringify(getWrappedStrings("tr")));
    expect(JSON.stringify(getWrappedStrings(dilKodu))).not.toBe(JSON.stringify(getWrappedStrings("es")));
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
    expect(getWrappedStrings("fr")).toEqual(getWrappedStrings("en"));
  });
});

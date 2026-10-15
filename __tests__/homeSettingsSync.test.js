// __tests__/homeSettingsSync.test.js
//
// Ayarlar (yetişkin içerik, platform üyelikleri) değişince Film / Dizi ana ekran
// bağlamlarının GERÇEKTEN yeniden çekip çekmediği. Gerçek MovieProvider ve
// TvShowProvider çalışır; yalnız ağ (axios) ve ayar bağlamları taklit edilir.
//
// ESKİ DAVRANIŞ (bu testlerin yakaladığı hata): listeler apiCache'e süzülmüş
// hâlde, ayardan habersiz anahtarlarla yazılıyor ve kayıt "taze" ise ağa
// gidilmiyordu. Ayarı açıp kapatmak rayları değiştirmiyordu; kapatınca
// yetişkin kayıtlar rayda kalıyordu.

import React from "react";
import { act, create } from "react-test-renderer";
import { clearCachedByPrefix, rawCachedEntry } from "../utils/apiCache";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Taklitler ────────────────────────────────────────────────────────────────

const mockSettings = { adult: false, providers: [], quality: "good" };
const mockCalls = [];

jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "test-key" }),
  useStreamingProviderSettings: () => ({ streamingProviderIds: mockSettings.providers }),
  useContentSettings: () => ({ adultContent: mockSettings.adult }),
  useImageQualitySettings: () => ({ imageQualityLevel: mockSettings.quality }),
  useListLayoutSettings: () => ({
    railPosterSize: "normal",
    railPosterRadius: 15,
    posterBadges: {},
  }),
}));

jest.mock("../context/LanguageContext", () => {
  // `t.movieScreens.movieUpcaming.label` gibi derin okumalar patlamasın.
  const deep = new Proxy(() => "x", {
    get: (_hedef, anahtar) => (anahtar === Symbol.toPrimitive ? () => "x" : deep),
  });
  return { useLanguage: () => ({ language: "tr", t: deep }) };
});

jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ watchedTvMap: {}, watchedTvLoaded: true }),
}));

jest.mock("../utils/i18nText", () => ({ i18nText: (_anahtar, varsayilan) => varsayilan }));

jest.mock("../services/oscarService", () => ({
  getOscarConfig: jest.fn(async () => ({ items: [] })),
  fetchOscarByCategory: jest.fn(async () => ({ items: [], hasMore: false, nextPage: 0 })),
  fetchOscarByYear: jest.fn(async () => []),
  OSCAR_CATEGORIES: [],
  DEFAULT_OSCAR_CATEGORY: "best_picture",
}));

jest.mock("../services/emmyService", () => ({
  getEmmyConfig: jest.fn(async () => ({ items: [] })),
  fetchEmmyByCategory: jest.fn(async () => ({ items: [], hasMore: false, nextPage: 0 })),
  fetchEmmyByYear: jest.fn(async () => []),
  EMMY_CATEGORIES: [],
  DEFAULT_EMMY_CATEGORY: "drama_series",
}));

// TMDB taklidi. Gerçek TMDB gibi: `include_adult` yalnız /discover'da dikkate
// alınır (yetişkin kayıt yalnız ayar AÇIKKEN gelir); trending ayarı yok sayar
// ama buradaki taklit de yalnız ayar açıkken yetişkin kayıt döndürüyor —
// önbelleğe izin AÇIKKEN girmiş bir kaydın sonradan kapanınca süzülmesini sınar.
const mockRespond = (url, params) => {
  const tam = String(url);
  mockCalls.push({ url: tam, params: params || {} });
  const medya = tam.includes("/tv") ? "tv" : "movie";
  const temel = medya === "tv" ? 2000 : 1000;
  const normal = (n) => ({ id: temel + n, poster_path: `/p${n}.jpg`, adult: false });
  const yetiskin = { id: temel + 99, poster_path: "/adult.jpg", adult: true };
  const liste = (...ogeler) => ({
    data: { results: ogeler, total_pages: 3 },
  });

  if (tam.includes("/watch/providers/")) {
    return Promise.resolve({
      data: {
        results: [
          { provider_id: 8, provider_name: "Netflix", logo_path: "/n.png" },
          { provider_id: 337, provider_name: "Disney+", logo_path: "/d.png" },
          { provider_id: 9, provider_name: "Prime", logo_path: "/p.png" },
        ],
      },
    });
  }
  if (tam.includes("/genre/")) return Promise.resolve({ data: { genres: [] } });
  if (tam.includes("/trending/")) {
    return Promise.resolve(
      mockSettings.adult ? liste(normal(1), yetiskin) : liste(normal(1)),
    );
  }
  if (tam.includes("/discover/")) {
    // Sağlayıcıya göre ayırt edilebilsin diye kimliği sağlayıcıdan türet.
    const saglayici = /with_watch_providers=(\d+)/.exec(tam)?.[1] ?? params?.with_watch_providers ?? 0;
    const taban = Number(saglayici) || 0;
    const ogeler = [{ ...normal(2), id: temel + 10 + taban }];
    return Promise.resolve(
      mockSettings.adult ? liste(...ogeler, yetiskin) : liste(...ogeler),
    );
  }
  return Promise.resolve(liste(normal(3)));
};

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    request: (config) => mockRespond(config.url, config.params),
    get: (url, config) => mockRespond(url, config?.params),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

// ── Düzenek ──────────────────────────────────────────────────────────────────

const VAKIT = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const KURULUMLAR = [
  {
    ad: "MovieProvider (Film)",
    yukle: () => require("../context/MovieContex"),
    saglayici: "MovieProvider",
    kanca: "useMovie",
    etkinlestir: "activateMovieSection",
    bolumler: ["bests", "trends", "providers", "genres"],
    alanlar: {
      best: "movieBests",
      trend: "movieTrends",
      saglayiciListesi: "moviesProvider",
      genres: "moviesGenres",
      secili: "selectedProvider",
    },
    kesif: "/discover/movie",
    bestAnahtarOn: "movie_bests_tr-TR_vote_count.desc_page_1",
    bestKategoriAnahtari: "movie_bests_tr-TR_vote_count.desc_page_1",
    temel: 1000,
  },
  {
    ad: "TvShowProvider (Dizi)",
    yukle: () => require("../context/TvShowContex"),
    saglayici: "TvShowProvider",
    kanca: "useTvShow",
    etkinlestir: "activateTvSection",
    bolumler: ["best", "trends", "providers", "genres"],
    alanlar: {
      best: "seriesBest",
      trend: "seriesTrend",
      saglayiciListesi: "moviesProviders",
      genres: "moviesGenres",
      secili: "selectedProvider",
    },
    kesif: "/discover/tv",
    bestAnahtarOn: "tv_bests_tr-TR_discover_vote_count_page_1",
    bestKategoriAnahtari: "tv_bests_tr-TR_discover_vote_count_page_1",
    temel: 2000,
  },
];

describe.each(KURULUMLAR)("$ad — ayar değişince ana ekran listeleri", (kurulum) => {
  let kok;
  let son; // bağlamın SON değeri
  let tik = 0;

  function Tuketici() {
    const modul = kurulum.yukle();
    const deger = modul[kurulum.kanca]();
    son = deger;
    const etkinlestir = deger[kurulum.etkinlestir];
    React.useEffect(() => {
      kurulum.bolumler.forEach((b) => etkinlestir(b));
    }, [etkinlestir]);
    return null;
  }

  function Uygulama() {
    const Saglayici = kurulum.yukle()[kurulum.saglayici];
    return (
      <Saglayici>
        <Tuketici />
      </Saglayici>
    );
  }

  const yenidenCiz = async () => {
    tik += 1;
    await act(async () => { kok.update(<Uygulama key="sabit" data-tik={tik} />); });
    await VAKIT();
    await VAKIT();
  };

  const kesifIstekleri = () =>
    mockCalls.filter((c) => c.url.includes(kurulum.kesif) && !c.url.includes("with_watch_providers"));
  const idler = (liste) => (liste || []).map((o) => o.id);

  beforeEach(async () => {
    clearCachedByPrefix("");
    mockCalls.length = 0;
    mockSettings.adult = false;
    mockSettings.providers = [];
    tik = 0;
    await act(async () => { kok = create(<Uygulama key="sabit" />); });
    await VAKIT();
    await VAKIT();
  });

  afterEach(async () => {
    await act(async () => { kok.unmount(); });
  });

  test("başlangıç: yetişkin kapalı, listelerde yetişkin kayıt yok", () => {
    expect(son[kurulum.alanlar.best].length).toBeGreaterThan(0);
    expect(idler(son[kurulum.alanlar.best])).not.toContain(kurulum.temel + 99);
    expect(idler(son[kurulum.alanlar.trend])).not.toContain(kurulum.temel + 99);
  });

  test("yetişkin içerik AÇILINCA /discover listesi yeniden çekilir ve kayıt görünür", async () => {
    const once = kesifIstekleri().length;

    mockSettings.adult = true;
    await yenidenCiz();

    // ESKİ HATA: burada ağ isteği ATILMIYORDU (taze önbellek) ve liste aynı kalıyordu.
    expect(kesifIstekleri().length).toBeGreaterThan(once);
    expect(idler(son[kurulum.alanlar.best])).toContain(kurulum.temel + 99);
  });

  test("izinli sonuç AYRI bir önbellek kovasına yazılır, izinsiz kova temiz kalır", async () => {
    mockSettings.adult = true;
    await yenidenCiz();

    const izinli = rawCachedEntry(`${kurulum.bestAnahtarOn}~a`);
    const izinsiz = rawCachedEntry(kurulum.bestAnahtarOn);
    expect(izinli).not.toBeNull();
    expect(idler(izinli.data.results)).toContain(kurulum.temel + 99);
    // İzinsiz kova yetişkin kayıt İÇERMEZ — ayarı kapatınca geri dönülen yer.
    expect(izinsiz).not.toBeNull();
    expect(idler(izinsiz.data.results)).not.toContain(kurulum.temel + 99);
  });

  test("yetişkin içerik KAPATILINCA /discover listesindeki yetişkin kayıtlar kalkar", async () => {
    mockSettings.adult = true;
    await yenidenCiz();
    expect(idler(son[kurulum.alanlar.best])).toContain(kurulum.temel + 99);

    mockSettings.adult = false;
    await yenidenCiz();

    expect(idler(son[kurulum.alanlar.best])).not.toContain(kurulum.temel + 99);
  });

  // trending ayarı yok sayan uç: önbellek kapsamı YOK, yani izin AÇIKKEN alınmış
  // liste (yetişkin kayıtlı) ekranda duruyor. Ayar kapanınca ağa gitmeden
  // `dropAdult` ile süzülmeli.
  test("izin AÇIKKEN yüklenmiş trending listesi, ayar kapanınca anında süzülür", async () => {
    await act(async () => { kok.unmount(); });
    clearCachedByPrefix("");
    mockCalls.length = 0;
    mockSettings.adult = true;
    await act(async () => { kok = create(<Uygulama key="sabit" />); });
    await VAKIT();
    await VAKIT();
    expect(idler(son[kurulum.alanlar.trend])).toContain(kurulum.temel + 99);

    const once = mockCalls.length;
    mockSettings.adult = false;
    await yenidenCiz();

    expect(idler(son[kurulum.alanlar.trend])).not.toContain(kurulum.temel + 99);
    // Trending için yeniden istek gerekmedi: süzme istemcide, anında.
    expect(
      mockCalls.slice(once).filter((c) => c.url.includes("/trending/")),
    ).toHaveLength(0);
  });

  test("kapatıp geri dönmek, taze izinsiz kovadan okur — ağa gitmez", async () => {
    mockSettings.adult = true;
    await yenidenCiz();
    const acikIstek = kesifIstekleri().length;

    mockSettings.adult = false;
    await yenidenCiz();

    expect(kesifIstekleri().length).toBe(acikIstek);
  });

  test("izinsiz kovaya hiçbir zaman yetişkin kayıt yazılmaz (aç-kapa-aç döngüsü)", async () => {
    for (const acik of [true, false, true, false]) {
      mockSettings.adult = acik;
      await yenidenCiz();
    }
    const izinsiz = rawCachedEntry(kurulum.bestAnahtarOn);
    expect(idler(izinsiz.data.results)).not.toContain(kurulum.temel + 99);
  });

  test("tür listesi (genres) da yetişkin izniyle yeniden çekilir", async () => {
    const genresOnce = kesifIstekleri().length;
    mockSettings.adult = true;
    await yenidenCiz();
    expect(kesifIstekleri().length).toBeGreaterThan(genresOnce);
    expect(idler(son[kurulum.alanlar.genres])).toContain(kurulum.temel + 99);
  });

  test("platform üyeliği değişince sağlayıcı bölümü yeni platforma geçer", async () => {
    mockSettings.providers = [337];
    await yenidenCiz();

    expect(son[kurulum.alanlar.secili]).toBe(337);
    const saglayiciIstegi = mockCalls.filter(
      (c) => c.url.includes(kurulum.kesif) && c.url.includes("with_watch_providers=337"),
    );
    expect(saglayiciIstegi.length).toBeGreaterThan(0);
  });

  test("platform kümesi aynı içerikle yeniden yazılınca sağlayıcı bölümü SIFIRLANMAZ", async () => {
    mockSettings.providers = [337];
    await yenidenCiz();
    const istekSayisi = mockCalls.length;

    // Yeni dizi, aynı küme (sıra/tekrar farkı): içerik kimliği değişmedi.
    mockSettings.providers = [337, 337];
    await yenidenCiz();

    expect(mockCalls.length).toBe(istekSayisi);
    expect(son[kurulum.alanlar.secili]).toBe(337);
  });

  test("yetişkin izni değişince kullanıcının elle seçtiği sağlayıcı korunur", async () => {
    mockSettings.providers = [337];
    await yenidenCiz();
    expect(son[kurulum.alanlar.secili]).toBe(337);

    // Kullanıcı elle başka sağlayıcıya geçer.
    await act(async () => { son.fetchMoviesByProvider(9); });
    await VAKIT();
    expect(son[kurulum.alanlar.secili]).toBe(9);

    mockSettings.adult = true;
    await yenidenCiz();

    // ESKİ davranışa benzer bir çözüm (fetchProviders'ı yeniden çağırmak) seçimi
    // "ilk abone olunan"a (337) sıfırlardı.
    expect(son[kurulum.alanlar.secili]).toBe(9);
    expect(idler(son[kurulum.alanlar.saglayiciListesi])).toContain(kurulum.temel + 99);
  });

  test("ayar değişmeden yeniden çizim ağ isteği üretmez", async () => {
    const once = mockCalls.length;
    await yenidenCiz();
    await yenidenCiz();
    expect(mockCalls.length).toBe(once);
  });
});

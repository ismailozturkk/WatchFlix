// "Yetişkin içeriği göster" ayarının TÜM TMDB isteklerine uygulanmasını
// doğrular. Guard, axios'un genel interceptor'larına yazıyor; testler ağ
// kurmadan kayıtlı işleyicileri doğrudan çağırıyor.
//
// Ayarın tek tek çağrı yerlerine bırakıldığı dönemde bazı uçlar unutulmuş,
// bazıları da include_adult'u sabit yazmıştı (film "En İyiler" rayı ayar
// kapalıyken bile yetişkin içerik istiyordu). Buradaki testler o sınıf hatanın
// geri gelmesini engelliyor.

import axios from "axios";
import { Keys, set, getStore } from "../services/storage";
import { installTmdbAdultGuard } from "../utils/tmdbAdultGuard";
import { syncAgeRestriction } from "../utils/ageGate";

installTmdbAdultGuard();

const [reqHandler] = axios.interceptors.request.handlers.filter(Boolean);
const [resHandler] = axios.interceptors.response.handlers.filter(Boolean);

const istekGonder = (config) => reqHandler.fulfilled({ ...config });
const cevapAl = (url, data) => resHandler.fulfilled({ config: { url }, data });

beforeEach(() => {
  getStore("settings").clearAll();
  getStore("session").clearAll();
});

describe("istek — include_adult", () => {
  test("discover isteğine ayardaki değer eklenir", () => {
    const kapali = istekGonder({
      url: "https://api.themoviedb.org/3/discover/movie",
      params: { page: 1 },
    });
    expect(kapali.params.include_adult).toBe(false);

    set(Keys.adultContent, true);
    const acik = istekGonder({
      url: "https://api.themoviedb.org/3/discover/movie",
      params: { page: 1 },
    });
    expect(acik.params.include_adult).toBe(true);
  });

  test("çağrı yerinin sabit yazdığı değer ezilir", () => {
    set(Keys.adultContent, true);
    const config = istekGonder({
      url: "https://api.themoviedb.org/3/search/movie",
      params: { include_adult: false },
    });
    expect(config.params.include_adult).toBe(true);
  });

  test("URL'e gömülü parametre yerinde güncellenir, ikinci kez eklenmez", () => {
    const config = istekGonder({
      url: "https://api.themoviedb.org/3/search/tv?query=x&include_adult=true",
    });
    expect(config.url).toBe(
      "https://api.themoviedb.org/3/search/tv?query=x&include_adult=false",
    );
    expect(config.params?.include_adult).toBeUndefined();
  });

  test("TMDB'nin parametreyi yok saydığı uçlara eklenmez", () => {
    const config = istekGonder({
      url: "https://api.themoviedb.org/3/trending/movie/week",
      params: { page: 1 },
    });
    expect(config.params.include_adult).toBeUndefined();
  });

  test("TMDB dışı isteklere dokunulmaz", () => {
    const config = istekGonder({
      url: "https://example.com/3/search/movie",
      params: { page: 1 },
    });
    expect(config.params.include_adult).toBeUndefined();
  });
});

describe("cevap — adult süzme", () => {
  test("ayar kapalıyken adult kayıtlar elenir", () => {
    const response = cevapAl("https://api.themoviedb.org/3/trending/movie/week", {
      page: 1,
      results: [
        { id: 1, adult: false },
        { id: 2, adult: true },
      ],
    });
    expect(response.data.results.map((x) => x.id)).toEqual([1]);
    expect(response.data.page).toBe(1);
  });

  test("ayar açıkken liste olduğu gibi kalır", () => {
    set(Keys.adultContent, true);
    const data = { results: [{ id: 1, adult: true }] };
    const response = cevapAl(
      "https://api.themoviedb.org/3/trending/movie/week",
      data,
    );
    expect(response.data).toBe(data);
  });

  test("elenecek kayıt yoksa cevap nesnesi kopyalanmaz", () => {
    const data = { results: [{ id: 1, adult: false }] };
    const response = cevapAl(
      "https://api.themoviedb.org/3/discover/movie",
      data,
    );
    expect(response.data).toBe(data);
  });

  test("TMDB dışı cevap değişmez", () => {
    const data = { results: [{ id: 1, adult: true }] };
    const response = cevapAl("https://example.com/liste", data);
    expect(response.data).toBe(data);
  });
});

// `adultContent` CİHAZ düzeyinde bir ayar: yetişkin bir hesapta açılıp aynı
// cihazda 18 altı bir hesaba geçildiğinde açık kalıyor. Ayarlar ekranındaki
// satırı gizlemek tek başına yetmez — kapı isteğin geçtiği yerde de olmalı.
describe("yaş kısıtı ayarı ezer", () => {
  const kisitla = () => syncAgeRestriction(`${new Date().getFullYear() - 10}-01-01`);

  test("kısıtlı hesapta ayar açık olsa bile include_adult false", () => {
    set(Keys.adultContent, true);
    kisitla();

    const config = istekGonder({
      url: "https://api.themoviedb.org/3/search/movie",
      params: { query: "x" },
    });
    expect(config.params.include_adult).toBe(false);
  });

  test("kısıtlı hesapta ayar açık olsa bile adult kayıtlar elenir", () => {
    set(Keys.adultContent, true);
    kisitla();

    const response = cevapAl("https://api.themoviedb.org/3/trending/movie/week", {
      results: [
        { id: 1, adult: false },
        { id: 2, adult: true },
      ],
    });
    expect(response.data.results.map((x) => x.id)).toEqual([1]);
  });

  test("kısıt kalkınca ayar yeniden geçerli olur", () => {
    set(Keys.adultContent, true);
    kisitla();
    syncAgeRestriction(`${new Date().getFullYear() - 30}-01-01`);

    const config = istekGonder({
      url: "https://api.themoviedb.org/3/search/movie",
      params: { query: "x" },
    });
    expect(config.params.include_adult).toBe(true);
  });
});

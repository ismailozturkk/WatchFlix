// utils/tmdbAdultGuard.js
//
// "Yetişkin içeriği göster" ayarını (Keys.adultContent) TÜM TMDB isteklerine
// tek yerden uygular.
//
// NEDEN MERKEZÎ: uygulamada kırktan fazla ayrı TMDB çağrısı var, her biri
// kendi URL'ini kuruyor ve ortak bir axios örneği yok. Ayarı elden geçirmek
// denendiğinde bazı çağrılar unutuldu, bazıları da include_adult'u sabit
// yazdı — yani ayar uygulamanın yalnız bir kısmında geçerliydi. Kural artık
// burada, çağrı yerlerinin hatırlaması gereken bir şey kalmıyor.
//
// İKİ KATMAN:
//   1) İSTEK — /discover ve /search uçlarında include_adult DAİMA ayardan
//      gelir. TMDB parametreyi yalnız bu iki uç ailesinde dikkate alıyor.
//   2) CEVAP — ayar kapalıyken dönen listeden adult:true kayıtlar elenir.
//      /trending, /popular, /top_rated gibi uçlar parametreyi yok sayıyor;
//      buna karşılık kayıtların kendisi `adult` alanını taşıdığı için ağ
//      sonrası süzme her uçta çalışır.
//
// SIRA ÖNEMLİ: süzme, önbellek katmanından SONRA kurulmalı (App.js'te
// installAxiosDataCache'ten sonra çağrılıyor). Böylece önbelleğe HAM cevap
// yazılır; kullanıcı ayarı sonradan açtığında önbellekten gelen kayıtlar da
// doğru süzülür/gösterilir.

import axios from "axios";
import { adultContentAllowed } from "./ageGate";

let installed = false;

const isTmdb = (url) =>
  typeof url === "string" && url.includes("themoviedb.org");

// include_adult yalnız bu iki uç ailesinde anlamlı.
const supportsIncludeAdult = (url) => /\/(discover|search)\//.test(url);

// Ayar + yaş kısıtı birlikte (bkz. utils/ageGate.js). Yaş kapısını yalnız
// Ayarlar ekranındaki satırı gizleyerek kurmak yetmezdi — `adultContent` CİHAZ
// düzeyinde bir anahtar; yetişkin bir hesapta açılıp aynı cihazda 18 altı bir
// hesaba geçildiğinde açık kalıyordu. Kapı burada, isteğin geçtiği yerde.
const adultAllowed = adultContentAllowed;

export function installTmdbAdultGuard() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const url = config?.url;
    if (!isTmdb(url) || !supportsIncludeAdult(url)) return config;

    const flag = adultAllowed();
    // Parametre URL'in içine gömülmüşse orada güncellenir; params'a da
    // eklenirse sorguda iki include_adult olurdu.
    if (/[?&]include_adult=/i.test(url)) {
      config.url = url.replace(
        /([?&])include_adult=[^&]*/i,
        `$1include_adult=${flag}`,
      );
    } else {
      config.params = { ...(config.params || {}), include_adult: flag };
    }
    return config;
  });

  axios.interceptors.response.use((response) => {
    if (adultAllowed()) return response;
    const data = response?.data;
    if (!isTmdb(response?.config?.url) || !Array.isArray(data?.results)) {
      return response;
    }
    const temiz = data.results.filter((item) => item?.adult !== true);
    if (temiz.length === data.results.length) return response;
    // Yeni nesne: önbellekte duran ham cevaba dokunulmuyor.
    response.data = { ...data, results: temiz };
    return response;
  });
}

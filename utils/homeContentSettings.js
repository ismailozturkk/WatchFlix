// utils/homeContentSettings.js
//
// "Ayarlar değişince ana ekran (Film / Dizi) güncellensin" sisteminin saf
// çekirdeği. React'e ve depoya bağımlı DEĞİL; bağlama işi hooks/useHomeContentSettings.js'te.
//
// SORUN NEYDİ: Film/Dizi bağlamları (context/MovieContex, TvShowContex) ve
// keşif rayı (components/DiscoveryMediaRail) listeleri apiCache'e SÜZÜLMÜŞ
// hâlde, ayardan habersiz anahtarlarla yazıyor ve kayıt "taze" ise ağa hiç
// gitmiyordu (TTL 24 saat). Yani "yetişkin içeriği göster"i açıp kapatmak
// önbellekteki rayları değiştirmiyordu; efektlerin bağımlılıklarında da bu ayar
// yoktu, kapatınca yetişkin kayıtlar rayda kalıyordu.
//
// İKİ SINIF AYAR VAR ve ikisi farklı davranır:
//
//   DATA   — Ayar, TMDB'den GELEN VERİYİ değiştirir. Önbellek kapsamına girer
//            (adultScoped) ve ilgili efektler yeniden çalışır.
//   RENDER — Aynı veri, farklı ÇİZİM (poster URL'i, boyut, köşe, rozet). Veri
//            yeniden çekilmez; yalnız listelerin hücreleri yeniden çizilir
//            (renderKey → FlatList extraData).
//
// Burada listelenmeyen ama ana ekranı etkileyen ayarlar (devam eden diziler,
// başlangıçta seçilen türler, dil) ekranın kendi `sections` / efekt
// bağımlılıklarında zaten karşılanıyor; ek bir şey gerekmiyor.

export const HOME_SETTING_EFFECT = Object.freeze({
  DATA: "data",
  RENDER: "render",
});

/**
 * Ana ekranı etkileyen ayarlar ve etki sınıfları. Yeni bir ayar eklerken önce
 * buraya yaz, sonra `buildHomeContentSettings` çıktısına bağla — __tests__/
 * homeContentSettings.test.js her kaydın çıktıyı gerçekten değiştirdiğini kilitler.
 */
export const HOME_SETTING_EFFECTS = Object.freeze({
  adultContent: HOME_SETTING_EFFECT.DATA,
  streamingProviderIds: HOME_SETTING_EFFECT.DATA,
  imageQualityLevel: HOME_SETTING_EFFECT.RENDER,
  railPosterSize: HOME_SETTING_EFFECT.RENDER,
  railPosterRadius: HOME_SETTING_EFFECT.RENDER,
  posterBadges: HOME_SETTING_EFFECT.RENDER,
});

/**
 * Yetişkin içeriğe İZİNLİ kullanıcının liste anahtarlarına eklenen son ek.
 *
 * İzinsiz (varsayılan) anahtarlar ESKİ biçimiyle kalıyor: mevcut önbellekler ve
 * "Verileri indir"in yazdığı kayıtlar bozulmuyor, yalnız ayarı açanlar ayrı bir
 * kovaya düşüyor. Böylece ayarı açıp kapatmak ağ isteği gerektirmeden iki kovanın
 * arasında gidip geliyor ve yetişkin kayıt hiçbir zaman izinsiz kovaya girmiyor.
 */
export const ADULT_SCOPE_SUFFIX = "~a";

/**
 * Önbellek anahtarını yetişkin izin durumuna göre kapsamlar.
 *
 * YALNIZ `/discover` tabanlı listeler için kullanılır — TMDB `include_adult`
 * parametresini yalnız discover/search uçlarında dikkate alıyor (bkz.
 * utils/tmdbAdultGuard.js). trending/now_playing/on_the_air gibi uçlar ayardan
 * bağımsız aynı kaydı döner; onları kapsamlamak boş yere çift kopya ve kaybolan
 * çevrimdışı kayıt demek olurdu. Onlar için `dropAdult` yeterli.
 *
 * @param {string} key
 * @param {boolean} allowed ageGate.adultContentAllowed() / etkin ayar
 */
export const adultScoped = (key, allowed) =>
  allowed ? `${key}${ADULT_SCOPE_SUFFIX}` : key;

const isAdultItem = (item) => item?.adult === true;

/**
 * Yetişkin izni yokken listeden `adult:true` kayıtları eler. Süzülecek bir şey
 * yoksa AYNI diziyi döner (kimlik korunur → bağlam değeri ve memo'lu kartlar
 * boşuna yeniden çizilmez).
 *
 * Neden ayrıca gerekli: trending gibi uçlar parametreyi yok sayar ve kayıt
 * izin AÇIKKEN önbelleğe girmiş olabilir. Ayar sonradan kapanınca ağa gitmeden,
 * ekrandaki mevcut listeden anında temizlenir.
 */
export const dropAdult = (list, allowed) => {
  if (allowed || !Array.isArray(list)) return list;
  return list.some(isAdultItem) ? list.filter((item) => !isAdultItem(item)) : list;
};

/** Platform kimliklerinin sıralı, tekil, geçerli listesi. */
export const normalizeProviderIds = (ids) =>
  [...new Set((Array.isArray(ids) ? ids : []).map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

/**
 * Efekt bağımlılığı olarak kullanılacak içerik anahtarı. Dizi KİMLİĞİ değil
 * İÇERİĞİ: ayar aynı kümeyle yeniden yazılınca (ör. "Tümünü kaldır"a basılıp
 * aynı seçim geri verilince) bağlamlar boşuna yeniden çekmez ve kullanıcının
 * elle seçtiği sağlayıcı sıfırlanmaz.
 */
export const providersKey = (ids) => normalizeProviderIds(ids).join("-");

const badgesSignature = (badges) =>
  badges && typeof badges === "object"
    ? Object.keys(badges)
        .sort()
        .map((key) => `${key}:${badges[key] ? 1 : 0}`)
        .join(",")
    : "";

/**
 * Ayar girdilerinden ana ekranın tükettiği türetilmiş değerler.
 *
 * @returns {{
 *   adultContent: boolean,
 *   adultScope: string,
 *   providersKey: string,
 *   renderKey: string,
 * }}
 */
export function buildHomeContentSettings({
  adultContent,
  streamingProviderIds,
  imageQualityLevel,
  railPosterSize,
  railPosterRadius,
  posterBadges,
} = {}) {
  const adult = adultContent === true;
  return {
    adultContent: adult,
    adultScope: adult ? ADULT_SCOPE_SUFFIX : "",
    providersKey: providersKey(streamingProviderIds),
    // Yalnız ÇİZİMİ değiştiren ayarlar. Sıra sabit; biri değişince anahtar değişir.
    renderKey: [
      imageQualityLevel ?? "",
      railPosterSize ?? "",
      railPosterRadius ?? "",
      badgesSignature(posterBadges),
    ].join("|"),
  };
}

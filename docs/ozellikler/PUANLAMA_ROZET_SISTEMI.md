# PERDE — Seelogd İzleme İlerleme Sistemi (NİHAİ SPEC v1)

> **UYGULAMA NOTU (2026-07-21).** Bu belge tasarım aşamasında yazıldı; sayıları
> elle hesaplanmıştı. Kod yazıldıktan sonra **§3'teki beş profil gerçek motorda
> çalıştırıldı** ve iki düzeltme gerekti:
>
> 1. **§4.1 eşik tablosunun üst yarısı değişti.** Belgedeki merdivende 5 yıllık
>    ağır kullanıcı (512 film + 3.400 bölüm) **230.830 Kare** çıkıyor — belgenin
>    iddia ettiği 173.550 değil (%33 sapma; elle hesap günlük tavanın gerçekte
>    ne kadar az bağladığını abartmış). Bu, o kullanıcının sistemi ilk açtığı
>    gün Perde 20'ye oturması demekti. P16–P20 eşikleri genişletildi
>    (76.000→80.000, 94.000→104.000, 116.000→136.000, 142.000→185.000,
>    175.000→260.000), Makara adımı 30.000→40.000 oldu. **P1–P15 değişmedi.**
>    Aynı kullanıcı artık Perde 19'da ve zirveye ~29.000 Kare var.
>    Kalibrasyon artık `__tests__/watchScoring.test.js` içinde testtir.
> 2. **`detectAnomalies` çağrılmıyor.** Sistem tamamen kişisel olduğu için kendi
>    kartına "doğrulanmamış" etiketi basmanın tüketicisi yok. Fonksiyon sunucu
>    tarafına geçiş için (§8.4) `utils/watchScoring.js`'te duruyor.
>
> Ayrıca §9'daki dosya listesine `utils/watchLedgerCore.js` eklendi: defterin saf
> mantığı AsyncStorage sarmalayıcısından ayrıldı, çünkü `jest.config.js` yalnızca
> RN importu olmayan modülleri çalıştırabiliyor ve geri alınamazlık sözleşmesinin
> gerçekten test edilmesi gerekiyordu.
>
> `components/AppToast.js` DEĞİŞMEDİ: kutlama, mevcut `toast.success` API'siyle
> yapılıyor — paylaşılan `toastConfig` referansına dokunmaya gerek kalmadı.
>
> ---
>
> **İNCELEME SONRASI DÜZELTMELER (aynı gün).** Kod, çok ajanlı düşman incelemesinden
> geçirildi ve çıkan iddialar gerçek motorda tek tek çalıştırıldı. Doğrulanan ve
> kapatılan açıklar:
>
> - **§2.1'deki düz `DIZI_BONUS = 500` sistemin en büyük açığıydı.** TMDB'de
>   binlerce 2 bölümlük mini dizi var ve hepsini bugüne işaretlemek tek dokunuşluk
>   bir iş. Ölçüldü: **520 mini dizi = 261.187 Kare = Perde 20**, buna karşılık 9
>   aya yayılmış gerçekten izlenmiş 40 film = 7.155 Kare = Perde 7. Sistem
>   sahteciliği dürüstlükten **36 kat** fazla ödüllendiriyordu. İki katmanlı
>   düzeltme: bonus dizinin uzunluğuyla ölçekleniyor (`min(500, bölüm × 25)`) ve
>   toplam dizi bonusu **farklı izleme günü × 100**'ü aşamıyor. Aynı istismar
>   şimdi 1.287 Kare (Perde 4) veriyor ve 40/100/520 dizi **aynı** sonucu üretiyor
>   — sahte dizi eklemek artık hiçbir şey kazandırmıyor. Beş dürüst profilin
>   hiçbirinde tavan bağlamıyor.
>   *(Tavan için ÜÇ tasarım denendi; ilk ikisi ölçülerek elendi:*
>   *(1) **içerik puanına bağlamak** — bir bölüm içeriğe yalnızca ~37 Kare kattığı
>   için oran-tabanlı tavan dürüst dizi izleyicisini cezalandırıyordu (30 bölümlük
>   tek dizi 500 yerine 277). (2) **toplam gün sayısına bağlamak** — daha kötüydü
>   ve iki yönden birden yanlıştı: `markShow` bir dizinin TÜM bölümlerine TEK
>   tarih yazdığı için (`watchedTvService.js:268`) bir diziyi kanonik yoldan
>   bitirmek yalnızca 1 gün üretiyor ve 40 bölümlük dizi 500 yerine **100** Kare
>   alıyordu — tavan tam da dürüst yolu cezalandırıyordu; ayrıca tavan GLOBAL
>   olduğu ve gün listesi film günlerini de içerdiği için 100 filmi 100 güne yayan
>   biri tavanını 10.100'e çıkarıp mini dizi çiftliğini yeniden açabiliyordu.
>   (3) **bitiş gününe bağlamak (uygulanan)** — bonus dizinin son izleme gününe
>   yazılır ve tavan GÜN BAŞINA uygulanır. İstismarın imzası "yüzlerce diziyi aynı
>   güne işaretlemek", dürüst kullanımın imzası "her diziyi kendi gününde
>   bitirmek"; tavanı güne koymak ikisini kaynağında ayırır ve film günleriyle
>   finanse edilemez. Tarihsiz eski göç kayıtları tek kovada toplanır — böylece
>   ne sıfır alırlar (2. tasarımda alıyorlardı) ne de sınırsız birikirler.)*
>
>   **Bu, sürecin en önemli dersi:** 2. tasarımı "doğrulayan" test, bölümleri
>   gün gün yayarak veri üretiyordu — uygulamanın hiçbir yazma yolunun üretmediği
>   bir şekil. Test geçiyordu ve yanlıştı. Artık testler `markShow`'un gerçekte
>   yazdığı şekli kuruyor.
> - **Tür sayacı dizide bölüm adediyle besleniyordu**, yani "Korku türünde 25
>   içerik izle" rozeti tek bir 26 bölümlük diziyle açılıyordu. Artık dizi bir eser
>   sayılıyor.
> - **Mevsimsel ölçütler bölüm sayıyordu.** `markShow` tüm bölümlere tek tarih
>   yazdığı için 120 bölümlük bir diziyi 15 Temmuz'a işaretlemek "Yaz Sezonu"
>   (rare) rozetini tek dokunuşla açıyordu. Artık **farklı gün** sayılıyor
>   (yaz 40 gün, kış 20 gün) ve rozet metinleri de bunu söylüyor.
> - **`tur_14` sadece dizi izleyen için matematiksel olarak ulaşılamazdı**: TMDB'nin
>   16 dizi türü kanonikleştirilince 12 id'ye düşüyor (korku ve tarih TMDB'de dizi
>   türü bile değil). Rozet `tur_12` oldu; tür PUANI tavanı 14'te kaldı.
> - **Kademeli aile kartı kilitli kademeyi kazanılmış gösteriyordu**: 60 filmi olan
>   kullanıcı "Salon Sakini — 150 film izle" kartını yeşil tikli ve ilerleme
>   çubuksuz görüyordu. Kimlik artık ulaşılan kademeden, ilerleme ayrı bir
>   `sonrakiHedef` alanından geliyor.
> - **Defter mutabakatında üç yarış**: (a) imza async işlemden önce "yapıldı"
>   yazılıyordu, iptal edilen mutabakat bir daha denenmiyor ve Perde tabanı kalıcı
>   olarak boş kalıyordu; (b) kök dokümandan gelen **eski format diziler**
>   `veriHazir`da hiç yoktu; (c) `markCelebrated` bellekteki eski defteri diskin
>   üzerine yazıyordu. Üçü de kapatıldı, ayrıca defter yazımına **1,5 sn yerleşme
>   gecikmesi** eklendi — tohumlama geri alınamaz olduğu için yalnızca durulmuş
>   hesap diske yazılıyor.
> - **`amber` temasının accent'i `#F59E0B`**, `GOLD` `#F5C518` ile neredeyse aynı;
>   Perde bandı 1 tema accent'ini kullandığı için o temada kart altın parlıyor ve
>   bu belgenin kendi ALTIN KURALI çiğneniyordu. Artık accent altına yakınsa band
>   gök tonuna düşüyor. Ayrıca uygulamada **7 tema var (5 değil)** ve ikisi
>   (`light`, `green`) açık zeminli — band renklerinin açık/koyu iki tonu oldu.

**Birim:** 1 puan = 1 **Kare** · **Seviye:** **Perde** (20 + sınırsız *Makara*) · **Rozet:** 46 izleme rozeti
**Kapsam:** tamamen türetilmiş, tamamen kişisel, sıfır yeni Firestore alanı, sıfır yeni listener.

---

## 1. Felsefe

Bu sistem **kaç saat izlediğini değil, izleme alışkanlığının kaç ayrı parçadan oluştuğunu** ödüllendirir: her işaretlenen film ve bölüm süresiyle orantılı bir Kare verir, her farklı izleme günü küçük bir ritim bonusu getirir, her yeni tür ufku genişletir, baştan sona bitirilen her dizi ayrıca ödüllendirilir. Ödüllendirmediği şeyler bilinçli olarak seçilmiştir: **tek dokunuşla 200 bölüm işaretlemek** (günlük Kare tavanı bunu öldürür), **`minutes` alanını şişirmek** (öğe başına kırpma bunu 240 dakikada kilitler), **veri kalitesizliği** (runtime yoksa medyan varsayılan kullanılır ve sonuç ekranda "≈" ile ilan edilir), ve **rekabet** (hiçbir sıralama, hiçbir arkadaş görünürlüğü, hiçbir Firestore yazımı yoktur — puan bir kayıt değil, kendi verinin bir görünümüdür). Sistemin dürüstlük sözleşmesi tek cümledir: **puan düşebilir, Perde ve rozet asla düşmez.** Bu yüzden yanlış işaretlemesini düzelten, mükerrer kaydını silen ya da uygulamayı silip yeniden kuran kullanıcı hiçbir şey kaybetmez; kaybedebileceği tek şey henüz kazanmadığı bir sonraki kilometre taşına olan mesafedir.

---

## 2. Puan formülü

### 2.1 Sabitler

| Sabit | Değer | Not |
|---|---|---|
| `FILM_TABAN` | 40 | Her film için sabit taban |
| `FILM_DK_KATSAYI` | 1.0 | Dakika başına Kare |
| `FILM_DK_MIN / MAX` | 5 / 240 | `minutes` kırpma aralığı |
| `FILM_DK_VARSAYILAN` | 100 | `minutes` alanı **yoksa** (medyan) |
| `BOLUM_TABAN` | 10 | |
| `BOLUM_DK_KATSAYI` | 0.6 | |
| `BOLUM_DK_MIN / MAX` | 3 / 90 | `episodeMinutes` kırpma aralığı |
| `BOLUM_DK_VARSAYILAN` | 42 | `episodeMinutes` **0 veya yok** ise |
| `GUNLUK_TAVAN` | 1100 | Yalnız içerik puanına (≈6 film ≈ 30 bölüm) |
| `GUN_BONUSU` | 12 | Farklı izleme günü başına |
| `SERI_KILOMETRE` | 3→60, 7→150, 14→300, 30→600, 60→1000, 100→1500 | Kümülatif, tarihsel maksimum |
| `RITIM_TAVAN` | 9000 | **gün + seri toplamına** sert tavan |
| `TUR_ILK` | 75 | Kanonik tür başına |
| `TUR_TAVAN` | 14 | Gerçekçi üst sınır (20 değil) |
| `DIZI_BONUS` | 500 | Yalnız doğrulanabilir bitirişte |
| `DIZI_MIN_BOLUM` | 2 | `showEpisodeCount` alt sınırı |
| `DIZI_BAYATLIK_KATI` | 3 | `watched > 3×count` ise bonus verilmez |

### 2.2 Tam matematik

```
etkinFilmDk(m)   = m.minutes > 0 ? clamp(m.minutes, 5, 240) : 100
etkinBolumDk(e)  = e.episodeMinutes > 0 ? clamp(e.episodeMinutes, 3, 90) : 42

filmPuani(m)     = 40 + round(etkinFilmDk(m) * 1.0)          // 45 … 280
bolumPuani(e)    = 10 + round(etkinBolumDk(e) * 0.6)         // 12 … 64

icerikPuani      = Σ_gün min(1100, Σ_o_güne_düşen(filmPuani + bolumPuani))
ritimPuani       = min(9000, (farklıGünSayısı * 12) + Σ SERI_KILOMETRE[eşik ≤ enUzunSeri])
turPuani         = min(kanonikFarklıTürSayısı, 14) * 75      // max 1050
diziPuani        = 500 * |{ dizi : showEpisodeCount ≥ 2
                                  ve watchedEpisodeCount ≥ showEpisodeCount
                                  ve watchedEpisodeCount ≤ 3 × showEpisodeCount }|

TOPLAM_KARE      = icerikPuani + ritimPuani + turPuani + diziPuani
```

**Günlük tavanın dışında kalanlar:** `ritimPuani` (kendi sert tavanıyla sınırlı), `turPuani` (max 1.050), `diziPuani`. Tavan dışı toplam kaçış yolu, hiçbir kullanıcıda içerik puanının %10'unu geçemeyecek biçimde sınırlandırılmıştır.

**Kaldırılan bileşen — SEZON_BONUS:** Sezon tamamlama ölçülemez. `seasonEpisodes` alanı üç ayrı yazma yolunda (`watchedTvService.js:176`, `:403`, `:445`) değeri yoksa **izlenen bölüm sayısına eşitleniyor**; `TvGraphDetailScreen.js:512` ise 0 yazıyor. Bu durumda `eps.length >= seasonEpisodes` koşulu **her zaman doğru** olur — 22 bölümlük sezonun 1 bölümünü izleyen kullanıcı "tamamladı" sayılır. Ölçüt kendi kendine referans verdiği için bileşen **tamamen çıkarılmıştır**; sezon tamamlama v1'de ne puan verir ne rozet açar. `showEpisodeCount` kategorik olarak farklıdır: bayat olabilir ama **bir zamanlar TMDB'den gelmiş gerçek bir sayıdır** ve hiçbir yazma yolunda izlenen sayıya eşitlenmez (yoksa 0 kalır, `≥ 2` koşulu bunu eler). Bu yüzden yalnızca dizi bonusu korunmuş, üstüne iki koruma eklenmiştir: alt sınır (`≥ 2`) ve bayatlık kırpması (`watched ≤ 3 × count`).

### 2.3 Çalıştırılabilir modül — `utils/watchScoring.js`

> Saf modül: React, Firestore, `@` alias importu **yoktur**. Billing açıldığında bu dosya değiştirilmeden `functions/` altına kopyalanır. `toDate` bilinçli olarak `utils/wrapped.js`'ten import edilmez, burada yeniden yazılır (saflık şartı).

```js
/* utils/watchScoring.js — Seelogd izleme puanı (Kare) · saf modül, bağımlılık yok */

export const K = Object.freeze({
  FILM_TABAN: 40, FILM_DK_KATSAYI: 1.0, FILM_DK_MIN: 5, FILM_DK_MAX: 240, FILM_DK_VARSAYILAN: 100,
  BOLUM_TABAN: 10, BOLUM_DK_KATSAYI: 0.6, BOLUM_DK_MIN: 3, BOLUM_DK_MAX: 90, BOLUM_DK_VARSAYILAN: 42,
  GUNLUK_TAVAN: 1100,
  GUN_BONUSU: 12,
  RITIM_TAVAN: 9000,
  SERI_KILOMETRE: [[3, 60], [7, 150], [14, 300], [30, 600], [60, 1000], [100, 1500]],
  TUR_ILK: 75, TUR_TAVAN: 14,
  DIZI_BONUS: 500, DIZI_MIN_BOLUM: 2, DIZI_BAYATLIK_KATI: 3,
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* 4 formatlı tarih parse: Date | Timestamp{seconds|toDate} | "YYYY-MM-DD"/ISO | epoch */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "object") {
    if (typeof v.toDate === "function") { try { return v.toDate(); } catch { return null; } }
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    return null;
  }
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    // KRİTİK: "YYYY-MM-DD" LOKAL gün olarak kurulur; new Date("...") UTC gece yarısı
    // yorumlar ve UTC-negatif dilimlerde günü 1 geri kaydırır (gün serisini kırar).
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const gunKey = (v) => {
  const d = toDate(v);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/* DST-güvenli gün indeksi (saat farkı değil, takvim günü sayar) */
const gunIndex = (key) => { const [y, m, d] = key.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

export const etkinFilmDk  = (m) => (num(m?.minutes) > 0 ? clamp(num(m.minutes), K.FILM_DK_MIN, K.FILM_DK_MAX) : K.FILM_DK_VARSAYILAN);
export const etkinBolumDk = (e) => (num(e?.episodeMinutes) > 0 ? clamp(num(e.episodeMinutes), K.BOLUM_DK_MIN, K.BOLUM_DK_MAX) : K.BOLUM_DK_VARSAYILAN);
export const filmPuani    = (m) => K.FILM_TABAN + Math.round(etkinFilmDk(m) * K.FILM_DK_KATSAYI);
export const bolumPuani   = (e) => K.BOLUM_TABAN + Math.round(etkinBolumDk(e) * K.BOLUM_DK_KATSAYI);

export function enUzunArdisik(sortedGunler) {
  let best = 0, cur = 0, prev = null;
  for (const g of sortedGunler) {
    const i = gunIndex(g);
    cur = prev !== null && i - prev === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = i;
  }
  return best;
}

/**
 * @param movies  Lists/{uid}/watchedMovies dokümanları (id doc.id'den türetilmiş)
 * @param shows   dedupeWatchedTvEntries'ten GEÇMİŞ watchedTv dokümanları
 * @param kanonikTur  (adı) => kanonik id | "other"   — utils/genreCanon.js
 */
export function computeWatchScore({ movies = [], shows = [], kanonikTur = (x) => String(x || "").toLowerCase() } = {}) {
  const gunler = new Map();            // gunKey -> { icerik, film, bolum }
  const turSayaci = new Map();         // kanonik tür -> içerik adedi
  const yilAy = new Map();             // yıl -> Set(ay)
  const diziGunleri = new Map();       // showKey -> Set(gunKey)
  const sezonGun = new Map();          // showKey|sezon|gun -> adet
  const harfler = new Set();

  let filmSayisi = 0, bolumSayisi = 0, diziSayisi = shows.length;
  let etkinDakikaToplam = 0, tahminiEser = 0;
  let uzunMetraj = 0, yuksekPuanliBolum = 0;
  let tamamlananDizi = 0;
  let cadilar = 0, yilDevri = 0, sevgililer = 0, yazBolum = 0, kisIcerik = 0;

  const gunKaydi = (g) => {
    let r = gunler.get(g);
    if (!r) { r = { icerik: 0, film: 0, bolum: 0 }; gunler.set(g, r); }
    return r;
  };
  const turEkle = (liste, adet) => {
    for (const g of Array.isArray(liste) ? liste : []) {
      const id = kanonikTur(g);
      if (!id) continue;
      turSayaci.set(id, (turSayaci.get(id) || 0) + adet);
    }
  };
  const takvimEkle = (g) => {
    const [y, m] = g.split("-").map(Number);
    if (!yilAy.has(y)) yilAy.set(y, new Set());
    yilAy.get(y).add(m);
    return m;
  };
  const ilkHarf = (ad) => {
    const s = String(ad || "").trim();
    if (!s) return;
    const c = s.toLocaleUpperCase("tr-TR")[0];
    if (/\p{L}/u.test(c)) harfler.add(c);
  };

  /* ── Filmler ── */
  for (const m of movies) {
    filmSayisi++;
    ilkHarf(m?.name);
    const dk = etkinFilmDk(m);
    etkinDakikaToplam += dk;
    if (!(num(m?.minutes) > 0)) tahminiEser++;
    if (num(m?.minutes) >= 150) uzunMetraj++;

    const turIds = (Array.isArray(m?.genres) ? m.genres : []).map(kanonikTur);
    turEkle(m?.genres, 1);

    const g = gunKey(m?.dateAdded);
    if (!g) continue;                          // tarihsiz kayıt içerik/ritim puanı vermez
    const r = gunKaydi(g); r.icerik += filmPuani(m); r.film++;
    const ay = takvimEkle(g);
    const md = g.slice(5);
    if (md === "10-31" && turIds.includes("horror")) cadilar = 1;
    if (md === "12-31" || md === "01-01") yilDevri = 1;
    if (md === "02-14" && turIds.includes("romance")) sevgililer = 1;
    if (ay === 12 || ay === 1 || ay === 2) kisIcerik++;
  }

  /* ── Diziler ── */
  for (const s of shows) {
    const showKey = String(s?.id ?? s?._docId ?? s?.name ?? Math.random());
    ilkHarf(s?.name);
    const turIds = (Array.isArray(s?.genres) ? s.genres : []).map(kanonikTur);
    let izlenenBolum = 0;

    for (const sez of Array.isArray(s?.seasons) ? s.seasons : []) {
      const eps = Array.isArray(sez?.episodes) ? sez.episodes : [];
      izlenenBolum += eps.length;
      for (const e of eps) {
        bolumSayisi++;
        const dk = etkinBolumDk(e);
        etkinDakikaToplam += dk;
        if (!(num(e?.episodeMinutes) > 0)) tahminiEser++;
        if (num(e?.episodeRatings) >= 9) yuksekPuanliBolum++;   // string|number karışık → Number()

        const g = gunKey(e?.episodeWatchTime ?? sez?.addedSeasonDate ?? s?.addedShowDate);
        if (!g) continue;
        const r = gunKaydi(g); r.icerik += bolumPuani(e); r.bolum++;
        const ay = takvimEkle(g);
        const md = g.slice(5);
        if (md === "10-31" && turIds.includes("horror")) cadilar = 1;
        if (md === "12-31" || md === "01-01") yilDevri = 1;
        if (ay >= 6 && ay <= 8) yazBolum++;
        if (ay === 12 || ay === 1 || ay === 2) kisIcerik++;

        if (!diziGunleri.has(showKey)) diziGunleri.set(showKey, new Set());
        diziGunleri.get(showKey).add(g);
        const sk = `${showKey}|${sez?.seasonNumber}|${g}`;
        sezonGun.set(sk, (sezonGun.get(sk) || 0) + 1);
      }
    }
    turEkle(s?.genres, izlenenBolum);           // tür sayacı BÖLÜM adediyle beslenir

    // Dizi bitirme: showEpisodeCount bayat olabilir ama ASLA izlenen sayıya eşitlenmez.
    const hedef = num(s?.showEpisodeCount);
    const izlenen = num(s?.watchedEpisodeCount) || izlenenBolum;
    if (hedef >= K.DIZI_MIN_BOLUM && izlenen >= hedef && izlenen <= hedef * K.DIZI_BAYATLIK_KATI) tamamlananDizi++;
  }

  /* ── Toplama ── */
  const gunListesi = [...gunler.keys()].sort();
  let icerikPuani = 0, tavanaTakilanGun = 0, maxGunFilm = 0;
  for (const g of gunListesi) {
    const r = gunler.get(g);
    if (r.icerik > K.GUNLUK_TAVAN) tavanaTakilanGun++;
    icerikPuani += Math.min(K.GUNLUK_TAVAN, r.icerik);
    if (r.film > maxGunFilm) maxGunFilm = r.film;
  }
  const enUzunSeri = enUzunArdisik(gunListesi);
  const seriPuani = K.SERI_KILOMETRE.reduce((a, [esik, p]) => a + (enUzunSeri >= esik ? p : 0), 0);
  const ritimPuani = Math.min(K.RITIM_TAVAN, gunListesi.length * K.GUN_BONUSU + seriPuani);
  const turPuani = Math.min(turSayaci.size, K.TUR_TAVAN) * K.TUR_ILK;
  const diziPuani = tamamlananDizi * K.DIZI_BONUS;

  /* Rozetler için tek geçişten türeyen yardımcı ölçütler */
  let enUzunAra = 0;
  for (let i = 1; i < gunListesi.length; i++) enUzunAra = Math.max(enUzunAra, gunIndex(gunListesi[i]) - gunIndex(gunListesi[i - 1]));
  let enCokAyliYil = 0;
  for (const set of yilAy.values()) enCokAyliYil = Math.max(enCokAyliYil, set.size);
  let sadikDiziGun = 0;
  for (const set of diziGunleri.values()) sadikDiziGun = Math.max(sadikDiziGun, set.size);
  let tekOturusta = 0;
  for (const v of sezonGun.values()) tekOturusta = Math.max(tekOturusta, v);
  let ciftPerde = 0;
  for (const r of gunler.values()) if (r.film >= 1 && r.bolum >= 5) { ciftPerde = 1; break; }

  const toplam = icerikPuani + ritimPuani + turPuani + diziPuani;

  return {
    toplam,
    kirilim: { icerikPuani, ritimPuani, turPuani, diziPuani, seriPuani, gunPuani: gunListesi.length * K.GUN_BONUSU },
    stats: {
      toplamKare: toplam,
      filmSayisi, bolumSayisi, diziSayisi, tamamlananDizi,
      etkinDakikaToplam, tahminiEser,                 // tahminiEser > 0 ⇒ UI'da "≈"
      gunSayisi: gunListesi.length, enUzunSeri, enUzunAra, tavanaTakilanGun,
      turSayisi: turSayaci.size, turSayaci,
      uzunMetraj, yuksekPuanliBolum, harfSayisi: harfler.size,
      enCokAyliYil, sadikDiziGun, tekOturusta, maxGunFilm, ciftPerde,
      cadilar, yilDevri, sevgililer, yazBolum, kisIcerik,
    },
  };
}

/* ── Perde merdiveni ── */
export const PERDE_ESIK = [0, 130, 500, 1200, 2400, 4200, 6800, 10000, 14000, 19000,
                           25000, 32000, 40000, 50000, 62000, 76000, 94000, 116000, 142000, 175000];
export const MAKARA_ADIMI = 30000;
export const PERDE_ADLARI = [
  "Bilet Sahibi", "Salon Müdavimi", "Seans Takipçisi", "Gece Kuşağı", "Maraton Koşucusu",
  "Sezon Takipçisi", "Jenerik Bekçisi", "Kanepe Eleştirmeni", "Sinefil", "Kült Avcısı",
  "Arşivci", "Koleksiyoncu", "Festival Gezgini", "Sinematek Üyesi", "Küratör",
  "Arşiv Ustası", "Kuşak Tanığı", "Sinema Hafızası", "Efsane Seyirci", "Beyazperde Efsanesi",
];

/** @param tabanPerde  ledger'daki perdeFloor — Perde ASLA bunun altına düşmez */
export function computePerde(kare, tabanPerde = 1) {
  const p = Math.max(0, num(kare));
  let perde = 1;
  while (perde < PERDE_ESIK.length && PERDE_ESIK[perde] <= p) perde++;
  const zirve = perde >= PERDE_ESIK.length;
  const makara = zirve ? Math.floor((p - PERDE_ESIK[PERDE_ESIK.length - 1]) / MAKARA_ADIMI) : 0;
  const taban = PERDE_ESIK[perde - 1];
  const tavan = zirve ? null : PERDE_ESIK[perde];
  const ilerleme = zirve
    ? ((p - PERDE_ESIK[PERDE_ESIK.length - 1]) % MAKARA_ADIMI) / MAKARA_ADIMI
    : (p - taban) / (tavan - taban);
  const goruntulenen = Math.max(perde, num(tabanPerde) || 1);
  return {
    perde: goruntulenen,
    ad: PERDE_ADLARI[goruntulenen - 1],
    makara,
    ilerleme: goruntulenen > perde ? 1 : clamp(ilerleme, 0, 1),
    kalanKare: tavan == null ? MAKARA_ADIMI - ((p - PERDE_ESIK[19]) % MAKARA_ADIMI) : tavan - p,
    banded: Math.ceil(goruntulenen / 4),          // 5 renk bandı (4 perdede bir)
  };
}

/* ── Kaba anomali eleme (hile TESPİTİ değil, açık bozukluk elemesi) ── */
export function detectAnomalies(stats, shows = []) {
  const bayraklar = [];
  if (stats.tavanaTakilanGun > 0 && stats.gunSayisi === 1 && stats.filmSayisi + stats.bolumSayisi > 50) bayraklar.push("tek_gune_yigilma");
  if (stats.maxGunFilm > 150) bayraklar.push("gunluk_asiri_film");
  for (const s of shows) {
    const izlenen = (s?.seasons || []).reduce((a, x) => a + (x?.episodes?.length || 0), 0);
    if (izlenen > 5000) { bayraklar.push("dizi_bolum_patlamasi"); break; }
  }
  return bayraklar;   // boş değilse: puan yine hesaplanır, kart "doğrulanmamış" etiketi taşır
}
```

---

## 3. Örnek hesaplar

| # | Profil | İçerik | Ritim (gün+seri) | Tür | Dizi | **TOPLAM** | Perde | Sonrakine |
|---|---|---|---|---|---|---|---|---|
| **A** | Yeni kullanıcı, ilk oturum: 1 film (139 dk) + 2 bölüm (52 dk), 3 tür, 1 gün | 179 + 2×41 = **261** | 12 + 0 = **12** | 3×75 = **225** | 0 | **498** | **Perde 2 · Salon Müdavimi** | Perde 3'e **2 Kare** (bir bölüm) |
| **B** | Düzenli dizi izleyicisi, 6 ay: 620 bölüm (ort. 45 dk), 12 film, 180 gün, seri 14, 3 dizi bitmiş, 9 tür | 620×37 + 12×158 = **24.836** | 2.160 + 510 = **2.670** | 9×75 = **675** | 3×500 = **1.500** | **29.681** | **Perde 11 · Arşivci** | Perde 12'ye **2.319** (≈14 film / 63 bölüm) |
| **C** | Film ağırlıklı sinefil, 3 yıl: 480 film (420'sinde runtime var, ort. 118 dk), 400 gün, seri 9, 14 tür, 10 gün 8+ film | 74.760 − 1.640 (tavan) = **73.120** | 4.800 + 210 = **5.010** | 14×75 = **1.050** | 0 | **79.180** | **Perde 16 · Arşiv Ustası** | Perde 17'ye **14.820** (≈90 film) |
| **D** | MEVCUT ağır kullanıcı, 5 yıl: 512 film, 3.400 bölüm (1.100'ünde `episodeMinutes=0`), 900 gün, seri 46, 21 dizi bitmiş, 19 tür, 40 gün toplu işaretleme | 208.080 − 55.080 (tavan) = **153.000** | 10.800 + 1.110 = 11.910 → tavan **9.000** | 19 → tavan 14×75 = **1.050** | 21×500 = **10.500** | **173.550** | **Perde 19 · Efsane Seyirci** | Perde 20'ye **1.450** (≈9 film) |
| **E** | Kayıtsız kullanıcı, 1 yıl: ayda 2 film (24 film, ort. 110 dk), 24 gün, 6 tür | 24×150 = **3.600** | 288 + 0 = **288** | 6×75 = **450** | 0 | **4.338** | **Perde 6 · Sezon Takipçisi** | Perde 7'ye **2.462** (≈16 film ≈ 8 ay) |
| **F** | Dürüst toplu işaretleyen, 1 yıl: haftada bir oturumda 7 bölüm + 1 film, 52 gün | 52×(7×37 + 165) = **22.048** (gün başına 424 → **tavan hiç devreye girmez**) | 624 + 0 = **624** | 8×75 = **600** | 0 | **23.272** | **Perde 10 · Kült Avcısı** | Perde 11'e **1.728** |

**Okunması gereken üç şey:**
- **F satırı, tavanın kimi cezalandırdığını gösterir:** haftada bir toplu işaretleyen dürüst kullanıcı tavana **hiç** değmez (424/1100). Tavan yalnızca *tek dokunuşla yüzlerce bölüm* senaryosunu keser.
- **Tek dokunuşla 200 bölümlük dizi:** ham 7.400 Kare → tavanla **1.100** + dizi bonusu **500** = 1.600. Aynı diziyi 40 ayrı günde izleyen kullanıcı 7.400 + 480 + 500 = 8.380 alır. Oran 5,2×. Sistemin çekirdek ayrımı budur.
- **D'de tahmin payı:** 1.100 bölüm varsayılan dakika ile hesaplanmıştır; UI toplamı **"≈173.550 Kare"** olarak gösterir ve dokununca *"1.100 bölümün süresi bilinmiyor, ortalama kullanıldı"* der.

---

## 4. Seviye sistemi

### 4.1 Eşik tablosu

| Perde | Ad | Eşik (Kare) | Önceki perdeden fark | Kabaca |
|---|---|---|---|---|
| 1 | Bilet Sahibi | 0 | — | başlangıç |
| 2 | Salon Müdavimi | 130 | 130 | **1 film** |
| 3 | Seans Takipçisi | 500 | 370 | 2 film / 10 bölüm |
| 4 | Gece Kuşağı | 1.200 | 700 | 4 film / 19 bölüm |
| 5 | Maraton Koşucusu | 2.400 | 1.200 | 7 film / 32 bölüm |
| 6 | Sezon Takipçisi | 4.200 | 1.800 | 11 film / 49 bölüm |
| 7 | Jenerik Bekçisi | 6.800 | 2.600 | 16 film / 70 bölüm |
| 8 | Kanepe Eleştirmeni | 10.000 | 3.200 | 19 film / 86 bölüm |
| 9 | Sinefil | 14.000 | 4.000 | 24 film / 108 bölüm |
| 10 | Kült Avcısı | 19.000 | 5.000 | 30 film / 135 bölüm |
| 11 | Arşivci | 25.000 | 6.000 | 36 film / 162 bölüm |
| 12 | Koleksiyoncu | 32.000 | 7.000 | 42 film / 189 bölüm |
| 13 | Festival Gezgini | 40.000 | 8.000 | 48 film / 216 bölüm |
| 14 | Sinematek Üyesi | 50.000 | 10.000 | 61 film / 270 bölüm |
| 15 | Küratör | 62.000 | 12.000 | 73 film / 324 bölüm |
| 16 | Arşiv Ustası | 80.000 | 18.000 | ≈ 485 film / 2.163 bölüm |
| 17 | Kuşak Tanığı | 104.000 | 24.000 | ≈ 630 film / 2.811 bölüm |
| 18 | Sinema Hafızası | 136.000 | 32.000 | ≈ 824 film / 3.676 bölüm |
| 19 | Efsane Seyirci | 185.000 | 49.000 | ≈ 1.121 film / 5.000 bölüm |
| 20 | Beyazperde Efsanesi | 260.000 | 75.000 | ≈ 1.576 film / 7.027 bölüm |
| — | **Makara** (prestij) | her +40.000 | 40.000 | "Perde 20 · 2. Makara" |

> Dönüşümler gerçek katsayılarla yapılmıştır: **1 ortalama film ≈ 165 Kare**, **1 ortalama bölüm ≈ 37 Kare**. (Eski taslaktaki "16.000 Kare ≈ 100 bölüm" tipi ifadeler 4× hataliydı; bu tablo doğrulanmıştır.)

### 4.2 Eğri gerekçesi

Eğri **20 perde**dir, 30 değil. Sebep ölçülmüştür: ortalama aktif kullanıcı (Örnek C'nin temposu, ~26.000 Kare/yıl) 20 perdenin 16'sını üç yılda görür; ağır kullanıcı (Örnek D, 5 yılda 173.550) **19. perdededir ve zirveye varmamıştır**. 30 perdelik bir merdivende üst 12 isim, kullanıcıların %1'i dışında kimsenin görmeyeceği ölü içerik olurdu. Kayıtsız kullanıcı (Örnek E, ayda 2 film) ise ilk yıl sonunda Perde 6, ikinci yıl Perde 7-8'dedir — merdivenin **alt yarısı gerçekten yaşanan bölgedir**.

Fark eğrisi **doğrusala yakın büyür (130 → 33.000)**, üstel değil. Kasıtlı: bir perde atlamanın *süresi* uzar ama *iş miktarı* patlamaz. P19→P20 = 33.000 Kare, D'nin kendi temposuyla (~35.000 Kare/yıl) **yaklaşık 11 ay**. Bu dürüst rakamdır; "3-5 hafta" gibi bir iddia bu veriyle savunulamaz ve spec bunu iddia etmez. Zirve sonrası **Makara** adımı 30.000'dir (D için ~10 ay), yani tavana varan kullanıcı ilerlemesiz kalmaz ama Makara da "sık kutlanan" bir şey değildir; bu bilinçlidir — prestij nadir olmalıdır.

**İlk oturumda seviye atlamak garantidir:** Perde 2 eşiği 130 Kare, en kısa film bile (5 dk kırpması) 45 Kare + ilk türün 75 Karesi = 120... ve tipik bir film tek başına 140-280 Kare verir. İlk işaretleme aynı anda üç şey verir: `ilk_kare` rozeti, Perde 2 ve ilk tür puanı.

### 4.3 İsimlendirme ve renk

Tüm isimler **izleyiciyi** tarif eder. Önceki taslaktaki "Görüntü Yönetmeni", "Usta Yönetmen" (kullanıcı film çekmedi), "Nadir Baskı", "Nitrat Baskı", "Kayıp Film" (kullanıcı bir film değil; üstelik olumsuz çağrışımlı) elenmiştir. Register tek: **kimlik/rol adı**. Yay: seyirci (1-5) → takipçi (6-10) → uzman (11-15) → miras (16-20).

**Renk:** 5 sabit band (4 perdede bir değişir), `theme.accent` türevlerinden üretilir, **`#F5C518` ALTIN hiçbir bandda kullanılmaz** (ALTIN KURALI: altın yalnız legendary'de yaşar). Renk `hsl()` değil hex üretir; yine de tüm alfa birleştirmeleri `StatsComponents.withAlpha()` üzerinden yapılır.

**"Rank" çakışması — v1'in tek satırlık çözümü:** `context/ProfileStatsContext.js:74-83`'teki `getDynamicRankColor` **emekliye ayrılmaz** (avatar halkaları, hero accent, istatistik ekranlarının tema rengi ondan besleniyor; 6 görsel yüzeye dokunmak gereksiz regresyon). Yalnız üretilen **etiket dizesi** değişir: `rankNameMovie: \`Rank ${step+1}\`` → `` `${step} hafta` ``. Bu daha doğrudur (step = 10.080 dakikalık hafta sayısı), tek dosyada tek satırdır ve "ilerleme" kelimesini serbest bırakır. Sonuç: uygulamada **tam olarak iki ilerleme sayısı** kalır — profilde **Perde**, Hub'da oyunun **Seviye**'si. "Rank" kelimesi ortadan kalkar.

---

## 5. Rozet katalogu (46 rozet)

Ortak kurallar:
- Şekil `defineWatchBadge(def)` — `gameRegistry.defineAchievement` ile aynı sözleşme (`iconSolid` **elle**, `isUnlocked = getProgress(stats) >= target`), iki ek alan: `family` (kademe ailesi) ve `hidden`.
- `getProgress(stats) => number` imzası korunur; `stats` = `computeWatchScore().stats` + ProfileStats sayaçları birleşimi. **Her rozet listeyi ayrı taramaz** — hepsi tek geçişten çıkan `stats` objesinden okur.
- **Rarity elle yazılır**, `resolveRarity(target)` kullanılmaz: hedefin büyüklüğü zorluğu ölçmez (3.000 bölüm otomatik legendary olurdu). Dağılım: **7 common · 20 uncommon · 14 rare · 3 epic · 2 legendary** — medyan **uncommon**. (Önceki taslakta medyan rare'di, profil mor duvara dönüyordu.)
- **LEGENDARY KOTASI = 2** (`film_500`, `perde_20`). Yeni bir legendary eklemek için mevcut birini düşürmek gerekir.
- **TARİH TÜREVİ ROZET TAVANI = rare.** Gün/seri/mevsim rozetleri kullanıcı-seçimli tarihten türediği için epic veya legendary olamaz.
- Metinler **katalog içinde inline `tr/en/descTr/descEn`** tutulur (`components/badges/badgeCatalog.js` emsali). Böylece 46 rozet × 2 metin × 2 dil = **184 autoI18n anahtarı yazılmaz**; i18n maliyeti yalnızca ~24 UI dizesine iner. Ton: 2. tekil, emir kipi, başlık 1-3 kelime, açıklama noktasız tek cümle.

| id | TR başlık | TR açıklama | Metrik (`stats` alanı) | Hedef | Nadirlik | Ionicons |
|---|---|---|---|---|---|---|
| `ilk_kare` | İlk Kare | İlk film ya da bölümünü işaretle | `filmSayisi + bolumSayisi` | 1 | common | `footsteps-outline` |
| `film_10` | İlk Bilet | 10 film izle | `filmSayisi` | 10 | common | `film-outline` |
| `film_50` | Sürekli Müşteri | 50 film izle | `filmSayisi` | 50 | uncommon | `film-outline` |
| `film_150` | Salon Sakini | 150 film izle | `filmSayisi` | 150 | rare | `film-outline` |
| `film_500` | Beş Yüz Film | 500 film izle | `filmSayisi` | 500 | **legendary** | `film-outline` |
| `bolum_25` | Sezon Başı | 25 bölüm izle | `bolumSayisi` | 25 | common | `tv-outline` |
| `bolum_100` | Bölüm Avcısı | 100 bölüm izle | `bolumSayisi` | 100 | uncommon | `tv-outline` |
| `bolum_500` | Bölüm Kurdu | 500 bölüm izle | `bolumSayisi` | 500 | rare | `tv-outline` |
| `bolum_2000` | İki Bin Bölüm | 2000 bölüm izle | `bolumSayisi` | 2000 | epic | `tv-outline` |
| `final_1` | Final Jeneriği | İşaretlediğin bir diziyi sonuna getir | `tamamlananDizi` | 1 | common | `checkmark-done-outline` |
| `final_10` | Seri Tamamlayıcı | 10 diziyi sonuna getir | `tamamlananDizi` | 10 | uncommon | `checkmark-done-outline` |
| `final_40` | Arşiv Kapatıcı | 40 diziyi sonuna getir | `tamamlananDizi` | 40 | rare | `checkmark-done-outline` |
| `sure_1gun` | Perdede Bir Gün | Toplam 24 saat izlemeye ulaş | `etkinDakikaToplam` | 1.440 | uncommon | `hourglass-outline` |
| `sure_10gun` | Perdede On Gün | Toplam 240 saat izlemeye ulaş | `etkinDakikaToplam` | 14.400 | rare | `hourglass-outline` |
| `sure_60gun` | Perdede Altmış Gün | Toplam 1440 saat izlemeye ulaş | `etkinDakikaToplam` | 86.400 | epic | `time-outline` |
| `uzun_metraj` | Uzun Metraj | 150 dakikadan uzun 10 film izle | `uzunMetraj` (`minutes >= 150`) | 10 | uncommon | `albums-outline` |
| `seri_3` | Üç Gün Üst Üste | 3 gün üst üste bir film ya da bölüm işaretle | `enUzunSeri` | 3 | common | `flame-outline` |
| `seri_7` | Haftalık Ritim | 7 gün üst üste bir film ya da bölüm işaretle | `enUzunSeri` | 7 | uncommon | `flame-outline` |
| `seri_21` | Üç Hafta Kesintisiz | 21 gün üst üste işaretleme yap | `enUzunSeri` | 21 | rare | `flame-outline` |
| `seri_60` | Altmış Gün Kesintisiz | 60 gün üst üste işaretleme yap | `enUzunSeri` | 60 | rare | `bonfire-outline` |
| `gun_50` | Elli Gün Kayıt | 50 farklı günde işaretleme yap | `gunSayisi` | 50 | uncommon | `today-outline` |
| `gun_200` | İki Yüz Gün Kayıt | 200 farklı günde işaretleme yap | `gunSayisi` | 200 | rare | `calendar-outline` |
| `ay_12` | Takvim Doldu | Bir yılın 12 ayında da izleme yap | `enCokAyliYil` | 12 | uncommon | `calendar-number-outline` |
| `maraton_3film` | Maraton | Aynı gün 3 film işaretle | `maxGunFilm` | 3 | uncommon | `pizza-outline` |
| `tek_oturusta` | Tek Oturuşta | Bir sezonun 8 bölümünü aynı güne işaretle | `tekOturusta` | 8 | common | `flash-outline` |
| `sadik_izleyici` | Sadık İzleyici | Aynı diziyi 30 farklı günde izle | `sadikDiziGun` | 30 | uncommon | `heart-outline` |
| `tur_5` | Tür Gezgini | 5 farklı türde içerik izle | `turSayisi` | 5 | common | `compass-outline` |
| `tur_10` | Tür Kaşifi | 10 farklı türde içerik izle | `turSayisi` | 10 | uncommon | `compass-outline` |
| `tur_14` | Bütün Raflar | 14 farklı türde içerik izle | `turSayisi` | 14 | rare | `globe-outline` |
| `korku_25` | Karanlık Salon | Korku türünde 25 içerik izle | `turSayaci.get("horror")` | 25 | uncommon | `skull-outline` |
| `animasyon_40` | Çizgi Kuşağı | Animasyon türünde 40 içerik izle | `turSayaci.get("animation")` | 40 | uncommon | `happy-outline` |
| `belgesel_20` | Gerçek Payı | Belgesel türünde 20 içerik izle | `turSayaci.get("documentary")` | 20 | uncommon | `school-outline` |
| `komedi_75` | Gülme Krizi | Komedi türünde 75 içerik izle | `turSayaci.get("comedy")` | 75 | rare | `cafe-outline` |
| `cadilar_gecesi` | Kabuslar Gecesi | 31 Ekim'de bir korku içeriği işaretle | `cadilar` | 1 | uncommon | `moon-outline` |
| `yil_devrilirken` | Yıl Devrilirken | 31 Aralık ya da 1 Ocak'ta izleme yap | `yilDevri` | 1 | uncommon | `gift-outline` |
| `kirmizi_perde` | Kırmızı Perde | 14 Şubat'ta bir romantik içerik işaretle | `sevgililer` | 1 | uncommon | `rose-outline` |
| `yaz_sezonu` | Yaz Sezonu | Haziran-Ağustos arasında 100 bölüm izle | `yazBolum` | 100 | rare | `sunny-outline` |
| `kis_kampi` | Kış Kampı | Aralık-Şubat arasında 30 içerik izle | `kisIcerik` | 30 | uncommon | `snow-outline` |
| `gizli_cift_perde` | Çift Perde | Aynı gün 1 film ve 5 bölüm işaretle | `ciftPerde` · **gizli** | 1 | rare | `aperture-outline` |
| `gizli_vitrin` | Vitrin | TMDB puanı 9 üstü 25 bölüm izle | `yuksekPuanliBolum` · **gizli** | 25 | rare | `star-outline` |
| `gizli_alfabe` | A'dan Z'ye | 18 farklı harfle başlayan içerik izle | `harfSayisi` · **gizli** | 18 | rare | `library-outline` |
| `gizli_geri_donus` | Geri Dönüş | 60 gün ara verdikten sonra tekrar işaretle | `enUzunAra` · **gizli** | 60 | uncommon | `refresh-outline` |
| `perde_8` | Perde 8 | Perde 8'e ulaş | `computePerde().perde` (10.000 Kare) | 8 | uncommon | `trending-up-outline` |
| `perde_14` | Perde 14 | Perde 14'e ulaş | `computePerde().perde` (50.000 Kare) | 14 | epic | `trending-up-outline` |
| `perde_20` | Beyazperde Efsanesi | Perde 20'ye ulaş | `computePerde().perde` (175.000 Kare) | 20 | **legendary** | `trophy-outline` |
| `cift_kariyer` | Çift Kariyer | Perde 10 ve oyun Seviye 10'a birlikte ulaş | `perde>=10 && gameProfile.summary.level>=10` | 1 | rare | `sparkles-outline` |

**Kademeli aileler** (`family`): `film` (10/50/150/500), `bolum` (25/100/500/2000), `final` (1/10/40), `sure` (1/10/60 gün), `seri` (3/7/21/60), `gun` (50/200), `tur` (5/10/14), `perde` (8/14/20). Rozet ekranında bir aile **tek kart**tır: en yüksek kazanılmış kademe gösterilir, altında bir sonraki kademenin ilerlemesi. Böylece 46 rozet, ekranda ~30 karta iner.

**Kaldırılan rozetler ve nedenleri:** `sezon_5 / sezon_40 / sezon_150` — sezon tamamlama ölçülemez (§2.2). `tur_20` — TMDB kanonik kümesi Haber/Talk/Reality içerdiği için pratikte ulaşılamaz. `gizli_yil_donumu` — tamamen tarih uydurmasıyla açılabilirdi ve karşılığı olmayan bir "epic" üretiyordu.

---

## 6. Mevcut kullanıcı geçişi

**Cevap net: 500 film izlemiş kullanıcı geriye dönük puanını ve rozetlerini TAM olarak alır.** O filmleri gerçekten izledi; geriye dönük veriyi saymamak dürüst olmaz. Problem rozet sayısı değil **teslim biçimi**dir.

### 6.1 Sessiz tohumlama (yeni ekran YOK)

1. Sistem bir kullanıcıda ilk kez hesaplandığında `utils/watchBadgeLedger.js` içinde `watchscore_baseline_{uid}` **yoksa**, o an açık olan tüm rozet id'leri, o anki Perde ve toplam Kare **sessizce** AsyncStorage'a yazılır. **Hiçbir toast, hiçbir push, hiçbir Lottie çalmaz.**
2. Kullanıcı profil kartına ilk dokunduğunda Rozetler ekranının başlığı **"Tebrikler, 31 rozet kazandın" DEĞİL → "Arşivin açıldı — 31 rozet zaten senindi"** der. Rozetler **40 ms stagger** ile dolu bir raf olarak belirir: ödül yağmuru değil, envanter.
3. **Konfeti bu anda kullanılmaz.** `assets/lottie/confetti_2.json` sinyal değerini korumak için yalnızca tohumlamadan **sonraki** gerçek geçişlere saklanır (kapalıdan açığa geçen rozet, perde atlama).
4. O andan itibaren kutlama yalnızca `baseline`de **olmayan** rozetler için tetiklenir. `watchscore_seen_{uid}` kutlaması gösterilmiş id'leri tutar.

### 6.2 Geri alınamazlık sözleşmesi (ledger)

Ledger üç şey tutar ve üçü de **monoton**dur:

```
watchscore_baseline_{uid} = { points, perde, badgeIds[], seenAt }   // tohumlama anı
watchscore_earned_{uid}   = { badgeIds[], perdeFloor }              // ASLA küçülmez
watchscore_seen_{uid}     = { badgeIds[] }                          // kutlama tekrarını önler
```

Her hesaplamadan sonra: `earned.badgeIds = union(earned.badgeIds, hesaplananAçıkRozetler)` ve `earned.perdeFloor = max(earned.perdeFloor, hesaplananPerde)`. `computePerde(kare, perdeFloor)` bu tabanı uygular.

**Neden zorunlu:** `MovieDetail.js:413-416` — bir filme ikinci kez basmak `removeFromList` çağırıyor. Yanlışlıkla tek bir postere iki kez basan kullanıcı, ledger olmadan "Salon Sakini" rozetini **kaybeder**, Perde düşer, bar geri sarar ve hiçbir açıklama çıkmaz. İzleme verisi — oyun tarafındaki `totalCorrect`'in aksine — **monoton değildir**: unmark birinci sınıf bir aksiyondur. Kazanılmış bir rozetin geri alınması, puanın 100 eksik hesaplanmasından çok daha ağır bir adalet ihlalidir. Kural: **puan düşebilir, Perde ve rozet düşmez.**

**Ledger kaybolursa** (uygulama silme / cihaz değişimi): baseline yeniden yazılır, `earned` seti veriden yeniden hesaplanan set kadar geri gelir. Kayıp yalnızca "geçmişte kazanıp sonra veriyi sildiğin rozetler"dir ve bedeli kozmetiktir. Firestore'a hiçbir şey yazılmaz.

### 6.3 Boş durum ve açılış penceresi

- **Hiç işaretleme yok:** Perde 1 "Bilet Sahibi", 0 Kare, tek satır teşvik: *"İlk karen seni bekliyor. Bir film işaretleyerek başla."*
- **Açılış penceresi:** `ProfileStatsContext` listener'ları `useStartupGate(3200)` ile ertelenir; ilk ~3,2 saniye veri **yoktur**. Bu pencerede Perde kartı **skeleton** gösterir — "0 Kare" veya "Perde 1" **değil**; yanlış bilgi hem kutlama diff'ini hem "az kaldı" hesabını bozar. Hesaplama `startupReady && listItems.length > 0` olduktan sonra **tek `useMemo`** içinde yapılır; ledger diff'i yalnızca hesap bittikten sonra çalışır.

---

## 7. Veri kalitesi

| Durum | Kanıt | Karar |
|---|---|---|
| **Film `minutes` alanı hiç yazılmıyor** | `listItemsService.js:55` `if (item.minutes != null)` | `FILM_DK_VARSAYILAN = 100` (medyan) kullanılır, `tahminiEser` sayacı artar |
| **`episodeMinutes: 0` yazılıyor** | `watchedTvService.js:48` | `BOLUM_DK_VARSAYILAN = 42` kullanılır |
| **Gerçekten kısa eser** (2 dk kısa film, 3 dk web dizisi) | TMDB runtime dolu | **Face value + düşük taban**: `clamp(...,5,240)` → 45 Kare (ortalama filmin %27'si). Eski 40 dk alt sınırı kaldırıldı; o sınır kısa filmi ortalama filmin %74'üne çıkarıp bir farm çiftliğine dönüşmüştü |
| **"≈" ilanı** | — | `tahminiEser > 0` ise toplam Kare ve toplam süre **"≈"** ile gösterilir; dokununca *"X eserin süresi bilinmiyor, ortalama kullanıldı"*. Sessiz eksik göstermek (bugünkü `minutes \|\| 0` davranışı) bırakılır |
| **Süre rozetleri** | `ProfileStatsContext.js:225` `m.minutes \|\| 0` | Süre rozetleri **`totalMinutesTime`'ı KULLANMAZ**; `stats.etkinDakikaToplam`'ı kullanır. Aynı bölümün bir yerde 42 dk bir yerde 0 dk sayılması ortadan kalkar |
| **Tür adı, ID değil ve dile bağımlı** | `MovieDetail.js:254,431` | `utils/genreCanon.js` — TMDB'nin 19 film + 16 dizi türünün TR+EN adları → ~20 kanonik id; tanınmayan string tek bir `"other"` altında sayılır |
| **Boş meta dizi dokümanı: `genres: []`** | `ListsScreen.js:1359` → `SeasonDetails.js:297` | **Bilinen ve kapatılmayan boşluk.** O dizinin tüm bölümleri tür puanına ve tür rozetlerine katılmaz. `genreCanon` bunu çözmez (sorun normalizasyon değil, verinin yokluğu). Etkisi sınırlıdır çünkü tür puanı toplamın %1'inden azdır (max 1.050) ve tür rozetlerinin hedefleri düşüktür. **v1.1 hafifletmesi:** `TvShowsDetails` açıldığında show dokümanında `genres` boşsa TMDB'den doldurulması (tek alanlı `merge` yazımı) |
| **Tarih alan adları 4 farklı** | `dateAdded` / `addedShowDate` / `addedSeasonDate` / `episodeWatchTime` | Bölüm için öncelik sırası: `episodeWatchTime ?? addedSeasonDate ?? addedShowDate` |
| **Tarih 4 formatlı olabilir** | `wrapped.js:15-29`, `ProfileStatsContext.js:59-64` | `toDate` dördünü de destekler; `"YYYY-MM-DD"` **lokal** gün olarak kurulur (UTC gece yarısı parse'ı UTC-negatif dilimlerde günü kaydırıp seriyi kırıyor) |
| **Tarihsiz kayıt** | `normalizeItem` `dateAdded ?? null` | İçerik ve ritim puanı **vermez** (hangi güne yazılacağı belirsiz) ama tür ve dizi bonusuna **girer** — tamamen değersizleşmez |
| **Aynı dizi iki dokümanda (`1399` + `tv_1399`)** | `watchedTvService.js:108-129` | Puan modülü **ham Firestore okumaz**; `dedupeWatchedTvEntries`ten geçmiş ProfileStats çıktısını tüketir |
| **`showEpisodeCount` bayat** | `watchedTvService.js:186-195` | Kabul: hata **cömertlik yönünde**dir ve donmuş sayı büyümediği için ödül geri alınmaz. UI dili *"işaretlediğin bölümlerin tamamı"*. Ek koruma: `≥ 2` ve `≤ 3×` bayatlık kırpması |
| **`seasonEpisodes` kendine referans veriyor** | `watchedTvService.js:176, 403, 445` | Bileşen **tamamen kaldırıldı** (§2.2) |
| **`episodeRatings` tipi karışık (string\|number)** | `SeasonItem.js:342` vs `EpisodeDetails.js:319` | `Number()` ile normalize edilir |
| **Rewatch modellenemiyor** | `grep watchCount` → yok | Rewatch **puan vermez**, "tekrar izleme" rozeti **katalogda yoktur**. Film unmark+mark yapılırsa ilk tarih kaybolur → içerik/ritim puanı düşebilir ama **Perde ve rozet düşmez** (§6.2). Gerçek çözüm şema değişikliğidir (`watchCount` / `watchEvents[]`) ve bu sistemin kapsamı dışındadır |
| **`markShow` tüm `episodeWatchTime`'ları eziyor** | `watchedTvService.js:268-296` | v1'de **yazma yoluna dokunulmaz**. `perdeFloor` sayesinde bu ezme artık Perde kaybettiremez, yalnızca puanı geçici düşürür. Düzeltme v1.1'e ertelendi (§10) |

---

## 8. Hile ve güven

### 8.1 Sistem KİŞİSELDİR — v1'in en önemli kararı

**Perde, Kare ve izleme rozetleri yalnızca kullanıcının kendi profilinde görünür. Arkadaş profilinde gösterilmez. Sıralama yoktur, v2'de de yoktur.** Firestore'a hiçbir puan yazılmaz.

Bu tek karar, hile yüzeyinin ekonomik değerini sıfırlar: kimseyi geçemeyeceğin, kimsenin görmediği bir sayıyı şişirmek yalnızca kendi ilerleme hissini yok eder. `GameLeaderboards`'ın `verified: false` utancı tekrarlanmaz. **Doğrulanamayan bir puan sıralanmamalıdır** — bu kural, gelecekteki her puan tasarımının kabul etmesi gereken kısıttır.

### 8.2 Ne kadar güvenilir — dürüst değerlendirme

`firestore.rules:84` `allow write: if isOwner(uid)` ve hiçbir alan doğrulaması yok; `minutes` tamamen istemciden geliyor. **Puan bugün doğrulanamaz.** Amaç mükemmel tespit değil, hilenin **getirisini sıfıra yaklaştırmak**tır.

| Savunma | Ne yapar | Ne yapmaz |
|---|---|---|
| **Öğe başına kırpma** (`clamp(minutes,5,240)`) | `minutes: 600000` yazan kullanıcı bile film başına en fazla **280 Kare** alır. Anti-hile ayrı bir "şüpheli mi" katmanı değil, **aritmetiğin kendisi**dir — yanlış pozitif üretmez | Sahte kayıt eklemeyi engellemez |
| **Günlük tavan (1100)** | 500 sahte filmi aynı güne yazmak 1.100 Kare verir, 82.500 değil | Tarihi yayan kullanıcıyı durduramaz |
| **Ritim tavanı (9.000)** | Tarih uydurarak kazanılabilecek **maksimum** Kare 9.000'dir (Perde 7 civarı). 365 tarihi elle dağıtan kullanıcı, eski tasarımda ~15.000 Kare + 6 rozet alıyordu | Tarihi doğrulamaz |
| **Tarih türevi rozet tavanı = rare** | Uydurulabilir hiçbir rozet epic/legendary olamaz | — |
| **Türetilmişlik** | Puan hiçbir yerde `increment` edilmez; her açılışta ham veriden sıfırdan hesaplanır. Bu üçünü birden çözer: (a) çift sayım imkânsız, (b) offline'da kaybolan yazımlar puanı bozmaz (`firebase.js:31` düz `getFirestore`, RN'de disk persistence yok), (c) hesap/liste temizliği sonrası tutarsızlık kalmaz | — |
| **Yazmama = gizlilik özelliği** | `Users/{uid}` `read: if isSignedIn()` — oraya yazılan bir puan, kullanıcı "listelerim gizli" dese bile listelerinden türetilmiş bilgiyi herkese sızdırırdı. Türetilmiş puan görünürlüğü **otomatik miras alır**: sıfır kural, sıfır alan, sıfır denetim | — |
| **`detectAnomalies`** | Tek güne yığılma, günde >150 film, bir dizide >5000 bölüm. Anomali varsa puan yine hesaplanır, kart "doğrulanmamış" etiketi taşır | **Tarih dağıtma saldırısını YAKALAMAZ** — kayıtlar mükemmel dağılmış görünür ve imza dürüst arşivciden ayırt edilemez. Bu açıkça kabul edilmiştir |

### 8.3 Kabul edilen açık: izleme tarihi kullanıcı girdisidir

`DatePickerModal` `maxDate = bugün`, `minDate = yayın tarihi` (`WatchedAdd.js:328`, `SeasonItem.js:224`, `MovieDetail.js:1339`). Gelecek kapalı, **geçmiş onlarca yıl açık**. Kullanıcı 365 içeriği 365 farklı geçmiş tarihe yazabilir ve buna karşı teknik bir savunma **yoktur**. Bu yüzden tez, "her gün yapılan **doğrulanabilir** eylem" değil, şudur:

> **Tarihten türeyen her şey — gün bonusu, seri, mevsimsel rozetler — sert bir tavanla sınırlanmış, rozet merdiveninde rare ile kapatılmış ve hiçbir sosyal yüzeyde gösterilmeyen bir ritim göstergesidir. Puanın %95'i, kullanıcının gerçekten işaretlediği eser sayısından ve süresinden gelir.**

Örnek D'de ritim payı 173.550'de 9.000 = **%5,2**. Örnek C'de %6,3. Uydurmanın tavanı budur.

### 8.4 Sunucuya geçiş (billing açılınca, tek adım)

`utils/watchScoring.js` saf ve bağımsız olduğu için **aynı dosya** `functions/` altına kopyalanır; `onDocumentWritten("Lists/{uid}/watchedMovies/{id}")` ve `.../watchedTv/{id}` tetikleyicileri puanı yeniden hesaplayıp `Lists/{uid}/score/current` belgesine yazar — **`Users/{uid}` altına değil**, çünkü `Lists/{uid}` yolu mevcut `canReadLists(uid)` + `privacy.lists` kuralına otomatik tabidir. Kural: `allow write: if false` (AiUsage / ProviderWatch / tournaments-agg emsali). `accountService.js:312`'deki silme listesine `score` eklenir. Formül değişmediği için **geçiş günü hiçbir kullanıcının puanı oynamaz**. App Check (`functions/index.js:407` `enforceAppCheck: false`) kurulana kadar sahte istemci riski sürer; bu yüzden geçiş sonrası bile sıralama açılmaz.

---

## 9. Uygulama planı

**v1 dosya bütçesi: 8 yeni + 4 değişen = 12 dosya.** (Eski taslak 25 dosyaydı; yazma-yolu değişikliği, Rank emeklilik kaskadı ve Arşiv Galası ekranı çıkarıldı.)

| # | Dosya | Durum | İçerik | Ne test edilir |
|---|---|---|---|---|
| 1 | `utils/genreCanon.js` | **YENİ** | TMDB tür adları TR+EN → ~20 kanonik id + `kanonikTur(str) => id \| "other"`. Bağımlılığı yok | "Bilim Kurgu" ve "Science Fiction" **aynı** id'ye düşüyor mu; bilinmeyen string tek "other" altında mı toplanıyor; `wrapped.js` PERSONALITIES ile çakışma yok mu |
| 2 | `utils/watchScoring.js` | **YENİ** | §2.3'teki modülün tamamı. **React/Firestore/alias importu YOK** | Birim testler: (a) `minutes` yok → 140 Kare, (b) `minutes: 600000` → 280 Kare, (c) 500 kayıt aynı güne → 1.100 Kare, (d) `episodeMinutes: 0` → 35 Kare, (e) `"2026-03-14"` UTC-5 diliminde 14 Mart kalıyor mu, (f) DST geçişinde seri kırılmıyor mu, (g) `seasonEpisodes` fallback'li dizide **sıfır** bonus, (h) `showEpisodeCount: 0` → bonus yok, (i) 3.400 bölüm + 512 film üzerinde tek geçiş **< 15 ms** |
| 3 | `components/badges/watchBadgeCatalog.js` | **YENİ** | `defineWatchBadge` + 46 rozet, **inline `tr/en/descTr/descEn`**, elle `rarity`, elle `iconSolid`, `family`, `hidden`. Dosya başına yorum: **LEGENDARY KOTASI = 2**, **tarih türevi rozet tavanı = rare** | Her `icon`/`iconSolid` çifti Ionicons'ta gerçekten var mı (elle doğrulama); rarity dağılımı 7/20/14/3/2 mi; her `getProgress` yalnız `stats` okuyor mu (liste taraması **yok**) |
| 4 | `utils/watchBadgeLedger.js` | **YENİ** | AsyncStorage: `baseline` / `earned` (monoton union + `perdeFloor`) / `seen`. **Firestore'a hiçbir şey yazmaz** | Rozet açıp veriyi silince rozet **açık kalıyor** mu; `perdeFloor` düşmüyor mu; ledger silinince tohumlama tekrar sessizce çalışıyor mu (kutlama patlamıyor) |
| 5 | `hooks/useWatchProgress.js` | **YENİ** | `useProfileStats()`'tan `listItems` + dedupe'lu show dokümanlarını alır, **TEK `useMemo`** içinde `computeWatchScore` + `computePerde(…, perdeFloor)` + 46 rozet ilerlemesi. **ÜÇÜNCÜ FIRESTORE LISTENER AÇMAZ**. `startupReady` false iken `{ loading: true }` | Açılışta 3,2 sn skeleton dönüyor mu; listener sayısı değişmedi mi (Firestore debug log); tekrar render'da yeniden hesaplama olmuyor mu |
| 6 | `components/badges/WatchBadgeCard.js` | **YENİ** | `AppBadge`'i **sarar, değiştirmez** (prop yüzeyi kapalı sözleşme). Kademeli aile tek kart. Gizli rozette kilitliyken başlık "???", açıklama "Gizli rozet". Geometri `GameAchievementsScreen` ile birebir (minHeight 84, radius 18, gap 13, `AppBadge size 52`) | Aynı ekranda 30 rozet → `useId()` gradyan çakışması yok mu (Android); ilerleme yayı yalnız kilitliyken ve `size>=36`'da çiziliyor mu |
| 7 | `components/profile/WatchLevelCard.js` | **YENİ** | `StatsComponents` görsel dili (LinearGradient hero, radius 24, sağ üstte pill, 28px sayı, `withAlpha()` **zorunlu**). İçerik: "Perde 11 · Arşivci", "≈29.681 Kare", ilerleme barı, altında **"az kaldı" şeridi**: kalan Kare somut eyleme çevrilir ("2.319 Kare ≈ 14 film ya da 63 bölüm") + `ratio >= 0.6` olan en yakın 2 rozet | 8 zeminde (7 tema + özel) okunuyor mu; **ALTIN kullanılmıyor** mu; `hsl()` + `"33"` birleştirmesi hiç yok mu; `tahminiEser > 0` iken "≈" görünüyor mu |
| 8 | `screens/tabs/profile/WatchBadgesScreen.js` | **YENİ** | **FlatList** (`.map` YASAK), bölümler (Kilometre Taşları / Ritim / Türler / Mevsimsel / Gizli / Perde), filtre (Tümü/Açık/Kilitli), varsayılan sıralama **"tamamlanmaya en yakın önce"**. Başlık alt yazısı `${açılan}/${toplam} açıldı`. İlk açılışta başlık: **"Arşivin açıldı — N rozet zaten senindi"**, 40 ms stagger, **konfeti yok** | 46 rozette scroll akıcı mı (FlatList); tohumlama sonrası ikinci açılışta normal başlık dönüyor mu |
| 9 | `App.js` | DEĞİŞİR | Tek `Stack.Screen`: `WatchBadgesScreen`, oyun ekranlarıyla aynı blok (`headerShown: false`, `animation: "slide_from_right"`) | Geri navigasyonu, Android donanım geri tuşu |
| 10 | `screens/tabs/ProfileScreen.js` | DEĞİŞİR | `WatchLevelCard`, `StatisticsSection` ile `ProfileLists` **arasına** girer (`width: "90%"`, friendBar hizası). **Avatar halkalarına DOKUNULMAZ** | Kart hizası; scroll performansı; skeleton penceresi |
| 11 | `context/ProfileStatsContext.js` | DEĞİŞİR | **TEK SATIR**: `rankNameMovie/rankNameTv` → `` `${step} hafta` ``. `getDynamicRankColor`'ın renk üretimi ve halkalar **aynen kalır**. Yeni listener **açılmaz** | `StatisticsSection`, `StatsHeroCard`, `MovieStatisticsScreen`, `TvStatisticsScreen`'de "Rank" kelimesi hiç kalmadı mı (grep) |
| 12 | `components/AppToast.js` | DEĞİŞİR | `toastConfig`'e `badge` anahtarı + `AppBadge`'li `ToastCard` varyantı. `toastConfig` **modül düzeyinde sabit referans** kalmalı | Rozet toast'u 3 sn'de kapanıyor mu; `<Toast>` yeniden mount olmuyor mu |
| — | `docs/mimari/FIRESTORE_SCHEMA.txt` | DEĞİŞİR | Not: *"İzleme puanı v1'de hiçbir Firestore alanı yazmaz; tamamen `Lists/{uid}` alt koleksiyonlarından türetilir"* + §8.4 geçiş planı | — |
| — | `translations/tr.json` + `en.json` | DEĞİŞİR | **~24 autoI18n anahtarı** (yalnız UI dizeleri; rozet ve perde adları katalogda inline). tr/en anahtar sayısı eşitliği (bugün 1174/1174) **elle doğrulanır** | `node -e` ile anahtar sayısı diff'i sıfır mı |
| — | `ProfileGamesModule.js` + `GameStatsScreen.js` | **İSTEĞE BAĞLI** (en son) | Hiç yazılmayan, hep 0 gösteren `weeklyStreak` göstergesi kaldırılır — iki ayrı alev ikonu olmasın | Oyun kartı düzeni bozulmadı mı |

**Sıra bağımlılığı:** 1 → 2 → 3 → 4 → 5 → (6,7,8 paralel) → 9 → 10 → 11 → 12.

---

## 10. Bilerek YAPILMAYANLAR

1. **Sezon tamamlama bonusu ve sezon rozetleri.** `seasonEpisodes` üç yazma yolunda izlenen bölüm sayısına eşitleniyor; ölçüt kendi kendine referans veriyor. Ölçülemeyen bir şeye puan verilmez. Alternatif (TMDB'den tazeleyip ayrı bir "doğrulanmış hedef" alanına yazmak) sistemin en güçlü iddiasını — **sıfır yeni Firestore alanı** — bozardı.
2. **`markShow` yazma yolu düzeltmesi.** Yayındaki tek TV yazma servisinde semantik değişiklik = gerçek regresyon riski. `perdeFloor` sayesinde `episodeWatchTime` ezilmesi artık Perde kaybettiremez. **v1.1'e ertelendi.**
3. **Rank sisteminin tam emekliliği.** `getDynamicRankColor` 6 görsel yüzeyi besliyor (avatar halkaları, hero gradyanı, accent, poster çerçeveleri). Tamamını Perde'ye taşımak 6 dosyalık bir kaskad ve saf regresyon yüzeyi. v1 yalnız **etiketi** düzeltir (`"Rank 7"` → `"7 hafta"`) ve isim çakışmasını tek satırda kapatır.
4. **Sıralama / leaderboard.** Doğrulanamayan bir puan sıralanmaz. `GameLeaderboards`'ın `verified: false` durumu tekrarlanmayacak. v2'de bile ancak **sunucu hesabı + App Check** ikilisinden sonra düşünülür.
5. **Arkadaş profilinde Perde/rozet gösterimi.** Kişisel tutmak hem gizlilik regresyonunu (`privacy.lists` bypass'ı) hem hile motivasyonunu hem de `canViewLists` bağlamalı ek kodu **aynı anda** ortadan kaldırır.
6. **Firestore'a herhangi bir puan/seviye/rozet yazımı.** Oraya yazılan her alan kalıcı olarak istemci-yazılabilir kalır ve sahte bir `level: 30` alanı, hesaplanan puandan daha inandırıcı görünür — yani yazmak hile yüzeyini **büyütür**.
7. **Oyun XP'siyle birleşme.** Oyun XP'si baskı altında **beceri** ölçer ve artımlıdır (4 Firestore yerinde, append-only); Kare bir **davranış kaydını** ölçer ve tamamen türetilmiştir. Birleştirmek, ikisinden birinin saklama modelini bozmayı gerektirir. Tek köprü tek bir rozettir (`cift_kariyer`); **para birimleri arasında dönüşüm asla yoktur.**
8. **Rewatch puanı ve "tekrar izleme" rozeti.** Şemada `watchCount` yok, film `dateAdded` üzerine yazılıyor, `markShow` tarihleri eziyor. Uydurma bir rewatch metriği gerçek olmayan bir şeyi ödüllendirirdi. Çözüm şema değişikliğidir, bu sistemin kapsamı dışındadır.
9. **Tarih doğrulama.** Teknik olarak imkânsız (istemci-yazılabilir, sunucu yok). Bu yüzden savunma tespit değil **sınırlama**dır: `RITIM_TAVAN = 9000` ve tarih türevi rozetlerde rare tavanı.
10. **Push bildirimi ve Lottie kutlaması (v1'de sınırlı).** `pushNotificationsService.presentNow` çağrılmaz — izleme rozeti telefonu titretmeyi hak etmez. Konfeti yalnızca tohumlamadan **sonraki** gerçek geçişlerde, tek, geçici, `pointerEvents="none"` overlay olarak oynar.
11. **Pet ödülleri.** `PetContext`'te kilitler **bilinçli olarak kaldırılmış** ("tüm petler varsayılan olarak açık"). Petleri puana bağlamak yayınlanmış bir davranışı geri almak = regresyon.
12. **`tur_20` ve 25'lik tür tavanı.** TMDB kanonik kümesi Haber/Talk/Reality içerdiği için 20 tür pratikte ulaşılamaz bir epic'ti; tavan da hiç kullanılmayacak dekoratif bir sayıydı. Tavan **14**, en üst rozet **`tur_14` (rare)**.
13. **Ayrı bir "Arşiv Galası" ekranı.** Sessiz tohumlama + Rozetler ekranının başlık çerçevesi aynı işi bir dosya eksiğiyle ve daha iyi bir sinyal ekonomisiyle yapıyor.
14. **`UserStats/{uid}` koleksiyonunun diriltilmesi.** Ölü koleksiyon ölü kalır; v2'de puan `Lists/{uid}/score/current` altına yazılacak.
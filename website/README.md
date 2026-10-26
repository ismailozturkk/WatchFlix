# seelogd — Tanıtım sitesi + Yasal sayfalar

Statik site, build gerekmez (`firebase.json` → `hosting.public = website`).

| Dosya | İçerik |
| --- | --- |
| [index.html](index.html) | Tanıtım sayfası (hero · özellikler · planlar · SSS · son çağrı). Yalnız işaretleme; metinler JS'ten gelir |
| [site-config.js](site-config.js) | **Elle değiştirilen ayarlar:** mağaza bağlantıları, lansman tarihi, Firebase, sayaç ofseti |
| [home-i18n.js](home-i18n.js) | Tanıtım sayfasının 5 dillik metin sözlüğü (tr · en · es · pt · de) |
| [home.js](home.js) | Davranış: dil uygulama, mağaza düğmeleri, bekleme listesi, poster şeridi, animasyonlar |
| [site.css](site.css) | Tanıtım sayfası stili |
| [app-mock.js](app-mock.js) · [app-mock.css](app-mock.css) | **Etkileşimli uygulama maketi**: telefon çerçevesi, 4 sekme + CineMatch düğmesi, Film&Dizi/Eğlence/Kütüphane/Profil/Ayarlar ekranları, 9 temalı tema değişkenleri |
| [app-mock-tour.js](app-mock-tour.js) · [app-mock-tour.css](app-mock-tour.css) | "İçeride neler var" turunun ek ekranları (dizi takibi, Ne izlesem?, istatistik, sohbet, oyun, listeler, hikâye kartı, görünüm) |
| [mock-i18n.js](mock-i18n.js) | Maket metinlerinin 5 dilli sözlüğü — **uygulamanın kendi çevirilerinden** üretilir (`scripts/site-mock-i18n/gen.mjs`) |
| [site-lang.js](site-lang.js) · [lang-menu.css](lang-menu.css) | **Ortak** dil mantığı + dil menüsü (tanıtım ve yasal sayfalar kullanır) |
| [privacy.html](privacy.html) · [terms.html](terms.html) · [delete-account.html](delete-account.html) | Gizlilik / Şartlar / Hesap silme — mağaza formlarının istediği URL'ler |
| [legal.css](legal.css) · [legal.js](legal.js) | Üç yasal sayfanın ortak stili ve davranışı |
| `s-mark.png` · `s-mark-tight.png` | Uygulama ikonunun "S" harfi (wordmark ve küçük logo). `logo.png` artık kullanılmıyor |

## Diller (5)

Site, uygulamanın dilleriyle aynı beş dili bilir: **tr · en · es · pt (Brasil) · de**
(kaynak: `utils/appLanguages.js`). Hitap uygulamayla aynı: sen / tú / você / du.

- **Seçim sırası** (`site-lang.js → resolve()`): adresteki `?lang=xx` → kayıtlı tercih
  (`localStorage.wf_lang`) → tarayıcı dili → İngilizce. Parametre ayrıca kaydedilir;
  kullanıcı dili menüden değiştirince adresteki `?lang=` de güncellenir (yenilemede eski dile dönmesin).
- **Tanıtım sayfası** tam çevrilidir. Eksik anahtar İngilizceye düşer. **Yeni dil eklemek:**
  `site-lang.js` (LANGS/NAMES/SHORT) → `home-i18n.js` (sözlük) → `legal.js` (CHROME). Metin
  uzunluğunu 375 px'te ve Almanca'da (en uzun) kontrol et.
- **Yasal metinler yalnız tr/en.** es/pt/de seçiliyse İngilizce metin gösterilir; sayfanın çerçevesi
  (başlık, içindekiler, altbilgi) seçilen dildedir ve üstte o dilde bir not çıkar ("metin tr/en;
  çelişkide Türkçe esas"). **Neden çevrilmedi:** hukuki metin çevirisi hukuki inceleme ister ve her
  değişiklikte 5 kopya senkron tutulur. Çevrilirse `<section data-lang-block="xx">` ekle,
  `legal.js → BLOCK_LANGS`'e yaz, `CHROME.<dil>.note`'u sil.
- Uygulama içi bağlantılar (Ayarlar → Hakkında) `?lang=tr|en` ekler (`utils/appLanguages.legalLanguageOf`);
  es/pt/de için `en` gider. İstenirse uygulama gerçek kodu (`?lang=es`) da gönderebilir — site kabul eder.

## Mağaza bağlantıları

`site-config.js → stores`. **Şu an ikisi de boş:** düğmeler "Yakında" etiketiyle görünür ve tıklayınca
bekleme listesi kutusuna götürür. Uygulama yayına girince adresleri yaz:

```js
stores: {
  apple:  "https://apps.apple.com/app/id0000000000",
  google: "https://play.google.com/store/apps/details?id=com.smlztrk.seelogd",
}
```

- İkisi de doluysa: hero hapı "Yayında" olur, bekleme listesi kutusu ve sayaç gizlenir, son çağrıdaki
  "Haber ver" düğmesi kalkar, üst çubuktaki düğme "Uygulamayı al" olup telefona uygun mağazaya gider.
- Yalnız biri doluysa: o düğme canlı, diğeri "Yakında" kalır; bekleme listesi açık kalır.
- **Resmî rozetler:** şu an düğmeler özel çizimdir (Apple/Google logoları + metin). Apple ve Google marka
  kuralları yayın günü resmî "Download on the App Store" / "Get it on Google Play" rozetlerini ister;
  `index.html`'deki iki `.store` bloğunun (hero + son çağrı) yerine resmî görselleri koy.
- `launchDate` (isteğe bağlı): ISO biçiminde (`2026-11-20T10:00:00+03:00`) yazılırsa hap "… tarihinde
  yayında" der; `null` ise "Yakında". **Geri sayım sayacı kaldırıldı:** geçmiş tarihte sıfırlanmış sayaç
  ve "YAYINDA!" yazısı yanıltıcıydı (uygulama mağazada değilken).

## Bekleme listesi

`index.html` formu Firestore'a yazar (proje `movieandtv-2832a`):

- `waitlist/{emailHash}` — e-posta kayıtları (hash doc-id mükerrer kaydı engeller)
- `meta/waitlist` — toplam sayaç (`count`)

Yazılan alanlar **yalnızca** `{ email, createdAt, source:"landing", queueNo }`; kural bunun dışındaki
alanı reddeder (forma alan eklersen `firestore.rules`'u da güncelle). `CONFIG.baseCount` sayacın başlangıç
ofsetidir (gösterilen = ofset + gerçek kayıt). Firebase yüklenemezse artık **hata gösterilir** (eskiden
sessizce localStorage'a yazıp başarı gösteriyordu); `firebaseConfig: null` yapılırsa DEMO modu (yalnız
tarayıcı localStorage'ı) çalışır. Firestore yalnızca sayfa boşa çıkınca / form gönderilince yüklenir.

**Kaldırılanlar (21 Eki 2026):** "Kurucu üye rozeti" ve "ilk 3 ay %50 indirim" vaadi (**olmayacak**),
açılış (intro) animasyonu, geri sayım, bilet/konfeti. Kurucu rozeti ve lansman indirimi uygulama/mağaza
tarafında hâlâ iz bırakmış olabilir: `components/badges/badgeCatalog.js` (`founder`, hiçbir yerden
verilmiyor) ve Play'deki `launch-50-3m` / `launch-20-1y` teklifleri — bakınız `docs/kurulum/REVENUECAT_KURULUM.md`.
26 Tem 2026'da "SEN İSTE, BİZ YAPALIM" panosu kalktı; `featureRequests` koleksiyonundaki eski kayıtlar
Firebase Console'dan temizlenmeli (kural kaldırmak veriyi silmez).

## Tasarım notları

- **Yön:** koyu, cam yüzeyli; vurgu logodaki gradyan (turkuaz `#2ee6d6` → uygulama mavisi `#138df0` →
  mor `#8b7cf6`). Yazı tipi Schibsted Grotesk; Anton yalnızca alt bilgideki wordmark'ta.
- **Uygulama maketleri HTML/CSS çizimidir, gerçek ekran görüntüsü değil** (alt bilgide "App visuals on
  this page are illustrations" yazar). Eski mağaza ekran görüntüleri (`store/`) Temmuz tarihli, durum
  çubuğu içeriyor ve uygulama arayüzü değişti; kullanılmadı. Uygulamanın karikatür avatarları
  (`assets/avatar`) üçüncü taraf lisanslı olabileceği için kullanılmadı; avatarlar gradyan + harf.
- **Hero telefonu** (`app-mock.js`) uygulamanın sekme yapısını izler: Film&Dizi · Eğlence · Kütüphane ·
  Profil + ayrık CineMatch düğmesi; Ayarlar sekme değil, Profil'in dişlisinden açılır. Sekmeler,
  Diziler/Filmler anahtarı, Haftanın/Günün trendleri (ortalanan büyük afiş dönencesi), En çok oylanan /
  En popüler çipleri, Günün sorusu (dokununca yüzdeler), tema seçici (Ayarlar → Görünüm: aile × ton +
  Tema Stüdyosu düğmesi) ve tam ekran CineMatch'in ruh hali seçicisi ("Bana öner" → sonuçlar) tıklanır.
  Telefon 300×630 tasarım boyutunda çizilir, kap genişliğine göre `--k` ile ölçeklenir.
- **Görünüm uygulamanın 26 Eki 2026 ekran görüntülerinden ölçüldü** (736 px genişlik → 284 px ekran, ×0,386):
  tema Tema Stüdyosu'nda `#121123` + `#545DF8` tohumlarından üretilen özel tema (`studio`; açık/koyu tonlar
  `utils/themeStudio.js → deriveToneSet` ile), yazı tipleri uygulamanın rol bazlı seçimi: başlık **Denk One**,
  gövde **Nova Square**, rakam **Audiowide** (Google Fonts, `index.html`), sekme etiketleri sistem fontu.
  Varsayılan sistem fontuna dönmek için `app-mock.css`'teki `--fh/--fb/--fn`'i değiştirmek yeter.
  Afiş yolları TMDB'nin en-US afişleridir (`MOV`/`TVS`/`COL` tabloları); karttaki sınıf adları siteyle
  çakışmamalı (`.tour`, `.ok`, `.more` ve `--ink` sitede tanımlı — turnuva kartı bu yüzden `.am-hub.trn`).
  **Sekme düzeni uygulamanın o günkü çalışma ağacından alındı** (21 Eki: Hub→Eğlence, Ayarlar→Profil,
  yeni Kütüphane). Uygulama düzeni değişirse `app-mock.js` içindeki `TABS`, `PARENT_TAB` ve ilgili
  `screens.*` işlevlerini güncelle; etiketler `mock-i18n.js`'te (`mTab*`).
- **"İçeride neler var" turu** (`home.js → setupTour`): solda 9 özellik (başlık/açıklama `f<n>t/f<n>d`),
  sağda o özelliğin uygulama ekranı. Bölüm görünürken ~7 sn'de bir otomatik ilerler; listeye ya da telefona
  dokunan kullanıcı için durur, `prefers-reduced-motion`'da hiç başlamaz. Yeni özellik = `TOUR` dizisine
  satır + `app-mock-tour.js`'e `S.<ekran>` + `home-i18n.js`'e `f<n>t/d`. Altındaki "…ve çok daha fazlası"
  ızgarası `mo<n>t/d` anahtarlarından (12 kutucuk; `MORE_ICONS`) çizilir.
  "Film ve dizi takibi" ekranı uygulamanın Game of Thrones dizi detayıdır (`S.series`): 1. sezon kartına
  dokununca sezon detayı (`S.season`) açılır. Sezon/bölüm adları, özetler ve slogan TMDB'den alınmış 5 dilli
  bir anlık görüntüdür: `scripts/site-mock-i18n/tmdb-got.json` (üretici `mGot*` anahtarlarını bundan yazar).
- **Maket metinleri uygulamanın kendi çevirileridir.** `node --no-warnings scripts/site-mock-i18n/gen.mjs`
  (proje kökünden) `mock-i18n.js`'i `translations/*.json`, `utils/aiCopy`, `utils/homeSectionCopy` ve
  `screens/shared/discoverFiltersCopy`'den yeniden üretir; uygulamada olmayan metinler `SPEC`'te `T(...)`
  ile elle yazılı. Uygulamadan bir anahtar silinirse betik "EKSİK: anahtar (dil)" der.
- Güncel, başlıksız ekran görüntüleri hazır olunca ilgili maketi `<img>` ile değiştirmek istersen telefonun
  `.am-screen` içeriğini değiştir ve alt bilgideki "illüstrasyon" cümlesini kaldır.
- **Planlar bölümü** (AI kotası, arkadaş/grup/liste limitleri, Wrapped arşivi…) `utils/premiumFeatures.js`
  ve `store/play/*` açıklamasıyla AYNI olmalı; orada değişirse `home-i18n.js`'teki `plan*B` listelerini
  5 dilde güncelle. **Fiyat yazılmaz** (mağaza belirler, yerel para birimiyle gösterilir).
- Afişler TMDB'den (`image.tmdb.org`) doğrudan yüklenir; atıf alt bilgide.
- Gezinme çubuğundaki bağlantılar 940 px altında gizlenir (tek sayfa; bölümlere kaydırılır).
- Hareket azaltma tercihi (`prefers-reduced-motion`) tüm animasyonları kapatır; JS yoksa metin İngilizce
  ve statik görünür.
- **Wordmark:** alt bilgideki büyük `seelogd` inline SVG; "s" uygulama ikonunun ön planıdır
  (`assets/icon_default/android-icon-foreground.png` → `s-mark.png`), gözler imleci/dokunuşu yumuşakça
  takip eder (`home.js → setupEyes`), arada kırpar. İkon değişirse `<image>` konumu yeniden
  hesaplanmalı: PNG'nin opak bloğunu ölç (mevcut "S" bloğu x 337–671, y 280–742, tuval 1024²), S'in
  görünür dikdörtgeni 760×240 viewBox'ta **x 27,8–165,3 · y 24,0–214,0** olmalı; ölçek
  `k = 190 / S_yüksekliği`, `width = height = 1024k`, `x = 165,3 − (S_sağ+1)k`, `y = 24 − S_üst·k`
  (şu an `k ≈ 0,4104` → `x="-110.5" y="-90.9" width="420.2" height="420.2"`). `s-mark-tight.png`
  (519×519) S bloğunun etrafından kırpılıp ortalanmış sürümdür; ikon değişince onu da yeniden üret.

## Yasal sayfalar

İki dil DOM'da ayrı bloklar hâlinde durur (`<section data-lang-block="tr|en">`); `legal.js` yalnız
hangisinin görüneceğine karar verir — uzun hukuki metinde yüzlerce çeviri anahtarı tutmamak için. JS
çalışmazsa iki blok da görünür kalır. İçindekiler listesi aktif dil bloğunun `h2[id]` başlıklarından
üretilir — başlık eklerken TOC'a dokunmak gerekmez, sadece `id` ve (isteğe bağlı) kısa `data-toc` ver.
Sayfa çerçevesi için işaretleme: `<body data-page="privacy|terms|delete">`, `#langMenu`, `#barPage`,
`#tocTitle`, altbilgi bağlantılarında `data-nav`.

> **Metni değiştirdiğinde:** `Yürürlük` / `Son güncelleme` / `Sürüm` damgasını ve gizlilik/şartlar
> sayfalarının sonundaki "Sürüm geçmişi" satırını güncelle. Üç sayfa uygulamanın gerçek davranışına
> bağlı — bir özellik veri toplamaya/göndermeye başlıyorsa (yeni koleksiyon, analitik, üçüncü taraf,
> izin) aynı PR'da `privacy.html`, silme kapsamı değişiyorsa `delete-account.html` (ve
> `services/accountService.js` başlık listesi), plan/limit değişiyorsa `terms.html` güncellenmeli.
> Mağaza formu karşılığı: `docs/kurulum/PLAY_DATA_SAFETY.md`. Yeni bir boşluk bırakırsan
> `<mark class="todo">` kullan; tarayıcıda amber renkte görünür.
>
> **Güncel damgalar (21 Eki 2026):** gizlilik **1.3**, şartlar **1.2**, hesap silme 21 Eki. 1.3/1.2
> şunları ekledi: arkadaş daveti + promosyon kodu (veri modeli ve silme davranışı
> `functions/referral.js` + `cleanupReferralOnUserDeleted`; davet edenin davetliyi nasıl gördüğü
> `getReferralOverview`), Firebase App Check, yapıştırılan/paylaşılan IMDb–TMDB bağlantısı, cihazda kalan
> yeni veriler. **Bilinen sapma:** promosyon kodunun `redemptions/{uid}` kaydı hesap silinince
> SİLİNMİYOR (sayfalar bunu açıkça yazıyor); silinmesi istenirse `cleanupReferralOnUserDeleted`a
> collectionGroup sorgusu eklenmeli (functions deploy) ve üç sayfadaki cümle kalkmalı.

## Firestore kuralları

Kurallar tek kaynakta: kökteki [firestore.rules](../firestore.rules) → "Landing sitesi" bölümü
(`waitlist`, `meta/waitlist`). Kural değişikliğini yalnız orada yap.

- `waitlist` üzerinde **`get` açık, `list` kapalı.** Doküman kimliği `base64(email)` ve `email` alanı düz
  metin olduğundan koleksiyon listeleme açık olsa herkes tüm bekleme listesini dökebilirdi. Site yalnızca
  kendi kaydını tek doküman olarak okur, o yüzden bu ayrım siteyi bozmaz.
- Sayaç `meta/waitlist` okumaya açıktır ve yalnız `+1` artırılabilir.
- Bu uçlar anonim yazıma açıktır (bekleme listesi doğası gereği). Spam'e karşı Firebase **App Check**
  etkinleştirilmesi önerilir.

## Yayınlama (Firebase Hosting)

```bash
firebase deploy --only hosting            # yalnız site
firebase deploy --only firestore:rules,hosting   # kural da değiştiyse
```

HTML/JS/CSS `no-cache`, görseller 7 gün önbellekte (`firebase.json`). Lansman günü e-posta göndermek için
`waitlist` koleksiyonunu CSV dışa aktarıp (Console → Export) bir e-posta servisine yükleyebilirsin.

# seelogd — Tanıtım sitesi + Yasal sayfalar

Statik site, build gerekmez (`firebase.json` → `hosting.public = website`).

| Dosya | İçerik |
| --- | --- |
| [index.html](index.html) | Tanıtım sayfası (hero · özellikler · planlar [beta süresince gizli] · SSS · son çağrı). Yalnız işaretleme; metinler JS'ten gelir |
| [site-config.js](site-config.js) | **Elle değiştirilen ayarlar:** mağaza bağlantıları, lansman tarihi, planların görünürlüğü (`showPlans`), Firebase, sayaç ofseti |
| [home-i18n.js](home-i18n.js) | Tanıtım sayfasının 12 dillik metin sözlüğü (tr · en · es · pt · de · it · fr · ja · zh · hi · id · ko) |
| [home.js](home.js) | Davranış: dil uygulama, mağaza düğmeleri, bekleme listesi, poster şeridi, animasyonlar |
| [site.css](site.css) | Tanıtım sayfası stili |
| [app-mock.js](app-mock.js) · [app-mock.css](app-mock.css) | **Etkileşimli uygulama maketi**: telefon çerçevesi, 4 sekme + CineMatch düğmesi, Film&Dizi/Eğlence/Kütüphane/Profil/Ayarlar ekranları, 9 temalı tema değişkenleri |
| [app-mock-tour.js](app-mock-tour.js) · [app-mock-tour.css](app-mock-tour.css) | "İçeride neler var" turunun ek ekranları (dizi takibi, Ne izlesem?, istatistik, sohbet, oyun, listeler, hikâye kartı, görünüm) |
| [mock-i18n.js](mock-i18n.js) | Maket metinlerinin 12 dilli sözlüğü — **uygulamanın kendi çevirilerinden** üretilir (`scripts/site-mock-i18n/gen.mjs`) |
| [site-lang.js](site-lang.js) · [lang-menu.css](lang-menu.css) | **Ortak** dil mantığı + dil menüsü (tanıtım ve yasal sayfalar kullanır) |
| [privacy.html](privacy.html) · [terms.html](terms.html) · [delete-account.html](delete-account.html) | Gizlilik / Şartlar / Hesap silme — mağaza formlarının istediği URL'ler |
| [legal.css](legal.css) · [legal.js](legal.js) | Üç yasal sayfanın ortak stili ve davranışı |
| [site-beacon.js](site-beacon.js) | Çerezsiz ziyaret sayacı (dört genel sayfada; `admin.html`'de YOK) → `/api/beacon` |
| [admin.html](admin.html) · [admin.js](admin.js) · [admin.css](admin.css) · [admin-stats.js](admin-stats.js) | **Yönetim paneli** (`/admin`): Genel bakış (önceki döneme kıyaslı KPI, eğilim, huni, otomatik öne çıkanlar), Trafik ve kaynaklar (kaynak başına ilgi/dönüşüm, kampanya), Kitle (ülke, cihaz, tarayıcı, dil, ekran), Davranış (gün×saat ısı haritası, kaydırma, bölüm, etkileşim), Kayıtlar ve dönüşüm (kaynak/ülke/cihaz bazında kayıt, form sonuçları), beta testçileri, bekleme listesi, özellik oyları. Veri yalnız günlük toplam (`functions/siteStats.js`). Arama motorlarına kapalı |
| `lens-mark.svg` · `favicon.svg` · `favicon.ico` · `apple-touch-icon.png` · `og-image.png` | Lens logosu (5 Kas 2026): üst çubuk/altbilgi işareti, sekme simgesi, paylaşım görseli. Kaynak `marketing/marka/yeni-logo/lens`; altbilgideki büyük logo `index.html` içinde satır içi SVG (göz kırpar, bebek imleci izler: `home.js → setupEyes`). Eski "S" görselleri kaldırıldı |

## Diller (12)

Site 12 dili destekler: **tr · en · es · pt (Brasil) · de · it · fr · ja · zh · hi · id · ko**.

- **Seçim sırası** (`site-lang.js → resolve()` / `detect()`): adresteki `?lang=xx` → kayıtlı tercih
  (`localStorage.wf_lang`) → izin istemeyen istemci sinyalleriyle otomatik algılama (birincil telefon/tarayıcı
  dili `navigator.languages[0]` → tercih listesindeki diğer diller → BCP-47 bölge alt etiketi `REGION_LANG`
  [`en-TR`, `mr-IN`, `jv-ID`, `ca-ES` vb.] → IANA saat dilimi `TZ_LANG` [`Intl.DateTimeFormat().resolvedOptions().timeZone`])
  → varsayılan **İngilizce (`en`)**. Parametre ayrıca kaydedilir; kullanıcı dili menüden değiştirince adresteki
  `?lang=` de güncellenir (yenilemede eski dile dönmesin).
- **Tanıtım sayfası ve etkileşimli maket** 12 dilde tam çevrilidir. Eksik anahtar İngilizceye düşer. **Yeni dil eklemek:**
  `site-lang.js` (LANGS/NAMES/SHORT/REGION_LANG/TZ_LANG) → `home-i18n.js` (sözlük) → `mock-i18n.js` (maket sözlüğü) → `legal.js` (CHROME).
- **Yasal metinler 8 dilde** (uygulamanın dilleri): tr · en · es · pt · de · it · fr · ja (14 Kas 2026; gizlilik 1.10,
  şartlar 1.4). Her dil aynı dosyada bir `<section data-lang-block="xx">` bloğudur; başlık kimlikleri `xx-1…`,
  silme şablonu `tpl-xx`. Türkçe dışındakiler çeviridir, çelişkide Türkçe esastır (metinde "Dil" paragrafı +
  üstte `CHROME.<dil>.note`). zh/hi/id/ko seçiliyse İngilizce blok gösterilir ve o dilde "henüz bu dilde yok" notu çıkar.
  **Metin değişince 8 blok da güncellenmeli** (sürüm, tarih, geçmiş). Yeni dil: blok ekle → `legal.js → BLOCK_LANGS`
  → `CHROME.<dil>.note` → uygulamada `legalLang: "xx"`.
- Uygulama içi bağlantılar (Ayarlar → Hakkında) `?lang=<uygulama dili>` ekler (`utils/appLanguages.legalLanguageOf`);
  8 uygulama dilinin hepsi kendi blokunu açar.

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
- `launchDate` (isteğe bağlı, şu an `2027-01-01T00:00:00+03:00`): ISO biçiminde yazılırsa hero'da
  **"Tahmini çıkış" geri sayımı** çıkar (gün/saat/dk/sn + "biraz önce ya da sonra olabilir" notu; tarih
  İstanbul saatiyle yazılır). Tarih geçince, mağaza bağlantısı girilince ya da `null` iken sayaç gizlenir —
  geçmiş tarihte "YAYINDA!" diyen eski sayacın hatası tekrarlanmaz. Metinler home-i18n.js `cd*`.

## Görsel bölümler (6 Kas 2026)

Kullanıcı isteği: "ziyaretçi yazı okumaz; kompakt, görsel, animasyonlu, videolu olsun; uzun metin dokununca açılsın".

- **Gerçek ekranlar** (`#screens`, `home.js → REEL / setupReel`): kapalı test iPhone kayıtları telefon çerçevesinde,
  sessiz döngü. Video yalnız görünürken yüklenir/oynar (`preload="none"` + IntersectionObserver); hareket azaltma
  açıksa oynamaz, ayrıntı penceresinde denetimli açılır. Kartta yalnız başlık; açıklama `peek` penceresinde.
- **…ve çok daha fazlası** (`home.js → MORE`): 4 sütunlu bento. 8 döşeme kapalı test ekranından kırpım
  (`media/t-*.webp`, 2 satır), 8 döşeme hareketli simge (`ani-*` CSS). Açıklama yalnız `peek` penceresinde.
- **Ayrıntı penceresi** (`<dialog id="peek">`): masaüstünde ortada, telefonda alttan sayfa; Esc / arka plana
  dokunma kapatır, odak açan karta döner.
- **Rakamlar bandı** görünür olunca sayarak yükselir (`setupCountUp`).
- **Medya** (`website/media/`, toplam ~4,8 MB, hepsi tembel): kaynak
  `marketing/sosyal-medya/kaynak/img/ekranlar/iphone/` (rötuşlu ekranlar + K02/K04/K05/K07/K09/e-arama kayıtları;
  K01/K08/K10 KULLANILMAZ — gerçek kişi fotoğrafı / Türkçe toast / Türkçe klavye). Durum çubuğu (üst 150 px)
  kırpılır; videolar 432 px genişlik, H.264 CRF 29, 30 fps, sessiz, faststart; poster `.webp`.
  Üretici betik oturum scratchpad'indeydi (`media_build.py`: ffmpeg-static + Pillow); yeniden üretmek için
  aynı ayarlar yeterli. `mp4` de görseller gibi 7 gün önbellekte (`firebase.json`).
- Alt bilgi notu değişti: "etkileşimli önizlemeler çizimdir; videolar ve ekran görüntüleri kapalı testten".

## Katılım kartı (hero): haber ver | beta

6 Kas 2026'dan beri tek kart, hero'da ve mağaza düğmelerinin ÜSTÜNDE (`#notify`, `home.js → setupJoin`).
Aynı gün kompaktlaştı: iki yol tek satırlık bölümlü düğme, sayaç düğmenin yanında, platform seçimi küçük haplar,
ipucu yalnız platform seçilince; uzun bilgilendirme metinleri (`formNote`, `betaSub`, `betaNote`) "Ayrıntılar"
(`details.join-more`) altında, görünür satırda kilit simgesi + "Yalnız bunun için kullanılır · spam yok". Eski ayrı
"Test kullanıcısı ol" bölümü (`section#beta`, sayfanın altında kalıyordu) kaldırıldı. İki sekme:

- **Yayınlanınca haber ver** (`#paneNotify`) → yalnız bekleme listesi (aşağıda).
- **Beta'yı şimdi dene** (`#betaCard`) → platform + e-posta → `betaTesters` kaydı, **ardından aynı e-posta bekleme
  listesine de yazılır** (yayın günü haber alsın; sıra no beta başarı kartında görünür). Bekleme listesi adımı
  başarısız olursa beta kaydı yine geçerlidir. Beta notu (`betaNote`, 5 dil) bunu açıkça söyler.
- `seelogd.com/#beta` (Instagram bio'su bu adresi kullanıyor), üst çubuktaki "Beta" ve son çağrıdaki "Beta'yı dene"
  (`data-join="beta"`) beta sekmesini açar; `#beta` artık kartın hemen üstündeki boş bir çapa. Yükleme sırasında
  yumuşak kaydırma kesildiği için `#beta` ile gelişte `load` sonrası anında kaydırılır.
- Kurallar değişmedi: bekleme listesine beta'dan gelen kayıt da `source:"landing"` ile yazılır (kural yalnız bunu kabul
  ediyor). Ayırt etmek istenirse kural + admin paneli birlikte güncellenmeli.
- Tarayıcıda deneme: `window.SITE_CONFIG.firebaseConfig = null` yapıp formu gönder → gerçek Firestore yerine
  localStorage (`wf_beta`, `wf_emails`; bu iki anahtar YALNIZ demo modunda yazılır).
- Yinelenen kayıt: site kaydı OKUMAZ (kural), doğrudan `setDoc` yapar; var olan belge update sayılıp reddedilir
  (`permission-denied`) ve bu "zaten listede" diye gösterilir. Sıra numarası o zaman yalnız bu tarayıcının
  biletinden gelir; yoksa rozet gizlenir.

## Gizlilik (6 Kas 2026)

- **Tarayıcıda e-posta saklanmaz.** `wf_ticket` = `{ m: "is•••@gmail.com", h: <FNV-1a özeti>, queueNo }`,
  `wf_beta_ticket` = `{ m, h, platforms }`. `h` yalnız "aynı adres mi?" karşılaştırması için. Eski düz e-postalı
  biletler `readTicket()` ile ilk okumada dönüştürülür. "Başka cihaz" düğmesi e-postayı önceden doldurmaz.
- **Yazı tipleri kendi sunucumuzda** (`fonts/`, yalnız latin + latin-ext woff2, `fonts/OFL.txt` lisans). Google
  Fonts'a hiçbir sayfadan istek gitmez (ziyaretçi IP'si Google'a aktarılmasın — AB'de bilinen dava konusu).
  Yeni aile/ağırlık gerekirse: Google Fonts css2 adresini masaüstü Chrome kullanıcı ajanıyla indir, yalnız
  `latin`/`latin-ext` bloklarını al, woff2'leri `fonts/`'a koy, `fonts.css`'e ekle, OFL metnini `OFL.txt`'ye ekle.
- **`*.md` yayınlanmaz** (`firebase.json → hosting.ignore`): bu README de dahil, eskiden seelogd.com/README.md açıktı.
- **Güvenlik başlıkları** (`firebase.json`, tüm yollar): `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin` (Firebase API anahtarı yönlendiren kısıtlıysa `same-origin` onu bozar),
  `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`, `Permissions-Policy`.
  Tam CSP (script-src vb.) bilerek yok: gstatic Firebase modülleri, Firestore, TMDB görselleri ve satır içi
  stil/JSON-LD için ayrıca test gerekir.
- Hâlâ üçüncü taraflara giden istekler (gizlilik politikasında yazılı): TMDB görsel sunucusu (afiş şeridi ve
  maket), Google (`www.gstatic.com` Firebase modülleri + Firestore; sayaç boşta okunduğu için her ziyaret).
- `site-config.js`'teki `measurementId` kaldırıldı (sitede Analytics yok).

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
  gövde **Nova Square**, rakam **Audiowide** (`fonts/fonts.css`, kendi sunucumuzdan), sekme etiketleri sistem fontu.
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
- **Planlar bölümü beta süresince GİZLİ (6 Kas 2026, kullanıcı kararı):** uygulama daha kapalı testte ve
  siteyi ilk açan kişiye ücretli bir uygulama gibi görünmesin. `site-config.js → showPlans: false`;
  bölüm ve iki "Planlar" bağlantısı `data-plans hidden` taşır (JS'siz de gizli; `site.css` sonundaki
  `[data-plans][hidden]` kuralı bağlantıların `display`'ını ezer). `true` yapınca olduğu gibi geri gelir.
  Aynı gün sayfadaki ücret çağrışımları da kalktı: "Ücretsiz başla" çipi → "Kapalı testte", meta açıklama,
  SSS "ücretsiz mi?" cevabı (Premium'a yönlendirmeden yalnız ücretsiz olanları sayar) ve maketteki Premium
  izleri (Ayarlar'daki Premium kartı, profildeki Premium hapı, CineMatch başlığındaki "Premium ·").
  Planları açarken bunları da geri getirmek gerekip gerekmediğine bak.
- **Planlar bölümü** (AI kotası, arkadaş/grup/liste limitleri, Wrapped arşivi…) `utils/premiumFeatures.js`
  ve `store/play/*` açıklamasıyla AYNI olmalı; orada değişirse `home-i18n.js`'teki `plan*B` listelerini
  5 dilde güncelle. **Fiyat yazılmaz** (mağaza belirler, yerel para birimiyle gösterilir).
- Afişler TMDB'den (`image.tmdb.org`) doğrudan yüklenir; atıf alt bilgide.
- Gezinme çubuğundaki bağlantılar 940 px altında gizlenir (tek sayfa; bölümlere kaydırılır).
- Hareket azaltma tercihi (`prefers-reduced-motion`) tüm animasyonları kapatır; JS yoksa metin İngilizce
  ve statik görünür.
- **Wordmark:** alt bilgideki büyük logo, Lens yatay logosunun (`marketing/marka/yeni-logo/lens/svg/lens-yatay-koyu-zemin.svg`) satır içi kopyasıdır: iki daire, kesişimde göz, Sora `seelogd` yazısı (yol olarak, yazı tipi yüklenmez). Göz arada kırpar (`.sl-eye`, kendi merkezinde scaleY), bebek imleci/dokunuşu yumuşakça izler (`home.js → setupEyes`; `data-cx/cy` viewBox koordinatı, `data-max` en fazla kayma). viewBox 0 kökenli olmalı: `setupEyes` imleci viewBox başlangıcını hesaba katmadan çevirir, bu yüzden çizim `translate(-124 -64)` içinde.

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
> **4 Kas 2026:** gizlilik **1.5** (beta formu + çerezsiz site istatistiği).
>
> **Önceki damgalar (21 Eki 2026):** gizlilik **1.3**, şartlar **1.2**, hesap silme 21 Eki. 1.3/1.2
> şunları ekledi: arkadaş daveti + promosyon kodu (veri modeli ve silme davranışı
> `functions/referral.js` + `cleanupReferralOnUserDeleted`; davet edenin davetliyi nasıl gördüğü
> `getReferralOverview`), Firebase App Check, yapıştırılan/paylaşılan IMDb–TMDB bağlantısı, cihazda kalan
> yeni veriler. **Bilinen sapma:** promosyon kodunun `redemptions/{uid}` kaydı hesap silinince
> SİLİNMİYOR (sayfalar bunu açıkça yazıyor); silinmesi istenirse `cleanupReferralOnUserDeleted`a
> collectionGroup sorgusu eklenmeli (functions deploy) ve üç sayfadaki cümle kalkmalı.

## Rakamlar bandı

Poster şeridinin altındaki altı sayı (`index.html` → `.numbers`) uygulamanın kodundan sayıldı (4 Kas 2026, 6 Kas'ta oyun ve simge güncellendi);
uygulama değişince elle güncelle — etiketler `home-i18n.js` `num1–6`:

| Sayı | Kaynak |
| --- | --- |
| 1M+ film ve dizi | TMDB kataloğu (yaklaşık) |
| 16 oyun ve etkinlik | Sahne Tahmin, Poster Bulmaca, Bulanık Afiş, Önce hangisi?, Hangisinin puanı daha yüksek? (5 Kas), Günün Karesi, Film Zinciri, Günün Sorusu, günlük düello, Sinema Bingosu, Meydan Okumalar, CineSwipe, aylık turnuva, Top 100, Haftalık Lig, tier list |
| 158 rozet | `components/badges/watchBadgeCatalog.js` (`__tests__/watchBadgeCatalog.test.js` sayıyı sabitler) |
| 56 yazı tipi | `utils/premiumFeatures.js → FONT_CATALOG_SIZE` |
| 6 uygulama simgesi | `utils/appIcons.js → APP_ICONS` (5 Kas: 3 Lens + 3 S) |
| 12 dil | `website/site-lang.js` (tr · en · es · pt · de · it · fr · ja · zh · hi · id · ko) |

Planlar bölümü ve "…ve çok daha fazlası" (16 kutucuk, `home.js → MORE_ICONS` sırasıyla `mo1–16`) da aynı gün
`utils/premiumFeatures.js` ve `store/play/*/full-description.txt` ile eşitlendi.

**6 Kas 2026 güncellemesi** (4 Kas'tan sonra gelenler): tier list akışta paylaşım (`mo1d`), Meydan Okumalar'ın
genişlemesi: 59 yönetmen + 43 oyuncu (`mo5d`), "Takvim senkronu" kutucuğu yerine **Bölüm grafiği** (`mo14`,
simge `bars`; takvim zaten `f7d`'de), CineMatch cevabını sohbette paylaşma (`f3d`), "Hangisinin puanı daha yüksek?"
oyunu (`f6d`), titreşim ayarları + oyuncu/yönetmen fotoğrafını avatar yapma (`f9d`). Maketteki rozet sayacı 57/158.

## Ziyaret istatistiği ve yönetim paneli

**Toplama** — `site-beacon.js` her sayfa açılışında `/api/beacon`'a (Hosting rewrite → `functions/index.js →
siteBeacon`) tek bir sayım olayı, sekme gizlenince de görünür kalınan süreyi gönderir. Sunucu yalnız **günlük
toplam** yazar: `siteStats/{YYYY-MM-DD}_{0-3}` (gün İstanbul saatiyle; 4 parça, tek belgeye saniyede ~1 yazma
sınırı yüzünden). Model ve alanlar `functions/siteStats.js` başında. Gizlilik kararları:

- Çerez, kimlik ve IP kaydı **yok**; ülke tarayıcının **saat diliminden** tahmin edilir (`TZ_COUNTRY`, bilinmeyen → `XX`).
- Tarayıcıda yalnız `localStorage.wf_visit` (son ziyaret günü) ve `sessionStorage.wf_session` tutulur.
- Do Not Track / Global Privacy Control açıksa, bot kimliğinde ve `localhost`'ta hiç sayılmaz.
- Pazarlama bağlantılarına `?utm_source=instagram` eklersen "Nereden geldi" listesinde o ad görünür.
- `privacy.html` 1.5 bunu anlatıyor; toplanan alanı değiştirirsen orayı da güncelle.

**Panel** (`https://seelogd.com/admin`) — Google ya da e-posta/şifreyle giriş; yetki tamamen
`firestore.rules → isSiteAdmin()` (`siteAdmins/{uid}` belgesi var mı). Panel hiçbir şey yazmaz.

- *Genel bakış:* son 7 günlük trafik ve yeni kayıt özeti, en yoğun gün ve bölümlere hızlı geçiş. Günlük tekil
  ziyaretçilerin toplamı, dönem boyunca tekil kişi sayısı olarak sunulmaz.
- *Ziyaretler:* bugün/7/30/90 gün; ziyaretçi, yeni ziyaretçi, oturum, görüntüleme, ortalama kalma süresi;
  günlük grafik; ülke, yönlendiren, cihaz, işletim sistemi, dil, sayfa, saat dağılımı.
- *Beta testçileri / Bekleme listesi:* arama, platform ve tarih süzgeci, sıralama, 25 satırlık sayfalama,
  "E-postaları kopyala" (Play Console / TestFlight test kullanıcısı kutusuna yapıştırmak için virgüllü)
  ve CSV (Excel için BOM'lu; formül enjeksiyonu kaçışlı). Kopyalama ve CSV, sayfadan bağımsız olarak etkin
  filtredeki tüm kayıtları içerir.

**Kurulum (bir kez):**
1. Kuralları, fonksiyonu ve siteyi yayınla (sıra önemli: kural → fonksiyon → hosting):
   `firebase deploy --only firestore:rules` → `firebase deploy --only functions:siteBeacon` → `firebase deploy --only hosting`.
2. `/admin`'e uygulamadaki hesabınla gir; "yönetici değil" ekranındaki UID'yi kopyala.
3. Firebase Console → Firestore → `siteAdmins` koleksiyonu → belge kimliği = o UID (alan gerekmez; `note` yazılabilir).
4. Google ile giriş açılmazsa: Firebase Console → Authentication → Settings → Authorized domains'e `seelogd.com` ekli olmalı.

## Firestore kuralları

Kurallar tek kaynakta: kökteki [firestore.rules](../firestore.rules) → "Landing sitesi" bölümü
(`waitlist`, `meta/waitlist`). Kural değişikliğini yalnız orada yap.

- `waitlist` ve `betaTesters`: **`get` ve `list` yalnız site yöneticisine** (`isSiteAdmin`, 6 Kas 2026'dan beri).
  Doküman kimliği `base64(email)` olduğu için açık `get`, adresi bilen herkese "bu kişi listede mi, hangi
  platformda, kaçıncı sırada" sorusunu cevaplatıyordu. Site artık okumaz; yinelenen yazma reddedilir (yukarıda).
- `siteStats` yalnız yöneticiye okunur, kimse yazamaz (yalnız `siteBeacon`, Admin SDK). `siteAdmins/{uid}`'i
  kişi yalnız kendisi için okuyabilir; kimse yazamaz (Console'dan elle açılır).
- Sayaç `meta/waitlist` okumaya açıktır ve yalnız `+1` artırılabilir.
- Bu uçlar anonim yazıma açıktır (bekleme listesi doğası gereği). Spam'e karşı Firebase **App Check**
  etkinleştirilmesi önerilir.

## Yayınlama (Firebase Hosting)

```bash
firebase deploy --only hosting            # yalnız site
firebase deploy --only firestore:rules,hosting   # kural da değiştiyse
```

HTML/JS/CSS `no-cache`, görseller ve woff2 7 gün önbellekte (`firebase.json`). Kural ve site birlikte
değişiyorsa ÖNCE hosting, SONRA kural: yeni istemci eski kuralla çalışır, tersi bir süre formu bozar. Lansman günü e-posta göndermek için
`waitlist` koleksiyonunu CSV dışa aktarıp (Console → Export) bir e-posta servisine yükleyebilirsin.

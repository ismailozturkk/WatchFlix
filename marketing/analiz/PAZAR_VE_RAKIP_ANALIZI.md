# Pazar ve rakip analizi

Son güncelleme: **2 Kasım 2026**

Sayılar üçüncü taraf kaynaklardan alındı ve mağazalardan doğrulanmadı. Rakip fiyatları değişebilir.

## Özet

- Pazarda iki fırsat var: **TV Time'ın boşluğu** ve **film ile diziyi birlikte sunan sosyal uygulama ihtiyacı**.
- TV Time fırsatının en sıcak dönemi geçti; Bingers aynı kitleyi hedefliyor.
- seelogd'un farkı özellik genişliği, ama yalnızca bunu anlatmak yetmez. Tek ve akılda kalan bir giriş nedeni gerekir.
- En büyük iç risk, pazarlamada öne çıkan oyun ve arkadaş özelliklerinin Free planda çok sınırlı olması.

## Rakipler

| Uygulama | Güçlü yanı | Zayıf yanı veya boşluk | Fiyat | Kaynak güveni |
|---|---|---|---|---|
| **Letterboxd** | Dev film topluluğu; 2026 2. çeyrek sonunda 30,7 milyon üye olduğu bildiriliyor | Dizi takibi yok | Pro yaklaşık $19/yıl, Patron yaklaşık $49/yıl | Orta |
| **Bingers** | TV Time kurucusu; ücretsiz; sosyal; TV Time dosyasını içe aktarıyor | İlk yorumlarda liste düzeni ve arayüz eleştirisi | Ücretsiz çıktı | Orta |
| **Trakt** | Güçlü takip, ekosistem | 2025'te VIP fiyat artışı tepki çekti | VIP $60/yıl (2025 verisi) | Düşük, forum kaynaklı |
| **Simkl** | Dizi ve anime takibi, TV Time içe aktarma | Fiyat doğrulanmadı | Doğrulanmadı | Düşük |
| **Serializd** | "Dizilerin Letterboxd'u" | Web öncelikli olduğu söyleniyor | Doğrulanmadı | Düşük |
| **Moviebase, Showly, SeriesGuide** | Takipte sade araçlar | Sosyal ve oyun tarafı sınırlı görünüyor | Doğrulanmadı | Düşük |

**TV Time:** 15 Temmuz 2026'da kapandı. Appfigures'a göre 26,4 milyonu aşan toplam kurulum ve kapanış öncesi 30 günde yaklaşık 29 bin indirme vardı. Kullanıcıların nereye geçtiğine dair ölçüm bulunamadı.

## seelogd nerede duruyor

| | Letterboxd | Bingers | Trakt | seelogd |
|---|---|---|---|---|
| Film takibi | ✓ | ✓ | ✓ | ✓ |
| Bölüm bazında dizi | ✗ | ✓ | ✓ | ✓ |
| Arkadaş ve sohbet | Doğrulanmadı | Sosyal odaklı, sohbet doğrulanmadı | Doğrulanmadı | ✓ |
| Film oyunları | Doğrulanmadı | Doğrulanmadı | Doğrulanmadı | ✓ (ücretli) |
| AI öneri | Doğrulanmadı | Doğrulanmadı | Doğrulanmadı | ✓ |
| Letterboxd içe aktarma | - | Doğrulanmadı | Doğrulanmadı | ✓ |
| TV Time içe aktarma | ✗ | ✓ | ✓ | ✗ |
| Türkçe | Doğrulanmadı | Doğrulanmadı | Doğrulanmadı | ✓ |

## SWOT

**Güçlü**
- Film, dizi, sosyal, AI ve oyun tek uygulamada
- Görsel olarak güçlü, paylaşılabilir Wrapped ve kart sistemi
- Reklam yok, veri satışı yok
- 5 dil
- Düşük fiyat: Premium yıllık $14.99, Letterboxd Pro'nun altında

**Zayıf**
- Marka ve kullanıcı tabanı sıfıra yakın; sosyal uygulama için büyük engel
- Oyunlar ve CineSwipe Free'de kapalı, Free'de 2 arkadaş sınırı
- Çok fazla özellik; tek cümlede anlatmak zor
- İngilizce ekranlarda Türkçe tür adları görünüyor
- Tek geliştirici; içerik ve destek zamanı sınırlı

**Fırsat**
- Aralık başındaki Wrapped dalgası
- TV Time'dan ayrılıp hâlâ yer arayanlar
- Türkçe film ve dizi uygulamasında yerel konum (rekabet ayrıca ölçülmeli)
- Portekizce ve İspanyolca kitleler; TV Time kapanışı bu dillerde de geniş yer buldu
- Oscar dönemi içerikleri

**Tehdit**
- TMDB ticari lisans koşulları ve olası maliyet
- Telifli afişlerle reklam reddi veya şikâyet
- Büyük oyuncuların aynı özellikleri eklemesi
- Ani trafikte kapasite: Cloud Run 20 vCPU kotası, App Check zorunlu olunca Play Integrity 10.000/gün kotası

## Hedef kitleler

Bunlar varsayımdır, gerçek veriyle güncellenecek.

| Kitle | Neden gelir | Mesaj | Kanal |
|---|---|---|---|
| Dizi takipçisi, 18-30 | Kaldığı bölümü unutmamak | Never lose your place | TikTok, Instagram |
| Letterboxd kullanıcısı | Diziyi de aynı yerde görmek | Bring your history, add your shows | Reddit, X |
| Eski TV Time kullanıcısı | Yeni bir yuva | Episode tracking and friends | Reddit, site sayfası |
| Arkadaş grubu | Film gecesi kararı | Decide together | Threads, Instagram |
| Anime izleyicisi | Uzun serileri takip | Save your place in every series | TikTok, Reddit |
| Türkiye'deki izleyici | Türkçe, yerel fiyat | Film ve dizi hayatın tek yerde | Ayrı dalga |

## Konumlandırma önerisi

Ana giriş nedeni olarak **"kaldığın yeri unutma, izlediklerini tek yerde gör"** kullanılmalı; oyun ve AI ikinci adımda gelmeli. Takip Free planda açık olduğu için vaat ile deneyim uyuşur. Görsel olarak en paylaşılabilir parça ise Wrapped.

## Kaynaklar

- [TechCrunch: TV Time kapanıyor](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai)
- [MacRumors: TV Time kapanışı](https://macrumors.com/2026/07/02/show-tracking-app-tv-time-shutting-down)
- [AlternativeTo: TV Time alternatifleri](https://alternativeto.net/news/2026/7/tv-time-is-shutting-down-its-service-on-july-15-2026-here-are-some-great-replacements/)
- [Clubic: Bingers ve ilk yorumlar](https://clubic.com//actualite-624286-tv-time-a-ferme-mais-cette-nouvelle-appli-peut-recuperer-votre-historique.html)
- [Roams: Bingers ücretsiz çıktı](https://roams.es/actualidad/telefonia/bingers-promete-no-repetir-errores-tv-time-ya-disponible-gratis/)
- [Letterboxd: ücretli planlar](https://letterboxd.com/about/pro/)
- [App Pricing Lab: Letterboxd fiyatları](https://www.apppricinglab.com/iap/apple/1054271011)
- [Law Commentary: Letterboxd satış haberi ve üye sayısı](https://www.lawcommentary.com/articles/a24-new-york-times-letterboxd-300-million-sale)
- [Lemmy: Trakt VIP fiyat tartışması](https://lemmy.klein.ruhr/post/95343/480007)
- [Moviebase: Serializd karşılaştırması](https://moviebase.app/resources/moviebase-vs-serializd)

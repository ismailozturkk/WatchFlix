# Geliştirme Rehberi — Sade Anlatım (senin için)

Bu belge, 31 Ekim 2026 güvenlik + performans denetiminden çıkan **yapılacaklar listesidir**, günlük dille. Aynı maddelerin teknik/ajan sürümü: `GELISTIRME_REHBERI_CLAUDE.md`. Teknik detay: `DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md`.

**Önce iyi haber:** Uygulaman güvenlik açısından iyi durumda. Kritik bir açık yok. Anahtarlar sunucuda saklı, abonelik sunucuda doğrulanıyor, kurallar sahtekârlığı (başkasının adına mesaj, puan şişirme, kendini premium yapma) engelliyor. Aşağıdakiler "yangın" değil, "daha sağlam ve ölçeklenebilir yapmak" için.

Her madde şu düzende: **Ne sorun · Neden önemli · Ne yapılmalı · Zorluk/risk.**

---

## 📌 NOTLAR — 31 Ekim gecesi durumu (kalktığında buradan başla)

**Kodda yapılabilecek her madde bitti ve commit'lendi** (dalda: `codex/release-candidate-1.4.3`). **Hiçbir şey push'lanmadı, yayına (deploy) alınmadı.** Testler: uygulama 8.130/8.130, kurallar 363/363, sunucu 116 geçti / 0 başarısız.

### ✋ Senin yapacakların
1. **Yayına alma (deploy) — sırası önemli:**
   1. `firebase deploy --only firestore:rules,functions`
   2. Sonra uygulamanın yeni sürümü (build).

   Ters sırada olursa yeni sürümde Günün Sorusu oyu ve arkadaş araması çalışmaz.
   ⚠️ Kural dosyası bütün olarak gider. Başka oturumların henüz yayınlanmamış kuralları (Haftalık Lig vb.) da onunla birlikte yayına çıkar. Fonksiyonlar da çalışma klasöründen gider: commit'lenmemiş lig kodu dahil. Bunu bilerek yaptırmak için deploy'u sana bıraktım.
2. **Cihaz doğrulaması (App Check):**
   1. Apple Developer'da DeviceCheck `.p8` anahtarı oluştur ve Firebase'e yükle.
   2. Play Console → Uygulama bütünlüğü bölümünde Firebase bağlantısını kontrol et.
   3. Yeni TestFlight ve Play dahili test sürümü çıkar.
   4. Birkaç gün sonra `npm run appcheck:status` çalıştır.
3. **Yük testi için:** ayrı bir Firebase (Blaze) test projesi aç ve k6'yı kur. Adımlar `load-test/README.md`'de; sonrasını ben yaparım.
4. **İmza anahtarı:** `@smlztrk__seelogd.jks`'i parola yöneticine koy, sonra proje klasöründen kaldır. Ben dokunmadım.
5. **Push:** commit'leri uzak depoya göndermek istediğinde söyle.

### 🤝 Birlikte karar vereceklerimiz
- **TMDB anahtarı:** (a) olduğu gibi kalsın + gerektiğinde yenile (önerim), ya da (b) sunucudan geçir. Ayrıntı: `TMDB_JETON_YONETIMI.md`.
- **Bekleme listesi sızıntısı:** olduğu gibi kalsın, ya da site "zaten kayıtlısın" demeyi bıraksın (sızıntıyı tamamen kapatır).
- **Eski arama yolunu kapatma zamanı** (`legacyUserSearchList`): eski uygulama sürümleri azalınca.
- **Ad/avatar değiştirmeye bekleme süresi** konsun mu? Şu an sınırsız; her değişiklik kişinin bütün mesaj ve yorum geçmişini yeniden yazdırıyor.
- **Sunucu tavanları:** hafif fonksiyonlar 20, dış servise bağlı olanlar 10, toplu işler 1. Uygun mu?
- **App Check'i zorunlu yapma zamanı:** geçerli doğrulama oranı %95'i geçince adım adım açılacak.

---

## 🔴 En öncelikli: Çok kişi aynı anda oy verince sayaçlar tıkanıyor

**Ne sorun:** "Günün Sorusu", "Top 100" ve popüler film puanları tek bir hücreye yazıyor. Çok sayıda kişi aynı anda oy verince bu hücre kilitleniyor.

**Neden önemli:** Bunu emülatörde **gerçekten ölçtük**. Sonuç çarpıcı:
- Aynı anda **100 kişi** oy verdi → yalnızca **3'ü** kaydedildi, 97'si başarısız.
- Aynı anda **1.000 kişi** → yalnızca **1'i** kaydedildi.
- Oyları **ayrı ayrı** kaydeden çözümü denedik → **1.000'in 1.000'i** başarılı, çok hızlı (saniyenin 46 binde biri).

Yani 10.000 kullanıcı hedefinde, yüzlerce kişi aynı ankete oy verirse çoğu "oy verilemedi" ya da donma yaşar. Çözümü de ölçtük, çalışıyor.

**Ne yapılmalı:** Sayaçları "herkes tek hücreye yazsın" yerine "herkes kendi oyunu ayrı yazsın, toplamı arka planda hesaplayalım" desenine çevirmek. Bu, 10.000 kullanıcı hedefinin **ön şartı**.

**Zorluk/risk:** Orta iş. Oylama özelliklerini (Günün Sorusu, Top 100, puanlar, turnuva) etkiler; dikkatli yapılmalı ve test edilmeli. Veri kaybı olmaz (eski oylar korunur).

> ✅ **YAPILDI (31 Ekim) — yayına alınmayı bekliyor.** Dört sayaç da düzeltildi ve gerçek kurallarla yeniden ölçüldü: aynı anda 1.000 kişi Günün Sorusu'na oy verdiğinde eskiden yalnız **58'i** kaydediliyordu, şimdi **1.000'in 1.000'i**. Turnuvada ayrıca **sessiz oy kaybı** hatası bulunup düzeltildi (yoğunlukta bazı oylar sayımdan düşüyordu). Eski uygulama sürümleri de çalışmaya devam ediyor.
> **Senin yapman gereken:** önce Firebase kurallarını ve sunucu fonksiyonlarını yayına almak, **sonra** uygulamanın yeni sürümünü çıkarmak. Sıra ters olursa yeni sürümde oylar "beklemede" kalır.

---

## 🔴 İkincil performans: Sunucu kapasite tavanı ve profil yayılımı

**Ne sorun:** Maliyeti kontrol için sunucu fonksiyonlarında bilinçli bir "aynı anda en fazla 10 kopya" sınırı var. Ayrıca bir kişi profilini değiştirince bu ~15 ayrı yere yayılıyor.

**Neden önemli:** 10.000 kişi aynı anda yapay zekâ/sohbet özelliğini kullanırsa fonksiyonlar sıraya girer (yavaşlar). Bu aslında kötüye kullanımı da sınırladığı için tamamen kötü değil, ama bilinçli ayarlanmalı.

**Ne yapılmalı:** Ucuz/hafif fonksiyonlara daha yüksek tavan, pahalı (yapay zekâ) olanlara düşük tavan. Profil yayılımını gereksiz yazmadan kaçınacak şekilde gözden geçirmek.

**Zorluk/risk:** Düşük-orta. Ölçüm için ayrı test ortamı (aşağıya bak) gerekir.

> ✅ **YAPILDI (31 Ekim) — yayına alınmayı bekliyor.** Firebase'deki gerçek ayara salt-okunur baktım: her fonksiyon kopyası aynı anda **80 isteğe** bakabiliyor. Yani "10 kopya" aslında aynı anda ~800 istek demek; düşündüğümüz kadar dar değilmiş. Asıl sorunlar başka çıktı ve düzeltildi:
> - Hesap silindiğinde çalışan eski tip bir fonksiyon bu sınırı hiç tanımıyordu (**3.000 kopyaya** kadar çıkabiliyordu) → 10'a çekildi.
> - Gece/haftalık çalışan toplu işler (bildirim özeti, platform taraması vb.) aynı anda iki kez çalışabiliyordu → tek kopyaya sınırlandı.
> - Hafif fonksiyonlar (davet, kod kullanma, arkadaş araması, lig XP) 20'ye çıktı. Yapay zekâ, IMDb puanları ve abonelik kontrolü gibi dış servise bağlı olanlar 10'da kaldı (karşı tarafın kotası zaten sınırlı).
> - Bundan sonra eklenen her fonksiyon sınırını açıkça seçmek zorunda; seçmezse test düşüyor.
> - Profil yayılımı kontrol edildi, iyi durumda: yalnız ad/kullanıcı adı/fotoğraf değişince çalışıyor ve yalnız değişen alanı yazıyor.

---

## 🟠 Güvenlik — Tüm kullanıcı listesi toplu çekilebiliyor

**Ne sorun:** Giriş yapmış herhangi biri, tek tek değil **toplu olarak** tüm kullanıcıların profilini (ad, kullanıcı adı, fotoğraf, plan bilgisi) indirebiliyor.

**Neden önemli:** E-posta ve doğum tarihi zaten gizli (iyi). Ama bir rakip ya da kötü niyetli biri tüm kullanıcı tabanını kopyalayabilir (veri kazıma).

**Ne yapılmalı:** "Tek bir profili aç" serbest kalsın, "hepsini birden listele" kapatılsın.

**Zorluk/risk:** ~~Düşük iş, düşük risk. Arama zaten ayrı bir yerden çalışıyor, etkilenmez.~~ **Bunu yanlış yazmıştım — düzeltme:** arkadaş araması tam da bu toplu listeleme izniyle çalışıyordu; listeyi düz kapatsaydık arama bozulurdu. O yüzden iş orta ölçekli çıktı.

> ✅ **YAPILDI (31 Ekim) — yayına alınmayı bekliyor.**
> - Arama artık sunucudaki yeni bir fonksiyon üzerinden çalışıyor: dakikada en fazla 30 arama, sonuçta yalnız ad / kullanıcı adı / avatar görünüyor (eskiden plan bilgisi gibi gereksiz alanlar da geliyordu).
> - Ek bulgu: kullanıcı adları listesi, **giriş yapmamış** birine bile tümüyle açıktı — kapatıldı. "Bu ad boşta mı?" kontrolü çalışmaya devam ediyor.
> - Eski uygulama sürümleri aramaya devam edebilsin diye liste şimdilik yalnız "tek sayfa (20 kişi)" sorgusuna açık. Eski sürümler kalmayınca tek satırlık bir anahtarla tamamen kapatılacak — **ne zaman kapatılacağı senin kararın.**
> - **Yayın sırası:** önce sunucu fonksiyonları, sonra uygulama; anahtarı kapatmak en sonda.

---

## 🟠 Güvenlik — Cihaz doğrulaması kurulu ama zorunlu değil

**Ne sorun:** Uygulamaya "bu gerçek bir telefon mu, sahte bir betik mi?" kontrolü (App Check / Play Integrity) eklenmiş ama sunucu tarafında **zorunlu tutulmuyor**. Yani şu an sadece "kurulu", "kapıda kontrol edilmiyor".

**Neden önemli:** Kötü niyetli biri bir hesap açıp fonksiyonları (örneğin yapay zekâ) betikle çağırabilir. Günlük kota ve hız sınırları bunu zaten frenliyor, bu yüzden etki sınırlı — ama kapıyı tam kapatmak daha iyi.

**Ne yapılmalı:** Önce test ortamında, sonra canlıda bu kontrolü kademeli olarak **zorunlu** yapmak. (Kodda zaten "bunu sonra aç" notu var.)

**Zorluk/risk:** Düşük-orta. Dikkatli yapılmazsa gerçek kullanıcıları dışarıda bırakabilir, o yüzden kademeli ve test ortamında önce.

> ⚠️ **KONTROL EDİLDİ (31 Ekim) — şu an AÇILAMAZ.** Firebase'e bilgisayardan salt-okunur baktım (hiçbir ayarı değiştirmedim):
> - Kontrol hiçbir yerde zorunlu değil (Firestore, Realtime Database, giriş).
> - **Son 28 günde tek bir geçerli doğrulama yok:** ~147 bin Firestore isteğinin yaklaşık dörtte üçü hiç doğrulama taşımıyor (bunlar senin geliştirme sürümlerin — orada kontrol bilerek kapalı, sorun değil), dörtte biri ise bozuk doğrulama taşıyor (yayın sürümlerinde doğrulama hiç alınamıyor).
> - Yani bugün açsaydık **uygulama tamamen dururdu.**
>
> **Önce düzeltilmesi gerekenler:**
> - **iOS:** uygulamada "App Attest" yetkisi eksik (küçük bir ayar + yeni sürüm) ve yedek yöntem DeviceCheck'in anahtarı Firebase'e yüklenmemiş — bunu Apple hesabınla **senin** yapman gerekiyor.
> - **Android:** Play Console'da "Uygulama bütünlüğü" bölümünde Firebase projesinin bağlı olduğunu kontrol etmelisin (bunu uzaktan göremiyorum). Ayrıca test, Play Store'un dahili test kanalından yüklenen sürümle yapılmalı; elle yüklenen APK'lar bilerek reddedilir.
> - Sonra birkaç gün izleyip geçerli doğrulama oranı %95'i geçince adım adım açacağız.
>
> ✅ **Koddaki kısmı YAPILDI (31 Ekim):**
> - iOS'a eksik "App Attest" yetkisi eklendi (yeni iOS sürümüyle devreye girer).
> - Yayın sürümünde doğrulama alınamazsa sebebi artık Sentry'ye düşüyor — Android'in neden başarısız olduğunu sahadan göreceğiz.
> - Tek komutla durum raporu: **`npm run appcheck:status`** — hangi serviste ne kadar geçerli doğrulama var, "açmaya hazır mı" yazıyor. Hiçbir ayarı değiştirmez.
> - İstersen geliştirme sürümünde de doğrulamayı açabilen bir anahtar eklendi (varsayılan kapalı; `.env.example`'da açıklaması var).
>
> **Senin yapacakların (bilgisayara dönünce):**
> 1. Apple Developer'da DeviceCheck anahtarı (.p8) oluşturup Firebase Console → App Check → iOS uygulaması → DeviceCheck'e yüklemek.
> 2. Play Console → Uygulama bütünlüğü → Play Integrity API'nin Firebase projesine bağlı olduğunu kontrol etmek.
> 3. Yeni iOS (TestFlight) ve Android (Play dahili test) sürümü çıkarıp birkaç gün kullanmak, sonra `npm run appcheck:status` çalıştırmak.

---

## 🟠 Güvenlik — İki ayar doğrulanmalı / bir karar gerekiyor

- **Firestore cihaz-doğrulama ayarı:** Bu, kodda değil Firebase panelinde. ✅ Kontrol edildi (31 Ekim): zorunlu **değil** — ayrıntı yukarıda.
- **TMDB anahtarı:** Film verisi için kullanılan TMDB anahtarı uygulamanın içine gömülü (çıkarılabilir). Bu anahtar "sadece okuma" olduğu için düşük riskli. **İki seçenek var, senin kararın:** (a) olduğu gibi bırak + anahtarı ara ara yenile, ya da (b) onu da sunucu üzerinden geçir (Gemini'de yaptığımız gibi). (b) daha güvenli ama daha çok iş.
  > 📝 **İnceledim (31 Ekim) — önerim (a), karar senin.** Uygulamada TMDB'ye giden **239 çağrı, 112 dosyada**. Hepsini sunucudan geçirmek büyük iş; üstelik bütün kullanıcıların isteği birkaç sunucu adresinden çıkacağı için TMDB'nin hız sınırına toplu takılma riski doğar ve her film sayfası açılışı fatura kalemi olur. Güvenlik kazancı da cihaz doğrulaması (App Check) çalışmadan gerçekleşmiyor — o da şu an çalışmıyor. Anahtar zaten yalnız okuma yapabiliyor. Sızarsa ne yapılacağını adım adım yazdım: `docs/guvenlik/TMDB_JETON_YONETIMI.md` (yeni anahtar → EAS'e gir → `eas update` → eskiyi sonra iptal).

---

## 🟡 Küçük düzeltmeler (acil değil)

- **Bekleme/beta listesi:** Bir e-postayı bilen biri, o kişinin listede olup olmadığını öğrenebiliyor. Küçük bir sızıntı; istenirse kapatılır.
  > 📝 **İnceledim (31 Ekim) — olduğu gibi bıraktım, karar senin.** Sitedeki "zaten listedesin, sıran #X" mesajı tam da bu kontrolle çalışıyor. Kontrolü sunucuya taşımak işe yaramıyor, çünkü site giriş istemiyor ve sunucu da herkese aynı "evet/hayır" cevabını verirdi. Gerçekten kapatmanın tek yolu sitenin "zaten kayıtlısın" demeyi bırakıp her zaman "kaydın alındı" demesi. İstersen bunu yaparım. Sızan bilgi de yalnızca "bu e-posta listede"; ad ya da telefon gibi bir şey değil.
- **İmza anahtarı dosyası (.jks) ve .env:** Bilgisayarında duruyor ama **git'e gönderilmemiş** (kontrol ettim, güvende). Yine de bu dosyaları depo dışında tutmak, projeyi sıkıştırıp paylaşırken hariç bırakmak iyi olur. İmza anahtarı çok değerli — kaybolursa uygulamayı güncelleyemezsin.
  > ✅ **Kontrol edildi (31 Ekim):** bu dosyalar git geçmişine hiç girmemiş. README'ye "projeyi paylaşırken bu dosyaları dahil etme" bölümü ve bunu otomatik yapan tek komut eklendi. Anahtar dosyasına **dokunmadım**. Dosya adı EAS'ten indirildiğini gösteriyor, yani asıl kopya EAS'te duruyor. **Senin yapacağın:** `.jks`'i parola yöneticine ek dosya olarak koy, sonra proje klasöründen kaldır.
- **Grup kuralları karmaşık:** Şu an güvenli ama çok dallı; ileride değiştirirken testlerle korunmalı.

---

## 🧪 Kalan testler — ayrı bir test ortamı gerektiriyor

Yapay zekâ/sohbet fonksiyonlarının ve mesaj/presence yükünün gerçek hız testini **henüz yapmadık**. İki engel var:
1. Bu bilgisayarda test aracı (**k6**) kurulu değil.
2. Gerçek sayı için **canlıdan ayrı bir test projesi** gerekiyor (canlıya yük bindirmek = gerçek kullanıcı, gerçek maliyet, gerçek anahtarlar — riskli).

**Yapılması gereken:** Canlının kopyası ama ayrı bir Firebase (Blaze) projesi kurmak; üçüncü taraf çağrılarını (Gemini/TMDB vb.) sahte yanıtla değiştirip orada 100 / 1.000 / 5.000 / 10.000 kullanıcı testini çalıştırmak.

> ✅ **Kod tarafı HAZIR (31 Ekim).** Sunucuya "test modu" anahtarı eklendi: açıkken yapay zekâ, IMDb puanı, abonelik, TMDB ve bildirim gönderimi gerçek servise **hiç gitmiyor**, sahte cevap dönüyor. Canlı projede bu anahtar açılsa bile **çalışmıyor** (bilerek kilitli). Emülatörde denedim: yapay zekâ isteği baştan sona sahte cevapla döndü, dışarıya tek istek çıkmadı. Test betiğindeki iki hatayı da düzelttim (yapay zekâ isteği eksik alanla gidip reddedilecekti; tek kullanıcıyla test kotaya takılıp anlamsız sonuç verecekti).
> **Senin yapacakların:** ayrı bir Firebase projesi açmak (faturalı hesap ister) ve bilgisayara k6 kurmak. Kurulum adımları: `load-test/README.md`. Sonrasını ben yaparım.

---

## Önerilen sıra
1. **Sayaç tıkanması** (ölçtük, en kritik) — 10.000 hedefi için şart.
2. **Kullanıcı listesi** + **cihaz doğrulaması** (güvenlik, düşük iş).
3. **Sunucu tavanı/profil yayılımı** + **TMDB kararı**.
4. Küçük düzeltmeler.
5. Ayrı test ortamı kurulunca kalan hız testleri.

İstersen bu maddeleri tek tek birlikte yapabiliriz — hangisinden başlayalım dersen oradan gideriz.

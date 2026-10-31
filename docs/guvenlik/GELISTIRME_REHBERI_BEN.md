# Geliştirme Rehberi — Sade Anlatım (senin için)

Bu belge, 31 Ekim 2026 güvenlik + performans denetiminden çıkan **yapılacaklar listesidir**, günlük dille. Aynı maddelerin teknik/ajan sürümü: `GELISTIRME_REHBERI_CLAUDE.md`. Teknik detay: `DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md`.

**Önce iyi haber:** Uygulaman güvenlik açısından iyi durumda. Kritik bir açık yok. Anahtarlar sunucuda saklı, abonelik sunucuda doğrulanıyor, kurallar sahtekârlığı (başkasının adına mesaj, puan şişirme, kendini premium yapma) engelliyor. Aşağıdakiler "yangın" değil, "daha sağlam ve ölçeklenebilir yapmak" için.

Her madde şu düzende: **Ne sorun · Neden önemli · Ne yapılmalı · Zorluk/risk.**

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

---

## 🟠 Güvenlik — İki ayar doğrulanmalı / bir karar gerekiyor

- **Firestore cihaz-doğrulama ayarı:** Bu, kodda değil Firebase panelinde. Panelden "zorunlu mu" diye kontrol edilmeli.
- **TMDB anahtarı:** Film verisi için kullanılan TMDB anahtarı uygulamanın içine gömülü (çıkarılabilir). Bu anahtar "sadece okuma" olduğu için düşük riskli. **İki seçenek var, senin kararın:** (a) olduğu gibi bırak + anahtarı ara ara yenile, ya da (b) onu da sunucu üzerinden geçir (Gemini'de yaptığımız gibi). (b) daha güvenli ama daha çok iş.

---

## 🟡 Küçük düzeltmeler (acil değil)

- **Bekleme/beta listesi:** Bir e-postayı bilen biri, o kişinin listede olup olmadığını öğrenebiliyor. Küçük bir sızıntı; istenirse kapatılır.
- **İmza anahtarı dosyası (.jks) ve .env:** Bilgisayarında duruyor ama **git'e gönderilmemiş** (kontrol ettim, güvende). Yine de bu dosyaları depo dışında tutmak, projeyi sıkıştırıp paylaşırken hariç bırakmak iyi olur. İmza anahtarı çok değerli — kaybolursa uygulamayı güncelleyemezsin.
- **Grup kuralları karmaşık:** Şu an güvenli ama çok dallı; ileride değiştirirken testlerle korunmalı.

---

## 🧪 Kalan testler — ayrı bir test ortamı gerektiriyor

Yapay zekâ/sohbet fonksiyonlarının ve mesaj/presence yükünün gerçek hız testini **henüz yapmadık**. İki engel var:
1. Bu bilgisayarda test aracı (**k6**) kurulu değil.
2. Gerçek sayı için **canlıdan ayrı bir test projesi** gerekiyor (canlıya yük bindirmek = gerçek kullanıcı, gerçek maliyet, gerçek anahtarlar — riskli).

**Yapılması gereken:** Canlının kopyası ama ayrı bir Firebase (Blaze) projesi kurmak; üçüncü taraf çağrılarını (Gemini/TMDB vb.) sahte yanıtla değiştirip orada 100 / 1.000 / 5.000 / 10.000 kullanıcı testini çalıştırmak.

---

## Önerilen sıra
1. **Sayaç tıkanması** (ölçtük, en kritik) — 10.000 hedefi için şart.
2. **Kullanıcı listesi** + **cihaz doğrulaması** (güvenlik, düşük iş).
3. **Sunucu tavanı/profil yayılımı** + **TMDB kararı**.
4. Küçük düzeltmeler.
5. Ayrı test ortamı kurulunca kalan hız testleri.

İstersen bu maddeleri tek tek birlikte yapabiliriz — hangisinden başlayalım dersen oradan gideriz.

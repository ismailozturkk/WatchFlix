# Zevk Eşleşmesi — Zevk Çemberleri (tasarım taslağı, 13 Kas 2026)

> Durum: **yalnız tasarım.** Kod yok, deploy yok. Sayılar (eşikler, ağırlıklar) ilk tahmin;
> gerçek veriyle ayarlanacak.

## 1. Amaç

Seelogd kullanıcılarını **izleme zevkleri çok benzeyen** kişilerle buluşturmak: arkadaşlık,
fikir alışverişi, öneri paylaşımı. Örnek: anime izleyen ve aynı tür animeleri seven insanlar
bir araya gelir.

- **Flört değil.** Fotoğraf, yaş, konum ya da cinsiyet eşleşmeye girmez ve kartta gösterilmez.
  Profilin yüzü afişler ve puanlardır.
- **Seçici.** Eşleşme eşiği yüksek tutulur (%90–95). Az ama isabetli eşleşme, çok ama sıradan
  eşleşmeden iyidir.
- **Emeğe dayalı.** İsabet, kullanıcının verdiği veriyle artar. Görevler bu veriyi toplamaya
  teşvik eder (bkz. §4).

## 2. Temel kavramlar

| Kavram | Anlamı |
|---|---|
| **Kulvar** | Eşleşmenin yapıldığı alan: Film, Dizi, Anime (ilk üç). Sonra tür kulvarları eklenebilir: Korku, Bilim Kurgu, Belgesel, K-Drama… Bir kişi birden çok kulvarda olabilir. Her kulvarda benzerlik **yalnız o kulvarın yapımlarıyla** hesaplanır. |
| **Zevk Çemberi** | En çok **10 kişilik** grup. Üyeleri birbirine çok benzer. Kendi sohbeti, haftalık önerisi ve "çemberin favorileri" rafı olur. |
| **Zevk İkizi** | Bire bir eşleşme. İki kişi arasındaki skor ≥ %90 ise ve ikisi de "selam" derse sohbet açılır. |
| **Eşleşme gücü** | Kullanıcının o kulvardaki verisinin ne kadar güvenilir olduğu (0–100). Görevlerle artar. Belli bir değerin altında havuza girilmez. |

## 3. Kullanıcı akışı

1. **Katılım.** Ayarlarda ya da Hub'da "Zevk Çemberleri"ne katıl, kulvar(lar)ı seç. Varsayılan
   kapalıdır, istenildiği an çıkılır ve çıkınca özet profil silinir.
2. **Hazırlık.** Eşleşme gücü yetersizse görev kartı gösterilir. Örnek: "Anime kulvarı için
   12 yapım daha puanla. Bu, eşleşme isabetini artırır."
3. **Havuz.** Güç yeterliyse kullanıcı kulvar havuzuna girer. Eşleşme sunucuda gece (ve katılım
   anında bir kez) hesaplanır.
4. **Sonuç.**
   - Zevk İkizi adayları: kartta skor, ortak sevilenler, ikisinin de 9–10 verdiği yapımlar,
     ayrıştıkları bir yapım yer alır. Puan değerleri GÖSTERİLMEZ (gizlilik metni; kullanıcı kararı 13 Kas).
   - Uygun çember varsa davet gelir: "Anime · Seinen & psikolojik gerilim çemberi — 7/10 üye".
5. **Bağlantı.** İkizde karşılıklı "selam" olunca mevcut sohbet açılır. Eşleşmeden önce mesaj
   atılamaz. Sohbet, hazır bir konuşma başlatıcıyla açılır: "İkiniz de Monster'ı çok sevdiniz.
   Johan'ı nasıl buldunuz?" Çemberde kabulle grup sohbetine katılınır (mevcut grup altyapısı).

## 4. Görevler ve eşleşme gücü

Eşleşme gücü kulvar bazında hesaplanır. Görevler hem bu gücü hem de genel istatistiklerin
doğruluğunu artırır. Arayüzde bu bağ açıkça vurgulanır: "Ne kadar çok puanlarsan, istatistiklerin
ve eşleşmelerin o kadar doğru olur."

| Ölçüt | Havuza giriş (asgari) | Tam güç | Ağırlık |
|---|---|---|---|
| Kulvarda izlenen yapım | 30 | 150 | 0.25 |
| Kulvarda puanlanan yapım | 20 | 100 | 0.35 |
| Puan çeşitliliği (en az 4 farklı puan kademesi, std ≥ 1.0) | şart | — | kapı |
| Yorum / inceleme notu | 3 | 20 | 0.15 |
| Dört favori (kulvardan en az 2) | 2 | 4 | 0.10 |
| Son 30 günde etkinlik | 1 kayıt | 8+ kayıt | 0.15 |

- `güç = Σ ağırlık × min(1, değer / tam_güç)`. Giriş için asgariler sağlanmalı ve `güç ≥ 0.45`
  olmalı.
- **İzleme yolu (puan vermeyenler için, bkz. algoritma belgesi §9).** Puan ve yorum asgarisi yerine kulvarda
  **60 izleme + 2 favori + son 30 günde etkinlik** ile de havuza girilir. Bu yolda güç en çok
  **0.70** olur. Kullanıcıya nazikçe "puan verirsen isabet artar" denir ama zorlanmaz.
- **Puan çeşitliliği kapısı.** Her şeye 10 (ya da her şeye 5) veren birinin puanları görüş sayılamaz.
  Böyle kullanıcıya "Puanların çok benzer. Sevdiklerini ve sevmediklerini ayırırsan eşleşmeler
  isabetli olur." denir.
- **Hile önlemi.**
  - Aynı gün girilen 50'den fazla kaydın fazlası, 14 gün geçene kadar eşleşme hesabında yarı
    ağırlık alır. İstatistiklere tam yansır.
  - Kulvardaki kayıtlar en az 14 farklı güne yayılmış olmalı (algoritma belgesi §10).
- **Örnek görevler:**
  - "Bu hafta 10 yapım puanla"
  - "İzlediğin 3 animeye kısa not yaz"
  - "Dört favorini seç"
  - "Puanlarını gözden geçir: 10 verdiklerinden hangisi gerçekten 10?"

  Mevcut Meydan Okumalar ve rozet sistemine bağlanabilir.

## 5. Benzerlik hesabı (özet)

Hesabın bağlayıcı kuralları ayrı belgededir: **[ZEVK_ESLESMESI_ALGORITMA.md](ZEVK_ESLESMESI_ALGORITMA.md)**.
Aşağısı yalnız özettir; sayı ya da formül için o belgeye bakılır.

Mevcut `utils/tasteMatch.js` arkadaşlar için yazıldı ve yabancılar arasında kullanılamaz: ortak
izleneni yalnız küçük listeye böldüğü için 100 filmlik liste 1000 filmlik listenin içindeyse
%100 veriyor, rastgele iki kişiye de ~%50 veriyor.

**Üç kanıt ailesi**

| Aile | Soru | Ağırlık |
|---|---|---|
| Görüş uyumu | İkisinin de izlediği yapımlar hakkında aynı mı düşünüyorlar? | 0.45 |
| Seçim benzerliği | Aynı yapımları mı seçiyorlar? (az bilinen yapım daha çok sayılır) | 0.25 |
| İçerik profili | Aynı tür şeyleri mi seviyorlar? (tür, anahtar kelime, dönem, köken…) | 0.30 |

**Temel kurallar**

- **Puan kişiye göre okunur.** Puanın mutlak değeri değil, kişinin kendi puanları içindeki sırası
  kullanılır. Sert ve cömert puanlayan aynı zevkteyse eşleşir.
- **"İyi filmi herkes sever" benzerlik sayılmaz.** Görüş uyumu, genel kanıdan *sapma* üzerinden
  ölçülür. Rastgele iki kişinin skoru 0 civarındadır.
- **Liste büyüklüğü farkı.** Seçim benzerliği iki yönlü ölçülür ve ayrıca bir deneyim tavanı
  vardır: izleme sayıları 10 kat farklıysa skor en çok 75, %90 için en çok ~2.5 kat fark.
  Zevki aynı ama deneyimi çok farklı çift "Rehber" olur.
- **Az veri.** Her bileşen kanıtı azsa aşağı çekilir. Ayrıca kaç ortak görüş varsa o kadar yüksek
  skor verilebilir: %90 için ≈ 22 ortak puanlı yapım gerekir.
- **Puan vermeyenler.** Davranıştan (favori, tekrar izleme, diziyi bitirme/bırakma) tercih
  çıkarılır; değerleri puan veren kullanıcıların verisinden öğrenilir. %90 için ≈ 73 ortak
  davranış sinyali gerekir. Yalnız film izleyip hiç puan vermeyen iki kişi bugünkü kurallarla
  ≈ %75–77'de kalır (algoritma belgesi §9.5, gevşetilebilir).
- **İkiz olabilmek için** kabaca kulvarda 100+ yapım ve 25+ ortak görüş gerekir. Havuza giriş
  eşiği (§4) bundan düşüktür; aradaki farkı görevler kapatır.

**Simülasyon sonucu (sentetik veri, gerçek kullanıcı değil).** %90 alan çiftlerin %99–100'ü
gerçekten benzer çıktı; eski hesapta bu oran %87–89. Rastgele çiftlerin %99'u yeni hesapta 42'nin,
eski hesapta 75'in altında kaldı. Ayrıntı ve sınırlar algoritma belgesi §12'de.

## 6. Zevk Çemberi oluşturma

- **Hedef:** en çok 10 kişi. Her üyenin diğer üyelerle **ortalama** skoru ≥ %88, herhangi iki üye
  arasındaki **en düşük** skor ≥ %80 (algoritma belgesi §8).
- **Algoritma (gece işi, kulvar başına):**
  1. Uygun kullanıcılar için ikili skorlar hesaplanır. Havuz küçükken hepsi hesaplanır. Büyüyünce
     önce içerik profiliyle en yakın 100 aday süzülür, sonra tam hesap yapılır.
  2. Skoru ≥ 80 olan kenarlarla graf kurulur ve en yoğun kümelerden başlanarak açgözlü biçimde
     çemberler doldurulur (en büyük ortalama kenar ağırlığı önce); yukarıdaki iki şartı bozan
     üye eklenmez.
  3. Mevcut çemberlerde boş yer varsa yeni uygun kullanıcı önce oraya önerilir.
- **Asgari çember:** 3 kişi. 3'ten az uygun kişi varsa çember kurulmaz, yalnız ikiz eşleşmesi
  sunulur.
- **Çember adı** otomatik verilir, en baskın 2 tür + kulvar ile: "Anime · Psikolojik & Seinen".
- **Yaşam döngüsü:**
  - 30 gün etkinliği olmayan üye "uykuda" sayılır ve yeri açılabilir.
  - Kullanıcının zevki zamanla kayıp üyelerle ortalama skoru %80'in altına düşerse yeni çember
    önerilir. Zorla çıkarılmaz.
- **İçerik:** çember sohbeti, "çemberin bu haftası" (üyelerin izledikleri), "çemberde
  izlemediğin en sevilen 5 yapım" (öneri), çember içi mini tier list/turnuva (mevcut özellikler).

## 7. Az kullanıcı sorunu (soğuk başlangıç)

Bugün ~23 hesap var. %90 eşiğiyle başlangıçta neredeyse kimse eşleşmez. Bu yüzden:

- Özellik **havuz sayacıyla** açılır: "Anime kulvarında 14 kişi var, çemberler 30 kişide
  açılıyor." Bu bekleme süresi görevlere yönlendirir.
- Kulvar havuzu yeterince büyüyene kadar (algoritma belgesi §11: 150 etkin kullanıcı) çember
  kurulmaz ve "ikiz" iddiası yapılmaz. %80 ve üzeri skorlar "yakın zevk" etiketiyle önerilir
  (algoritma belgesi §8).
- Eşikler sabit değil, `config` belgesinden okunur (Remote Config ya da `AppConfig/match`).
  Böylece yeni sürüm çıkarmadan ayarlanabilir.

## 8. Gizlilik ve güvenlik

- **Yalnız katılanlar.** `MatchProfiles` belgesi yalnız katılan kullanıcı için oluşur. Ham liste
  başkasına **hiç gitmez**, eşleşme kartı yalnız ortak ve özet veri gösterir.
- **Yaş.** `birthDate` alanı 18+ olduğunu kanıtlamalı (`isAdultBirthDate`). Tarihi olmayan eski
  hesaplar katılamaz.
- **Kartta gösterilmeyenler:** yaş, konum, cinsiyet, e-posta. Fotoğraf yalnız kullanıcının zaten
  herkese açık avatarıdır.
- Engelle, şikâyet et ve çemberden çık her yerde bulunur. Engellenen kişi bir daha önerilmez.
- Günlük selam sınırı (ör. 10). İlk 5 mesajda link/telefon süzgeci uygulanır.
- Kullanıcı ayrılınca `MatchProfiles` ve bekleyen selamlar silinir. Hesap silmede de silinir
  (`accountPurge` listesine eklenecek).

## 9. Teknik yapı (taslak)

| Parça | İş |
|---|---|
| `MatchProfiles/{uid}` | Kulvar başına özet: yapım başına tercih puanı ve sinyal türü, izleme kümesi, içerik profili ve güvenilirliği, izleme sayısı, eşleşme gücü, son etkinlik. **Yalnız sunucu yazar ve okur** (kurallar: istemci okuması kapalı). |
| `functions/match/buildProfile` | Liste/puan değişince (kısıtlanmış tetik, ör. 6 saatte bir kullanıcı başı) özeti günceller. |
| `functions/match/nightly` | Kulvar başına ikili skorlar → ikiz adayları + çember kurulumu. Sonuçlar `MatchSuggestions/{uid}` belgesine yazılır (kullanıcı yalnız kendi belgesini okur). |
| `matchHello` callable | Selam gönderir; karşılıklıysa `Matches/{pairId}` ve sohbet oluşturur. |
| `utils/tasteMatchV3.js` | Algoritma belgesindeki saf hesap. Jest ile on değişmez kural (algoritma §14) doğrulanır. Sunucu ve istemci aynı modülü paylaşır. |
| `TitleFeatures/{tür_id}` | Yapım başına bir kez TMDB'den doldurulan özellik önbelleği: anahtar kelime, dil/ülke, popülerlik, oy ortalaması, stüdyo. İçerik profili ve nadirlik ağırlığı için gerekli; liste kayıtlarında bu alanlar yok. |
| `AppConfig/match` | Tüm eşikler ve sabitler + gecelik öğrenilen tablolar. Yeni sürüm çıkarmadan kalibrasyon. |
| İstemci | Hub'da "Zevk Çemberleri" kartı, görev/güç ekranı, ikiz kartı (`TasteMatchCard` görsel dili), çember ekranı (grup sohbeti altyapısı). |

**Maliyet.** Hesap gece toplu yapıldığından okuma sayısı kullanıcı başına günde ~2 belgedir
(öneri + profil). 1000 kullanıcı ve 3 kulvarda ikili hesap ~1.5M çift eder; tek fonksiyonda
dakikalar sürer. Sonrası için ön süzme (§6, adım 1) gerekir.

## 10. Fazlar

1. **Faz 1 — Hazırlık (istemci):** eşleşme gücü + görevler + "istatistiklerin için önemli" kartı.
   Bu faz eşleşme olmadan da tek başına değerlidir, veriyi zenginleştirir.
2. **Faz 2 — İkizler:** `tasteMatchV3`, `MatchProfiles`, gece işi, selam → sohbet.
3. **Faz 3 — Çemberler:** kümeleme, grup sohbeti, çember rafları. Rehber eşleşmesi de bu fazda.
4. **Faz 4 — Tür kulvarları ve ince ayar:** gerçek skor dağılımına göre `k`, eşik ve ağırlıkların
   ayarı.

## 11. Kararlar

- **13 Kas:** yalnız 18+ ve yalnız katılmak isteyenler havuzda görünür (kullanıcı onayladı).
- **13 Kas:** puan/yorum vermeyenler de katılabilir. Örtük sinyal ve izleme yolu bunun için
  (§4, algoritma belgesi §9).
- **13 Kas:** benzerlik hesabı ayrı belgeye taşındı ve simülasyonla sınandı
  ([ZEVK_ESLESMESI_ALGORITMA.md](ZEVK_ESLESMESI_ALGORITMA.md)). Öncelik: yanlış ikiz göstermemek.

## 12. Açık sorular

- Kulvarlar başta yalnız Film / Dizi / Anime mi olsun, tür kulvarları hemen mi gelsin?
- Çember sohbeti mevcut grup sohbeti mi olsun, yoksa ayrı ve daha hafif bir "çember duvarı" mı?
- Premium farkı olacak mı (ör. daha çok selam, birden çok çember)? Beta'da herkes Max.
- Mevcut arkadaş "Zevk uyumu" kartı da yeni hesaba geçirilsin mi? Şu an
  `sqrt(ortak / küçük_liste)` kullanıyor, aynı "%100" sorununu taşıyor ve aynı çifte yeni
  hesaptan farklı bir yüzde gösterebilir.
- Yalnız film izleyip hiç puan vermeyenler için kural gevşetilsin mi (algoritma belgesi §9.5)?

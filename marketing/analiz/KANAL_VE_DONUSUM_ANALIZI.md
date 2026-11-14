# Kanal ve dönüşüm analizi

Son güncelleme: **7 Kasım 2026**

Bu dosya "ne paylaşalım" sorusunu değil, **kullanıcı nereden gelir** sorusunu cevaplar.
Günlük plan ([../takvim/HAFTA_01.md](../takvim/HAFTA_01.md)) buradaki sıralamaya göre kuruldu.

**Ölçülen hiçbir sayı yok.** Aşağıdaki oranlar sektör alışkanlığına dayanan **varsayımdır**; ilk haftanın
sonunda gerçek veriyle değiştirilecek. Varsayım olduğu her tabloda yazıyor.

## 1. Durum: sıfır takipçi

Beş hesap da yeni ve takipçisi yok. Bunun tek bir sonucu var: **kendi profiline yapılan paylaşım kimseye
ulaşmaz.** Takipçisi olmayan bir hesapta statik gönderi (X görseli, Instagram kare postu) yalnız
profile bakan kişiye görünür. Yani o gönderiler kullanıcı *getirmez*, profil *güvenilir* gösterir.

Sıfırdan kullanıcı getiren üç mekanizma var. Günlük emek bu üçüne göre bölünmeli:

| # | Mekanizma | Neden işler | Beklenen hacim | Beklenen niyet |
|---|---|---|---|---|
| 1 | **Algoritmik video** (TikTok, Reels) | Takipçi gerekmez; içerik yabancılara gösterilir | Yüksek, ama değişken | Düşük-orta |
| 2 | **Hazır talep havuzları** (Reddit, konu toplulukları) | Kişi zaten "ne izleyeyim / hangi uygulama" diye soruyor | Düşük | **En yüksek** |
| 3 | **Başkasının yorum alanı** (X, Threads, IG) | Erişimi büyük hesaptan ödünç alırsın | Orta | Orta |

Statik profil gönderisi bu listede yok. Planda duruyor çünkü profile bakan kişiyi ikna etmesi gerekiyor,
ama **kullanıcı sayısını oynatan şey 1, 2 ve 3'tür.**

## 2. Huni ve kaba hesap (varsayım)

Beta kaydına kadar olan yol: içerik → profil → site → form.

| Adım | Varsayılan oran | 1 video (≈300 izlenme) | Kırılma noktası |
|---|---|---|---|
| İzlenme → profil ziyareti | %1–3 | 3–9 | Kanca ilk 2 saniyede tutmazsa burada ölür |
| Profil → bağlantı tıklaması | %10–20 | 0–2 | Bio'da bağlantı yoksa sıfır |
| Tıklama → kayıt | %10–30 | 0–1 | Site beta formu; mağaza bağlantısı boş olduğu için form tek çıkış |

**Sonuç:** ortalama bir video, günde **0 ile 1 arası** kayıt getirir. Haftada 7 video = tek haneli kayıt.
Stratejideki 200 kayıt hedefine bu yolla ulaşılmaz.

İki şey bu tabloyu değiştirir:

- **Bir videonun patlaması.** 300 değil 30.000 izlenme, aynı oranlarla 10–90 kayıt demek. Bu yüzden her gün
  *farklı bir kanca* denenir: her video bir bilet, kancalar birbirinin kopyası olmamalı.
- **Niyeti yüksek havuz.** "TV Time kapandı, nereye geçtiniz?" başlığındaki 50 kişi, TikTok'taki 5.000
  kişiden daha çok kayıt getirir. Bu yüzden Reddit hacmi değil, **isabeti** için planda.

## 3. Hangi mesaj kimi çeker

`PAZAR_VE_RAKIP_ANALIZI.md` konumlandırmayı şöyle koyuyor: önce "kaldığın yeri unutma, izlediklerini tek
yerde gör", oyun ve AI ikinci adımda. Günlük plan bu sıraya uyuyor. Kancalar niyete göre sıralı:

| Kademe | Kanca | Kime | Niyet | Nerede |
|---|---|---|---|---|
| **A** | "Hangi bölümde kalmıştım?" | Dizi takipçisi 18–30 | **En yüksek**: zaten çözüm arıyor | TikTok, Reels |
| **A** | "TV Time kapandı, hâlâ yer arıyorum" | Eski TV Time kullanıcısı | **En yüksek** | Reddit, X |
| **A** | "Letterboxd'da dizi yok" | Letterboxd kullanıcısı | Yüksek | Reddit, X, Threads |
| **B** | "40 dakika seçim, sonra aynı diziyi aç" | Herkes | Orta: evrensel ama acı hafif | TikTok, Reels, X |
| **B** | "Film gecesinde karar verememek" | Arkadaş grubu, çift | Orta | Reels, Threads |
| **C** | "Film bilgini kanıtla" (oyunlar) | Sinefil, yarışmacı | Düşük: etkileşim yüksek, kayıt düşük + Premium | Reels, TikTok |
| **C** | "Yılın özeti" (Wrapped) | Herkes | Mevsimsel: **Aralık'ta** A kademesi, kasımda zayıf | Aralık dalgası |

İki düzeltme bu tablodan çıktı:

1. **Wrapped ilk günden alındı.** Yeni kullanıcının Wrapped'ı boştur; kasımda "senin yılın" demek kimseyi
   kaydettirmez. Stratejide de Wrapped ayrı bir aşama (Aralık ilk haftası). İlk hafta A kancalarıyla açılır.
2. **Oyunlar öne çıkarılmaz.** Pazarlamanın en gösterişli parçası ama Free planda **kapalı**. Oyun videosuyla
   gelen kişi kaydolup oyunu göremez; bu hem kaybedilmiş kullanıcı hem kötü ilk izlenim. Oyunlar haftada en
   fazla bir kez, "Premium" etiketi metinde açıkken paylaşılır.

## 4. İçerik açığı

En yüksek niyetli iki kanca için **elde video yok**:

| Eksik | Niye önemli | Elde ne var |
|---|---|---|
| ~~"Hangi bölümde kalmıştım" videosu~~ | A kademesinin en güçlü kancası | **7 Kas'ta üretildi:** `VID/seelogd-en-iphone-08-track.mp4`, iPhone ekranları, test adı yok |
| Letterboxd içe aktarma videosu | r/Letterboxd kitlesine tek net sebep | Hiç ekran yok; iPhone setinde içe aktarma ekranı çekilmemiş |
| TV Time içe aktarma | Eski TV Time kitlesi için en güçlü vaat | **Ürün bunu desteklemiyor.** Vaat edilmez; "Letterboxd ve IMDb geçmişini getir" denir |

İlki üretildi. İkincisi için iPhone setinde `e-kutuphane-ust`, `e-dizi-sezonlar`, `e-sezon-bolumler` ve
`e-bolum-grafigi` ekranları var; "kaldığın bölüm" videosu bunlardan kurulabilir. Letterboxd akışı için
önce ekran kaydı gerekiyor.

## 5. Ölçüm: kanal bilgisi artık var

`olcum/METRIKLER.md` "site ziyareti ölçümü yok" diyor; bu **2 Kasım'da doğruydu, artık değil.**
`website/site-beacon.js` 4 Kasım'da yayına girdi ve `functions/siteStats.js` yönlendireni günlük toplamda
`refs` haritasına yazıyor. Kodda `utm_source` yönlendirenin önüne geçiyor
(`site-beacon.js:64`, `siteStats.js:167`), yani **bağlantıya `?utm_source=` eklenirse hangi platformun kaç
ziyaret getirdiği `/admin` panelinde görünür.** Çerez yok, kimlik yok, yalnız günlük toplam.

Bundan sonra her platform kendi bağlantısını kullanır:

| Platform | Bağlantı |
|---|---|
| X | `https://seelogd.com/?utm_source=x#beta` |
| Instagram | `https://seelogd.com/?utm_source=instagram#beta` |
| Threads | `https://seelogd.com/?utm_source=threads#beta` |
| TikTok | `https://seelogd.com/?utm_source=tiktok#beta` |
| Reddit | `https://seelogd.com/?utm_source=reddit#beta` |

Hâlâ ölçülemeyen: tek tek gönderi (platform başına tek bağlantı var) ve kaydın kendisi — `betaTesters`
kaydına kaynak yazılmıyor. Gönderi bazında ayrım gerekirse `utm_source=tiktok-d3` gibi günlük ek kullanılır.

## 6. Günlük emek dağılımı (öneri)

Beş hesaba her gün paylaşım yapılacak. Emeğin ağırlığı paylaşımda değil, paylaşımdan sonrasında:

| İş | Süre | Neden |
|---|---|---|
| Günün videosu (TikTok + Reels) | 10 dk | Mekanizma 1: tek erişim kaynağı |
| Statik gönderi (X / IG / Threads) | 10 dk | Profil güvenilirliği |
| **Yorum turu: 10 yorum** | 30 dk | Mekanizma 3: asıl erişim buradan ödünç alınır |
| Topluluk işi (Reddit, gün aşırı) | 20 dk | Mekanizma 2: en yüksek niyet |
| Yanıtlar + kayıt tutma | 15 dk | İlk saat yanıtı erişimi artırır |

Yorum turu planın en kolay atlanan ve en çok getiren parçası: film/dizi konuşan büyük hesapların altına,
tanıtım yapmadan, konuya gerçekten katkı veren yorum. İnsanlar profil adına tıklar.

## 7. Üç günde bir karar

Stratejideki kural ("bir video ortalamanın 3 katı erişirse aynı biçimden 3 video") ilk hafta için
somutlaştırıldı. **Gün 3 ve Gün 6 akşamı** şu üç sayı okunur: `/admin` ziyaret ve `refs`, platform
istatistikleri, Firebase `betaTesters` + `waitlist`.

| Gözlem | Karar |
|---|---|
| Bir video diğerlerinin 3 katı izlenme aldı | Aynı kancadan 2 varyasyon daha üret, zayıf kancayı plandan çıkar |
| Bir platform 3 günde 0 ziyaret getirdi (`refs`) | O platformda statik gönderiyi kes, yalnız yorum turu bırak |
| Ziyaret var, kayıt yok | Sorun sitede veya formda; içerik değiştirmeden önce formu gözden geçir |
| Reddit gönderisi silindi veya tepki aldı | O toplulukta bir hafta yalnız yorum; metni değiştir |
| Aynı soru 3 kez geldi (ör. "ücretsiz mi?") | Cevabı bio'ya ve sonraki gönderi metnine yaz |

## 8. Bu hafta denenen şey

İlk hafta hedefi kayıt sayısı değil, **hangi kancanın tuttuğunu öğrenmek.** Yedi gün, yedi ayrı kanca:
takip, karar verememe, keşif, sosyal, istatistik, oyun, kişiselleştirme. Hepsi aynı çağrıyla
(`beta`) ve aynı ölçümle (`utm_source`) gidiyor, böylece fark içerikten gelir.

Hafta sonunda tek bir cümle yazılabilmeli: "En çok X kancası tuttu, en çok kayıt Y kanalından geldi."
Bu cümle yazılamıyorsa ölçüm eksik kurulmuş demektir.

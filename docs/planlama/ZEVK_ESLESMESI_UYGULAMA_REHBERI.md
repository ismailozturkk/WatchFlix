# Zevk Eşleşmesi — Uygulama Rehberi (Claude Code için)

> Bu belge, işi yapacak yapay zekâ oturumu içindir. Üç yapının **hangi sırayla, hangi dosyalarda,
> hangi kabul ölçütüyle** yapılacağını anlatır. Tasarım gerekçeleri burada tekrar edilmez.
> Yazıldığı tarih: 13 Kas 2026 (2. sürüm: koda karşı denetlendi). O tarihte **hiç kod yoktu**.

## 0. Önce oku

| Belge | Ne için |
|---|---|
| [docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md](../ozellikler/ZEVK_ESLESMESI_ALGORITMA.md) | Hesabın **bağlayıcı** kuralları: formül, sabit, on değişmez kural (D1–D10). Çelişkide bu geçerli. |
| [docs/ozellikler/ZEVK_ESLESMESI.md](../ozellikler/ZEVK_ESLESMESI.md) | Ürün tasarımı: kulvar, ikiz, çember, görevler, gizlilik. |
| [docs/ozellikler/ZEVK_ESLESMESI_SIM.js](../ozellikler/ZEVK_ESLESMESI_SIM.js) | Formüllerin çalışan referansı (`explicitS`, `prepare`, `parts3`, `scoreV3`). Okunaklı değil ama doğru sayıları üreten tek kod. |
| [docs/ozellikler/ZEVK_UYUMU.md](../ozellikler/ZEVK_UYUMU.md) | Mevcut arkadaş kartının belgesi. |

Üç yapı:

- **Y1 — Eşleşme:** yeni benzerlik çekirdeği, sunucu hattı, ikiz/çember arayüzü.
- **Y2 — Arkadaş profilindeki Zevk uyumu kartı:** yeni çekirdeğe bağlanır.
- **Y3 — Film/dizi detayındaki yapım uyumu:** geri test + (sonra) ikiz sinyali.

### Faz sırası ve bağımlılıklar

| Faz | İş | Yapı | Neye bağlı | Deploy ister mi |
|---|---|---|---|---|
| 0 | Hazırlık: envanter, kararlar, bayrak | hepsi | — | hayır |
| 1 | Saf çekirdek + testler | Y1 | 0 | hayır |
| 2 | Gölge mod: gerçek arkadaş çiftlerinde eski/yeni yan yana | Y2 | 1 | hayır |
| 3 | Yapım uyumu geri testi | Y3 | — (bağımsız) | hayır |
| 4 | Katılım, eşleşme gücü, görevler | Y1 | 1 | hayır |
| 5 | Sunucu hattı | Y1 | 1 | **evet** |
| 6 | İkiz/çember arayüzü + arkadaş kartının görünür geçişi | Y1 + Y2 | 2, 4, 5 | istemci build |
| 7 | Gerçek veriyle kalibrasyon + ikiz sinyali | Y1 + Y3 | 6 + 150 etkin kullanıcı | evet |

Faz 1–4 hiçbir sunucu değişikliği istemez ve gerçek kullanıcıya dokunmaz; önce bunlar biter.
Bir fazın kabul ölçütleri sağlanmadan sonrakine geçme. Her faz ayrı oturumda yapılabilir: faz
sonunda `docs/planlama/DEVAM_NOTU_ZEVK_ESLESMESI.md` dosyasını güncelle (ne bitti, ne
doğrulanmadı, sıradaki adım).

## 1. Çalışma kuralları (hepsi kullanıcıdan)

- Yanıtlar **Türkçe**. Arayüz metinleri mevcut dil dosyası düzeniyle desteklenen tüm dillere girer.
- Kullanıcı istemedikçe **commit yok, push yok, deploy yok**. `git stash` **asla** kullanılmaz.
- **Codex aynı klasörde aynı anda çalışıyor.** Dokunmadığın dosyadaki değişikliği geri alma,
  biçimlendirme, "düzeltme". `git add` gerekirse yalnız kendi dosyalarının tam yoluyla.
- Dosyalarda CRLF/LF karışık olabilir. Düzenlemeden önce oku; toplu `sed` yerine `Edit`.
- Kurallar ya da functions deploy'u **kullanıcı onayıyla**; deploy'dan önce canlı kurallarla
  çalışma ağacını karşılaştır (deploy tüm dosyayı gönderir).
- Yalnız 18+ ve yalnız katılmayı seçen kullanıcı havuzda görünür. Flört öğesi yok: kartta yaş,
  konum, cinsiyet gösterilmez.
- Ölçülmeyen şeye "çalışıyor" deme. Cihazda görülmediyse raporda öyle yaz.

Doğrulama komutları:

```bash
npx jest __tests__/tasteMatchV3.test.js
```

```bash
npm test
```

```bash
npm run test:rules
```

```bash
cd functions && npm test
```

`test:rules` JDK 21 ister (bu makinede JetBrains JBR). `functions` testleri `node --test` ile
çalışır, jest değil. Arayüz web önizlemede doğrulanamaz (React Native yerleşimi): jest render
testi + Geliştirici Laboratuvarı ekranı + mümkünse emülatör.

## 2. Faz 0 — Hazırlık

### 2.1 Veri envanteri (13 Kas'ta koddan okundu; başlamadan önce yeniden doğrula)

| Sinyal | Nerede | Not |
|---|---|---|
| Açık puan | `Users/{uid}/myRatings/{mediaKey}` (ayna) ve `Ratings/{mediaKey}/userRatings/{uid}`; 0–10 | Sunucu profili **aynadan** okur: kullanıcı başına tek koleksiyon. `services/ratingsService.js` |
| İzlenen film | `Lists/{uid}` altındaki öğeler: `{ id, type, name, dateAdded, minutes, genres, watchEvents[] }` | `services/listItemsService.js` başındaki şema yorumu kaynak |
| Tekrar izleme | `watchEvents.length ≥ 2` | film ve dizi |
| Dizi ilerlemesi | izleme olaylarında `episodeKeys`, `episodeCount`, `seasonCount`; kökte `statusIndex.tv.{id}.isWatched` | `services/watchedTvService.js` |
| Dört favori | `Users/{uid}` alanı | `services/fourFavoritesService.js` |
| Doğum tarihi | `Users/{uid}.birthDate` | `isAdultBirthDate` ile 18+ sınanır |
| Liste görünürlüğü | `listVisible` | arkadaş kartında aynen geçerli |
| Engel / şikâyet | `services/friendsService.js`, `services/reportService.js`, `BlockedUsersScreen` | yenisi yazılmaz |
| Uzaktan ayar | `AppConfig/{belge}` (örnek: `AppConfig/emmy`) | `AppConfig/match` buna uyar |

**Liste kayıtlarında olmayanlar:** TMDB oy ortalaması ve oy sayısı, köken dili, anahtar kelime,
dizinin toplam bölüm sayısı ve yayın durumu. "Diziyi bitirdi / yarıda bıraktı" sinyali toplam
bölüm sayısı olmadan **çıkarılamaz**. Bunların hepsi Faz 5'teki `TitleFeatures` önbelleğinden gelir.

### 2.2 Kararlar

Verilmiş (13 Kas): flört değil; 18+ ve yalnız katılan görünür; ~10 kişilik çember ve %90 eşiği;
yalnız film izleyip puan vermeyenler için kural **şimdilik sıkı** (algoritma §9.5).

Açık — ilgili faza gelince **kullanıcıya sor**, kendin karar verme:

| Karar | Önerilen varsayılan | Faz |
|---|---|---|
| Karşılıklı selam ne oluşturur? | **Arkadaşlık.** Mevcut sohbet, arkadaş profili, engelleme ve "arkadaş çıkar = sohbet sil" akışı aynen çalışır; ayrı bir "eşleşme sohbeti" türü yazılmaz. | 5 |
| Eşleşmeden önce kartta ne görünür? | Avatar + görünen ad + zevk özeti. **Kullanıcı adı ve `uid` görünmez** (Faz 5 güvenlik notu). | 5–6 |
| Arkadaş kartının yeni kademeleri | 85 / 65 / 40 (eski 75 / 55 / 35). Faz 2 ölçümünden sonra kesinleşir. | 6 |
| Yüzdelerin düşeceği duyurulsun mu? | Sürüm notunda tek cümle. | 6 |
| Premium farkı | Yok (beta'da herkes Max). | 6 |
| Gizlilik metni | Yeni veri işleme (eşleşme profili) gizlilik sayfasına ve katılım onayına yazılır. | 4 |

### 2.3 Açma/kapama bayrağı

`AppConfig/match.enabled` (varsayılan `false`) + `__DEV__` zorlaması. Bayrak kapalıyken uygulamada
eşleşmeye dair **hiçbir** öğe görünmez ve hiçbir yeni okuma yapılmaz. Faz 6'ya kadar kapalı kalır.

**Kabul:** envanter tablosu koda karşı yeniden doğrulandı; farklar bu belgeye işlendi.

## 3. Faz 1 — Saf çekirdek

**Amaç.** Algoritma belgesi §3–§7'yi bağımlılıksız, saf bir modül olarak yazmak.

**Sunucu–istemci paylaşımı: ayna dosya düzeni.** `functions/` klasörü tek başına deploy edilir ve
CommonJS'tir; `utils/` altındaki dosyayı `require` edemez. Bu depoda yerleşik çözüm iki kopya ve
eşitlik testidir (örnek: `utils/leagueRules.js` ↔ `functions/leagueRules.js`, eşitliği
`__tests__/leagueRules.test.js` denetler). Aynısını uygula:

- `utils/tasteMatchV3.js` (istemci, `export`),
- `functions/tasteMatchCore.js` (sunucu, `module.exports`), başında "ayna" notu,
- `__tests__/tasteMatchV3.parity.test.js`: aynı sabit girdi kümesinde iki modül **aynı** çıktıyı
  verir. Sunucu kopyası Faz 5'te yazılır; Faz 1'de istemci modülü ve testleri yeter.

**Adımlar**

1. Simülasyondaki `explicitS`, `learnImplicit`, `prepare`, `center`, `parts3`, `scoreV3`
   fonksiyonlarını oku. Sentetik veri üreten kısımları alma.
2. Üç katman:
   - `buildContext(population, config)` → öğrenilen tablolar (örtük sinyal tablosu, `r_ie`, γ,
     nadirlik, şans medyanı/yayılımı, kulvar ortalama profili). Girdi yoksa algoritma §13
     varsayılanları.
   - `buildProfile(userLaneData, ctx)` → tek kullanıcının özeti. **`MatchProfiles` belgesinin
     şekli budur**; düz JSON olsun, boyutu ölç (Firestore belge sınırı 1 MiB; 1000 yapımlık
     kütüphanede profil bunun çok altında kalmalı, kalmıyorsa yapım başına alanları kısalt).
   - `scorePair(profileA, profileB, ctx)` → `{ score, K1, K2, K3, E1, caps, flags, explain }`.
     `explain` arayüz içindir: en çok katkı veren ortak yapımlar, ayrışılan yapım, ortak baskın
     özellikler. Ham liste içermez.
3. Bütün sabitler dosya başında tek `DEFAULTS` nesnesinde; `config` ile ezilebilir.
4. Yarı-bölme **belirlenimli** olsun (yapım kimliğinin tek/çift olması). Aynı girdi aynı skor.
5. `laneOf(title, features)` → `movie | tv | anime`. Anime = animasyon türü + köken dili Japonca.
   Köken dili yoksa (istemci, Faz 2) anime kendi türünde (film/dizi) kalır.
6. **K3'ün iki kipi:** `full` (anahtar kelime, dil, popülerlik, stüdyo; `TitleFeatures` ister) ve
   `lite` (yalnız liste kayıtlarındaki tür + on yıl + süre kovası). Kip `ctx` ile seçilir ve
   çıktıda `flags.k3Mode` olarak döner.
7. `__tests__/tasteMatchV3.test.js`: algoritma §14 tablosu birebir (D1–D10 + tavan tabloları).
8. Simülasyonu çekirdeğe bağla: `scripts/sim/tasteMatchV3Sim.js` modülü içe aktarsın ve tohum
   7, 11, 23 için algoritma §12 tablosunu yeniden üretsin. Üretemiyorsa kod hatalıdır.

**Kabul ölçütleri**

- [ ] D1–D10 testleri geçiyor.
- [ ] Simülasyon üç tohumda §12 aralıklarında: ≥ 90 alanların ≥ %99'u gerçek ≥ 0.80; rastgele
      çiftlerin %99'u ≤ 45; 100 ⊂ 1000 → 75–78.
- [ ] 1000 yapımlık iki profilde `scorePair` süresi ölçüldü ve rapora yazıldı (gecelik işin
      bütçesi buna göre hesaplanacak).
- [ ] `npm test` tam paket temiz. Mevcut `tasteMatch.test.js` dokunulmadı.

**Tuzaklar**

- Klasik Pearson **kullanma**: payda ortak yapımlardan değil kütüphanenin tamamından gelir (§5.1).
- Negatif ham skoru çekirdekte kırpma; testler ham değere bakar, arayüz 0 alt sınırını uygular.
- "Görüş yok" ile `s = 0` aynı şey değil. Sinyalsiz izlenmiş kayıt K1'e girmez.

## 4. Faz 2 — Gölge mod: gerçek çiftlerde ilk gözlem (Y2)

**Amaç.** Kullanıcıya hiçbir şey değiştirmeden, yeni çekirdeğin **gerçek** arkadaş çiftlerinde ne
verdiğini görmek. Simülasyon sentetiktir; bu, gerçek veriyle ilk temastır.

**Adımlar**

1. `screens/tabs/profile/FriendProfileScreen.js` içinde, yalnız `__DEV__` iken, mevcut
   `computeTasteMatch` çağrısının yanında `scorePair` de çalışsın (K3 `lite` kipinde, arkadaşın
   yalnız görünür listeleriyle). Sonuç ekrana **yazılmaz**.
2. Geliştirici Laboratuvarı ekranına (`screens/tabs/settings/DevLabScreen.js`) "Zevk uyumu:
   eski / yeni" satırı: son bakılan arkadaşlar için eski yüzde, yeni yüzde, K1/K2/K3, E1, hangi
   tavanın bağladığı.
3. Kullanıcıdan kendi arkadaşlarında tabloya bakmasını iste ve şunu sor: "Gerçekten en benzer
   bulduğun arkadaş yeni hesapta da en üstte mi?" Sıralama, yüzdeden daha önemlidir.
4. Bulguları `DEVAM_NOTU` dosyasına yaz. Belirgin bir yanlışlık varsa (ör. herkes 0–20 arasında)
   önce nedenini bul: çoğunlukla az veri ya da varsayılan tablolardır, formül değil.

**Kabul ölçütleri**

- [ ] Üretim derlemesinde ek hesap **çalışmıyor** (yalnız `__DEV__`).
- [ ] En az 5 gerçek arkadaş çifti için eski/yeni tablo rapora eklendi **ya da** kullanıcının
      bakamadığı açıkça yazıldı.

## 5. Faz 3 — Yapım uyumu geri testi (Y3, bağımsız)

**Bugünkü durum.** `utils/titleTasteFit.js` → `computeTitleTasteFit` (12 bileşen, az örnekte 0.5'e
çekme, zaman ağırlığı); arayüz `components/detail/TasteFitButton.js`. Hesap sağlam. Eksik:
gösterdiği yüzdenin gerçekle tutup tutmadığı hiç ölçülmedi.

**Adımlar**

1. `scripts/sim/titleFitBacktest.js` (geliştirme aracı): mevcut kütüphane dışa aktarım JSON'unu
   (`services/libraryExport.js` biçimi) alır; puanlanmış her yapımı sırayla gizler, kalanlarla
   `computeTitleTasteFit` çalıştırır, tahmini gerçek puanla karşılaştırır.
2. `similar` ve `public` bileşenleri TMDB verisi ister. Araç ağa çıkmasın: bu bileşenleri kapalı
   çalıştır ve raporda belirt, ya da kullanıcı onayıyla önceden indirilmiş bir önbellek kullan.
3. Çıktı: skor bandına göre (0–40, 40–55, 55–70, 70–85, 85+) gerçek puan ortalaması, sıra
   korelasyonu, bileşen başına katkı. **Bant yükseldikçe gerçek puan ortalaması kesintisiz
   artmalı.**
4. Artmıyorsa ağırlıkları bu ölçüme göre ayarla, aracı yeniden çalıştır, sabit testlerini güncelle.
   Tek bir kişinin kütüphanesine aşırı uydurma: değişiklik küçük ve gerekçeli olsun.
5. Yalnız kullanıcının kendi dışa aktarımı, onayıyla. Dosyayı depoya koyma.

**Kabul ölçütleri**

- [ ] Araç çalışıyor; kullanıcının kütüphanesiyle sonuç tablosu üretildi.
- [ ] Ağırlık değiştiyse önce/sonra tablosu raporda.
- [ ] `titleTasteFit.test.js`, `tasteFitButton.test.js` temiz.

## 6. Faz 4 — Katılım, eşleşme gücü, görevler (Y1, istemci)

**Amaç.** Eşleşme olmadan da değerli kısım: kullanıcıya verisinin yeterliliğini göstermek.

**Adımlar**

1. `utils/matchStrength.js`: ürün belgesi §4 tablosu (kulvar başına güç, giriş eşikleri, izleme
   yolu). Saf fonksiyon + jest. Sınır değerleri sına (29/30 izleme, 19/20 puan).
2. Katılım: Ayarlar'da anahtar + kulvar seçimi, varsayılan kapalı. 18+ değilse ya da doğum tarihi
   yoksa satır **hiç çizilmez**. Açarken kısa onay metni: hangi verinin işlendiği, kimin göreceği,
   nasıl çıkılacağı. Alan: `Users/{uid}.matchOptIn` + seçilen kulvarlar; yazım kuralı yalnız
   sahibi (kural testi).
3. Gizlilik sayfası ve kütüphane dışa aktarımı güncellenir (eşleşme profili yeni bir veri işleme).
   Metni kullanıcıya göster, onaysız yayınlama.
4. Hub'da "Zevk Çemberleri" kartı: güç yüzdesi + **tek** sonraki adım. Algoritma §7'deki
   "ulaşılabilir en yüksek skor" tablosunu kullan: ikiz için ne kadar veri gerektiğini söyle.
5. Görevler mevcut Meydan Okumalar ve rozet altyapısına bağlanır; yeni görev sistemi yazılmaz.
6. Ölçüm olayları (`services/analytics.js` düzeni): katılım açıldı/kapandı, güç kademesi, görev
   tamamlandı. Kişisel veri içermez.

**Kabul ölçütleri**

- [ ] Bayrak ya da katılım kapalıyken hiçbir eşleşme öğesi ve hiçbir yeni okuma yok.
- [ ] Tüm dillerde metin var; yinelenen i18n anahtarı yok.
- [ ] Onay ve gizlilik metni kullanıcıya gösterildi.

## 7. Faz 5 — Sunucu hattı (Y1)

**Amaç.** Profilleri ve skorları sunucuda üretmek. Ham liste hiçbir zaman başka kullanıcıya gitmez.

**Güvenlik notu (koddan, 13 Kas).** `firestore.rules` içinde bire bir sohbet üyeliği
`isChatMember(chatId)` ile sınanıyor: `chatId` (`uidKüçük_uidBüyük`) kullanıcının `uid`'sini
içeriyorsa üye sayılıyor. Mesaj oluşturma şartı üyelik + gönderen kimliği + iki yönlü engel
denetimi; **arkadaşlık şartı kural düzeyinde yok**. Yani bir `uid` bilen, engellenmemiş herkes o
kişiye mesaj yazabilir. Sonuçları:

- **Eşleşmeden önce `uid` ve kullanıcı adı istemciye gönderilmez.** Aday kartı çifte özel opak
  bir kimlikle gelir. "Eşleşmeden mesaj atılamaz" güvencesi buna dayanır.
- Bu, eşleşmeden bağımsız mevcut bir durumdur. Kendin kapatma (kural değişikliği canlı sohbeti
  etkiler); kullanıcıya bildir, ayrı iş olarak ele alınsın.

**Adımlar**

1. `functions/tasteMatchCore.js`: Faz 1 modülünün CommonJS aynası + eşitlik testi.
2. **`TitleFeatures/{tür_id}`** (`functions/matchTitleFeatures.js`): yapım başına bir kez TMDB'den
   oy ortalaması, oy sayısı, köken dili/ülkesi, anahtar kelimeler, süre, sezon ve **toplam bölüm
   sayısı**, yayın durumu, yapım şirketi. 90 günde bir tazeleme. İstemci bu koleksiyonu okumaz.
3. **`MatchProfiles/{uid}`**: yalnız `matchOptIn` açık **ve** 18+ kanıtlı kullanıcı için, kulvar
   başına `buildProfile` çıktısı. Girdi: `Users/{uid}/myRatings`, `Lists/{uid}` öğeleri, favoriler.
   - Her yazımda yeniden hesaplama **yapma**. Kullanıcı başına en çok 6 saatte bir; kökteki
     güncelleme damgası değişmediyse hiç okuma.
   - Kütüphanenin tamamını okumak pahalıdır (1000 yapım = 1000 okuma). İlk kurulumda bir kez
     tam okuma, sonrasında yalnız damgadan yeni olan öğeler.
4. **Gecelik iş** (`onSchedule`): kulvar başına `buildContext` → çiftlerde `scorePair` →
   `MatchSuggestions/{uid}` (en çok 5 ikiz adayı, çember daveti, `explain` özeti, opak aday
   kimliği). Öğrenilen tablolar `AppConfig/match` altına.
   - Çalışma süresini Faz 1 ölçümünden hesapla; zaman aşımına sığmıyorsa kulvarlara böl. Havuz
     1000'i geçince önce K3 ile en yakın 100 aday süzülür.
   - İş **yeniden çalıştırılabilir** olsun: yarıda kesilirse tekrarında aynı sonucu yazar.
5. **`matchHello` callable**: opak aday kimliğiyle selam. Hız sınırı ve girdi doğrulaması için
   `functions/userSearch.js` desenini izle. Karşılıklıysa §2.2'deki karara göre arkadaşlık kurulur
   (mevcut arkadaşlık yazım yolunu kullan, elle belge üretme) ve iki tarafa mevcut bildirim
   hattından (`Users/{uid}/notifications`) bildirim gider.
6. **`getPairScore` callable** (Y2 için): iki taraf da havuzdaysa `MatchProfiles` üzerinden
   sunucu skorunu döner; arkadaş kartı bunu kullanır (Faz 6). Yalnız arkadaşlar arasında çalışır.
7. **Kurallar** (`firestore.rules`): `MatchProfiles` ve `TitleFeatures` istemciye kapalı;
   `MatchSuggestions` yalnız sahibi okur, kimse yazamaz. Her biri için `__tests__/rules/` altında
   izin **ve** ret testi.
8. **Ayrılma ve silme:** katılım kapanınca profil, öneriler ve bekleyen selamlar silinir. Yeni
   koleksiyonlar `functions/accountPurge.js` ve `accountPurge.integration.test.js` içine eklenir.
9. **Engelleme:** engellenen kişi adaylardan ve çemberden düşer; gecelik iş engel listesini okur.
10. Yeni fonksiyonlara düşük `maxInstances` ver (`functions/capacity.js` düzeni). Toplu deploy
    Cloud Run CPU kotasını doldurabilir; deploy sırası kullanıcıya yazılır: functions → rules.

**Kabul ölçütleri**

- [ ] `cd functions && npm test` temiz; eşitlik testi geçiyor.
- [ ] `npm run test:rules` temiz; başka kullanıcının `MatchProfiles` belgesi okunamıyor.
- [ ] Katılmamış, 18 yaş altı ya da doğum tarihi olmayan hesap için hiçbir belge oluşmuyor (test).
- [ ] `MatchSuggestions` içinde eşleşmemiş adayın `uid`'si ve kullanıcı adı **yok** (test).
- [ ] Hesap silme testinde yeni koleksiyonlar temizleniyor.
- [ ] Kullanıcı başına günlük okuma tahmini rapora yazıldı (hedef: gecelik iş dışında ~2 belge).
- [ ] Deploy **yapılmadı**; kullanıcıya sıra, maliyet notu ve sohbet kuralındaki arkadaşlık
      şartı eksikliği bildirildi.

## 8. Faz 6 — Arayüz ve görünür geçiş (Y1 + Y2 birlikte)

İkiz/çember arayüzü ile arkadaş kartının yeni yüzdeye geçişi **aynı sürümde** çıkar. Böylece
kullanıcı tek bir tutarlı değişiklik görür.

**İkiz ve çember (Y1)**

1. İkiz kartı: `components/friends/TasteMatchCard.js` görsel dilinde **yeni** bileşen (mevcut kartı
   çatallama). İçerik: skor, `explain` özetinden ortak sevilenler ve ayrışılan bir yapım, görüş
   kanıtı ağırlıkla örtükse "İzleme geçmişinize göre" etiketi.
2. Selam → karşılıklıysa bildirim ve hazır konuşma başlatıcıyla mevcut sohbet. Günlük selam
   sınırı sunucuda.
3. Çember: mevcut grup sohbeti (`services/groupsService.js`). Kurulum kuralı algoritma §8.
4. Soğuk başlangıç: kulvarda 150 etkin kullanıcıya kadar "ikiz" sözü yok; 80+ skorlar "yakın
   zevk". Havuz sayacını göster.
5. Engelle / şikâyet et / ayrıl her ekranda (mevcut servisler).
6. Geliştirici Laboratuvarı'na sahte veriyle tüm durumlar: skor yok, az veri, yakın zevk, ikiz,
   rehber, çember daveti. Görsel denetim buradan yapılır.

**Arkadaş kartı (Y2)**

Koddan doğrulanan sorunlar: ortak izlenen `√(ortak / küçük liste)`; tür benzerliği merkezlenmemiş
kosinüs (ağırlık 0.4); puan uyumu mutlak fark; az veride yüzde aşağı çekilmiyor. Sonuç: rastgele
iki kişi ~%50, alt küme %100.

7. Yüzde kaynağı: iki arkadaş da havuzdaysa `getPairScore` (24 saat önbellek); değilse istemcide
   `scorePair`, K3 `lite` kipinde ve arkadaşın yalnız görünür listeleriyle. Gizlilik kuralı
   aynen: kapalı liste = bilinmiyor, boş değil.
8. Kartın **içgörü** alanları (`loved`, `split`, `highlights`, `genres.table`, `deep`, `byType`)
   eski modülden gelmeye devam eder; yalnız üstteki yüzde, kademe ve bileşen çubukları değişir
   (Görüş uyumu, Seçim benzerliği, İçerik profili).
9. Kademe eşikleri Faz 2 tablosuna göre kesinleşir (öneri 85 / 65 / 40). `TasteMatchInfoSheet`
   ve `tasteMatchCopy` güncellenir.
10. "Uyumu sohbete gönder" balonu: mesajda saklı skor aynen gösterilir, yeniden hesaplanmaz.
11. Eski `overlap` / `agreement` hesapları yalnız içgörü için gerekiyorsa kalır, **skora girmez**.
    Kullanılmayanı sil, testlerini güncelle.

**Kabul ölçütleri**

- [ ] İki taraf da havuzdayken arkadaş kartındaki ve eşleşmedeki yüzde **aynı** (test).
- [ ] Render testleri: tüm durumlar. `tasteMatch.test.js`, `tasteMatchCard.test.js` temiz.
- [ ] Liste gizliliği testleri hâlâ geçiyor.
- [ ] Bayrak kapalıyken uygulama bugünkü gibi davranıyor (arkadaş kartı dahil).
- [ ] Emülatörde uçtan uca denendi **ya da** denenmediği raporda açıkça yazıldı.
- [ ] Kullanıcıya söylendi: mevcut yüzdeler **düşecek**; duyuru kararı onda.

**Yayın sırası.** Bayrak kapalı sürüm → functions + rules deploy → yalnız kullanıcının kendi
hesabı ve test hesaplarında bayrak açık → herkese. Geri alma: bayrağı kapatmak.

## 9. Faz 7 — Kalibrasyon ve ikiz sinyali (gerçek veri gelince)

Kulvarda 150 etkin katılımcı olmadan başlamaz (algoritma §11).

1. **Gizli veri testi** (algoritma §11.1) gecelik işin yanında ayrı bir iş; sonuç
   `AppConfig/match.calibration`. `ÖLÇEK`, `Z_REF` ve görüş ön değeri bu ölçüme göre ayarlanır.
   Sayıları elle "iyi görünsün" diye değiştirme.
2. **Ürün ölçümü:** eşleşme → ilk mesaj oranı, 7 gün sonra hâlâ konuşan çiftlerin oranı, engelleme
   ve şikâyet oranı. Skor bandı yükseldikçe konuşma oranı artıyorsa hesap işini yapıyordur.
3. Karar noktası (kullanıcıya sor): yalnız film izleyip puan vermeyenler için kuralın
   gevşetilmesi (algoritma §9.5).
4. **Y3'e ikiz sinyali:** `computeTitleTasteFit` içine `twins` bileşeni: ikizlerin ve çember
   üyelerinin o yapıma verdiği, kişisel sıraya çevrilmiş görüşün ortalaması. Sunucu yapım başına
   **özet** verir, ham puan gitmez. En az 3 görüş yoksa bileşen düşer. Ağırlığı Faz 3 aracıyla
   belirlenir.

## 10. Her fazın sonunda

1. Rapor: ne yapıldı (dosya adlarıyla); hangi testler çalıştı ve sonucu; ne **doğrulanmadı**;
   kullanıcıdan beklenen karar varsa tek soru.
2. `docs/planlama/DEVAM_NOTU_ZEVK_ESLESMESI.md` güncellenir.
3. Kaynak belgelerle çelişen bir şey bulduysan (alan adı, yol, varsayım) **bu rehberi ve ilgili
   belgeyi düzelt**; sessizce etrafından dolaşma.
4. Commit, push ve deploy teklif edilir, kendiliğinden yapılmaz.

## 11. Yapılmayacaklar

- Skoru yükseltmek için formüle "iyi görünsün" ayarı. Öncelik yanlış ikiz göstermemek.
- İstemcinin başka bir kullanıcının ham listesini, `MatchProfiles` belgesini ya da eşleşmemiş
  adayın `uid`'sini görmesi.
- Katılmamış kullanıcıyı herhangi bir biçimde aday göstermek.
- Kartta yaş, konum, cinsiyet; fotoğraf öncelikli tasarım.
- Yeni bir sohbet, grup, görev, engelleme ya da bildirim sistemi yazmak (mevcutlar kullanılır).
- Eşleşme için sürekli açık Firestore dinleyicisi (maliyet).
- Sunucu ve istemci hesabını ayrı ayrı elden yazıp eşitlik testini atlamak.
- Sentetik simülasyon sonucunu gerçek kullanıcı sonucu gibi sunmak.

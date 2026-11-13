# Zevk Eşleşmesi — Benzerlik Algoritması (v3 kuralları, 13 Kas 2026)

> Bu belge, [ZEVK_ESLESMESI.md](ZEVK_ESLESMESI.md) içindeki özelliğin **benzerlik hesabının
> bağlayıcı kurallarıdır**. İki belge çelişirse hesap konusunda bu belge geçerlidir.
>
> Durum (13 Kas, v3.1): çekirdek yazıldı — `utils/tasteMatchV3.js`, testler
> `__tests__/tasteMatchV3.test.js`, tam ölçek ölçüm `scripts/sim/tasteMatchV3.sim.js` (§12).
> Kodlama sırasında ölçümle üç kusur bulundu ve kurallar düzeltildi (§3.2, §3.3, §10; değişiklik
> özeti §16). Gerçek kullanıcı verisiyle henüz **hiçbir şey ölçülmedi**; kalibrasyon §11.
> İlk taslak simülasyon [ZEVK_ESLESMESI_SIM.js](ZEVK_ESLESMESI_SIM.js) artık yalnız tarihçedir.

## 1. Hedef: "mükemmele yakın" ne demek

Skorun tek görevi şu soruyu doğru yanıtlamak: **"Bu iki kişi aynı yapımı izlese, aynı şeyi
hisseder mi; ve izlemeyi seçtikleri şeyler aynı türden mi?"**

Öncelik sırası:

1. **Yanlış ikiz göstermemek.** %90 alan bir çift gerçekten çok benzer olmalı. Kaçırılan bir
   ikiz, yanlış bir ikizden çok daha az zararlıdır: kullanıcı ilk yanlış eşleşmede özelliğe
   güvenmeyi bırakır.
2. **Emin olmadığında düşük konuşmak.** Az veriyle yüksek skor verilmez.
3. **Adil olmak.** Sert ya da cömert puanlayan, az ya da çok izleyen, puan vermeyen kullanıcı
   sırf bu yüzden haksız skor almaz.

### 1.1 On değişmez kural

Algoritma ne kadar değişirse değişsin bu kurallar korunur. Her biri otomatik testle sınanır (§14).

| # | Kural | Anlamı |
|---|---|---|
| D1 | **Simetri** | `skor(A,B) = skor(B,A)`. |
| D2 | **Şans sıfırdır** | Rastgele iki kişinin skoru 0 civarındadır. "İkisi de iyi filmleri seviyor" benzerlik sayılmaz. |
| D3 | **Ölçek bağımsızlığı** | Bir kişi tüm puanlarını 2 puan düşürse de skor değişmez. Sert ve cömert puanlayan aynı zevkteyse eşleşir. |
| D4 | **Alt küme tuzağı** | 100 yapımlık liste 1000 yapımlık listenin içindeyse ikiz çıkmaz. |
| D5 | **Az veri alçakgönüllülüğü** | Kanıt azaldıkça skor düşer. İki ortak filme 10 vermek eşleşme değildir. |
| D6 | **Popülerlik bağışıklığı** | Herkesin izleyip sevdiği yapımları paylaşmak skoru çok az yükseltir. Az bilineni paylaşmak çok yükseltir. |
| D7 | **Zıtlık duyarlılığı** | Aynı yapımları izleyip zıt düşünen iki kişi düşük skor alır. Ortak izlemek tek başına benzerlik değildir. |
| D8 | **Sessiz adalet** | Puan vermeyen iki benzer kişi düşük çıkmaz, ama aynı kesinliğe ulaşmak için daha çok ortak veri gerekir. |
| D9 | **Kesinlik üstünlüğü** | Zayıf kanıt (davranış) güçlü kanıttan (puan) daha yüksek bir skoru tek başına kanıtlayamaz. |
| D10 | **Kopyaya direnç** | Birinin listesini kısa sürede kopyalamak ikiz üretmez. |

## 2. Genel yapı

Hesap **kulvar** bazında yapılır (Film, Dizi, Anime); yalnız o kulvarın yapımları girer.

```
ham kayıtlar ──► (1) tercih puanı s ──► (2) kalabalıktan sapma d ──┐
                                                                    ├─► K1 Görüş uyumu  ─┐
izleme kümeleri + nadirlik ağırlığı ────────────────────────────────┼─► K2 Seçim benzerliği ├─► güven daraltması ─► birleşik B ─► tavanlar ─► skor (0–100)
yapım özellikleri (tür, anahtar kelime, dönem…) ────────────────────┴─► K3 İçerik profili ─┘
```

Üç kanıt ailesi birbirini tamamlar:

| Aile | Yanıtladığı soru | Güçlü yanı | Zayıf yanı |
|---|---|---|---|
| **K1 Görüş uyumu** | İkisinin de izlediği yapımlar hakkında aynı mı düşünüyorlar? | En kesin kanıt | Ortak yapım gerektirir |
| **K2 Seçim benzerliği** | Aynı yapımları mı seçiyorlar? | Puan gerektirmez | Liste büyüklüğüne duyarlı |
| **K3 İçerik profili** | Aynı **tür** şeyleri mi seviyorlar? | Ortak yapım gerektirmez | Üstveri zevkin her boyutunu görmez |

## 3. Adım 1 — Tercih puanı `s`

Her (kullanıcı, yapım) kaydı `[−1, +1]` aralığında bir tercih puanına çevrilir. `+1` "en
sevdiklerimden", `−1` "en sevmediklerimden", yok ise "görüş bilinmiyor".

### 3.1 Açık puan (K-1)

Puan, **kişinin kendi puan dağılımındaki sırasına** çevrilir. Mutlak değerine bakılmaz.

```
p        = puanın, kişinin o kulvardaki tüm puanları içindeki orta-sıra yüzdeliği   (0…1)
s_kişi   = 2p − 1
λ        = n_puan / (n_puan + 10)
s        = λ · s_kişi + (1 − λ) · s_genel(puan)
```

- `s_genel(puan)`: aynı puanın tüm kullanıcıların dağılımındaki yüzdeliği. Az puanı olan
  kullanıcının kişisel sırası güvenilmezdir, bu yüzden nüfus değerine çekilir.
- **Neden sıra?** Puanlarının %40'ı 10 olan biri için 10 "iyi" demektir; %2'si 10 olan biri için
  "başyapıt". Sıra bunu kendiliğinden ayırır ve D3'ü tam olarak sağlar. Ortalama/standart sapma
  ile normalleştirme çarpık dağılımlarda bunu sağlamaz.

### 3.2 Örtük sinyal (K-2)

Puan yoksa davranıştan tercih çıkarılır. Öncelik sırasıyla ilk eşleşen kullanılır:

| Davranış | Başlangıç `s` | Kaynak |
|---|---|---|
| Dört favoride | +0.60 | favoriler |
| Tekrar izledi (`watchCount ≥ 2`) | +0.45 | `watchEvents` |
| Diziyi bitirdi ve sonraki sezona başladı | +0.30 | bölüm ilerlemesi |
| Diziyi bitirdi | +0.10 | bölüm ilerlemesi |
| Diziyi yarıda bıraktı (< %50, 60+ gün dokunulmadı, yayını sürmüyor) | −0.60 | bölüm ilerlemesi |
| Yalnız "izlendi" (başka davranış yok) | −0.05, ağırlık ×0.25 | izleme kaydı |

- **Tablo veriden öğrenilir (K-2a).** Hem puan veren hem bu davranışı gösteren kullanıcılarda,
  her davranışın karşılık geldiği **ortalama açık `s`** hesaplanır ve tablodaki değerin yerine
  geçer (davranış başına ≥ 300 örnek olunca). Yani "bitirmek ne kadar beğeni demek" tahmin
  edilmez, ölçülür.
- **Bilgi ağırlığı (K-2b).** Örtük sinyal açık puandan zayıftır. Ağırlığı da ölçülür:
  `r_ie` = tablo değeri ile aynı kayıttaki açık `s` arasındaki korelasyon;
  `q_örtük = (r_ie / R_E)²`. Başlangıç değeri `0.30`. Açık puan için `q = 1`.
- Açık puan varsa örtük sinyal o yapım için yok sayılır.
- **"Yalnız izlendi" karşılaştırma tabanıdır (v3.1).** İlk taslakta görüş sayılmıyordu. Ölçüm
  bunun yanlış olduğunu gösterdi: filmlerde örtük sinyalin yalnız olumlu türleri var (favori,
  tekrar izleme). Taban olmadan iki sessiz kullanıcının ortak sinyalleri hep olumlu çıkıyor ve
  **rastgele** sessiz çiftlerin görüş uyumu medyanı 0.50'ye çıkıyordu (D2 ihlali). Taban
  eklenince 0.11'e indi. Kanıtı şişirmesin diye ağırlığı diğer örtük sinyallerin dörtte biridir;
  değeri de tablo gibi öğrenilir. İçerik profilinde (K3) eskisi gibi hafif ileri iter.

### 3.3 Kalabalıktan sapma `d` (K-3)

İyi yapımı herkes sever. İki kişinin Esaretin Bedeli'ni sevmesi zevkleri hakkında neredeyse hiçbir
şey söylemez. Bu yüzden görüş uyumu, tercihin **genel kanıdan sapan kısmı** üzerinden ölçülür:

```
c_i   = TMDB vote_average'ın kulvar içindeki yüzdeliği → [−1, +1]
ŝ_i   = beklenen s:
          yapım GENİŞ izleniyorsa (≥ 20 puanlayan VE puan veren nüfusun ≥ %20'si):
            ŝ_i = ( n_i · ort(s_i) + 20 · γ·c_i ) / ( n_i + 20 )     // nüfusun kendi kanısı
          değilse:  ŝ_i = γ · c_i                                   γ = 0.45 (ölçülür)
açık puan:    d = s − ŝ_i
örtük sinyal: d = s − μ_örtük          // μ_örtük = örtük sinyallerin nüfus ortalaması (ölçülür)
```

Bu adım D2'yi sağlar: rastgele iki kişinin `d` değerleri ilişkisizdir.

**v3.1 düzeltmeleri (kodlamada ölçüldü):**

- **Örtük sinyalden genel kanı çıkarılmaz.** İlk taslak `d = s − γ·c` kuralını örtük sinyale de
  uyguluyordu. Davranış tablodan geldiği için aynı davranışı gösteren iki kişinin `s` değeri
  birebir aynıdır; ikisine aynı `−γ·c` terimi eklenince çarpım her zaman pozitif çıkar ve sahte
  uyum doğar. Ölçümde puanları silinen ikizler, puanlı hâllerinden **yüksek** skor aldı (D8 ve
  D9 ihlali). Davranış zaten yapımın genel kanısını içerir (iyi diziyi herkes bitirir); bu
  yüzden örtük sinyal yalnız nüfus ortalamasına göre merkezlenir.
- **Herkesin izlediği yapımda genel kanı nüfustan ölçülür.** Yalnız TMDB ortalamasıyla,
  herkesin 8–10 verdiği 50 yapımı paylaşmak skoru ortalama **+16** artırıyordu (D6 ihlali).
  Nüfus kanısıyla artış **−2**.
- **Az izlenen yapımda nüfus kanısı kullanılmaz.** Az izlenen bir yapımın puanlayanları zaten onu
  sevmeye yatkın kişilerdir (seçim yanlılığı). Onların ortalamasını çıkarmak ikizlerin gerçek
  ortak zevkini siler: tüm yapımlara uygulandığında ikiz görüş uyumu 0.67'den 0.47'ye düştü.
  "Geniş izlenen" eşiği bu yüzden var.

Her kullanıcı için ayrıca **beklenen sinyal büyüklüğü** saklanır:
`M_u(tür) = kütüphanedeki d² ortalaması`, açık ve örtük sinyaller için ayrı. Az örnekte nüfus
ortalamasına çekilir (8 sözde gözlem).

## 4. Adım 2 — Nadirlik ağırlığı `w_i` (K-4)

```
w_i = clamp( ln(1 + N / (1 + izleyen_i)) / ln(1 + N / 2),  0.15,  2.2 )
```

`N` kulvar havuzundaki kullanıcı sayısı, `izleyen_i` o yapımı izleyenlerin sayısıdır. Havuzun
yarısının izlediği yapım 1 ağırlık alır, herkesin izlediği 0.15'e iner, çok az kişinin izlediği
2.2'ye çıkar (D6).

Havuz 200 kişiden küçükken `izleyen_i` güvenilmezdir. O zaman TMDB `vote_count` değerinin kulvar
içindeki yüzdeliği `pop` kullanılır: `w_i = 0.25 + 1.5 · (1 − pop)^1.5`.

## 5. Üç kanıt ailesi

### 5.1 K1 — Görüş uyumu (K-5)

İki tarafın da görüşü (açık ya da örtük) olan yapımlar üzerinden:

```
q_i  = √(q_a,i · q_b,i)                      // açık–açık 1 · karışık ≈0.55 · örtük–örtük ≈0.30
t_i  = R_E   (açık–açık, örtük–örtük)        // R_E = 0.75: aynı kişi aynı yapımı yeniden puanlasa beklenen tutarlılık
     = r_ie  (karışık)

K1   = Σ w_i q_i · d_a,i · d_b,i  /  Σ w_i q_i · t_i · √( M_a · M_b )        → [−1, +1]
E1   = Σ q_i                                  // görüş kanıtı (açık puan eşdeğeri ortak görüş sayısı)
```

Okuma: `K1 = 1` "ölçüm gürültüsünün izin verdiği kadar aynı", `0` "rastgele iki kişi",
negatif "sistematik olarak zıt" (D7).

Tasarım notları:

- **Payda ortak yapımlardan değil, kütüphanenin tamamından gelir (`M`).** Klasik Pearson
  korelasyonu yalnız ortak yapımlarda yeniden merkezler. O zaman ikisinin de ortak her şeyi çok
  sevmesi "değişkenlik yok" diye 0 ya da tanımsız çıkar. Burada böyle bir çift yüksek çıkar.
- **`t_i` gürültü düzeltmesidir.** Bir insan aynı filmi iki kez puanlasa bile birebir aynı sonucu
  vermez. Düzeltme olmazsa mükemmel ikizler bile ~0.75'te kalır.
- **Güçlü görüş kendiliğinden ağır basar.** Çarpım `d_a · d_b` olduğu için ikisinin de çok sevdiği
  ya da hiç sevmediği yapım, ikisinin de "idare eder" dediğinden çok daha fazla katkı verir.
- **İsteğe bağlı zaman ağırlığı (simülasyonda sınanmadı):** 5 yıldan eski görüş `×0.7` ağırlık alır.

### 5.2 K2 — Seçim benzerliği (K-6)

```
ham  = Σ_{ortak} w_i  /  √( Σ_A w_i · Σ_B w_i )            // nadirlik ağırlıklı kosinüs
n_g  = √(n_a · n_b)
z    = ( ham − şans_medyanı(n_g) ) / şans_yayılımı(n_g)
K2   = clamp( z / Z_REF, −0.2, 1 )                          Z_REF = 9
```

- **Simetrik.** Payda iki listenin geometrik ortalamasıdır. 100 ⊂ 1000 durumunda ağırlıksız değer
  `100 / √(100·1000) = 0.32` olur; yalnız küçük listeye bölen eski hesap 1.00 veriyordu (D4).
- **Liste büyüklüğü düzeltmesi.** Ham örtüşme liste büyüdükçe kendiliğinden artar: 400'er yapım
  izleyen iki ikiz, 50'şer yapım izleyen iki ikizden çok daha fazla örtüşür. Bu yüzden değer,
  **aynı büyüklükteki rastgele çiftlerin** dağılımına göre ölçülür: medyan ve yayılım (MAD)
  `ln(n_g)` üzerinde doğrusal olarak öğrenilir. Çiftlerin büyük çoğunluğu zaten rastgele çift
  olduğundan bu tahmin sağlamdır. Simülasyonda gerçek ikizlerin `z` değeri liste büyüklüğünden
  bağımsız olarak 6–10 arasında kaldı (§12).
- Şans dağılımı, liste büyüklükleri birbirine yakın (oran ≤ 1.6) çiftlerden öğrenilir.
- **Havuz çok küçükken** (öğrenmek için < ~2000 çift) geçici kural: `K2 = clamp(ham / (0.09 · ln n_g), 0, 1)`.
  Bu katsayı simülasyondan gelir, gerçek veride değişecektir.

### 5.3 K3 — İçerik profili (K-7)

Ortak yapımı az olan ama aynı türden şeyler seven iki kişiyi yakalar. Anime kulvarında TMDB
türleri ayırt edici değildir (hepsi "Animasyon"); asıl ayrım anahtar kelimelerdedir (seinen,
isekai, psikolojik, mecha, slice of life…).

```
P_u  = Σ_yapım  ağırlık(s) · özellikler(yapım) · özellik_idf          → birim uzunluğa indirilir
       ağırlık(s) = 0.4 + s   (s ≥ 0)   |   0.6 · s   (s < 0)   |   0.35  (görüş yok)
P̃_u  = P_u − kulvar ortalama profili                                  // merkezleme
ρ_u  = profilin yarı-bölme güvenilirliği (Spearman–Brown), [0.3, 0.98]
K3   = clamp( cos(P̃_a, P̃_b) / √(ρ_a · ρ_b), −1, 1 )
```

- **Özellik aileleri:** kanonik tür (`genreCanon`), TMDB anahtar kelimeleri (kulvarda ≥ 5 yapımda
  geçenler), on yıl, köken dili/ülkesi, biçim (film süresi ya da sezon sayısı kovası), popülerlik
  kademesi (ana akım / orta / niş), stüdyo ve yaratıcı (anime ve dizi).
- **Merkezleme şarttır.** Anime kulvarındaki herkesin profili zaten "anime"dir; merkezlenmemiş
  kosinüs herkese ~0.9 verir. Ortalama çıkarılınca kişinin **kulvar ortalamasından farkı**
  karşılaştırılır (D2).
- **Sevmedikleri de profildir.** Negatif `s` profili ters yönde iter.
- **Güvenilirlik düzeltmesi:** kullanıcının kütüphanesi rastgele ikiye bölünür, iki yarının
  profilleri karşılaştırılır. Kendi kendisiyle bile tutarsız çıkan (az verili) profil başkasıyla
  yüksek çıkamaz; düzeltme bunu dengeler, güvenin kendisi ise §6'da kanıta yansır.
- **Veri gereksinimi:** liste kayıtlarında yalnız tür, süre ve tarih var. Anahtar kelime, dil,
  popülerlik ve stüdyo için sunucuda yapım başına bir kez doldurulan `TitleFeatures/{tür_id}`
  önbelleği gerekir.

## 6. Güven daraltması ve birleştirme (K-8)

Her bileşen, kanıtı azsa kendi ön değerine çekilir:

```
E2 = 0.12 · min(n_a, n_b)                          K2' = E2 · K2 / (E2 + 3)
E3 = min(25, 4·ρ / (1 − ρ)),  ρ = √(ρ_a·ρ_b)        K3' = E3 · K3 / (E3 + 3)

ön1 = 0.5 · max(0, min(K2', K3'))                  // görüş bilinmiyorsa: diğer kanıtın yarısı
K1' = ( E1 · K1 + 6 · ön1 ) / ( E1 + 6 )            // K1 yoksa K1' = ön1

B   = 0.45 · K1' + 0.25 · K2' + 0.30 · K3'
```

- K2 ve K3 kanıt azken **0'a** (şans) çekilir: kanıt yoksa iki yabancı rastgele sayılır (D5).
- K1 kanıt azken 0'a değil, **diğer iki bileşenin yarısına** çekilir. Böylece puan vermeyen çift
  cezalandırılmaz (D8) ama "görüşleri de kesin uyuyor" varsayımı da yapılmaz (D9).
- Ağırlıklar: en kesin kanıt olan görüş uyumu en ağır (0.45). İçerik profili (0.30), tam başlık
  örtüşmesinden (0.25) biraz ağır, çünkü liste büyüklüğünden etkilenmez.

## 7. Tavanlar ve nihai skor (K-9)

```
skor = 100 · min( B · ÖLÇEK,  tavan_deneyim,  tavan_kanıt )           ÖLÇEK = 1.10 (kalibrasyon, §11)
       ve  E1 ≥ 6 iken K1 < 0.60 ise  skor ≤ 85                       // görüş kapısı
       alt sınır 0
```

**Deneyim denkliği tavanı (D4).** `oran = max(n_a,n_b) / min(n_a,n_b)`:

```
tavan_deneyim = max( 0.60, 1 − 0.25 · log10(oran) )
```

| oran | 1.1 | 1.5 | 2 | 2.5 | 3 | 5 | 10 |
|---|---|---|---|---|---|---|---|
| tavan | 99 | 96 | 92 | 90 | 88 | 83 | 75 |

**Görüş kanıtı tavanı (D5, D9).** Kaç ortak görüş varsa o kadar yüksek skor kanıtlanabilir:

```
tavan_kanıt = 1 − 0.30 · exp( −E1 / 20 )
```

| E1 (açık puan eşdeğeri ortak görüş) | 0 | 10 | 22 | 30 | 40 | 60 |
|---|---|---|---|---|---|---|
| tavan | 70 | 82 | 90 | 93 | 96 | 98.5 |

%90 için gereken en az ortak görüş:

| Çift | Gereken ortak yapım |
|---|---|
| İkisi de puan veriyor | ≈ 22 ortak puanlı yapım |
| Biri puan veriyor, biri vermiyor | ≈ 40 ortak (birinde puan, diğerinde davranış sinyali) |
| İkisi de puan vermiyor | ≈ 73 ortak davranış sinyalli yapım (bitirme, bırakma, tekrar, favori) |

**Görüş kapısı (D7).** Yeterli kanıt varken görüş uyumu zayıfsa, seçim ve içerik ne kadar benzerse
benzesin çift ikiz olamaz.

**Veri büyüklüğüne göre ulaşılabilir en yüksek skor.** Bütün bileşenler kusursuz olsa bile
(formülden, tipik profil güvenilirliğiyle):

| Kulvarda izlenen (iki tarafta) | Ortak görüş (E1) | En yüksek skor |
|---|---|---|
| 40 | 12 | ≈ 75 |
| 80 | 25 | ≈ 89 |
| 120 | 40 | ≈ 95 |
| 200 | 60 | ≈ 98 |

Yani ikiz olabilmek için kabaca **100+ yapım ve 25+ ortak görüş** gerekir. Havuza giriş eşiği
(30 izleme) ikiz olmaya yetmez; bu bilinçli bir tercihtir ve görevlerin gerekçesidir. Arayüz
bunu açıkça söyler: "İkizini bulmak için 40 yapım daha izle ya da puanla."

## 8. Karar kuralları (K-10)

| Sonuç | Şartlar |
|---|---|
| **Zevk İkizi** | `skor ≥ 90` **ve** karşılıklı ilk 10 (A, B'nin en benzer 10 kişisi içinde; B de A'nınkinde) **ve** iki taraf da son 30 günde etkin **ve** engel yok. |
| **Yakın zevk** | `80 ≤ skor < 90`. Yalnız havuz küçükken (soğuk başlangıç) ikiz yerine gösterilir. |
| **Zevk Çemberi** | 3–10 kişi. Her üyenin diğer üyelerle **ortalama** skoru ≥ 88 ve **en düşük** ikili skoru ≥ 80. |
| **Rehber** | Deneyim tavanı uygulanmadan önceki değer ≥ 90 ve `oran ≥ 3`. Yüzde gösterilmez. |

- **Karşılıklı ilk 10** şartı "herkese benzeyen" profilleri eler. Çok ana akım bir kullanıcı pek
  çok kişiyle orta-yüksek skor alabilir; ama o kişilerin en benzerleri arasında değilse ikiz
  sayılmaz. (Simülasyonda sınanmadı.)
- Bir kullanıcıya en çok **5 ikiz adayı** gösterilir, skora göre sıralı.
- Skorlar gecelik hesaplanır. Bir çiftin skoru %90'ın altına düşse bile kurulmuş arkadaşlık ya da
  çember üyeliği bozulmaz.

## 9. Puan vermeyenler için özet

1. Davranışlardan `s` çıkarılır (§3.2); tablo ve ağırlık puan verenlerden öğrenilir.
2. Görüş uyumuna düşük ağırlıkla (`q ≈ 0.30`) girer.
3. Görüş kanıtı azsa K1, seçim ve içerik benzerliğinin yarısına çekilir (§6). Ceza değil, temkin.
4. %90 için ≈ 73 ortak davranış sinyali gerekir (§7). Ağırlıklı olarak **dizi** izleyenler buna
   ulaşabilir, çünkü bitirme/bırakma sinyali dizilerde vardır.
5. **Yalnız film izleyip hiç puan vermeyen** kullanıcının sinyali yalnız favoriler ve tekrar
   izlemedir. Böyle iki kişinin skoru, seçimleri ve içerik profilleri kusursuz örtüşse bile
   **≈ %75–77'de kalır** (formülden: görüş ön değeri 0.5 ve kanıt tavanı). Yani bugünkü
   kurallarla ne ikiz ne "yakın zevk" olurlar. Bu, D9'un bedelidir ve **gevşetilebilir bir
   karardır**:
   - Görüş ön değeri 0.5 → 0.7 yapılırsa bu çiftlerin tavanı ≈ %86'ya çıkar ("yakın zevk" olur).
     Bunun güvenli olup olmadığını §11'deki gizli veri testi söyler: yalnız seçimi benzeyen
     komşular birbirinin izlediklerini iyi tahmin ediyorsa gevşetilir.
   - Filmler için yeni örtük sinyaller eklenebilir (aşağıda). Hepsi K-2a ile ölçülür; bilgi
     taşımayan sinyal kendiliğinden sıfıra yakın ağırlık alır.
   - Arayüz bu kullanıcıya en kısa yolu gösterir: "20 filme puan ver, ikiz eşleşmesi açılsın."

**Filmler için aday örtük sinyaller (simülasyonda yok, K-2a ile sınanacak):**

| Davranış | Beklenen yön |
|---|---|
| Serinin devam filmini de izledi | ilk film için + |
| Takip ettiği yönetmenin/oyuncunun filmi (`followedPeople`) | + |
| Vizyona girdiği hafta izledi | zayıf + |
| İzleme listesine ekleyip 7 gün içinde izledi | zayıf + |

## 10. Veri hijyeni ve kopyaya direnç (K-11; birim testle sınandı, simülasyonda yok)

- **Toplu giriş:** aynı gün girilen 50'den fazla kaydın fazlası, 14 gün geçene kadar eşleşme
  hesabında yarı ağırlık alır. İstatistiklere tam yansır.
- **İçe aktarma (Letterboxd vb.):** tarihleri taşıdığı için tam ağırlık alır, ancak eşleşme
  havuzuna giriş için aktarımdan sonra **14 farklı günde etkinlik** gerekir.
- **Hesap yaşı (olgunluk):** kulvardaki kayıtlar en az 14 farklı güne yayılmamışsa profil
  "olgun değil" sayılır ve skor **en çok 85** olur (ikiz olamaz). Yarı ağırlık tek başına kopyayı
  durdurmuyor (kopya listede görüş uyumu yine kusursuz); D10'u bu tavan sağlar. Kayıtlarının
  yarısından azı tarihli eski hesaplar yargılanamaz ve olgun sayılır.
- **Puan çeşitliliği kapısı:** en az 4 farklı puan kademesi kullanılmamışsa açık puanlar görüş
  sayılmaz (hepsi 10 olan liste sıra bilgisi taşımaz); kullanıcı örtük sinyal yolundan
  değerlendirilir.
- **Görünürlük:** arkadaş olmayanlar birbirinin ham listesini göremez; kopyalanacak hedef liste
  zaten erişilebilir değildir.

## 11. Gerçek veriyle kalibrasyon protokolü

Simülasyon formüllerin **yapısını** doğrular, **sayıları** değil. Sayılar şu yöntemle ayarlanır.
Hiçbiri yeni sürüm gerektirmez: tüm sabitler `AppConfig/match` belgesinden okunur.

**1. Asıl kalite ölçüsü: gizli veri testi.** Gerçek veride "kim gerçekten ikiz" bilinmez, ama
şu ölçülebilir:

1. Her kullanıcının sinyallerinin rastgele %20'si gizlenir.
2. Skorlar kalan %80 ile hesaplanır.
3. Her kullanıcının gizlenen görüşleri, komşularının aynı yapımlar hakkındaki görüşlerinden
   tahmin edilir. Komşular skor bandına göre gruplanır (60–70, 70–80, 80–90, 90+).
4. Bant yükseldikçe tahmin isabeti **kesintisiz artmalıdır**. Artmıyorsa formül yanlıştır.

Bu aynı zamanda "%90" sözünün işlevsel tanımıdır: **%90+ komşunun bir yapım hakkındaki görüşü,
senin o yapım hakkındaki görüşünü, kendi puanlarının kendi içindeki tutarlılığına yakın isabetle
tahmin eder.** Aynı test gizlenen *izleme seçimleri* için de yapılır (komşunun izlediklerini
izlemiş olma oranı).

**2. Şans çapası.** Rastgele çiftlerin skor medyanı ≈ 0, %99'luk değeri ≤ 45 olmalı. Değilse §3.3
(γ) ve §4 (nadirlik) yeniden öğrenilir.

**3. Ölçek.** `ÖLÇEK` ve `Z_REF`, adım 1'deki hedef isabeti %90 bandının sağlayacağı şekilde
ayarlanır. `R_E` doğrudan ölçülemez; `ÖLÇEK` ile birlikte ayarlanır.

**4. Öğrenilen tablolar.** Örtük sinyal tablosu, `r_ie`, γ, şans dağılımı, nadirlik sayıları ve
kulvar ortalama profili gecelik işte yeniden hesaplanır.

**5. Sıklık.** Kalibrasyon, kulvar havuzu her iki katına çıktığında ve en az ayda bir yinelenir.
Kulvarda 150 etkin kullanıcı olana kadar varsayılan sabitler kullanılır ve sonuçlar arayüzde
"yakın zevk" olarak sunulur (ikiz iddiası yapılmaz).

## 12. Simülasyon sonuçları

**Yöntem.** 4000 yapım ve 320 sentetik kullanıcı. Her yapımın ve kullanıcının 8 boyutlu gizli bir
zevk vektörü var; üstveri bu boyutların yalnız 5'ini görüyor. Kullanıcılar popülerliğe ve kendi
zevkine göre 40–1200 yapım seçiyor, gürültülü puan veriyor (kişiye özgü sertlik ve ölçek
genişliğiyle), %25'i hiç puan vermiyor. "Gerçek benzerlik" gizli vektörlerin kosinüsü. Üç farklı
rastgele dünyada (tohum 7, 11, 23) ~51.000 çift ölçüldü. Ölçüm **gerçek çekirdekle** yapılır:
`scripts/sim/tasteMatchV3.sim.js` (çalıştırma komutu dosyanın başında; `npm test` içinde değil,
~45 sn). "Eski hesap" sütunu, mevcut `tasteMatch.js` formülünün özünün sadeleştirilmiş bir
kopyasıdır (ilk taslak simülasyondan), dosyanın kendisi değil.

| Ölçüt | Eski hesap | Taslak (v3) | Çekirdek (v3.1, ÖLÇEK 1.10) |
|---|---|---|---|
| Rastgele bir çiftin medyan skoru | 48–53 | −6 … −5 | −7 … −5 |
| Rastgele çiftlerin %99'u şu değerin altında | 74–75 | 41–42 | 36–38 |
| ≥ 85 alan çift sayısı (51 bin çiftte) | 1177–1867 | 174–415 | 6–19 |
| ≥ 85 alanlardan gerçekten benzer (≥ 0.80) | %70–85 | %96–98 | **%100** |
| ≥ 90 alan çift sayısı | 281–742 | 36–155 | 0–5 |
| ≥ 90 alanlardan gerçekten benzer (≥ 0.80) | %87–89 | %99–100 | %100 (çok az örnek) |
| Gerçek ikizlerden (≥ 0.93) ≥ 85 alanların oranı | %55–81 | %16–36 | %1–2 |

**Ne değişti, neden.** Taslağın yüksek skorlarının bir kısmı §3.2–§3.3'te düzeltilen sahte uyumdan
geliyordu (sessiz çiftlerde ve popüler yapımlarda). Düzeltmeler kesinliği artırdı, ölçeği düşürdü.

**ÖLÇEK denemesi (aynı üç dünya):**

| ÖLÇEK | ≥ 90 çift | ≥ 90'dan gerçek ≥ 0.80 | ≥ 90'dan gerçek ≥ 0.90 | Puanlı ikiz medyanı |
|---|---|---|---|---|
| 1.10 | 0–5 | %100 | %100 | 68–71 |
| 1.20 | 8–22 | %95–100 | %82–100 | 74–77 |
| 1.30 | 44–57 | %91–100 | %79–93 | 79–83 |

Kabul ölçütü (≥ 90 alanların ≥ %97'si gerçek ≥ 0.80) 1.20'de bir dünyada bozuluyor. Öncelik
yanlış ikiz göstermemek olduğundan **ÖLÇEK 1.10 kaldı**. Bunun bedeli: sentetik dünyada %90'a
neredeyse kimse ulaşmıyor. Gerçek dünyada "%90 ikiz" eşiğinin anlamlı olması §11'deki gizli
veri kalibrasyonuna bağlı; o ölçüm gelmeden eşik ya da ölçek **elle** yükseltilmez. Soğuk
başlangıç kuralı (§11.5) zaten ilk dönemde yalnız "yakın zevk" (80+) gösterir.

Senaryolar (çekirdek, ÖLÇEK 1.10; her biri 12 tekrarın ortalaması, üç dünyadaki aralık):

| Senaryo | Skor | İlgili kural |
|---|---|---|
| 100 yapım, 1000 yapımlık listenin içinde, aynı puanlar | 61–75 | D4 |
| Aynı 200 yapım, ters puanlar | −32 … −22 | D7 |
| Rastgele iki kişi, 200'er yapım | −3 … 7 | D2 |
| İkiz, 200'er yapım, ikisi de puanlıyor | 72–75 | — |
| İkiz, 40'ar yapım, ikisi de puanlıyor | 48–66 | D5 |
| İkiz, 200'er yapım, ikisi de sessiz | 60–72 | D8, D9 |
| İkiz, 400'er yapım, ikisi de sessiz | 63–64 | D8 |

Tablodaki negatif değerler alt sınır (0) uygulanmadan önceki ham çıktıdır; arayüzde 0 görünür.

Birim testlerde (100 kişilik küçük dünya) ayrıca: popüler 50 yapım eklemek skoru < 5 oynatıyor
(D6), puanları silinen ikiz puanlı hâlini geçmiyor (D8), aynı gün kopyalanan liste ikiz olamıyor
(D10), 2 puan kaydırma skoru < 3 oynatıyor (D3).

İlk taslağın gösterdiği iki şey hâlâ geçerli:

- Gerçek ikizlerde seçim `z` değeri liste büyüklüğünden bağımsız bir bantta kalıyor; §5.2'deki
  büyüklük düzeltmesi işini yapıyor.
- **Ölçek dünyadan dünyaya kayıyor**; `ÖLÇEK` sabiti gerçek veride mutlaka yeniden ayarlanmalı (§11).

**Simülasyonun sınırları.** Sentetik kullanıcılar gerçek insan değildir. Özellikle: üstverinin
zevki ne kadar iyi temsil ettiği (K3'ün gerçek gücü), puan gürültüsünün büyüklüğü (`R_E`) ve
davranış sinyallerinin gerçek anlamı varsayımdır. §8'deki karşılıklı ilk 10 ve zaman ağırlığı
henüz ne simülasyonda ne çekirdekte var.

## 13. Sabitler

Tümü `AppConfig/match` belgesinden okunur. "Öğrenilir" yazanlar gecelik işte veriden hesaplanır.

| Sabit | Değer | Yer | Nasıl belirlenir |
|---|---|---|---|
| Açık puan çekme gücü | 10 | §3.1 | sabit |
| Örtük sinyal tablosu | §3.2 | §3.2 | öğrenilir |
| `q_örtük` | 0.30 | §3.2 | öğrenilir (`(r_ie/R_E)²`) |
| "Yalnız izlendi" tabanı | −0.05, ağırlık ×0.25 | §3.2 | değer öğrenilir, ağırlık sabit |
| `μ_örtük` (örtük merkez) | 0.05 | §3.3 | öğrenilir |
| `γ` (genel kanı payı) | 0.45 | §3.3 | öğrenilir |
| Nüfus kanısı eşiği | ≥ 20 puanlayan ve ≥ %20 pay; ön değer 20 | §3.3 | kalibrasyon |
| Olgunluk tavanı | 14 farklı gün yoksa en çok 85 | §10 | ürün kararı |
| `R_E` (puan tutarlılığı) | 0.75 | §5.1 | kalibrasyon |
| Nadirlik sınırları | 0.15 – 2.2 | §4 | sabit |
| `Z_REF` | 9 | §5.2 | kalibrasyon |
| Şans medyanı/yayılımı | `ln(n_g)` doğrusu | §5.2 | öğrenilir |
| Bileşen ağırlıkları | 0.45 / 0.25 / 0.30 | §6 | kalibrasyon |
| Daraltma güçleri | K1: 6 · K2: 3 · K3: 3 | §6 | kalibrasyon |
| Kanıt oranları | `E2 = 0.12·min(n)`, `E3 ≤ 25` | §6 | kalibrasyon |
| Görüş ön değeri | diğer kanıtın 0.5'i | §6 | kalibrasyon (bkz. §9.5) |
| `ÖLÇEK` | 1.10 | §7 | kalibrasyon |
| Deneyim tavanı | `1 − 0.25·log10(oran)`, en az 0.60 | §7 | ürün kararı |
| Kanıt tavanı | `1 − 0.30·exp(−E1/20)` | §7 | ürün kararı |
| Görüş kapısı | `K1 < 0.60` → en çok 85 | §7 | ürün kararı |
| Eşikler | ikiz 90 · yakın 80 · çember ort. 88 / en düşük 80 | §8 | ürün kararı |

## 14. Otomatik testler (yazıldı: `__tests__/tasteMatchV3.test.js`, 30 test)

`utils/tasteMatchV3.js` saf fonksiyondur; sunucu kopyası (`functions/tasteMatchCore.js`) Faz 5'te
eşlik testiyle bağlanacak. Jest testleri değişmez kuralları doğrudan sınar (D3 eşiği < 3, D4'te
ayrıca deneyim tavanı ≤ 0.76 doğrulanır):

| Test | Beklenen |
|---|---|
| D1 | `skor(A,B) === skor(B,A)` |
| D2 | 200 rastgele sentetik çiftin medyanı `|skor| < 10` |
| D3 | Bir tarafın tüm puanlarından 2 çıkarılınca (kademe kaybı olmadan) skor değişimi < 1 |
| D4 | A ⊂ B, `|B| = 10·|A|`, aynı puanlar → `skor ≤ 78` |
| D5 | 2 ortak yapım, ikisine de 10 → `skor < 40` |
| D6 | İki tarafa da aynı 50 gişe filmi (yüksek puanla) eklenince skor artışı < 5 |
| D7 | Aynı yapımlar, puanlar ters çevrilmiş → `skor < 20` |
| D8 | İkiz çiftin tüm puanları silinince skor 0'a düşmez, ama ilk değerini de geçmez |
| D9 | Ortak görüşü yalnız örtük olan çift, `tavan_kanıt` değerini aşamaz |
| D10 | Aynı gün girilmiş 300 kayıtlık kopya liste → `skor < 90` |
| Tablo | §7'deki tavan tabloları formülle birebir |

Regresyon ölçümü `scripts/sim/tasteMatchV3.sim.js` (gerçek çekirdekle; `npm test` dışında, elle
çalıştırılır): bir formül değişikliği §12'deki kesinlik oranlarını düşürüyorsa kabul edilmez.

## 15. Bilinen sınırlar ve açık sorular

- **Soğuk başlangıç.** Öğrenilen her şey (şans dağılımı, örtük tablo, nadirlik) kullanıcı ister.
  Küçük havuzda varsayılanlarla çalışılır ve yalnız "yakın zevk" denir (§11.5).
- **Yalnız film izleyen sessiz kullanıcılar** bugünkü kurallarla ≈ %75–77'de kalır (§9.5).
  Gevşetme yolları orada yazılı; karar gerçek veriyle verilecek.
- **K3'ün gerçek gücü bilinmiyor.** TMDB anahtar kelimeleri bazı yapımlarda eksik ya da özensizdir.
  Zayıf çıkarsa ağırlığı K1 ve K2'ye kaydırılır.
- **Mevcut arkadaş "Zevk uyumu" kartı** eski hesabı kullanıyor ve aynı çifte farklı bir yüzde
  gösterebilir. İki hesabın birleştirilmesi ayrı bir karar (ana belgede açık soru).
- **Hesap maliyeti.** K1 ve K2 çift başına ortak yapımlar üzerinden yürür. 1000 kullanıcılık
  kulvarda ~500.000 çift gecelik işte rahat hesaplanır; daha büyüğünde önce K3 ile en yakın 100
  aday süzülür, K1/K2 yalnız onlarda hesaplanır.

## 16. Değişiklik özeti

**v3.1 (13 Kas, kodlama).** Çekirdek yazılırken ölçümle bulunan üç kusur kurala işlendi:

1. "Yalnız izlendi" kaydı görüş tabanı oldu (§3.2). Rastgele sessiz çiftlerin sahte uyumunu
   giderir (D2).
2. Örtük sinyal genel kanıdan arındırılmaz, nüfus ortalamasına göre merkezlenir (§3.3). Sessiz
   ikizlerin puanlı ikizleri geçmesini önler (D8, D9).
3. Geniş izlenen yapımda genel kanı nüfustan ölçülür (§3.3). Popüler yapım şişmesini giderir (D6).

Ayrıca olgunluk tavanı (§10) D10'u sağlamak için eklendi; yapım nadirliği profilde saklanır.
Sonuç: kesinlik arttı, skorlar genel olarak düştü (§12). ÖLÇEK 1.10'da kaldı.

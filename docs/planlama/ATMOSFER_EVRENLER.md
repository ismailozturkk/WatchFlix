# Atmosfer — Evrenler (film, dizi, anime sahneleri)

10 Kas 2026. Kullanıcının verdiği 18 yapım (7 film, 6 dizi, 5 anime) için ikonik öğeler ve "yaşayan döngüler".
Durum: KODLANDI (10 Kas 2026) — 18 evren, seçicide 3 grup (Film/Dizi/Anime) + detayda otomatik (özel gün > evren > tür; "Türe göre" açıkken). jest yeşil (487 suite). CİHAZDA GÖRÜLMEDİ, commit yok.

Dosyalar: utils/weatherUniverses.js (eşleme, sahne kurucuları, SCENERY), utils/weatherParticles.js (KIND.track/emit, OVERLAY 17–30, drawCycle/sparkSlot/tetherFrame), components/decor/universeSprites.js (61 hücre, atlas 8×16), components/decor/universeOverlays.js (silüet/ışık/ip katmanları), __tests__/weatherUniverses.test.js.

## Ortak ilkeler

- **Yaşayan döngü:** her sahnede 1 ana olay (ejderha gelir → ateş üfler → gider) + 2–3
  sürekli arka hareket (kar, kuzgun, kıvılcım). Ana olay 15–30 sn'de bir; aradaki süre
  sakin. Hepsi saatten hesaplanır (kare başına state yok), yani mevcut motorla uyumlu.
- **Logo yok:** marka logoları ve amblemler çizilmez (yarasa sinyali, örümcek amblemi,
  Keşif Birliği kanatları, Hasır Şapka bayrağı, Hogwarts arması, Ölüm Yadigârları
  işareti, Konoha yaprağı). Sahne, o evreni çağrıştıran GENEL nesnelerle kurulur.
  Uygulama ticari; logo, karakter yüzü ve birebir araç tasarımı mağaza incelemesinde ve
  hukuken risk. Çizimler "esinli silüet" düzeyinde kalır.
- **Işığa duyarlılık:** ateş, flaş ve şimşek gibi çakmalar mevcut kurala uyar
  (herhangi 1 sn'de ≤3 çakma, yanık süre < %50).
- **Okunabilirlik:** sahne içeriğin ARKASINDA. Büyük yapılar (duvar, şehir silüeti, kum
  tepesi) ekranın alt %25'inde, düşük opaklıkta; ana olay üst yarıda.

## Yapımlar

### Filmler

**1 · Star Wars** — uzay
- Öğeler: ay büyüklüğünde küresel savaş istasyonu (çanak kraterli, ekvator yarığı),
  X kanatlı avcı, altıgen kanatlı avcı, kırmızı/yeşil lazer atışları, hiperuzay yıldız
  çizgileri, yıldız alanı.
- Döngü: istasyon sağ üstte yavaşça süzülür. Her ~18 sn'de X kanatlı avcı soldan
  girer, peşinde 2 altıgen avcı; arkadakiler yeşil, öndeki geriye kırmızı atış yapar.
  Ara sıra bir avcı hiperuzaya atlar: yıldızlar merkezden ışınsal uzar, gemi parlayıp
  kaybolur.
- Motor: kovalamaca rotası (ortak liderli grup), atış (kısa çizgi), hiperuzay ışınsal çizgi.

**2 · Matrix** — dijital
- Öğeler: yeşil kod yağmuru (sütunlar, parlak baş, sönen kuyruk, ayna harf benzeri
  simgeler), kırmızı ve mavi hap, mermi zamanı (yavaş mermi + hava halkaları), déjà vu
  aksaması.
- Döngü: kod sütunları farklı hızlarda akar, simgeler arada değişir. Her ~20 sn'de bir
  mermi ekranı çok yavaş geçer, arkasında genişleyen halkalar. Ara sıra kısa "aksama":
  birkaç sütun aynı anda takılıp tekrar eder (çakma değil, yumuşak). İki hap süzülür.
- Motor: sütun düşüşü + sprite karesi değişimi, genişleyen halka.

**3 · Harry Potter** — büyü
- Öğeler: Büyük Salon'un havada süzülen mumları, kanatlı altın top, mektup taşıyan
  baykuş, uçuşan mektuplar, asa kıvılcımları, yıldızlı tavan.
- Döngü: mumlar üst yarıda hafifçe iner çıkar, alevleri titrer. Altın top durup aniden
  başka noktaya fırlar (kanatları çırpar). Her ~15 sn'de baykuş geçer, bir mektup bırakır;
  mektup sallanarak düşer.
- Motor: ara noktalı fırlama (dur–fırla), bırakılan nesne (ana olaydan doğan düşüş).

**4 · Yüzüklerin Efendisi** — Orta Dünya
- Öğeler: ufukta karanlık kule ve tepesinde alevli göz, gözün süpüren bakışı (ışık
  hüzmesi), lav parlayan yanardağ, kanatlı karanlık binekler, altın yüzük ve içindeki
  yazının parıltısı.
- Döngü: göz yavaşça sağa sola bakar, hüzme gökyüzünü tarar. Yanardağdan kor yükselir.
  Her ~25 sn'de kanatlı binek ufukta geçer. Yüzük ön planda süzülür, ara sıra parlar.
- Motor: süpüren hüzme (vektör), sabit ufuk silüeti (vektör).

**5 · Dune** — çöl
- Öğeler: dev kum solucanı (halkalı gövde, yuvarlak ağız, ışınsal dişler), kum tepeleri,
  kanat çırpan çöl uçağı (yusufçuk kanatlı), baharat zerreleri, gökte iki ay.
- Döngü: önce kumda dalgalanma ilerler (solucan izi). Ardından solucan kumdan yay
  çizerek çıkar, ağzını açar, kum fışkırır, öbür taraftan dalar. Her ~20 sn. Uçaklar
  havada asılı kanat çırpar. Baharat zerreleri savrulur.
- Motor: yay çizen çıkış–dalış (parçalı gövde), kum fışkırması (patlama), kum tepesi (vektör).

**6 · Batman** — Gotham
- Öğeler: gotik şehir silüeti, çatı gargoylleri, yağmur, bulutları tarayan projektör
  hüzmeleri (logo YOK), yarasa sürüsü, çatıda pelerinli silüet.
- Döngü: yağmur; iki hüzme yavaşça bulutları tarar. Her ~16 sn'de yarasa sürüsü
  geçer. Gargoyl üstündeki silüetin pelerini rüzgârda dalgalanır. Seyrek uzak şimşek.
- Motor: şehir silüeti (vektör), hüzme (mevcut spot katmanı uyarlanır).

**7 · Spider-Man** — şehir
- Öğeler: gökdelen silüeti, köşelerde ağ, ağ ipi atışı, ağla sallanan silüet, ağda çiy
  parıltısı.
- Döngü: köşe ağları sabit, çiy damlaları parlar. Her ~12 sn'de silüet yukarıdaki bir
  noktaya ağ atar, sarkaç gibi yay çizerek geçer, ipi bırakıp bir sonrakine atar.
- Motor: sarkaç (çapa + ip + gövde), ip uzunluğu değişen çizgi (örümcek ipinin genişletilmiş hali).

### Diziler

**8 · Breaking Bad** — çöl laboratuvarı
- Öğeler: New Mexico çölü, karavan, kimyasal element kutucukları (başlık kartındaki
  gibi), bulut gibi sıcak hava, yuvarlanan çalı, cam şişelerde kabarcık, yassı şapka.
- Döngü: element kutucukları süzülür, arada biri parlar. Karavan altta durur, bacasından
  duman çıkar. Çalı yuvarlanır, sıcak hava titrer.
- Not: mavi kristal bilinçli olarak YOK (uyuşturucu tasviri, mağaza yaş sınıfı riski).

**9 · Game of Thrones** — kuzey
- Öğeler: devasa buz duvarı, ejderha, ateş nefesi, kar, kuzgun, kale kuleleri.
- Döngü (kullanıcının tarifi): duvar altta, kar yağar. Her ~22 sn'de ejderha uzaktan
  küçük gelir, büyüyerek duvar boyunca süzülür, havada durur, kanat çırparak duvara ateş
  üfler (alev konisi + duvarda parlama + buhar), sonra yükselip gider. Kuzgunlar geçer.
- Motor: senaryolu rota (gel–dur–üfle–git), alev konisi (parçacık + vektör ışık), duvar (vektör).

**10 · Vikingler** — kuzey denizi
- Öğeler: çizgili yelkenli uzun gemi, kürekler, kalkan sırası, dalgalı deniz, kuzgun,
  parlayan runlar, kutup ışığı.
- Döngü: gemi dalgalarda yalpalayarak geçer, kürekler çekilir. Gökte kutup ışığı. Runlar
  sırayla parlayıp söner. Kuzgun çifti dolanır.
- Motor: yalpalayan geçiş (mevcut kıyı + glide), run nabzı.

**11 · Prison Break** — hapishane
- Öğeler: dikenli tel ve tel örgü, gözetleme kulesi projektörü, mavi kopya planı
  çizgileri, kâğıttan turna.
- Döngü: projektör hüzmesi sağa sola tarar. Plan çizgileri kendiliğinden çizilir, bir
  süre durur, solar. Turnalar süzülür.
- Motor: kendini çizen çizgi (vektör, yol uzunluğu animasyonu).

**12 · Sherlock** — Londra
- Öğeler: sis, ayak izleri, büyüteç, ipucu noktaları, keman.
- Döngü: ayak izleri sırayla belirip söner (biri yürüyormuş gibi). Büyüteç ekranda
  gezinir; altında kalan ipucu noktası parlar. Sis akar.
- Motor: sıralı belirme (iz dizisi), gezinen büyüteç.

**13 · The Sopranos** — New Jersey
- Öğeler: havuzdaki ördek ailesi, puro dumanı, banliyö ağaçları.
- Döngü: ördek ve yavruları havuzda sıra halinde yüzer. Arada uçup giderler, bir süre
  sonra geri dönerler. Puro dumanı kıvrılarak yükselir.
- Motor: sıralı takip (yavrular anneyi izler), su yüzeyi (mevcut kıyı katmanı uyarlanır).

### Anime

**14 · Death Note** — ölüm defteri
- Öğeler: siyah tüyler, kırmızı elma, uçuşan defter sayfaları, gotik siyah kanat silüeti.
- Döngü: siyah tüyler süzülür. Elma havada döner; ara sıra ısırılmış hale geçer, sonra
  yenisi belirir. Sayfalar savrulur.
- Motor: kare değişimi (bütün elma → ısırılmış).

**15 · Attack on Titan** — duvarlar
- Öğeler: dev beton duvar, duvarın ardından yükselen dev buharlı yüz silüeti, buhar,
  kanca ve halatla uçan askerler, düşen tüyler.
- Döngü: her ~25 sn'de dev silüet duvarın ardından yavaşça yükselir, buhar bulutu
  çıkar, alçalıp kaybolur. Askerler iki halatla çapalara asılarak hızla geçer.
- Motor: yükselen silüet (alttan), iki halatlı geçiş.

**16 · Naruto** — gizli köy
- Öğeler: girdap yapan yapraklar, dönen fırlatma yıldızı, kunai, duman bulutu.
- Döngü: yapraklar girdap çizerek döner. Fırlatma yıldızları dönerek ekranı geçer.
  Ara sıra "puf" duman bulutu belirir, dağılır.
- Motor: girdap (dönen yörünge), duman patlaması.

**17 · One Piece** — Grand Line
- Öğeler: aslan başlı korsan gemisi, rüzgârda uçan hasır şapka, sarmal desenli şeytan
  meyvesi, martılar, deniz.
- Döngü: gemi dalgalarda yalpalar. Hasır şapka rüzgârda takla atarak ekranı geçer.
  Şeytan meyvesi süzülür. Martılar geçer.

**18 · Fullmetal Alchemist: Brotherhood** — simya
- Öğeler: kendini çizen dönüşüm çemberi (genel geometri), mavi simya şimşekleri,
  kırmızı taş parçası parıltısı, sallanan cep saati.
- Döngü: çember çizgi çizgi çizilir → mavi şimşekler çıtırdar → parlar → söner. Her
  ~18 sn. Cep saati sarkaç gibi sallanır.
- Motor: kendini çizen çember (vektör), kısa şimşek dalları (mevcut şimşek kodu).

## Teknik plan

- **Yeni hareket türleri:** senaryolu rota (gel–dur–eylem–git), sarkaç, yay çizen
  çıkış–dalış, dur–fırla, girdap, sıralı belirme, kendini çizen çizgi (vektör),
  sabit büyük silüetler (vektör: duvar, şehir, kum tepesi, kule).
- **Şekil dokusu:** ~45 yeni renkli şekil. 8 sütun ile 13–14 satır (512 × ~900 px),
  eski cihaz sınırının (2048) altında.
- **Eşleme:** filmler TMDB koleksiyon kimliğiyle (her film ayrı kimlik ama koleksiyon
  ortak), diziler/animeler dizi kimliğiyle. Kimlikler kodlamadan önce TMDB'den doğrulanır.
- **Partiler:** her partide 3–4 sahne; her parti cihazda görülüp onaylanmadan sonraki
  başlamaz. Çizim cihazda görülmeden "hatasız" denemez.

## Güncel durum (10 Kas 2026)

Plan sonrası eklenen/değişenler (ayrıntı: kod başlık yorumları):

- **19. evren:** Rick and Morty (anime grubu; TMDB dizi 60625): yeşil portal, Rick + Morty yürüyüp portala girer,
  uçan daire geçer.
- **Vektör sahneler** (keskin, dokudan değil): GoT yıkılan buz duvarı, Vikings nehri + kale + gemiler, Star Wars
  Ölüm Yıldızı + gezegen + ışın + patlama + Millennium Falcon, Dune solucanı + baharat toplayıcılar, Hogwarts,
  One Piece gemisi, Rick and Morty portalı.
- **Kaldırma:** alt kenara oturan silüetler tab çubuğunun üstüne `SCENERY.lift` (86 dp) kadar alınır; altı
  sahneye uygun zeminle dolar. Sahne `dy` değerleri aynı sabitle yukarı alınır.
- **Seyreklik (`rest`):** olaylar 1–2 dakikada bir gelir; dönem = olay süresi × rest, olay döngünün ilk
  1/rest kadarında, kalanı boştur. Yeni olay ekleyen `rest` vermeli. Testler: `weatherSceneIntegrity`,
  `weatherRestCycles`.
- **Şekil dokusu:** hücre 128 px (1024 × 2048 px); 128 şekil (bazıları rezerve/kullanılmıyor: longship,
  starDestroyer, blastRing, falcon).
- **Kural istisnaları (kullanıcı isteği):** Spider-Man, Rick and Morty karakterleri, Falcon; Batman'in
  ışık hüzmesinin ucunda jenerik yarasa silüeti.
- **Cihazda görülmedi:** tüm bu güncellemeler yalnız testlerle doğrulandı.

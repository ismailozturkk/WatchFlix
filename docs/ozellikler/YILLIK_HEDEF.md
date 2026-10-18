# Yıllık izleme hedefi

Profil başlığında, **Düzenle** ve **Paylaş** düğmelerinin yanında 36×36'lık bir **halka düğmesi**; ortasında YALNIZ ilerleme yüzdesi
("%62"). Dokununca **hedef sayfası** açılır. Film ve dizi için **ayrı ayrı** hedef konur (biri, ikisi); dizi hedefi **dizi sayısı** ya da
**bölüm sayısı** ölçer. Sayfa ilerlemeyi, tempoyu, planı ve aylık dağılımı gösterir. Plan kapısı yok (ücretsiz). Hedef **yalnız bu cihazda**
tutulur, buluta yazılmaz.

> Sürüm geçmişi (hepsi 17 Ekim, aynı gün): (1) tek sayı + tek birim, İstatistikler altında tam genişlik kart → (2) profil çok kalabalık
> olduğu için halka düğmesi → (3) bu sayfa: iki ayrı hat, bölüm ölçüsü, plan, aylık grafik. `YearlyGoalCard` silindi; (1)'de diske yazılmış
> `{ target, unit }` kayıtları okunurken çevrilir (aşağıda "Eski biçim").

Kaynak: `docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 4. aday.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/yearlyGoal.js` | **Saf çekirdek**: kayıt (normalize/yaz/sil/eski biçim), sayım (`countYearTitles`, `monthlyYearTitles`), tempo + plan (`computeGoalProgress`), hat özeti (`combineProgress`), **taslak** yardımcıları (`suggestDraft`, `draft*`). RN/Firebase importu yok. |
| `hooks/useYearlyGoal.js` | Depoya + izleme verisine bağlama: hedef, sayımlar, hat ilerlemeleri, özet, öneri, `saveGoal` / `removeGoal`, listelerin hazır olma sinyali. |
| `components/profile/YearlyGoalButton.js` | Başlıktaki halka düğmesi (`GlassIconButton` 36×36 + halka + yüzde); hâller: yükleniyor / hedef yok / dolu / tamamlandı; ölçüm olayı; sayfayı da o açar. |
| `components/profile/ProfileIdentityBlock.js` | Eylem satırı: [Düzenle] [Paylaş] [hedef]; `showGoal` prop'u; Düzenle'nin darlıkta simge bırakması ve satır sarması. |
| `components/profile/YearlyGoalSheet.js` | Sayfa: başlık → **özet** → film kartı → dizi kartı → **aylık plan**; altta sabit Kaydet / Hedefi kaldır. Taslak üzerinde çalışır. |
| `components/profile/YearlyGoalTrackCard.js` | Tek hat kartı: anahtar, (dizi) ölçü seçimi, − / + (basılı tutunca hızlanır), hazır çipler, **plan işaretli çubuk**, tempo rozeti, plan hücreleri. |
| `components/profile/YearlyGoalMonthChart.js` | Aylık plan grafiği (12 çubuk + plan çizgisi); veriyi kendi okur, yalnız sayfa açıkken hesaplanır. |
| `components/profile/YearlyGoalBar.js`, `YearlyGoalRing.js` | Çubuk ve SVG halka (Reanimated, "Hareketi azalt"a uyar). |
| `components/profile/yearlyGoalTheme.js` | Hat renkleri/simgeleri (Wrapped ile aynı), tempo simgeleri. |
| `components/profile/yearlyGoalCopy.js` | tr/en/es metinleri + biçimleyiciler. `copyTablesSpanish.test.js` dengeyi, `yearlyGoalButton.test.js` "her anahtar kullanılıyor"u bekçiler. |
| `components/SwitchToggle.js` | `accessibilityLabel` artık iletiliyor (iki uygulama da). Başka kullanıcılar etkilenmez (prop isteğe bağlı). |
| `services/storage/registry.js` | `Keys.yearlyGoals` (json, `scope: "user"`, `keepOnLogout: true`). |
| `utils/sectionVisibility.js` + `sectionVisibilityCopy.js` | Profil bölümü `goal` (Ayarlar > Kişiselleştirme > Ekran bölümleri'nden gizlenebilir). Başlıkta olduğu için listede **ilk** sırada. |
| `screens/tabs/ProfileScreen.js` | `showGoal={showSection("goal")}` — kimlik bloğuna geçirilir. |
| `utils/analyticsEvents.js` | `YEARLY_GOAL`. |

## İki hat ve ne sayılır

Her hat ayrı açılıp kapanır; **en az biri açık** olmadan Kaydet çalışmaz.

- **Film hattı:** o yıl en az bir izleme olayı olan **farklı** film. Aynı filmi yıl içinde üç kez izlemek **bir** sayılır.
- **Dizi hattı**, iki ölçüden biri:
  - **Dizi sayısı:** o yıl **en az bir bölümü** izlenen farklı dizi. "Bitirdi" demek değil — uygulamada bir dizinin bitip bitmediğini söyleyen
    güvenilir bilgi yok (yayındaki dizi hiç bitmez); "izlemeye başladı/sürdürdü" tek tutarlı ölçü.
  - **Bölüm sayısı:** o yıl izlenen **farklı bölüm** (dizi + sezon + bölüm üçlüsü). Aynı bölümü yeniden izlemek **bir** sayılır.
    Numarasız eski kayıtlar tek bölüme çökmez (her biri ayrı sayılır).

Sayılan şeyin adı `kind` (`movies` | `shows` | `episodes`); **limit, adım ve hazır değerler `kind`'a göre**: film/dizi 1–999 (çipler 12/24/52/100 ve
6/12/24/52, adım 1), bölüm 1–9999 (çipler 100/250/500/1000, adım 5 — yılda 500 bölüm olağan, 500 film değil).

Yıl, **izleme tarihinden** gelir (kayıt tarihinden değil): geçmiş bir filmi bugün "izledim" diye işaretleyip tarihini 2019 yapan
kullanıcının 2026 hedefi şişmez. Tarih ayrıştırıcısı Wrapped ile aynı (`utils/wrapped.js` `toDate`, YEREL takvim): 1 Ocak'ta
izlenen şey negatif UTC ofsetinde önceki yıla düşmez. Sayım `useProfileStats()`ın `movieHistoryItems` (olay başına film) ve `flatEpisodesTv`
(olay başına bölüm) listelerinden türer — **yeni Firestore listener açılmaz**.

> Wrapped'dan küçük bir sapma var: Wrapped bir filmi `dateAdded` yılında bir kez sayar (ham liste), hedef **izleme olaylarını** tarar. Bir kez
> izlenen filmde ikisi aynıdır; önceki yıl izlenip bu yıl yeniden izlenen film hedefte bu yıl da sayılır, Wrapped'da tek yılda görünür.

### Düğmedeki yüzde

Açık hatların oranlarının **ortalaması** (film %50, dizi %25 → %37). Adetler toplanmaz: "50 film" ile "500 bölüm" aynı birimde değil, büyük hedef
ortalamayı ezerdi. `%100` ve altın halka yalnız **tüm açık hatlar** tamamlanınca.

## Sayfa (yukarıdan aşağıya)

1. **Özet:** genel halka + yüzde, tempo başlığı ("Tempodan öndesin / Tam tempodasın / Tempoda geridesin / Hedefe ulaştın"), yılın saati
   ("Yıl %49 tamamlandı · 183 gün kaldı"), hat rozetleri ("Film 25 / 50"). Taslak kaydedilmişten farklıysa kartın üst kenarında **"Önizleme"** etiketi.
2. **Film kartı / Dizi kartı:** başlıkta anahtar. Açıkken: (dizi) **ölçü seçimi**, açıklama, hedef (− / + ve hazır çipler), **ilerleme çubuğu** ve
   çubuk üstünde **plan işareti** (bugün olması gereken yer; dolu kısım işaretin önündeyse önde), tempo rozeti ("6 önde", "Tempoda", "Tamam"),
   "Plan: bugün 25 olmalı" ve dört **plan hücresi**: Kalan · Haftada · Ayda · Yıl sonu (tamamlanınca: Fazla · Yıl sonu).
3. **Aylık plan:** 12 çubuk (o ay **ilk kez** izlenen sayısı) + hedef/12 çizgisi. Film ve dizi birlikte açıksa üstte sekmeler. Gelecek aylar soluk
   çerçeve, içinde bulunulan ay tam opak. Toplam, halkadaki sayıyla **aynı** (aynı eser ilk görüldüğü ayda bir kez sayılır).
4. **Alt (sabit):** Kaydet (yalnız bir şey değiştiyse ve bir hat açıkken etkin), Hedefi kaldır (hedef varsa).

**TASLAK:** sayfa kaydedilmiş hedefi değil bir taslağı düzenler. Her dokunuş özeti, çubukları, tempoyu, plan hücrelerini ve aylık çizgiyi **anında**
yeni hedefe göre yeniden hesaplatır — kullanıcı kaydetmeden önce hedefin gerçekçi olup olmadığını görür. Kapatmak taslağı atar. Dizi hattı iki
ölçünün hedefini **ayrı** tutar (12 dizi → bölüme geçip 500 → geri dönünce yine 12). Kapalı hat da bir sayı taşır (açılınca son değerle gelir).

## Tempo ve plan

`beklenen = hedef × (geçen gün / yıl günü)` (düz çizgi; artık yıl 366). Durumlar: `done`, `ahead`, `onTrack`, `behind`, `missed` (yıl bitti),
`upcoming`. **Tolerans = max(1, hedefin %2'si)**: 50 hedefte ±1, 500 bölümde ±10 "tempoda". İzleme düzgün dağılmadığı için her dalgalanma "geride" demez.
Özet pace'i: herhangi biri geride → geride; açık olanların hepsi önde → önde; aksi tempoda.

- **Haftada / Ayda** = kalan ÷ kalan hafta/ay, yukarı yuvarlanır (0,1 hassasiyet), alt sınır 1 hafta/ay (yılın son günlerinde saçma kesirler çıkmasın).
- **Yıl sonu tahmini** = şimdiki tempo sürerse (`sayı × yıl günü ÷ geçen gün`). İlk **28 gün** ve sayı 0 iken yok ("—"): 1 Ocak'ta 1 film "yılda 365" demesin.
- **Yüzde aşağı yuvarlanır** (199/200 → %99) ve kayan nokta tuzağına karşı `+1e-9` payı var: `0.29 * 100 = 28,999…` olduğundan 29/100 hedef "%28" yazardı
  (testle kilitli).
- Yalnız **içinde bulunulan yıl** gösterilir; geçmiş yıllar kayıtta durur.

## Kararlar

- **Yıl başına ayrı kayıt** (`{ "2026": { movies: { target }, shows: { target, measure } } }`, en yeni 10 yıl; kapalı hattın anahtarı yazılmaz). Yeni yılda sayfa
  **önerilen** değerle açılır: geçen yılın hedefi (hatlar ve ölçüyle); yoksa geçen yıl izlenenin %10 fazlası (5'e, bölümde 25'e yuvarlı, tabanlı) — geçen yıl o türden
  izleme **yoksa o hat kapalı** gelir; hiç veri yoksa iki hat açık, ayda 2 film / ayda 1 dizi (24 / 12).
- **Eski biçim** (`{ target, unit }`) okunurken çevrilir: film → film hattı, dizi → dizi hattı (ölçü "dizi sayısı"), "all" → hedef ikiye bölünür (film yukarı yuvarlı;
  hedef 1 ise yalnız film — dizi hattı sahte 1 hedefi almasın, testle kilitli).
- **Cihaz-yerel** (MMKV `data` deposu). `docs/planlama` açık sorusu "kullanıcı verisi mi, yalnız cihaz mı?" için ilk sürüm cevabı: cihaz;
  `docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md` motoruna taşıma kapısı açık. **Sonuç:** uygulamayı silip yeniden kuran / başka cihazdan giren hedefi görmez.
- **Çıkışta silinmez** (`keepOnLogout`): bulut kopyası olmadığı için silinen hedef geri getirilemez. Aynı kalıbı izleme defteri (`watchLedger`) kullanır.
  Hesap SİLİNİRSE `accountService` bu anahtarı da temizlemiyor (defterle aynı durum) — cihazda yetim bir anahtar kalır, başka kullanıcıya görünmez (uid ile kapsanıyor).
- **Ayar yedeğine girmez**: yedek `settings` deposunu kapsıyor, bu kayıt `data` deposunda ve hesaba bağlı.
- **Metin kutusu yok**: hedef küçük bir tam sayı; stepper + hazır çipler yeter, klavye sayfayı sıkıştırmaz. Basılı tutunca 12 adımdan sonra adım ×5 (film/dizi 5, bölüm 25).
- **Listeler gelmeden "%0" yazılmaz**: düğme, `ListStatusContext.loading` ya da `watchedTvLoaded` hazır olana dek boş halka çizer, yüzde yazmaz, dokunulamaz.
- **Düğmede başka hiçbir metin yok**; erişilebilirlik etiketi her hattın sayısını okur ("2026 hedefi: Film 25 / 50, Dizi 24 / 48"). Hedef yokken halkada yüzde yerine bayrak.
- **Ölçü etiketleri, sayı + isim bitişik cümle kurmaz** ("1 movies" tuzağı): birim sözcüğü ("film", "movies", "películas") ayrı etiket; üç dilde çoğul kuralı gerekmez.
- **Hat renkleri Wrapped ile aynı** (film amber `#FBBF24`, dizi gökyüzü `#38BDF8`); yalnız dolgu/simge/çerçeve — metin bu renklerle yazılmaz (açık temada amber metin okunmaz).
- **Animasyon ilk değeri = hedef oran** (Halka ve Çubuk): Reanimated 4.5 ilk değeri geri yazabiliyor (`reanimated-initial-value-vanish`); 0'dan başlasaydı bir yeniden çizim dolu
  çubuğu boşaltabilirdi. Bedeli: açılışta dolum animasyonu yok, değişimler animasyonlu.
- **Eylem satırı darlığı**: sütun 360 pt'te ~158 px; üç düğmeyle "Düzenle"ye ~70 px kalır. "Düzenle" ölçülen genişliği 96 px'in altındaysa simgesini bırakır (yalnız etiket).
  Sütun 150 px'e yetmeyecek kadar darsa (320 pt) satır **sarılır**: halka düğmesi alt satıra iner. `flex: 1` yerine açık `flexBasis: 62` + `flexGrow` (flexBasis 0 sarmayı tetiklemez).
- **Ölçüm:** `yearly_goal` — `action` (`set` | `changed` | `cleared`), `tracks` (`movies` | `shows` | `both`), `movies_target`, `shows_target`, `shows_measure`. Yalnız BAŞARILI yazımda.
- **Bölüm gizlenebilir**: Profil > `goal`. Gizlenince hedef kaydı durur, düğme yalnız görünmez.

## Bilerek yapılmayanlar (sonraki adımlar)

- **Wrapped'a hedef satırı** ("Hedefine ulaştın: 52/50") — Aralık Wrapped'ına malzeme olabilir; ayrı iş.
- **Widget** (iOS/Android) — yeni native build ister.
- **Milestone bildirimi** ("%50'ye geldin", "hedef tamam") ve **hedef tamam kutlaması / rozeti** — bildirim izni ve rozet kataloğu kararı gerekir.
- **Süre (saat) hedefi** — üçüncü bir hat olabilir; ölçü seçimi kalıbı hazır (`kind` + limit/adım/çip tabloları).
- **Bulut senkronu** — cihaz-yerel kararın ters yüzü.
- **Geçmiş yıl görünümü** ("2025: Film 41/50 ✓") — veri kayıtta duruyor, ekran yok.

## Cihazda henüz görülmedi

Jest temiz (tam paket; çekirdek 125 test: sayım, aylık dağılım, tempo/plan, birleştirme, taslak, eski biçim, depo; düğme + sayfa + grafik gerçek depoyla 66 test;
kimlik bloğu eylem satırı; `SwitchToggle` etiketi; metin dengesi). **Görülmeyenler:** halkanın 36 pt cam düğme içinde ve özetteki 84 pt halkanın cihazda çizimi
(`rotation`/`origin`, `strokeLinecap`), iOS 26 cam düğmede halka kırpılması, "%100"ün 24 pt iç çapa sığması, çubuğun plan işareti hizası, **sayfanın gerçek yükseklikte**
kaydırılması (maxHeight %92, ortası kayar/altı sabit), 320 pt'te hat kartı hücreleri ve özet sütunu (hesaplı: 260 px iç genişlikte dört hücre ~59 px, ölçülmedi), 12 aylık
çubukların ~18 px sütunda sayı etiketleriyle sığması, iOS yerel anahtarın kart başlığında kutusu, 360/375/320 pt'te "Düzenle" davranışı (Yoga ölçümü yapılmadı; davranış
bağlantısı test edildi, gerçek genişlikler değil), "Hareketi azalt". Kural bazlı kontrol: yeni bileşenlerde dikey `flex: 1` yok (`yoga-layout-harness` notundaki çökme
deseni yok); `flex: 1` yalnız satırların ana ekseninde, grafik yüksekliği açık.

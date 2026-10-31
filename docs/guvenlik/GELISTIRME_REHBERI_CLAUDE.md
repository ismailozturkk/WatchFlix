# Geliştirme Rehberi — Claude Code (ajan için)

**Kaynak:** `docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md`
**Biçim:** Her görev bağımsız uygulanabilir. Sıra önem derecesine göredir. Her görevde: KONUM · SORUN · YAPILACAK · KABUL KRİTERİ.
**Kurallar:**
- `firestore.rules` değişiklikleri `__tests__/rules/` emülatör testleriyle kanıtlanmalı (`npm run test:rules`). Emülatör JDK 21 ister; bu makinede `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`.
- Kural/istemci parite testleri varsa (örn. `feedbackRulesParity`, `aiRequestLimits`) ikisi birlikte güncellenmeli.
- Prod projesi `movieandtv-2832a`. Hiçbir test/deploy onay olmadan prod'a gitmez.
- Her görev ayrı commit; mesaj TR, sonunda `Co-Authored-By` satırı (bkz. repo attribution).

**DEVAM NOKTASI (2026-10-31 gece):** Tüm görevlerin kod kısmı bitti. Commit'ler: f662792, 6f98cef, ba06e73, d992cbf,
ebb818f, b59f668, 1d6e77b (T-PERF-2), 362d550 (T-SEC-4), 2ad7601 (T-SEC-5/6), 576288e (T-LOAD-1). Push YOK, deploy YOK.
Kalanların hepsi kullanıcı eylemi ya da kararı. Liste: `GELISTIRME_REHBERI_BEN.md` → "📌 NOTLAR". Kullanıcı karar
vermeden yeni kod işi açma. Çalışma ağacında başka oturumların commit'lenmemiş işi var (Haftalık Lig: `functions/index.js`
lig blokları, `firestore.rules` ~205 satır, 8 dosyalık staged silme). Bunlara dokunma; commit'leri geçici
`GIT_INDEX_FILE` ile hunk seçerek yap.

---

## P0 — Performans sıcak noktaları (ölçümle kanıtlı, 10K ön şartı)

### T-PERF-1 — Tek-belge sayaçları dağıt (DailyPolls / Top100Hype / Ratings / turnuva agg)
> **DURUM: KOD TAMAM (2026-10-31), DEPLOY BEKLİYOR.** Uygulanan (tercih edilen desen yerine belge başına uygun olan):
> DailyPolls → 10 parçalı sayaç `shards/{0-9}` + increment'li toplu yazım (eski gün-belgesi yolu geriye uyum için açık,
> çift sayım kuralda kapalı); Top100Hype → transaction yerine increment'li toplu yazım (`count` sıralama sorgusunda,
> parçalanamaz); Ratings → increment'li toplu yazım + bayat farkta tek yeniden deneme; turnuva agg → kör `update`,
> transaction yalnız ilk-yazımda. Ölçüm: denetim §5 "Ölçüm 3". **Yayın sırası: önce `firestore.rules` + functions
> deploy, sonra istemci** (yeni istemci yeni kural olmadan oy yazamaz). Deploy kararı kullanıcıda.
> Kalan: cihazda iki cihazla gerçek oylama; eski sayaç verisi göçü GEREKMİYOR (okuma iki kaynağı topluyor).
**KONUM:**
- `firestore.rules:1717` `DailyPolls/{dayKey}` (a/b sayaç) + `rules:1751` `votes/{uid}`
- `firestore.rules:1773` `Top100Hype/{mediaKey}.count` + `rules:1801` `votes/{uid}`
- `firestore.rules:836` `Ratings/{mediaKey}` (count/sum)
- `functions/index.js:1967` `onTournamentVoteWritten` → `tournaments/{id}/agg/tallies`
- İstemci: `services/top100Service.js`, `utils/dailyChallenge*`, `services/ratingsService.js`

**SORUN (ölçüldü, emülatör):** Tek sayaç belgesine eşzamanlı yazma çöküyor — 100 eşzamanlıda 3/100, 1.000'de 1/1000 başarılı (gerisi transaction abort). Ayrı belgeye yazınca 1.000/1.000 başarılı, p95≈46ms. Kaynak: denetim §5.

**YAPILACAK (desen seçimi tutarlı olmalı — tüm sayaçlar aynı desene):**
1. **Tercih edilen — event-append + tetikleyici toplama:** İstemci yalnız kendi oy belgesini yazar (zaten var: `DailyPolls/{gün}/votes/{uid}`, `Top100Hype/{m}/votes/{uid}`). Toplam sayaç istemci tarafından DEĞİL, `onDocumentWritten` tetikleyicisiyle **N parçalı shard'a** (`.../agg/shard_{0..9}`) yazılır. İstemci okurken shard'ları toplar.
2. `firestore.rules`'tan istemcinin sayaç belgesine yazma iznini kaldır (sayaç artık yalnız Admin SDK/tetikleyici). Oy belgesi kuralları (tek oy, değiştirilemez) kalır.
3. Turnuva `agg` zaten tetikleyiciyle yazılıyor (`onTournamentVoteWritten`); onu da tek `tallies` belgesinden shard'lı yapıya geçir (fan-in çekişmesini kaldır).
4. İstemci toplam okuma yardımcıları (`utils/`): shard toplama fonksiyonu + testi.

**KABUL KRİTERİ:**
- `load-test/firestore-hotspot-harness.mjs` benzeri koşumda yeni desen 1.000 eşzamanlı oyda ≥%99 başarı (emülatör), çöküş yok.
- `npm run test:rules` yeşil; istemcinin artık sayaç belgesine doğrudan yazamadığını doğrulayan yeni kural testi eklendi.
- Eski sayaç verisi için göç/migration notu (`docs/`); okuma tarafı eski tek-belge + yeni shard'ı geriye dönük okuyabilir.

### T-PERF-2 — `maxInstances` ve fan-out maliyetini açık yönet
> **DURUM: KOD TAMAM (2026-10-31), DEPLOY BEKLİYOR.** Canlı yapılandırma okundu: gen2 = 1 vCPU + eşzamanlılık 80
> (10 instance ≈ 800 eşzamanlı istek) → "10 tavanı throughput'u boğar" varsayımı abartılıydı. `functions/capacity.js`
> sınıfları: `light` 20 (yalnız Firestore'lu callable'lar), `upstream` 10 (Gemini/OMDb/RevenueCat/Apple —
> `syncPremiumStatus` RevenueCat API çağırdığı için burada, rehberin ilk önerisinden bilinçli sapma), `trigger` 10,
> `singleton` 1 (zamanlanmışlar). gen1 `purgeOnAuthUserDeleted` 3000 → 10 (`runWith`). Bekçi:
> `functions/capacity.test.js` (her export açık tavan seçmeli). Manifest (`__endpoint.maxInstances`) ile doğrulandı.
> Fan-out doğrulandı (değişiklik-varsa + alan bazlı patch + 450 batch). Kalan: staging k6 p95 (T-LOAD-1'e bağlı);
> ad/avatar değişikliğine bekleme süresi (ürün kararı).
**KONUM:** `functions/index.js:89` (`setGlobalOptions({ maxInstances: 10 })`), `index.js:1610` `onUserProfileUpdated`.
**SORUN:** Global 10 instance tavanı yük altında callable throughput'unu sınırlar; profil fan-out bir düzenlemeyi ~15 yüzeye yayar.
**YAPILACAK:** Maliyet-kritik olmayan callable'lara (`getReferralOverview`, `syncPremiumStatus`) daha yüksek per-fonksiyon `maxInstances`; AI/OMDb'de düşük bırak (kota zaten frenliyor). Fan-out'u batch ve değişiklik-varsa-yaz ile sınırla (zaten kısmen var — doğrula). Karar gerekçesini yorum olarak yaz.
**KABUL KRİTERİ:** Her callable'ın `maxInstances`'ı bilinçli ayarlı; staging k6 ile p95 ölçülüp denetim §5'e eklendi.

---

## P1 — Güvenlik (orta)

### T-SEC-1 — `Users` koleksiyonunda toplu listelemeyi kapat (H-1)
> **DURUM: KOD TAMAM (2026-10-31), DEPLOY BEKLİYOR.** DİKKAT — ilk yazımdaki "arama Usernames koleksiyonundan
> yapılıyor" varsayımı YANLIŞTI: `services/userService.searchUsersByUsername` Users'ı doğrudan listeliyordu.
> Uygulanan: `searchUsers` callable (`functions/userSearch.js`, 30/dk/uid, 5 alan, ≤ 20 sonuç); istemci araması
> callable'a geçti; kural `Users` → `get` açık, `list` yalnız `legacyUserSearchList()` + `request.query.limit <= 20`;
> `Usernames` → `get: true`, `list: false` (oturumsuz kullanıcı adı→uid dökümü kapandı, H-1b).
> **Yayın sırası:** functions → istemci → eski sürümler bitince `legacyUserSearchList()` = false + rules deploy.
> Kalan: anahtarı kapatma zamanı (eski sürüm oranına bağlı) kullanıcı kararı; cihazda arama denenmedi.

**KONUM:** `firestore.rules:424-425`.
**SORUN:** `allow read: if isSignedIn()` → `list` açık; oturumlu saldırgan tüm kullanıcı tabanını (profil + plan) kazıyabilir.
**YAPILACAK (ilk plan — yukarıdaki durum notu geçerlidir):**
```
match /Users/{uid} {
  allow get:  if isSignedIn();
  allow list: if false;
  ... (create/update/delete aynı kalır)
}
```
İstemcide `Users` üzerinde koleksiyon sorgusu (getDocs/where) var mı tara (`services/`, `screens/`); varsa callable'a taşı.
**KABUL KRİTERİ:** Yeni kural testi: oturumlu kullanıcı `list(Users)` reddedilir, `get(Users/{uid})` geçer. İstemci hiçbir yerde `Users` koleksiyonunu sorgulamıyor. `npm run test:rules` yeşil.

### T-SEC-2 — App Check'i callable'larda kademeli zorunlu kıl (H-2)
> **DURUM: BLOKE (2026-10-31).** Son 28 günde Firestore'da **0 VALID** doğrulama (37.258 INVALID + 110.125 jetonsuz;
> denetim M-3 tablosu). `enforceAppCheck: true` ya da konsolda ENFORCE şu an TÜM trafiği keser — YAPMA.
> Önce jeton üretimi çalışmalı:
> 1. iOS: `app.json` → `expo.ios.entitlements` içine `"com.apple.developer.devicecheck.appattest-environment": "production"`
>    (yeni native build + Apple App ID'de App Attest yeteneği); DeviceCheck `.p8` anahtarını Firebase'e kaydet (kullanıcı,
>    Apple hesabı); iOS debug jetonu ekle (şu an 0).
> 2. Android: Play Console → Uygulama bütünlüğü → Play Integrity'nin Cloud projesi 427087836931'e bağlı olduğunu
>    doğrula (API'den görünmüyor); yalnız Play'den (dahili test kanalı) yüklenen build ile dene — yandan yüklenen APK
>    `appIntegrity` varsayılanında BİLEREK INVALID olur.
> 3. `services/appCheck.js`: yayın build'inde yerel `getToken` hatasını Sentry'ye düşür (şu an sessizce yutuluyor);
>    "boş jeton gönderilmez" yorumunu düzelt (JS SDK hata jetonu ekliyor).
> 4. İzleme: `firebaseappcheck.googleapis.com/services/verification_count` (security etiketi) VALID payı mevcut sürümde
>    ≥ %95 olunca sırayla ENFORCE: callable'lar → Firestore → Auth → RTDB.
>
> **KODDA YAPILANLAR (2026-10-31, commit bekliyor → bkz. git log):**
> - (1) `app.json` `ios.entitlements` → `appattest-environment: production` eklendi (`expo config --type introspect`
>   ile son yapılandırmada doğrulandı). Yeni iOS native build ŞART; EAS kimlik bilgisi yönetimi App ID'ye App Attest
>   yeteneğini senkronlar — senkronlamazsa Apple Developer → Identifiers → App Attest elle açılır.
> - (3) `services/appCheck.js`: yayın build'inde yerel `getToken` hatası / boş jeton Sentry'ye (`AppCheck/getToken`,
>   oturum başına sebep başına 1 kez); yanıltıcı yorum düzeltildi; `EXPO_PUBLIC_APPCHECK_DEBUG=1` ile geliştirmede
>   debug sağlayıcı (varsayılan kapalı, yayın etkilenmez). Testler: `__tests__/appCheck.test.js` (8).
> - (4) `npm run appcheck:status` (`scripts/appcheck-status.cjs`, salt-okunur): modlar, sağlayıcılar, servis başına
>   VALID payı ve "zorunluluğa hazır mı" kararı.
> - Debug jetonu notu: geliştirme build'leri App Check'i varsayılan ATLADIĞI için debug jetonu yalnız
>   `EXPO_PUBLIC_APPCHECK_DEBUG=1` ile ya da zorunluluk açıldıktan sonra gerekir (Android 1, iOS 0 kayıtlı).
>
> **KULLANICIDA KALAN:** DeviceCheck `.p8` anahtarını Firebase'e yüklemek; Play Console ↔ Cloud projesi bağlantısını
> doğrulamak; yeni iOS + Android yayın build'i (Play dahili test / TestFlight) çıkarıp `appcheck:status` ile VALID'i
> izlemek. Sentry'de `AppCheck/getToken` olayları sebebi gösterecek.
> Okuma yöntemi (salt-okunur): firebase-tools oturumu + `requireAuth({user, tokens})` + `getAccessToken()` + fetch
> (bkz. hafıza `rules-tests-jdk`).
**KONUM:** `functions/index.js:1124` (`callGemini` `enforceAppCheck:false`), `index.js:1230` (`getExternalRatings`), `index.js:89` (global), istemci `firebase.js:33` + `services/appCheck.js`.
**SORUN:** İstemci App Check jetonu üretiyor ama sunucu doğrulamıyor; cihaz doğrulaması fiilen kapalı.
**YAPILACAK:** Önce staging'de `callGemini`, `getExternalRatings`, `redeemCode`'da `enforceAppCheck: true` yap; Play Integrity sahada stabil doğrulandıktan sonra prod. Debug/CI için App Check debug token akışını belgele.
**KABUL KRİTERİ:** Belirtilen callable'lar App Check jetonu olmadan `unauthenticated`/`failed-precondition` döndürüyor; gerçek istemci etkilenmiyor (staging cihaz testi). Rollback planı yazılı.

### T-SEC-3 — Firestore/RTDB App Check enforcement'ı doğrula (M-3)
> **DURUM: DOĞRULANDI (2026-10-31).** Firestore, RTDB, Auth: UNENFORCED; Functions: kodda kapalı. Sağlayıcı ve trafik
> ayrıntısı denetim M-3'te. Sonraki iş T-SEC-2'nin 1-4. adımları.
**KONUM:** Firebase Console (kodda görünmez).
**YAPILACAK:** Console → App Check → Firestore/RTDB/Functions "Monitor→Enforce" durumunu kontrol et; `docs/`'a mevcut durumu ve hedefi yaz.
**KABUL KRİTERİ:** `docs/guvenlik/` altında enforcement durum notu + planlanan geçiş tarihi.

### T-SEC-4 — TMDB jetonu stratejisi (M-1)
> **DURUM: KARAR BEKLİYOR (2026-10-31) — kod değişmedi.** Analiz + (a) döndürme prosedürü:
> `docs/guvenlik/TMDB_JETON_YONETIMI.md`. Öneri (a). (b) seçilirse önce App Check VALID ≥ %95 şart, sonra tek istemci
> TMDB katmanı (112 dosya / 239 çağrı) + önbellekli proxy; proxy IP'leri TMDB hız sınırına takılmasın diye önbellek
> zorunlu. Kullanıcı (b) demeden başlama.
**KONUM:** `services/cineswipe/cineswipeService.js:52`, `services/dataDownloader.js:57`, `services/import/tmdbResolver.js:24`, `services/tournamentService.js:38`, `context/AppSettingsContext.js:75`.
**SORUN:** TMDB v4 okuma jetonu istemci paketine gömülü (çıkarılabilir).
**YAPILACAK (karar gerektirir — kullanıcıya sor):** (a) Kabul et + jeton rotasyonu/anomali izleme belgele, YA DA (b) TMDB'yi önbellekli bir Cloud Function proxy arkasına al (Gemini/OMDb deseniyle aynı; `functions/` + `defineSecret("TMDB_API_KEY")` zaten var).
**KABUL KRİTERİ:** Seçilen yol belgeli; (b) seçilirse istemci TMDB çağrıları proxy'den geçiyor ve `EXPO_PUBLIC_API_KEY` paketten kalkıyor.

---

## P2 — Güvenlik (düşük) ve hijyen

### T-SEC-5 — waitlist/beta e-posta oracle'ı (L-1)
> **DURUM: KABUL EDİLEN RİSK OLARAK BELGELENDİ (2026-10-31) — kod değişmedi.** Gerekçe denetim L-1 notunda: callable
> oturumsuz sitede oracle'ı kaldırmaz, yalnız taşır. Gerçek kapatma = UX değişikliği (site "zaten kayıtlı" demez,
> sıra no yalnız `wf_ticket`'ta; kural `get: false`). Kullanıcı isterse uygula: `website/home.js` `addEmail` +
> `addBetaTester` önce `getDoc` yerine doğrudan `setDoc`, `permission-denied` = sessizce "alındı"; kural testleri
> (`__tests__/rules/`) waitlist/betaTesters `get` reddi.
**KONUM:** `firestore.rules:80-115`.
**YAPILACAK:** `allow get: if true`'yu kaldırıp "zaten kayıtlı mı" kontrolünü bir callable'a taşı (ya da kabul edilen risk olarak belgele). Düşük öncelik.
**KABUL KRİTERİ:** Karar belgeli; değiştiyse landing akışı bozulmadan çalışıyor (`website/`).

### T-SEC-6 — İmza anahtarı + `.env` hijyeni (L-2)
> **DURUM: KOD/BELGE TAMAM (2026-10-31).** Takip dışı olduğu ve geçmişte hiç bulunmadığı teyitli (`git ls-files`,
> `git log --all`). README'ye "Gizli dosyalar" bölümü (`git archive` ile paylaş). Taşıma planı denetim L-2 notunda.
> `.jks`'i ajan TAŞIMAZ/SİLMEZ — kullanıcı parola yöneticisine koyup EAS parmak iziyle karşılaştırdıktan sonra kaldırır.
**KONUM:** Kök: `@smlztrk__seelogd.jks`, `.env`, `.env.local`.
**YAPILACAK:** `.jks`'i depo dışına (EAS credentials / parola yöneticisi) taşı; depo paylaşımında bu dosyaları dışarıda bırak. `.gitignore` zaten kapsıyor (doğrulandı) — ek olarak README'ye "repo'yu zip'lerken hariç tut" notu.
**KABUL KRİTERİ:** `.jks` depo kökünde durmuyor ya da taşınma planı belgeli; git takibinde olmadığı teyitli.

---

## P3 — Yük testi altyapısı (ertelenen ölçümler)

### T-LOAD-1 — k6 + staging ile callable/fan-out/presence senaryoları
> **DURUM: KOD HAZIR (2026-10-31), ÖLÇÜM BLOKE — staging projesi yok (kullanıcı açmalı), k6 kurulu değil.**
> Yapılan: (2) `functions/upstreamStub.js` — `FUNCTIONS_TEST=1` iken Gemini/OMDb/RevenueCat/TMDB sahte yanıt,
> Google/Apple kimlik uçları ret, Expo push gönderilmez; prod proje kimliğinde bayrak yok sayılır. `index.js`'te tek
> satır (`setupUpstreamStub({ expo })`). Testler: `functions/upstreamStub.test.js` (6; sahte yanıtlar gerçek
> ayrıştırıcılardan geçiyor). Emülatörde uçtan uca: `getExternalRatings` + `callGemini` (Firestore kota dahil, ~92 ms)
> dışarı çıkmadan döndü; prod kimliğiyle `fetch` değişmedi. (3) `load-test/k6-callables.js` düzeltildi: callGemini
> gövdesine eksik `systemInstruction` (400 alırdı), jeton havuzu (`ID_TOKENS_FILE`), 429 beklenen durum,
> `searchUsers` adımı. `load-test/README.md` staging kurulum adımları; `load-test/tokens*.json` gitignore'da.
> Kalan: (1) staging projesi + `.firebaserc` alias (kullanıcı, faturalı hesap); k6 kurulumu; koşum + §5'e "measured
> (staging)". Fan-out ve RTDB presence senaryosu henüz yazılmadı (staging olmadan doğrulanamaz).
**KONUM:** `load-test/` (iskeletler hazır), `.firebaserc` (tek proje — M-2).
**SORUN:** k6 bu makinede kurulu değil; anlamlı throughput için izole staging + upstream stub şart.
**YAPILACAK:**
1. Ayrı Blaze projesi (örn. `movieandtv-staging`); `.firebaserc`'a `staging` alias.
2. `functions/`'a `FUNCTIONS_TEST=1` bayrağı: Gemini/OMDb/TMDB/RevenueCat çağrılarını sabit/sahte yanıta kısa devre.
3. k6 kur; `load-test/k6-callables.js`'i staging'e yönelt; §4.3 senaryo 1-2 + fan-out + RTDB presence.
**KABUL KRİTERİ:** 100/1k/5k/10k kademelerinde p50/p95/p99, hata oranı, instance/cold-start ölçüldü; denetim §5'e "measured (staging)" olarak eklendi. Prod'a hiç dokunulmadı.

---

## Uygulama sırası (özet)
1. T-PERF-1 (en kritik, ölçümle kanıtlı)
2. T-SEC-1, T-SEC-2, T-SEC-3
3. T-PERF-2, T-SEC-4 (kullanıcı kararı)
4. T-SEC-5, T-SEC-6
5. T-LOAD-1 (staging kurulunca)

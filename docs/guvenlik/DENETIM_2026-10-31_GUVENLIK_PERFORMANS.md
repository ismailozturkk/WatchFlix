# Seelogd — Güvenlik ve Performans Denetimi (Plan + Statik Bulgular)

**Tarih:** 2026-10-31
**Kapsam:** Kaynak kod güvenlik denetimi (Firebase Auth + Firestore Rules + Cloud Functions + istemci) ve performans/yük testi **planı**.
**Durum:** Bu belge yalnızca **statik analiz** ve **plan** içerir. Hiçbir canlı yük testi veya aktif güvenlik testi çalıştırılmadı. Gerçek ölçümler, onay sonrası ayrı bölümde raporlanacaktır.

> Bu belgedeki tüm sayısal performans değerleri **TAHMİN**'dir (analitik). Ölçülen değerler yoktur; testler henüz çalıştırılmadı.

---

## 0. Yönetici özeti

Kod tabanı güvenlik açısından **olgun ve bilinçli yazılmış**. Üçüncü taraf anahtarlarının tamamı Secret Manager'da, satın alma durumu sunucuda doğrulanıyor, Firestore kuralları kimliğe bürünme / sayaç şişirme / yetki yükseltme gibi klasik saldırıları kapatacak şekilde yazılmış. Kritik (Critical) ya da yüksek istismar edilebilirliği olan bir açık bulunamadı.

Dikkat edilmesi gereken başlıca noktalar:

| # | Başlık | Önem | Tür |
|---|--------|------|-----|
| H-1 | `Users` koleksiyonunda `list` tüm oturumlulara açık → tüm kullanıcı tabanı kazınabilir | Orta-Yüksek | Gizlilik / OWASP M6 |
| H-2 | App Check istemcide kurulu ama hiçbir Cloud Function'da **zorunlu değil** | Orta | M4 / kötüye kullanım |
| M-1 | TMDB v4 okuma jetonu istemci paketine gömülü (`EXPO_PUBLIC_API_KEY`) | Orta | M1 / M9 |
| M-2 | Tek Firebase projesi (yalnız prod); izole test/staging ortamı yok | Orta | Operasyonel / test güvenliği |
| M-3 | Firestore App Check zorunluluğu koddan doğrulanamıyor (konsol ayarı) | Orta | Doğrulanmalı |
| L-1 | `waitlist` / `betaTesters` `get: if true` + docId=base64(e-posta) → e-posta varlık sızıntısı | Düşük | M6 |
| L-2 | İmza anahtarı (`.jks`) ve `.env` çalışma ağacında duruyor (git'te değil) | Düşük | M9 / hijyen |
| L-3 | Grup kuralları aşırı karmaşık → denetlenebilirlik riski | Düşük/Bilgi | Bakım |

Olumlu yanlar (korunmalı): Secret Manager, sunucu taraflı RevenueCat/Apple/Google doğrulaması, zamanlama-güvenli webhook karşılaştırması (`timingSafeEqual`), yaz-bir-kez doğum tarihi, PII'nin `private/` alt koleksiyonuna taşınması, sayaç kıskaçları (±1), `getAfter` ile oy bütünlüğü, AI/OMDb girdi doğrulama + hız sınırlama, hesap silmede taze giriş zorunluluğu.

---

## 1. Mimari (denetimin dayandığı model)

Sunucusuz, **istemci-doğrudan Firebase** mimarisi:

- **İstemci → Firestore / RTDB / Auth doğrudan** (Firebase JS SDK + App Check). Trafiğin büyük çoğunluğu burada; Google tarafından otomatik ölçeklenir. Yetki tamamen `firestore.rules`'ta.
- **Cloud Functions (gen2, `maxInstances: 10`)** — ince bir katman:
  - Çağrılabilir (callable): `callGemini`, `getExternalRatings`, `syncPremiumStatus`, `getReferralOverview`, `redeemCode`, `claimReferralReward`, `deleteAccountData`, `checkGoogleSignInEligibility`, `checkAppleSignInEligibility`, `revokeAppleAuthorization`, `awardLeagueXp` (11 adet).
  - HTTP: `revenueCatWebhook` (Bearer auth'lu, tek açık uç).
  - Firestore tetikleyici: 7 adet (sosyal bildirim, DM, grup mesajı, profil fan-out, turnuva oyu agregasyonu, temizlik).
  - Zamanlanmış: 6 adet (promosyon süpürme, streaming, haftalık özet, turnuva arşivi, oda temizliği, lig).
- **Üçüncü taraflar:** TMDB (istemci-doğrudan), Gemini / OMDb / RevenueCat (sunucu-taraflı, Secret Manager).

**Yük testi açısından kritik sonuç:** Geleneksel anlamda yük bindirilecek bir "API origin"i yok. Klasik k6/Artillery HTTP testinin yüzeyi yalnızca **Cloud Functions uçlarıdır**; onlar da tasarımca kota/hız sınırlıdır ve ücretli üçüncü taraflara bağlıdır. Firestore/RTDB tarafı ancak SDK veya emülatör üzerinden eşzamanlılık testine tabi tutulabilir (düz HTTP değil).

---

## 2. Güvenlik bulguları (önem sırasına göre)

### H-1 — `Users` koleksiyonunda toplu listeleme açık (Orta-Yüksek)
**Yer:** `firestore.rules:424-425` — `match /Users/{uid} { allow read: if isSignedIn(); }`
**Sorun:** Firestore'da `read` = `get` + `list`. Kural `list`'i de açtığı için, oturum açmış herhangi bir kullanıcı `getDocs(collection(db,'Users'))` ile **tüm kullanıcıların** kök profil belgesini sayfalayarak çekebilir: `displayName`, `username`, `photoURL`, `avatarIndex`, sayaçlar, `privacy`, `fourFavorites`, `showcaseBadges` ve **`entitlements` (plan bilgisi)**. Kayıt açık olduğundan (e-posta/Google/Apple) saldırgan bir hesap açıp tüm kullanıcı tabanını kazıyabilir.
**Not:** E-posta ve doğum tarihi zaten `private/account`'a taşınmış (iyi); sızan veri "profil" verisiyle sınırlı. Yine de toplu kazıma, tek tek `get` ile profil okumadan farklıdır.
**Öneri (ilk sürüm — YANLIŞTI, düzeltildi):** Bu bölümün ilk hâli "profil araması zaten `Usernames` koleksiyonundan yapılıyor, `list: false` aramayı etkilemez" diyordu. **Doğru değil:** arkadaş araması (`services/userService.searchUsersByUsername` → `SearchFriendsScreen`) `Users` koleksiyonunu doğrudan ön-ek sorgusuyla listeliyordu ve üstelik **tüm profil belgesini** (plan bilgisi dahil) döndürüyordu. Düz `list: false` aramayı kırardı.

**Ek bulgu (H-1b):** `Usernames` kuralı `allow read: if true` idi — `list` dahil, **oturum açmamış** biri bile tüm kullanıcı adı → uid eşlemesini dökebiliyordu (sonra her uid için `get(Users/{uid})` ile profil). İstemci bu koleksiyonu hiç listelemiyor.

**Uygulanan (2026-10-31):**
- Yeni `searchUsers` callable'ı (`functions/userSearch.js` + `index.js`): oturum zorunlu, kullanıcı başına 30/dk hız sınırı, terim doğrulama (`[a-z0-9_]{1,20}`), en fazla 20 sonuç, **yalnız 5 alan** (`uid, username, displayName, avatarIndex, photoURL`). İstemci arama bunu çağırıyor.
- `Users`: `get` oturumluya açık; `list` yalnız `legacyUserSearchList()` açıkken ve `request.query.limit <= 20` iken (sahadaki eski sürümlerin aramasını kırmamak için). Sınırsız ya da büyük sayfalı sorgu her durumda reddedilir. Eski sürümler emekliye ayrılınca anahtar `false` + rules deploy → `Users` hiç listelenemez.
- `Usernames`: `get: if true` (kayıt ekranı oturumsuz kontrol eder), `list: if false`.
- Kalan risk (anahtar açıkken): oturumlu biri 20'lik sayfalarla ön-ek taraması yapabilir — tek sorguda toplu döküm kapandı ama tam kapanış anahtarın kapanmasıyla olur.

Yayın sırası: functions (`searchUsers`) → istemci → (eski sürümler bitince) anahtar `false` + rules. `Usernames` ve `limit ≤ 20` kısıtı geriye uyumlu, ilk rules deploy'uyla hemen gidebilir.

### H-2 — App Check hiçbir fonksiyonda zorunlu değil (Orta)
**Yer:** `firebase.js:33` (istemci App Check init) vs `functions/index.js:1124` (`enforceAppCheck: false`), `index.js:1230` (aynı), diğer callable'larda ayar hiç verilmemiş (varsayılan `false`).
**Sorun:** İstemci Play Integrity App Check jetonu üretip gönderiyor ama sunucu bunu **doğrulamıyor**. Yani cihaz doğrulaması fiilen uygulanmıyor. Saldırgan yalnızca bir Firebase auth jetonuyla (kayıt açık) callable'ları betikle çağırabilir: `callGemini` (AI kotasını tüketme), `getExternalRatings`, `redeemCode` (kod deneme — günlük bütçe var), `awardLeagueXp` vb.
**Hafifletenler (mevcut):** her callable `request.auth` istiyor; AI günlük/aylık kota + patlama freni; OMDb kullanıcı başına hız sınırı; `awardLeagueXp` oyu sunucuda doğruluyor; `redeemCode` günlük deneme bütçesi. Bu yüzden etki sınırlı ama gerçek.
**Öneri:** Kodda zaten TODO var (`index.js:1019-1021`). Play Integrity sahada stabilse callable'larda kademeli olarak `enforceAppCheck: true` yap (önce `callGemini`, `getExternalRatings`, `redeemCode`). Firestore için de konsolda App Check zorunluluğunu aç (bkz. M-3).

### M-1 — TMDB v4 okuma jetonu istemciye gömülü (Orta)
**Yer:** `services/*` (cineswipe, dataDownloader, tmdbResolver, tournamentService), `context/AppSettingsContext.js:75` — hepsi `process.env.EXPO_PUBLIC_API_KEY`.
**Sorun:** `EXPO_PUBLIC_` değişkenleri paket içine gömülür → APK/IPA'dan çıkarılabilir. Gemini/OMDb sunucuya taşınmış ama genel TMDB gezinmesi hâlâ istemci jetonuyla.
**Risk seviyesi:** TMDB v4 "read access token" salt-okunur ve hesap seviyesinde kota sınırlı; sızması veri değiştiremez, yalnızca kotanı harcar / jetonu yenilemen gerekir. Bu yüzden Orta.
**Öneri:** Kabul edilebilir bir risk olarak bırakılabilir (çoğu istemci-doğrudan uygulama böyle yapar) **ya da** TMDB'yi de hafif bir Cloud Function proxy'nin (önbellekli) arkasına al. En azından: jetonu düzenli döndürülebilir tut ve TMDB panelinden kullanım anomalisi izle.

### M-2 — İzole test/staging ortamı yok (Orta)
**Yer:** `.firebaserc` — tek proje: `movieandtv-2832a` (prod).
**Sorun:** Gerçek bir yük testi ya da aktif güvenlik testi için güvenli bir hedef yok. Prod'a yük bindirmek: gerçek kullanıcı verisi, gerçek kotalar ve gerçek üçüncü taraf anahtarları demektir — istenmeyen maliyet ve kesinti riski.
**Öneri:** Yük/pentest öncesi **ayrı bir Blaze projesi** (ör. `movieandtv-staging`) oluştur; aynı `firestore.rules` + functions deploy edilir, üçüncü taraf çağrıları bir `FUNCTIONS_TEST` bayrağıyla kısa devre yapılır (aşağıda §4). Bu, yük testi güvenliğinin ön şartıdır.

### M-3 — Firestore App Check zorunluluğu koddan doğrulanamıyor (Orta — doğrulanmalı)
**Sorun:** Firestore/RTDB için App Check zorunluluğu konsol ayarıdır, kodda görünmez. İstemci App Check init ediyor ama zorunluluk kapalıysa, kurallara uyan her istek (sahte istemciden de) geçer.
**Öneri:** Firebase Console → App Check → Firestore/RTDB/Functions "Enforce" durumunu doğrula. Kademeli "monitor → enforce" geçişi yap.

**DOĞRULANDI (2026-10-31, salt-okunur API — App Check, Firebase Management, Cloud Monitoring, Service Usage; hiçbir
ayar değiştirilmedi):**

| Kontrol | Sonuç |
|---|---|
| Zorunluluk modu | Firestore, Realtime Database, Auth (identitytoolkit): **UNENFORCED**. Functions: kodda `enforceAppCheck: false`. |
| Android Play Integrity | Yapılandırma var; `deviceIntegrity: NO_INTEGRITY` (en serbest), `appIntegrity` varsayılan (Play'in tanımadığı sürüm reddedilir). 6 imza parmak izi (3 SHA-1, 3 SHA-256). Play Integrity API: **ENABLED**. 1 debug jetonu. |
| iOS App Attest | Firebase'de kaydı var, ama `app.json` → `ios.entitlements` içinde **`com.apple.developer.devicecheck.appattest-environment` YOK** → App Attest jeton üretemez. |
| iOS DeviceCheck (yedek) | **Özel anahtar kayıtlı değil** (`keyId`/`privateKeySet` yok) → yedek de çalışmaz. iOS debug jetonu: **0**. |

**Trafik (Cloud Monitoring `firebaseappcheck.googleapis.com/services/verification_count`):**

| Son 28 gün | Geçersiz jeton (INVALID) | Jeton yok (MISSING_*) | **Geçerli (VALID)** |
|---|---|---|---|
| Firestore | 37.258 | 110.125 | **0** |
| Auth | 164 | 941 | **0** |

(Son 7 günde de VALID yok: Firestore 23.920 geçersiz + 67.342 jetonsuz.)

**Yorum:** Bugün zorunluluk açılsa **trafiğin tamamı reddedilir.**
- *Jetonsuz (~%75):* `services/appCheck.js` `__DEV__` build'lerinde App Check'i bilerek atlıyor. Uygulama yayında olmadığı için
  trafiğin çoğu geliştirme build'leri — beklenen durum.
- *Geçersiz (~%25):* yayın build'lerinde yerel jeton alınamayınca `CustomProvider` hata fırlatıyor; Firebase JS SDK bu durumda
  isteğe sahte bir hata jetonu ekler (koddaki "boş jeton gönderilmez" yorumu bu yüzden doğru değil). Yani **her yayın
  build'inde jeton değişimi başarısız.** Olası nedenler — iOS: eksik App Attest yetkisi + DeviceCheck anahtarı; Android:
  Play'den yüklenmemiş (EAS önizleme APK'sı vb.) sürüm `appIntegrity` varsayılanına takılır, ya da Play Console'da
  Play Integrity ↔ Cloud projesi bağlantısı eksik (API'den görülemiyor).

**Yeni sıra (H-2 bu düzeltilmeden açılamaz):** iOS yetkisi + DeviceCheck anahtarı + iOS debug jetonu → Android'de Play
bağlantısını doğrula ve yalnız Play'den yüklenen build'le dene → yayın build'inde jeton hatasını Sentry'ye düşür →
mevcut sürümde VALID payı ≥ %95 olunca servis servis ENFORCE (callable'lar → Firestore → Auth → RTDB).

**Kodda yapılanlar (2026-10-31):** iOS App Attest yetkisi `app.json`'a eklendi (yeni native build ile); yayın build'inde
jeton hatası Sentry'ye (`AppCheck/getToken`); geliştirme için isteğe bağlı debug sağlayıcı
(`EXPO_PUBLIC_APPCHECK_DEBUG=1`); durum/karar betiği `npm run appcheck:status` (salt-okunur). Kullanıcıda kalan:
DeviceCheck `.p8` anahtarı, Play Console bağlantısı, yeni yayın build'leri.

### L-1 — Bekleme listesi/beta e-posta varlık sızıntısı (Düşük)
**Yer:** `firestore.rules:80-115` — `waitlist`/`betaTesters` `allow get: if true`, docId = `base64(email)`.
**Sorun:** docId e-postadan türediği için, bir e-postayı bilen biri `get` ile o kişinin listede olup olmadığını doğrulayabilir (varlık oracle'ı). `list` kapalı (iyi), toplu döküm yok.
**Öneri:** Düşük öncelik. İstenirse `get`'i de kapatıp "zaten kayıtlı mı" kontrolünü callable'a taşı.

### L-2 — İmza anahtarı ve `.env` çalışma ağacında (Düşük / hijyen)
**Yer:** Kök dizinde `@smlztrk__seelogd.jks`, `.env`, `.env.local`. **git takibinde değiller** (`.gitignore` kapsıyor — doğrulandı). Ancak dizin zip'lenir/paylaşılırsa sızarlar.
**Öneri:** İmza anahtarını depo dışında (ör. parola yöneticisi / EAS credentials) sakla. `.env`'i yalnızca yerelde tut. Depoyu paylaşırken bu dosyaları dışarıda bırak. (Not: `firestore-debug.log` 2 MB ve `.theme-audit-export.log` de ağaçta ama gitignored.)

### L-3 — Grup kuralları karmaşıklığı (Düşük / Bilgi)
**Yer:** `firestore.rules:1188-1490` (gruplar + film kulübü).
**Sorun:** Çok dallı `update` kuralları; mantıksal bir hata gözden kaçabilir. Şu an güvenli görünüyor ve testlerle destekleniyor (`__tests__/rules/`).
**Öneri:** Mevcut emülatör kural testlerini bu dallar için kapsam olarak koru; değişiklikte parite testleri zorunlu kalsın.

### İncelendi, sorun yok (seçme)
- **Kimliğe bürünme:** `senderId/authorId/userId == request.auth.uid` her yerde zorunlu.
- **Yetki yükseltme:** `entitlements` ve `badges` istemciye kapalı; plan yalnız sunucudan.
- **Sayaç manipülasyonu:** `counterOk` (±1) + `getAfter` çapraz-belge doğrulaması (Ratings, DailyPolls, Top100Hype, turnuva).
- **Enjeksiyon:** `eval`/`new Function`/`dangerouslySetInnerHTML` yok; kurallar şema/tip doğruluyor; functions girdi doğruluyor (aiProxy uzunluk kıskaçları, league kaynak beyaz listesi, OMDb doğrulama).
- **Webhook:** `revenueCatWebhook` POST + `timingSafeEqual` Bearer + olay tekilleştirme (sha256 + transaction).
- **Hesap silme:** taze giriş (`auth_time` < 15 dk) zorunlu; Admin SDK ile tam purge + idempotent yeniden süpürme.
- **Sır yönetimi:** Gemini/OMDb/TMDB(proxy)/RevenueCat/Apple anahtarları `defineSecret` ile Secret Manager'da; istemciye gömülü değil.

### OWASP Mobile Top 10 (2024) eşlemesi
| Kategori | Durum |
|---|---|
| M1 Hatalı kimlik bilgisi kullanımı | TMDB jetonu gömülü (M-1). Diğer sırlar sunucuda. |
| M2 Yetersiz tedarik zinciri güvenliği | Bağımlılıklar güncel (Expo 57 / RN 0.86). `patch-package` kullanımı — yamalar gözden geçirilmeli (bilgi). |
| M3 Güvensiz kimlik doğrulama/yetkilendirme | Güçlü. Google/Apple sunucu doğrulaması, taze-giriş, rol/plan sunucuda. |
| M4 Yetersiz giriş/çıkış doğrulama | İyi; ancak App Check zorunlu değil (H-2). |
| M5 Güvensiz iletişim | HTTPS her yerde; cleartext yok (app.json temiz). |
| M6 Yetersiz gizlilik kontrolleri | `Users` list (H-1), e-posta oracle (L-1). PII private'a taşınmış (iyi). |
| M7 Yetersiz binary korumaları | İmza anahtarı hijyeni (L-2). Kod karıştırma değerlendirilmeli (bilgi). |
| M8 Hatalı güvenlik yapılandırması | Firestore App Check enforcement doğrulanmalı (M-3). |
| M9 Güvensiz veri depolama | Oturum MMKV'de; sırlar SecureStore. `.env`/`.jks` yerel (L-2). |
| M10 Yetersiz kriptografi | Özel kripto yok; platform/Firebase standartlarına dayanıyor. |

---

## 3. Performans — mimari analizi ve darboğazlar (TAHMİN)

> Aşağıdakiler ölçüm değil, mimariden çıkarılan analitik beklentilerdir.

### 3.1 Tek-belge yazma sıcak noktaları (en kritik)
Firestore tek bir belgeye **sürdürülebilir ~1 yazma/sn** (kısa patlamalarda daha fazla, ama çekişme artar) sınırı koyar. Aşağıdaki sayaçlar tüm kullanıcıların aynı belgeye yazdığı noktalardır:

| Sıcak nokta | Yer | 10K eşzamanlıda beklenti (TAHMİN) |
|---|---|---|
| Günün Sorusu sayacı `DailyPolls/{gün}` (a/b) | `rules:1717` | **Ağır çekişme.** Herkes aynı gün aynı belgeye → transaction yeniden denemeleri, yüksek abort oranı, kullanıcıya yavaş/başarısız oy. |
| Top 100 hype `Top100Hype/{mediaKey}.count` | `rules:1773` | Popüler yapımda aynı belgeye akın → aynı çekişme. |
| Popüler başlık puanı `Ratings/{mediaKey}` | `rules:836` | `getAfter` transaction'ı belge üzerinde serileşir; viral başlıkta darboğaz. |
| Turnuva agregası `tournaments/{id}/agg/tallies` | `onTournamentVoteWritten` (`index.js:1967`) | Tüm oylar tek agg belgesine fan-in → tetikleyici kuyruğu + yazma çekişmesi. |

**Öneri (10K hedefi için ön şart):** Bu sayaçları **dağıtık/parçalı sayaç (sharded counter)** desenine geçir (ör. 10 shard → ~10 yazma/sn; okurken shard'lar toplanır). Alternatif: oy olaylarını ayrı belgelere yazıp agregayı zamanlanmış/tetikleyici ile topla (eventual counter).

### 3.2 Yazma amplifikasyonu
- `onUserProfileUpdated` (`index.js:1610`): bir profil düzenlemesi avatar/ad'ı ~15 yüzeye yayıyor (bkz. bellek: profil fan-out). 10K kullanıcı aynı anda profil güncellemez ama kampanya/göç senaryosunda maliyet ve tetikleyici kuyruğu modellenebilir.
- `onDirectMessageCreated` / `onGroupMessageCreated` → Expo Push fan-out. Grup mesajında üye sayısı × push.

### 3.3 Fonksiyon tavanı
`setGlobalOptions({ maxInstances: 10 })` (`index.js:89`) maliyet freni. gen2 eşzamanlılığıyla birlikte callable'ların eşzamanlı yürütme tavanını belirler. 10K eşzamanlı AI/OMDb çağrısı **sıraya girer/kısılır** — bu, kota tasarımıyla tutarlı (kötüye kullanımı sınırlar) ama "10K eşzamanlı AI isteği" senaryosunda yüksek gecikme/zaman aşımı beklenir. Yük testinde bu tavan açıkça modellenmeli (ve testte artırılmamalı — maliyet).

> **Düzeltme (31 Eki, ÖLÇÜLDÜ — canlı yapılandırma, yük değil):** Cloud Functions v2 API'den salt-okunur okumaya göre
> gen2 servislerin hepsi **1 vCPU + eşzamanlılık 80**. Gerçek tavan = instance × 80 → 10 instance ≈ **800 eşzamanlı
> istek / fonksiyon**. Yukarıdaki "tavan throughput'u boğar" tahmini bu yüzden abartılıydı; tavan esas olarak maliyet ve
> upstream kota frenidir. Asıl açık: gen1 `purgeOnAuthUserDeleted` global ayardan etkilenmiyordu (canlı tavan **3000**),
> zamanlanmış toplu işler ise 10'da (eşzamanlı çift koşum mümkün). Uygulanan (T-PERF-2, `functions/capacity.js`):
> ucuz callable'lar 20 · kotalı üçüncü taraf uçları (Gemini, OMDb, RevenueCat, Apple) 10 · tetikleyiciler 10 (gen1 dahil,
> `runWith`) · zamanlanmış işler 1. Bekçi test: `functions/capacity.test.js`. Deploy EDİLMEDİ.
> Fan-out (`onUserProfileUpdated`) doğrulandı: yalnız kimlik alanı değişince çalışıyor, hedef başına yalnız değişen
> alanları yazıyor, 450'lik batch. Açık konu: ad/avatar değişikliğine bekleme süresi yok → sık değiştiren biri her
> seferinde tüm mesaj/yorum geçmişini yeniden yazdırır (karar: ürün).

### 3.4 Okuma ölçeği
Firestore okuma/dinleyici fan-out'u 10K ölçeğinde throughput açısından rahat; asıl kısıt **maliyet** ve yukarıdaki sıcak noktalardır. Kurallardaki `get()` çağrıları (ör. `isPaidPlan()`, `canReadLists()`, `groupMembers()`) her değerlendirmede faturalı okuma üretir → yoğun işlemlerde okuma maliyeti amplifikasyonu (hem performans hem maliyet notu).

### 3.5 RTDB (presence/typing)
10K eşzamanlı = 10K kalıcı bağlantı + heartbeat yazımları. Varsayılan eşzamanlı bağlantı sınırı (100K) altında kalır; dikkat edilecek nokta per-path fan-out ve yazma sıklığıdır. Yük testinde ayrı bir boyut olarak ele alınmalı.

---

## 4. Yük testi PLANI (henüz çalıştırılmadı)

**Altın kural:** Hiçbir test `movieandtv-2832a` (prod) üzerinde çalışmaz. Üçüncü taraf (Firebase ücretli kotalar hariç TMDB/Gemini/OMDb/RevenueCat) limitlerine **hiç dokunulmaz** — upstream'ler saplama (stub) ile kısa devre yapılır.

### 4.1 Ortamlar
- **(A) Firebase Emulator Suite** (`firebase.json`: firestore:8085, auth:9099).
  Amaç: **doğruluk + eşzamanlılık altında kural davranışı** (sıcak nokta çekişmesi, abort oranı, kural reddi). **Gerçek gecikme/throughput DEĞİL** — emülatör tek süreçtir, prod performansını modellemez.
- **(B) Ayrı Blaze staging projesi** (M-2 ile oluşturulacak). Aynı rules + functions deploy; `FUNCTIONS_TEST=1` ile Gemini/OMDb/TMDB/RevenueCat çağrıları sahte/sabit yanıta kısa devre. **Gerçek sayılar buradan gelir.**
- **(C) Prod:** YASAK.

### 4.2 Araçlar
- **k6** — Cloud Functions callable/HTTP uçları için (tek HTTP yüzeyi). Senaryo iskeleti: `load-test/k6-callables.js`.
- **firebase-admin Node koşumu** — Firestore sıcak nokta çekişmesi için (SDK yolu düz HTTP değil). İskelet: `load-test/firestore-hotspot-harness.mjs`.

### 4.3 Kademeler (her senaryo için)
100 → 1.000 → 5.000 → 10.000 sanal kullanıcı (VU). Her kademede: ramp-up (2 dk) → kararlı (5 dk) → ramp-down (1 dk), kullanıcı başına gerçekçi "think time".

Senaryolar:
1. **Callable okuma-ağırlıklı:** `getReferralOverview` + `syncPremiumStatus` (upstream stub'lı).
2. **AI yolu (stub):** `callGemini` — Gemini stub; amaç kota/kimlik/soğuk başlangıç + `maxInstances` davranışı (gerçek Gemini'ye GİTMEZ).
3. **Firestore sıcak nokta:** Aynı `DailyPolls/{gün}` ve `Top100Hype/{mediaKey}` belgesine eşzamanlı oy (harness) → abort/retry oranı.
4. **Mesajlaşma fan-out:** grup mesajı oluşturma → tetikleyici kuyruğu + push stub.
5. **Presence (RTDB):** N eşzamanlı bağlantı + heartbeat.

### 4.4 Ölçülecekler
Gecikme p50/p95/p99, hata oranı, RPS/throughput, fonksiyon instance sayısı + soğuk başlangıç, Firestore okuma/yazma op sayısı, **transaction abort/retry oranı** (sıcak noktalar), RTDB bağlantı/yazma. Kaynak tüketimi: fonksiyon CPU/bellek/süre (Cloud Monitoring), staging Firestore kullanım paneli.

### 4.5 Güvenlik önlemleri (koşum sırasında)
- Sabit RPS tavanları; hata oranı eşiği aşılınca otomatik iptal (`thresholds` + `abortOnFail`).
- Yalnız staging/emülatör hedefi; script prod proje kimliğini görürse **reddeder** (iskelette gömülü guard).
- Tüm upstream'ler stub; gerçek anahtar yok.
- Koşum pencereleri ve bütçe önceden belirlenir.

### 4.6 Ölçülen vs tahmin
- **Şu an:** her şey TAHMİN (§3). Ölçülen değer yok.
- **Onay sonrası:** §4.3 senaryoları (A) ve (B) ortamında koşulur; sonuçlar bu belgeye "5. Ölçülen Sonuçlar" bölümü olarak eklenir; tahminlerle yan yana sunulur.

---

## 5. Ölçülen sonuçlar (Firebase Emulator — 2026-10-31)

**Ortam:** Firebase Emulator Suite (Firestore 127.0.0.1:8085), JDK 21 (Android Studio JBR), firebase-admin 14.5.0, Node 22. Proje: `demo-seelogd` (prod'a DOKUNULMADI). Koşum: `load-test/` harness'inin birebir mantığı.
**Kapsam:** Yalnız §3.1 sıcak nokta bulgusu ölçüldü. `callGemini`/callable senaryosu **çalıştırılMADI** çünkü bu makinede **k6 kurulu değil** (ve anlamlı sayı için staging + upstream stub şart — §4). O senaryo staging'e (B) ertelendi.

> **Metodoloji uyarısı:** Emülatör **tek süreçtir** ve çekişmeyi prod'dan daha katı serileştirir; bu sayılar prod gecikmesi/throughput'u DEĞİL, **tek-belge sıcak noktasının çöküş davranışını** ve çözümün çalıştığını gösterir. Mutlak rakamlar değil, A↔B farkı anlamlıdır.

### Ölçüm 1 — Mevcut desen: tek sayaç belgesine eşzamanlı transaction
Tüm "oy"lar tek `DailyPolls/{gün}` benzeri belgeye `runTransaction` ile (increment). Bağlanılmamış (unbounded) eşzamanlılık:

| Eşzamanlı yazan | Süre | Başarılı | Başarısız | Belgeye işlenen |
|---|---|---|---|---|
| 100 | 21.4 sn | **3** | 97 | 3 / 100 |
| 1.000 | 115.4 sn | **1** | 999 | 1 / 1.000 |
| 30 (sürekli, havuz) | **>5 dk (bitmedi)** | — | — | çekişme transaction yeniden-deneme bütçesini tüketiyor |

**Yorum:** Tek belge, eşzamanlı yazmada çöküyor — %97–%99,9 transaction aborta düşüyor (yeniden deneme bütçesi dolup `permission`/`aborted` ile başarısız). Dahası, ağır çekişme tek-süreçli emülatörün **tamamını** doyurup bağımsız yazmaları bile 60 sn gRPC deadline'ına düşürdü (yatay etki). Bu, §3.1 tahminini **doğruluyor**: `DailyPolls`, `Top100Hype`, popüler `Ratings` 10K ölçeğinde bu belgelerde kilitlenir.

### Ölçüm 2 — Önerilen çözüm: her oy ayrı belgeye (event-append)
Aynı yük, ama her oy kendi belgesine yazılıyor (toplam sonradan tetikleyici/zamanlanmış ile hesaplanır). Havuz: 30 eşzamanlı, 1.000 toplam:

| Desen | Toplam | Eşzamanlı | Süre | Başarılı | throughput | p50 | p95 | p99 |
|---|---|---|---|---|---|---|---|---|
| Ayrı-belge append | 1.000 | 30 | 2.5 sn | **1.000 / 1.000** | ~397/s | 24 ms | 46 ms | 1.698 ms |

**Yorum:** Sıcak nokta ortadan kalkınca aynı emülatör aynı yazma sayısını **%100 başarıyla, ~46 ms p95** ile karşılıyor. Fark (3/100 → 1000/1000) çözümü deneysel olarak doğruluyor.

### Ölçüm 3 — Düzeltme uygulandıktan sonra: gerçek kurallar + istemci SDK'sı (T-PERF-1)
Ölçüm 1-2 Admin SDK ile yapılmıştı. Düzeltme sonrası koşum daha gerçekçi: `@firebase/rules-unit-testing` ile **gerçek
`firestore.rules`** yüklü emülatör, **istemci Firestore SDK'sı**, **her oy ayrı kullanıcı**, hepsi aynı anda. ESKİ =
`castPollVote`'un önceki transaction akışı; YENİ = parçalı toplu yazım (şimdiki servis, ön okumalar dahil).

| Günün Sorusu | N=100 | N=300 | N=1.000 |
|---|---|---|---|
| ESKİ (transaction, tek belge) | 8/100 · 14,8 sn | 9/300 · 16,3 sn | 58/1000 · 22,5 sn |
| **YENİ (10 parça, increment)** | **100/100** · 2,4 sn | **300/300** · 2,9 sn | **1000/1000** · 15,1 sn |

Eski yolun hataları: `aborted`, `failed-precondition` (transaction çekişmesi) ve `permission-denied` (eşzamanlı ilk
yazımlar birbirinin sayacını ezince kural kesin +1'i reddediyor). Her iki yolda da sayaç başarılı oy sayısına **birebir**
eşit (kayıp/çift sayım yok). YENİ'nin 1.000'deki 15 sn duvar süresi tek süreçte 1.000 istemci SDK örneği
başlatmanın maliyeti; anlamlı metrik başarı oranı.

**Turnuva tetikleyicisi** (`onTournamentVoteWritten`): Admin `update` olmayan belgede `code=5` döndürdüğü doğrulandı
(ilk-yazım yolu doğru tetikleniyor); tek `agg/tallies` belgesine **500/500** ve **2.000/2.000** eşzamanlı kör
`update` işlendi, sayaç kesin. Eski transaction yolu çekişmede oyu yalnız loglayıp düşürüyordu (sessiz veri kaybı).

Kural testleri: 343 → **358/358** (yeni: parçalı sayaç 8, Top100 increment 4, Ratings increment 3 — üç eşzamanlılık
testi dahil). Birim: 66/66 (dailyPoll + top100). Functions: 100 geçti / 0 başarısız (39 emülatör testi atlandı).

### Sonuç ve öneri (ölçümle desteklenen)
10.000 eşzamanlı hedefi için **ön şart**: paylaşılan sayaçları (`DailyPolls`, `Top100Hype`, popüler `Ratings`, turnuva `agg`) ya **event-append + toplama** ya da **sharded counter (≥10 shard)** desenine taşı. Mevcut tek-belge sayaç, birkaç yüz eşzamanlı oyda bile kullanıcıya başarısız/çok yavaş yanıt verir.

### Henüz ölçülmeyen (staging B gerektirir)
- Callable throughput + soğuk başlangıç (k6, upstream stub) — §4.3 senaryo 1-2. (Yapılandırma ölçüldü: §3.3 düzeltme
  notu — 1 vCPU, eşzamanlılık 80; gecikme/p95 hâlâ ölçülmedi.)
- Mesaj fan-out tetikleyici kuyruğu, RTDB presence — §4.3 senaryo 4-5.
- Prod-benzeri gerçek gecikme/throughput (emülatör modellemez).

---

## Ekler
- Yük testi iskeletleri: `load-test/` (README + k6 + harness). **Varsayılan hedef emülatör/staging; prod'a karşı çalışmayı reddeder. Henüz çalıştırılmadı.**

# T1.1 — Kod incelemesi (2026-10-25)

> Rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` › T1.1. Aralık: son mağaza build'i `391014b` (1.4.6, 24 Eyl) → `ede86e2`.
> Aralık büyük: 71 commit, 903 dosya, ~200 bin satır değişiklik. Tamamı tek seferde incelenmiyor; **risk sırasıyla alan alan** gidiliyor. Arayüz yenilemelerinin doğruluğunu T3 cihaz turu karşılar.

## Alanlar

| # | Alan | Kapsam | Durum |
|---|---|---|---|
| 1 | Sunucu + kurallar | `functions/` (24 dosya, +5.2k), `firestore.rules` (+386) | ✅ bitti — 9 bulgu |
| 2 | Veri yazma katmanı | `services/userData/*`, `libraryActions`, `accountResetService`, `chatOutbox`, `chatMessagePager`, `friendsService` (~3.7k) | ✅ bitti — 2 bulgu |
| 3 | Ödeme / Premium | `revenueCatService`, `PremiumContext`, `premiumFeatures`, `PremiumScreen`, `devPlanOverride`, `referralService` (~1.2k) | ✅ bitti — 2 bulgu + 1 ürün notu |
| 4 | Giriş ve hesap | `screens/auth/*`, `authEmail`, `accountPrivateService`, `userService.createUserProfile`, Google/Apple/bağlantı servisleri, `accountService.deleteAccount`, `UserProfileContext` (~4k, çoğu arayüz) | ✅ bitti — bulgu yok |
| 5 | Sohbet ve sosyal | `ChatScreen` gönderim/okundu yolları, `groupsService`, `notificationsService`, `chatPush`, `chatReceipts`, presence (~2.9k) | ✅ bitti — 1 bulgu |

Yöntem: `/code-review high` ilkeleri (satır satır okuma, silinen davranışın yerine konup konmadığı, çağıranlara etkisi, sadeleştirme/verim). Bulgular inceleme sırasında doğrulanmadı ("recall" kipi). En önemli bulgu (1.1) kodda ayrıca doğrulandı.

---

## Alan 1 — Sunucu ve kurallar

### 1.1 [Orta] Daha yüksek bir promosyon, gerçek mağaza aboneliğini "promosyon" olarak eziyor — DOĞRULANDI
- **Nerede:** `functions/index.js:153` (`writeEntitlements` → `referral.applyPromoToState`), `functions/revenueCatWebhook.js:142`.
- **Senaryo:** Max promosyon kodu süren biri Premium aylık satın alır. Webhook yazarken promosyon (Max) mağaza planından (Premium) üstün olduğu için durum promosyonla değiştirilir: herkese açık belgede `premiumSource: "promo"`, özelde `productId: null`. `hasActiveStoreSubscription()` artık `false` döner. Sonuç: `claimReferralReward` ve `redeemCode`'daki "mağaza aboneliği var" ve "daha önce satın aldı" kapıları açılır; ödeme yapan kullanıcı davet aylarını üst üste yığabilir veya yalnız hiç satın almamışlara verilen davetli indirimini alabilir. Promosyon bitince saatlik süpürme mağaza durumunu geri yazar.
- **Öneri:** promosyon üstün geldiğinde de mağaza alanlarını (kaynak, ürün, mağaza) ayrı tut; ya da `hasActiveStoreSubscription` için RevenueCat'in ham durumunu ayrı bir alanda sakla.

### 1.2 [Düşük] Premium davet ödülü süren Max promosyonunu Max olarak uzatıyor
- **Nerede:** `functions/index.js:730` (`claimReferralReward`), aynı desen `:639` (`redeemCode`, `higherPromoPlan`).
- **Senaryo:** 360 günlük "Test Max" kodu olan biri bir davet ödülü başlatır: `promoUntil` 30 gün uzar, plan Max kalır. Premium ödülü 30 gün Max'e dönüşür. Tek `promoUntil` alanı iki farklı planı tutamıyor. Ürün kararı: kabul edilebilir mi?

### 1.3 [Orta] OMDb hataları 12–24 saat "bulunamadı" olarak önbelleğe giriyor
- **Nerede:** `functions/index.js:1312` (`getExternalRatings`).
- **Senaryo:** `res.ok` hiç denetlenmiyor; "limit" dışındaki her OMDb hatası (geçersiz anahtar, "Error getting data.", 5xx) `not-found` sayılıp önbelleğe yazılıyor. Anahtar değişiminde veya OMDb'nin kısa kesintisinde o pencerede istenen tüm yapımların IMDb/RT puanları 12 saat (sezonlar 24 saat) görünmez.
- **Öneri:** yalnız `Error: "Movie not found!"` / `"Series or episode not found!"` için önbelleğe al; diğer hatalar `unavailable`.

### 1.4 [Orta] RevenueCat sorgusu düşerse süresi dolan promosyon temizlenmiyor
- **Nerede:** `functions/index.js:742` (`expirePromoGrants`).
- **Senaryo:** RevenueCat 429/5xx dönerse kullanıcı süresi dolmuş promosyonla Premium/Max kalır; sunucu kapıları (AI kotası, geri bildirim kuralı, arkadaşa görünen Premium özellikler) planı vermeye devam eder. Sorgu en eskiden 200 kayıtla sınırlı; sürekli düşen 200+ kullanıcı sonrakilerin sırasını hiç getirmez.
- **Öneri:** RevenueCat düşerse promosyonu yine de kaldır, mevcut mağaza alanlarıyla yaz; ya da başarısızları sorgudan çıkaran bir işaret.

### 1.5 [Düşük, ölçek] Haftalık özet tamamen sıralı, zaman aşımına düşebilir
- **Nerede:** `functions/index.js:2315` (`weeklyReleaseDigest`).
- **Senaryo:** kullanıcılar ve her birinin TMDB sorguları (kullanıcı başına 60'a kadar, sorgu başına 12 sn zaman aşımı) tek tek işleniyor; süre 540 sn ve kaldığı yerden devam yok. Birkaç yüz katılımcıda çalışma ortasında kesilir, listenin sonundakiler o hafta özet almaz; 3000 üstü hiç almaz. T4 yük testinde ölçülecek.

### 1.6 [Düşük] Eski istemci dalı, grup üyesinin başkalarının sayacına keyfî değer yazmasına izin veriyor
- **Nerede:** `firestore.rules:1020` (`groups` update, `unread` dalı).
- **Senaryo:** değiştirilmiş istemciyle bir üye `unread.{başkası}` alanına 999999 yazabilir veya herkesinkini sıfırlayabilir; bu haritayı hâlâ okuyan eski sürümlerde sayaçlar bozulur. Yeni `groupInbox` kuralı doğru (yalnız +1). Eski sürümler emekliye ayrılınca dal kaldırılmalı.

### 1.7 [Düşük] Auth sorgusu düşerse davet kodunun 14 günlük penceresi atlanıyor
- **Nerede:** `functions/index.js:571` (`redeemCode`).
- **Senaryo:** `getAuth().getUser` geçici hata verirse `accountCreatedMs` boş kalır ve pencere denetimi hiç yapılmaz (hata durumunda açık kalıyor); aylık bir hesap davetli indirimi alabilir.
- **Öneri:** hata durumunda reddet (`unavailable`).

### 1.8 [Yüksek, bilinen] Kökteki e-posta ve doğum tarihi hâlâ okunabilir
- **Nerede:** `firestore.rules:226` (`legacyRootAccountWrites()` = `true`), `Users/{uid}` herkese okunur.
- T0.2 raporunda (bölüm 2.4) ayrıntılı. Göç betiği + Aşama 3 bekliyor.

### 1.9 [Temizlik] Davet verisi silme iki yerde
- **Nerede:** `functions/index.js:774` (`cleanupReferralOnUserDeleted`) ve `functions/accountPurge.js:489` (`referral` aşaması) aynı belgeleri siliyor. Birine yeni bir koleksiyon eklenip ötekine eklenmezse artık veri kalır.

### Alan 1'de incelenip sorun bulunmayanlar
- Grup kurucusu silinince varisin `admins`'ten çıkarılması **doğru**: projede kurucu `admins` listesinde tutulmuyor (`utils/groupRoles.js`).
- Webhook transaction'ında okuma-yazma sırası, ödülün tekrar verilmemesi (`rewardedAt`), sandbox/deneme/0 fiyat dışlaması doğru.
- `sendExpoPushes` karışık proje bölmesi, sunucu mesaj push'u (üyelik, engel, sohbette olma kontrolü) doğru. Rozet sayısına grup okunmamışlarının girmemesi bilinçli (`utils/appBadge.js` notu).
- `DailyPolls`, `groupInbox`, `PosterChoices`, `Feedback`, `private/account` kuralları beklenen davranışta; kural testleri 267/267.

---

## Alan 2 — Veri yazma katmanı

### 2.1 [Orta] İlk indirme sırasında onaylanan yazım yerelden kaybolabilir
- **Nerede:** `services/userData/createDomain.js` (`ensureHydrated`).
- **Senaryo:** indirme başlamadan önce kuyrukta bekleyen bir yazım (ör. çevrimdışı oluşturulan not) indirme sürerken buluta yazılıp onaylanırsa kuyruktan düşer. İndirme ise yazımdan önceki bulut hâlini okumuş olabilir. Sonunda harita "bulut + kuyruktakiler + indirme günlüğü" ile kurulur; yazım bunların hiçbirinde yoktur. Not yerelden kaybolur ve alan "doğrulandı" işaretlendiği için bir sonraki zorunlu yeniden indirmeye kadar geri gelmez (bulutta duruyor).
- **Ne zaman olur:** alan doğrulanmamışken (yeni cihaz, sürüm işareti artışı) ve kuyrukta önceki oturumdan bekleyen yazım varken. Dar ama yerel kaynak modeli için önemli.
- **Öneri:** indirme başlarken kuyruktaki işlemleri de günlüğe kopyala (`st.journal = [...outbox.overlayOps(uid, name)]`).

### 2.2 [Düşük] Durdurulmuş senkron işçisi yeni yazımla yeniden çalışıyor
- **Nerede:** `services/userData/syncWorker.js` (`stop` / `schedule`), `services/accountResetService.js`.
- **Senaryo:** Hesabı Sıfırla, silme öncesi işçiyi `stopUserData` ile durduruyor; ama `stop` yalnız zamanlayıcıyı temizliyor. Sıfırlama sürerken arayüzden gelen bir yazım (`apply` → `requestFlush`) işçiyi yeniden planlar ve silinmekte olan buluta belge yazabilir. Sıfırlama sonunda yerel temizlik yapıldığı için etki sınırlı.

### Alan 2'de incelenip sorun bulunmayanlar
- Kuyruk (`outbox.js`): aynı yol için eski işlemin yenisiyle değişmesi, uçuştaki işlemin korunması, ölüye ayırma ve yeniden canlandırma doğru.
- İşçi (`syncWorker.js`): geçici, kalıcı ve yetki hatası sınıflandırması, tek tek yalıtma, zaman aşımında yeniden deneme; işlemler tam belge `set`/`delete` olduğu için tekrar gönderim zararsız.
- `libraryActions.js`: iç içe kilitler (izleme günü → öğe) arasında ters sırada alan yok, kilitlenme riski görülmedi.
- `chatOutbox.js`: kural uyumu (`groupInbox` +1, grup özeti alanları) doğru. `chatMessagePager.js`: sayfa 0 çapası ve imleç mantığı doğru.
- `friendsService.unfriend`: arkadaşlık batch'i önce, sohbet silme ayrı ve hatası arkadaşlığı geri almıyor; bilinçli.

---

## Alan 3 — Ödeme / Premium

### 3.1 [Orta] Apple'da davet indirimi alınamazsa sessizce tam fiyata düşüyor
- **Nerede:** `services/revenueCatService.js` (`purchaseRevenueCatPackage`, `referralHandle.kind === "apple"` dalı).
- **Senaryo:** Ödeme ekranı davetli kullanıcıya "%30 indirimli ilk ay" gösteriyor. `Purchases.getPromotionalOffer` boş dönerse (App Store Connect'te abonelik anahtarı/imza eksik, uygunluk yok) kod uyarmadan **indirimsiz** `purchasePackage`'a geçiyor. Kullanıcı Apple sayfasında tam fiyatı görüp onaylayabilir; uygulamanın vaadiyle ödenen fiyat ayrışır. `getPromotionalOffer` hata fırlatırsa da satın alma tümden "tamamlanamadı" diye düşer.
- **Öneri:** teklif alınamazsa satın almadan önce kullanıcıya söyle ("İndirim şu an uygulanamıyor, tam fiyatla devam?") ya da ekrandaki indirimi gizle. Android bu daldan etkilenmiyor; iOS mağaza tarafı henüz kurulmadığı için bugün canlı bir etkisi yok, ama iOS yayınından önce kapanmalı.

### 3.2 [Düşük] Satın alma sonrası "Premium aktif" mesajı hakkı denetlemiyor
- **Nerede:** `screens/premium/PremiumScreen.js:394` (`buy`).
- **Senaryo:** `purchasePackage` döndüğünde hak (`entitlements.active`) bakılmadan "Seelogd Premium aktif edildi!" gösteriliyor. Eylülde yaşanan entitlement kimliği uyuşmazlığı gibi bir panel hatasında kullanıcı ödeme yapar, "aktif" mesajını görür ama Free kalır. Max alırken de metin "Premium" diyor. Geri yükleme (`restore`) hakkı doğru denetliyor; aynısı satın almaya da uygulanmalı.

### 3.3 [Ürün notu] Free kullanıcı Ocak'ta biten yılın Wrapped'ini göremiyor
- **Nerede:** `utils/premiumFeatures.js:158` (`WRAPPED_YEARS_VISIBLE.free = 1`).
- 13 Ekim kararıyla Free yalnız "bu yıl"ı görüyor (eskiden bu yıl + geçen yıl). Sonuç: 1 Ocak'tan itibaren Free kullanıcının yıl sonu özeti (Wrapped'in en çok paylaşılan anı) kilitli. Hata değil; Ocak'a kadar bilinçli olarak yeniden değerlendirilmesi önerilir (ör. Ocak ayı boyunca geçen yıl da açık).

### Alan 3'te incelenip sorun bulunmayanlar
- Plan simülatörü release'de tamamen etkisiz (`isDevPlanSimulatorAvailable` → `__DEV__`); analitiğe gerçek plan gidiyor.
- Mağaza ↔ sunucu plan uzlaştırması promosyonda atlanıyor (bilinçli). Not: bulgu 1.1 ile birlikte, ezilmiş bir mağaza aboneliği de bu yüzden uzlaştırılmaz; 1.1 düzelince kendiliğinden kapanır.
- Android davet teklifi seçimi (`subscriptionOptions` içinde teklif kimliği) ve "hangi teklif daha çok kazandırır" seçimi doğru.

---

## Alan 4 — Giriş ve hesap

Bulgu yok. İncelenenler:
- Kayıt: Auth hesabı → profil + kullanıcı adı transaction'ı → doğrulama e-postası → çıkış. Profil düşerse yetim Auth hesabı siliniyor. **E-posta ve doğum tarihi yeni kayıtta yalnız `private/account`a yazılıyor** (bulgu 1.8 yalnız eski hesapları etkiliyor).
- Tembel göç (`migrateRootAccountFields`): kopya önce, kökten silme sonra; çelişkide silmiyor. Kural sırasıyla uyumlu.
- Yaş kapısı, gizli belge okunana kadar bekliyor (18 altı kısıtı açılışta kalkmıyor).
- Hesap silme: taze kimlik → sunucu aşamaları → yerel temizlik → `deleteUser`; `requires-recent-login`'de yeniden kimlik doğrulayıp tekrar deniyor. Kullanıcı o yeniden doğrulamayı iptal ederse veri silinmiş ama Auth hesabı kalmış olur; tekrar girişte profil tamamlama ekranına düşer (kabul edilebilir).
- `authEmail.js`: kullanıcı yoksa sıfırlama e-postası hatası yutuluyor (hesap varlığı sızdırılmıyor), dil kodu doğru.

---

## Alan 5 — Sohbet ve sosyal

### 5.1 [Düşük] Grup bilgisi yüklenmeden gönderilen mesaj okunmamış sayaçlarını artırmıyor
- **Nerede:** `screens/chat/ChatScreen.js:1300` (`queueGroupUnreadIncrements(batch, chatId, groupData?.members, …)`).
- **Senaryo:** grup sohbeti açılır açılmaz (grup dinleyicisi henüz dönmeden ya da hata verdiyse) gönderilen mesajda `groupData` boş; diğer üyelerin `groupInbox` sayacı artmıyor. Gönder düğmesi yalnız boş metinde kapalı. Mesaj ve sunucu push'u gidiyor, ama Mesajlar listesindeki okunmamış rozeti eksik kalıyor.
- **Öneri:** grup belgesi gelene kadar gönderimi beklet ya da üyeleri gönderim anında oku (`postShareToChat` gibi).

### Alan 5'te incelenip sorun bulunmayanlar
- Mesaj + yan etkiler tek atomik batch (gelen kutusu, sayaç, grup özeti); düz mesaja sunucu push işareti, davetlere bildirim belgesi.
- Okundu işareti: yalnız sohbet görünürken ve yalnız ileri giden tek yazım; tikler karşı tarafın `readAt`'inden türetiliyor.
- Tümünü okundu işaretle: 400'lük parçalar, sayaç son parçada sıfırlanıyor.
- Presence: onDisconnect sırası ve bağlantı kimlikli kayıt modeli (deploy edilmiş, ayrı notta belgeli).

---

## Özet ve öncelik

| Öncelik | Bulgu | Düzeltme nerede |
|---|---|---|
| 1 | 1.1 Promosyon mağaza aboneliğini eziyor (doğrulandı) | functions → deploy |
| 2 | 2.1 İlk indirmede onaylanan yazım yerelden kayboluyor | istemci (OTA) |
| 3 | 1.3 OMDb hataları önbelleğe giriyor | functions → deploy |
| 4 | 1.4 Süresi dolan promosyon temizlenmiyor | functions → deploy |
| 5 | 3.1 Apple davet indirimi sessizce tam fiyata düşüyor | istemci; iOS yayınından önce |
| 6 | 1.7 Davet penceresi hata durumunda açık kalıyor | functions → deploy |
| 7 | 5.1 Grup bilgisi yüklenmeden mesaj sayacı artmıyor | istemci (OTA) |
| 8 | 3.2 Satın alma mesajı hakkı denetlemiyor | istemci (OTA) |
| 9 | 1.6 Eski grup sayacı dalı | kurallar; eski sürümler emekliye ayrılınca |
| 10 | 1.2 Premium ödülü Max'i uzatıyor | **ürün kararı** |
| — | 1.5 Haftalık özet ölçeği | T4'te ölçülecek |
| — | 1.8 Kök e-posta/doğum tarihi | T0.2 gizlilik göçü |
| — | 1.9, 2.2 temizlik | düşük öncelik |
| — | 3.3 Wrapped Ocak notu | **ürün kararı** |

Kritik bulgu yok. Düzeltmeler kullanıcı kararıyla toplu yapılacak; fonksiyon tarafındakiler tek deploy'da gider (T1.2'deki bağımlılık güncellemesiyle birlikte olabilir).

## Düzeltme durumu

Hiçbir bulgu henüz düzeltilmedi.

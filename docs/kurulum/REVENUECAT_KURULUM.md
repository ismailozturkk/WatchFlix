# RevenueCat kurulum ve yayın kontrol listesi

Uygulama tarafı `react-native-purchases` ve `react-native-purchases-ui` 10.4.4
ile entegredir. Firebase UID, RevenueCat App User ID olarak kullanılır.

## 1. Ortam anahtarları

Geliştirme `.env` dosyası:

```text
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID="com.smlztrk.seelogd Pro"
```

Production/EAS ortamı:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID="com.smlztrk.seelogd Pro"
```

14 Ağustos 2026 itibarıyla Android ve iOS public SDK anahtarları ile entitlement
EAS production ortamında tanımlıdır. Anahtar değerleri kaynak koda yazılmaz;
ortamda bulunup bulunmadıkları `eas env:list production` ile doğrulanır.

Kod `test_...` anahtarını yalnız `__DEV__` build'lerde seçer. Release build'de
platforma ait `goog_...` veya `appl_...` anahtarı zorunludur. Test Store
anahtarıyla mağazaya uygulama gönderilmemelidir. Public SDK anahtarları istemci
içindir; RevenueCat secret API key'i hiçbir zaman `EXPO_PUBLIC_` değişkenine
yazılmaz.

## 2. RevenueCat ürün kataloğu

Ürün kimlikleri 19 Eylül 2026'da yeniden kuruldu; Play, App Store ve Test
Store'da AYNI kimlikler kullanılır. Mağaza kimliği bir kez oluşturulunca
değişmez ve silinse de yeniden kullanılamaz; plan kimlikten okunduğu için adı
planı söyler:

| Gösterim           | Product ID        | Play base plan | Süre  | Uygulama seviyesi |
| ------------------ | ----------------- | -------------- | ----- | ----------------- |
| Premium            | `premium_monthly` | `p1m`          | 1 ay  | Premium           |
| Premium Yıllık     | `premium_yearly`  | `p1y-v2`       | 1 yıl | Premium           |
| Premium Max        | `max_monthly`     | `p1m`          | 1 ay  | Premium Max       |
| Premium Max Yıllık | `max_yearly`      | `p1y-v2`       | 1 yıl | Premium Max       |

**`p1y-v2` neden:** 19 Eylül 2026'da iki yıllık ürünün ilk base plan'ı (`p1y`)
Play'de yanlışlıkla **aylık** kurulmuştu (yıllık fiyat her ay kesilecekti).
Aktif base plan'ın süresi değişmiyor ve kimlik yeniden kullanılamıyor; `p1y`
deaktif edildi, yerine 1 yıllık `p1y-v2` açıldı. Kod base plan kimliğine
bakmaz (`baseProductIdentifier`); süreyi mağazadan okur (`getPackagePeriodKey`,
RevenueCat paket türünden ÖNCE) — yanlış süre artık ekranda görünür.

Play'de her ürün ayrı bir abonelik, içinde tek base plan; RevenueCat Play
kimliğini `premium_monthly:p1m` / `max_yearly:p1y-v2` olarak verir, kod `:` sonrasını atar
(`baseProductIdentifier`).

Tek entitlement oluştur:

```text
com.smlztrk.seelogd Pro
```

Dört ürünün tamamını bu entitlement'a bağla. Uygulama aktif entitlement'ın
`productIdentifier` alanını okuyarak `max_*` ürünlerini Premium Max
(teknik planda `unlimited`), `premium_*` ürünlerini Premium sayar
(`utils/premium.js`, sunucu aynası `functions/revenueCatWebhook.js`).

**Eski kimlikler:** `monthly_2`, `yearly` (Premium), `monthly`,
`unlimited_yearly` (Max) Eylül 2026'ya kadar yalnız Test Store'da vardı, gerçek
satış olmadı. Kod test abonelikleri bitene kadar bunları da tanır; sonra iki
yerdeki `LEGACY`/eski kimlik listeleri silinir.

`default` offering (Current) paketleri — paket kimlikleri eski düzenden
kaldı; kod paket kimliğine ve RevenueCat'in `offering.monthly/annual`
kısayollarına BAKMAZ, planı ürün kimliğinden, süreyi mağazadan okur:

| Paket (panel adı)                   | Play ürünü              |
| ----------------------------------- | ----------------------- |
| Premium Monthly (`custom_monthly_2`) | `premium_monthly:p1m`  |
| Premium Yearly (`$rc_annual`)       | `premium_yearly:p1y-v2` |
| Unlimited Monthly (`$rc_monthly`)   | `max_monthly:p1m`       |
| Unlimited Yearly (`unlimited_yearly`) | `max_yearly:p1y-v2`   |

Offering'i yeni ürünlere ancak yeni kimlikleri tanıyan uygulama sürümü ve
webhook yayındayken çevir: eski sürüm `max_monthly`'yi tanımaz ve Max alana
Premium verir.

RevenueCat Paywalls editöründe paywall KURULMAZ: tek ödeme ekranı uygulamanın
kendi `PremiumScreen`'idir ve metnini `utils/premiumFeatures.js`'ten üretir.
Eskiden PremiumScreen'deki “Alternatif Güvenli Ödeme Ekranı” butonu
RevenueCatUI paywall'ını açıyordu; 18 Eylül 2026'da kaldırıldı. Panelde paywall
yayında değildi (RevenueCat'in özelliksiz varsayılan ekranı görünüyordu), buton
paketler yüklenemeyince zaten devre dışıydı ve panelde ikinci bir vaat metni
tutmak P0.2'deki ayrışmayı geri getirirdi. RevenueCat Paywalls/A-B testi
ileride istenirse metin registry'den elle aktarılır ve Android'de ürün
değişiminin tek abonelikle kaldığı ayrıca test edilir.

## 3. Gerçek mağazalar

- Android uygulaması/package adı: `com.smlztrk.seelogd`.
- iOS bundle ID, App Store Connect kaydıyla birebir aynı olmalı.
- Google Play Console ve App Store Connect'te aynı ürün kimliklerini oluştur.
- Ürünleri RevenueCat'e import edip Test Store ürünleriyle aynı offering/package
  düzenine bağla.

Lansman fiyatları (19 Eylül 2026 kararı; önceki 22 Temmuz tablosu ₺79,99 /
$3.99 tabanlıydı):

| Ürün                                |    Türkiye | Global (ABD taban) |
| ----------------------------------- | ---------: | -----------------: |
| Premium aylık (`premium_monthly`)   |     ₺59,99 |              $1.99 |
| Premium yıllık (`premium_yearly`)   |    ₺449,99 |             $14.99 |
| Premium Max aylık (`max_monthly`)   |    ₺149,99 |              $4.99 |
| Premium Max yıllık (`max_yearly`)   |  ₺1.099,99 |             $34.99 |

Max, Premium'un 2,5 katı: TR'de ₺119,99'da (2 kat) net gelir ~₺85 kalırken
aylık 900 mesaj kotasını uzun sohbetlerle dolduran Max kullanıcısının Gemini
maliyeti ~₺88'e çıkıyordu (mesaj başı ölçülen ~$0,0007, yoğun ~$0,002; kur
48,8). Mağazaya fiyatı USD taban + Türkiye elle girilerek tanımla.

Yıllık planlar 12 aylık ödemeye göre yaklaşık `%37–42` avantaj sağlar. Fiyatları Google Play Console ve App Store Connect'te bu şekilde
tanımla; sonra ürünleri RevenueCat'e yeniden içe aktar/senkronize et. Uygulama
fiyatı sabitlemez, mağazadan gelen yerelleştirilmiş `priceString` değerini
gösterir. İndirim oranı ve üzeri çizili referans fiyat da aynı plandaki gerçek
aylık ve yıllık mağaza fiyatları karşılaştırılarak dinamik hesaplanır; aylık
pakette sahte indirim gösterilmez.

- App Store/Play server notification entegrasyonlarını RevenueCat panelinden
  tamamla.

## 4. Customer Center

RevenueCat > Customer Center alanında merkezi yayınla. Aktif aboneler için
“Aboneliği yönet” butonu Customer Center'ı açar. Restore, plan değiştirme,
iptal/geri bildirim ve mağaza abonelik yönetimi burada ele alınır. Customer
Center henüz yayınlanmamışsa uygulama `managementURL`/mağaza abonelik ekranına
geri düşer.

## 5. Firebase webhook

Secret'leri tanımla ve deploy et:

```powershell
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
firebase functions:secrets:set REVENUECAT_SECRET_API_KEY
firebase deploy --only functions:revenueCatWebhook,functions:syncPremiumStatus,functions:dailyStreamingAvailability
firebase deploy --only firestore:rules
```

RevenueCat > Integrations > Webhooks alanında function URL'sini ekle.
Authorization header değeri, `REVENUECAT_WEBHOOK_AUTH` secret'ıyla aynı olmalı.
`REVENUECAT_SECRET_API_KEY` için RevenueCat secret v1 API key kullanılır.

Webhook aboneliği RevenueCat'ten yeniden okur ve iki belgeye yazar:

- `Users/{firebaseUid}.entitlements` — herkese açık profil belgesi, yalnız
  plan: `premium`, `premiumUnlimited`, `premiumPlan`. AI kotası ve arkadaş
  profilindeki kimlik rozeti bunu okur.
- `Users/{firebaseUid}/private/entitlements` — yalnız sahibi okur: ürün,
  mağaza, bitiş tarihi. (Eskiden bu ayrıntılar herkese açık belgedeydi; ilk
  yazımda oradan silinir.)

İki alanı da istemci yazamaz (`firestore.rules`); `badges` (kurucu rozeti)
de aynı şekilde sunucuya aittir. Silinmiş hesaba gecikmeli gelen olay
sahipsiz `Users` belgesi yaratmaz.

`syncPremiumStatus` (callable) aynı okumayı istemcinin isteğiyle yapar:
`PremiumContext`, RevenueCat planı ile sunucu planı ayrıştığında çağırır
(satın alma webhook'tan önce geldi, webhook kaçtı, iade oldu). Sunucu
istemcinin söylediğine güvenmez, RevenueCat'e kendisi sorar; kullanıcı başına
15 saniyede bir. Böylece webhook paneli henüz kurulmamışken bile satın alan
kullanıcı AI kotasında yeni planını görür.

Free kullanıcıda AI kotası 3/gün ve 30/ay, Premium'da 20/gün ve 300/ay,
Premium Max'te 50/gün ve 900/aydır.

## 6. Uygulama akışı

- SDK, oturum açmış Firebase kullanıcısının UID'siyle bir kez configure edilir.
- Kullanıcı değişirse `Purchases.logIn(uid)`, çıkışta `Purchases.logOut()` çağrılır.
- `getCustomerInfo()` ve `getOfferings()` birlikte yüklenir.
- CustomerInfo listener satın alma/restore/yenileme değişikliklerini anında
  context'e taşır.
- Satın alma yalnız `PremiumScreen` üzerinden, manuel package satın alma ile
  yapılır (RevenueCatUI yalnız Customer Center için kullanılır).
- **Android plan değişimi:** aktif bir Play aboneliği varken başka ürün
  alınırsa satın alma `productChangeInfo` ile ÜRÜN DEĞİŞİMİ olarak gönderilir
  (`utils/premium.js` → `getStoreProductChange`). Aksi halde Google Play
  ikinci, bağımsız bir abonelik açar ve kullanıcı iki kez ödeme yapar. Üst
  plana / yıllığa geçiş anında olur (kalan süre orantılı iade), alt plana /
  aylığa geçiş dönem sonunda. iOS'ta dört ürün AYNI abonelik grubunda
  olmalı; o zaman değişimi App Store kendisi yönetir.
- Kullanıcının iptali hemen erişimi kapatmaz; entitlement aktif olduğu sürece
  erişim devam eder.
- **Aynı mağaza hesabı, birden çok Seelogd hesabı:** Project settings →
  "Transferring purchases seen on multiple App User IDs" = **Transfer to new
  App User ID** (19 Eylül 2026 kararı). Abonelik o cihazda en son giriş yapan
  hesaba geçer; önceki hesap Free'ye düşer (webhook TRANSFER olayında iki
  `Users` belgesini de yazar). Neden: hesabını silip yeniden açan ya da
  Google/e-posta girişini karıştırıp ikinci hesap açan kullanıcı ödediği
  aboneliği kaybetmesin; "Keep with original" seçilirse ikinci hesap ne
  alabilir ne geri yükleyebilir (Play "zaten sahipsiniz" der). Suistimal sınırlı:
  aynı anda tek hesap aktif, aynı mağaza hesabı gerekir. Cihaz testinde A
  hesabıyla alıp B'ye geçince A'nın Free görünmesi bu yüzden BEKLENEN davranış.
- **Etkin plan** RevenueCat planı ile sunucu planının yükseğidir. RevenueCat
  cevabı beklenirken son bilinen plan (`services/premiumState.js`, diskte)
  kullanılır; premium kullanıcı açılışta bir anlığına kilit ya da varsayılan
  tema görmez.

## 6.1 Premium yetkileri (kapılar)

Tek kaynak `utils/premiumFeatures.js`: her özelliğin plan başına limiti VE
ödeme ekranında görünen metni oradadır. Ödeme ekranındaki karşılaştırma,
Ayarlar kartı ve limit uyarıları bu kayıttan üretilir — kaydı olmayan bir
şey satılamaz, kayıttaki her şeyin bir kapısı vardır.

| Özellik | Free | Premium | Max | Kapı |
| --- | --- | --- | --- | --- |
| CineMatch AI | 3/gün · 30/ay | 20 · 300 | 50 · 900 | Sunucu (`callGemini`) |
| Kimlik rozeti (arkadaş profilinde de) | — | Epik | Efsanevi | Sunucu alanı |
| Arkadaş (istek gönderme) | 2 | 150 | Sınırsız | `FriendsContext.sendRequest` |
| Sohbet grubu kurma | 1 | 10 | Sınırsız | `CreateGroupScreen` |
| Özel liste (dört hazır liste her planda) | 1 | 25 | Sınırsız | `ListsViewScreen`, `CreateListModal`, CineSwipe |
| Ortak liste kurma | 2 | 10 | Sınırsız | `CreateSharedListModal`, CineSwipe |
| Not | 5 | 50 | Sınırsız | `ProfileNotesContext.saveNote`, `NotesScreen`, `NotesCard` |
| Yapılacaklar listesi | 5 | 50 | Sınırsız | `ProfileNotesContext.saveNote`, `NotesScreen`, `NotesCard` |
| Film notu | 20 | 200 | Sınırsız | `MediaNotesContext`, `MovieDetail` |
| Dizi notu | 20 | 200 | Sınırsız | `MediaNotesContext`, `TvShowsDetails` |
| Film hatırlatması | 10 | 50 | Sınırsız | `useReminderGate` (`Reminder`, `MovieDetail`, `MediaQuickActionsSheet`) |
| Dizi hatırlatması | 20 | 100 | Sınırsız | `useReminderGate` (`Reminder`) |
| Sahne tahmin oyunu | — | 20/gün | Sınırsız | `ProfileGamesModule`, oyun ekranları, `useSceneGame` |
| CineSwipe oda kurma | — | 10/gün | Sınırsız | `CineSwipeWidget`, `CineSwipeScreen` |
| CineSwipe tek başına | — | 300/gün | Sınırsız | `CineSwipeWidget`, `CineSwipeScreen` |
| Turnuvada oy kullanma | Yalnız izleyici | ✓ | ✓ | `TournamentScreen`, `MatchCard` |
| Özel tema oluşturma | 9 hazır tema (3 aile × açık·orta·koyu) | ✓ | ✓ | `SettingsTheme`, `ThemeContext` |
| Yazı tipi kataloğu | 7 font | 56 font | 56 font | `FontSettingsSection`, `typographySettings` |
| Uygulama simgesi | Varsayılan | ✓ | ✓ | `AppIconSection` |
| Kar animasyonu | — | ✓ | ✓ | `AppSettingsContext`, `PersonalizationScreen`, `DecorScopesScreen` |
| Ambiyans arka planı | — | ✓ | ✓ | `AppSettingsContext`, `PersonalizationScreen`, `DecorScopesScreen` |
| Özel afiş ve arka planlar (25 Eki) | Varsayılan görseller | ✓ | ✓ | `ImageGalleryModal` (seçici), `PosterChoicesProvider` (çizim + arkadaş görünürlüğü sahibin `entitlements` planına bağlı) |
| İkon arka planı | — | ✓ | ✓ | `AppSettingsContext`, `PersonalizationScreen`, `DecorScopesScreen` |
| Pet / Dost | — | ✓ | ✓ | `PetContext`, `PetSettingsSection` |
| Platform bildirimi | 10 başlık | 100 | 100 | Sunucu (`dailyStreamingAvailability`) |
| Wrapped arşivi | Yalnız bu yıl | Son 5 yıl | Tüm yıllar | `WrappedScreen`, `HubWrappedModule` (`canViewWrappedYear`) |
| Hata bildirimi (uygulama içi) | Yalnız e-posta | ✓ | ✓ | `FeedbackScreen`, `FeedbackSettingsGroup`; sunucu: `firestore.rules` → `Feedback` |
| Özellik isteği (uygulama içi) | Yalnız e-posta | Yalnız e-posta | ✓ | `FeedbackScreen`, `FeedbackSettingsGroup`; sunucu: `firestore.rules` → `Feedback` |

Free planı 10 Ekim 2026 kararıdır (arkadaş 2, grup 1, AI 3/gün · 30/ay, bir
özel liste, Hub'da oyun ve CineSwipe yok, turnuvada yalnız izleyici, kozmetik
dört özellik kapalı, 10 film + 20 dizi hatırlatması, 5 not + 5 yapılacak,
20 film + 20 dizi notu). Ambiyans arka planı 15 Ekim'de beşinci kapalı kozmetik
olarak eklendi (kar ve ikon arka planıyla aynı kural). Üç dekor efektinin
(kar / ambiyans / ikon arka planı) her birinin kayıtta bir erişim girdisi olmak
zorundadır; `__tests__/decorScopes.test.js` "Premium kapısı bekçisi" bunu ve
ham tercih bayrağının kapıyı atlayarak okunmadığını doğrular.
Premium ve Max değerleri bu kararın PARÇASI DEĞİL,
önerilen varsayılandır (özellikle not, hatırlatma ve film/dizi notu): satış
verisi geldikçe `utils/premiumFeatures.js`'ten değişir.

**Geri bildirim kutusu** (16 Ekim 2026): Ayarlar > Destek ve geri bildirim. Hata bildirimi Premium ve üstünde, özellik isteği yalnız Premium Max'te açılır; Free'de e-posta desteği (Hakkında) aynen kalır. Kayıtlar `Feedback` koleksiyonuna yazılır; plan kapısı İSTEMCİDE (`bug_report` / `feature_request`) ve SUNUCUDA (`firestore.rules`, `Users/{uid}.entitlements`) birlikte zorlanır — kural dağıtılmadan form `permission-denied` verir (`firebase deploy --only firestore:rules`). Koleksiyon create-only + "kendi kayıtlarını oku"dur; kayıtları Firebase konsolunda `Feedback` altında görür, durumu `status` (`open` → `reviewing` / `planned` / `done` / `declined`) ve isteğe bağlı `reply` (kullanıcıya görünen yanıt) alanlarını konsoldan değiştirirsin; kullanıcı bunları "Gönderdiklerim" listesinde görür. Alan listesi/sınırlar `utils/feedbackValidation.js` ile kuralda aynı olmak zorundadır (`__tests__/feedbackRulesParity.test.js`).

**Wrapped arşivi** (13 Ekim 2026 kararı) bir *yıl penceresidir*: Free yalnız bu
yılı, Premium bu yıl dahil son 5 yılı görür, Max'te sınır yoktur. Registry'de
`wrapped_archive` sayılı özellik + `window: true` olarak durur (limitler 1 / 5 /
sınırsız, `WRAPPED_YEARS_VISIBLE`); kapı `canViewWrappedYear(yıl, plan)` yılın
bu yıldan kaç yıl geride olduğunu sorar, kilitli satırın hangi planı istediğini
`requiredPlanForWrappedYear` söyler. "5 yıl" **bu yıl dahil** okundu (bu yıl + 4);
"bu yıl + 5" demek istenirse yalnız `WRAPPED_YEARS_VISIBLE.premium` 6 olur.
Pencere her 1 Ocak'ta kayar: Free'nin geçen yıl Wrapped'ı o gün kilitlenir.

Kapalı özellik (Free'de "—") registry'de limiti **0** olan sayılı özelliktir;
`isLockedFor` ile sorulur ve ekranlar "limit doldu" yerine "Premium özelliği"
konuşur (`upsell.lockedTitle` + `upsell.message`).

**Kullanım ve haklar ekranı** (Ayarlar → Kullanım ve haklar,
`PremiumUsageScreen`): her satır registry'den ve kapıların saydığı kaynaktan
(`hooks/usePremiumUsage.js`) üretilir; ekran kendi başına limit tanımlamaz.
Satırları `utils/premiumUsageModel.js` kurar (`__tests__/premiumUsageModel.test.js`).
AI sayacı `AiUsage/{uid}` belgesinden (UTC gün/ay), günlük haklar cihaz
sayacından, kalan her şey canlı context verisinden okunur.

Kurallar:

- **İşi başlatan sayılır:** isteği kabul etmek, gruba / ortak listeye
  katılmak, mesaj almak hiçbir kapıdan geçmez. Premium kullanıcı Free
  arkadaşlarıyla engelsiz etkileşir. İstisna: CineSwipe ve oyunlar Free'de
  tümüyle kapalıdır, bir arkadaşın odasına katılmak da dahil (Hub kartı Free'de
  yükseltme sayfasını açar, ekrana gitmez).
- **Hatırlatma sayacı yalnız süren kayıtları sayar** (`utils/reminderCounts.js`):
  çıkışı geçmiş film ve tüm bölümleri yayınlanmış dizi hak harcamaz; bir
  dizinin tüm bölümleri tek hak sayılır.
- **Film/dizi notu** yapım başına tek not; limit, not yazılmış farklı yapım
  sayısıdır. Mevcut notu düzenlemek ve silmek serbest.
- **Abonelik bitince veri silinmez:** fazla listeler ve arkadaşlar kalır,
  yalnız yenisi engellenir. Özel tema ve premium font seçimi saklanır ama
  varsayılan tema / sistem fontu çizilir; abonelik yenilenince kendiliğinden
  geri gelir. Aynısı kar animasyonu, ambiyans, ikon arka planı ve pet için de geçerli:
  tercih saklanır, Free'de kapalı çizilir. Uygulama simgesinde varsayılana
  dönmek her zaman serbesttir.
- **Maliyetli ve başkalarına görünen özellikler sunucuda** (AI, platform
  bildirimi, rozet). Kozmetik ve sayı limitleri istemcide; günlük haklar
  cihazda sayılır (`services/premiumUsage.js`). Uygulama verisini silen
  bugünkü hakkını sıfırlayabilir — bu özelliklerin sunucu maliyeti düşük
  olduğu için bilinçli tercih.
- Limitler değişecekse: `utils/premiumFeatures.js` + sunucu aynası
  (`functions/aiQuota.js`, `functions/planCapabilities.js`) birlikte;
  `__tests__/premiumFeatures.test.js` ayrışmayı yakalar. Ardından
  `store/play/*/full-description.txt` ve `website/terms.html`'i güncelle
  (RevenueCat panelinde paywall yok, bkz. §2).
- Analytics: kapıya takılma `premium_gate_hit` (`feature`, `plan`), ödeme
  ekranı görüntüleme `paywall_view` (`source` = kapının özellik kimliği).

## 7. Test matrisi

- Expo Go yerine yeni bir development build/APK kullan.
- Test Store'da başarı, kullanıcı iptali ve hata sonuçlarını ayrı dene.
- `premium_monthly`, `premium_yearly`, `max_monthly` ve `max_yearly` ürünlerinin doğru planı
  açtığını doğrula.
- Purchase, restore, Premium -> Premium Max geçişi, expiration ve hesap değiştirme
  akışlarını test et.
- Android'de Premium → Premium Max geçişinden sonra Play Store abonelik
  listesinde TEK abonelik kaldığını doğrula (çift abonelik açılmamalı).
- Satın almadan hemen sonra AI sohbetinde kotanın yeni plana geçtiğini
  doğrula (`syncPremiumStatus`; webhook beklenmez).
- Her kapı için: Free'de limitte uyarı + "Planları gör" → ödeme ekranı
  özelliği gösterir; Premium'da limit yükselir; Max'te sınırsız.
- Abonelik bitince: özel tema/font varsayılana döner, yeniden abone olunca
  geri gelir; mevcut listeler/arkadaşlar silinmez.
- Production öncesinde Test Store anahtarını kaldır; gerçek platform anahtarları
  ve mağaza sandbox/internal testing ile son testleri yap.

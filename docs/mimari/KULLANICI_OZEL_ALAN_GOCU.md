# Kullanıcı özel alanlarının gizli belgeye göçü

> Durum (16 Eki 2026): kod, kural ve testler hazır; **commit edilmedi.**
> Adım 1 (kurallar) 16 Eki'de deploy EDİLDİ (`legacyRootAccountWrites()` = `true`,
> proje `movieandtv-2832a`). İstemci/OTA, toplu göç, Aşama 3 ve web hâlâ bekliyor.
> Yayın sırası ve kararlar en altta.

## 1. Sorun

`firestore.rules` → `match /Users/{uid}` içinde `allow read: if isSignedIn();`.
Firestore'da alan bazlı okuma kısıtı yoktur: belge okunabiliyorsa **tüm alanlar**
okunabilir. Arayüz göstermese de, giriş yapmış herkes başkasının kök belgesini
API ile okuyabilir (`searchUsersByUsername` zaten belgenin tamamını döndürüyor).

## 2. Envanter — hangi özel alan nerede?

| Alan | Eski yer | Şimdi | Başkasının belgesinden okuyan var mı? |
|---|---|---|---|
| Expo push jetonları | kök | `private/push` (B3, 8 Ağu 2026) | Hayır; sunucu (Admin SDK) okur |
| Abonelik ayrıntısı (ürün, mağaza, bitiş) | kök | `private/entitlements` (yalnız sunucu yazar) | Hayır |
| **`email`** | **kök** | **`private/account`** | **Hayır** — hiçbir istemci/sunucu yolu okumuyor (yalnız yazılıyordu); arayüz `auth.currentUser.email` kullanır |
| **`birthDate`** | **kök** | **`private/account`** | **Hayır** — yalnız sahibi okur (`UserProfileContext` → yaş kapısı, `EditProfileScreen`); `functions/` hiç okumaz |
| `entitlements` (yalnız **plan**) | kök | kök (bilerek) | Evet — kamu bilgisi, rozet/ekranlar için |
| `notificationSettings` | kök | kök (bilerek) | Sunucu okur; tercih bayrakları, hassas değil |

Başkasının kök belgesinden `email`/`birthDate` okuyan yol olmadığı için göç
**görünür bir özelliği bozmaz**; yalnız yazma ve sahibinin okuma yolu taşındı.

Kontrol edilen yerler: `services/userService.js`, `context/UserProfileContext.js`,
`services/friendsService.js` / `context/FriendsContext.js` (`getUserProfile` yalnız
ad/avatar alır), `services/pushNotificationsService.js`, `services/accountService.js`
(hesap silme `private` alt koleksiyonunu zaten temizliyor → `account` da gider),
`functions/index.js` (`onUserProfileUpdated` yalnız ad/kullanıcı adı/avatar değişimine
tepki verir; alan silmek fan-out tetiklemez), auth servisleri (kökten yalnız `username` okur).

## 3. Tasarım

`Users/{uid}/private/account` = `{ email?, birthDate?, updatedAt }` — yalnız sahibi
okur/yazar. Kural (`firestore.rules`):

- **Şekil:** yalnız bu üç anahtar; `email` string ≤ 320; `birthDate` string, 10 karakter.
- **Tarih bir kez yazılır** (kökteki `birthDateKept` kuralının aynısı): yazıldıktan
  sonra değiştirilemez, silinemez. Kökte zaten bir tarih varsa gizli kopya onunla
  çelişemez — iki kopya arasında "küçük olanı seçme" yolu yok.
- **Kökten silme (göç):** `birthDateKept(uid)` artık kökteki tarihin silinmesine
  yalnız gizli kopya **aynı tarihi** taşıyorsa izin verir. Kopya yokken silmek
  18 altı kaydını yok ederdi.
- **`legacyRootAccountWrites()` anahtarı** (şimdi `true`): eski istemcilerin kök
  belgeye e-posta/tarih/jeton yazmasına izin verir. `false` yapılınca (Aşama 3)
  kökte bu alanlar eklenemez/değiştirilemez; **silmek hep serbest**.

İstemci:

- **Yazma:** `createUserProfile` kök + `private/account`'u **aynı transaction'da** yazar;
  `updateUserProfile` yamayı böler (`splitAccountFields`), gizli alanı **önce** yazar,
  yalnız gizli alan değiştiyse kök belgeye hiç dokunmaz.
- **Okuma:** `UserProfileContext` gizli belgeyi dinler ve `profile.birthDate`e **birleştirir**
  (gizli kazanır, kök yedek) — ekranlar değişmedi. Birleşik hâl önbelleğe yayınlanır.
- **Yaş kapısı:** tarih elde yokken karar, gizli belgenin ilk anlık görüntüsüne kadar
  **bekler**; okunamazsa bayrak olduğu gibi kalır. (Beklemeseydik taşınmış bir hesapta
  kök belgede tarih olmadığı için 18 altı kısıtı açılış anında kalkardı.)
- **Tembel göç:** sahibi uygulamayı açınca kökte eski alan görülürse
  `migrateRootAccountFields` önce gizli belgeye yazar, **sonra** kökten `deleteField()` eder.
  Oturum + hesap başına bir deneme; hata sessiz geçilir, sonraki oturumda yeniden denenir.

Sunucu: `functions/scripts/migrateAccountPrivate.js` — hiç açmamış hesaplar için toplu
göç (kök e-posta/tarih + B3'ten kalan eski push jetonları). Varsayılan **kuru çalışma**,
`--apply` ister, çıktıya değer yazmaz. Kopya + silme aynı batch'te (atomik). Saf planlayıcı
`accountMigrationPlan.js` testli.

## 4. Eski istemci uyumu

| Eski istemci davranışı | Sonuç |
|---|---|
| Kayıt ekranı e-posta + tarihi **köke** yazar | Aşama 3 öncesi serbest (anahtar `true`). Aşama 3 sonrası **reddedilir** → o sürümde yeni kayıt açılamaz |
| Profili Düzenle tarihi köke yazar (alan boş görünürse) | Kural: gizli kopyayla aynı değilse reddedilir (18 altı tarihi "büyütemez") |
| Yaş kapısı `profile.birthDate` (kök) okur | **Kökten silinince kısıt düşer** — 18 altı hesap o eski sürümde yetişkin içerik görebilir |
| B3 öncesi sürüm kök push jetonu yazar | Aşama 3'e kadar çalışır; sunucu zaten kök+private ikisini de okur |

**En önemli ödünleşim:** kökten silme, eski sürümde yaş kapısını kaldırır. Bu yüzden toplu
`--apply` ve Aşama 3, sahadaki sürümlerin yeni yola geçmesine bağlanmalı (§6). `runtimeVersion =
appVersion` olduğundan bu değişiklik JS-only'dir: **aynı çalışma sürümündeki** (1.4.8) cihazlara
OTA ile gider; 1.4.8 öncesi cihazlar yeni yola geçmek için mağaza güncellemesi ister.

## 5. Bilinçli kabul edilen açıklar

- Sahibi kendi gizli belgesini silip yeniden yazarak tarihi değiştirebilir. Kök belgedeki
  mevcut durumla aynı düzey (kök belge de silinip yeniden açılabiliyor) ve gerçek kapı
  zaten kendi beyan edilen tarihe dayanıyor; kimlik doğrulaması yok.
- `email` Firebase Auth'ta da var; Firestore'daki kopyayı **hiçbir şey okumuyor**. Tamamen
  bırakmak (gizli belgeye de yazmamak) veri minimizasyonu açısından daha temiz — karar §7.

## 6. Yayın sırası (her adım kullanıcı onayıyla)

1. **Kurallar:** `firebase deploy --only firestore:rules` — eski istemcilerle uyumlu
   (anahtar `true`), önce bu. Kurallar yayında değilken yeni istemci de bozulmaz
   (gizli belge yazımı eski kuralda da serbest; kökten silme reddedilir ve sessiz geçilir).
2. **İstemci:** 1.4.8 için OTA (`runtimeVersion` aynı) ve/veya yeni mağaza sürümü.
3. **Toplu göç, önce kuru:** `node scripts/migrateAccountPrivate.js` → rapora bak →
   `--apply`. (Adım 2'den sonra; eski sürümler yaş kapısını kaybeder, bkz. §4.)
4. **Aşama 3:** `firestore.rules` içinde `legacyRootAccountWrites()` → `return false;`,
   `npm run test:rules`, deploy. Adım 3'ü bundan hemen önce bir kez daha çalıştır.
5. **Web:** `website/privacy.html` (hosting) — metin ancak adım 3–4'ten **sonra** doğrudur;
   daha önce yayınlanırsa "diğer kullanıcılar okuyamaz" iddiası eksik göçlü hesaplar için yanlış olur.

Geri alma: kural değişikliği tek dosya (git revert + deploy). Göç kayıpsızdır (kopya önce,
silme sonra, aynı batch) — geri almak için gizli belgeden kökü yeniden doldurmak gerekir;
böyle bir ihtiyaç beklenmiyor.

## 7. Açık kararlar

- `email` Firestore'da tutulmaya devam mı etsin yoksa tamamen bırakılsın mı? (Önerim: bırak —
  hiçbir şey okumuyor. Bırakmak = `createUserProfile`'dan `email`i çıkarmak + betikte kökü silip
  kopyalamamak.)
- Aşama 3 hangi sürüm/tarihten sonra? (Öneri: kapalı test + ilk mağaza sürümü yeni yola geçtikten sonra.)
- B3'ün push jetonu geri düşüşünün (`functions/index.js` "GEÇİŞ" blokları) kaldırılması 1.5.0'a
  bağlı; bu göçle birlikte kök jeton kalmayacağından o blok Aşama 3 sonrası silinebilir.

## 8. Doğrulama

- `npm run test:rules` (JDK 21: Android Studio JBR) — gizli belge kuralları, göç silme koşulu,
  eski istemci uyumu ve Aşama 3 anahtarı (kural metni çevrilip ayrı proje kimliğinde denenir).
  Kuralı bozup (silme koşulunu gevşetip) testlerin düştüğü ayrıca görüldü.
- `npm test` — `accountPrivateService`, `accountMigrationPlan`, `userProfileCreate`.
- **Cihazda görülmedi.** Özellikle: taze kayıt, Profili Düzenle'de ilk kez tarih girme, 18 altı
  hesabın açılışta yetişkin içeriğin kapalı kalması, kökte eski alanı olan hesabın ilk açılışta
  taşınması.

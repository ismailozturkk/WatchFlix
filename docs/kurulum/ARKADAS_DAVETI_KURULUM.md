# Arkadaş daveti + promosyon kodu — kurulum ve işletme

Kod tamam ve testlerle doğrulandı; **yayında değil**. Aşağıdaki "Yayına alma" adımları yapılana kadar uygulamadaki
davet ekranı sunucu çağrılarında hata verir. Tasarım kararları ve kuralların kaynağı: `functions/referral.js`.

## Ne yapıyor

| Rol | Ne olur |
|---|---|
| Davet eden | Ayarlar > Seelogd Premium > **Arkadaşını davet et**: kendi kodunu paylaşır; arkadaşlarının durumunu görür (**Kayıt oldu → Abone oldu → ücretsiz ay kazandın**). Arkadaşı **ilk ücretli** aboneliğini başlatınca **1 ay ücretsiz Premium** birikir (en fazla 12 ay). Birikmiş ayı "Ücretsiz ayı başlat" ile açar. |
| Davetli | Premium sayfasının altındaki **Kodun var mı?** alanına arkadaşının kodunu girer; ilk aboneliğine **%30 indirim** (mağaza teklifi, aşağıya bak). Hesabı açtıktan sonra 14 gün içinde girilmeli, daha önce abone olduysa girilemez. |
| Promosyon kodu | Aynı alana yazılır. Sen üretirsin (`functions/scripts/promoCodes.js`); **kod başına kişi sınırı** koyarsın; kullanana 1 ay ücretsiz Premium verir. Hesap başına tek promosyon kodu. |

Ücretsiz ay bir **mağaza aboneliği değildir**: sunucu planı `Users/{uid}.entitlements`'a `premiumSource: "promo"` +
`promoUntil` ile yazar; RevenueCat webhook'u bu belgeyi her olayda yeniden yazdığı için etkin plan
`max(RevenueCat, süren promosyon)` olarak birleştirilir. Süresi dolanı saatlik `expirePromoGrants` temizler; istemci
bitişi kendisi de kontrol eder (en fazla ~1 saat sunucu kapıları — kurallar, AI kotası — geç kalır).

Mağaza aboneliği **sürerken** kod/ödül başlatılamaz (boşa giderdi); ödül birikmiş olarak bekler.

## Yayına alma (sırayla)

```bash
# 1) Kurallar: yeni koleksiyonlar (ReferralCodes, ReferralAccounts, Referrals, PromoCodes) açıkça kapalı
firebase deploy --only firestore:rules

# 2) Fonksiyonlar: 4 yeni + 2 değişen (webhook ve syncPremiumStatus artık promosyonu koruyor)
firebase deploy --only functions:getReferralOverview,functions:redeemCode,functions:claimReferralReward,functions:expirePromoGrants,functions:cleanupReferralOnUserDeleted,functions:revenueCatWebhook,functions:syncPremiumStatus
```

- `expirePromoGrants` bir **Cloud Scheduler** işi açar (Blaze plan, ücreti ihmal edilebilir) ve `REVENUECAT_SECRET_API_KEY`
  sırrını kullanır (zaten tanımlı).
- Webhook'u **uygulama sürümünden önce** yayınla: eski webhook ücretsiz ayı sildirirdi.
- Yeni uygulama sürümü şart (yeni ekran + `react-native-purchases` teklif çağrıları JS tarafında; native değişiklik yok → **OTA yeterli** olabilir, ama Premium sayfası değiştiği için sürüm notu düş).

## Promosyon kodu üretme

`functions/scripts/promoCodes.js` (başlık yorumunda kimlik kurulumu var). Varsayılan **kuru çalışmadır**; yazmak için `--apply`.

```bash
cd functions
node scripts/promoCodes.js create --count 5 --uses 1 --days 30 --note "Basın" --expires 2026-12-31            # kuru
node scripts/promoCodes.js create --count 5 --uses 1 --days 30 --note "Basın" --expires 2026-12-31 --apply    # yaz
node scripts/promoCodes.js list
node scripts/promoCodes.js disable ABCDEFGH --apply
```

**Premium Max kodu:** `--plan max` (varsayılan `premium`). Veritabanında plan `unlimited` saklanır; `list` çıktısı
"Premium Max" yazar. Plan, `Users/{uid}.entitlements.promoPlan` alanında bitişle (`promoUntil`) birlikte tutulur, webhook
yeniden yazdığında korunur; alan olmayan eski kayıtlar Premium sayılır. Hesapta süren daha yüksek bir promosyon varsa
(ör. Max kodu olan biri davet ödülünü başlatırsa) plan düşmez, yalnız süre uzar. **Max kodunu üretmeden önce**
`redeemCode`, `claimReferralReward`, `expirePromoGrants`, `revenueCatWebhook` ve `syncPremiumStatus` deploy edilmiş olmalı:
eski `redeemCode` planı okumaz, Max kodunu Premium olarak harcar. İstemci değişikliği gerekmez (plan `premiumPlan`dan okunur);
tek eksik, kod girme sayfasının başarı metninin her zaman "Premium" demesidir.

Toplam açılabilecek ücretsiz ay en fazla `count × uses`. Sınırı sonradan değiştirmek için konsolda
`PromoCodes/{KOD}.maxRedemptions` alanını düzenle; `active: false` kodu hemen kapatır.

## Davetli indirimi (%30) — mağaza panelinde yapılacaklar

İstemci indirimi **yalnız mağazada aynı kimlikli teklif varsa** gösterir ve o teklifle satın aldırır; yoksa hiçbir şey
vaat etmez. Teklif kimliği: **`referral-30-1m`** (`functions/referral.js` → `INVITEE_OFFER_ID`).

- **Google Play:** `premium_monthly` (ve istenen diğer ürünler) > base plan `p1m` > **Teklif ekle** > kimlik `referral-30-1m`,
  uygunluk **Geliştirici tarafından belirlenir**, faz: 1 dönem, %30 indirimli. (Uygulama bu teklifi `subscriptionOptions`
  içinde `p1m:referral-30-1m` olarak arar.)
- **App Store:** abonelik > **Promosyon teklifleri** > referans adı/kimliği `referral-30-1m`, 1 ay %30. RevenueCat panelinde
  **App Store Connect abonelik anahtarı** (In-App Purchase Key) yüklü olmalı; imzayı RevenueCat üretir.
- Yanlış kimlikle açılırsa indirim görünmez (kırılma yok).

> **Karar (19 Eki 2026, kullanıcı): %30 / 1 ay kalır, lansman teklifi önde olur.** Lansman teklifi (aylık ilk 3 ay %50, yıllık ilk yıl %20) herkese zaten açık ve %30/1 ay'dan daha iyi.
> Mağaza tek teklif uyguladığı için istemci, kullanıcıya **toplamda daha çok kazandıranı** seçer
> (`pickBetterOffer`): lansman sürerken davetli indirimi pratikte hiç öne çıkmaz. Davetin davetliye gerçek bir şey
> sunması için ya lansman teklifi kapatılmalı/azaltılmalı ya da davet teklifi lansmandan iyi olmalı (ör. ilk 3 ay %60).

## Bilinen sınırlar

- **Çoklu hesapla ödül çiftçiliği** tamamen engellenemez. Önlemler: ödül yalnız gerçek ücretli ilk dönemde (deneme, sandbox,
  0 fiyatlı satın alma sayılmaz), davetli başına tek ödül, 12 aylık tavan, yanlış kod denemesi günde 10.
  İade/chargeback olursa verilmiş ödül **geri alınmaz**.
- Davet kodu hesap açıldıktan sonra girilir; kodu girmeyen davetli listede **görünmez** ("Kayıt oldu" = kodu girdi).
  Kayıt ekranına kod alanı eklenmedi.
- Davet edene **push bildirimi gitmiyor** (ödül kazanınca ekrana girince görünür). Bildirim eklenebilir.
- Paylaşım mesajındaki bağlantı şimdilik yalnız `https://seelogd.com`; mağaza sayfaları herkese açık olunca
  `utils/referral.js` → `REFERRAL_SHARE_LINKS`'e eklenir.
- `redeemCode` Auth kaydına ulaşamazsa 14 gün penceresini uygulamaz (davet reddetmek yerine kabul eder).

## Testler

| Ne | Nasıl |
|---|---|
| Saf kurallar | `cd functions && npm test` (`referral.test.js`) |
| Transaction'lar, webhook, süpürme — **gerçek Firestore** | `npx firebase emulators:exec --only firestore --project demo-referral "node --test functions/referral.integration.test.js"` (JDK 21: Android Studio JBR) |
| Güvenlik kuralları | `npm run test:rules` |
| İstemci | `npx jest __tests__/referral.test.js` |

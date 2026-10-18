# Toast sistemi

Uygulama içi geçici bildirimler ("Kaydedildi", "Hata", "Geri Al"…). 16 Ekim 2026'da
`react-native-toast-message` bırakılıp kendi motorumuza geçildi; bu sayfa mimariyi, kullanımı ve
kuralları anlatır. (`PUANLAMA_ROZET_SISTEMI.md`deki `toastConfig` anlatımı eskidir.)

## Neden değişti

| Eski kütüphane | Yeni sistem |
|---|---|
| Kuyruk yok: yeni toast görüneni anında ezer | Tek görünür toast + sınırlı kuyruk, öncelik (kutlama > hata > uyarı > başarı > bilgi) |
| Android'de animasyon JS iş parçacığında (`useNativeDriver:false`) | Reanimated yerleşim animasyonu + RNGH sürükleme, hepsi UI iş parçacığında |
| `topOffset` sabit 54 (çentik/adada üst üste biner) | Güvenli alan + 8 px |
| Native `Modal` açıkken toast ARKADA kalır (alt sayfalardan verilen toast hiç görünmezdi) | Her Modal kendi host'unu taşır; toast en üstteki host'ta çizilir |
| Aynı toast art arda gelince yığılır | Yinelenen içerik yeni toast açmaz: süre yenilenir, `×N` sayacı artar |
| Tek tip kart | Tür başına hareket: tik çizilir, hata titrer, uyarı nabız atar, yükleniyor döner, premium kıvılcım saçar, rozet parlar |

## Parçalar

```
utils/toastStore.js            SAF durum makinesi (kuyruk, öncelik, süre, host kaydı). React yok.
utils/connectivityToast.js     Bağlantı durumu → toast kararı (saf).
components/AppToast.js         TEK API (toast.success/error/…); hafif — çizim bileşenlerini import ETMEZ.
components/toast/ToastHost.js  Çizim yeri. Kök: <ToastHost />, Modal içi: <ToastHost scoped enabled={visible} />
components/toast/ToastItem.js  Kabuk: giriş/çıkış, sürükleyerek kapatma, basılı tutunca süre durur, erişilebilirlik
components/toast/ToastCards.js StatusCard (success/error/warning/info/loading/premium) + BadgeCard
components/toast/ToastOrb.js   Animasyonlu ikon rozeti (SVG çizim, titreme, nabız, kıvılcım)
components/toast/toastPalette.js  Tür → renk (saf)
components/toast/ModalToastHost.js   Çıplak <Modal> içine
components/toast/ScreenToastHost.js  iOS'ta fullScreenModal/transparentModal ile açılan ekranlara (odaktayken kayıtlı)
components/toast/ConnectivityToast.js Başsız: "Çevrimdışısın" / "Tekrar çevrimiçisin"
```

## Kullanım

```js
import { toast } from "@components/AppToast";

toast.success("Kaydedildi", "Değişiklikler uygulandı");
toast.error("Gönderilemedi", error);                 // Error nesnesi mesaj olur
toast.warning("Depolama dolmak üzere");
toast.info("Panoya kopyalandı");
toast.undo("Hatırlatma kaldırıldı", () => geriYaz()); // "Geri Al" düğmeli, en az 6 sn
toast.premium("Premium aktif", "Tüm ayrıcalıklar açıldı");
toast.badge("Yeni rozet", "Kâşif", { gorunum, ek, ipucu }, { onPress });

// Uzun iş: tek kartta yükleniyor → sonuç
const id = toast.loading("Yedek alınıyor");
toast.update(id, { kind: "success", title: "Yedek alındı" });
await toast.promise(yukle(), { loading: "Yükleniyor", success: "Bitti", error: (e) => e.message });
```

Seçenekler (son parametre): `duration` (ms; `Infinity` kalıcı), `key` (aynı anahtar = aynı toast),
`onPress`, `haptic` (`false` susturur, `true` başarıda da titretir), `icon`, `swipeable`.

**Eski imza da çalışır** (≈280 çağrı yeri bu biçimde):
`import Toast from "@components/AppToast"; Toast.show({ type, text1, text2, visibilityTime, onPress, props: { action } })`.
Yeni kod `toast.*` kullanmalı.

## Kurallar

1. **Modal içinden toast veriliyorsa host şart.** `BottomSheetModal` host'u kendisi taşır. Çıplak
   `<Modal>` kullanan ekran `<ModalToastHost visible={niyet} />` ekler (`visible` = açık olma NİYETİ,
   `useSheetTransition().mounted` DEĞİL — kapanış animasyonunda host kaydı bırakılmalı ki toast köke
   devredilsin). iOS'ta `presentation: "fullScreenModal" | "transparentModal"` ekranlara
   `<ScreenToastHost />`.
2. **Reanimated ilk-değer kuralı** (`memory/reanimated-initial-value-vanish`): animasyonlu stilin/prop'un
   İLK değeri GÖRÜNÜR durum olmalı; giriş hareketi efektte "gizliye atla → oynat" diye başlar. Yalnız süs
   katmanları (halka, kıvılcım, parlama) dinlenme değerinde gizlidir.
3. **Titreşim politikası** `services/hapticsService` içindedir: hata/uyarı/kutlama titreşir, başarı/bilgi
   titreşmez. Çağıranın kendi başarı titreşimi varsa çift vuruş zaten tek vuruşa iner (300 ms kısma).
4. **Metinler i18n'den**: yeni `autoI18n.*` anahtarı üç pakete (tr/en/es) eklenmeli
   (`__tests__/i18nKeys.test.js` bekçisi).
5. **Engelleyici uyarı ≠ toast.** Geri alınamaz onaylar ve ayrıntılı hata açıklamaları `appAlert`'te kalır;
   sonuç bildirimi (kaydedildi, silindi, gönderilemedi) toast olur.
6. Toast göstermeyen **saf modüller** (`utils/*`) bile `@components/AppToast` import edebilir: cephe
   Reanimated/SVG yüklemez.

## Davranış özeti

- Süre okuma süresine göre (2,4–6,5 sn; hata ×1,25; eylem düğmesi varsa ≥ 6 sn; ekran okuyucu açıkken ×2).
- Kalan süre kartın altında çubukla görünür; parmak kartın üstündeyken durur, bırakınca kalan (en az 1,4 sn) sürer.
- Yukarı/yana kaydırarak kapanır; aşağı çekmek lastik gibi direnir. Karta dokunmak kapatır (+ `onPress`).
- "Hareketi Azalt" açıkken yaylanma/titreme/kıvılcım yok, yalnız solma.
- Ekran okuyucu: kart `alert` rolünde, Android'de canlı bölge, iOS'ta ayrıca duyuru; "Kapat" ve eylem
  düğmesi erişilebilirlik eylemi olarak sunulur.
- Bağlantı: 2,5 sn'den uzun kopma bir kez "Çevrimdışısın" der; dönünce "Tekrar çevrimiçisin".

## Doğrulama

`__tests__/toastStore.test.js` (motor), `toastFacade.test.js` (API/yan etkiler), `toastUi.test.js`
(kartlar/host/etkileşim), `connectivityToast.test.js`. Hareketin kendisi ve gerçek yerleşim cihazda
doğrulanır; kartlar tarayıcıda (react-native-web) üç tema × üç genişlikte görüldü, cihazda görülmedi.

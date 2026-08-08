# Ana Ekran Widget'ları — Kurulum / Build Kılavuzu

> Durum: **Android tarafında üç widget da hazır.** iOS tarafı **scaffold**;
> derlenip cihazda doğrulanması için **macOS + Xcode** gerekir (Windows'ta
> build/verify yapılamadı).

| Widget | Android | iOS |
|---|---|---|
| **Yaklaşanlar** (film/bölüm geri sayımı) | ✅ hazır | scaffold |
| **Listelerim** (3 sütun poster ızgarası + liste seçici) | ✅ hazır | scaffold, kısıtlı (aşağıya bak) |
| **İstatistikler** (profil istatistik bölümünün karşılığı) | ✅ hazır | scaffold |

## Mimari (veri akışı)

```
ProfileRemindersContext ─┐
ProfileStatsContext ─────┤  sync*Widget(veri, dil)
                         ▼
services/widgetBridge.js  (platform seçimi + TMDB poster URL'i)
   ├── Android → NativeModules.{Reminder|Lists|Stats}WidgetModule (Kotlin köprü)
   │                └── SharedPreferences → *WidgetProvider (App Widget)
   └── iOS     → requireOptionalNativeModule("ReminderWidget")
                    └── App Group UserDefaults → WidgetKit (targets/reminder-widget)
```

Widget'lar **Firestore'a ikinci bir bağlantı açmaz**: context'lerin zaten canlı
tuttuğu verinin küçük bir özetini native depoya aktarır.

### Payload sözleşmeleri

| Widget | JS servisi | Şekil |
|---|---|---|
| Yaklaşanlar | `services/reminderWidgetService.js` | `[{ id, type, title, subtitle, poster, dateEpoch }]` |
| Listelerim | `services/listsWidgetService.js` | `[{ key, name, accent, icon, count, posters: [url] }]` |
| İstatistikler | `services/statsWidgetService.js` | `{ title, movie, tv, duration, units }` |

İstatistik payload'unda **sayı biçimlendirme ve i18n JS'te biter**; native taraf
yalnız hazır metinleri bağlar. Bu yüzden dil değişince payload yeniden gönderilir
(`ProfileStatsContext` effect'inin `language` bağımlılığı).

## Android notları

- Manifest girdileri (`receiver` + `service`) ve `MainApplication.getPackages()`
  içindeki `SeelogdWidgetPackage()` **elle** eklenmiştir. `npx expo prebuild
  --clean` bunları siler — Android klasörü bu projede versiyon kontrolünde ve
  elle bakımı yapılıyor.
- **Listelerim'de liste seçimi ok tuşlarıyla:** RemoteViews'te Spinner/ScrollView
  yok ve bir widget yalnız tek koleksiyon (burada poster `GridView`'ı)
  barındırabilir. Başlıktaki ‹ › düğmeleri `LISTS_CYCLE` yayını gönderir; seçim
  **widget örneği başına** saklanır (`selection_<widgetId>`), yani aynı anda iki
  farklı listeyi ana ekrana koyabilirsin.
- **Posterler:** RemoteViews URL yükleyemez. Bitmap'ler `RemoteViewsService`
  içinde elle indirilir, 2:3 kırpılır, köşeleri yuvarlanır ve bayt bütçeli bir
  `LruCache`'te (8 MB) tutulur.

## iOS: bu commit'teki dosyalar

| Dosya | Görev |
|---|---|
| `targets/reminder-widget/expo-target.config.js` | `@bacons/apple-targets` widget hedef tanımı + App Group |
| `targets/reminder-widget/shared.swift` | App Group kimliği, marka renkleri, `Color(hex:)`, arka plan uyumluluğu |
| `targets/reminder-widget/index.swift` | Yaklaşanlar widget'ı + `WidgetBundle` (üç widget) |
| `targets/reminder-widget/lists-widget.swift` | Listelerim widget'ı |
| `targets/reminder-widget/stats-widget.swift` | İstatistikler widget'ı |
| `modules/reminder-widget/ios/ReminderWidgetModule.swift` | Üç payload'u da App Group'a yazan köprü |
| `app.json` | `@bacons/apple-targets` plugin + `ios.entitlements` App Group |

App Group kimliği (üç yerde de aynı olmalı): **`group.com.smlztrk.seelogd`**

### iOS "Listelerim" neden Android'den farklı

1. **Poster yok.** WidgetKit uzantısında ağdan görsel indirilemez (`AsyncImage`
   widget'larda çalışmaz). Posterlerin önce App Group konteynerine indirilip
   diskten okunması gerekir; o görsel boru hattı henüz yok. iOS sürümü şimdilik
   listeleri **ad + öğe sayısı + aksan rengiyle** gösterir.
2. **Liste seçici yok.** Doğru iOS karşılığı AppIntent tabanlı yapılandırılabilir
   widget (iOS 17+); Windows'ta derlenip doğrulanamayacağı için tüm listeler tek
   kartta sıralanır.

Her ikisi de Mac adımında ele alınmalı.

## Ön koşullar

- macOS + Xcode (15+)
- Apple Developer hesabı ve **Team ID**
- `group.com.smlztrk.seelogd` App Group'unun tanımlı olması

## Adımlar (Mac'te)

1. **Bağımlılıkları kur:**
   ```bash
   npm install
   ```

2. **Apple Team ID'yi ekle** — `app.json` içine:
   ```json
   "ios": {
     "supportsTablet": true,
     "appleTeamId": "XXXXXXXXXX",
     "entitlements": {
       "com.apple.security.application-groups": ["group.com.smlztrk.seelogd"]
     }
   }
   ```

3. **Native projeyi üret:**
   ```bash
   npx expo prebuild -p ios --clean
   ```

4. **Aç ve derle:**
   ```bash
   xed ios
   ```
   Signing için her iki hedefte de (app + ReminderWidget) **App Groups**
   capability'sinin açık ve aynı grubu işaret ettiğini doğrula.

5. **Test et:** uygulamayı aç, ana ekranda uzun bas → **+** → Seelogd → üç
   widget'ın da listelendiğini gör.

## Doğrulama kontrol listesi

### Android
- [ ] Widget seçicide üç widget da görünüyor ve önizlemeleri doğru
- [ ] Listelerim: ‹ › ile listeler arasında geçiliyor, sayı ve ad güncelleniyor
- [ ] Listelerim: posterler 3 sütun geliyor, ızgara kaydırılıyor
- [ ] Listelerim: iki farklı widget örneği farklı listeleri gösterebiliyor
- [ ] Listelerim: postere/başlığa dokununca ilgili liste ekranı açılıyor
- [ ] İstatistikler: sayılar profildeki bölümle birebir aynı
- [ ] İstatistikler: film kartı → MovieStatisticsScreen, dizi kartı → TvStatisticsScreen
- [ ] Dil değişince (TR ↔ EN) etiketler güncelleniyor
- [ ] Çıkış yapınca widget'lar boşalıyor

### iOS
- [ ] `npx expo prebuild -p ios` hatasız tamamlanıyor
- [ ] Xcode'da `ReminderWidget` hedefi derleniyor (üç widget da)
- [ ] App + widget aynı App Group'a sahip

## Sorun giderme

- **Widget boş kalıyor:** App Group kimliği üç yerde de (`app.json`,
  `expo-target.config.js`, `ReminderWidgetModule.swift`) birebir aynı mı?
- **`requireOptionalNativeModule("ReminderWidget")` null dönüyor:** `modules/`
  autolinking'i için `npx expo prebuild --clean` tekrar çalıştır; Expo Go'da
  native modüller çalışmaz (dev build gerekir).
- **Listelerim ok tuşları çalışmıyor:** manifest'teki `LISTS_CYCLE` intent
  filtresi duruyor mu? PendingIntent'ler `data` URI'siyle ayrıştırılıyor —
  yalnız requestCode yeterli değil (extras eşitliğe girmez).
- **Posterler gelmiyor:** cihazda ağ var mı? TMDB CDN (`image.tmdb.org`)
  erişilebilir mi? Widget özel R2/kalite katmanını kullanmaz.
- **Derin bağlantı açılmıyor:** `App.js` içindeki `linking.config.screens`
  yolları (`lists`, `lists/:listName`, `stats/movies`, `stats/tv`) ile
  provider'lardaki `seelogd://…` URI'leri uyuşuyor mu?

## Notlar

- Android widget'ları bu belgeden **bağımsız** çalışır (Kotlin tarafı hazır).
- iOS widget kodu Windows ortamında **derlenip doğrulanamadı**.

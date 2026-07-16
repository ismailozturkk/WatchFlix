# iOS "Yaklaşanlar" Widget — Kurulum / Build Kılavuzu

> Durum: **Android widget hazır ve çalışıyor.** iOS tarafı bu commit ile
> **scaffold** edildi; derlenip cihazda doğrulanması için **macOS + Xcode**
> gerekir (Windows'ta build/verify yapılamadı).

## Mimari (veri akışı)

```
ProfileRemindersContext
        │  syncReminderWidget(reminders, language)
        ▼
services/reminderWidgetService.js
   ├── Android → NativeModules.ReminderWidgetModule (Kotlin köprü)
   │                └── SharedPreferences → ReminderWidgetProvider (App Widget)
   └── iOS     → requireOptionalNativeModule("ReminderWidget") (Expo modülü)
                    └── App Group UserDefaults → WidgetKit (targets/reminder-widget)
```

Her iki platform da aynı JSON sözleşmesini kullanır:
`[{ id, type: "movie"|"tv", title, subtitle, dateEpoch (ms) }]`.

## Bu commit'te eklenen iOS dosyaları

| Dosya | Görev |
|---|---|
| `targets/reminder-widget/expo-target.config.js` | `@bacons/apple-targets` widget hedef tanımı + App Group |
| `targets/reminder-widget/index.swift` | WidgetKit widget'ı (TimelineProvider + SwiftUI görünüm) |
| `modules/reminder-widget/expo-module.config.json` | Yerel Expo modülü autolink kaydı |
| `modules/reminder-widget/ios/ReminderWidget.podspec` | Modül pod tanımı |
| `modules/reminder-widget/ios/ReminderWidgetModule.swift` | App Group'a yazıp WidgetKit'i yenileyen köprü |
| `app.json` | `@bacons/apple-targets` plugin + `ios.entitlements` App Group |
| `package.json` | `@bacons/apple-targets` devDependency |
| `services/reminderWidgetService.js` | iOS yönlendirmesi (Android davranışı korunur) |

App Group kimliği (üç yerde de aynı olmalı): **`group.com.smlztrk.Watchify`**

## Ön koşullar

- macOS + Xcode (15+)
- Apple Developer hesabı ve **Team ID**
- Apple Developer portalında (veya EAS credentials ile) `group.com.smlztrk.Watchify`
  App Group'unun tanımlı olması

## Adımlar (Mac'te)

1. **Bağımlılıkları kur:**
   ```bash
   npm install
   # veya doğru sürümü Expo çözsün:
   # npx expo install @bacons/apple-targets
   ```

2. **Apple Team ID'yi ekle** — `app.json` içine:
   ```json
   "ios": {
     "supportsTablet": true,
     "appleTeamId": "XXXXXXXXXX",
     "entitlements": {
       "com.apple.security.application-groups": ["group.com.smlztrk.Watchify"]
     }
   }
   ```

3. **Native projeyi üret:**
   ```bash
   npx expo prebuild -p ios --clean
   ```
   Bu adım `ios/` klasörünü oluşturur, `ReminderWidget` uzantı hedefini ve
   yerel Expo modülünü ekler, her iki hedefe App Group entitlement'ını bağlar.

4. **Aç ve derle:**
   ```bash
   xed ios      # workspace'i Xcode'da açar
   ```
   Ana uygulamayı bir cihaza/simülatöre build et & çalıştır. Signing için her iki
   hedefte de (app + ReminderWidget) **App Groups** capability'sinin açık ve aynı
   grubu işaret ettiğini doğrula.

5. **Test et:**
   - Uygulamayı aç (hatırlatıcılar App Group'a yazılır).
   - Ana ekranda uzun bas → **+** → Watchify → "Yaklaşanlar" widget'ını ekle
     (Medium veya Large boyut).
   - Yaklaşan film/bölümler geri sayımla görünmeli.

## Doğrulama kontrol listesi

- [ ] `npx expo prebuild -p ios` hatasız tamamlanıyor
- [ ] Xcode'da `ReminderWidget` hedefi görünüyor ve derleniyor
- [ ] App + widget aynı App Group'a sahip (Signing & Capabilities)
- [ ] Uygulamada hatırlatıcı ekleyince widget güncelleniyor
- [ ] Boş durumda "Yaklaşan film veya bölüm yok" gösteriliyor

## Sorun giderme

- **Widget boş kalıyor:** App Group kimliği üç yerde de (`app.json`,
  `expo-target.config.js`, `ReminderWidgetModule.swift`) birebir aynı mı?
- **`requireOptionalNativeModule("ReminderWidget")` null dönüyor:** `modules/`
  autolinking'i için `npx expo prebuild --clean` tekrar çalıştır; Expo Go'da
  native modüller çalışmaz (dev build gerekir).
- **Geri sayım güncellenmiyor:** WidgetKit zaman çizelgesi gece yarısı yenilenir;
  uygulama her hatırlatıcı değişiminde `reloadAllTimelines()` çağırır.

## Notlar

- Android widget'ı bu belgeden **bağımsız** çalışır (Kotlin tarafı hazır).
- iOS widget kodu Windows ortamında **derlenip doğrulanamadı**; yukarıdaki
  adımlarla Mac'te test edilmelidir.

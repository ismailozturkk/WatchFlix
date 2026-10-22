# Tech Context

## ⚙️ Teknolojiler

### Core Framework
- React Native 0.86.3
- Expo SDK ~57.0.21
- React 19.2.3
- Node.js >= 20.19.0 (Mevcut: v22.21.1)

### Backend & Database
- Firebase 11.7.3 (Auth, Firestore, Realtime Database)
- Firebase Cloud Functions (32 dosya backend mantığı)
- TMDB API (Film/Dizi veritabanı)
- RevenueCat (react-native-purchases 10.6.0) — abonelik & IAP
- react-native-mmkv 4.3.2 + react-native-nitro-modules 0.36.5 (senkron anahtar/değer deposu)
- @react-native-async-storage/async-storage 2.2.0 — YALNIZ tek seferlik göç ve Firebase Auth köprüsü için tutuluyor

### UI & Animation
- Lottie React Native ~7.3.8
- React Native Reanimated 4.5.1
- @shopify/react-native-skia 2.6.2
- React Native Linear Gradient 2.8.3
- Expo Blur ~57.0.2 / Expo Glass Effect 57.0.2
- React Native Skeleton Placeholder 5.2.4
- React Native Progress 5.0.1

### Navigation & State
- React Navigation 7.3.18 (Native Stack, Stack)
- Context API (29 modüler context):
  - AppSettingsContext, AuthContext, UserProfileContext, FriendsContext
  - NotificationsContext, PostsContext, ProfileStatsContext, ProfileUiContext
  - ProfileNotesContext, ProfileRemindersContext, ListStatusContext
  - MovieContex, TvShowContex, CalendarContext, PremiumContext, PetContext
  - ThemeContext, TypographyContext, SharedListsContext, ConnectivityContext, vb.

### Öne Çıkan Kütüphaneler & Araçlar
- Axios 1.7.9
- i18next 26.0.4 + react-i18next 17.0.2 (5 dil desteği: TR, EN, DE, ES, PT)
- Sentry React Native ~7.11.0 (Hata izleme)
- Firebase Analytics 26.1.0
- React Native Modal 14.0.0
- React Native Toast Message 2.3.0
- React Native Markdown Display 7.0.2
- React Native Gesture Handler ~2.32.0
- React Native Safe Area Context ~5.7.0

### Test & Kalite
- Jest 29.7.0
- @firebase/rules-unit-testing 5.0.1
- 331 test dosyası (~74K satır)

## 🧰 Geliştirme Ortamı

- Node.js >= 20.19.0
- Expo SDK ~57.x
- Platformlar: Android / iOS / Web (Expo Web)

## ⚠️ Teknik Sınırlamalar

- TMDB API istek limiti (40/saniye)
- Firestore gerçek zamanlı dinleme maliyetleri (merkezî tekil dinleyiciler ve snapshotCache ile kontrol altında)
- MMKV senkron ve hızlı; ancak BÜYÜK JSON değerlerinde `JSON.parse` maliyeti JS thread'ini bloklar (apiCache bu yüzden oturum içi bir bellek katmanı tutar)
- Reanimated 4 adaptasyonu tamamlanmış durumda

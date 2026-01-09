# Tech Context

## ⚙️ Teknolojiler

### Core Framework
- React Native 0.81.5
- Expo SDK ~54.0.30
- React 19.1.0
- Node.js 20.19.0

### Backend & Database
- Firebase 11.7.3 (Auth, Firestore)
- TMDB API (Film/Dizi veritabanı)
- AsyncStorage (@react-native-async-storage/async-storage 1.24.0)

### UI & Animation
- Lottie React Native ~7.3.1
- React Native Reanimated ~4.1.1
- React Native Linear Gradient 2.8.3
- Expo Blur ~15.0.8
- React Native Skeleton Placeholder 5.2.4
- React Native Progress 5.0.1

### Navigation & State
- React Navigation 7.1.13 (Native Stack, Stack)
- Context API (9 custom contexts)
  - LanguageContext, ThemeContext, AuthContext
  - MovieContext, TvShowContext, ProfileScreenContext
  - AppSettingsContext, ListStatusContext, SnowContext

### Öne Çıkan Kütüphaneler
- Axios 1.7.9 (API istekleri)
- React Native Modal 14.0.0
- React Native Toast Message 2.3.0
- React Native Markdown Display 7.0.2
- React Native Gesture Handler ~2.28.0
- React Native Safe Area Context ~5.6.0

### Planlanan Entegrasyonlar
- Gemini AI API → Akıllı film/dizi önerileri

## 🧰 Geliştirme Ortamı

- Node.js >= 20.19.0
- Expo SDK ~54.x
- Visual Studio Code + Gemini AI extension
- Platformlar: Android / iOS / Web (Expo Web)

## ⚠️ Teknik Sınırlamalar

- TMDB API istek limiti (40/saniye)
- Firestore gerçek zamanlı dinleme maliyetleri (onSnapshot kullanımı dikkatli olmalı)
- AsyncStorage veri boyutu limitleri (~6MB)
- Reanimated 4 adaptasyon sürecinde (bazı deprecated API'lar temizleniyor)

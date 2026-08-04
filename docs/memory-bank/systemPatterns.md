# System Design Patterns

Bu doküman, Seelogd uygulamasında kullanılan ve hedeflenen temel yazılım tasarım desenlerini açıklar.

## ✅ Mevcut Desenler

### 1. Modüler Context API (9 Context Provider)

- **Açıklama:** Her context tek bir sorumluluğa odaklanır:
  - `LanguageContext`: Çoklu dil yönetimi (TR/EN)
  - `ThemeContext`: Tema sistemi
  - `AuthContext`: Firebase Auth wrapper
  - `MovieContext`: Film verileri
  - `TvShowContext`: Dizi verileri
  - `ProfileScreenContext`: Profil, istatistik, notlar
  - `AppSettingsContext`: Uygulama ayarları
  - `ListStatusContext`: Liste durumu
  - `SnowContext`: Dekoratif efektler
- **Avantaj:** Her context bağımsız yönetilebilir
- **⚠️ Sorun:** Bazı context'ler çok büyüdü ve God Object anti-desenine dönüştü

### 2. AsyncStorage Persistence

- **Açıklama:** Kullanıcı tercihlerini (avatar, tema, dil) AsyncStorage'de saklama
- **Avantaj:** Uygulama kapatılıp açıldığında ayarlar korunur
- **⚠️ Kısıt:** 6MB limit, büyük veri setleri için uygun değil

### 3. Firestore Real-time Listeners (onSnapshot)

- **Açıklama:** İzleme listeleri, notlar ve hatırlatıcılar için gerçek zamanlı senkronizasyon
- **Avantaj:** Kullanıcı verileri anlık güncellenir
- **✅ Optimize Edildi:** Eskiden her bileşen kendi dinleyicisini açıyordu, şimdi `ListStatusContext` veya `ProfileScreenContext` üzerinden tek bir global dinleyici kullanılıyor.

### 4. Provider Composition Pattern

- **Açıklama:** App.js içinde 9 context provider iç içe sarmalanmış
- **Avantaj:** Merkezi state yönetimi
- **⚠️ Sorun:** Provider ağacı derinleşti, karmaşıklık arttı

## 🚨 Tespit Edilen Anti-Desenler

### 1. God Object Pattern (MovieContext & TvShowContext)

- **Problem:**
  - `MovieContext.js` (570 satır, 18KB): Trends, Bests, Oscar, Collections, Genres, Providers, Upcoming, NowPlaying → 8 farklı özellik tek context'te
  - `TvShowContext.js` (400+ satır): Benzer şekilde çok amaçlı
  - Bir özellik güncellendiğinde tüm consumer'lar re-render oluyor
- **Etki:** Performans düşüşü, kodun okunabilirliği zorlaşıyor, test etmek zor
- **Örnek:**
  ```javascript
  // MovieContext - 8 farklı fetch fonksiyonu, 40+ state
  (fetchMoviesBests(),
    fetchSeriesTrends(),
    fetchMoviesOscar(),
    fetchMoviesCollection(),
    fetchProviders(),
    fetchMoviesByProvider(),
    fetchMoviNowPlaying(),
    fetchMovieUpcoming(),
    fetchMoviesByGenres());
  ```

### 2. Oversized Context (ProfileScreenContext)

- **Problem:** 918 satır, 28KB tek dosya
  - Avatar yönetimi
  - İstatistik hesaplamaları
  - Not sistemi
  - Hatırlatıcı yönetimi
  - Liste görünüm ayarları
  - Rank sistemi
- **Etki:** Bakımı zorlaştırıyor, bir özellik için tüm context'i import etmek gerekiyor

### 3. Hardcoded API Key

- **Problem:** `AppSettingsContext.js` içinde TMDB API_KEY hardcoded
  ```javascript
  API_KEY: "Bearer eyJhbGci..."; // 117. satır
  ```
- **Risk:** Güvenlik açığı, source control'de açık key
- **Çözüm:** Environment variables (.env) kullanmalı

### 4. Distributed Axios Usage

- **Problem:** Her context'te ayrı `axios.request()` veya `axios.get()` çağrısı
  - `MovieContext.js`: 9 farklı yerde axios kullanımı
  - `TvShowContext.js`: 7 farklı yerde
  - `ProfileScreenContext.js`: 5 farklı yerde
  - Header, error handling her yerde tekrarlanıyor
- **Etki:** Kod tekrarı, tek bir değişiklik için 20+ yerde düzenleme gerekiyor

### 5. No Error Boundary

- **Problem:** Hata yönetimi sadece try-catch ile Toast mesajları
- **Risk:** Uygulama çökmelerine karşı korumasız
- **Çözüm:** React Error Boundary pattern uygulamalı

## 🎯 Hedeflenen ve İyileştirilecek Desenler

### 1. Custom Hooks ile Özellik Odaklı State Yönetimi

- **Çözüm:**
  - `MovieContext.js` → `useTrendingMovies()`, `usePopularMovies()`, `useMovieGenres()`, vb.
  - `ProfileScreenContext.js` → `useProfileStats()`, `useProfileNotes()`, `useProfileReminders()`
  - Her hook kendi state, loading, error yönetimini yapacak
- **Örnek Dönüşüm:**

  ```javascript
  // Önce:
  const { movieTrends, loadingTrends } = useMovie();

  // Sonra:
  const { trends, loading, error } = useTrendingMovies({ timeWindow: "week" });
  ```

- **Fayda:**
  - Bileşenler sadece ihtiyaç duyduğu veriyi çeker
  - Re-render optimizasyonu
  - Test edilebilirlik artar
  - Kod okunabilirliği yükselir

### 2. Merkezi API Servis Katmanı

- **Çözüm:**

  ```
  services/
    ├── tmdb/
    │   ├── axios-instance.js   # Merkezi axios config
    │   ├── movies.api.js        # Film API'leri
    │   ├── tv.api.js            # Dizi API'leri
    │   └── search.api.js        # Arama API'leri
    └── firebase/
        ├── auth.service.js
        └── firestore.service.js
  ```

- **Fayda:**
  - Tek yerden API yönetimi
  - Interceptor'lar (request/response)
  - Retry mekanizması
  - Rate limiting kontrolü

### 3. Offline-First Cache Stratejisi

- **Çözüm:**
  - Cache layer: AsyncStorage (küçük) veya MMKV (hızlı, büyük)
  - Stale-while-revalidate pattern
  - TTL (Time To Live) stratejisi
- **Fayda:**
  - Çevrimdışı kullanım
  - Hız artışı
  - API kullanımı azalır

### 4. Environment Configuration

- **Çözüm:**
  - `.env` dosyası (react-native-dotenv zaten yüklü)
  - `TMDB_API_KEY`, `FIREBASE_CONFIG` environment variables
  - `.env.example` template

### 5. Error Boundary Implementation

- **Çözüm:**
  - React Error Boundary component
  - Fallback UI
  - Error logging/reporting (Sentry gibi)

### 6. State Management Upgrade (İsteğe Bağlı)

- **Seçenek:** Zustand veya Jotai ile global state
- **Neden:** Context API'nin performans sınırlamaları aşılabilir
- **Karar:** Önce custom hooks refactor'u, gerekirse state management library

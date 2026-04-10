# Active Context

## 🔥 Şu Anki Odak

## Active Tasks

- [x] **Chat Screen Optimization**
  - Implement `inverted` FlatList for better UX.
  - Implement `limit(20)` and pagination with `onEndReached`.
  - Fix scroll jumping issues.
- [x] **Skeleton Loading Improvements**
  - Fix dimensions for `MovieOscarSkeleton`, `MovieUpComingSkeleton`, `SearchSkeleton`.
  - Add `MovieBestsSkeleton`.
  - Fix `MovieCardSkeleton` (added scale animation placeholders).
- [x] **API & Performance Optimizations (Phase 1)**
  - Switched from Axios to Fetch in `ChatModal.js` to fix UI-blocking `Network Error` from Gemini.
  - Wrapped `MovieContext` and `TvShowContext` values in `useMemo` to prevent unnecessary component re-renders.
  - Fixed `setLoading` reference bug in `MovieContext` (`fetchMoviesByGenres`).
- [ ] **Memory Bank Updates** (In Progress)

## Recent Changes

- `screens/ChatScreen.js`: Refactored to usage `inverted` list, removed `RefreshControl`, optimized Firestore query.
- `components/Skeleton.js`: Updated dimensions to match real cards. Added `MovieBestsSkeleton`.
- `screens/movie/MovieBests.js`: Integrated `MovieBestsSkeleton`.
- `screens/movie/MovieTrends.js`: Optimized loading state and animation binding.

## Immediate Next Steps

- Verify build stability after Skeleton import fix.
- Continue with planned features (Group Chat / Media Sharing) if user desires.

## ⚙️ Mevcut Mimari

### Context Yapısı (9 Context)

- **AuthContext**: Firebase Auth yönetimi
- **LanguageContext**: Çoklu dil desteği (TR/EN) - JSON tabanlı
- **ThemeContext**: Tema sistemi
- **MovieContext**: Film verileri (Trends, Bests, Oscar, Collections, Genres, Providers, Upcoming, NowPlaying)
- **TvShowContext**: Dizi verileri
- **ProfileScreenContext**: Profil, istatistikler, avatar, rank, notes, reminders
- **AppSettingsContext**: Uygulama ayarları + TMDB API_KEY
- **ListStatusContext**: Liste durumu yönetimi
- **SnowContext**: Dekoratif kar efekti

### Firestore Collections

- **Lists**: Kullanıcı izleme listeleri (watchedMovies, watchedTv, favorites, watchList)
- **Notes**: Kullanıcı notları (renkli, editable)
- **Reminders**: Film/dizi hatırlatıcıları
- **Users**: Kullanıcı profilleri (arkadaş sistemi, isOnline durumu - yorum satırında)
- **Comments**: Film/dizi yorumları

### Screens & Features

- **54 Screen**: Movie (9), TV (12), Tabs (16), Search (6), Auth (3), Actor (1) + yardımcı ekranlar
- **10 Component**: ChatModal, Comment, ListView, Skeleton, RatingStars, Reminder, vb.
- **4 Custom Module**: SwipeCard, SwitchToggle, UseListStatus, UseNetworkStatus

## 🧠 Öğrenilenler

- `onSnapshot` her context'te yaygın kullanılıyor, ancak performans için dikkatli olmak gerekiyor (Optimize edildi: Global tek dinleyici kuralı)
- `ProfileScreenContext` 28KB (918 satır) → çok büyük, refactor edilmeli
- `MovieContext` & `TvShowContext` "God Object" anti-deseni → custom hooks'a bölünmeli
- AsyncStorage avatar yönetimi için kullanılıyor
- TMDB API_KEY `AppSettingsContext` içinde hardcoded (güvenlik riski)
- Axios her context'te ayrı ayrı kullanılıyor → merkezi servis katmanı yok
- Chat sistemi SwipeView ile modal olarak çalışıyor
- Rank sistemi HSL renk sistemine dayalı dinamik gradient kullanıyor

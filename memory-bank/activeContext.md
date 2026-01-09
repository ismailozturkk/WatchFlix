# Active Context

## 🔥 Şu Anki Odak

- **Reanimated 4 Migrasyon**: `createAnimatedPropAdapter` deprecated uyarıları temizlendi
- **Sosyal Özellikler**: Arkadaş sistemi, chat ve yorum özellikleri aktif
- **İstatistik & Rank Sistemi**: Film/dizi izleme istatistikleri, dinamik rank renkleri
- **Not Sistemi**: Kullanıcı notları (Notes collection) Firestore'da aktif
- **Hatırlatıcı Sistemi**: Film/dizi yayın tarihi hatırlatmaları (Reminders collection)

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

- `onSnapshot` her context'te yaygın kullanılıyor, ancak performans için dikkatli olmak gerekiyor
- `ProfileScreenContext` 28KB (918 satır) → çok büyük, refactor edilmeli
- `MovieContext` & `TvShowContext` "God Object" anti-deseni → custom hooks'a bölünmeli
- AsyncStorage avatar yönetimi için kullanılıyor
- TMDB API_KEY `AppSettingsContext` içinde hardcoded (güvenlik riski)
- Axios her context'te ayrı ayrı kullanılıyor → merkezi servis katmanı yok
- Chat sistemi SwipeView ile modal olarak çalışıyor
- Rank sistemi HSL renk sistemine dayalı dinamik gradient kullanıyor

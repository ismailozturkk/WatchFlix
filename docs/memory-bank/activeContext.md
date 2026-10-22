# Active Context

## 🔥 Şu Anki Odak

_(22 Eki 2026)_ **Yayın hazırlığı & Stabilizasyon** — Tek doğruluk kaynağı:
`docs/planlama/YAYIN_VE_GELIR_YOL_HARITASI.md`. Rebrand tamamlandı (`com.smlztrk.seelogd`). Kodda biten büyük parçalar:
- Premium (RevenueCat Premium / Premium Max, paywall)
- Ölçüm & Analitik (Firebase Analytics + Sentry)
- Performans (Device tier, Liquid Glass / AdaptiveBlurView, MMKV storage registry)
- Yapay zeka & backend (Gemini proxy Cloud Function, kota kontrolü)
- Sosyal özellikler (Group Chat, Feed, Medya Paylaşımı, Yorumlar, Hikaye Kartları)
- Oyun & Rozet (Kutu açma simülasyonu, rozet kataloğu, sinema bingosu, turnuvalar)

## ⚙️ Mevcut Mimari (22.10.2026 İtibarıyla)

### Context Yapısı (29 Context Modülü)

- **AuthContext**: Firebase Auth wrapper
- **AppSettingsContext**: Uygulama ayarları, font/kalite tercihleri, TMDB konfigürasyonu
- **UserProfileContext**: Users/{uid} gerçek zamanlı senkronizasyonu
- **FriendsContext**: Arkadaş listesi ve istek yönetimi
- **NotificationsContext & DeviceNotificationsContext**: Uygulama içi ve push bildirimleri
- **PostsContext**: Sosyal feed akışı ve paylaşımlar
- **ListStatusContext**: O(1) liste durum haritası (watched, watchlist, favorites)
- **ProfileStatsContext, ProfileNotesContext, ProfileRemindersContext, ProfileUiContext**: Bağımsız profil alt durumları
- **MovieContex & TvShowContex**: TMDB film ve dizi veri sağlayıcıları
- **PremiumContext**: RevenueCat abonelik durumu ve paywall
- **PetContext**: Sanal maskot ve etkileşim sistemi
- **TypographyContext, ThemeContext, SnowContext**: Tipografi, tema ve görsel efektler
- **SharedListsContext, ConnectivityContext, MediaNotesContext, WatchProgressContext, vb.**

### Firestore Collections

- **Users**: Kullanıcı profilleri, sayaçlar, tercihler
- **Lists**: Kullanıcı izleme listeleri subcollection mimarisi (`watchedMovies`, `watchedTv`, `favorites`, `watchList`)
- **Notes**: Kullanıcı notları (`Notes/{uid}/items/{noteId}`)
- **Reminders**: Film/dizi hatırlatıcıları
- **Posts**: Sosyal feed paylaşımları, beğeniler ve yorumlar
- **Presence**: Realtime kullanıcı durum ve heartbeat bilgisi

### Screens & Features

- **153 Ekran (91.820 LOC)**: Tabs (69), TV (15), Oyun/Rozet (16), Onboarding (11), Film (10), Chat (6), Arama (4), Auth (4), Listeler (3), Paylaşılan (3), Story (2), CineSwipe, Turnuva, Takvim, Premium, Bingo, Aktör, Wrapped vb.
- **339 Bileşen (103.340 LOC)**: Yeniden kullanılabilir UI, modal, kart, istatistik ve sohbet bileşenleri
- **136 Servis (31.043 LOC)**: Firestore CRUD, TMDB, RevenueCat, MMKV storage, bildirim ve analitik
- **331 Test (73.980 LOC)**: Jest ve Firestore rules birim/entegrasyon testleri
- **5 Dil Desteği**: TR, EN, DE, ES, PT

## 🧠 Öğrenilenler & Mimari İlkeler

- `onSnapshot` listener'ları merkezî tekil dinleyiciler ve `services/snapshotCache` ile optimize edildi.
- `services/storage` (MMKV) ile senkron, merkezî anahtar kayıtlı veri erişimi sağlandı.
- TMDB API anahtarı `EXPO_PUBLIC_API_KEY` ortam değişkeninde ve iki katmanlı (in-memory + disk TTL) cache ile korunuyor.
- Reanimated 4 ve Skia entegrasyonu tamamlandı.

# 🏗️ Seelogd — Uygulama Bilgisi ve Mimarisi Raporu

> **Son Güncelleme Tarihi:** 22.10.2026  
> **Proje Adı:** Seelogd (React Native & Expo)  
> **Sürüm:** 1.4.9  

---

## 📌 1. Genel Bakış ve Proje Özeti

Seelogd, kullanıcıların izledikleri film ve dizileri takip etmelerine, listeler oluşturmalarına, arkadaşlar edinmelerine, anlık sohbet etmelerine, yorum ve puanlama yapmalarına, turnuvalara ve rozet/oyun mekanizmalarına katılmalarına olanak tanıyan **kapsamlı bir sosyal medya ve medya takip mobil uygulamasıdır.**

* **Frontend:** React Native 0.86.3 (Expo SDK ~57.0.21, React 19.2.3, React Navigation v7.3.18)
* **Backend & Veritabanı:** Firebase Firestore (Modular SDK v11.7), Firebase Realtime Database, Firebase Authentication, Cloud Functions (32 dosya)
* **Veri Servisleri:** TMDB API (The Movie Database), RevenueCat (Abonelik/Satın Alım)
* **Yerel Depolama & Cache:** react-native-mmkv (`services/storage`), NetInfo, FileSystem
* **Grafik & Animasyon:** Lottie React Native (~7.3.8), React Native Reanimated (4.5.1), @shopify/react-native-skia (2.6.2)
* **Test & Kalite:** Jest 29, Firestore Rules Unit Testing (331 test dosyası, ~74K LOC)
* **Çoklu Dil Desteği:** i18next & react-i18next (5 Tam Dil: Türkçe, İngilizce, Almanca, İspanyolca, Portekizce)

---

## 📊 2. Kod Hacmi ve Genel İstatistikler

* **Toplam Kaynak Dosyası:** 1.830 Dosya
* **Toplam Satır Sayısı (Tüm Proje):** 448.768 Satır
* **Toplam JavaScript / TypeScript Dosyası:** 1.304 JS/TS Dosyası
* **Toplam JS/TS Kod Satırı:** 367.273 Satır (LOC)
  * *Salt Kod Satırı:* 305.421 satır
  * *Açıklama / Yorum Satırı:* 34.468 satır
  * *Boşluk Satırı:* 27.384 satır
* **Toplam Ekran Sayısı (Screens):** 153 Ekran / Ekran Modülü (91.820 Satır)
* **Toplam Bileşen Sayısı (Components):** 339 Yeniden Kullanılabilir Bileşen (103.340 Satır)
* **Toplam Servis Sayısı (Services):** 136 Servis Modülü (31.043 Satır)
* **Toplam State/Context Modülü:** 29 Context (9.480 Satır)
* **Custom Hook Sayısı:** 50 Hook (5.643 Satır)
* **Yardımcı Araçlar (Utils):** 176 Modül (32.113 Satır)
* **Birim ve Entegrasyon Testleri:** 331 Test Dosyası (73.980 Satır)
* **Cloud Functions (Backend) Kodu:** 32 Dosya (10.686 Satır)
* **Dil & Çeviri Dosyaları:** 6 Dosya (16.266 Satır — TR, EN, DE, ES, PT ve index.js)
* **Tema ve Tasarım Modülleri:** 3 Dosya (1.246 Satır)
* **Web Sitesi Kodları:** 21 Dosya (7.378 Satır)
* **Statik Varlıklar (Assets):** 309 Dosya (Lottie JSON'lar, ikonlar, avatarlar, görseller)
* **Paket Bağımlılıkları:** 105 Normal Bağımlılık + 14 Geliştirme Bağımlılığı (Toplam 119 Paket)

---

## 📂 3. Mimari Katmanlar ve Sorumlulukları

```
Seelogd/
├── App.js / index.js          # Uygulama giriş noktaları, Provider sarmalayıcıları (1.523 LOC)
├── screens/                   # 153 ekran (91.820 LOC)
├── components/                # 339 UI bileşeni (103.340 LOC)
├── services/                  # 136 servis modülü (31.043 LOC) — Firestore CRUD, TMDB, RevenueCat, depolama
├── context/                   # 29 global durum sağlayıcısı (9.480 LOC)
├── hooks/                     # 50 özel React hook'u (5.643 LOC)
├── utils/                     # 176 yardımcı fonksiyon ve araç (32.113 LOC)
├── translations/              # 6 dosya (16.266 LOC) — TR, EN, DE, ES, PT i18n çevirileri
├── functions/                 # 32 backend Cloud Functions dosyası (10.686 LOC)
├── theme/                     # 3 tema ve stil yapılandırma dosyası (1.246 LOC)
├── assets/                    # 309 Lottie, avatar ve görsel varlığı
├── native/                    # 64 yerel köprü ve widget bileşeni (4.250 LOC)
├── targets/                   # 10 iOS widget ve eklenti hedefi (1.521 LOC)
├── website/                   # 21 web sayfası ve açılış sayfası dosyası (7.378 LOC)
├── docs/                      # 59 mimari, kurulum ve özellik dokümantasyonu (16.922 LOC)
└── __tests__/                 # 331 Jest birim ve entegrasyon testi (73.980 LOC)
```

---

## 📱 4. Ekran Modülleri Dağılımı (153 Ekran / 91.820 Satır)

Uygulamanın `screens/` dizinindeki 153 ekran dosyasının kategorik ve klasör bazlı dağılımı:

| Modül / Alt Dizin | Ekran Sayısı | Satır Sayısı | Açıklama ve Kapsam |
| :--- | :---: | :---: | :--- |
| **`screens/tabs/`** | **69** | **40.119** | Ana tab ekranları (Home, Movie, Tv, Hub, Feed, Profil, Settings, Friends, Aktivite, İstatistikler) |
| **`screens/tv/`** | **15** | **7.769** | Dizi detayları, sezonlar, bölümler, grafik ekranları, trend/popüler diziler |
| **`screens/game/`** | **16** | **4.226** | Rozetler, kutu açma, sinema oyunları, seviye ilerleme, başarımlar |
| **`screens/onboarding/`** | **11** | **4.302** | İlk kurulum, vitrin slaytları, dil ve tercih seçimi, karşılama |
| **`screens/movie/`** | **10** | **4.427** | Film detayları, vizyondakiler, en iyiler, türler, sağlayıcılar, Oscar ödüllüleri |
| **`screens/chat/`** | **6** | **6.552** | Birebir ve grup sohbetleri, mesajlaşma, medya paylaşımı, anketler |
| **`screens/lists/`** | **3** | **4.980** | İzlenenler, izlenecekler, favoriler ve paylaşılan ortak listeler |
| **`screens/search/`** | **4** | **3.723** | Fuzzy medya araması, oyuncu arama, gelişmiş tür/yıl/platform filtreleme |
| **`screens/story/`** | **2** | **2.715** | Sosyal hikaye oluşturma, içerik kartı düzenleme ve görsel dışa aktarma |
| **`screens/auth/`** | **4** | **2.411** | Giriş, kayıt, şifre sıfırlama, e-posta doğrulama |
| **`screens/premium/`** | **1** | **2.161** | RevenueCat abonelik planları, özellik karşılaştırması ve ödeme ekranı |
| **`screens/shared/`** | **3** | **2.098** | Ortak paylaşılan içerik, liste ve profil görünümleri |
| **`screens/tournament/`** | **1** | **1.562** | Film/dizi eleme turnuvası ve eşleşme simülasyonu |
| **`screens/cineswipe/`** | **1** | **1.343** | Tinder tarzı film/dizi kart kaydırma ve hızlı keşif |
| **`screens/calendar/`** | **1** | **987** | Çıkış tarihleri takvimi ve bölüm/film yayın günleri |
| **`screens/actor/`** | **1** | **817** | Oyuncu / yönetmen biyografisi, filmografisi ve ödülleri |
| **`screens/wrapped/`** | **1** | **716** | Yıllık kişiselleştirilmiş izleme özeti hikaye ekranı |
| **`screens/social/`** | **1** | **469** | Sosyal etkileşim ve paylaşımlar |
| **`screens/bingo/`** | **1** | **293** | Sinema bingosu etkileşimli oyun ekranı |
| **`screens/development/`** | **1** | **110** | Geliştirici denetim ve hata ayıklama paneli |
| **`screens/navigation/`** | **1** | **40** | Navigasyon yardımcı ekranı |
| **TOPLAM** | **153** | **91.820** | **Tüm Ekran Katmanı** |

---

## 🏆 5. En Büyük Dosyalar ve Bileşenler (TOP Sıralaması)

### En Büyük Ekranlar (Kod Satırı Bazında TOP 15)
1. `screens/tabs/UsageDebugScreen.js` — **4.769 satır** (218 KB)
2. `screens/chat/ChatScreen.js` — **4.307 satır** (156 KB)
3. `screens/story/StoryShareScreen.js` — **2.496 satır** (91 KB)
4. `screens/lists/ListsScreen.js` — **2.482 satır** (94 KB)
5. `screens/premium/PremiumScreen.js` — **2.161 satır** (87 KB)
6. `screens/tv/TvShowsDetails.js` — **2.124 satır** (74 KB)
7. `screens/movie/MovieDetail.js` — **2.107 satır** (74 KB)
8. `screens/tabs/SettingsScreen.js` — **1.752 satır** (65 KB)
9. `screens/tabs/profile/FriendProfileScreen.js` — **1.574 satır** (65 KB)
10. `screens/tournament/TournamentScreen.js` — **1.562 satır** (73 KB)
11. `screens/lists/SharedListScreen.js` — **1.466 satır** (53 KB)
12. `screens/tabs/profile/MyActivityScreen.js` — **1.462 satır** (54 KB)
13. `screens/onboarding/OnboardingShowcases.js` — **1.356 satır** (61 KB)
14. `screens/cineswipe/CineSwipeScreen.js` — **1.343 satır** (48 KB)
15. `screens/tabs/settings/PosterSettingsScreen.js` — **1.243 satır** (49 KB)

### En Büyük Bileşenler (Kod Satırı Bazında TOP 15)
1. `components/wrapped/WrappedSlides.js` — **2.061 satır** (65 KB)
2. `components/Comment.js` — **1.900 satır** (71 KB)
3. `components/modals/CreatePostModal.js` — **1.800 satır** (89 KB)
4. `components/profile/StatsComponents.js` — **1.729 satır** (58 KB)
5. `components/badges/watchBadgeCatalog.js` — **1.711 satır** (135 KB)
6. `components/storyShare/ProfileStoryCard.js` — **1.646 satır** (64 KB)
7. `components/modals/ChatModal.js` — **1.444 satır** (53 KB)
8. `components/modals/DatePickerModal.js` — **1.431 satır** (48 KB)
9. `components/premium/PremiumUpsellSheet.js` — **1.430 satır** (53 KB)
10. `components/hub/HubWrappedModule.js` — **1.409 satır** (48 KB)
11. `components/feed/FeedPostCard.js` — **1.376 satır** (45 KB)
12. `components/modals/MediaQuickActionsSheet.js` — **1.301 satır** (49 KB)
13. `components/import/ImportDataModal.js` — **1.293 satır** (46 KB)
14. `components/wrapped/WrappedShareCard.js` — **1.287 satır** (55 KB)
15. `components/storyShare/ProfileStoryModal.js` — **1.264 satır** (46 KB)

### En Büyük Servisler (Kod Satırı Bazında TOP 10)
1. `services/sceneGameService.js` — **1.252 satır**
2. `services/usageTrackerService.js` — **1.232 satır**
3. `services/accountService.js` — **1.010 satır**
4. `services/listItemsService.js` — **983 satır**
5. `services/emmyService.js` — **935 satır**
6. `services/oscarService.js` — **903 satır**
7. `services/aiCineInsights.js` — **902 satır**
8. `services/watchedTvService.js` — **780 satır**
9. `services/storage/registry.js` — **712 satır**
10. `services/postsService.js` — **684 satır**

### En Büyük Context Modülleri (TOP 10)
1. `context/MovieContex.js` — **1.111 satır**
2. `context/AppSettingsContext.js` — **1.049 satır**
3. `context/TvShowContex.js` — **924 satır**
4. `context/DeviceNotificationsContext.js` — **727 satır**
5. `context/ProfileStatsContext.js` — **717 satır**
6. `context/ListStatusContext.js` — **583 satır**
7. `context/PostsContext.js` — **581 satır**
8. `context/UserProfileContext.js` — **390 satır**
9. `context/PremiumContext.js` — **363 satır**
10. `context/ProfileNotesContext.js` — **324 satır**

### En Büyük Yardımcı Araçlar (Utils TOP 10)
1. `utils/premiumFeatures.js` — **1.258 satır**
2. `utils/typographyRoles.js` — **900 satır**
3. `utils/aiCopy.js` — **834 satır**
4. `utils/chatShare.js` — **829 satır**
5. `utils/wrappedStrings.js` — **765 satır**
6. `utils/themeStudio.js` — **723 satır**
7. `utils/profileStoryCard.js` — **657 satır**
8. `utils/toastStore.js` — **594 satır**
9. `utils/yearlyGoal.js` — **585 satır**
10. `utils/watchScoring.js` — **576 satır**

---

## 🛠️ 6. Kullanılan Teknolojiler ve Paket Altyapısı

* **Çalışma Zamanı:** React Native 0.86.3, Expo SDK ~57.0.21, React 19.2.3
* **Navigasyon:** @react-navigation/native (7.3.18), @react-navigation/native-stack (7.2.0), @react-navigation/stack (7.3.6)
* **Veritabanı & Backend:** Firebase 11.7.3 (Firestore, Auth, Realtime Database), Cloud Functions (Node.js)
* **Abonelik & Satın Alım:** RevenueCat (react-native-purchases 10.6.0, react-native-purchases-ui 10.6.0)
* **Depolama Katmanı:** react-native-mmkv 4.3.2 + react-native-nitro-modules 0.36.5 (`services/storage` registry mimarisi)
* **Animasyon & Grafik:** react-native-reanimated 4.5.1, lottie-react-native ~7.3.8, @shopify/react-native-skia 2.6.2
* **İkonlar & Görseller:** @expo/vector-icons 15.0.2, expo-image ~57.0.4, react-native-svg 15.15.4
* **Çoklu Dil (i18n):** i18next 26.0.4 + react-i18next 17.0.2 (5 dil destekli)
* **Hata Takibi & Analitik:** @sentry/react-native ~7.11.0, @react-native-firebase/analytics 26.1.0
* **Test Çatısı:** Jest 29.7.0, @firebase/rules-unit-testing 5.0.1, react-test-renderer 19.2.3 (Toplam 331 test dosyası)

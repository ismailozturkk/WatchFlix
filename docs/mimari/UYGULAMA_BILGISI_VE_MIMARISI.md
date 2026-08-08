# 🏗️ Seelogd — Uygulama Bilgisi ve Mimarisi Raporu

> **Son Güncelleme Tarihi:** 08.08.2026  
> **Proje Adı:** Seelogd (React Native & Expo)  
> **Sürüm:** 1.1.0  

---

## 📌 1. Genel Bakış ve Proje Özeti

Seelogd, kullanıcıların izledikleri film ve dizileri takip etmelerine, listeler oluşturmalarına, arkadaşlar edinmelerine, yorum ve puanlama yapmalarına, turnuvalara ve rozet/oyun mekanizmalarına katılmalarına olanak tanıyan **kapsamlı bir sosyal medya ve medya takip mobil uygulamasıdır.**

* **Frontend:** React Native (Expo SDK 54, React 19, React Navigation v7)
* **Backend & Veritabanı:** Firebase Firestore, Firebase Realtime Database, Firebase Authentication, Cloud Functions
* **Veri Servisleri:** TMDB API (The Movie Database), RevenueCat (Abonelik/Satın Alım)
* **Yerel Depolama & Cache:** react-native-mmkv (`services/storage`), NetInfo, FileSystem

---

## 📊 2. Kod Hacmi ve Genel İstatistikler

* **Toplam JavaScript / TypeScript Kod Satırı:** 172,945 Satır (LOC)
* **Toplam Dosya Sayısı:** 485 JS/TS Dosyası
* **Toplam Ekran Sayısı (Screens):** 106 Ekran / Ekran Modülü
* **Toplam Bileşen Sayısı (Components):** 133 Yeniden Kullanılabilir Bileşen
* **Toplam Servis Sayısı (Services):** 67 Servis
* **Toplam State/Context Modülü:** 26 Context
* **Custom Hook Sayısı:** 13 Hook
* **Yardımcı Araçlar (Utils):** 51 Modül
* **Birim ve Entegrasyon Testleri:** 64 Test Dosyası (11,477 Satır)
* **Cloud Functions (Backend) Kodu:** 6 Dosya (2,069 Satır)
* **Dil & Çeviri Dosyaları:** 3 Dosya (Türkçe & İngilizce JSON ve index.js)

---

## 📂 3. Mimari Katmanlar ve Sorumlulukları

```
Seelogd/
├── App.js / index.js          # Uygulama giriş noktaları, Provider sarmalayıcıları
├── screens/                   # Uygulama ekranları (106 ekran / 76,512 LOC)
├── components/                # Yeniden kullanılabilir UI bileşenleri (133 bileşen / 45,184 LOC)
├── services/                  # Veri tabanı, TMDB API, bildirim servisleri (67 servis / 15,652 LOC)
├── context/                   # Global durum yönetimi (26 context / 8,352 LOC)
├── hooks/                     # Özelleştirilmiş React hook'ları (13 hook / 2,566 LOC)
├── utils/                     # Yardımcı matematik, tarih ve i18n araçları (51 util / 7,800 LOC)
├── translations/              # i18n dil dosyaları (TR, EN) (JSON ve index.js)
├── functions/                 # Firebase Cloud Functions backend kodları (6 dosya / 2,069 LOC)
├── assets/                    # Lottie animasyonları, görseller ve avatarlar
└── __tests__/                 # Jest birim testleri (64 test dosyası / 11,477 LOC)
```

---

## 📱 4. Ekran Modülleri Dağılımı (106 Ekran)

1. **Profil & Tab Ekranları (`screens/tabs/`):** 40 Ekran  
   Kullanıcı profili, istatistikler, ayarlar, tema seçimi, rozetler, medya paylaşımları.
2. **Dizi Modülü (`screens/tv/`):** 14 Ekran  
   Dizi detayları, sezonlar, bölümler, grafik ekranları, yayındaki diziler.
3. **Oyun & Rozet Sistemleri (`screens/game/`):** 13 Ekran  
   Kutu açma simülatörü, rozet kataloğu, seviye ilerleme, başarımlar.
4. **Film Modülü (`screens/movie/`):** 10 Ekran  
   Film detayları, popüler filmler, vizyondakiler, tür sayfaları, sağlayıcılar.
5. **Sohbet & Topluluk (`screens/chat/`):** 6 Ekran  
   Birebir ve grup sohbetleri, mesajlaşma, anketler.
6. **Arama & Keşfet (`screens/search/`):** 4 Ekran  
   Fuzzy medya araması, oyuncu araması, gelişmiş filtreleme.
7. **Kimlik Doğrulama (`screens/auth/`):** 4 Ekran  
   Giriş yap, kayıt ol, şifremi unuttum, e-posta doğrulama.
8. **Kullanıcı Listeleri (`screens/lists/`):** 3 Ekran  
   İzlediklerim, izleyeceklerim, favoriler ve özel listeler.
9. **Giriş / Onboarding (`screens/onboarding/`):** 2 Ekran  
   İlk kurulum, dil seçimi, karşılama slaytları.
10. **Hikaye Paylaşımı (`screens/story/`):** 2 Ekran  
    İçerik kartı oluşturma, taslak kaydetme, görsel üretme.
11. **Diğer Modüller (Actor, Calendar, Navigation, Premium, Shared, Social, Tournament, Wrapped):** 8 Ekran

---

## 🏆 5. En Büyük Ekran ve Bileşenler (TOP 10)

### En Büyük Ekranlar (Kod Satırı Bazında)
1. `screens/chat/ChatScreen.js` — **3,858 satır**
2. `screens/lists/ListsScreen.js` — **3,105 satır**
3. `screens/onboarding/OnboardingScreen.js` — **2,344 satır**
4. `screens/premium/PremiumScreen.js` — **2,233 satır**
5. `screens/story/StoryShareScreen.js` — **2,188 satır**
6. `screens/tv/TvShowsDetails.js` — **2,179 satır**
7. `screens/movie/MovieDetail.js` — **2,043 satır**
8. `screens/tabs/ShareContentScreen.js` — **2,032 satır**
9. `screens/tabs/SettingsScreen.js` — **1,945 satır**
10. `screens/tabs/profile/FriendProfileScreen.js` — **1,688 satır**

### En Büyük Bileşenler (Kod Satırı Bazında)
1. `components/Comment.js` — **1,823 satır**
2. `components/profile/StatsComponents.js` — **1,724 satır**
3. `components/modals/CreatePostModal.js` — **1,692 satır**
4. `components/modals/ChatModal.js` — **1,441 satır**
5. `components/modals/DatePickerModal.js` — **1,395 satır**
6. `components/modals/MediaQuickActionsSheet.js` — **1,319 satır**
7. `components/wrapped/WrappedSlides.js` — **1,240 satır**
8. `components/Skeleton.js` — **1,179 satır**
9. `components/modals/PostCommentSheetModal.js` — **1,077 satır**
10. `components/badges/watchBadgeCatalog.js` — **1,035 satır**

---

## 🛠️ 6. Kullanılan Teknolojiler ve Paketler

* **Mobil Kütüphane:** React Native 0.81.5, Expo 54
* **Navigasyon:** @react-navigation/native & @react-navigation/stack (v7)
* **Veritabanı:** Firebase Firestore & Realtime Database (firebase v11)
* **Abonelik & Gelirlandırma:** RevenueCat (react-native-purchases)
* **Animasyonlar:** lottie-react-native, react-native-reanimated, @shopify/react-native-skia
* **İkonlar & Görseller:** @expo/vector-icons, expo-image, react-native-svg
* **Test Çatısı:** Jest


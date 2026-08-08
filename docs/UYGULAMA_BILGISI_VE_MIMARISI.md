# 🏗️ Seelogd — Uygulama Bilgisi ve Mimarisi Raporu

> **Son Güncelleme Tarihi:** 22.07.2026  
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

* **Toplam JavaScript / TypeScript Kod Satırı:** 137,016 Satır (LOC)
* **Toplam Dosya Sayısı:** 345 JS/TS Dosyası
* **Toplam Ekran Sayısı (Screens):** 110 Ekran / Ekran Modülü
* **Toplam Bileşen Sayısı (Components):** 101 Yeniden Kullanılabilir Bileşen
* **Toplam Servis Sayısı (Services):** 38 Servis
* **Toplam State/Context Modülü:** 24 Context
* **Custom Hook Sayısı:** 9 Hook
* **Yardımcı Araçlar (Utils):** 28 Modül
* **Birim ve Entegrasyon Testleri:** 20 Test Dosyası (351 PASS Test)
* **Cloud Functions (Backend) Kodu:** 4 Dosya (1,469 Satır)
* **Dil & Çeviri Dosyaları:** 3 Dosya (3,629 Satır — Türkçe & İngilizce)

---

## 📂 3. Mimari Katmanlar ve Sorumlulukları

```
Seelogd/
├── App.js / index.js          # Uygulama giriş noktaları, Provider sarmalayıcıları
├── screens/                   # Uygulama ekranları (110 ekran / 74,350 LOC)
├── components/                # Yeniden kullanılabilir UI bileşenleri (101 bileşen / 32,514 LOC)
├── services/                  # Veri tabanı, TMDB API, bildirim servisleri (38 servis / 9,860 LOC)
├── context/                   # Global durum yönetimi (24 context / 7,285 LOC)
├── hooks/                     # Özelleştirilmiş React hook'ları (9 hook / 1,741 LOC)
├── utils/                     # Yardımcı matematik, tarih ve i18n araçları (28 util / 3,390 LOC)
├── translations/              # i18n dil dosyaları (TR, EN) (3,629 LOC)
├── functions/                 # Firebase Cloud Functions backend kodları (1,469 LOC)
├── assets/                    # Lottie animasyonları (41 adet), görseller (242 adet)
└── __tests__/                 # Jest birim testleri (20 test dosyası / 351 test)
```

---

## 📱 4. Ekran Modülleri Dağılımı (110 Ekran)

1. **Profil & Tab Ekranları (`screens/tabs/`):** 38 Ekran  
   Kullanıcı profili, istatistikler, ayarlar, tema seçimi, rozetler, medya paylaşımları.
2. **Dizi Modülü (`screens/tv/`):** 15 Ekran  
   Dizi detayları, sezonlar, bölümler, grafik ekranları, yayındaki diziler.
3. **Oyun & Rozet Sistemleri (`screens/game/`):** 13 Ekran  
   Kutu açma simülatörü, rozet kataloğu, seviye ilerleme, başarımlar.
4. **Film Modülü (`screens/movie/`):** 10 Ekran  
   Film detayları, popüler filmler, vizyondakiler, tür sayfaları, sağlayıcılar.
5. **Sohbet & Topluluk (`screens/chat/`):** 6 Ekran  
   Birebir ve grup sohbetleri, mesajlaşma, anketler.
6. **Arama & Keşfet (`screens/search/`):** 6 Ekran  
   Fuzzy medya araması, oyuncu araması, gelişmiş filtreleme.
7. **Kimlik Doğrulama (`screens/auth/`):** 4 Ekran  
   Giriş yap, kayıt ol, şifremi unuttum, e-posta doğrulama.
8. **Kullanıcı Listeleri (`screens/lists/`):** 3 Ekran  
   İzlediklerim, izleyeceklerim, favoriler ve özel listeler.
9. **Giriş / Onboarding (`screens/onboarding/`):** 2 Ekran  
   İlk kurulum, dil seçimi, karşılama slaytları.
10. **Hikaye Paylaşımı (`screens/story/`):** 2 Ekran  
    İçerik kartı oluşturma, taslak kaydetme, görsel üretme.
11. **Diğer Modüller (Turnuva, Takvim, Yıl Özeti, Premium vb.):** 11 Ekran

---

## 🏆 5. En Büyük Ekran ve Bileşenler (TOP 10)

### En Büyük Ekranlar (Kod Satırı Bazında)
1. `screens/chat/ChatScreen.js` — **3,535 satır**
2. `screens/lists/ListsScreen.js` — **2,692 satır**
3. `screens/onboarding/OnboardingScreen.js` — **2,343 satır**
4. `screens/premium/PremiumScreen.js` — **2,201 satır**
5. `screens/story/StoryShareScreen.js` — **2,180 satır**
6. `screens/tv/TvShowsDetails.js` — **2,008 satır**
7. `screens/tabs/ShareContentScreen.js` — **1,991 satır**
8. `screens/StoryShareScreen.js` — **1,860 satır**
9. `screens/tabs/SettingsScreen.js` — **1,742 satır**
10. `screens/movie/MovieDetail.js` — **1,719 satır**

### En Büyük Bileşenler (Kod Satırı Bazında)
1. `components/profile/StatsComponents.js` — **1,487 satır**
2. `components/modals/CreatePostModal.js` — **1,449 satır**
3. `components/modals/ChatModal.js` — **1,403 satır**
4. `components/Comment.js` — **1,314 satır**
5. `components/wrapped/WrappedSlides.js` — **1,241 satır**
6. `components/Skeleton.js` — **1,100 satır**
7. `components/modals/PostCommentSheetModal.js` — **1,035 satır**
8. `components/AICineCards.js` — **902 satır**
9. `components/modals/CaseOpeningModal.js` — **870 satır**
10. `components/chat/GroupInfoModal.js` — **851 satır**

---

## 🛠️ 6. Kullanılan Teknolojiler ve Paketler

* **Mobil Kütüphane:** React Native 0.81.5, Expo 54
* **Navigasyon:** @react-navigation/native & @react-navigation/stack (v7)
* **Veritabanı:** Firebase Firestore & Realtime Database (firebase v11)
* **Abonelik & Gelirlandırma:** RevenueCat (react-native-purchases)
* **Animasyonlar:** lottie-react-native, react-native-reanimated, @shopify/react-native-skia
* **İkonlar & Görseller:** @expo/vector-icons, expo-image, react-native-svg
* **Test Çatısı:** Jest

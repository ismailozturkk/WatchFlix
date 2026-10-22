# 🎬 Seelogd

**Seelogd**, kullanıcıların film ve dizi izleme alışkanlıklarını takip etmelerini, arkadaş edinip sohbet etmelerini, oyunlar ve turnuvalar oynamalarını, yeni içerikler keşfetmelerini ve kişiselleştirilmiş bir sinema deneyimi yaşamalarını sağlayan kapsamlı bir React Native (Expo) mobil uygulamasıdır.

---

## 📊 Proje İstatistikleri

Uygulamanın kapsamlı kaynak kodu analizi sonucunda elde edilen güncel veriler:

| Kategori | Adet | Detaylar |
| :--- | :---: | :--- |
| **Ekranlar (Screens)** | **153** | Film, Dizi, Tabs, Arama, Chat, Oyunlar, Onboarding, Profil ve Auth modülleri |
| **Bileşenler (Components)** | **339** | Yeniden kullanılabilir UI bileşenleri (Modallar, Kartlar, Skeleton, Sheet, Hub vb.) |
| **Context API** | **29** | Modüler global durum yönetimi katmanı |
| **Servisler (Services)** | **136** | Firestore CRUD, TMDB API, RevenueCat, depolama ve iş mantığı servisleri |
| **Custom Hooks** | **50** | Özelleştirilmiş React hook'ları |
| **Yardımcı Araçlar (Utils)** | **176** | Veri formatlama, hesaplama, önbellek, yetki ve yardımcı araçlar |
| **Test Dosyaları** | **331** | Jest birim testleri ve Firestore güvenlik kuralı testleri (~74K satır) |
| **Cloud Functions** | **32** | Firebase Cloud Functions backend dosyaları (~10.7K satır) |
| **Kod Satırı (JS/TS)** | **~367K** | 1.304 JavaScript ve TypeScript dosyasında toplam 367.273 satır |
| **Toplam Kod Satırı (Tüm Proje)** | **~449K** | 1.830 kaynak dosyasında toplam 448.768 satır |
| **Dil Desteği (i18n)** | **5 Dil** | Türkçe (TR), İngilizce (EN), Almanca (DE), İspanyolca (ES), Portekizce (PT) |

---

## 🚀 Öne Çıkan Özellikler

### 🔐 Kullanıcı Yönetimi & Sosyal Ağ
- **Firebase Auth & Google Sign-In**: Güvenli oturum açma, şifre sıfırlama ve hesap yönetimi.
- **Kişiselleştirilebilir Profil**: 56 özel avatar seçeneği, biyografi, rütbe, istatistikler ve gizlilik tercihleri.
- **Sosyal Akış & Arkadaşlık**: Arkadaş ekleme/onaylama, feed paylaşımları, anlık birebir ve grup mesajlaşması, hikaye kartı oluşturma ve paylaşma.

### 🎥 İçerik Keşfi & TMDB Entegrasyonu
- **TMDB API & İki Katmanlı Önbellek**: Güncel vizyon, popüler, trend, Oscar ve Emmy ödüllü yapımlar.
- **CineSwipe**: Tinder tarzı kart kaydırma ile hızlı film ve dizi keşfi.
- **Detaylı Görünüm**: Oyuncu kadrosu, fragmanlar, benzer yapımlar, sağlayıcı platformlar (Netflix, Disney+, Prime vb.).
- **Gelişmiş Arama**: Fuzzy arama, çoklu filtreleme (tür, yıl, platform, yetişkin filtresi).

### 📝 Kişisel Listeler & İzleme Takibi
- **İzleme Listeleri**: Favoriler, İzlenecekler, İzlenen Filmler ve Sezon/Bölüm bazlı İzlenen Diziler.
- **Notlar & Hatırlatıcılar**: İçeriklere özel renkli kişisel notlar, vizyon ve yeni bölüm takvim hatırlatıcıları.
- **Yıllık Hedef & Wrapped**: Kullanıcının izleme hedefleri ve yıl sonu kişisel "Wrapped" özeti.

### 🎮 Oyunlar, Rozetler & Turnuvalar
- **Kutu Açma & Seviye**: Sinema temalı kutu açma simülasyonu, puanlama ve seviye ilerleme.
- **Rozet Kataloğu**: İzleme alışkanlıklarına göre kazanılan onlarca dinamik rozet.
- **Film/Dizi Turnuvaları & Sinema Bingosu**: Kendi eşleşmelerinizi oluşturup şampiyonu seçtiğiniz turnuva modu ve bingo oyunu.

### 💎 Premium & Gelir Modeli
- **RevenueCat Entegrasyonu**: Premium ve Premium Max abonelik paketleri, paywall ekranı ve ayrıcalık yönetimi.

### 🎨 UI/UX Deneyimi
- **Karanlık/Aydınlık Tema & Liquid Glass**: Dinamik tema motoru, Liquid Glass / Blur efektleri, font ve tipografi seçimleri.
- **Akıcı Animasyonlar**: Lottie, React Native Reanimated 4 ve Skia destekli 60fps mikro-etkileşimler.

---

## 🛠 Teknolojik Altyapı

Modern mobil geliştirme ve yüksek performans standartlarına uygun mimari:

- **Çalışma Zamanı**: `React Native 0.86.3` (Expo SDK `~57.0.21`, React `19.2.3`)
- **Navigasyon**: `React Navigation 7` (`@react-navigation/native 7.3.18`, Native Stack, Stack)
- **Backend & Veritabanı**: `Firebase Firestore`, `Firebase Realtime Database`, `Cloud Functions`, `Firebase Auth`
- **Harici Veri Kaynağı**: `The Movie Database (TMDB) API`
- **Abonelik**: `RevenueCat (react-native-purchases 10.6.0)`
- **Yerel Depolama**: `react-native-mmkv 4.3.2` — merkezî anahtar kaydı ve kapsamlı depolama (`services/storage`)
- **Animasyon & Çizim**: `react-native-reanimated 4.5.1`, `lottie-react-native ~7.3.8`, `@shopify/react-native-skia 2.6.2`
- **Test**: `Jest 29`, `@firebase/rules-unit-testing` (331 test dosyası)

### 📂 Klasör Yapısı

```
Seelogd/
├── screens/               # 153 ekran (Movie, TV, Tabs, Chat, Game, Lists, Story, Auth...)
│   ├── tabs/              # Ana tab ekranları ve alt profil/ayarlar menüleri (69 ekran)
│   ├── tv/                # Dizi modülü ve bölüm detayları (15 ekran)
│   ├── game/              # Oyun, rozet ve kutu açma ekranları (16 ekran)
│   ├── movie/             # Film detay, tür ve kategori ekranları (10 ekran)
│   ├── chat/              # Birebir ve grup mesajlaşma ekranları (6 ekran)
│   ├── lists/             # İzleme listeleri ve paylaşılan listeler (3 ekran)
│   ├── search/            # Medya ve oyuncu arama ekranları (4 ekran)
│   ├── onboarding/        # Tanıtım ve kurulum vitrinleri (11 ekran)
│   └── auth/              # Giriş, kayıt ve şifre işlemleri (4 ekran)
├── components/            # 339 yeniden kullanılabilir UI bileşeni
│   ├── modals/            # 15 modül (ChatModal, DatePicker, CreatePost, MediaQuickActions...)
│   ├── profile/           # 25 profil ve istatistik bileşeni
│   ├── chat/              # 29 sohbet balonu ve mesaj bileşeni
│   ├── cineswipe/         # 20 kart kaydırma bileşeni
│   ├── badges/            # 16 rozet ve başarı bileşeni
│   └── wrapped/           # 5 yıllık özet slayt bileşeni
├── services/              # 136 servis (Firestore, TMDB, Storage, RevenueCat, Bildirimler)
├── context/               # 29 Context API sağlayıcısı (Global State)
├── hooks/                 # 50 özel React hook'u
├── utils/                 # 176 yardımcı fonksiyon ve matematik/tarih araçları
├── translations/          # 5 dilde (TR, EN, DE, ES, PT) i18n JSON dosyaları ve yapılandırma
├── functions/             # 32 dosya Firebase Cloud Functions backend kodu
├── theme/                 # Tema renkleri, stiller ve tipografi tanımları
├── native/ & targets/     # iOS WidgetKit hedefleri ve yerel modüller
├── website/               # Tanıtım web sitesi ve yasal metinler
├── docs/                  # Kapsamlı mimari, kurulum ve özellik dokümantasyonu
└── __tests__/             # 331 Jest birim, kural ve entegrasyon testi
```

---

## 🚦 Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin:

1. **Bağımlılıkları Yükleyin:**

   ```bash
   npm install
   ```

2. **Uygulamayı Başlatın:**

   ```bash
   npx expo start
   ```

3. **Cihazda Çalıştırın:**
   - **Expo Go** uygulaması ile QR kodu taratın (Android/iOS).
   - Veya emülatör seçeneklerini kullanın (`a` for Android, `i` for iOS).

4. **Testleri Çalıştırmak İçin:**

   ```bash
   npm test
   ```

---

## 📚 Dokümantasyon

Projenin kapsamlı mimari ve teknik dokümanları `docs/` klasöründe yer almaktadır:

- **Genel Mimari**: `docs/mimari/UYGULAMA_BILGISI_VE_MIMARISI.md`
- **Dosya Hiyerarşisi**: `docs/mimari/PROJE_DOSYA_YAPISI.txt`
- **Analiz Raporu**: `docs/mimari/PROJE_ANALIZ_RAPORU.txt`
- **Veritabanı Şeması**: `docs/mimari/FIRESTORE_DATABASE_SCHEMA.md`
- **Yayın & Gelir Yol Haritası**: `docs/planlama/YAYIN_VE_GELIR_YOL_HARITASI.md`
- **Memory Bank**: `docs/memory-bank/`

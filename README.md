# 🎬 Watch Flix

**Watch Flix**, kullanıcıların film ve dizi izleme alışkanlıklarını takip etmelerini, yeni içerikler keşfetmelerini ve kişiselleştirilmiş bir deneyim yaşamalarını sağleyen kapsamlı bir React Native (Expo) uygulamasıdır.

---

## 📊 Proje İstatistikleri

Uygulamanın kapsamlı bir analizi sonucunda elde edilen veriler:

| Kategori        | Adet       | Detaylar                                                          |
| --------------- | ---------- | ----------------------------------------------------------------- |
| **Ekranlar**    | **54**     | Film, Dizi, Arama, Profil ve Auth ekranları dahil                 |
| **Bileşenler**  | **15+**    | Yeniden kullanılabilir UI elementleri (Card, Modal, Skeleton vb.) |
| **Context API** | **9**      | Eyalet (State) yönetimi için modüler yapı                         |
| **Servisler**   | **3**      | Firebase, TMDB ve Yerel Depolama entegrasyonları                  |
| **Kod Satırı**  | **~35.5K** | Toplam kaynak kodu satır sayısı (JS & JSON)                       |
| **Dil Desteği** | **2**      | Türkçe (TR) ve İngilizce (EN)                                     |

---

## 🚀 Öne Çıkan Özellikler

### 🔐 Kullanıcı Yönetimi

- **Firebase Auth** ile güvenli giriş/kayıt işlemleri.
- **Kişiselleştirilebilir Profil**: Avatar, kullanıcı adı ve biyografi düzenleme.

### 🎥 İçerik Keşfi

- **TMDB Entegrasyonu**: Güncel film ve dizi veritabanı.
- **Kategoriler**: Trendler, Popüler, Yakında Vizyona Girecekler, Şimdi Vizyonda.
- **Detaylı Görünüm**: Oyuncular, fragmanlar, benzer yapımlar ve platform bilgileri.

### 📝 Kişisel Listeler & Takip

- **İzleme Listeleri**: Favoriler, İzlenecekler, İzlenenler.
- **Notlar Sistemi**: Filmler ve diziler için kişisel notlar alma.
- **İstatistikler**: İzleme geçmişine dayalı detaylı kullanıcı istatistikleri ve rütbe sistemi.

### 🤖 Akıllı Özellikler (Geliştirme Aşamasında)

- **Gemini AI**: Kullanıcı zevklerine göre yapay zeka tabanlı film önerileri.
- **Hatırlatıcılar**: Beklenen yapımlar için bildirim sistemi.

### 🎨 UI/UX Deneyimi

- **Karanlık/Aydınlık Mod**: Tema desteği.
- **Animasyonlar**: Lottie ve Reanimated ile zenginleştirilmiş akıcı geçişler.
- **Skeleton Loading**: Yükleme anlarında şık placeholders.

---

## 🛠 Teknolojik Altyapı

Bu proje modern mobil geliştirme standartlarına uygun olarak inşa edilmiştir:

- **Framework**: `React Native (Expo SDK ~54)`
- **Dil**: `JavaScript (ES6+)`
- **Backend**: `Firebase (Firestore, Auth)`
- **Veri Kaynağı**: `The Movie Database (TMDB) API`
- **Depolama**: `AsyncStorage` (Yerel ayarlar için)
- **Animasyon**: `Lottie`, `React Native Reanimated`
- **Navigasyon**: `React Navigation 7`

### 📂 Klasör Yapısı

```
WhatchFlix/
├── screens/          # 54+ uygulama ekranı (Movie, TV, Auth, Tabs...)
├── components/       # Tekrar kullanılabilir UI bileşenleri
├── context/          # 9 adet Context API modülü (State Management)
├── memory-bank/      # Proje dokümantasyonu ve hafıza bankası
├── modules/          # Özel modüller ve yardımcı fonksiyonlar
├── translations/     # Çoklu dil dosyaları (JSON)
├── theme/            # Tema yapılandırmaları
└── firebase.js       # Firebase yapılandırması
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

---

## 📚 Dokümantasyon (Memory Bank)

Proje, detaylı bir "Memory Bank" yapısına sahiptir. Geliştirme sürecine katkıda bulunmadan önce `/memory-bank` klasörünü incelemeniz önerilir:

- `projectbrief.md`: genel vizyon.
- `activeContext.md`: aktif görevler ve mimari notlar.
- `techContext.md`: teknoloji yığını detayları.

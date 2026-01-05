# System Design Patterns

Bu doküman, Watch Flix uygulamasında kullanılan ve hedeflenen temel yazılım tasarım desenlerini açıklar.

## Mevcut Desenler

### Modüler Context API

- **Açıklama:** `LanguageContext`, `ThemeContext`, `AuthContext` gibi her biri tek bir sorumluluğa odaklanmış context'ler kullanılır. Bu, uygulamanın farklı bölümlerinin (dil, tema, kimlik doğrulama) birbirinden bağımsız yönetilmesini sağlar.
- **Avantaj:** Kodun okunabilirliği ve bakım kolaylığı yüksektir.

## Hedeflenen ve İyileştirilecek Desenler

### 1. Custom Hooks ile Özellik Odaklı State Yönetimi

- **Problem:** `MovieContex.js` gibi tek bir context dosyasının birden çok ilgisiz state'i (Trendler, En İyiler, Oscar'lılar vb.) yönetmesi, "God Object" anti-desenine yol açar. Bu durum, bir state güncellendiğinde ilgili olmayan tüm bileşenlerin de yeniden render olmasına neden olarak performans sorunları yaratır.
- **Çözüm:** `MovieContex.js` kaldırılacak ve her bir özellik (örn: trend filmler, popüler filmler) kendi verisini, yüklenme durumunu ve hata yönetimini içeren `useTrendingMovies`, `usePopularMovies` gibi custom hook'lar aracılığıyla yönetilecektir.
- **Fayda:** Bileşenler yalnızca ihtiyaç duydukları veriyi çeker ve yalnızca o veri değiştiğinde yeniden render olur. Bu, performansı artırır ve kodun sorumluluklarını net bir şekilde ayırır.

### 2. Merkezi API Servis Katmanı

- **Problem:** API istekleri (özellikle `axios` kullanımı) farklı context ve bileşenlere dağılmış durumda. Bu, `API_KEY` yönetimi, `baseURL`, hata yakalama ve header'ların tekrar tekrar yazılmasına neden olur.
- **Çözüm:** `services/tmdb.js` gibi merkezi bir API servis dosyası oluşturulacaktır. Bu dosya, `axios.create()` ile ortak bir `instance` yaratarak `baseURL`, `Authorization` header'ı gibi ayarları tek bir yerden yönetecek.
- **Fayda:** Kod tekrarını önler, API ile ilgili tüm mantığı tek bir yerde toplayarak bakımı kolaylaştırır ve hata yönetimini standartlaştırır.

### 3. Offline-First Cache Stratejisi

- **Problem:** Uygulama şu anda tamamen internet bağlantısına bağımlı. Veriler her açılışta yeniden çekiliyor.
- **Çözüm:** API'den gelen verilerin (film listeleri, detaylar vb.) `AsyncStorage` veya daha gelişmiş bir çözüm (örn: WatermelonDB, MMKV) kullanılarak lokalde cache'lenmesi hedeflenmektedir. API istekleri önce cache'i kontrol edecek, veri yoksa veya süresi dolmuşsa ağ isteği yapacaktır.
- **Fayda:** Çevrimdışı kullanım imkanı sunar, uygulama açılış hızını artırır ve API kullanımını azaltır.

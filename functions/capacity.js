// Fonksiyon başına instance tavanları — her export bunlardan birini AÇIKÇA seçer
// (capacity.test.js bekçisi). setGlobalOptions'taki 10 yalnız unutulana karşı yedektir.
//
// Ölçülen canlı yapılandırma (31 Eki 2026, Cloud Functions v2 API, salt-okunur): gen2
// servisleri 1 vCPU + eşzamanlılık 80. Yani gerçek tavan instance × 80 eşzamanlı istek
// (10 instance ≈ 800). Tavan bu yüzden throughput'tan çok MALİYET ve UPSTREAM KOTA frenidir:
// kötüye kullanım ya da hata döngüsü en fazla bu kadar instance'ı ısıtabilir.
//
// ASIL TAVAN BÖLGE KOTASI (1 Kas 2026'da ölçüldü): Cloud Run "Total CPU allocation" = 20.000 mili-vCPU
// / proje / bölge → us-central1'deki TÜM fonksiyonlar birlikte en fazla 20 instance (her biri 1 vCPU)
// çalıştırabilir; europe-west1 (tetikleyiciler) ayrı kota. Tek fonksiyona 20 vermek bölgenin tamamını
// ona açar ve diğerlerini (AI, ödeme webhook'u) aç bırakabilir → hiçbir sınıf 10'u geçmez. Daha fazlası
// gerekirse önce Cloud Console'dan kota artışı. Toplu deploy da her servise bir sıcak instance açtığı
// için bu kotayı doldurabilir ("Quota exceeded for total allowable CPU"); ~15 dk sonra tekrar denenir.
//
// Not: bellek içi hız sınırlayıcılar (createRateLimiter) instance başınadır; tavan büyüdükçe
// kullanıcı başına gerçek sınır en kötü durumda tavan × limit olur. Kalıcı sınırlar
// (aiQuota gibi) Firestore'da tutulduğu için etkilenmez.
const CAPACITY = Object.freeze({
  // Yalnız Firestore okuyup yazan, oturum isteyen ucuz callable'lar. 10 × 80 eşzamanlılık =
  // 800 eşzamanlı istek; bölge kotası (20 vCPU, yukarıda) yüzünden daha yükseği kazanç değil risk.
  light: Object.freeze({ maxInstances: 10 }),
  // Kotalı üçüncü taraf çağıran uçlar (Gemini, OMDb, RevenueCat, Apple). Asıl sınır
  // karşı tarafın kotası; tavanı büyütmek yalnız 429'u ve faturayı büyütür.
  upstream: Object.freeze({ maxInstances: 10 }),
  // Firestore/Auth tetikleyicileri. Instance yetmezse olay kuyrukta bekler (Pub/Sub
  // teslimi geri çekilerek yeniden dener, saklama süresi boyunca); yük patlamasında
  // gecikme artar, olay hemen düşmez.
  trigger: Object.freeze({ maxInstances: 10 }),
  // Zamanlanmış toplu işler: aynı anda iki koşum aynı belgeleri yarıştırmasın.
  singleton: Object.freeze({ maxInstances: 1 }),
});

module.exports = { CAPACITY };

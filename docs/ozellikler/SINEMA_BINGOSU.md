# Sinema Bingosu

**Eğlence → BINGO → Sinema Bingosu.** 3×3 kart ayın ilk günü yenilenir. Herkese aynı ayda aynı kart gelir; izleme kayıtları kareleri otomatik işaretler. Satır, sütun veya köşegen tamamlandığında çizgi oluşur. Kartın üstünde, her pazartesi sıfırlanan üç küçük hedef bulunur:

1. Bir film veya dizi bölümü izle.
2. Toplam iki film/bölüm izle.
3. İki ayrı günde izle.

Film ve bölüm aynı değerdedir. Haftalık hedefler cihazdaki izleme geçmişinden hesaplanır; ayrı bir işaretleme veya sunucu kaydı yoktur. Haftalık hedeflerin amacı az izleyen kullanıcının da ilerleme görmesidir; aylık kartın çizgi serisine dahil edilmezler.

Aylık kartın orta sütunu da erişilebilir tutulur: ay içinde iki izleme iki ayrı güne yayılırsa ilk çizgi tamamlanır. Diğer kareler tür, film, bölüm ve özel izleme koşullarıyla çeşitlenir.

## Veri ve süreler

- Ay kimliği yerel takvimde `YYYY-AA-01`, hafta kimliği pazartesi gününün `YYYY-AA-GG` tarihidir. Ayın son günü gerçek ay uzunluğuna göre bulunur; Şubat ve yıl geçişi dahil.
- Kart ve kare değerlendirmesi `utils/cinemaBingo.js` içinde saf fonksiyonlardır. Film ve dizi verisi mevcut `ProfileStatsContext` üzerinden gelir; yeni Firestore dinleyicisi açılmaz.
- Aylık çizgiler, tam kartlar ve görülen kutlamalar kullanıcı kapsamlı `Keys.cinemaBingoMonthly` altında cihazda saklanır. Eski haftalık `Keys.cinemaBingo` kayıtları korunur ve aylık seriye karışmaz.
- Kayıtlı aylık çizgi ve kare sayısı yalnız yükselir. Bir izleme sonradan silinse de daha önce kazanılan çizgi veya kutlama geri alınmaz. Son 26 dönem tutulur.
- Aylık seri, ardışık aylarda en az bir çizgiyle ilerler. İçinde bulunulan ayda henüz çizgi yoksa geçen aydan gelen seri korunur.
- Kareler yalnız kayıtlı veriden doğrulanabilen koşulları kullanır: izleme günü, tür, film süresi ve dizi kimliği. Süresi bilinmeyen film kısa veya uzun film karesini doldurmaz.
- Kartta en çok iki tür karesi bulunur; bölüm sayısı hedefi en çok beştir. Böylece rastgele kart nadir türler veya yoğun bölüm izleme etrafında sıkışmaz.

## Arayüz ve metin

`components/hub/BingoWidget.js` aylık kartın özetini ve haftalık `n/3` ilerlemesini gösterir. `screens/bingo/CinemaBingoScreen.js` üç haftalık hedefi, aylık kartı, çizgileri ve kare ayrıntılarını gösterir. Metinler `utils/cinemaBingoCopy.js` içinde Türkçe, İngilizce, İspanyolca, Portekizce ve Almanca tutulur. Ay aralığı, ay sonuna kalan gün, paylaşım metni ve ay serisi aynı dönemi anlatır.

## Doğrulama

`__tests__/cinemaBingo.test.js` ay/hafta sınırlarını, üç haftalık hedefi ve kart değerlendirmesini; `__tests__/cinemaBingoScreen.test.js` gerçek depoyla kart/sayfa akışını sınar. Cihazda dar ekran yerleşimi ve gerçek yazı tipiyle metin sarılması ayrıca kontrol edilmelidir.

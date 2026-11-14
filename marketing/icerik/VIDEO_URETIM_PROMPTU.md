# Video üretim prompt'u

Son güncelleme: **3 Kasım 2026**

Yeni bir seelogd tanıtım videosu istendiğinde önce bu dosya okunur, aşağıdaki prompt uygulanır. Özellik ve plan bilgisi [VIDEO_BILGI_DOSYASI.md](VIDEO_BILGI_DOSYASI.md)'nden gelir. İki dosya çelişirse hikâye ve hareket için bu dosya, doğruluk ve plan bilgisi için o dosya geçerlidir.

## Prompt

```text
seelogd için en fazla 60 saniyelik, dikey (1080x1920, 30 fps), İngilizce, seslendirmeli ve müzikli bir tanıtım videosu üret.

HEDEF
İzleyici özelliği değil faydayı anlasın ve siteye gidip beta'ya katılsın.
Ana mesaj: "Film ve diziyi arkadaşlarınla birlikte yaşadığın yer."

HİKÂYE
Özellikleri tek tek sayma; uygulamadaki alanlara göre birleştir ve zaman kazan:
Arkadaşlar (ekle, uyum, sohbet, grup, Film Kulübü), Fun tab (CineSwipe, oyunlar, lig, turnuva,
Top 100, paylaşım), Keşif ve kayıt (keşif, istatistik, liste, hatırlatıcı), Kişiselleştirme
(tema, rozet, Wrapped). Ekranda bölüm adı ve dört parçalı ilerleme çubuğu durur.
Sıra: kanca (4 sn), arkadaşlar, Fun tab, keşif ve kayıt, kişiselleştirme, çağrı (6 sn).

SES ÖNCE GELİR
1. Seslendirme metnini yaz, satır satır üret, her satırın süresini ölç.
2. Kurguyu bu sürelere göre kur. Görsel sese uyar, ses görsele uymaz.
3. Müziği sonra koy; seslendirme sırasında 8-10 dB alçalsın.
4. Efekt katmanı ekle: dokunma, kart gelişi, geçiş, sayaç tıkı, onay sesi, logo vuruşu.
   Her efekt görseldeki olayla aynı karede başlar.
5. Son karışım: yaklaşık -14 LUFS, tepe -1 dBTP altı. Sesi kapalı izleyen için altyazı şart.

TEK ZAMAN ÇİZELGESİ
Sahneler, seslendirme, altyazı, efekt ve müzik vuruşları tek bir cues.js dosyasından okunur.
HTML ve ses üretimi aynı dosyayı kullanır. Elle ayrı ayrı zaman yazma.

GÖRSEL DİL
- Marka gradyanı ana renk (turkuaz, mavi, mor); sahne başına tek vurgu rengi.
  Gökkuşağı ve her sahnede farklı parlak zemin yok.
- Arayüz HER ZAMAN uygulamanın gerçek ekran görüntüsü veya kaydıdır. Arayüz çizme (kullanıcı kararı, 3 Kas).
- Temel hareket "lift": telefonda gerçek ekran görünür; seslendirme bir alandan bahsettiği anda
  o alan aynı görüntüden kesilir, telefondaki yerinden büyüyerek öne çıkar, ekran kararır.
  Metinler 1 saniyede okunacak kadar büyük olsun.
- Düğme ve satırlar kelimeyle tek tek çıkar: "vote, watch, discuss", "reviews, lists, polls".
- Kaydırma ekran kaydıyla değil, birleştirilmiş uzun ekranın kodla kaydırılmasıyla yapılır.
- Kaynakta kesik duran kenarlar kırpılır. Gerçek afişler nedeniyle video yalnız organik paylaşım içindir.

HAREKET
- Yeni ekran yandan itilerek gelir, eskisi altında kalır; telefon hiç boş görünmez.
- Dokunma halkası gerçek bir kullanımı gösterir.
- Tüm eğriler yumuşak yay; 12-18 kare; öğeler 2-3 kare arayla sırayla gelir.
- Beklerken de hafif hareket sürer. Metin sahneden çıkmadan en az 1,5 sn okunur.
- Sahne başına tek başlık, en fazla 6 kelime. Altyazı başlıkla çakışmaz.
- Altyazı: seslendirmeyle kelime kelime, tek hap içinde, vurgu kelimesi renkli.

DOĞRULUK
- Görünen her arayüz parçası uygulamadan gelir; video için değiştirilmez, yalnız kırpılır.
- Örnek veriye "Sample account" yazılır; kullanıcı sayısı veya başarı iddiası olmaz.
- Premium özelliklerde görünür "Premium" etiketi vardır. "Join the beta" kullanılır, "Out now" değil.
- Marka küçük harfle yazılır: seelogd. Parola, e-posta, gerçek kullanıcı verisi görünmez.

KALİTE KAPISI (render öncesi ve sonrası)
- Her 0,5 sn için kare sayfası incelenir: kesik, taşma, üst üste binme, boş kare yok.
- window.audit ile kadraj denetimi; alt 300 ve üst 150 piksele önemli içerik girmez.
- Ses: LUFS, tepe, seslendirme ve efekt zaman uyumu ölçülür.
- Dinlenemeyen ve oynatılarak izlenemeyen kısım varsa açıkça söylenir; "doğrulandı" denmez.
- Paylaşım yok, commit yok; kullanıcı onayı gerekir.
```

## Üretim adımları (05 ile doğrulandı)

Araçlar: Kokoro (`kokoro-onnx`, model `kokoro-v1.0.onnx` + `voices-v1.0.bin`), numpy, puppeteer-core, ffmpeg.

Güncel örnek 06. Metin `v6/lines.json`, gerçek görüntüler `v6/a/`, kurgu `tanitim-en-06.html`.

1. `python ses-05.py <model klasörü> v6` → `vo.wav`, `cues.js`
2. `node render.cjs --v6 --sfx v6/sfx.json` → efekt zamanları sayfadan çıkar
3. `python mix-05.py v6 .48 1.75` → `mix-final.wav`
4. `node render.cjs --v6` → video

iPhone görselleri geldiğinde `v6/a/` dosyaları ve kurgudaki kırpma ölçüleri değişir; metin ve zamanlama aynı kalır.

## Eski seslendirme metni (05)

Güncel metin `v6/lines.json` dosyasındadır.

Marka okunuşu "see logged" olarak varsayıldı; kullanıcı onaylamadı. Premium özellikler ekranda etiketlenir.

| Bölüm | Süre | Metin | Ekranda |
|---|---|---|---|
| Kanca | 0-3 | Your next favorite movie is already on a friend's list. | Arkadaş kartından çıkan tek afiş |
| Sorun | 3-9 | But recommendations get lost in group chats, and nobody remembers what you've seen. | Kayıp mesaj balonları dağılır |
| Geliş | 9-13 | Meet seelogd. Movies, shows, and the people you watch with. | Balonlar toplanıp simgeye, simge telefona dönüşür |
| Kullanım | 13-20 | See how close your tastes are. Send a movie right into the chat. | Uyum halkası, sohbette film kartı |
| Kullanım | 20-27 | Start a group, then run a film club: vote, watch, discuss. | Grup, üç adımlı yol (Premium etiketi) |
| Kullanım | 27-33 | Can't decide? Swipe together until you match. Then play. | Kart kaydırma, eşleşme, oyun kartı (Premium etiketi) |
| Kanıt | 33-39 | Everything you watch becomes your stats, your badges, your year, wrapped. | Sayaç grafiğe, grafik rozete, rozet Wrapped'a dönüşür |
| Çağrı | 39-45 | seelogd. Join the beta at seelogd dot com. | Logo, çağrı, adres |

## İncelenen örnekler

Yalnız yöntem için incelendi. Görselleri, müzikleri ve metinleri kopyalanmaz. Reels'lerin sesi dinlenemedi; ses notları ekrandaki altyazıdan çıkarımdır.

| Reels | Süre | Alınan ders |
|---|---|---|
| [ultra.skills](https://www.instagram.com/reel/DfII6u2Nl_p/) | 45,9 sn | Koyu zemin ve tek neon renk; kelime kelime altyazı; kod ile kurulmuş arayüz panelleri; efektin görsele tam oturması |
| [riki.bosso](https://www.instagram.com/reel/Demn6YNo1JF/) | 22 sn | Uygulamanın kendi renk ve arayüzü; tek güçlü an (seri alevi, sayı); kısa cümleler; temiz logo kapanışı |
| [sultanmotions](https://www.instagram.com/reel/DcLzGYovY9B/) | 44,5 sn | Giriş, sorun, kullanım, çağrı yapısı; telefon etrafında yüzen kartlar; somut kullanım anları |
| [motionloved](https://www.instagram.com/reel/DeKUZvGsiDk/) | 14,5 sn | Tek renk sistemi; büyük yazı; sayı ve grafik dönüşümleri; ekrandaki tek nesnenin dönüşmesi |

## 04'e göre değişenler

| 04 | 05 |
|---|---|
| 92 sn, 17 özellik | 45 sn, sorun ve çözüm hikâyesi |
| Sahneler vuruşa bağlı | Sahneler seslendirmeye bağlı |
| Her sahnede farklı parlak renk | Marka rengi ve sahne başına tek vurgu |
| Küçük telefonda ekran görüntüsü | Büyük, temiz arayüz bileşenleri |
| Kelime perdesiyle geçiş | Bir öğenin diğerine dönüşmesi |
| Yalnız müzik ve vuruş | Seslendirme, müzik, efekt, altyazı |
| Telifli afişler, yalnız organik | Özgün afişler, reklama da uygun |

# Yeni logo (3 Kas 2026)

Mevcut simgeden (3B "S") bağımsız logo çalışması. Üç konsept çizildi, kullanıcı **Lens**'i seçti ve geliştirildi. **4 Kas 2026'dan beri uygulamanın varsayılan simgesi Lens** (eski "S" artık "Klasik" alternatifi) ve açılış ekranı yıldız animasyonunun uygulama sürümünü oynatıyor (`components/SplashLensIntro.js`). Simge seti 5 Kas'tan beri üç Lens (Varsayılan, 3B, Cam) + üç S (Klasik, Cam, Düz). Site 5 Kas'ta Lens'e geçti (logo, favicon, paylaşım görseli, vurgu gradyanı). Mağaza görselleri ve sosyal hesaplar henüz eski simgede.

## Lens

Fikir: 3D sinema gözlüğünün iki camı üst üste biner, kesiştikleri yerde bir göz açılır ("see"). Göz bebeğindeki küçük parıltı işarete canlılık verir.

Önce `lens/marka-sayfasi.png` dosyasını aç: renkler, ölçüler, düzenler, simgeler ve yasaklar orada. Denenen 12 varyasyon `lens/varyasyonlar.png` içinde. Seçilen: daha geniş göz, büyük bebek ve parıltı.

| Öğe | Değer |
|---|---|
| Mürekkep | `#0D0E13` |
| Kâğıt | `#F5F2EB` |
| Camgöbeği | `#14C8E8` |
| Kırmızı | `#FF3D5E` |
| Yazı | Sora SemiBold, küçük harf `seelogd`, harf aralığı -0,025 em |
| Ölçüler (512 birim) | Daire r = 132, merkezler arası d = 120, bebek 40, parıltı 9,6 |
| Boşluk | İşaretin çevresinde en az r/2 |
| En küçük | İşaret 16 px, yatay logo 96 px; 32 px ve altında parıltısız sürüm |

### Dosyalar

| Klasör | İçerik |
|---|---|
| `lens/svg/`, `lens/png/` | İşaret, parıltısız küçük işaret, tek renk (beyaz/siyah), yatay ve dikey logo, yalnız yazı; açık ve koyu zemin için |
| `lens/simge/ios/` | `ios-1024.png` (saydamlık yok, App Store'a uygun), koyu mod (saydam zemin), renkli ton (tek renk) |
| `lens/simge/android/` | Uyarlanabilir simge ön plan ve arka plan (432 px, işaret güvenli çemberin içinde), temalı simge için tek renk, Play Store 512 |
| `lens/simge/favicon/` | 16, 32, 48 (yuvarlak köşeli), 180, 192, 512 ve `favicon.ico` (16/32/48) |
| `lens/sosyal/` | Profil fotoğrafı 1080 (koyu ve açık, yuvarlak kırpmaya uygun), X kapağı 1500×500 |
| `lens/animasyon/` | İki logo animasyonu, ikisi de kare 1080 ve dikey 1080×1920 |

**Yıldız animasyonu** (`seelogd-logo-yildiz-*`, 6,4 sn, ana sürüm):
- Uzayda iki parlak yıldız (camgöbeği ve kırmızı) birbirinin çevresinde dönerek yaklaşır. Yaklaştıkça hızlanır ve büyürler, arkalarında ışık izi kalır.
- Çarpıştıklarında bir parlama, üç şok halkası ve kıvılcımlar çıkar. Dönüş yavaşlar ve iki daire dikey konumda göze oturur.
- Göz bebeği belirir, bir yana bakar, göz bir kez kırpar ve işaretin üstünden bir ışık geçer.
- Son olarak `seelogd` yazısı harf harf yükselir.

Ses kodla üretildi, hazır müzik kullanılmadı: dönüşle hızlanan ve sağa sola gezen uğultu, çarpışmada bas vuruşu ve parıltı, göz bebeğinde kısa bir ses, harf tıkları, kapanış akoru. Ölçülen ses seviyesi -15,1 LUFS, tepe -1,4 dB. Platform müziği kullanılacaksa `-sessiz` sürümünü seç.

**Sade animasyon** (`seelogd-logo-sade-*`, 4,2 sn, sessiz): İki daire ekrana girer, birleşir ve gözü açar. Göz kırpar, ardından yazı yükselir.

## Açık noktalar

- **Benzerlik ve marka taraması yapılmadı.** İki daireden göz yapan işaretler var mı, kullanmadan önce bakılmalı.
- **Uygulamaya uygulandı (4 Kas), dışarısı bekliyor.** `assets/icon_default` Lens (üretici `scripts/generate-app-icons.py default`), eski "S" `assets/icon_classic`. Yeni native build şart, cihazda görülmedi. Hâlâ eski simgede: mağaza görselleri, sosyal profiller ve `marka/MARKA_REHBERI.md` (renkler ve yazı tipi). Site 5 Kas'ta güncellendi (`website/README.md`).
- **X kapağında logo ortada.** X'te profil fotoğrafı kapağın sol altını örtüyor, logo bu yüzden ortaya yerleştirildi. Yayından önce telefonda nasıl göründüğüne bakılmalı.
- **Yıldız animasyonunun sesi dinlenmedi.** Claude sesi duyamıyor; yalnızca ses seviyesi ve zamanlaması ölçüldü.

## Diğer iki konsept

`png/pano.png`: Gördüm (göz + onay işareti) ve İmge (yer imi + oynat). Seçilmedi, karşılaştırma için duruyor.

## Yeniden üretmek

`kaynak/` klasöründeki dosyalar için `opentype.js` ve `puppeteer-core` gerekir.

| Dosya | Ne üretir |
|---|---|
| `lens.cjs <çıkış>` | Bütün logo seti |
| `anim2.cjs <çıkış> <ffmpeg>` | Yıldız animasyonu (sessiz) ve `theta.json` |
| `ses-logo.py <theta.json> <wav>` | Yıldız animasyonunun sesi; videoya ffmpeg ile `volume=-1.6dB` uygulanarak eklendi |
| `anim.cjs <çıkış> <ffmpeg>` | Sade animasyon |
| `sheet.cjs <lens klasörü>` | Marka sayfası |
| `explore.cjs` | Varyasyon panosu |
| `build.cjs` | İlk üç konsept |

- **Yazı tipi:** Sora, SIL Open Font License 1.1 (`kaynak/font/OFL.txt`).
- **iOS simgesi:** `lens.cjs` çıktısındaki `ios-1024.png` saydamlık içerir. Yayına vermeden önce ffmpeg ile `-pix_fmt rgb24` uygulanmalı. Klasördeki dosyaya bu yapıldı.

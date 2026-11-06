# Titreşim (Haptics) Analizi ve Uygulaması — 6 Kasım 2026

## 1. Başlangıç durumu

- **Ayar:** Ayarlar › Görünüm kartında tek bir aç/kapa (`Keys.haptics`, varsayılan KAPALI).
- **Politika (15 Eki, "titreşim az olsun"):** `services/hapticsService.js` içinde merkezi.
  `selectionAsync` ve Light/Soft darbeler **sessiz**; yalnız Medium+ darbe, başarı, uyarı ve hata titreşiyordu. Art arda 300 ms içindeki her şey düşüyordu.
- **Çağrı yerleri:** ~100 dosyada ~230 çağrı; çoğu `selectionAsync()` olduğu için **fiilen sessizdi**. Anlam taşımayan eski çağrılar (`impactAsync(Light)`) sohbet, beğeni, oy verme gibi yerlerde hiç hissedilmiyordu.
- **Sorunlar:**
  1. Kullanıcı ne zaman/ne kadar titreşeceğini seçemiyordu (tek anahtar).
  2. Tüm deneyim tek darbeden ibaretti: doğru cevap, rozet, mesaj, beğeni aynı "tık".
  3. Android'de cihaz efekti bulunamazsa her şey (seçim dahil) expo'nun 30–70/255 genlikli `Vibrator` dalga formuna düşüyordu — 15 Eki'deki "zırlama"nın kaynağı.
  4. Oyunlarda süre doldu/kaybetme, sohbette gelen mesaj, kopyalama, sürükle-bırak, kaydırma eşiği gibi anlarda hiç titreşim yoktu.

## 2. Platform analizi

### iOS (expo-haptics 57 → UIKit)

| Üreteç | Kullanım | Not |
|---|---|---|
| `UISelectionFeedbackGenerator` | seçim tiki | en ince his; çok sık çalınabilir |
| `UIImpactFeedbackGenerator` light / soft / medium / rigid / heavy | darbeler | **genlik (`intensity`) parametresi expo'da yok** → güç, stil kaydırılarak verilir |
| `UINotificationFeedbackGenerator` success / warning / error | sonuçlar | sistem tarafından çok vuruşlu desen |

- Sistem `UISwitch` kendi titreşimini verir → iOS'ta anahtarlara ek titreşim **eklenmedi**.
- Ayarlar › Ses ve Dokunuş › **Sistem Haptikleri** kapalıysa hiçbiri hissedilmez (ekranda not var).
- Çok vuruşlu desenler JS zamanlayıcısıyla (50–330 ms aralıklar) dizilir; UIKit üreteçleri bu sıklığı rahat taşır.

### Android

| Yol | Davranış |
|---|---|
| `View.performHapticFeedback` (expo `performAndroidHapticsAsync`) | cihazın **ayarlı** efektleri; sistemin "Dokunma geri bildirimi" ayarına uyar |
| expo `impactAsync/notificationAsync` | `Vibrator` dalga formu, düşük genlik (30–70/255) — zayıf/vızıltılı |
| RN `Vibration.vibrate([..])` | varsayılan (tam) genlik, native zamanlama; dokunma ayarından bağımsız |

Sabitlerin Android 12+ karşılıkları (hafiften ağıra):

| Sabit | Efekt | API |
|---|---|---|
| `clock-tick`, `segment-frequent-tick` | TEXTURE_TICK (en ince) | hep / 34+ |
| `context-click`, `gesture-end` | EFFECT_TICK | hep / 30+ |
| `virtual-key`, `keyboard-tap` | EFFECT_CLICK | hep |
| `long-press`, `drag-start` | EFFECT_HEAVY_CLICK | hep / 34+ |
| `confirm` / `reject` | onay / çift vuruş | 30+ |
| `toggle-on/off`, `segment-tick` | anahtar / tik | 34+ |

**Kararlar:** her atom bir **zincir** taşır (örn. `segment-tick → clock-tick`); sabit yoksa sonrakine geçilir ve "desteklenmiyor" bilgisi önbelleğe alınır. Hafif atomlar (tik/dokunuş) zincir biterse **sessiz** kalır, asla `Vibrator`'a düşmez. "Güçlü" kademesi desenin tamamını tek `Vibration.vibrate` dalga formuna çevirir.

## 3. Yeni tasarım

### Üç ayar ekseni (Ayarlar › Görünüm › Titreşim)

| Eksen | Seçenekler | Varsayılan |
|---|---|---|
| **Ne zaman** (düzey) | Az · Dengeli · Bol | Dengeli |
| **Güç** | Hafif · Normal · Güçlü | Normal |
| **Nerede** (kategori) | Gezinme ve seçim · Hareketler · İşlem sonuçları · Oyunlar · Sohbet ve sosyal · Kutlamalar | hepsi açık |

- **Az** = 15 Eki politikasının birebir aynısı (geri dönüş yolu).
- **Dengeli** seçim tiklerini, sekme/çip/anahtar/sürüklemeyi ve sosyal desenleri ekler.
- **Bol** ayrıca hafif dokunuşları ve sayfa açılışlarını ekler.
- Ekranda her seçim **anında önizlenir**; "Desen kitaplığı" 25 örnek deseni dokunarak denetir; kategori satırına dokunmak o alanın desenini çalar. Platforma özel not (iOS Sistem Haptikleri / Android Dokunma geri bildirimi) ve "Varsayılana dön" var.
- Ana ekrandaki satır artık alt sayfaya gider; sağdaki anahtar hızlı aç/kapa olarak kaldı, alt yazı "Dengeli · Normal" gibi durumu gösterir.

### Çakışma kuralı

Her desenin önceliği (1 tik … 5 kutlama) ve bekleme süresi var. Son desenin penceresinde gelen **eşit/düşük** öncelikli istek düşer; **daha yüksek** öncelikli istek öncekinin kalan adımlarını iptal edip çalar. Sonuç: bir işleyici "basıldı + kaydedildi" derse tek vuruş; kaydırıcı/sürüklemede tikler 30–45 ms arayla akar; kutlama sırasında sıradan dokunuş onu bölmez.

## 4. Desen kataloğu (`utils/hapticPatterns.js`)

| Kategori | Desen | En düşük düzey | His |
|---|---|---|---|
| Gezinme | `select`, `sliderTick` | Dengeli | ince tik |
| | `tabSwitch` | Dengeli | hafif darbe |
| | `toggleOn` / `toggleOff` | Dengeli | açılış dolgun, kapanış yumuşak |
| | `sliderEdge` | Dengeli | sert "duvar" (uç değer) |
| | `tap`, `sheetOpen`, `sheetSnap` | Bol | hafif / yumuşak |
| Hareketler | `press`, `pressHeavy`, `longPress` | Az | orta / ağır |
| | `dragStart`, `drop`, `dragOver` | Dengeli | kaldır / bırak / geçiş tiki |
| | `swipeThreshold`, `refresh`, `holdTick` | Dengeli | çentik |
| | `swipeCancel` | Bol | yumuşak |
| Sonuçlar | `success`, `warning`, `error` | Az | sistem bildirimleri |
| | `added` (tık+dokunuş), `delete` (sert+ağır) | Az | |
| | `removed`, `copy` (çift tik) | Dengeli | |
| Oyunlar | `correct` (tık→onay), `wrong`, `timeUp` (çift ağır), `win` (yükselen 4'lü), `lose` (sönen 3'lü) | Az | |
| | `countdown`, `combo` | Dengeli | |
| Sosyal | `send`, `receive` (çift tik), `like` (kalp atışı), `reaction` | Dengeli | |
| | `unlike` | Bol | |
| | `friend` | Az | onay |
| Kutlamalar | `celebrate`, `badge`, `streak` (5'li yükselen), `goal`, `match` | Az | çok vuruşlu |

## 5. Uygulamada nerelere eklendi / değişti

| Yer | Önce | Şimdi |
|---|---|---|
| Tüm `selectionAsync` çağrıları (sekme çubuğu, MediaTypeSwitch, çipler, seçiciler…) | sessiz | `select` — Dengeli'de hissedilir |
| `SwitchToggle` (Android çizimi) | yok | `toggleOn` / `toggleOff` |
| `RatingInput` | Light (sessiz) | yarım yıldız başına `sliderTick`, uçlarda `sliderEdge` |
| `HoldToConfirmButton` | yalnız sonda ağır | basışta + dolum boyunca sıklaşan `holdTick`, sonda `pressHeavy` |
| CineSwipe `SwipeCard` | seçim/baskı | eşik `swipeThreshold`, geri dönüş `swipeCancel`, beğeni `like`, geç `drop` |
| CineSwipe eşleşme | başarı | `match` |
| Oyunlar (Bulanık Afiş/Puan yukarı-aşağı, Hangisi önce, Sahne Tahmini, Günün Karesi) | başarı/hata, bazılarında hiç | `correct`, `wrong`, `timeUp`, `lose`, `win`, son 3 sn `countdown`, joker bitti `warning` |
| Sohbet | menü tiki | gönder `send`, açık sohbette gelen mesaj `receive`, kaydırarak yanıt `swipeThreshold`, uzun basma `longPress` |
| Akış / yorum beğenisi | Light (sessiz) / yok | `like` / `unlike` |
| Arkadaşlık isteği kabul | Light (sessiz) | `friend` |
| Turnuva oy seçimi | Light (sessiz) | `select` |
| Listeye ekle/çıkar (hızlı düğmeler, diğer listeler) | Medium / Light | `added` / `removed` |
| Afişe uzun basma (hızlı işlemler) | Medium | `longPress` |
| Liste içi taşıma | başarı | kaldır `dragStart`, sıra adımı `sliderTick/Edge`, bırak `drop`, kaldır `delete` |
| Tier list | seçim | afişi kaldır `dragStart`, yerleştir `drop` |
| Panoya kopyalama (not, oda kodu, davet kodu, destek e-postası, bağlantı) | yok | `copy` |
| Rozet / Perde / Makara | başarı | `badge` / `celebrate` |
| Seri alevi | başarı | `streak` |
| Meydan okuma tamamlandı | başarı | `goal` |

Dokunulmadan kalanlar: toast tipleri (hata/uyarı/rozet/premium zaten eşlenmiş), `AppAlert` başarı/hata, geliştirici ekranı (`UsageDebugScreen`).

## 6. Dosyalar

- `utils/hapticPatterns.js` — saf katalog + platform çözümleyici (yeni)
- `services/hapticsService.js` — tercihler, oynatıcı, çakışma kuralı; eski API korunur
- `services/storage/registry.js` — `hapticsLevel`, `hapticsIntensity`, `hapticsCategories`
- `utils/settingsBackup.js` — yeni anahtarlar "Bildirimler" yedek grubunda
- `hooks/useHapticPrefs.js`, `screens/tabs/settings/HapticsSettingsScreen.js`, `hapticsCopy.js` (tr/en/es/pt/de)
- `__mocks__/expo-haptics.js` — jest otomatik taklidi (servis artık birçok modülden dolaylı yükleniyor)
- Testler: `hapticPatterns` (yeni), `hapticsService` (genişletildi), `hapticsSettings` (yeni), ilgili ekran testleri güncellendi

## 7. Doğrulama

- Jest: 459 paketten 458'i yeşil (8619 test). Tek kırmızı `posterChoicesCoverage`, başka oturumun `components/top100/Top100PosterSheet.js` dosyasından; bu işle ilgisiz.
- ESLint temiz; değişen ve testsiz dosyalar Babel ile derlendi.
- **Cihazda HİSSEDİLMEDİ.** Özellikle denenmesi gerekenler:
  - iPhone: Dengeli'de sekme kaydırması ve seçim tiklerinin yoğunluğu rahatsız edici mi; Güçlü'de `heavy` kaydırması fazla mı.
  - Android API 30–33 cihaz: `toggle-*`/`segment-tick` yokken zincir yedeklerinin hissi; Güçlü'nün `Vibration` dalga formu süreleri (8–32 ms) yeterli/fazla mı.
  - Sohbette `receive` yalnız karşı tarafın yeni mesajında mı çalıyor (eski sayfa yüklemede çalmamalı).

## 8. Sonraki adaylar

- Çekip yenile (`refresh`) — ortak bir `RefreshControl` sarmalayıcısı yok; ekran ekran eklenmeli.
- Alt sayfa açılış/oturma (`sheetOpen` / `sheetSnap`) — BottomSheetModal sarmalayıcısına tek noktadan eklenebilir.
- iOS'ta Core Haptics ile gerçek genlik/keskinlik kontrolü (native modül gerektirir; expo-haptics vermiyor).
- Pil tasarrufu modunda otomatik "Az"a düşme.

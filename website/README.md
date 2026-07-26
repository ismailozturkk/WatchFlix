# seelogd — Bekleme Listesi Sitesi + Yasal Sayfalar

Statik site, build gerekmez:

| Dosya | İçerik |
| --- | --- |
| [index.html](index.html) | Bekleme listesi landing (tek dosya, kendi içinde stil + i18n) |
| [privacy.html](privacy.html) | Gizlilik Politikası — mağaza formlarının istediği URL |
| [terms.html](terms.html) | Kullanım Şartları |
| [delete-account.html](delete-account.html) | Hesap silme yolu (Play'in web talep şartı) |
| [legal.css](legal.css) · [legal.js](legal.js) | Üç yasal sayfanın ortak stili ve dil anahtarı |

**Yasal sayfalar hakkında:** İki dil DOM'da ayrı bloklar hâlinde durur
(`<section data-lang-block="tr|en">`); `legal.js` yalnız hangisinin görüneceğine
karar verir — uzun hukuki metinde yüzlerce çeviri anahtarı tutmamak için. JS
çalışmazsa iki blok da görünür kalır. Dil tercihi landing ile aynı
localStorage anahtarını (`wf_lang`) paylaşır. İçindekiler listesi, aktif dil
bloğunun `h2[id]` başlıklarından üretilir — başlık eklerken TOC'a dokunmak
gerekmez, sadece `id` ve (isteğe bağlı) kısa `data-toc` ver.

> ⚠️ Sayfalarda `mark.todo` ile işaretlenmiş **doldurulmayı bekleyen alanlar**
> var: veri sorumlusunun kimliği/ülkesi ve yetkili mahkeme. Mağazaya
> göndermeden önce doldur; tarayıcıda amber renkte göründükleri için gözden
> kaçmazlar. Sayfalardaki tarihleri (`Yürürlük` / `Son güncelleme`) de metni
> değiştirdiğinde güncelle.

- **Renkler:** Vurgu rengi uygulamanın mavisi (`theme/colors.js` → `blue #138DF0`,
  `blueDark #0551A3`); CSS değişkenleri `--blue / --blue-hi / --blue-deep`.
- **Logo:** Hero'daki marka **inline SVG wordmark** (`.brand-logo`) + `</body>`
  öncesindeki küçük script. "s" harfi **uygulama ikonunun ön planı**
  (`assets/android-icon-foreground.png` → `website/s-mark.png` olarak kopyalandı) —
  cam gibi 3B S (turkuaz→mavi→mor) ve sağ üstünde üç küçük baloncuk; SVG'de
  `<image href="s-mark.png">` olarak yerleştirilir (konum, ikonun saydam olmayan
  sınırına göre ölçülüp hesaplandı). Baloncuklar S ile sol göz arasındaki
  boşluğa denk gelir, göze taşmaz.
- **İkon güncellenirse `<image>` yeniden hesaplanmalı.** Yerleşim, PNG'nin opak
  sınırına bağlıdır; yeni ikonun S'i farklı yerde/oranda olabilir. Yöntem:
  1. PNG'nin opak bloklarını ölç (`pngjs` ile alfa taraması; noktalar S'ten
     ayrı bloklar olarak çıkar). Mevcut ikonda S bloğu **x 337–671, y 280–742**
     (tuval 1024×1024).
  2. Hedef: S'in görünür dikdörtgeni 760×240'lık viewBox'ta
     **x 27,8–165,3 · y 24,0–214,0** olmalı (sağ kenar sol gözden önce biter,
     yükseklik "logd" ile aynı ritimde).
  3. Ölçek `k = 190 / S_yüksekliği`, `width = height = 1024k`,
     `x = 165,3 − (S_sağ+1)k`, `y = 24 − S_üst·k`. Şu anki değerler:
     `k ≈ 0,4104` → `x="-110.5" y="-90.9" width="420.2" height="420.2"`.
  "ee" fareyi/dokunuşu **yumuşak takip eden, ara ara kırpan parlak iki göz**
  (`.sl-pupil` grubu `style.transform` ile hareket eder; kırpma + geçiş CSS
  `<style>`'da SVG içinde, `slBlink`). "logd" Anton ile mavi gradyan. Script yalnız
  göz takibini kurar; yüklenmezse S görseli + gözler + "logd" statik görünür.
  Favicon inline SVG (iki göz). Eski `logo.png` artık kullanılmıyor.
- **Açılış (intro):** Sekme başına bir kez gösterilir (`sessionStorage.wf_intro_seen`;
  `prefers-reduced-motion` açıksa hiç çalışmaz). İçeriği `s-mark-tight.png` + SVG
  wordmark yazısı. **Yazıyı SVG olarak tutuyoruz**: önceden HTML metin +
  `background-clip: text` idi ve gradyan bazı motorlarda hiç boyanmadığından
  ekranda yalnız logo görünüyordu; SVG'de gradyan `fill` ile metnin içine
  boyanır, her yerde çalışır. Aynı sebeple hero wordmark'ı da SVG.
- **`s-mark-tight.png`:** Açılış logosu ve yasal sayfaların üst barındaki 24 px logo. `s-mark.png`
  tuvalinin %67'si saydam olduğu için küçük boyutta S nokta gibi kalıyordu; bu
  dosya S bloğunun etrafından kırpılıp kareye ortalanmış sürümdür (519×519).
  İkon değişirse bunu da yeniden üret — kırpma sınırları yukarıdaki opak blok
  ölçümüyle aynı.
- **Geri sayım:** `CONFIG.launchDate` hedef lansman tarihidir (şu an
  `2026-09-25T20:00:00+03:00` — yol haritasındaki Play TR yayını). Tarih değişirse
  sadece bu satırı güncelle; sayaç AY:GÜN:SAAT:DK:SN olarak kendini hesaplar.
- **Kampanya metni:** "İlk 3 ay %50 indirim" vaadi hero'daki `.promo` bloğu ve
  kayıt sonrası bilette geçiyor — fiyatlandırma kararı değişirse ikisini de güncelle.
- **Ekran görüntüleri:** Şu an özellik kareleri yayın öncesi placeholder gösterir.
  Gerçek görseller hazır olunca `shots/kare-01.png` … `kare-08.png` dosyalarını koy
  ve ilgili `<figure class="shot empty">` bloklarına tekrar `<img>` ekle. Detay:
  [shots/README.md](shots/README.md).

## Responsive davranış

Yerleşim akışkan (`clamp()` + yüzde ölçüler); kırılma noktaları yalnız gerekli
yerde devreye giriyor. 375 / 768 / 1134 px ve yatay telefon (812×400) ölçülerek
doğrulandı: hiçbirinde yatay kaydırma yok.

| Kırılma | Ne yapar |
| --- | --- |
| `html { overflow-x: clip }` | Dönük ticker bandı bilerek taşar; kilit yalnız `body`'de olsa iOS Safari'de yatay kayma sızıyordu. `clip`, `hidden`'ın aksine sticky'yi bozmaz. |
| `≤1200px` | Üst gezinme çubuğu gizlenir (tablet ve telefonda yok). |
| `≤1024px` | Bölüm boşlukları, bilet ölçeği, şerit kare genişliği küçülür. |
| `hover:none` veya `≤1024px` | Dokunma hedefleri: dil düğmeleri 48×40, alt bilgi bağlantıları min 44px, yasal sayfalarda kopyala/buton ≥40px. |
| `≤640px` | Hero/form dikey yığılır, geri sayım `9.6vw`, mikro etiketler 10 → 11,5px, e-posta alanı 36 → 46px. |
| `≤360px` | Geri sayım `10.2vw`, wordmark `78vw`. |
| yatay + `≤560px yükseklik` | Dikey ölçüler `vh`'ye bağlanır (geri sayım `8vh`), açılış logosu/yazısı küçülür, yasal sayfalarda yapışkan katmanlar statikleşir. |

**Yasal sayfalarda içindekiler:** ≥1000px'te sağ kenarda yapışkan liste;
altında tek kolona düşüldüğü için liste **sayfanın en üstüne** taşınır ve
`<details>` ile tek satıra katlanır (kapalı başlar, açılınca 2 kolon — ≤640px'te
1 kolon). Bir başlığa tıklayınca kapanır ki yapışkan kutu hedefin üstünü
kapatmasın. `scroll-padding-top` küçük ekranda 118px: bar + içindekiler
katmanının ikisinin altına da kaçmaz.

## Modlar

- **Canlı mod (varsayılan):** `index.html` içindeki `CONFIG.firebaseConfig` mevcut
  Firebase projesine (`movieandtv-2832a`) bağlıdır. Site Firestore'a yazar:
  - `waitlist/{emailHash}` — e-posta kayıtları (hash doc-id sayesinde mükerrer kayıt engellenir)
  - `meta/waitlist` — toplam sayaç (`count`)
  - `featureRequests/{id}` — özellik istekleri + `hype` sayacı
- **Demo mod:** `CONFIG.firebaseConfig = null` yapılırsa e-postalar ve hype oyları
  tarayıcının localStorage'ında tutulur. Sadece tasarım denemesi için kullan.

`CONFIG.baseCount` sayacın başlangıç ofsetidir; gerçek kayıt sayısının üstüne eklenir.

Tamamlanan/yapımı süren ürün maddeleri `progressSeed` içinde sabit tutulur ve normal
hype listesinden ayrı "Yapılanlar" panelinde gösterilir. Kullanıcıların eklediği açık
istekler Firestore'daki `featureRequests` koleksiyonunda oylanır.

## Firestore kuralları

Kurallar tek kaynakta: kökteki [firestore.rules](../firestore.rules) →
"Landing sitesi" bölümü (`waitlist`, `meta/waitlist`, `featureRequests`).
Buraya kopyalanmış eski bir sürüm vardı ve gerçek kurallarla ayrışmıştı; kopya
kaldırıldı — kural değişikliğini yalnız `firestore.rules` üzerinde yap.

Bilinmesi gerekenler:

- `waitlist` üzerinde **`get` açık, `list` kapalı.** Doküman kimliği
  `base64(email)` ve `email` alanı düz metin olduğundan koleksiyon listeleme
  açık olsa herkes tüm bekleme listesini dökebilirdi. Site yalnızca kendi
  kaydını tek doküman olarak okur (`store.addEmail` → `getDoc`), o yüzden bu
  ayrım siteyi bozmaz.
- Sayaç `meta/waitlist` okumaya açıktır (odometre için) ve yalnız `+1`
  artırılabilir.
- Bu uçlar anonim yazıma açıktır (bekleme listesi doğası gereği). Spam'e karşı
  Firebase **App Check (reCAPTCHA Enterprise/v3)** etkinleştirilmesi şiddetle
  önerilir.
- Uygunsuz özellik istekleri Firestore konsolundan silinir (istemciden delete
  kapalı).

## Yayınlama (Firebase Hosting)

```bash
firebase deploy --only firestore:rules,hosting
```

Lansman günü e-posta göndermek için `waitlist` koleksiyonunu CSV dışa aktarıp
(Console → Export) Mailchimp/Brevo benzeri bir servise yükleyebilirsin.

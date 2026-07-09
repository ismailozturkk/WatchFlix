# Watchify — Bekleme Listesi Sitesi

Tek dosyalık statik site: [index.html](index.html). Harici build gerekmez.

- **Renkler:** Vurgu rengi uygulamanın mavisi (`theme/colors.js` → `blue #138DF0`,
  `blueDark #0551A3`); CSS değişkenleri `--blue / --blue-hi / --blue-deep`.
- **Logo:** `assets/android-icon-monochrome.png`'den kırpılıp 220px'e küçültüldü.
  Hero'daki `<img id="logoImg">` içine **base64 data-URI olarak gömülü** (önizleme
  panelleri yan dosya yükleyemediği için); `logo.png` dosyası favicon için duruyor.
  Nihai logo hazır olunca: `logo.png`'yi değiştir ve `logoImg`'nin `src`'sini
  `"logo.png"` yapman yeterli (deploy'da relative path sorunsuz çalışır).
- **Geri sayım:** `CONFIG.launchDate` hedef lansman tarihidir (şu an
  `2026-09-25T20:00:00+03:00` — yol haritasındaki Play TR yayını). Tarih değişirse
  sadece bu satırı güncelle; sayaç AY:GÜN:SAAT:DK:SN olarak kendini hesaplar.
- **Kampanya metni:** "İlk 3 ay %50 indirim" vaadi hero'daki `.promo` bloğu ve
  kayıt sonrası bilette geçiyor — fiyatlandırma kararı değişirse ikisini de güncelle.
- **Ekran görüntüleri:** Şu an özellik kareleri yayın öncesi placeholder gösterir.
  Gerçek görseller hazır olunca `shots/kare-01.png` … `kare-08.png` dosyalarını koy
  ve ilgili `<figure class="shot empty">` bloklarına tekrar `<img>` ekle. Detay:
  [shots/README.md](shots/README.md).

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

## Firestore kuralları (mevcut kurallara ekle)

```
match /waitlist/{docId} {
  allow read, update, delete: if false;
  allow create: if request.resource.data.keys().hasOnly(['email','createdAt','source'])
                && request.resource.data.email is string
                && request.resource.data.email.matches('^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$')
                && request.resource.data.email.size() < 200
                && request.resource.data.source == 'landing';
}
match /meta/waitlist {
  allow read: if true;
  allow create: if request.resource.data.keys().hasOnly(['count'])
                && request.resource.data.count is int
                && request.resource.data.count >= 1;
  allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['count'])
                && request.resource.data.count == resource.data.count + 1;
  allow delete: if false;
}
match /featureRequests/{id} {
  allow read: if true;
  allow create: if request.resource.data.keys().hasOnly(['text','hype','source','createdAt'])
                && request.resource.data.text is string
                && request.resource.data.text.size() >= 4
                && request.resource.data.text.size() <= 140
                && request.resource.data.hype == 0
                && request.resource.data.source == 'landing';
  allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['hype'])
                && request.resource.data.hype == resource.data.hype + 1;
  allow delete: if false;
}
```

> Not: Bu uçlar anonim yazıma açıktır (bekleme listesi doğası gereği). Spam'e karşı
> Firebase **App Check (reCAPTCHA Enterprise/v3)** etkinleştirilmesi şiddetle önerilir.
> Uygunsuz özellik istekleri Firestore konsolundan silinir (istemciden delete kapalı).

## Yayınlama (Firebase Hosting)

```bash
firebase deploy --only firestore:rules,hosting
```

Lansman günü e-posta göndermek için `waitlist` koleksiyonunu CSV dışa aktarıp
(Console → Export) Mailchimp/Brevo benzeri bir servise yükleyebilirsin.

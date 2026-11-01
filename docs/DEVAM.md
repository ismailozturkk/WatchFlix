# Devam notu — yapay zekâ asistanları için

> **Başlangıç cümlesi:** `docs/DEVAM.md`'yi oku, sonra "Sıradaki iş" bölümünden devam et.

Bu projede birden fazla yapay zekâ asistanı dönüşümlü çalışıyor. Bu dosya, araç fark etmeksizin
devralan asistanın kaldığı yerden devam edebilmesi için var. **Durum değiştikçe bu dosyayı güncelle.**

Son güncelleme: **1 Kasım 2026** (1.5.0 TestFlight'ta denendi; iki bulgu)

---

## 1. Projede durum

| | |
|---|---|
| Uygulama | Seelogd — film/dizi takip, sosyal ağ ve oyun uygulaması (Expo SDK 57 / React Native) |
| Dal | `codex/release-candidate-1.4.3` — GitHub'a push'lu |
| Sürüm | **1.5.0** (`app.json` + `package.json`; `runtimeVersion` = `appVersion`) |
| Firebase projesi | `movieandtv-2832a` (görünen ad: seelogd), proje no `427087836931`, bölge **eur3** |
| **Staging YOK** | Tek proje var ve **canlı**. Yük/sızma testi canlıya yapılmaz. |

**Yayın durumu:** Firestore kuralları, 29 Cloud Function ve Hosting **canlıda ve çalışma ağacıyla
eşleşiyor**. **1.5.0 build'leri alındı ve 1 Kasım'da mağazalara test olarak yüklendi:**
iOS build 25 ve Android versionCode 5, ikisi de `production` profili, `STORE` dağıtımı, commit
`9cb0651`. İnceleme/işleme sürerken mağazadaki yayın sürümü hâlâ eski (Play 1.4.6, iPhone 1.4.8).

**Bilinen ve kabul edilmiş durum:** `legacyUserSearchList()` kapatıldı, bu yüzden **mağazadaki eski
sürümlerde arkadaş araması çalışmıyor**. 1.5.0 yayılınca düzelir. Kullanıcı bunu bilerek seçti.
Geri alma: `firestore.rules`'ta anahtarı `true` yap + `firebase deploy --only firestore:rules`.

---

## 2. ⚠️ Çalışma ağacı paylaşımlı — commit kuralları

**En kritik bölüm burası.** Çalışma ağacında ~296 dosya commit'lenmemiş. Bunların çoğu **başka
oturumların** bitmiş ama commit'lenmemiş işi (Haftalık Lig, Film Kulübü, Meydan Okumalar, Günün
Karesi, yeni uygulama simgeleri, seri alevi, turnuva yenilemesi…).

### Kurallar

1. **Başka oturumun işini commit'leme.** Bir dosyada hem senin hem başkasının değişikliği varsa,
   HEAD kopyası üzerine YALNIZ kendi değişikliğini uygulayıp onu stage'le.
2. **Gerçek indekste başka oturumun staged silmeleri duruyor: 8 dosya / 1.774 silme**
   (`__tests__/r2.test.js`, `utils/r2.js`, `components/pet/*`, `context/PetContext.js`,
   `services/petCache.js`, `screens/tv/TvShowsAiringToday.js`). **Bunlara dokunma.**
3. Commit sonrası `git reset HEAD -- <dosya>` yaparken **klasör verme, tek tek dosya adı ver.**
   Klasör verirsen o klasördeki başka oturumun staged silmeleri de geri alınır.
   Doğrulama: `git diff --cached --stat | tail -1` → **8 files changed, 1774 deletions(-)** olmalı.

### Güvenli commit yöntemi (geçici indeks)

```bash
SP=/tmp/stage; mkdir -p $SP
git show HEAD:yol/dosya.js > $SP/dosya.js
# $SP/dosya.js üzerine YALNIZ kendi değişikliğini uygula (betikle, elle değil)

export GIT_INDEX_FILE=$SP/idx; rm -f $GIT_INDEX_FILE
git read-tree HEAD
git add tamamen-benim-olan-dosyalar...
h=$(git hash-object -w --path=yol/dosya.js $SP/dosya.js)
git update-index --cacheinfo 100644,$h,yol/dosya.js
git diff --cached --stat          # kontrol et
git commit -F - <<'EOF'
mesaj
EOF
unset GIT_INDEX_FILE
git reset -q HEAD -- yol/dosya.js tek-tek-diğerleri...
```

**Ayrışmayı doğrula:** hazırladığın kopya ile çalışma ağacı arasındaki fark, yalnız başka oturumun
satırları kadar olmalı:
```bash
diff <(tr -d '\r' < $SP/dosya.js) <(tr -d '\r' < yol/dosya.js) | grep -c "^[<>]"
```

---

## 3. Testler

Üçü de yeşil olmadan commit etme. **Bir servisin Firestore çağrı biçimini değiştirdiysen MUTLAKA
tam jest** — hedefli test yetmez (geçmişte bu yüzden kırık commit atıldı).

```bash
npx jest
```
Beklenen: **8.186 test / 432 takım**.

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npm run test:rules
```
Beklenen: **368 test / 13 takım**. Emülatör **JDK 21** ister (Android Studio JBR). Emülatörü
`emulators:exec` ile koş; süreci elle öldürmek 8085 portunu kilitli bırakıyor.

```bash
cd functions && npm test
```
Beklenen: **121 geçti / 0 başarısız** (39 emülatör testi atlanır).

Üretim paketinin derlendiğini doğrulamak için (build öncesi iyi bir kontrol):
```bash
NODE_ENV=production npx expo export --platform android --output-dir /tmp/exp
```

---

## 4. Sıradaki iş

### TestFlight denemesi (1 Kasım) — doğrulananlar
Kullanıcı 1.5.0'ı iOS TestFlight'ta denedi. **Arkadaş araması çalışıyor**; **yeni özelliklerin
hepsi build'de** (yani EAS commit'lenmemiş çalışma ağacını da arşive almış — mağaza metni doğru).

### Açık iki bulgu
1. **iOS alternatif uygulama simgesi seçilemiyordu — düzeltildi, DOĞRULANMADI.**
   Kök sebep EAS derleme kaydından ölçüldü: `plugins/withAlternateAppIcons.js` her alternatif
   kümeyi tek ölçülü (1024, `idiom: "universal"`) yazıyordu. actool `--alternate-app-icon Glass
   … Light` bayraklarını hatasız aldı ama pakete yalnız `AppIcon60x60@2x.png` ve
   `AppIcon76x76@2x~ipad.png` koydu — alternatifler için hiçbir dosya yok, `setAlternateIconName`
   de cihazda düşüyor. (Expo birincil simgeyi aynı tek-ölçülü biçimde yazar ve orada sorun
   olmaz; fark alternatif kümelerde.) Eklenti artık Xcode'un klasik 16 slotunu yazıyor;
   bekçi test: `__tests__/alternateAppIconsIos.test.js`. `components/settings/AppIconSection.js`
   artık hata sebebini yayın yapısında da gösteriyor. **Yalnız yeni bir iOS build'i doğrular.**
2. **iOS'ta "premium mağaza paketleri henüz hazır değil" — kodda değil, App Store Connect'te.**
   RevenueCat yapılandırılmış (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` build ortamında vardı, yoksa
   mesaj "API anahtarı bekleniyor" olurdu); teklif iOS ürünü döndürmüyor. Kullanıcı tarafı:
   ürünler "Ready to Submit", ilk IAP'ler bir sürümle incelemeye gönderilmiş, Paid Applications
   Agreement etkin, RevenueCat offering'inde iOS ürünleri bağlı. Android'de fiyat (₺59,99)
   görünüyordu.

### Kullanıcıda
1. **App Store Connect IAP durumu** (yukarıdaki dört madde).
2. **Birkaç gün sonra** `npm run appcheck:status` — ölçümü **Play dahili test kanalından** inen
   sürümle yap; emülatör ve elle kurulan APK Play Integrity doğrulamasını bilerek geçemiyor.

### Birlikte yapılacaklar (kullanıcı hazır olduğunda)
1. **İmza anahtarı `.jks` taşıma** — yedeği doğrulanmadan **SİLME**. Adımlar:
   `docs/guvenlik/GELISTIRME_REHBERI_BEN.md` → NOTLAR.
2. **Gizlilik göçü (Yüksek).** Eski hesaplarda e-posta/doğum tarihi hâlâ `Users/{uid}` kökünde,
   `website/privacy.html` ise durmadığını söylüyor. Sıra: kullanıcılar 1.5.0'a geçsin → servis
   hesabı anahtarı (kullanıcı oluşturur) → `functions/scripts/migrateAccountPrivate.js` kuru
   çalışma → `--apply` → `firestore.rules`'ta `legacyRootAccountWrites()` = `false` + deploy →
   website hosting. Ayrıntı: `docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md`.
3. **App Check zorunluluğu.** Şu an her yerde UNENFORCED ve 28 günde **0 geçerli doğrulama** vardı.
   Ön koşullar 1 Kas'ta tamamlandı (DeviceCheck `.p8`, Play Integrity bağlantısı, jeton ömrü 12 sa).
   **Ölçmeden ENFORCE AÇMA** — bugün açılsa tüm trafik reddedilir. Önce `npm run appcheck:status`,
   VALID ≥ %95 olunca kademeli: callable'lar → Firestore → Auth → RTDB.
4. **Yük testi.** Ayrı Blaze projesi + k6 kurulumu kullanıcıda; `load-test/README.md`.
   Sunucuda `FUNCTIONS_TEST=1` kısa devresi hazır (`functions/upstreamStub.js`, prod'da kilitli).

### Açık karar
- **Bekleme listesi sızıntısı:** bir e-postayı bilen, o kişinin listede olup olmadığını öğrenebiliyor.
  Kabul edilen risk olarak duruyor; kapatmak UX değişikliği ister. Gerekçe: denetim raporu L-1.

---

## 5. Projeye özgü tuzaklar

- **Satır sonları karışık (CRLF/LF).** Düzenleme betiği yazarken dosyanın kendi satır sonunu tespit
  edip kullan, yoksa "eşleşme yok" alırsın. Bkz. `docs/` içi notlar ve mevcut betik deseni.
- **Kural deploy'u dosyanın TAMAMINI gönderir.** Deploy öncesi canlı kuralı salt-okunur çekip
  `diff` al; başka oturumların yayınlanmamış blokları da seninkiyle birlikte gider.
- **Emülatör ve elle kurulan APK App Check / Play Integrity doğrulamasını geçemez** (tasarım gereği).
  Ölçümü Play dahili test kanalından inen sürümle yap.
- **Cloud Run bölge kotası: 20 vCPU** (us-central1). Tüm fonksiyonlar birlikte en fazla 20 kopya.
  Bu yüzden `functions/capacity.js`'te hiçbir sınıf 10'u geçmiyor. Toplu deploy bu kotayı geçici
  doldurup bir fonksiyonu düşürebilir; ~15 dk sonra tekrar dene.
- **Play Integrity kotası 10.000/gün** — App Check zorunlu olunca ~3-4 bin günlük kullanıcıda dolar.
  Jeton ömrü 12 saate çekildi; büyümeden önce kota artışı istenmeli.
- **Premium kapıları tek kaynaktan:** `utils/premiumFeatures.js`. Yeni özellik eklerken oraya
  bakmadan karar verme.
- **Yerel-öncelikli veri:** notlar, hatırlatıcılar ve listeler için **cihaz kaynaktır**, bulut değil
  (`services/userData/`, `services/listSyncService.js`). Bunları "sunucudan çek" diye değiştirme.

---

## 6. Nerede ne yazıyor

| Konu | Dosya |
|---|---|
| **Kullanıcının yapacakları / kararlar** | `docs/guvenlik/GELISTIRME_REHBERI_BEN.md` → "📌 NOTLAR" |
| Teknik görev listesi (ajan için) | `docs/guvenlik/GELISTIRME_REHBERI_CLAUDE.md` |
| Güvenlik + performans denetimi | `docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md` |
| Okuma maliyeti analizi ve yapılanlar | `docs/maliyet/KULLANIM_VE_MALIYET_ANALIZI_2026-11-01.md` |
| TMDB jetonu kararı + döndürme | `docs/guvenlik/TMDB_JETON_YONETIMI.md` |
| Yayın öncesi test turu | `docs/test/DEVAM_NOTU.md`, `docs/test/T3_BULGULAR_2026-10-26.md` |
| Mimari | `docs/mimari/` |
| Özellik belgeleri | `docs/ozellikler/` |

---

## 7. Çalışma biçimi (kullanıcının beklentisi)

- **Türkçe konuş.**
- **Deploy, push, build ve panel işleri için önce sor.** Kullanıcı onay verdiğinde yap.
- Ölçülen sayı ile tahmini ayrı yaz. "Cihazda denenmedi" gibi doğrulanmamış şeyleri açıkça belirt.
- Commit mesajları Türkçe; sonunda eş-yazar satırı.
- Yıkıcı ya da geri dönüşü olmayan işlerde (imza anahtarı silme, kota/kural kapatma) önce
  doğrula, sonucu anlat, sonra kullanıcıya bırak.

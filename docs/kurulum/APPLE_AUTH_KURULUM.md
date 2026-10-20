# Sign in with Apple kurulum ve doğrulama listesi

Kod tarafında Apple giriş, ilk profil tamamlama, mevcut hesaba bağlama,
yeniden doğrulama, bağlantı kaldırma ve hesap silerken Apple yetkisini iptal
etme akışları bulunur. Bundle ID `com.smlztrk.seelogd`, Team ID
`KN77DDXC9U` değeridir.

## 1. Apple Developer yapılandırması

1. Certificates, Identifiers & Profiles > Identifiers altında
   `com.smlztrk.seelogd` App ID'sini aç.
2. **Sign in with Apple** capability'sini etkinleştir ve App ID'yi kaydet.
3. Keys bölümünde yeni bir anahtar oluştur, **Sign in with Apple** seçeneğini
   işaretle ve primary App ID olarak `com.smlztrk.seelogd` seç.
4. Oluşan **Key ID**'yi kaydet ve `.p8` dosyasını indir. Apple bu dosyayı
   yalnız bir kez indirir; repoya, EAS environment'a veya mesaja yükleme.

Bu anahtar App Store Connect API anahtarı değildir. Sign in with Apple için
oluşturulmuş anahtar kullanılmalıdır.

## 2. Firebase Authentication

Firebase Console > Authentication > Sign-in method > Apple sağlayıcısını aç.
Apple Developer'dan aldığın şu değerleri gir:

- Services ID / Client ID: Firebase panelinin istediği web OAuth tanımlayıcısı
- Apple Team ID: `KN77DDXC9U`
- Key ID: Apple Sign in with Apple anahtarının Key ID'si
- Private key: indirilen `.p8` dosyasının içeriği

Firebase'in e-posta gönderim adresini Apple Private Email Relay bölümünde
tanımla. Aksi hâlde “E-postamı Gizle” kullanan kişilere Firebase e-postaları
ulaşmayabilir.

## 3. Cloud Functions secret'ları

Hesap bağlantısı kaldırılırken ve hesap silinirken Apple yetkisinin iptali için
iki secret gerekir:

```powershell
firebase functions:secrets:set APPLE_SIGN_IN_KEY_ID
firebase functions:secrets:set APPLE_SIGN_IN_PRIVATE_KEY --data-file "C:\guvenli-konum\AuthKey_XXXXXXXXXX.p8"
```

İlk komut Key ID'yi etkileşimli olarak ister. İkinci komutta gerçek güvenli
dosya yolunu kullan. `.p8` içeriğini komut satırına düz metin olarak yazma.

Secret'lar hazırlandıktan sonra aşağıdaki iki callable deploy edilmelidir.
Deploy, ayrıca kullanıcı onayı alınarak çalıştırılır:

```powershell
firebase deploy --only "functions:checkAppleSignInEligibility,functions:revokeAppleAuthorization"
```

İlk callable aynı e-posta ile yanlışlıkla ikinci bir hesap açılmasını engeller.
İkincisi Apple authorization code'u sunucuda token'a çevirip Apple yetkisini
iptal eder; `.p8` anahtarı hiçbir zaman mobil uygulamaya girmez.

## 4. Build ve gerçek cihaz kabul testi

Apple girişi Expo Go'da doğrulanmaz; Sign in with Apple capability içeren imzalı
iOS build gerekir. Simulator, credential-state sonuçları için nihai kanıt
sayılmaz. Gerçek iPhone/iPad üzerinde şunları ayrı ayrı doğrula:

- İlk Apple kaydı profil tamamlama ekranına gider; ad/e-posta gizlense de çalışır.
- İkinci giriş aynı Firebase/Seelogd hesabını açar.
- Mevcut e-posta/Google hesabına Apple, Ayarlar > Hesap bağlantıları üzerinden
  açık onaydan sonra bağlanır; doğrudan giriş ikinci hesap açmaz.
- Apple tek giriş yöntemiyse bağlantı kaldırılamaz.
- İkinci yöntem varken Apple bağlantısı kaldırılır ve tekrar Apple girişinin
  mevcut profile erişmediği doğrulanır.
- Apple bağlı hesap uygulama içinden silinir; Firestore/Auth verisi temizlenir
  ve Apple yetkisi iptal edilir.

Son olarak production-profile EAS build, Firebase Auth kullanıcı kaydı ve Cloud
Functions logları birlikte kontrol edilmelidir.


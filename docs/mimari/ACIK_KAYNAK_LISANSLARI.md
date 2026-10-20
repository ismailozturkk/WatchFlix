# Açık Kaynak Lisansları

Uygulama MIT, BSD, ISC, Apache-2.0 gibi lisanslara sahip kütüphaneler dağıtıyor.
Bu lisansların ortak zorunluluğu: **lisans metni ve telif bildirimi, dağıtılan
üründe yer almalı.** Apache-2.0 ayrıca varsa NOTICE dosyasının iletilmesini ister.
Bu yükümlülük uygulama içindeki lisans ekranıyla karşılanıyor.

## Parçalar

| Dosya | Rol |
| --- | --- |
| `scripts/generate-oss-licenses.js` | `node_modules`'tan lisans verisini toplar |
| `assets/ossLicenses.json` | Üretilen veri — **elle düzenlenmez**, repoya commit edilir |
| `screens/tabs/settings/OpenSourceLicensesScreen.js` | Ayarlar > Hakkında > Açık Kaynak Lisansları |
| `__tests__/ossLicenses.test.js` | Uyumluluk bekçisi (bayat liste / riskli lisans) |

## Listeyi güncelleme

Bağımlılık eklendiğinde, kaldırıldığında veya güncellendiğinde:

```bash
npm install          # node_modules guncel olmali
npm run licenses     # assets/ossLicenses.json yeniden uretilir
npm test             # uyumluluk testleri
```

Üretilen dosyayı commit'e dahil et. **Store'a gönderilen her build'den önce
çalıştırılmalı** — aksi halde yeni bir bağımlılığın lisansı ekranda görünmez.

`npm run licenses` çıktısındaki uyarılar bilgi amaçlıdır:

- *LICENSE dosyası bulunamadı*: paket lisans metnini dağıtımına koymamış; ekranda
  beyan edilen SPDX kimliği ve depo bağlantısı gösterilir.
- *node_modules'ta bulunamayan paket*: başka platformlara ait opsiyonel ikili
  paketler (ör. `fsevents`, `lightningcss-linux-*`). Android/iOS build'ine
  girmedikleri için sorun değil.
- *lisansı belirsiz paket*: elle incelenmeli.

## Kapsam

Script, `package.json > dependencies` altındaki paketlerin **geçişli** kapanışını
tarar (`optionalDependencies` dâhil, `devDependencies` hariç). Bu küme, uygulama
paketine giren modüllerden fazlasını içerir (ör. Expo CLI zinciri) — fazladan
atıf hukuki bir sorun değildir, eksik atıf sorundur.

`assets/ossLicenses.json` ~850 KB'tır. Açılış süresini etkilememesi için ekran
veriyi `InteractionManager.runAfterInteractions` içinde tembel `require` eder.

## Test bekçisi

`__tests__/ossLicenses.test.js` şunları doğrular:

- `package.json` içindeki her doğrudan bağımlılık listede var (liste bayat değil)
- Lisansı `UNKNOWN` paket yok
- AGPL / GPL-3.0 / SSPL gibi kapalı kaynak dağıtımı engelleyen lisans yok
- Yeni bir SPDX kimliği çıktığında test kırılır — testteki `ALLOWED` listesine
  eklemeden önce lisans koşulları incelenmeli

# Ekran bölümleri (gizle / göster)

**Ayarlar > Kişiselleştirme > Ekran bölümleri.** Diziler, Filmler, Hub ve Profil ekranlarındaki
bölümlerin (raflar, kartlar, şeritler) tek tek açılıp kapatılması. Örnek: profilde "Notlar"ı ya da
film ekranında "Gizli Cevherler"i kapatınca o bölümler ilgili ekrandan kalkar.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/sectionVisibility.js` | **Saf çekirdek**: ekran/bölüm kaydı (`SECTION_SCREENS`), normalize, süzme, aç/kapa. RN importu yok. |
| `hooks/useSectionVisibility.js` | Depoya bağlama: `useScreenSections(ekran)` + yazıcılar (`setSectionShown`, `setScreenSectionsShown`, `resetSectionVisibility`). |
| `services/storage/registry.js` | `Keys.sectionVisibility` (json, varsayılan `null`, `plainObject`). |
| `screens/tabs/settings/SectionVisibilityScreen.js` | Ayar sayfası (ekran karoları, özet kartı, bölüm satırları, onay sayfası, sıfırlama). |
| `screens/tabs/settings/sectionVisibilityCopy.js` | tr/en/es metinleri (her bölümün adı + açıklaması). |
| `components/home/SectionsHiddenNotice.js` | Ekranın tüm bölümleri gizlenince çıkan "ayarlara git" kartı. |
| `screens/tabs/{TvShow,Movie,Hub,Profile}Screen.js` | Süzgeci kullanan dört ekran. |
| `screens/tabs/settings/PersonalizationScreen.js` | Giriş satırı + "N gizli" rozeti. `App.js` rotası: `SectionVisibilityScreen`. |

## Kararlar

- **"Gizli" listesi saklanır, "görünür" değil.** Yarın yeni bir bölüm eklenirse eski kayıt onu sessizce
  kapalı bırakmaz. Boş / eksik / bozuk kayıt = hepsi görünür. (`decorScopes` ile aynı mantık.)
- **Ekran başına ayrı kayıt.** Film ve Dizi tek sekmede ama ayrı ekran: ikisinde de "trends" var,
  biri gizlenince öteki etkilenmez.
- **`Devam Edenler` (Diziler) eski tek anahtarlı bölüm.** Kendi ayarı zaten vardı
  (`showOngoingTvShows`, Ayarlar > Dil ve içerik). İkinci bir doğruluk kaynağı açılmadı: ayar
  sayfasındaki satır **aynı ayarı** okur/yazar (`legacy` alanı), bu modülün kaydına girmez.
- **Profildeki arkadaş çubuğu onay ister** (`confirmHide`): mesajlar, arkadaş listesi, arkadaş arama
  ve istekler uygulamada yalnız oradan açılıyor. Gizlenirse bunlara başka yerden ulaşılamaz.
- **Kimlik bloğu (avatar + ad) ve Hub selamlaması gizlenemez** — kayıtta yoklar.
- Film/Dizi ekranının üst satırındaki **keşfet ve arama düğmeleri bölüm DEĞİL** (rafların üstünde yüzer) ve gizlenemez. "Ne izlesem?"
  önce listenin başında gizlenebilir bir kartken (`picker`) çok yer kapladığı için keşfet düğmesine çevrildi; `picker` kaydı silindi.
  Ayrıntı: `docs/ozellikler/FILTRELI_KESIF.md`.
- **Plan kapısı yok**: ücretsiz özellik.
- Tüm bölümler gizlenince Hub/Profil/Film/Dizi boş kalmaz: `SectionsHiddenNotice` nedenini söyler ve
  ayar sayfasını doğru sekmede açar (`navigate("SectionVisibilityScreen", { initialScreen })`).
- Yedek: `sectionVisibility` "Düzen" grubunda (`utils/settingsBackup.js`); içe aktarmada normalize edilir.

## YENİ BÖLÜM EKLEMEK

1. `utils/sectionVisibility.js` → ilgili ekranın `sections` listesine ekle (sıra = ekrandaki sıra;
   Ionicons adı + renk).
2. Ekrana bağla: Film/Dizi'de `sections` dizisine `{ key: "<kimlik>", … }`; Hub'da `show("<kimlik>") && …`;
   Profil'de `showSection("<kimlik>") && …`.
3. `sectionVisibilityCopy.js` → üç dile `["Ad", "Açıklama"]` ekle.
4. `npx jest __tests__/sectionVisibility.test.js` — **kapsam bekçisi** kayıt ile ekran kaynağını
   karşılaştırır; unutulan bağlama ya da kayıtsız bölüm testi kırar. `sectionVisibilityCopy.test.js`
   eksik metni yakalar.

## Cihazda henüz görülmedi

Jest (saf mantık, kanca, ayar sayfası gerçek depoyla) ve Yoga yerleşim ölçümü (320–412 pt, üç dil,
dört sekme) temiz. iOS 26 cam görünümü, gerçek yazı tipiyle satır sarmaları ve Film/Dizi'de raf
gizlenince kaydırmanın davranışı cihazda doğrulanmadı.

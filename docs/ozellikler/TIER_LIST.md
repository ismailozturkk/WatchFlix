# Tier List (Kademeli sıralama)

3 Kasım 2026'da planlandı ve kodlandı. Kullanıcı isteği: TierMaker tarzı tablo ("Peak / Goated / Great /
Underrated / Overrated / Garbage" satırları, satır başında renkli etiket, yanında afişler) oluşturmak ve
uygun yollarla paylaşmak.

> Film ve dizilerini renkli kademelere diz, istediğin kadar tablo kur, görsel olarak ya da sohbette paylaş.

## Özet

| | |
|---|---|
| Yer | Eğlence → "Tier list" kartı (Meydan okumaların altında) |
| Rotalar | `TierListsScreen` (tablolarım) · `TierListEditorScreen` (`{ id }`) |
| Premium | Yok (tüm planlarda açık). Sınırlar herkes için aynı: 30 tablo, tablo başına 100 yapım, 2–10 kademe. |
| Build / Deploy | Hayır / Hayır. Kayıt cihaz-yerel (`Keys.tierLists`); sohbet paylaşımı mevcut mesaj şemasıyla (rules değişmez). |
| Bölüm görünürlüğü | `hub` ekranında `tierlist` (Ayarlar > Ekran bölümleri). |
| Hesabı Sıfırla | `Keys.tierLists` silinir (yerel ilerleme anahtarları listesinde). |

## Kavramlar

- **Tablo**: başlık + şablon + sıralı kademeler + **havuz** (henüz yerleştirilmemiş yapımlar) + yapım sözlüğü.
- **Kademe**: etiket (≤ 24 harf, boş olamaz) + renk (12'lik TierMaker paleti) + sıralı yapım anahtarları.
- **Yapım anahtarı**: `movie_123` / `tv_456`. Bir yapım tabloda tek yerde durur (bir kademe ya da havuz).
- **Şablonlar** (oluştururken; sonra her şey düzenlenebilir), etiketler o anki dilde yazılır:

| Kimlik | Kademeler |
|---|---|
| `classic` | S · A · B · C · D · F |
| `vibe` | Zirve · Efsane · Harika · Hafife alınan · Abartılan · Çöp (görseldeki düzen) |
| `stars` | ★★★★★ … ★ (5) |
| `rewatch` | Tekrar tekrar · Bir kez daha · Bir kez yeter · Keşke izlemeseydim |
| `blank` | 1 · 2 · 3 |

## Düzenleyici (TierListEditorScreen)

Sürükle-bırak yerine **dokun-seç / dokun-yerleştir** (tek elle, kaydırmayla çakışmaz, testlenebilir):

1. Afişe dokun → seçilir (halka + alt çubukta eylemler).
2. Bir kademenin boş alanına dokun → sona yerleşir. Kademedeki bir afişe dokun → **onun önüne** yerleşir.
3. Havuz alanına dokun → havuza geri döner. Aynı afişe yeniden dokun → seçim kalkar.
4. Seçiliyken alt çubuk: **Önceki / Sonraki** (kademe içi sıra), **Havuza al**, **Ayrıntı**, **Tablodan çıkar**.
5. Kademe etiketine dokun → kademe sayfası: ad, renk, yukarı/aşağı taşı, altına kademe ekle, sil (içindekiler havuza).

Başlık üstteki alandan düzenlenir. Her değişiklik anında kaydedilir (taslak yok).

**İçerik ekle** sayfası: İzlediklerim · Favoriler · İzleyeceklerim · Ara (TMDB film + dizi). Çoklu seçim, eklenenler havuza
düşer. Tabloda zaten olan yapım işaretli ve seçilemez. Tavan dolarsa fazlası eklenmez, sayfa söyler.

## Paylaşım

Düzenleyicinin başlığındaki paylaş düğmesi → paylaşım sayfası; aynı üç seçenek Tablolarım'da kartın "…" menüsünde de
var (iş menü kapandıktan sonra başlar; ortak mantık `hooks/useTierListShare.js`):

| Seçenek | Ne olur |
|---|---|
| Görsel olarak paylaş | Tablo 1080 px genişlikte PNG olarak çizilir (TierMaker düzeni, koyu zemin, Seelogd imzası) → sistem paylaşımı |
| Galeriye kaydet | Aynı görsel, yalnız-yazma medya izniyle galeriye |
| Sohbete gönder | Arkadaş / grup seçilir → `tierListShare` mesajı |

- Görselde yalnız **yerleştirilmiş** yapımlar var; havuz girmez. Boş kademeler etiketleriyle çizilir.
- Görsel, afişler yüklenince (en çok 4 sn beklenir) yakalanır; yüklenmeyen afiş yer tutucuyla kalır.
- Sohbet mesajı **anlık görüntüdür** (liste paylaşımıyla aynı gerekçe): kademeler + afiş yolları gömülür, en çok 10 kademe
  ve 100 yapım. Gönderen tabloyu sonra değiştirse de sohbet o anki hâli gösterir.
- Balon: başlık, kademe başına renkli etiket + ilk afişler + "+N". Dokununca tam görünüm sayfası açılır; **gelen** balonda
  "Kopyasını düzenle" → alıcıda yeni bir tablo olarak açılır (kademeler ve yapımlar aynen, havuz boş).

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/tierList.js` | Saf çekirdek: şablonlar, palet, normalleştirme, tüm düzenleme işlemleri, paylaşım dönüşümü |
| `utils/tierListCopy.js` | Metinler (tr/en/es/pt/de) |
| `hooks/useTierLists.js` | Depoya bağlama (oku-değiştir-yaz tek turda) |
| `hooks/useTierListShare.js` | Paylaşım (görsel yakalama, galeri, sohbet sayfası); düzenleyici + Tablolarım menüsü |
| `components/tierList/TierBoard.js` | Kademe satırları (düzenlenebilir / salt okunur) |
| `components/tierList/TierMiniPreview.js` | Kartlardaki küçük önizleme (liste, Eğlence kartı, sohbet balonu): en çok 6 kademe, satıra sığan en çok 12 afiş + "+N" |
| `components/tierList/TierEditSheet.js` | Kademe sayfası |
| `components/tierList/TierListCreateSheet.js` | Yeni tablo: başlık + şablon |
| `components/tierList/TierListAddSheet.js` | İçerik ekleme sayfası |
| `components/tierList/TierListShareCard.js` | Görsel kartı (captureRef hedefi) |
| `components/tierList/TierListShareSheet.js` | Paylaşım seçenekleri |
| `components/tierList/TierListPreviewSheet.js` | Sohbetten gelen tablonun tam görünümü + kopyala |
| `components/chat/SharedTierListMessage.js` | Sohbet balonu |
| `components/hub/TierListWidget.js` | Eğlence kartı |
| `screens/fun/TierListsScreen.js` · `TierListEditorScreen.js` | Ekranlar |
| `utils/chatShare.js` | `tierList` türü: `buildTierListShare`, sanitize, önizleme, `🏅` öneki |

## Bilerek yapılmayanlar / sonraki adımlar

- **Bulut kopyası yok**: tablolar telefon değişince taşınmaz (Meydan okumalar ve Yıllık hedefle aynı karar). Buluta almak
  `services/userData` alanı + `firestore.rules` + deploy ister.
- **Sürükle-bırak yok**: dokun-yerleştir ilk sürüm. Sürükleme `react-native-gesture-handler` + kaydırma çakışması ister,
  cihazda denenmeden yazılmadı.
- Profilde tablo vitrini, ortak (çok kişili) tablo yok.
- Görsel kart en çok 100 afiş taşır; çok kalabalık kademede satır uzar (kart boyu içerikle büyür, Story oranına sığdırılmaz).

## Akışta paylaşım (Sosyal > Paylaşımlar, 4 Kas)

- Gönderi türü `tierlist` (utils/postComposer `POST_TYPES`; rozet turuncu "TIER LIST", simge podium). Gövde
  `Posts/{id}.tierList = { title, total, tiers }` — sohbet kartıyla aynı temizlik (`buildTierListShare`), anlık görüntü:
  cihazdaki tablo sonradan değişse de gönderi aynı kalır. `mediaList` boş, puan yok. Firestore kuralları türü
  kısıtlamadığı için rules değişmedi.
- Composer'da 5. tür: açıklama (isteğe bağlı) + spoiler + `createPost/TierListPicker` (cihazdaki tablolar; yerleşmiş
  yapımı olmayan seçilemez; "Yeni tier list oluştur" → yazı varsa taslağa alınır, pencere kapanınca Tablolarım
  `create: true`). Taslak ve düzenleme `tierList`i taşır.
- Eğlence'den: paylaş sayfası + Tablolarım "…" menüsünde "Akışta paylaş" → `useTierListShare` "feed" →
  ShareContentScreen `composePost` (postType tierlist, tablo seçili).
- Akış kartı / gönderi detayı: `components/feed/PostTierListBlock` (koyu tahta, dokununca tam görünüm, başkasının
  gönderisinde "Kopyasını düzenle"). Süzgeç çipi "Tier list'ler"; küçük resimler `postPreviewPosters`.
- Eski sürümler `tierlist` gönderisini İNCELEME rozetiyle başlık + metin olarak görür (tablo yok).

## Doğrulama

- `__tests__/tierList.test.js` — çekirdek (şablon, yerleştirme, taşıma, sınırlar, bozuk kayıt) + sohbet gövdesi
  (`tierList` türü: tavanlar, renk/etiket temizliği, 🏅 önizleme, gidiş-dönüş kopya, sınırların çekirdekle eşitliği).
- `__tests__/tierListEditorScreen.test.js` — gerçek depo ile: dokun-seç / dokun-yerleştir, seçim çubuğu, kademe sayfası,
  içerik ekleme, sohbete gönder, tablolarım (oluştur / sil), sohbet balonundan kopya. Bir kural bilerek bozulunca kırmızı
  olduğu görüldü.
- Kapsam bekçileri: copyTablesSpanish, sectionVisibilityScreen, useSectionVisibility, glassCoverageGuard, glassPressRoom,
  posterChoicesCoverage, i18nKeys (yeni `paylas_tier_onizleme*` anahtarları 5 dilde).
- Android `expo export` derlendi. **Cihazda görülmedi**: yerleşim, cam düğmeler, görsel yakalama (afiş bekleme, 1080 px),
  galeri izni ve sistem paylaşımı yalnız cihazda doğrulanabilir.

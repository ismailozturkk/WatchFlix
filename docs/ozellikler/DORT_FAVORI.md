# Dört favori (profil vitrini)

Kullanıcı profiline **en fazla 4 film, 4 dizi ve 4 oyuncu** sabitler (Letterboxd "Four Favorites" benzeri).
Her kategoride 0–4 seçim geçerli; hiçbiri zorunlu değil.

> Kütüphanedeki `Lists/{uid}/favorites` ("kalp"li, sınırsız liste) ile **karıştırma**. Bu, küratörlü küçük bir vitrin;
> kodda hep `fourFavorites` / "four favorites" denir, "favorites" tek başına liste demektir.

## Veri

`Users/{uid}.fourFavorites = { movies: [], shows: [], people: [] }` — her giriş `{ id, title, image, year? }`
(başlık ve görsel yolu seçim anında kopyalanır; arkadaş profili TMDB isteği yapmadan çizilir). Ayrıntı ve örnek:
[FIRESTORE_DATABASE_SCHEMA.md](../mimari/FIRESTORE_DATABASE_SCHEMA.md).

- Alan **yok** → hiç seçilmedi. Boş yapı → "hepsini kaldırdı". Alanı silme: tanıtımdan kalan kopya geri sızar.
- Kural: kategori başına ≤ 4 (`firestore.rules` → `fourFavoritesOk`). İstemci zaten normalize eder; kural yalnız şişirmeyi keser.
  Kural deploy edilmeden de özellik çalışır (kural yalnız kısıtlıyor).
- Görünürlük profilin kendisiyle aynı (`privacy.profile`): gizli profilde favoriler de gizli.

## Akış

| Nerede | Ne olur |
|---|---|
| Tanıtım (kayıttan ÖNCE) | `OnboardingFavorites` adımı (CTA'dan hemen önce). Hesap yok → seçimler cihaza (`Keys.pendingFourFavorites`, `services/pendingFavorites.js`) |
| İlk profil yüklemesi | `UserProfileContext` → `adoptPendingFavorites`: hesapta alan YOKSA transaction ile yazar; VARSA dokunmaz; her iki durumda bekleyen kopya silinir. Çevrimdışıysa kopya kalır, sonraki snapshot'ta yeniden denenir |
| Profili Düzenle | "Dört favorin" bölümü; taslak durum, **Kaydet** ile yazılır (`isProfileEditDirty` favorileri de sayar) |
| Arkadaş profili | `FavoritesShowcase` (hero + sayaçlar altında): tek kompakt kart, kategori başına tek satır (ikon + etiket, sağda en çok 54 px'lik posterler/portreler), başlıksız; görsele dokununca detay |
| Kendi profil | **Gösterilmez** — favoriler yalnız Profili Düzenle'de görülür/düzenlenir (davet kartı da kaldırıldı) |
| "Profili paylaş" kartı | İçerik'te aç/kapa + kategori seçimi, Düzen'de "Seçki" düzeni; aşağıdaki bölüm |

## Öneriler

Aynı veri üç yerde işe yarar:

1. **Film / Dizi sekmesi — "Favorilerine Göre" rayı** (`FavoritesRecommendationRail`). Film rayı seçilen filmlerin
   `/movie/{id}/recommendations` listesi + oyuncuların en bilinen filmleri; dizi rayı aynısı diziler için. Çapraz tip yok.
   Sıralama saf: iki favorinin ortak önerisi öne çıkar, tek favori listeyi domine etmez (`rankRecommendations`).
   Favorileri ve **izlenmişleri eler** (`ListStatusContext.statusIndex`). Kaynak yoksa bölüm listeye hiç eklenmez.
2. **Seçici sayfası, sorgu yokken**: seçimlere göre öneri (oyuncuda: seçilen yapımların kadrosu), seçim yoksa popüler.
3. **AI sohbeti**: `buildFavoritesPrompt` → `buildLibraryContext(..., { favoritesBlock })`. "Kütüphane bağlamı" ana anahtarına
   bağlı; kapalıyken hiçbir kişisel veri modele gitmez.

## "Profili paylaş" kartında favoriler

`components/storyShare/ProfileStoryCard.js` (kart) + `ProfileStoryModal.js` (düzenleyici) + `utils/profileStoryCard.js` (saf mantık).
Veri `ProfileScreen` → `favorites={readProfileFavorites(profile)}` ile gelir.

- **Seçenekler** (kayıtlı tercih `Keys.profileStoryCard`, not hariç): `showFavorites` (varsayılan açık) ve `favoriteKinds`
  (`["movies","shows","people"]` alt kümesi; kanonik sıra, tekrarsız, boş olamaz). Kalp listesi poster kaynağı
  (`posterSource: "favorites"`) ile **karıştırma**: o ayrı bir seçenek.
- **İçerik sekmesi**: "Dört favori" anahtarı + kategori satırı. Kategori satırı poster-kaynak satırının YERİNE geçer
  (yalnız favoriler etkinken görünür; panel yüksekliği değişmez). Boş kategori seçilemez, son kategori kapatılamaz.
  Pasif düğmelere basınca önizleme üstünde NEDEN bandı çıkar (favori yok / posterlerin yerini favoriler alır / kategori boş).
- **Etkin = anahtar açık VE gösterilecek öğe var** (`isFavoritesActive`). Etkinken favoriler **poster alanının yerine** geçer:
  Vitrin/Kimlik/Minimal'de kategori başına üst üste binen küçük poster destesi ("şerit", `FAVORITE_RIBBON`; alan yüksekliği
  değişmez), Duvar'da kolaj hücreleri favori afişleriyle dolar. "Poster" düğmesi o sırada pasif. Anahtar kapalı/favori yoksa
  kart eskisiyle birebir aynı (jest referans karşılaştırmasıyla doğrulandı).
- **Düzen sekmesi — "Seçki" (`picks`)**: favorilerin büyük, adlı raflarla (3 kategoride etiket solda, 1–2'de rafın üstünde)
  gösterildiği 5. düzen. Favorisiz çizilemez: kart Vitrin'e düşer (`resolveStoryLayout`), kayıtlı tercih "picks" kalır
  (favori eklenince geri gelir); düzen kartı pasif, basınca neden bandı. Seçilince anahtar da açılır. Karıştır, favorisizken Seçki'yi seçmez.
- **Dikey bütçe çözülür, elle ayarlanmaz**: Seçki'de `planPicksLayout` (sabit bölüm yükseklikleri `PICKS_BUDGET` + kalan alan →
  raf boyutu `planFavoriteShelves`; yer yoksa önce ad satırı düşer, sonra poster küçülür). Her anahtar × kategori birleşiminde
  600 piksele sığma `__tests__/profileStoryCard.test.js`te kilitli. Bir bölümün yüksekliğini değiştirirsen sabiti de değiştir.
- **Hazır kapısı**: paylaş/kaydet, kartta ÇİZİLEN görselleri bekler (favoriler etkinse favoriler, değilse poster alanı).
  Favori görselleri `getTmdbUrl(..., 200)` ile istenir (poster için 400 isteyen mevcut yol "original"e düşüyor; 12 görsel için ağır olurdu).
- **Testler**: `profileStoryCard.test.js` (mantık + bütçe), `profileStoryCardFavorites.test.js` (kart × düzen × favorili/favorisiz),
  `profileStoryModalFavorites.test.js` (etkileşim, kapı, karıştır); ortak sahte veri `__tests__/helpers/storyCardFixtures.js`.
- **Doğrulama sınırı**: react-native-web önizlemesinde 5 düzen × paletler × TR/EN × 1–3 kategori × görselsiz görüldü ve
  gerçek tarayıcı yerleşimiyle ölçüldü (en kalabalık Seçki 558/600 piksel, planlayıcı tahmini 560). Cihazda (iOS/Android yazı
  tipi, 1080x1920 yakalama, Yoga) GÖRÜLMEDİ.

## Dosya haritası

- Saf çekirdek (jest'te): `utils/fourFavorites.js`, `utils/favoritesCopy.js` → `__tests__/fourFavorites.test.js`, `favoritesCopy.test.js`
- Servisler: `services/fourFavoritesService.js` (kayıt, aktarma, arama, seçici önerisi), `services/favoriteRecommendations.js`, `services/pendingFavorites.js`
- Arayüz: `components/favorites/` (`FavoritesEditor` ortak düzenleyici, `FavoriteSlots`, `FavoritePickerSheet`, `FavoritesShowcase`, `FavoritesRecommendationRail`)
- Ölçüm: `four_favorites_saved`, `favorites_rec_opened`, `onboarding_completed.favorites_count`

## Tuzaklar

- **TMDB önbellek anahtarı URL'dir**: `cachedTmdb`'e verilen sorgu parametreleri URL'in İÇİNDE olmalı (`readTmdb` böyle yapar).
- `combined_credits.cast` dizisini ağ katmanındaki yetişkin süzgeci görmez (yalnız `results`'a bakar); `creditsToCandidates` `adult`'u kendisi eler.
- Onboarding adımı `ONBOARDING_STEP_ORDER`'da CTA'dan önce: önceki adım adları/sıraları değişmedi, yalnız kayıt slaytının `step_number`ı 6 → 7.
- Yeni `settings` anahtarları (`pendingFourFavorites`) ayarlar yedeğine bilerek GİRMEZ (`BACKUP_EXCLUDED`).

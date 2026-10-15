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
| Arkadaş profili | `FavoritesShowcase` (hero + sayaçlar altında), görsele dokununca detay |
| Kendi profil | `OwnFavoritesCard`: favori varsa vitrin + Düzenle; yoksa kapatılabilir davet (`Keys.favoritesInviteDismissed`) |

## Öneriler

Aynı veri üç yerde işe yarar:

1. **Film / Dizi sekmesi — "Favorilerine Göre" rayı** (`FavoritesRecommendationRail`). Film rayı seçilen filmlerin
   `/movie/{id}/recommendations` listesi + oyuncuların en bilinen filmleri; dizi rayı aynısı diziler için. Çapraz tip yok.
   Sıralama saf: iki favorinin ortak önerisi öne çıkar, tek favori listeyi domine etmez (`rankRecommendations`).
   Favorileri ve **izlenmişleri eler** (`ListStatusContext.statusIndex`). Kaynak yoksa bölüm listeye hiç eklenmez.
2. **Seçici sayfası, sorgu yokken**: seçimlere göre öneri (oyuncuda: seçilen yapımların kadrosu), seçim yoksa popüler.
3. **AI sohbeti**: `buildFavoritesPrompt` → `buildLibraryContext(..., { favoritesBlock })`. "Kütüphane bağlamı" ana anahtarına
   bağlı; kapalıyken hiçbir kişisel veri modele gitmez.

## Dosya haritası

- Saf çekirdek (jest'te): `utils/fourFavorites.js`, `utils/favoritesCopy.js` → `__tests__/fourFavorites.test.js`, `favoritesCopy.test.js`
- Servisler: `services/fourFavoritesService.js` (kayıt, aktarma, arama, seçici önerisi), `services/favoriteRecommendations.js`, `services/pendingFavorites.js`
- Arayüz: `components/favorites/` (`FavoritesEditor` ortak düzenleyici, `FavoriteSlots`, `FavoritePickerSheet`, `FavoritesShowcase`, `OwnFavoritesCard`, `FavoritesRecommendationRail`)
- Ölçüm: `four_favorites_saved`, `favorites_rec_opened`, `onboarding_completed.favorites_count`

## Tuzaklar

- **TMDB önbellek anahtarı URL'dir**: `cachedTmdb`'e verilen sorgu parametreleri URL'in İÇİNDE olmalı (`readTmdb` böyle yapar).
- `combined_credits.cast` dizisini ağ katmanındaki yetişkin süzgeci görmez (yalnız `results`'a bakar); `creditsToCandidates` `adult`'u kendisi eler.
- Onboarding adımı `ONBOARDING_STEP_ORDER`'da CTA'dan önce: önceki adım adları/sıraları değişmedi, yalnız kayıt slaytının `step_number`ı 6 → 7.
- Yeni `settings` anahtarları (`pendingFourFavorites`, `favoritesInviteDismissed`) ayarlar yedeğine bilerek GİRMEZ (`BACKUP_EXCLUDED`).

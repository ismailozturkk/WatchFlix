# Devam notu — Atmosfer evrenleri ve gizli evrenler (13 Kas 2026)

Başka bir Claude Code hesabıyla devam etmek için hazırlanan devir notu. Kodun
tamamı çalışma ağacında; **commit yok**. Firestore kuralları **deploy edildi**.
Cihazda hiç denenmedi; doğrulama yalnızca jest testleri ve Skia render harness'iyle yapıldı.

## Çalışma kuralları (kullanıcıdan)

- Yanıtlar Türkçe.
- Kullanıcı istemedikçe commit yok. `git stash` asla kullanılmaz.
- Codex aynı klasörde aynı anda çalışıyor. Başkasının değişikliklerine dokunma; deploy'dan önce canlı kurallarla karşılaştır.
- Sahnelerde logo veya amblem yok, yalnızca "esinli silüet".
- Skia worklet kuralları:
  - `Glow` bileşeninin `cx`/`cy` değerine SharedValue verilmez; parıltıyı taşımak için Group transform kullanılır.
  - Worklet yardımcıları kullanılmadan önce tanımlanır.
  - `t * değişkenHız` kullanılmaz.
  - Gradyan durağı olarak `"rgba(0,0,0,0)"` değil, `rgba(renk, 0)` kullanılır.

## Yapılanlar

### 1. Altı yeni evren sahnesi
- Evrenler: Geleceğe Dönüş, The Shining, The Witcher, Fallout, Money Heist, Arcane.
- Dosyalar: `components/decor/{bttf,shining,witcher,fallout,moneyHeist,arcane}Scene.js`, overlay id'leri 71–76.
- Toplam 40 evren: 17 film, 12 dizi, 11 anime.

### 2. Sahne başına iki olay
- Olay A ve olay B döngüden döngüye sırayla oynar.
- `utils/weatherParticles.js` içinde `eventPick(p, t, n)` ve `eventU(p, t, k)` bunu yönetir.
- İki olaylı sahneler: 6 yeni sahne, One Piece, Sherlock ve eskiden `restU` kullanan 19 sahne. Bu 19 sahne: Titanic, Inception, Karayip Korsanları, Mad Max, Avatar, Jurassic Park, Interstellar, Blade Runner, Dark, Squid Game, The Last of Us, Stranger Things, Death Note, Naruto, FMA, Jujutsu Kaisen, Hunter x Hunter, Ghibli, Demon Slayer.
- B olaylarının açıklaması `SEASON_EVENT` yorumlarında "B: …" olarak yazılı.
- Tek olaylı kalanlar:
  - Kendi uzun, çok aşamalı sinematiği olan 12 sahne (her birinde bir `xxxFrame` zaman çizelgesi var): HP, AoT, Batman, Breaking Bad, Dune, GoT, LOTR, Matrix, Prison Break, Rick & Morty, Spider-Man, Vikings.
  - Star Wars.

### 3. Gizli evrenler (son tasarım)
"İzleyince açılır" yaklaşımı tamamen kaldırıldı. İzlendi olarak işaretlemek evreni AÇMAZ.

**Akış**
1. Yapım izlenmemişse detay sayfasında evrenle ilgili hiçbir şey görünmez.
2. İzlendi olarak işaretlenince detayda "?" kart belirir (`components/decor/UniversePreviewCard.js` → `SecretCard`).
3. Karta dokununca `components/decor/UniverseRiddleSheet.js` evrenin kapı sorusunu sorar. İpucu yok; yanlış cevapta alan sallanır.
4. Doğru cevap verilince evren açılır ve "Yeni evren keşfettin: X" bildirimi çıkar. Kart sahne önizlemesine ve "Atmosfere ekle" düğmesine dönüşür.

**Sorular**
- `utils/universeRiddles.js` içinde 40 soru var.
- Cevaplar dilden bağımsız özel adlar ya da sayılar; yerelleştirilmiş adlar eşanlamlı olarak eklenir.
- Soru metinleri `autoI18n.evren_soru_<id>` anahtarıyla 6 dile çevrildi.
- Eşleştirme kuralları:
  - Büyük/küçük harf, Türkçe harfler, aksanlar ve noktalama yok sayılır.
  - En çok 3 kelimelik yazımda doğru kelimenin geçmesi yeterli.
  - 5 harften uzun cevaplarda 1, 9 harften uzun cevaplarda 2 harf hatası kabul edilir.
  - Sayılarda hata payı yok.

**Atmosfer ekranı**
- Açılmamış evren adsız, kesik çerçeveli bir "?" çip olarak görünür. Dokununca yalnızca "Henüz keşfedilmedi" yazar.
- Sayaçlar (N/M) yerinde duruyor.
- Şu an seçili olan evren kilitli olsa da çalışmaya devam eder.
- "Türe göre" modu, yapımın evrenini yalnızca açılmışsa çizer (`WeatherLayer`).

**İlgili dosyalar**
- `utils/universeUnlocks.js`: saf kurallar (`isTitleWatched`, `unlockedUniverses`, `solvedFromDoc`, `buildUniverseDoc`, `withSolved`).
- `hooks/useUniverseUnlocks.js`: `{ unlocked, count, total, isUnlocked, solve }` döndürür.
- `components/settings/AtmosphereControls.js`: gizli çip.
- `screens/tabs/settings/AtmosphereScreen.js`
- `components/decor/WeatherLayer.js`

### 4. Bulut kaydı ve okuma/yazma yükü
- Kayıt yerel-öncelikli tek bir belgede: `Users/{uid}/private/universes`, yapısı `{ id: "all", solved: { [evrenId]: ms }, updatedAt }`.
- Kod: `services/userData/domains.js` (`universeUnlocksSpec`), `index.js` (`universeUnlocksDomain`, `ALL_DOMAINS`), `utils/cacheKeys.js`, `utils/cacheStore.js` (DURABLE).
- Okuma: cihaz başına 1 kez, yalnızca yerel kopya yokken. Yazma: çözülen her evren için 1. Buluta dinleyici açılmaz.
- Yazma `merge: true` ile yapılıyor; iki cihazda açılan evrenler bulutta birbirini ezmeden birleşir. Bunun için motora yeni bir bayrak eklendi: `createDomain.apply` → `outbox.enqueue` (record.merge) → `firestoreRemote.commit` (`set(..., {merge:true})`).
- Hesap silinince belge `private/*` ile birlikte silinir.
- Firestore kuralı `universesDocOk` (yalnızca `id`/`solved`/`updatedAt` alanları, harita en fazla 64 kayıt) **13 Kas 01:09 UTC'de deploy edildi**. Deploy sonrasında canlı kurallar çalışma ağacıyla birebir aynıydı.
- Canlı kurallarda Codex'in `betaFeatureVotes` bloğu da var; bu blok henüz commit'te değil.

### Kaldırılanlar
- TMDB koleksiyon çözme: `universeCollectionParts` depo anahtarı ve `rememberUniverseCollection`; `MovieDetail` içindeki çağrılar da silindi.
- Eski çeviri anahtarları: `evren_kilitli_*`, `evren_izleyince_acilir`, `evren_onizleme_*`.

### 5. Gece oturumu (13 Kas, kullanıcı onayıyla "hepsini yap")
- **Cevap eşleştirme:** bitişik Türkçe ek kabul (≥4 harfli cevapta en çok 3 harf: "Hawkinste", "Pandoraya"). Eşanlamlılar: Arcane `polvorita/polvora`, Geleceğe Dönüş `141/142` (km/s), Inception `mal cobb`, LOTR `samvise`.
- **Evren günleri:** `utils/universeUnlocks.js` → `UNIVERSE_DAYS` + `universeDayUniverses(date)` (4 Mayıs Star Wars, 21 Eki BTTF, 31 Tem/1 Eyl HP, 25 Mar/22 Eyl LOTR, 6 Kas Stranger Things, 15 Nis Titanic, 1 Ağu Spider-Man, 7 Eyl BB, 5 May One Piece, 10 Eki Naruto, 27 Haz Dark). O gün GEÇİCİ açık: seçilebilir + türe göre çizilir; sayaçlara girmez, detaydaki gizli kart (`isSolved`) yine soru sorar. Kanca: `today`, `isSolved`, `canDraw`. Atmosfer ekranında "Bugün X günü" notu (`autoI18n.evren_gunu`, 6 dil).
- **Gizli replikler:** `utils/universeQuotes.js` (34 evren). Arama ekranı (`screens/tabs/SearchScreen.js`) yazarken TAM eşleşmede, arama tuşunda harf hatası payıyla evreni KALICI açar + "Yeni evren keşfettin" bildirimi. Test: `__tests__/universeQuotes.test.js`; `searchHeader.test.js`'e iki mock eklendi.
- **12 sinematik sahneye olay B:** `components/decor/sceneEventsB.js` (kuzgunlar, kızıl kuyruklu yıldız, baykuş+mektup, havai fişek, yarasa sürüsü, helikopter ışıldağı, déjà vu kedisi, ornitopter, kancalı asker, portal+turşu, pembe ayı, ışıldaklar). 12 `xxxFrame` artık `eventU(p, t, 0)`. Frame testlerinin `tAt`'i çift döngüye (olay A) çekildi. Canvaskit ile çizilip kontrol edildi (harness: scratchpad `bRender.test.js.txt`, `F_U` + `F_CYCLE`; zamanlayıcı = en uzun periyotlu vektör parçacık).
- **Testçi duyurusu taslağı:** `docs/planlama/DUYURU_GIZLI_EVRENLER_TASLAK.md` (gönderilmedi).
- `tmp-ikinci-olay-*.png` silindi (kökteki diğer `tmp-*` başka işlerin, dokunulmadı).

## Testler

| Test | Kapsam | Sonuç |
|---|---|---|
| `__tests__/universeUnlocks.test.js` | kurallar, 40 sorunun cevapları, eşleştirme, 6 dil, alan belgesi, merge bayrağı, eventPick/eventU | 14 test, geçti |
| `__tests__/universeSecretCard.render.test.js` | gizli kart → soru → yanlış/doğru cevap → açık kart | geçti |
| `__tests__/rules/firestore.rules.test.js` | "evren belgesi" testi | 394/394 geçti |

- Rules testleri JDK 21 ister:
  ```bash
  export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npm run test:rules
  ```
- Bilinen kırmızılar bu işten değil:
  - `i18nKeys` ve `gameSetupFlow`/`quickGameScreen`: Codex'in `components/common/BetaBadge.js` değişikliğinden geliyor.
  - `glassCoverageGuard`: `HoldToConfirmButton.js:94`.
- `userDataSyncWorker` ve `userDataContexts` ağır paralel yükte bir kez zaman aşımına düştü; tek başına ve tekrar çalıştırınca geçiyor.

## Açık işler / sıradaki adımlar

1. **Cihazda deneme:** Soru sayfasında klavyenin davranışı, "?" çiplerin görünümü, gizli kart ve keşif bildirimi.
2. **Cevapları gözden geçirme:** Kullanıcı soruların cevaplarını kontrol etmeli. Örneğin Arcane için "Powder" bekleniyor; Türkçe dublajda farklı bir ad kullanılıyorsa `answers` listesine eklenmeli.
3. **Testçiler için davranış değişikliği:** Daha önce serbestçe seçilebilen evrenler artık kilitli. Duyurulması gerekebilir.
4. **Commit:** Yalnızca kullanıcı isterse. Paylaşılan ağaçta yalnızca bu işin dosyaları tam yollarıyla eklenmeli.
5. **İsteğe bağlı fikirler (kullanıcı henüz onaylamadı):**
   - Gizli replikleri arama kutusunda kabul etmek.
   - Özel günlerde evren açmak (4 Mayıs Star Wars, 21 Ekim Geleceğe Dönüş).
   - Kalan 12 sinematik sahneye ikinci olay eklemek.
6. **Temizlik:** Proje kökündeki önizleme görselleri `tmp-ikinci-olay-*.png` silinebilir.

## Bu işin dosyaları (commit için)

```
utils/universeRiddles.js            (yeni)
utils/universeUnlocks.js
hooks/useUniverseUnlocks.js
components/decor/UniverseRiddleSheet.js   (yeni)
components/decor/UniversePreviewCard.js
components/decor/UniverseCollectionPill.js
components/decor/WeatherLayer.js
components/decor/{bttf,shining,witcher,fallout,moneyHeist,arcane}Scene.js (yeni)
components/decor/*Scene.js          (19 sahnede olay B)
components/decor/OverlayLayers.js
components/settings/AtmosphereControls.js
screens/tabs/settings/AtmosphereScreen.js
screens/movie/MovieDetail.js  screens/tv/TvShowsDetails.js  screens/tabs/LibraryScreen.js
components/detail/DetailContentSections.js
services/userData/{domains,index,createDomain,outbox,firestoreRemote}.js
utils/cacheKeys.js  utils/cacheStore.js
utils/weatherParticles.js  utils/weatherUniverses.js
firestore.rules  (Codex'in betaFeatureVotes bloğu da bu dosyada)
translations/{tr,en,de,es,it,pt}.json
__tests__/universeUnlocks.test.js  __tests__/universeSecretCard.render.test.js
__tests__/seasonScenes.test.js  __tests__/weatherParticles.test.js  __tests__/weatherUniverses.test.js
__tests__/rules/firestore.rules.test.js
```

Not: Bu listedeki bazı dosyalarda (ör. `MovieDetail.js`, `TvShowsDetails.js`, `LibraryScreen.js`, `translations`) Codex'in ya da önceki oturumların başka değişiklikleri de olabilir. Commit'ten önce `git diff` ile kontrol edilmeli.

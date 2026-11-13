# Meydan Okumalar (Challenges)

Kaynak: `docs/planlama/OZELLIK_ADAYLARI_2026-10-30.md` → **E4**. 30 Ekim 2026'da planlandı ve kodlandı.

> Hazır, süreli görevler: "52 haftada 52 film", "7 gün, 7 film", "Kore dalgası", "Ekim: 13 korku filmi",
> "Nolan'ın tüm filmleri", "Aamir Khan maratonu". Katıl; ilerleme izleme geçmişinden kendiliğinden dolar; bitirince madalya.

## Özet

| | |
|---|---|
| Yer | Eğlence → "Meydan okumalar" kartı (Top 100'ün altında) · Profil → rozet şeridinin altında madalya satırı (yalnız madalya varsa) |
| Rota | `ChallengesScreen` (parametre `openId`: o görevin sayfası açık gelir — tamamlama toast'ı bunu kullanır) |
| Premium | Yok (tüm planlarda açık). |
| Build / Deploy | Hayır / Hayır — kayıt cihaz-yerel (`Keys.watchChallenges`), film ayrıntısı önbellekli TMDB okuması. |
| Bölüm görünürlüğü | `hub` ekranında `challenges` (Ayarlar > Ekran bölümleri). |

## Görevler

5 Kasım 2026 genişlemesi: 10 hazır görev → **48**, 10 yönetmen → **59 yönetmen + 43 oyuncu**; ekran yeniden düzenlendi.

| Grup | Kimlikler | Kural | Pencere |
|---|---|---|---|
| Bu aya özel | `jan_films` · `feb_romance` · `mar_mystery` · `apr_animation` · `may_adventure` · `jun_action` · `jul_scifi` · `aug_comedy` · `sep_crime` · `oct_horror` · `nov_thriller` · `dec_family` | her ayın kendi türünden 6–13 film (Ocak: herhangi 12 film) | takvim ayı |
| Maraton | `films10_30` · `films30_30` · `films52` · `films100_365` | 10 / 30 / 52 / 100 film | 30 / 30 / 364 / 365 gün |
| | `streak7` | art arda 7 gün her gün film (`streak`) | 30 gün |
| | `movie_day3` | aynı gün 3 film (`sameDay`) | 30 gün |
| | `short10` · `long5` · `epic3` | ≤ 90 dk 10 film · ≥ 150 dk 5 · ≥ 180 dk 3 | 30 / 60 / 90 gün |
| Tür maratonları | `scifi8` · `animation6` · `comedy10` · `doc5` · `fantasy6` · `war6` · `western5` · `music5` | o türden N film | 30–90 gün |
| Dünya sineması | `turkish10` · `korean5` · `japanese5` · `indian5` · `french5` · `iranian3` · `latam5` | birincil ülkesi kümede N film (`country`) | 60–90 gün |
| | `europe6` · `asia5` · `countries10` | bölgede / her yerde FARKLI ülke sayısı (`countries`, `within`) | 90 / 90 / 180 gün |
| Keşif | `decades` · `genres10` | 8 on yıl · 10 tür | 180 / 90 gün |
| | `classics5` | ≤ 1969 yapımı 5 film (`era`) | 90 gün |
| | `recent10` | katılım yılı ve önceki yıl yapımı 10 film (`recent`) | 60 gün |
| | `gems5` | TMDB puanı ≥ 7,3, 20–3000 oy, 5 film (`gems`) | 90 gün |
| Dizi | `episodes100` · `episodes30_7` | 100 / 30 farklı bölüm | 30 / 7 gün |
| | `binge10` | tek günde 10 farklı bölüm (`episodeDay`) | 30 gün |
| | `shows5` | 5 farklı dizi (`shows`) | 60 gün |
| Puan | `rate10_7` · `rate25_30` · `rate50_90` | katıldıktan sonra YENİ puanlanan 10 / 25 / 50 yapım (`rated`) | 7 / 30 / 90 gün |
| | `rateShows5` | yeni puanlanan 5 dizi (`rated`, `lane: "tv"`) | 30 gün |
| | `rateRange5` | yeni puanlarda 5 farklı yıldız kademesi (`ratingRange`) | 30 gün |
| Yönetmenler | `director_<kişiId>` | yönettiği filmlerin tamamı (`person`) | süresiz, tüm geçmiş |
| Oyuncular | `actor_<kişiId>` | başrolde olduğu filmler (`person`) | süresiz, tüm geçmiş |

Kişiler (5 Kas üretimi, `tr` = Türk sineması süzgeci): yönetmenlerde eski 10'a ek Zeki Demirkubuz, Spielberg, Scorsese,
Hitchcock, Coppola, Ridley Scott, Cameron, Burton, Ritchie, P. T. Anderson, Joel Coen, Lynch, Park Chan-wook, Wong Kar-wai,
Tarkovsky, Bergman, Fellini, Leone, Kieślowski, Almodóvar, del Toro, Cuarón, Iñárritu, Kore-eda, Satoshi Kon, Lanthimos,
Aronofsky, Edgar Wright, Chazelle, Gerwig, Peele, Aster, Haneke, Farhadi, von Trier, Eastwood, Yılmaz Güney, Özpetek, Fatih
Akın, Kaplanoğlu, Turgul, Çağan Irmak, Reha Erdem, Ömer Kavur, Ertem Eğilmez, Atıf Yılmaz. Oyuncularda Aamir Khan, Shah Rukh
Khan, DiCaprio, Hanks, Pitt, Streep, Reeves, Cruise, Washington, Cillian Murphy, Phoenix, Bale, De Niro, Pacino, Day-Lewis,
Freeman, Depp, Carrey, Hopkins, Gosling, Portman, Johansson, Winslet, Blanchett, Emma Stone, Hepburn, Brando, Nicholson,
Jackie Chan, Song Kang-ho, Mifune, Kemal Sunal, Şener Şen, Türkan Şoray, Tarık Akan, Cüneyt Arkın, Hülya Koçyiğit, Münir
Özkul, Haluk Bilginer, Cem Yılmaz, Yılmaz Erdoğan, Adile Naşit, Kadir İnanır.

**Ekran:** üst şerit (süren / madalya / görev sayısı) → süren görev kartları (kalan gün hapı, tempo, son sayılan afişler) →
grup süzgeci (Tümü + her grup) → kişi dışı gruplar iki sütunlu döşeme ("30 gün" / "Bu ay" / "Süresiz", katılmadan sayılacak
varsa "N hazır" çubuğu) → kişi grupları: Tümü · Türk sineması · Dünya süzgeci, başladıkların önde yatay ray (ilk 12) +
"Tümünü gör" ile cam arama kutulu üç sütunlu ızgara. Parçalar `components/challenges/ChallengeCatalog.js`.

## Kurallar

1. **Pencere** — `rolling`: katıldığın GÜN başlar, önceki izlemeler sayılmaz. `month`: yalnız o ayda katılınır ve ayın
   TAMAMI sayılır (ayın 10'unda katılan 1'indeki filmi de sayar). `open` (yönetmen): tüm geçmiş.
2. **Tarih** izleme tarihidir (kayıt tarihi değil), yerel takvim — `utils/yearlyGoal.js` ile aynı kural.
3. **Farklı eser** sayılır: aynı filmi iki kez izlemek bir; bölümde farklı (dizi, sezon, bölüm).
4. **Tür** saklı adın kanonik id'si (`utils/genreCanon.js`); dil değiştiren kullanıcı türü iki kez saymaz. "other" sayılmaz.
5. **Yıl / ülke / puan** izleme kaydında yok → `/movie/{id}` ayrıntısı (`services/watchChallengeMeta.js`, 30 gün önbellek;
   `{ year, country, rating, votes }`). Yalnız ETKİN `decades`/`countries`/`country`/`era`/`recent`/`gems` görevlerinin
   penceresindeki filmler okunur. Ayrıntısı gelmemiş film **bekliyor**: sayılmaz
   ve bekleyen varken görevin süresi dolmuş sayılmaz.
6. **En çok 8** etkin görev (`MAX_ACTIVE_CHALLENGES`). Aynı göreve ikinci kez aynı anda katılınmaz.
7. **Sonuç** veri hazır olunca hesaplanır: hedefe ulaşan **tamamlanır** (toast + madalya), penceresi geçen **süresi dolar**
   (Geçmiş). Biten kayıt dondurulur — sonradan izleme silinse de madalya geri alınmaz.
8. **Bırak** iki adımlı onay (sayfa içinde; iOS'ta açık Modal üstüne uyarı sunulamaz). Bırakılan görev kayıttan SİLİNİR.
9. Kişi (yönetmen / oyuncu) görevi bir kez bitince yeniden katılınmaz; diğerleri yeniden katılınabilir.
10. Seri / tek gün görevlerinde (`streak`, `sameDay`, `episodeDay`, `ratingRange`) tempo satırı yok: doğrusal ilerlemezler.
11. **Puan görevleri** (13 Kas; Zevk Çemberleri eşleşme gücünü besler): puanın TARİHİ tutulmuyor
    (`Lists/{uid}.activityIndex.ratings` yalnız anahtar → 0-10). Katılırken o anki puanlı anahtarlar kayda `baseline`
    yazılır; ilerleme = şimdi puanlı olup başlangıçta OLMAYAN yapımlar. Eski puanı değiştirmek sayılmaz; puanı silip
    yeniden vermek de (başlangıçta var). Liste yüklenmeden katılınmaz (`join` → "loading"). Önizleme 0 gösterir.
    Bilinen sınır: pencere bittikten sonra, uygulama açılmadan verilen puanlar sonuçlandırmada sayılabilir.
    `ratingRange` kademeyi `Math.round` (yarım yıldız = 1) ile alır. Ad/afiş açık listelerden eşlenir (bulunamazsa
    simge). Yeni Firestore okuması yok.

## Kayıt

`Keys.watchChallenges` = `{ runs: [{ id, joinedAt: "YYYY-AA-GG", status: "active"|"done"|"expired", endedAt?, count?, target?, baseline? }] }`.
`baseline` yalnız ETKİN puan görevinde (en çok 20000 anahtar); başlangıcı olmayan etkin puan kaydı okumada düşer.
Kullanıcı kapsamlı, çıkışta silinmez, bulut kopyası yok. Bitmiş kayıt en çok 60 (önce en eski süresi dolanlar düşer).
Hesabı Sıfırla bu anahtarı siler (`services/accountResetService.js` yerel ilerleme listesi).

## Dosyalar

| Dosya | İş |
|---|---|
| `utils/watchChallenges.js` | Saf çekirdek: katalog, pencere, ilerleme, tempo, katıl/bırak, sonuçlandırma, normalize |
| `data/challengeFilmographies.js` | ÜRETİLMİŞ — `scripts/build-challenge-filmographies.mjs` |
| `utils/watchChallengesCopy.js` | 5 dil metin (`copyTablesSpanish` bekçisinde) |
| `services/watchChallengeMeta.js` | Film yılı + birincil ülke + TMDB puanı/oy okuması (bellek + disk önbelleği), kişi başlıkları |
| `hooks/useWatchChallenges.js` | Depo + ProfileStats verisi + ayrıntı + sonuçlandırma/kutlama (yeni dinleyici açmaz) |
| `screens/fun/ChallengesScreen.js` | Üst şerit · süren görevler · grup süzgeci · katalog · madalyalar · geçmiş |
| `components/challenges/ChallengeCatalog.js` | Üst şerit, süzgeç, döşemeler, kişi bölümü (ray/ızgara/arama), süren görev kartı |
| `components/challenges/ChallengeSheet.js` | Ayrıntı: ilerleme, sayılanlar (kurala göre), katıl/bırak |
| `components/challenges/ChallengeParts.js` | Madalya, çubuk, afiş (özel afiş çözücüsünden) |
| `components/challenges/ChallengeMedalsRow.js` | Profil madalya satırı |
| `components/hub/ChallengesWidget.js` | Eğlence kartı |

Testler: `__tests__/watchChallenges.test.js` (çekirdek, metin kapsamı, ayrıntı ayrıştırma),
`__tests__/challengesScreen.test.js` (kart → ekran → sayfa → katıl/bitir/bırak, profil satırı, mevsim, ayrıntı isteği,
grup süzgeci, "N hazır", kişi rayı/ızgarası/arama/Türk sineması süzgeci, oyuncu sayfası).

## Filmografi üretimi

`node scripts/build-challenge-filmographies.mjs` (TMDB anahtarı `TMDB_READ_TOKEN` ya da `.env`; film ayrıntıları
`node_modules/.cache/challenge-filmographies.json`'da). Yönetmen: iş "Director". Oyuncu: kadroda ilk 4 sıra; "Himself /
Herself", arşiv ve isimsiz rol değil. Ortak: yayınlanmış, yetişkin/belgesel değil, süre ≥ 60 dk, ≥ 50 oy (oyuncu 80, Türk
sineması 4), `EXCLUDED`'da değil (antoloji, yeniden kurgu, klip derlemesi). 40'tan fazlaysa en çok oy alan 40 film kalır
(`capped` → "en bilinen N"); 3'ten az film kalan kişi yazılmaz. Kişi listesi `PEOPLE`'da; kimliği yoksa adla aranır (önce
TAM ad eşleşmesi) ve çıktıda kimlik yazılır — yanlış kişi bulunursa kimliği sabitle (Park Chan-wook: 10099).
`movie_credits` süre vermediği için her film ayrıntısı okunur — bu yüzden cihazda değil, önceden. Yeni film çıkınca ya da
yönetmen eklenince script yeniden çalıştırılır; hedef değişir, ama biten kayıtlar dondurulduğu için madalyalar etkilenmez.

**Başlık dili:** veri dosyasındaki başlıklar İngilizce. Ayrıntı sayfası açılınca seçili dilde başlıklar
`/person/{id}/movie_credits?language=…` ile okunur (`fetchPersonTitles`; oyuncuda `cast`, 30 gün önbellek; İngilizcede istek yok).
TMDB çeviri yoksa ÖZGÜN adı döndürür (Kurosawa → Japonca yazı) — bu durumda İngilizce kalır; film zaten o dilde çekildiyse
(Ceylan, Türkçe) özgün ad kullanılır. Kural `localizedPersonTitles`'ta. Ağ yoksa İngilizce görünür.

## Açık / sonraki

- **Arkadaşla ortak katılım** (adaydaki "arkadaşla ortak"): karşılıklı ilerleme için Firestore + rules gerekir; yapılmadı.
- **Kendi meydan okumanı kur** (aday Premium fikri): yapılmadı.
- Haftalık Lig'e XP (görev bitirince) — lig paralel oturumda geliştiriliyordu; bağlanmadı.
- Takip edilen yönetmenlerden dinamik görev: kısa film ayıklaması cihazda pahalı; yapılmadı.
- Cihazda görülmedi (5 Kas yeniden düzenlemesi dahil: iki sütunlu döşemeler, kişi ızgarası 320 pt'te, cam arama kutusu,
  bayrak emojisi Android). Yalnız jest ile doğrulandı.
- Cem Yılmaz listesinde "Bifo & CMYLMZ" (stand-up kaydı olabilir) var; gerekirse `EXCLUDED`'a eklenip script yeniden çalıştırılır.

# Devam notu — Zevk Eşleşmesi (13 Kas)

Rehber: [ZEVK_ESLESMESI_UYGULAMA_REHBERI.md](ZEVK_ESLESMESI_UYGULAMA_REHBERI.md) ·
Kurallar: [../ozellikler/ZEVK_ESLESMESI_ALGORITMA.md](../ozellikler/ZEVK_ESLESMESI_ALGORITMA.md) (v3.1)

## Bitti: Faz 1 (saf çekirdek)

| Dosya | İçerik |
|---|---|
| `utils/tasteMatchV3.js` | `buildContext`, `buildProfile`, `scorePair`, `verdictOf`, tavanlar, `laneOf`. Yalnız `genreCanon`'a bağlı; profil düz JSON. |
| `__tests__/tasteMatchV3.test.js` | D1–D10 + tavan tabloları + yardımcılar — 30/30 geçiyor. |
| `__tests__/helpers/tasteSynth.js` | Sentetik dünya (gizli zevk vektörleri, Zipf popülerlik). |
| `scripts/sim/tasteMatchV3.sim.js` | Tam ölçek ölçüm, 3 tohum, ~45 sn. `npm test` dışında. |

Simülasyon komutu:

```bash
npx jest --rootDir . --testMatch "**/scripts/sim/*.sim.js" --testPathIgnorePatterns "/node_modules/"
```

Kodlamada kurala işlenen üç düzeltme ve yeni ölçümler: algoritma belgesi §3.2, §3.3, §10, §12, §16.

## Doğrulanmayanlar

- Gerçek kullanıcı verisiyle hiçbir şey ölçülmedi; tüm sayılar sentetik.
- Cihazda / arayüzde hiçbir şey yok (çekirdek hiçbir ekrana bağlı değil).
- ÖLÇEK 1.10 sentetik dünyada %90'a neredeyse kimseyi çıkarmıyor; bilinçli (kesinlik önce).
  Gerçek eşik Faz 7 kalibrasyonunda.
- Hiçbir şey commit edilmedi.

## Tam jest paketi (13 Kas)

9308/9314 test geçti. Başarısız 7 dosya bu işle ilgisiz, başka oturumların commitlenmemiş
değişikliklerinden: `i18nKeys`, `devPlanSimulatorCard`, `glassCoverageGuard`, `gameSetupFlow`,
`quickGameScreen`, `dailyFrameScreen`, `streakFlame`. Hiçbiri `tasteMatchV3`'ü içe aktarmıyor.

## Bitti: Faz 2 (gölge mod) — kod hazır, gerçek çiftlerde BAKILMADI

| Dosya | İçerik |
|---|---|
| `utils/tasteMatchV3Adapter.js` | `sideToTasteUser` (tasteMatch.js taraf şekli → çekirdek girdisi), `shadowCompare` (film / dizi / karma kulvar özeti). Gizli liste okunmaz; puan yalnız görünür izlenen/favori için. |
| `services/tasteShadowLog.js` | Bellekte son 20 arkadaş; yalnız `__DEV__` yazar/okur. |
| `components/settings/DevTasteShadowCard.js` | DevLab tablosu: eski yüzde, yeni skor, K1/K2/K3, E1, bağlayan tavan, bayraklar. |
| `FriendProfileScreen.js` | `__DEV__` + `tasteReady` iken `useEffect` ile gölge hesap; ekranda hiçbir şey değişmez. |
| `DevLabScreen.js` | "Zevk uyumu: eski / yeni (gölge mod)" bölümü. |
| `__tests__/tasteMatchV3Adapter.test.js` | 10 test. |

İstemcide eksik veri yüzünden bilinçli sınırlar: K3 lite (tür + süre; yıl yok), anime ayrı kulvar
değil (köken dili yok), "yarıda bıraktı" çıkarılmaz (yayın durumu yok), bağlam `{}` (nüfus yok →
varsayılan tablolar). "Karma" kulvarı yalnız eski kartla kıyas için; tasarımda kulvarlar ayrı.

**Kabul ölçütünün açık kalanı:** en az 5 gerçek arkadaş çiftinde eski/yeni tablo. Kullanıcı dev
build'de arkadaş profillerini açıp Ayarlar > Geliştirici Laboratuvarı'ndaki tabloya bakmalı ve
"en benzer bildiğin arkadaş yenide de üstte mi?" sorusunu yanıtlamalı. Sonuç buraya yazılacak.

**İlk gerçek tablo (13 Kas, iOS dev build, kullanıcının ekran görüntüsü; adlar yazılmadı).**
Benim tarafım 458 film + 84 dizi.

| Arkadaş | Karşı taraf | Ortak | Eski | Yeni karma (film / dizi) | Not |
|---|---|---|---|---|---|
| A | 503 | 264 | 85 | **94** (88 / 85) | "ikiz"; dizide kanıt tavanı bağlıyor |
| B | 43 | 31 | 84 | 70 (58 / 69) | |
| C | 25 | 17 | 88 | 61 (22 / 59) | film K1 −1.00 (9 ortak), olgun değil |
| D | 53 | 20 | 73 | 36 (32 / 36) | film K1 −0.23 |
| E | 0 | 0 | – | – | liste gizli ya da boş; ikisi de hesaplamıyor (doğru) |

Okuma: eski sıra C > A > B > D (73–88 arası sıkışık), yeni sıra A > B > C > D (36–94 yayık).
Küçük kütüphaneli C eskide en üstteydi; yenide boyut adaleti ve az kanıt yüzünden indi. Bu tasarımın
amacıyla uyumlu. Hepsinde "örtük ağır" bayrağı var (puansız izlenenler çok). **Kullanıcı onayı
bekleniyor:** A gerçekten en benzer arkadaş mı, C'nin 88'i fazla mıydı? En az 5 çift ölçütü için
bir arkadaş daha (verisi açık) gerekiyor.

**Kullanıcı yanıtı (13 Kas):** A gerçekten en yakın arkadaş (ortak izleme vb. her bakımdan). "Algoritma
iyi, uygulayalım" → Y2 görünür geçişi aşağıda yapıldı.

## Bitti: Faz 3 (yapım uyumu geri testi) — araç hazır, GERÇEK kütüphaneyle çalıştırılmadı

| Dosya | İçerik |
|---|---|
| `utils/titleFitBacktest.js` | Puanlı her izleneni sırayla gizleyip `computeTitleTasteFit` ile tahmin; bant tablosu, Spearman ρ, bileşen başına ρ, ağırlık denemesi (`rescore`). |
| `scripts/sim/titleFitBacktest.sim.js` | `BACKTEST_FILE` (kendi dışa aktarım JSON'u) yoksa sentetik kütüphaneler. `BACKTEST_WEIGHTS` ile ağırlık denemesi. |
| `__tests__/titleFitBacktest.test.js` | 5 test (hedef puanı sızmıyor: skor = döküm formülü). |

```bash
BACKTEST_FILE="C:/yol/kutuphane.json" npx jest --rootDir . --testMatch "**/scripts/sim/titleFit*.sim.js" --testPathIgnorePatterns "/node_modules/"
```

`similar` ve `public` bileşenleri dışa aktarımda TMDB verisi olmadığı için testte kapalı.

**Sentetik sonuç (araç sınaması, karar verdirmez):** 6 kütüphanenin 6'sında bant ortalaması
kesintisiz artıyor; ρ 0.07–0.38. Sentetik puanlar 8–10'a yığıldığı için alt bantlar boş. Bileşen
ρ'larında en güçlüler `combo`, `genres`, `likes`; en ağır bileşen `predicted` (ağırlık ~0.30) ise
≈ 0. Bu yalnız bir **hipotez**: sentetik dünyada tür etiketleri rastgele özelliklerden türetildi.
Ağırlıklar gerçek kütüphane ölçülmeden DEĞİŞTİRİLMEDİ (rehber §5.4: tek kütüphaneye aşırı uydurma yok).

**Kabul ölçütünün açık kalanı:** kullanıcının kendi dışa aktarımıyla tablo (Ayarlar > verileri
dışa aktar → JSON). Dosya depoya konmaz.

## Tam jest paketi (13 Kas, Faz 2–3 sonrası)

9323/9329 geçti; aynı 7 ilgisiz dosya kırık (yukarıdaki liste). Yeni hata yok.

## Bitti: Y2 — arkadaş kartı v3 yüzdesine geçti (13 Kas) — cihazda GÖRÜLMEDİ

Rehber Faz 6'nın Y2 kısmı, kullanıcı isteğiyle eşleşme arayüzünden (Y1) ÖNCE ve bayraksız yapıldı
(sunucu/deploy gerektirmez; `getPairScore` yok, yüzde istemcide `scorePair` lite).

| Dosya | Değişiklik |
|---|---|
| `utils/tasteMatch.js` | Eski hesap `computeTasteInsights` adını aldı. Yeni `computeTasteMatch(mine, theirs, {now, ctx})` = içgörüler + v3 `score` / `tier` / `byType.*.score` / `v3` / `legacy`. `computeTasteV3` (kulvar başına özet). `TIERS` 85/65/40. `DEEP_COMPONENTS` = opinion/selection/content, `V3_WEIGHTS`. `lowData` = eski uyarı ∨ v3 olgun değil. |
| `utils/tasteMatchV3Adapter.js` | `mirrorVisibility` (arkadaşın gizli kategorisi bende de kapalı) — kart ve gölge tablo aynı. |
| `utils/tasteMatchCopy.js` | 6 dil: `parts.opinion/selection/content`, `info.partsDesc` yalnız bu üçü, `capsTitle/capsBody`, `minBody` artık düz metin, yeni `intro`; eski partsDesc ve `bonus` silindi. |
| `components/friends/TasteMatchInfoSheet.js` | Üç parça + ağırlık rozetleri, "Neden %100 çıkmıyor?" bölümü. |
| `FriendProfileScreen.js` | Gölge tablonun "eski" sütunu `tasteMatch.legacy.score`. |
| Testler | `tasteMatch.test.js` eski formül testleri `computeTasteInsights`'a; +8 v3 testi. `tasteMatchCard.test.js` yeni bilgi sayfası/çubuklar. Adaptör +1. |

Tam jest: 9332/9338; aynı 7 ilgisiz dosya kırık. Performans: 460×500 film + 80 dizi iki tarafta
~37 ms/çağrı (masaüstü Node); telefonda ölçülmedi, `useMemo` içinde arkadaş profili başına bir kez.
Sohbete gönderilen eski uyum mesajları saklı skoru gösterir (yeniden hesaplanmaz); yeni gönderimler
yeni kademeyle gider. `TasteMatchCard.js` değişmedi (çubuklar `DEEP_COMPONENTS`'ten).

Açık: cihazda kart görülmedi; "İzleme geçmişinize göre" etiketi (`v3.flags.implicitHeavy`) henüz
kartta yok; sürüm notunda "yüzdeler değişti" duyurusu kararı kullanıcıda.

## Bitti: Faz 4 — katılım, eşleşme gücü, Hub kartı (13 Kas) — cihazda GÖRÜLMEDİ, deploy YOK

| Dosya | İçerik |
|---|---|
| `utils/matchStrength.js` | Ürün belgesi §4: kulvar (film/dizi) başına güç, puan yolu + izleme yolu (≤ %70), puan çeşitliliği kapısı, 14 gün yayılım, son 30 gün, TEK sonraki adım, ulaşılabilir skor (algoritma §7). Yeni okuma yok. |
| `utils/matchFeature.js` | Kapı: bayrak `AppConfig/match.enabled` (varsayılan false; `__DEV__` zorlar) **ve** `isAdultBirthDate`. Katılım belgesi oku/yaz, `MATCH_CONSENT_VERSION = 1`. |
| `services/matchOptIn.js` | Bayrak okuma (6 saat önbellek), `Users/{uid}/private/match` dinle / yaz / sil. |
| `services/matchAnalytics.js` + `utils/analyticsEvents.js` | `match_opt_in`, `match_opt_out`, `match_strength_viewed`, `match_step_done`; kimlik/skor yok. |
| `hooks/useMatchFeature.js`, `hooks/useMatchStrength.js` | Ekranların tek giriş noktası; belge YALNIZ `available` iken dinlenir. |
| `screens/tabs/settings/MatchSettingsScreen.js` (+ `App.js` kaydı) | Kulvar seçimi + güç + sonraki adım, onay metni, katıl / kaydet / ayrıl (onaylı). |
| `screens/tabs/SettingsScreen.js` | Gizlilik satırının altında "Zevk Çemberleri" — yalnız `available`. |
| `components/hub/MatchWidget.js`, `screens/tabs/HubScreen.js` | Hub kartı (CineSwipe'ın altında) — yalnız `available`. Bölüm gizle/göster kaydına EKLENMEDİ. |
| `utils/matchCopy.js` | 6 dil; onay metni dahil. |
| `firestore.rules` | `private/match` için `matchDocOk()` (yalnız 4 alan, kulvar ⊂ movie/tv/anime, `updatedAt == request.time`). **Deploy edilmedi.** Canlı kurallarda private/* zaten yalnız sahibine açık ve biçim denetimsiz; yani istemci deploy olmadan da yazabilir, yeni kural yalnız biçimi sıkılaştırır. |
| Testler | `matchStrength` 15, `matchFeature` 12, `matchSettingsScreen` 5 (bayrak/yaş kapalıyken belge OKUNMUYOR), kural `matchOptIn` 3 (+ mevcut 214 kural testi temiz). |

Bilinçli rehber sapması: katılım kökte (`Users/{uid}.matchOptIn`) değil `private/match`'te — kök belgeyi her
oturumlu okuyabildiği için kimin katıldığı görünürdü. Hesap silme `Users/{uid}/*`'ı zaten siliyor.

Tam jest: 9364/9370; aynı 7 ilgisiz dosya kırık. `test:rules` (iki dosya) 217/217.

**Yapılmayanlar / açık:**
- Görevler Meydan Okumalar'a BAĞLANMADI (rehber adım 5): mevcut meydan okumalar izleme hedefli; "N yapım
  puanla" türü görev yok. Şimdilik "sonraki adım" metni Hub kartında. Bağlamak meydan okuma kataloğuna yeni
  tür ister — kullanıcıya sorulacak.
- Kütüphane dışa aktarımı değişmedi: istemcide yeni veri yok (yalnız katılım bayrağı). Sunucu özet profili
  Faz 5'te doğunca dışa aktarım ve gizlilik sayfası birlikte güncellenir.
- Anime kulvarı yok (köken dili istemcide yok).
- Gizlilik metni kullanıcıca ONAYLANDI (13 Kas) ve `website/privacy.html` (TR+EN) sürüm 1.8'e eklendi: veri tablosu, hukuki dayanak (açık rıza), kimler görür, saklama, sürüm geçmişi. Hosting 13 Kas'ta kullanıcı onayıyla DEPLOY EDİLDİ (yalnız privacy.html canlıdan farklıydı; seelogd.com'da 1.8 doğrulandı). Uygulamada ayrı politika metni yok (site sayfasına bağlanıyor); mağaza veri güvenliği formları elle güncellenmeli.
- Bayrak canlıda yok (`AppConfig/match` belgesi oluşturulmadı) → mağaza sürümünde hiçbir şey görünmez.
  Geliştirme derlemesinde 18+ hesapta görünür.

**Gizlilik sayfası metni (onaylandı, privacy.html 1.8):**

> **Zevk Çemberleri (isteğe bağlı).** Bu özelliğe yalnız 18 yaş ve üstü kullanıcılar, kendi isteğiyle
> katılır. Katıldığında, seçtiğin kulvarlardaki (film, dizi) izleme kayıtların, puanların, favorilerin
> ve yorum sayın sunucularımızda özet bir zevk profiline dönüştürülür. Bu profil yalnız benzer zevkteki
> kullanıcıları önermek için kullanılır; listelerin ve tek tek puanların başka kullanıcılara gösterilmez.
> Eşleştiğin kişi yalnız avatarını, görünen adını ve ortak sevdiğiniz yapımları görür; yaşın, konumun,
> e-postan ve kullanıcı adın gösterilmez. İstediğin an Ayarlar > Zevk Çemberleri'nden ayrılabilirsin;
> ayrıldığında ya da hesabını sildiğinde özet profilin ve önerilerin silinir.

## Faz 4 kalanları (13 Kas, ikinci tur)

- **Hub kartı bölüm gizle/göster kaydına eklendi** — KAPILI bölüm: `section("match", …, { gate: "match" })`.
  Kapı kapalıyken (bayrak ya da 18+ yok) ayar ekranında satırı ve sayımı YOK (`gatedSectionsOf`,
  `summarizeScreen(…, gates)`); `SectionVisibilityScreen` kapıyı `useMatchFeature({ subscribe: false })` ile
  okur (katılım belgesi dinlenmez). `allHidden` kapılı bölümü saymaz; Hub boş-ekran bildirimi kart görünüyorsa
  çıkmaz. 6 dilde metin. Test: `__tests__/matchSectionGate.test.js` (3).
- **Meydan Okumalar'a bağlanmadı (bilinçli):** katalog izleme tarihinden sayıyor; "N yapım puanla" türü,
  puanın tarihini ister (activityIndex.ratings tarihsiz). Yeni kural türü + 6 dil + tarih kaynağı = ayrı iş,
  kullanıcı kararı.
- **Kütüphane dışa aktarımı değişmedi (bilinçli):** dışa aktarım "taşınabilirlik" (kendi listelerin); eşleşme
  profili o listelerden türetilmiş sunucu özeti ve istemciye kapalı. Erişim talebi gelirse ayrı iş.

## Bitti: Faz 5 — sunucu hattı (13 Kas) — DEPLOY EDİLMEDİ, canlıda hiç çalışmadı

| Dosya | İçerik |
|---|---|
| `functions/scripts/syncTasteCore.js` | `utils/{genreCanon,tasteMatchV3,tasteMatchV3Adapter,matchStrength}.js` → `functions/{tasteGenreCanon,tasteMatchCore,tasteMatchAdapter,matchStrengthCore}.js` (CommonJS, ELLE DÜZENLENMEZ). Kaynağı değiştiren `node functions/scripts/syncTasteCore.js` çalıştırır; `__tests__/tasteMatchV3.parity.test.js` hem kopyanın güncelliğini hem AYNI sayıları (bağlam, profil, skor) denetler. |
| `functions/matchPipeline.js` | Saf kararlar: yaş/katılım, profil girdisi (ad/afiş SAKLANMAZ), TMDB → TitleFeatures, dizi bitirdi/bıraktı (bitmiş dizide <%50 + 120 gün dokunulmamış), havuz, skor (havuz > 400 → içerik profiliyle en yakın 100 ön süzme), §8 karar (twin/near/guide), §6 çember, opak kimlik, selam kotası. |
| `functions/matchServer.js` | Firestore: `syncMember` (tetikleyici), `removeMember` (ayrılma/silme + başkalarının önerilerinden çıkarma), `refreshProfile` (Lists kök damgası değişmediyse ya da 6 saat dolmadıysa okumaz), `loadTitleFeatures` (eksik/90 günden bayat; gece ≤ 1500 TMDB isteği), `runNightly`, `sendHello`, `pairScore`. |
| `functions/index.js` | `onMatchOptInWritten` (Users/{uid}/private/match), `matchNightly` (04:30 İstanbul, singleton, 1 GiB, 540 sn, TMDB_API_KEY), `matchHello` + `getMatchPairScore` (light, hız sınırlı). |
| `functions/accountPurge.js` | "records" aşamasına `match` adımı (removeMember). İstemci aşama listesi değişmedi. |
| `firestore.rules` | `MatchSuggestions/{uid}` yalnız sahibi OKUR, kimse yazmaz; `MatchMembers`, `MatchProfiles/**`, `MatchPairs`, `MatchHellos`, `MatchMeta`, `TitleFeatures` istemciye tamamen kapalı. |

**Koleksiyonlar:** `MatchMembers/{uid}` (katılım + selam kotası) · `MatchProfiles/{uid}` (sıkıştırılmış kulvar
öğeleri + güç) · `MatchProfiles/{uid}/built/{lane}` (gece bağlamıyla kurulmuş çekirdek profili) ·
`MatchSuggestions/{uid}` · `MatchPairs/{uid}` (cid → uid, ters dizin `uids`) · `MatchHellos/{a_b}` (30 gün) ·
`TitleFeatures/{movie_1}` · `MatchMeta/{salt, ctx_movie, ctx_tv, run}`.

**Öneri belgesi şekli** (istemci Faz 6'da okuyacak):
`{ v:1, updatedAt, lanes: { movie: { pool, active, inPool, twinsEnabled, circle: {key,size,genres}|null,
items: [{ cid, verdict: "twin"|"near"|"guide", score|null, displayName, avatarIndex, photoURL, loved:[anahtar],
split: anahtar|null, implicitHeavy, greeted, sent }] } } }` — uid, kullanıcı adı, puan değeri YOK (test).

**Verilen kararlar (rehber §2.2 önerilen varsayılanlar):**
- Karşılıklı selam = **arkadaşlık** — kullanıcı 13 Kas'ta AÇIKÇA ONAYLADI (istemci acceptFriendRequest ile aynı belgeler/sayaçlar; bekleyen klasik
  istek kapatılır). Bildirim tipi şimdilik `friend_accepted` + `source: "match"` → metni "isteğini kabul etti"
  diyor; Faz 6'da ayrı tip + 6 dil.
- Eşleşmeden önce kartta: avatar + görünen ad + ortak sevilenler (anahtar) + ayrışılan yapım (yalnız anahtar,
  puan yok — onaylı gizlilik metni "tek tek puanların gösterilmez" diyor; ürün belgesindeki "o 9 verdi, sen 4"
  bu metinle çelişiyordu → kullanıcı 13 Kas'ta KARAR VERDİ: gizlilik metnine göre, ayrışılan yapımda PUAN GÖSTERİLMEZ, yalnız yapım).
- Soğuk başlangıç: kulvarda etkin (30 gün) üye < 150 → "ikiz" yok, çember yok, 80+ "near".
- Anime kulvarı yok (TitleFeatures dili artık var; Faz 6/7'de açılabilir).

**Testler:** `functions/matchPipeline.test.js` 14 · `functions/matchServer.integration.test.js` 3 (emülatör:
katılım → gece → öneri (uid yok) → engel → selam → karşılıklı → arkadaşlık → pairScore → ayrılma temizliği;
bayrak kapalı; TMDB önbelleği) · `accountPurge.integration.test.js` eşleşme izleri eklendi ·
`__tests__/rules/matchServerCollections.test.js` 2 · `__tests__/tasteMatchV3.parity.test.js` 4.
`cd functions && npm test` 158 geçti / 0 kırık (43 emülatör testi atlandı; emülatörle ayrıca koşuldu: geçti).
`npm run test:rules` 399/399. Tam jest: 9349 testten 7 kırık — aynı 7 ilgisiz dosya (BetaBadge, HoldToConfirm…).

**Ölçüm (bu masaüstü, Node 22, sentetik ~200 yapımlık kullanıcı, tek kulvar):** 100 kişi 0,7 sn · 300 kişi
7,5 sn · 1000 kişi (ön süzmeli) 30 sn. Bulutta (1 vCPU) ÖLÇÜLMEDİ; iki kulvar + G/Ç ile 1000 kişi 540 sn'ye
sığmalı ama ~2000+ kişide iş kulvarlara bölünmeli.

**Maliyet tahmini (okuma):** gece işi katılan başına ~5 belge + engel listesi + kütüphanesi değişmişse tam
liste okuması (film+dizi+favori belge sayısı kadar; en sık 6 saatte bir) + havuzdaki tekil yapım başına 1
TitleFeatures okuması. İstemci: öneri belgesi 1 okuma (Faz 6).

**Deploy edilmeden önce yapılacaklar (KULLANICI ONAYIYLA):**
1. Sıra: functions → rules (rehber). Canlı kurallarla çalışma ağacını karşılaştır (Faz 4 `matchDocOk` da bekliyor).
2. `TMDB_API_KEY` sırrı zaten var (streaming işi kullanıyor). Yeni sır yok.
3. `AppConfig/match` belgesi YOK → gece işi ve selam hiçbir şey yapmaz; tetikleyici yine de ayrılmayı işler.
   Açmak Faz 6 ile birlikte (istemci öneri ekranı yok).
4. Güvenlik notu (rehber Faz 5): sohbet kuralında arkadaşlık şartı yok (`isChatMember` yalnız chatId'ye
   bakıyor). Eşleşme uid sızdırmadığı için bu hattı etkilemiyor ama ayrı iş olarak ele alınmalı.

## Sıradaki

- Faz 2 ve 3'ün gerçek veri ölçümleri (kullanıcı işi).
- Faz 5 deploy'u (yukarıdaki liste) — kullanıcı onayı.
- Faz 6: öneri ekranı (MatchSuggestions okuma), ikiz kartı, selam düğmesi (`matchHello`), çember daveti/grup,
  arkadaş kartının `getMatchPairScore`'a bağlanması, eşleşme bildirimi tipi, Geliştirici Laboratuvarı durumları.
- ~~Meydan Okumalar'a puan görevi~~ — 13 Kas YAPILDI: "Puan" grubu, 5 görev, katılış başlangıcı (`baseline`);
  ayrıntı `docs/ozellikler/MEYDAN_OKUMALAR.md` kural 11. Test `__tests__/watchChallengesRatings.test.js` (11).
  Cihazda görülmedi. İsteğe bağlı: Hub eşleşme kartındaki "puan ver" adımı bu görevlere yönlendirilebilir.

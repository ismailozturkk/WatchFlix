# Haftalık Lig

Kaynak: `docs/planlama/OZELLIK_ADAYLARI_2026-10-30.md` → **E2**. 30 Ekim 2026'da planlandı ve kodlandı.

> Her hafta 30 kişilik bir gruba düşersin; oyun, günlük bulmaca, izleme ve oyla XP toplarsın. Pazar gecesi grubun
> ilk %20'si bir üst lige çıkar, son %20'si düşer. Bronz → Gümüş → Altın → Elmas → Efsane.

## Özet

| | |
|---|---|
| Yer | Eğlence sekmesinin EN ÜSTÜ, "Haftalık Lig" bölümü (kart: `components/hub/LeagueWidget`) |
| Rota | `LeagueScreen` (`screens/fun/LeagueScreen.js`) |
| Bölüm kimliği | `league` (Ayarlar > Ekran bölümleri > Eğlence'de gizlenebilir) |
| Premium | Yok: herkes katılır. ("Düşme koruması" Premium fikri belgede kaldı, yapılmadı.) |
| Build / Deploy | Build HAYIR. **Deploy EVET**: functions (`awardLeagueXp`, `settleLeagueWeek`, profil fan-out), firestore rules, firestore indexes (`leagueMembers.uid`). |

## Kurallar (tek kaynak: `functions/leagueRules.js`)

- **Hafta** İstanbul saatiyle pazartesi 00:00'da başlar. Türkiye 2016'dan beri sabit UTC+3 olduğu için hesap Intl'siz,
  sabit ofsetle yapılır (Hermes'te saat dilimi desteği tutarsız). Hafta kimliği = o haftanın pazartesisi (`2026-10-26`).
- **Katılım** = haftanın ilk XP'si. Oyuncu o an kendi ligindeki açık gruba girer (en çok `GROUP_SIZE` = 30). Boş grup
  önceden kurulmaz; az kullanıcıda da gruplar dolu görünür.
- **XP kaynakları** (olay başına XP · günlük tavan):

  | Kaynak | XP | Günde | Nereden |
  |---|---|---|---|
  | `game` | 15 | 10 | Hızlı oyunlar + "Önce hangisi?" (en az bir cevap), Sahne Tahmin, Poster Bulmaca, serbest Film Zinciri (çözülen) |
  | `daily` | 40 | 3 | Günün Karesi (bitirince), günlük Film Zinciri (çözünce), Günlük Meydan Okuma; her biri günde bir kez |
  | `watch` | 10 | 15 | Film / bölüm / sezon / dizi izlendi, **izleme günü bugün ya da dün** ise (`services/libraryActions`) |
  | `vote` | 10 | 5 | Günün Sorusu ve Top 100 oyu; **sunucu oy belgesinin varlığını doğrular** |

- Aynı olay (`kaynak|ref`) hafta içinde bir kez sayılır. Tarih taşıyan ref'lerde gün, sunucunun gününden en çok 1 gün sapabilir.
- **Hafta sonu**: üst `max(1, ⌊n·0,2⌋)` kişi yükselir (en az `MIN_PROMOTE_XP` = 100 XP ile), grup en az 5 kişiyse alt
  `⌊n·0,2⌋` kişi düşer. En üst ligde yükselme, en altta düşme yok. Eşit XP'de o XP'ye **önce ulaşan** önde.
- Bu hafta oynamayan oyuncunun ligi değişmez.

## Güven modeli

İstemci XP yazamaz (`firestore.rules`: lig koleksiyonlarında `write: false`). Uygulama yalnız olayı bildirir; XP'yi,
tavanı ve tekrarı sunucu hesaplar. Kimlik (ad, avatar) `Users/{uid}`'den okunur, istemcinin gönderdiğine güvenilmez.

**Sınır (bilerek):** oyun ve izleme olayları doğrulanamaz; çünkü oyun skorları ve izleme kayıtları istemcide yazılıyor.
Hile yapan biri yalnız günlük tavanı doldurabilir (günde en çok 150 + 120 + 150 + 50 = 470 XP). Bu da bir kişinin
ligi tek başına bozmasını önler. Oy kaynağı gerçek oy belgesine bakar.

## Veri

| Yol | Alanlar | Kim |
|---|---|---|
| `LeagueUsers/{uid}` | `tier, week, groupId, xp, xpAt, todayKey, counts, refs, lastResult, updatedAt` | sunucu yazar · sahibi okur |
| `LeagueWeeks/{hafta}/groups/{grup}` | `tier, week, size, settled, createdAt, settledAt?` | sunucu yazar · oturum açan okur |
| `…/groups/{grup}/leagueMembers/{uid}` | `uid, xp, xpAt, tier, displayNameSnapshot, usernameSnapshot, avatarIndexSnapshot, photoURLSnapshot` | sunucu yazar · oturum açan okur |
| `LeagueWeeks/{hafta}/open/{lig}` | `groupId, size, count` (açık grup imleci) | yalnız sunucu |

Grup kimliği `<lig>-<sıra>` (`gold-3`). `lastResult = { week, fromTier, toTier, outcome: up|down|stay, rank, size, xp }`.

## Hafta dönümü (iki yol, aynı hesap)

1. **Çağrı yolu:** oyuncu yeni haftada ilk XP'sini kazanırken geçen haftası henüz sonuçlanmamışsa
   `awardXp` önce onu sonuçlandırır (pazartesi 00:01'de oynayan eski liginde yeni gruba girmesin).
2. **`settleLeagueWeek`** (pazartesi 00:10, İstanbul): geçen haftanın `settled == false` gruplarını tek tek transaction
   ile sonuçlandırır. Yeni haftaya geçmiş ya da sonucu yazılmış oyuncuyu atlar; ikinci çalışma hiçbir şey yazmaz.

İki yol aynı `settleGroup`'u, artık yazılmayan geçmiş hafta tablosu üzerinde çalıştırdığı için aynı sonucu bulur
(emülatör testi bunu kanıtlıyor). Pazartesi 00:00–00:10 arasında kart "Geçen haftanın sonuçları hesaplanıyor" der.

## Dosyalar

| Dosya | Görev |
|---|---|
| `functions/leagueRules.js` | Saf kurallar: hafta/gün, kontenjan, sıralama, XP kararı, ref doğrulama (**kaynak**) |
| `utils/leagueRules.js` | Uygulama aynası. Kaynaktan türetildi; eşitliği `__tests__/leagueRules.test.js` denetler. **Birini değiştiren ikisini de değiştirir.** |
| `functions/league.js` | Transaction'lar: `awardXp`, `settleGroupDoc`, `settleWeek`, `voteExists` |
| `functions/index.js` | `awardLeagueXp` (callable), `settleLeagueWeek` (zamanlanmış), profil fan-out'ta `leagueMembers` |
| `functions/accountPurge.js` | Hesap silmede `leagueMembers` taraması + `LeagueUsers/{uid}` |
| `services/leagueService.js` | Callable'a bildirim (sessiz, oturumda tekrar yok), okuma + 60 sn önbellek, kaynak yardımcıları |
| `hooks/useLeague.js` | Kart ve ekranın veri bağı (odakta tazeler, XP gelince yeniden çizer) |
| `utils/leagueVisuals.js` | Lig renkleri/simgeleri, kalan süre, tablo bölgesi, sonuç satırı |
| `utils/leagueCopy.js` | 5 dil metinleri |

XP bildiren yerler: `hooks/useQuickGame`, `useOlderGame`, `useSceneGame`, `useDailyFrame`, `useFilmChain`, `useDailyPoll`,
`useTop100`, `services/libraryActions` (izleme kapısı).

## Testler

- `__tests__/leagueRules.test.js`: saf kurallar + sunucu/uygulama aynası eşitliği.
- `__tests__/leagueScreen.test.js`: servis + kanca + kart + ekran (taklit Firestore/callable).
- `functions/league.integration.test.js` (emülatör): gruba katılma, grup dolması, tavan/tekrar, iki yolun aynı sonucu.
- `__tests__/rules/coverageGaps.test.js` "Haftalık Lig yalnız sunucunun". Mutasyon kontrolü yapıldı: `LeagueUsers` yazma izni açılınca test kırıldı.
- `functions/accountPurge.integration.test.js`: lig izleri siliniyor, başkasınınki kalıyor.

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH"
npx firebase emulators:exec --only firestore --project demo-league "node --test --test-concurrency=1 functions/league.integration.test.js functions/accountPurge.integration.test.js"
```

## Açık işler / bilinçli eksikler

- **Cihazda görülmedi.**
- Hafta sonu sonuç **push bildirimi** yok; sonuç kart ve ekranda görünüyor.
- Hesap **sıfırlama** (istemci) lig verisine dokunmaz (kurallar istemciye kapalı). Gerekirse sunucu callable'ı eklenmeli.
- Hesap silmede grubun `size` sayacı düşmez; sayaç yalnız açık grubun dolmasını ölçer, sıralama satırlardan okunur.
- Çevrimdışı kaçan XP olayı kuyruklanmaz (en çok birkaç XP).
- Arkadaş ligi / lig geçmişi ekranı yok.
- Premium "düşme koruması" fikri yapılmadı.
- Gizlilik sayfası: lig tablosu, oyun liderlikleriyle aynı görünürlükte (ad + avatar + XP). Metin gözden geçirilmeli.

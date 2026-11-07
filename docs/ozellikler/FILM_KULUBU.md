# Film Kulübü

Kaynak: `docs/planlama/OZELLIK_ADAYLARI_2026-10-30.md` → **E7**. 30 Ekim 2026'da planlandı ve kodlandı.

> Arkadaş grubu kulüp kurar. Her tur oylamayla bir film seçilir; izleyenler spoiler'sız tartışma odasında buluşur;
> kulübün izlediklerinden arşiv ve kulüp istatistiği oluşur.

## Özet

| | |
|---|---|
| Yer | Grup sohbeti → grup bilgisi (üst başlık) → **Film Kulübü** satırı · açık tur varken sohbetin üstünde kulüp şeridi · sohbetteki kulüp kartı |
| Rotalar | `FilmClubScreen` (`groupId`, isteğe bağlı `roundId`) · `FilmClubDiscussionScreen` (`groupId`, `roundId`) |
| Premium | **Kulüp KURMAK** Premium + Max (registry `film_club`, ACCESS). Katılmak, oy, izledim/puan, tartışma herkese açık. Kurulu kulübün turları kurucunun planı düşse de sürer; kapatmak her planda serbest. |
| Build / Deploy | Build: Hayır · Deploy: **Firestore rules** (aşağıda). Functions yok. |
| Durum | Rules emülatörde sınandı (11 yeni test, tüm paket 343/343). **Rules DEPLOY EDİLDİ (31 Eki, Haftalık Lig bloklarıyla birlikte).** Cihazda görülmedi, commit yok. |

## Akış

1. **Kur** (kurucu/yönetici): sıklık seç — Haftalık (2 gün oylama · 7 gün izleme) ya da Aylık (3 gün · 30 gün) → "Kulübü kur".
2. **Yeni tur** (kurucu/yönetici): aday seçici — boşken izleme listesinden öneriler, yazınca TMDB film + dizi araması;
   2–6 aday → "Oylamayı başlat". Sohbete **"Oylama başladı"** kartı düşer (push sunucu mesaj tetikleyicisinden).
3. **Oylama**: her üye bir adaya oy verir, aynı afişe tekrar basınca geri çeker. Süre dolunca ekranı açan HERHANGİ bir
   üye sonucu açıklar (yönetici süreden önce de kapatabilir). En çok oy alan kazanır; eşitlikte aday sırası, hiç oy
   yoksa ilk aday. Sohbete **"Film seçildi"** kartı.
4. **İzleme**: "İzledim" + 1–10 puan. Filmi kütüphanede izlendi olarak işaretlediysen "Kütüphanende izlendi görünüyor"
   ipucu çıkar (otomatik işaretlemez — kulüp için izlediğini kendin söylersin). Kim izledi avatarlarla görünür.
5. **Tartışma**: yalnız "İzledim" diyen üye okur ve yazar — **kural kapısı**, istemci değiştirilse de mesajlar çekilemez.
   İzlemeyen kilit ekranı ve "Filmi izleyince açılır" görür; mesaj SAYISI tur belgesinde (`commentCount`) herkese görünür.
6. **Bitiş**: süre dolunca herhangi bir üye, öncesinde yönetici "Turu bitir". Sohbete ortalama puan + "N/M izledi"
   özet kartı. Tur arşive geçer; arşivde de izledim/puan/tartışma açık kalır.

Tek açık tur kuralı istemcide (yeni tur düğmesi yalnız açık tur yokken; yöneticiler güvenilir sayılır).

## Veri modeli

```
groups/{gid}.club = { enabled: bool, cadence: "weekly"|"monthly", updatedBy: uid }

groups/{gid}/clubRounds/{rid} = {
  number, status: "voting"|"watching"|"done", cadence, createdBy, createdAt,
  candidates: [{ id, media_type, title, poster_path, release_date }],   // 2–6
  candidateIds: ["movie-550", "tv-1399", …],
  votes: { uid: candidateId },
  voteEndsAt: Timestamp,
  pickId, pick, pickedAt, watchEndsAt,          // oylama kapanınca
  watched: { uid: Timestamp }, ratings: { uid: 1–10 },
  commentCount, finishedAt
}

groups/{gid}/clubRounds/{rid}/discussion/{cid} = { senderId, senderName, text (≤1000), createdAt }
```

Sohbet kartı: mesaj `kind: "clubShare"`, gövde `utils/chatShare.buildClubShare` (`event: voting|picked|done`,
`groupId`, `roundId`, `number`, adaylar ya da seçilen film, bitiş zamanı, bitti kartında ortalama/sayılar). Kart
anlık görüntüdür; canlı durum kulüp ekranında. Tartışma içeriği karta asla girmez.

## Kurallar (firestore.rules)

- `groups/{gid}` update — yeni dal: yalnız kurucu/yönetici, yalnız `club` + `updatedAt`, biçim `clubFieldOk`;
  **açmak** `isPaidPlan()` (Users/{uid}.entitlements), kapatmak/sıklık her planda.
- `clubRounds` — okuma üyeler; oluşturma yönetici + kulüp açık + 2–6 aday + boş oy/izleme + oylama ≤ 4 gün;
  güncelleme dalları: kendi oyu (yalnız adaylardan) · oylamayı kapat (yönetici ya da süre dolmuş; seçilen aday olmalı,
  `pick.media_type-pick.id == pickId`, izleme ≤ 31 gün) · kendi izledim/puanı (puan tam sayı 1–10, yalnız izlediyse,
  izleme zamanı `request.time`) · `commentCount` tam +1 (izlemiş üye) · turu bitir (yönetici ya da süre dolmuş).
  Silme yönetici.
- `discussion` — okuma/yazma yalnız turda `watched.{uid}` olan üye; güncelleme yok; silme yazan ya da yönetici.

Sayılar `utils/filmClub.js` sabitleriyle AYNI; `__tests__/filmClub.test.js` kural metnini karşılaştırır.

**Deploy notu:** `firebase deploy --only firestore:rules` dosyanın TAMAMINI gönderir. 31 Eki deploy'unda canlı = HEAD idi;
yerel yalnız Film Kulübü + Haftalık Lig bloklarını ekliyordu, ikisi birlikte yayına alındı.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/filmClub.js` | Saf çekirdek: aday temizliği, tur taslağı, oy sayımı/kazanan, evre (`voting/votingOver/watching/watchingOver/done`), yetki yardımcıları, tur + kulüp istatistiği |
| `utils/filmClubCopy.js` | Metinler (tr/en/es/pt/de) |
| `services/filmClubService.js` | Firestore: ayar, dinleyiciler, tur aç (tur + duyuru tek batch), oy, kapat/bitir (transaction + duyuru), izledim/puan, tartışma |
| `hooks/useClubSender.js` | Gönderen kimliği (ChatScreen grup `senderFields` ile aynı kaynak) |
| `screens/club/FilmClubScreen.js` | Kulüp ekranı (tanıtım, tur kartı, arşiv, ayarlar); süresi dolan evreyi kapatır |
| `screens/club/FilmClubDiscussionScreen.js` | Tartışma odası (kilit ekranı, `useKeyboardInset`) |
| `components/club/ClubCandidatePicker.js` | Aday seçici alt sayfa |
| `components/club/ClubChatBanner.js` | Sohbet üstü kulüp şeridi |
| `components/chat/SharedClubMessage.js` | Sohbet kulüp kartı |
| `utils/chatShare.js` / `utils/chatReply.js` | `club` paylaşım türü, önizleme, alıntı simgesi (`ticket`) |
| `components/chat/GroupInfoModal.js` | "Film Kulübü" satırı (`onOpenClub`) |

Analitik: `film_club_created {cadence, members}`, `film_club_round_started {number, candidates}`,
`film_club_picked {number, media_type}`, `film_club_finished {number, watched_pct, rated}` — film adı ve grup kimliği
gönderilmez.

## Testler

- `__tests__/filmClub.test.js` — çekirdek + kural aynası (20)
- `__tests__/filmClubShare.test.js` — sohbet kartı gövdesi, metin tablosu, premium kaydı (14)
- `__tests__/filmClubScreen.test.js` — ekran bağlantısı: kurulum, Free kapısı, oy, otomatik kapatma, izledim/puan,
  tartışma kilidi, arşiv, kapatma onayı (11)
- `__tests__/rules/firestore.rules.test.js` → "Film Kulübü" (11, emülatör: `npm run test:rules`)

## Açık işler / bilinçli bırakılanlar

- **Hesap silme:** `functions/accountPurge.js` grup mesajlarını siler ama kulüp tartışma mesajlarına ve tur
  belgelerindeki `votes/watched/ratings.{uid}` alanlarına dokunmaz. Eklemek functions deploy'u ister.
- **Tur sonu bildirimi:** süre dolunca kimse ekranı açmazsa tur kendiliğinden kapanmaz (zamanlanmış function yok);
  sohbet şeridi ve kart açık turu göstermeye devam eder, ilk açan üye kapatır.
- Oylar **tur belgesinde** tutulur, medya anketi mesajı (`kind: "poll"`) kullanılmaz: kazanan hesabı ve evre geçişi
  tek belgede transaction ile yapılabilsin diye.
- Grup silinince alt koleksiyonlar (turlar, tartışma) yetim kalır — grup mesajlarıyla aynı davranış.

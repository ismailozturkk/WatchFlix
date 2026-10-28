# Günlük düello — "Arkadaşına meydan oku"

Günlük Meydan Okuma'nın 10 sahnesi herkeste **aynıdır** ve günde tek deneme verir. Düello bunun üstüne kurulu:
sonucunu bitiren kişi **"Arkadaşına meydan oku"** der, alıcı seçer, sohbete bir **düello kartı** düşer. Alıcı kartta
"Meydan okumayı kabul et"e basar, AYNI günün setini oynar; dönüşte kart iki skoru yan yana gösterir
(kazandın / geride kaldın / berabere). **Oyun motoruna, skor kaydına, rules'a, functions'a dokunulmadı** — yalnız
yeni bir sohbet paylaşım türü ve günlük tablonun okunması.

Kaynak: 21 Ekim 2026 "Eğlence sekmesine özellik" çalışması, 2. aday.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/dailyDuel.js` | **Saf çekirdek**: `duelOutcome` (open / played / expired + kazan/kaybet/beraber), `scoresFromRows`, `duelPayloadFromResult`. |
| `utils/dailyDuelCopy.js` | tr/en/es/pt/de metinleri. |
| `utils/chatShare.js` | Yeni tür `challenge` / mesaj `kind: "challengeShare"`: `buildChallengeShare`, `sanitizeChallengeShare`, önizleme `⚔️ …`, küçük resim yok. |
| `utils/chatReply.js` | Alıntılanabilir türlere `challenge` (simge `flash`). |
| `services/dailyDuelService.js` | İki uid'nin günlük skorunu TEK sorguyla okur (`fetchDailyFriendRows`); 15 sn önbellek, eşzamanlı istek birleşir, `force` oyundan dönüşte. |
| `hooks/useDuelStatus.js` | Karttaki durum: ekrana her odaklanışta okur, `duelOutcome` ile faz çıkarır. |
| `components/chat/SharedChallengeMessage.js` | Sohbet balonu gövdesi. `MessageBubble` `senderUid={item.senderId}` geçirir. |
| `components/game/DuelSendButton.js` | "Meydan oku" şeridi + alıcı seçimi (`ShareToChatSheet`). Sonuç ekranında ve Oyunlar modülünde. |
| `translations/*.json` | `autoI18n.paylas_meydan_onizleme` (gelen kutusu satırı / push, gönderenin dilinde). |
| `utils/analyticsEvents.js` | `DUEL_SENT`, `DUEL_ACCEPTED`. |

## Kararlar

- **Karttaki skor güvenilmez, tablo güvenilir.** Kart gönderenin cihazında yazılır; karşılaştırma iki skoru günlük
  tablodan (`GameLeaderboards/…/entries`) okur. Kartta 9999, tabloda 7000 yazıyorsa 7000 gösterilir. Tablo
  okunamazsa karttaki skor görünür ve karşılaştırma YAPILMAZ.
- **Neden "günlük"?** Setin herkeste aynı olduğu tek mod bu; rastgele kaynaklı modlarda iki kişiye aynı soruları vermek
  motorda tohumlu havuz + ayrı skor kaydı gerektirirdi (liderlik şişirme riski). Günlük olunca aciliyet de bedava gelir.
- **Fazlar (alıcı):** bugün + oynamamış → *kabul et*; oynamış → karşılaştırma (geçmiş günler için de); gün geçmiş +
  oynamamış → yalnız gönderenin skoru ve "artık oynanamıyor". Gelecek tarihli kart (saat kayması) da "oynanamıyor".
- **0 puan "oynamadı" değildir:** `Number.isFinite(mine)`; skor 0 olan oynamış sayılır.
- **Gönderenin kendi kartı sorgu atmaz** ve eylem göstermez.
- **Premium kuralı:** oyunlar planda yoksa (`usePremiumGate("games").allows(0)` false) "Kabul et" yükseltme sayfasını açar.
  Kural "işi başlatan sayılır" ile uyumlu: oyunu başlatan alıcıdır. Gönderen Premium, alıcı Free ise kart bir yükseltme kancasıdır.
- **Grup sohbeti çalışır:** her üye kendi skorunu gönderene karşı görür (üyeler arası çapraz karşılaştırma yok).
- **Gönderen karşılaştırmayı kartında görmez** (alıcının uid'i grupta tek değil). Sonucu sıralama ekranındaki
  "Arkadaşların arasında" şeridi zaten gösteriyor.
- **Rules/functions değişikliği yok**, ama bu sürümden ESKİ bir uygulama `challengeShare` mesajını tanımaz ve düz
  metin (`⚔️ Günlük meydan okuma · N puan`) olarak gösterir — bozulmaz, yalnız kart olmaz (zevk uyumu ile aynı davranış).

## Kabul / ret (29 Ekim 2026)

- Yanıtsız kartta **[Reddet] [Kabul et]** yan yana (ortak `components/chat/InviteActions.js`; kısa etiket, ekran
  okuyucu tam metni okur). Ret oyunu açmaz; reddeden kartında "Reddettin" görür, skor tablosu sorulmaz.
- Yanıt mesajda: `accepts.{uid}` / `declines.{uid}` (model `utils/chatInvites.js`, kural `firestore.rules` →
  `inviteAnswer`; eski `challengeAccept` bunun içine katıldı). Tek yön: kabul eden reddedemez, reddeden kabul edemez.
- Gönderen 1-1'de "Yanıt bekleniyor" → "Kabul edildi" / "Reddedildi" (ret varsa rakibin skoru sorulmaz); grupta
  "N kişi kabul etti" / "N kişi reddetti" (ikisi de varsa ret sayısı not satırında).
- **Profil'deki önemli davetler çubuğu ile iki yönlü:** davet bildirimi kartın `messageId`'sini taşır; çubuktan
  verilen yanıt `NotificationsContext.respond` → `services/chatInviteService.writeInviteResponse` ile aynı mesaja
  yazılır. Karttan verilen yanıt `respondMatchingInvitations` ile bildirim kaydını aynı yanıta çeker. Eski (kimliksiz)
  bildirimde çubuktaki yanıt kartı değiştirmez.
- Bu blok yeni kural ister (`declines`, CineSwipe kartının kabulü ve bitiş kaydı); kural 29 Ekim 2026'da
  yayınlandı. Kural olmadan bu yazımlar reddedilir ve kart eski hâline döner (bildirim kaydı yine güncellenir).

## Ölçüm

`duel_sent {source: "result"|"hub", score}` · `duel_accepted {locked}`. Dönüşüm = accepted / sent. `locked:true` oranı,
kartın Free kullanıcıda yükseltme sayfasına ne kadar çevrildiğini söyler.

## Cihazda henüz görülmedi

Jest (çekirdek, paylaşım türü, servis, balon, düğme; 5 dil) temiz. Cihazda doğrulanmadı: balonun gerçek genişlikte
yerleşimi (240 pt), "kabul et"ten oyuna gidip sohbete dönünce karşılaştırmanın kendiliğinden belirmesi (`useFocusEffect`),
iki cihazla uçtan uca akış. (Günlük tablo okuma izni sorun değil: `GameLeaderboards/{id}/entries` kuralı "giriş yapmış herkes okur".)

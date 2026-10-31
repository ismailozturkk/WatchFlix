# Çevrimiçi (presence) ve sohbet sinyalleri

Realtime Database üzerinde; kalıcı mesaj verisi Firestore'da kalır.

> **1 Kasım 2026 — göstergeler kaldırıldı (kullanıcı kararı).** Uygulamada çevrimiçi durumu, "Sohbette",
> "yazıyor" ve son görülme artık hiçbir yerde gösterilmiyor, gizlilik ayarı da yok. Hiçbir ekran başkasının
> `/presence` ya da `chatMeta` düğümünü okumuyor; "yazıyor" yazılmıyor. **Kalan:** kişinin kendi
> `conns` kaydı (aşağıdaki kural aynen geçerli) ve sohbet görünürken yazılan `inChat` bayrağı. Sunucu
> (`functions/chatPresence.js`) açık sohbetin push'unu bu bayrakla susturur; bayrak yalnız canlı bir `conns`
> kaydıyla geçerlidir. Bu yüzden presence oturumu silinmedi. Aşağıdaki okuyucu/gösterge anlatımı tarihsel.

## Kural

Çevrimiçi kaydı yalnız şu üç koşul birlikte doğruyken durur:
**RTDB soketi açık · uygulama ön planda · oturum var.**
Biri bozulduğu an kayıt silinir; kaydı yazmak ve silmek tek yerden (durum makinesi) yapılır.

## Veri modeli

```
/presence/{uid}/conns/{connId}  : number   açık soket + ön plan (soket başına bir kayıt)
/presence/{uid}/lastSeen        : number   en son çevrimdışına düşüş
/chatMeta/{chatId}/inChat/{uid} : connId   "bu sohbet ekranımda açık"
/chatMeta/{chatId}/typing/{uid} : connId   "şu an yazıyor"
```

- Kullanıcı, en az bir canlı `conns` kaydı varken **çevrimiçidir** (çok cihaz doğal çalışır).
- `inChat` / `typing` değeri `true` değil, yazan oturumun **bağlantı kimliğidir**. Karşı taraf
  bayrağı yalnız o kimliğin `conns` kaydı hâlâ duruyorsa geçerli sayar. Soket ölünce / uygulama
  arka plana atılınca kayıt silinir ve bayraklar kendiliğinden geçersizleşir. `chatMeta` için
  ayrı `onDisconnect` kurulmaz.
- Sunucu push'u da aynı kuralla susturulur (`functions/chatPresence.js`).

## Kod

| Dosya | Rol |
|---|---|
| `services/presenceModel.js` | Okuyucu modeli: `isOnlineEffective`, `isLiveFlag`, gizlilik filtresi (saf) |
| `services/presenceSession.js` | Yazıcı durum makinesi (saf; RTDB/AppState adapter ile enjekte) |
| `services/presenceService.js` | Gerçek RTDB + AppState adapter'ı, `startPresence/stopPresence`, çıkış kancası |
| `services/chatSignals.js` | `createTypingController`, `createChatSignals`, `resolveFriendSignals` (saf) |
| `services/chatRtdb.js` | RTDB yazımı + `subscribeChatMeta` (bayraklar + presence tek çift dinleyici) |
| `functions/chatPresence.js` | Push susturma kararı (saf + sahte RTDB ile testli) |
| `database.rules.json` | Şekil/uzunluk doğrulaması; yalnız kendi `inChat`/`typing` yuvana yazılır |

## Durum makinesi değişmezleri

- Çevrimiçi olurken: **önce onDisconnect kur, sonra kaydı yaz.**
- Çevrimdışı olurken: **önce kaydı sil, sonra onDisconnect'i iptal et.**
- onDisconnect tek seferliktir; her (yeniden) bağlanmada ve her ön plana dönüşte yeniden kurulur.
- Her soket (epoch) yeni `connId` alır; ölen soketin artık kaydı yeni bağlanışta açıkça silinir.
- iOS `inactive` (bildirim merkezi vb.) 5 sn tolere edilir; `background` anında çevrimdışı.
- Arka planda başlayan süreç (bildirimle uyanma) bağlansa bile çevrimiçi yazmaz.
- Her ağ çağrısı 8 sn zaman aşımlı: asılı kalan bir çağrı makineyi kilitlemez.
- Çıkış: `auth.beforeAuthStateChanged` kancası oturum DEĞİŞMEDEN önce kaydı siler
  (Ayarlar çıkışı, hesap geçişi ve oturum geçersiz kılınınca otomatik çıkış aynı noktadan
  kapsanır; `deleteUser` hesabı sunucuda sildikten SONRA `signOut` çağırdığından orada yazım
  reddedilebilir — bkz. "Bilinen sınırlar").

## Eski hatalar (neden bu mimari)

1. `.info/connected` her true olduğunda koşulsuz ONLINE yazılıyordu → arka planda bağlantı yenilenirse sonsuza dek çevrimiçi.
2. onDisconnect yeniden kurulmuyordu (tek seferlik) → sonraki ani kapanışta `inChat` takılı kalıyor, sunucu push'u o sohbet için susuyordu.
3. Çıkışta offline yazımı auth düştükten sonra deneniyordu → reddediliyordu.
4. Ölü soketin gecikmeli onDisconnect'i yeni oturumun ONLINE'ını eziyordu.
5. Metin kutuda dururken "yazıyor" sonsuza dek açık kalıyordu.
6. `seen` ve okunmamış sayacı sıfırlama, uygulama arka plandayken de çalışıyordu (yalnız ekran odağına bakılıyordu).

## Yayına alma

1. `firebase deploy --only database` — yeni kurallar. Yeni kurallar eski istemcilerin `isOnline` /
   `inChat: true` yazımlarını reddeder (eski sürümler çevrimdışı görünür); yeni istemci eski kurallarla da çalışır.
2. `firebase deploy --only functions:onSocialNotificationCreated` — push susturma yeni kimlik modelini okur.
   Deploy edilmezse yeni istemci çalışır ama sohbet açıkken sunucu push'u susturmaz (ön plan
   bildirim süzgeci banner'ı yine bastırır).
3. İstemci: bu sürümle birlikte.

Eski şemanın RTDB'de kalmış `isOnline:true` kalıntıları okunmaz (okuyucu yalnız `conns`'a bakar) ve
kullanıcının ilk çevrimiçi yazımında temizlenir.

## Bilinen sınırlar

- Hesap silmede, silme sürerken açık oturumun `onDisconnect(lastSeen)` işlemi soket ölünce tek bir
  zaman damgası (`presence/{uid}/lastSeen`) bırakabilir; PII içermez.
- "Çevrimiçi durumumu gizle" tercihi istemci tarafında uygulanır; RTDB kuralları Firestore'daki
  arkadaşlık/gizlilik verisini okuyamadığından presence düğümü giriş yapan herkese okunabilir.
- Kayıtlar yalnız `.info/connected` ve AppState ile güncellenir (heartbeat yok). Cihaz ağı
  FIN göndermeden kaybolursa sunucu soket zaman aşımına kadar (~1 dk) kaydı tutabilir.

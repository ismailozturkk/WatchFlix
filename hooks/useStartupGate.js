// hooks/useStartupGate.js
//
// Açılış yükünü zamana yaymak için basit kapı. İlk render'da false döner;
// etkileşimler bittikten sonra verilen gecikmeyle true olur ve bir daha
// değişmez. Splash kapandıktan hemen sonraki saniyelerde tüm provider'ların
// (feed fetch, istatistik listener'ları, disk taraması...) aynı anda çalışıp
// JS thread'i kilitlemesini önler: kritik olmayan başlangıç işleri bu kapının
// arkasına alınır, her biri farklı gecikmeyle sırayla devreye girer.
//
// KADEME TABLOSU — yeni bir kapı eklerken çakışmayan bir dilim seç:
//   800   İkon fontları: FontAwesome/Feather/Octicons/MaterialIcons (App.js)
//   1000  MediaActivityContext   (puan/yorum listener'ları; rozetler tohumdan)
//   1200  UserProfileContext     (migration + profil listener'ı)
//   1400  FriendsContext         (3 istek/arkadaş listener'ı)
//   1600  (boş — ProfileStatsContext artık dinleyici açmıyor, kapı kaldırıldı)
//   1800  SharedListsContext     (ortak liste üyelik + item listener'ları)
//   2000  PostsContext           (feed fetch + realtime listener)
//   2200  (boş — ProfileRemindersContext artık YEREL-ÖNCELİKLİ: dinleyici yok, kapı yok)
//   2400  (boş — ProfileNotesContext, aynı nedenle)
//   2600  (boş — MediaNotesContext, aynı nedenle; bkz. services/userData)
//   2800  NotificationsContext   (bildirim listener'ı; foreground banner kaynağı)
//   3000  UnreadMessagesContext  (okunmamış mesaj toplamı; OS rozeti buradan)
//   3200  ChatModal mount'u (App.js, bu hook'u kullanmaz)
//   3600  DeviceNotificationsContext (izin + push token + hatırlatıcı zamanlama)
//   4000  Font kataloğu (context/TypographyContext.js, kendi zamanlayıcısı)
//
// Kapı SADECE ertelenebilir işleri korumalı: açılış karesinin çizdiği veri ya
// senkron tohumdan gelmeli (snapshotCache/MMKV) ya da hiç kapılanmamalı
// (ListStatusContext ve PremiumContext bilerek kapısız).
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export default function useStartupGate(delayMs = 0) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    let timer = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setReady(true), delayMs);
    });
    return () => {
      task.cancel?.();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  return ready;
}

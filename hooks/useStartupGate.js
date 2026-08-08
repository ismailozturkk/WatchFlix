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
//   1200  İkon fontları: FontAwesome/Feather/Octicons/MaterialIcons (App.js,
//         bu hook'u kullanmaz; Ionicons+MaterialCommunityIcons splash'te)
//   1600  PetContext (kendi InteractionManager+setTimeout'u, bu hook'u kullanmaz)
//   1800  MediaActivityContext   (puan/yorum listener'ları; rozetler tohumdan)
//   2000  SharedListsContext     (ortak liste üyelik + item listener'ları)
//   2200  PostsContext           (feed fetch + realtime listener)
//   2400  ProfileRemindersContext(2+N hatırlatıcı listener'ı; widget tohumdan)
//   2600  ProfileNotesContext    (not listener'ı)
//   2800  UserProfileContext     (migration + profil listener'ı; ChatModal 3800'den önce)
//   3000  FriendsContext         (3 istek/arkadaş listener'ı)
//   3200  ProfileStatsContext    (Lists kök + watched listener'ları)
//   3400  NotificationsContext   (bildirim listener'ı; OS rozeti bundan türer)
//   3800  ChatModal mount'u (App.js, bu hook'u kullanmaz)
//   4200  DeviceNotificationsContext (izin + push token + hatırlatıcı zamanlama)
//   5000  Font kataloğu (context/TypographyContext.js, kendi zamanlayıcısı)
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

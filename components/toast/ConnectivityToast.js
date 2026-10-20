// components/toast/ConnectivityToast.js
//
// Başsız bileşen: bağlantı kopup bir süre sürerse "Çevrimdışısın" uyarısı, dönünce "Tekrar
// çevrimiçisin" bilgisi gösterir. Uygulama yerel-öncelikli çalıştığı için mesaj kullanıcıya
// asıl bilgiyi verir: kayıtlı veri açık, değişiklikler bağlantı gelince eşitlenir.
// Karar mantığı utils/connectivityToast.js (saf, test edilir); burada yalnız bağlama.
//
// ConnectivityProvider İÇİNDE, <ToastHost /> yanında bir kez bağlanır (App.js).

import { useEffect, useRef } from "react";
import { useConnectivity } from "../../context/ConnectivityContext";
import { createConnectivityAnnouncer } from "../../utils/connectivityToast";
import { i18nText } from "../../utils/i18nText";
import { toast } from "../AppToast";

export default function ConnectivityToast() {
  const { isOnline } = useConnectivity();
  const announcerRef = useRef(null);

  if (!announcerRef.current) {
    announcerRef.current = createConnectivityAnnouncer({
      // Metinler gösterim ANINDA çözülür: uygulama dili o arada değişmiş olabilir.
      onOffline: () =>
        toast.warning(
          i18nText("autoI18n.toast_cevrimdisi_baslik", "Çevrimdışısın"),
          i18nText(
            "autoI18n.toast_cevrimdisi_aciklama",
            "Kayıtlı veriler açık kalır; bağlantı gelince değişikliklerin eşitlenir.",
          ),
          { key: "connectivity:offline", duration: 5600, haptic: false },
        ),
      onOnline: (offlineToastId) => {
        if (offlineToastId) toast.hide(offlineToastId);
        toast.success(
          i18nText("autoI18n.toast_cevrimici_baslik", "Tekrar çevrimiçisin"),
          i18nText("autoI18n.toast_cevrimici_aciklama", "Bekleyen değişiklikler eşitleniyor."),
          { key: "connectivity:online", duration: 3000, haptic: false },
        );
      },
    });
  }

  useEffect(() => {
    announcerRef.current.update(isOnline);
  }, [isOnline]);

  useEffect(() => () => announcerRef.current?.dispose(), []);

  return null;
}

// hooks/useBadgeCelebration.js
//
// Rozet / Perde / Makara kutlamasını UYGULAMA GENELİNDE gösterir.
//
// ESKİDEN: kutlama ProfileScreen'in içindeki bir effect'teydi. Profil sekmesi
// tembel mount edildiği için kullanıcı o sekmeye ilk kez girene kadar HİÇ
// oynamıyordu: filmi işaretlediği anda kazandığı rozetin bildirimi, günler sonra
// profile baktığı an geliyordu — kazanma anıyla bağı kopuk, bayat bir "kutlama".
// Şimdi kutlama, rozetin açıldığı oturumda, nerede olursa olsun gösterilir.
//
// Push bildirimi YOK (bir izleme rozeti telefonu titretmeyi hak etmez); yalnızca
// uygulama açıkken, uygulamanın kendi toast katmanında. İlk tohumlamada hiç
// tetiklenmez (useWatchProgress `kutlama`yı kurmaz) — mevcut kullanıcı 30 rozetlik
// bir yağmura tutulmaz (docs §6.1).
//
// BAŞLIK = EN NADİR ÖDÜL. Aynı turda birden çok ödül açıldığında ilk id'yi
// göstermek rastgeleydi; 3 rozetten biri Efsanevi ise ekranda o durmalı, kalanlar
// "+2" çipinde.

import { useEffect } from "react";
import { useLanguage } from "@context/LanguageContext";
import { toast } from "@components/AppToast";
import { baslikOdulu } from "@components/badges/badgeMeta";
import { navigateRoot } from "@services/rootNavigation";
import { NotificationFeedbackType, notificationAsync } from "@services/hapticsService";
import { PERDE_ADLARI, PERDE_ADLARI_EN } from "@utils/watchScoring";
import { i18nText } from "@utils/i18nText";

export default function useBadgeCelebration({ kutlama, kutlamayiKapat }) {
  const { language } = useLanguage();

  useEffect(() => {
    if (!kutlama) return;
    const lang = language === "en" ? "en" : "tr";
    const baslik = baslikOdulu(kutlama.rozetler, lang);

    if (baslik) {
      const { gorunum, ek } = baslik;
      toast.badge(
        gorunum.baslik,
        gorunum.ad,
        { gorunum, ek, ipucu: i18nText("autoI18n.rozet_toast_ipucu", "Görmek için dokun") },
        { onPress: () => navigateRoot("WatchBadgesScreen", { openId: gorunum.id }) },
      );
      notificationAsync(NotificationFeedbackType.Success).catch(() => {});
    } else if (kutlama.perdeAtladi) {
      const adlar = lang === "en" ? PERDE_ADLARI_EN : PERDE_ADLARI;
      toast.success(
        i18nText("autoI18n.perde_atlandi", `Perde ${kutlama.yeniPerde}'e yükseldin`, {
          n: kutlama.yeniPerde,
        }),
        adlar[kutlama.yeniPerde - 1] || "",
        { onPress: () => navigateRoot("WatchBadgesScreen") },
      );
      notificationAsync(NotificationFeedbackType.Success).catch(() => {});
    } else if (kutlama.makaraAtladi) {
      // Makara ayrı bildirilir: zirvedeki kullanıcının Perdesi değişmiyor,
      // "Perde 20'e yükseldin" demek yanlış olurdu.
      toast.success(
        i18nText("autoI18n.makara_atlandi", `${kutlama.yeniMakara}. Makara`, {
          n: kutlama.yeniMakara,
        }),
        (lang === "en" ? PERDE_ADLARI_EN : PERDE_ADLARI)[PERDE_ADLARI.length - 1],
        { onPress: () => navigateRoot("WatchBadgesScreen") },
      );
      notificationAsync(NotificationFeedbackType.Success).catch(() => {});
    }
    kutlamayiKapat();
  }, [kutlama, kutlamayiKapat, language]);
}

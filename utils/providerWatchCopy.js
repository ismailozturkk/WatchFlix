// utils/providerWatchCopy.js
//
// İzleme listesi "Platformlarımda" süzgecinin metinleri (tr / en / es). Saf veri: RN içe aktarması
// yok. __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.
// Yol adları gerçek ekranlarla aynı olmalı: Ayarlar > Platform üyeliklerim, Ayarlar > Bildirimler.

import { copyLanguage } from "./appLanguages";

export const PROVIDER_WATCH_COPY = {
  tr: {
    section: "PLATFORM",
    chip: "Platformlarımda",
    chipCount: (count) => `Platformlarımda · ${count}`,
    chipLabel: (count) => `Yalnız platformlarımda izlenebilenler, ${count} başlık`,
    ready: (yes, total) => `${total} başlıktan ${yes} tanesi seçtiğin platformlarda izlenebiliyor`,
    none: "Seçtiğin platformlarda izlenebilen başlık yok",
    unknown: (count) => `${count} başlık henüz denetlenmedi; bu süzgeçte görünmezler`,
    age: (days) => `Son denetim ${days} gün önce`,
    off: "Önce Ayarlar > Platform üyeliklerim'den platformlarını seç",
    noData:
      "Bu süzgeç için Ayarlar > Bildirimler'de “Yayına gelince bildir”i aç. İlk sonuç bir sonraki akşam 18:00'de gelir",
    region: "Platform verisi başka bir bölge için hazırlanmış; bir sonraki denetimde güncellenir",
  },
  en: {
    section: "PLATFORM",
    chip: "On my platforms",
    chipCount: (count) => `On my platforms · ${count}`,
    chipLabel: (count) => `Only titles available on my platforms, ${count} titles`,
    ready: (yes, total) => `${yes} of ${total} titles are available on the platforms you picked`,
    none: "Nothing here is available on the platforms you picked",
    unknown: (count) => `${count} titles haven't been checked yet; they won't show with this filter`,
    age: (days) => `Last checked ${days} days ago`,
    off: "First pick your platforms in Settings > My subscriptions",
    noData:
      "Turn on “Notify when available” in Settings > Notifications to use this filter. The first results arrive at 6 PM the next evening",
    region: "Platform data was prepared for another region; it updates on the next check",
  },
  es: {
    section: "PLATAFORMA",
    chip: "En mis plataformas",
    chipCount: (count) => `En mis plataformas · ${count}`,
    chipLabel: (count) => `Solo títulos disponibles en mis plataformas, ${count} títulos`,
    ready: (yes, total) => `${yes} de ${total} títulos están disponibles en las plataformas que elegiste`,
    none: "Nada de aquí está disponible en las plataformas que elegiste",
    unknown: (count) => `${count} títulos aún no se han comprobado; no aparecerán con este filtro`,
    age: (days) => `Última comprobación hace ${days} días`,
    off: "Primero elige tus plataformas en Ajustes > Mis suscripciones",
    noData:
      "Activa “Avisar cuando esté disponible” en Ajustes > Notificaciones para usar este filtro. Los primeros resultados llegan a las 18:00 de la noche siguiente",
    region: "Los datos de plataformas se prepararon para otra región; se actualizan en la próxima comprobación",
  },
  pt: {
    section: "SERVIÇO",
    chip: "Nos meus serviços",
    chipCount: (count) => `Nos meus serviços · ${count}`,
    chipLabel: (count) => `Apenas títulos disponíveis nos meus serviços, ${count} títulos`,
    ready: (yes, total) => `${yes} de ${total} títulos estão disponíveis nos serviços que você escolheu`,
    none: "Nada daqui está disponível nos serviços que você escolheu",
    unknown: (count) => `${count} títulos ainda não foram verificados; não aparecerão com este filtro`,
    age: (days) => `Última verificação há ${days} dias`,
    off: "Primeiro escolha seus serviços em Configurações > Minhas assinaturas",
    noData:
      "Ative “Avisar quando estiver disponível” em Configurações > Notificações para usar este filtro. Os primeiros resultados chegam às 18h da noite seguinte",
    region: "Os dados de serviços foram preparados para outra região; são atualizados na próxima verificação",
  },
  de: {
    section: "PLATFORM",
    chip: "Bei meinen Plattformen",
    chipCount: (count) => `Bei meinen Plattformen · ${count}`,
    chipLabel: (count) => `Nur Titel, die bei meinen Plattformen verfügbar sind, ${count} Titel`,
    ready: (yes, total) => `${yes} von ${total} Titeln sind bei den von dir gewählten Plattformen verfügbar`,
    none: "Hier ist nichts bei den von dir gewählten Plattformen verfügbar",
    unknown: (count) => `${count} Titel wurden noch nicht geprüft; sie erscheinen mit diesem Filter nicht`,
    age: (days) => `Zuletzt vor ${days} Tagen geprüft`,
    off: "Wähle zuerst deine Plattformen unter Einstellungen > Meine Abos",
    noData:
      "Aktiviere „Bei Verfügbarkeit benachrichtigen“ unter Einstellungen > Benachrichtigungen, um diesen Filter zu nutzen. Die ersten Ergebnisse kommen am nächsten Abend um 18 Uhr",
    region: "Die Plattformdaten wurden für eine andere Region vorbereitet; sie werden bei der nächsten Prüfung aktualisiert",
  },

  it: {
  section: "PLATFORM",
  chip: "Sulle mie piattaforme",
  chipCount: count => `Sulle mie piattaforme · ${count}`,
  chipLabel: count => `Solo i titoli disponibili sulle mie piattaforme, ${count} titoli`,
  ready: (yes, total) => `${yes} di ${total} titoli sono disponibili sulle piattaforme che hai scelto`,
  none: "Niente qui è disponibile sulle piattaforme che hai scelto",
  unknown: count => `${count} titoli non sono stati ancora controllati; non verranno visualizzati con questo filtro`,
  age: days => `Ultimo controllo ${days} giorni fa`,
  off: "Per prima cosa scegli le tue piattaforme in Impostazioni > I miei abbonamenti",
  noData: "Attiva \"Notifica quando disponibile\" in Impostazioni > Notifiche per utilizzare questo filtro. I primi risultati arrivano alle 18 della sera successiva",
  region: "I dati della piattaforma sono stati preparati per un'altra regione; si aggiorna al controllo successivo"
},
  fr: {
    section: "PLATEFORME",
    chip: "Sur mes plateformes",
    chipCount: (count) => `Sur mes plateformes · ${count}`,
    chipLabel: (count) => `Uniquement les titres disponibles sur mes plateformes, ${count} titres`,
    ready: (yes, total) => `${yes} titres sur ${total} sont disponibles sur les plateformes choisies`,
    none: "Rien ici n'est disponible sur les plateformes choisies",
    unknown: (count) => `${count} titres n'ont pas encore été vérifiés ; ils n'apparaîtront pas avec ce filtre`,
    age: (days) => `Dernière vérification il y a ${days} jours`,
    off: "Choisis d'abord tes plateformes dans Réglages > Mes abonnements",
    noData:
      "Active « Prévenir quand c'est disponible » dans Réglages > Notifications pour utiliser ce filtre. Les premiers résultats arrivent le lendemain à 18 h",
    region: "Les données de plateformes ont été préparées pour une autre région ; elles se mettront à jour à la prochaine vérification",
  },
  ja: {
    section: "プラットフォーム",
    chip: "利用中のプラットフォームで",
    chipCount: (count) => `利用中のプラットフォームで · ${count}`,
    chipLabel: (count) => `利用中のプラットフォームで観られる作品のみ、${count}作品`,
    ready: (yes, total) => `${total}作品中${yes}作品が選んだプラットフォームで観られます`,
    none: "選んだプラットフォームで観られるものはありません",
    unknown: (count) => `${count}作品はまだ確認されていないため、この絞り込みでは表示されません`,
    age: (days) => `最終確認は${days}日前`,
    off: "まず設定 > 登録中のサービスでプラットフォームを選んでください",
    noData:
      "この絞り込みを使うには、設定 > 通知で「配信開始時に通知」をオンにしてください。最初の結果は翌日の午後6時に届きます",
    region: "プラットフォームのデータは別の地域向けに準備されています。次回の確認で更新されます",
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getProviderWatchCopy = (language) =>
  PROVIDER_WATCH_COPY[copyLanguage(language, Object.keys(PROVIDER_WATCH_COPY))];

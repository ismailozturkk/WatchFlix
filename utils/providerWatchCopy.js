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
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getProviderWatchCopy = (language) =>
  PROVIDER_WATCH_COPY[copyLanguage(language, Object.keys(PROVIDER_WATCH_COPY))];

// components/permissions/permissionSheetCopy.js
//
// İzin sayfasının (PermissionActionSheet) metinleri, beş dil. Takvimin kendi sayfası
// var (CalendarPermissionSheet); bildirim izninin ilk açıklaması NotificationPrimingSheet.
// "Geri çek" her dilde sistem ayarlarına götürür: işletim sistemi uygulamanın kendi
// iznini kapatmasına izin vermez, metin bunu gizlemez.

import { copyLanguage } from "../../utils/appLanguages";

const tr = {
  shared: {
    notNow: "Şimdi değil",
    cancel: "Vazgeç",
    openSettings: "Sistem ayarlarını aç",
    revokeAction: "Sistem ayarlarında kapat",
    settingsFootnote: "İzinler yalnızca sistem ayarlarından değiştirilebilir; bu düğme seni oraya götürür.",
    requestFootnote: "Kararını istediğin zaman Ayarlar › İzinler'den değiştirebilirsin.",
  },
  notifications: {
    requestTitle: "Bildirimlere izin ver",
    requestBody: "Hatırlatmaların ve mesajların telefonuna düşebilmesi için bildirim izni gerekiyor.",
    allow: "Bildirimleri aç",
    blockedTitle: "Bildirimler kapalı",
    blockedBody: "Bu izin daha önce reddedildi, artık yalnızca sistem ayarlarından açılabilir.",
    revokeTitle: "Bildirim iznini geri çek",
    revokeBody: "İzni kapatırsan Seelogd telefonuna hiçbir bildirim gönderemez.",
    gain: [
      { t: "Yayın hatırlatmaları", d: "Takip ettiğin film ve bölümler yayınlanınca haber alırsın" },
      { t: "Arkadaşlar ve mesajlar", d: "Arkadaş istekleri ve mesajlar anında ulaşır" },
      { t: "Beğeni ve yorumlar", d: "Paylaşımlarına gelen tepkileri kaçırmazsın" },
    ],
    lose: [
      { t: "Hatırlatmalar durur", d: "Film ve bölüm hatırlatmaları telefonuna düşmez" },
      { t: "Mesajlar sessiz kalır", d: "Yeni mesajları uygulamayı açınca görürsün" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Galeriye kaydetme izni",
    requestBody: "Afişleri ve paylaşım kartlarını telefonuna kaydedebilmen için gerekir.",
    allow: "Kaydetmeye izin ver",
    blockedTitle: "Galeri izni kapalı",
    blockedBody: "Bu izin daha önce reddedildi, artık yalnızca sistem ayarlarından açılabilir.",
    revokeTitle: "Galeri iznini geri çek",
    revokeBody: "İzni kapatırsan Seelogd telefonuna görsel kaydedemez.",
    gain: [
      { t: "Yalnızca kaydetme", d: "Seelogd galerine sadece yeni görsel ekler" },
      { t: "Galerin okunmaz", d: "Mevcut fotoğrafların görülmez ve hiçbir yere gönderilmez" },
      { t: "Sen istediğinde", d: "Bir görsel yalnızca sen kaydet dediğinde eklenir" },
    ],
    lose: [
      { t: "Görsel kaydedilemez", d: "Afişleri ve paylaşım kartlarını indiremezsin" },
      { t: "Kayıtlı görseller durur", d: "Daha önce kaydettiklerin galerinde kalır" },
    ],
  },
};

const en = {
  shared: {
    notNow: "Not now",
    cancel: "Cancel",
    openSettings: "Open system settings",
    revokeAction: "Turn off in system settings",
    settingsFootnote: "Permissions can only be changed in system settings; this button takes you there.",
    requestFootnote: "You can change this any time in Settings › Permissions.",
  },
  notifications: {
    requestTitle: "Allow notifications",
    requestBody: "Your reminders and messages need notification permission to reach your phone.",
    allow: "Turn on notifications",
    blockedTitle: "Notifications are off",
    blockedBody: "This permission was denied before, so it can now only be turned on in system settings.",
    revokeTitle: "Revoke notification permission",
    revokeBody: "If you turn this off, Seelogd can't send any notifications to your phone.",
    gain: [
      { t: "Release reminders", d: "Hear about the films and episodes you follow when they come out" },
      { t: "Friends and messages", d: "Friend requests and messages reach you right away" },
      { t: "Likes and comments", d: "Don't miss reactions to your posts" },
    ],
    lose: [
      { t: "Reminders stop", d: "Film and episode reminders won't reach your phone" },
      { t: "Messages stay silent", d: "You'll see new messages when you open the app" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Allow saving to your gallery",
    requestBody: "Needed so you can save posters and share cards to your phone.",
    allow: "Allow saving",
    blockedTitle: "Gallery permission is off",
    blockedBody: "This permission was denied before, so it can now only be turned on in system settings.",
    revokeTitle: "Revoke gallery permission",
    revokeBody: "If you turn this off, Seelogd can't save images to your phone.",
    gain: [
      { t: "Saving only", d: "Seelogd only adds new images to your gallery" },
      { t: "Your gallery isn't read", d: "Your existing photos aren't seen or sent anywhere" },
      { t: "Only when you ask", d: "An image is added only when you tap save" },
    ],
    lose: [
      { t: "Images can't be saved", d: "You won't be able to download posters and share cards" },
      { t: "Saved images stay", d: "What you saved before stays in your gallery" },
    ],
  },
};

const es = {
  shared: {
    notNow: "Ahora no",
    cancel: "Cancelar",
    openSettings: "Abrir ajustes del sistema",
    revokeAction: "Desactivar en ajustes del sistema",
    settingsFootnote: "Los permisos solo se pueden cambiar en los ajustes del sistema; este botón te lleva allí.",
    requestFootnote: "Puedes cambiarlo cuando quieras en Ajustes › Permisos.",
  },
  notifications: {
    requestTitle: "Permitir notificaciones",
    requestBody: "Tus recordatorios y mensajes necesitan este permiso para llegar a tu teléfono.",
    allow: "Activar notificaciones",
    blockedTitle: "Las notificaciones están desactivadas",
    blockedBody: "Este permiso se denegó antes, así que ahora solo se puede activar en los ajustes del sistema.",
    revokeTitle: "Retirar el permiso de notificaciones",
    revokeBody: "Si lo desactivas, Seelogd no podrá enviar notificaciones a tu teléfono.",
    gain: [
      { t: "Recordatorios de estrenos", d: "Entérate cuando salgan las películas y episodios que sigues" },
      { t: "Amigos y mensajes", d: "Las solicitudes y los mensajes te llegan al instante" },
      { t: "Me gusta y comentarios", d: "No te pierdas las reacciones a tus publicaciones" },
    ],
    lose: [
      { t: "Se detienen los recordatorios", d: "Los recordatorios no llegarán a tu teléfono" },
      { t: "Mensajes en silencio", d: "Verás los mensajes nuevos al abrir la app" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Permitir guardar en la galería",
    requestBody: "Es necesario para guardar pósteres y tarjetas en tu teléfono.",
    allow: "Permitir guardar",
    blockedTitle: "El permiso de galería está desactivado",
    blockedBody: "Este permiso se denegó antes, así que ahora solo se puede activar en los ajustes del sistema.",
    revokeTitle: "Retirar el permiso de galería",
    revokeBody: "Si lo desactivas, Seelogd no podrá guardar imágenes en tu teléfono.",
    gain: [
      { t: "Solo guardar", d: "Seelogd solo añade imágenes nuevas a tu galería" },
      { t: "Tu galería no se lee", d: "Tus fotos no se ven ni se envían a ningún sitio" },
      { t: "Solo cuando quieras", d: "Una imagen se añade solo cuando tocas guardar" },
    ],
    lose: [
      { t: "No se pueden guardar imágenes", d: "No podrás descargar pósteres ni tarjetas" },
      { t: "Lo guardado se queda", d: "Lo que ya guardaste sigue en tu galería" },
    ],
  },
};

const pt = {
  shared: {
    notNow: "Agora não",
    cancel: "Cancelar",
    openSettings: "Abrir ajustes do sistema",
    revokeAction: "Desativar nos ajustes do sistema",
    settingsFootnote: "As permissões só podem ser alteradas nos ajustes do sistema; este botão leva você até lá.",
    requestFootnote: "Você pode mudar isso quando quiser em Configurações › Permissões.",
  },
  notifications: {
    requestTitle: "Permitir notificações",
    requestBody: "Seus lembretes e mensagens precisam desta permissão para chegar ao seu celular.",
    allow: "Ativar notificações",
    blockedTitle: "As notificações estão desativadas",
    blockedBody: "Esta permissão foi negada antes, então agora só pode ser ativada nos ajustes do sistema.",
    revokeTitle: "Retirar a permissão de notificações",
    revokeBody: "Se você desativar, o Seelogd não poderá enviar notificações ao seu celular.",
    gain: [
      { t: "Lembretes de estreias", d: "Saiba quando saírem os filmes e episódios que você segue" },
      { t: "Amigos e mensagens", d: "Pedidos de amizade e mensagens chegam na hora" },
      { t: "Curtidas e comentários", d: "Não perca as reações às suas publicações" },
    ],
    lose: [
      { t: "Os lembretes param", d: "Os lembretes não chegarão ao seu celular" },
      { t: "Mensagens em silêncio", d: "Você verá as novas mensagens ao abrir o app" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Permitir salvar na galeria",
    requestBody: "Necessário para salvar pôsteres e cards no seu celular.",
    allow: "Permitir salvar",
    blockedTitle: "A permissão da galeria está desativada",
    blockedBody: "Esta permissão foi negada antes, então agora só pode ser ativada nos ajustes do sistema.",
    revokeTitle: "Retirar a permissão da galeria",
    revokeBody: "Se você desativar, o Seelogd não poderá salvar imagens no seu celular.",
    gain: [
      { t: "Só salvar", d: "O Seelogd apenas adiciona novas imagens à sua galeria" },
      { t: "Sua galeria não é lida", d: "Suas fotos não são vistas nem enviadas a lugar nenhum" },
      { t: "Só quando você pedir", d: "Uma imagem é adicionada só quando você toca em salvar" },
    ],
    lose: [
      { t: "Imagens não podem ser salvas", d: "Você não poderá baixar pôsteres e cards" },
      { t: "O que foi salvo fica", d: "O que você já salvou continua na galeria" },
    ],
  },
};

const de = {
  shared: {
    notNow: "Nicht jetzt",
    cancel: "Abbrechen",
    openSettings: "Systemeinstellungen öffnen",
    revokeAction: "In den Systemeinstellungen ausschalten",
    settingsFootnote: "Berechtigungen lassen sich nur in den Systemeinstellungen ändern; diese Taste bringt dich dorthin.",
    requestFootnote: "Du kannst das jederzeit unter Einstellungen › Berechtigungen ändern.",
  },
  notifications: {
    requestTitle: "Benachrichtigungen erlauben",
    requestBody: "Deine Erinnerungen und Nachrichten brauchen diese Berechtigung, um dein Telefon zu erreichen.",
    allow: "Benachrichtigungen einschalten",
    blockedTitle: "Benachrichtigungen sind aus",
    blockedBody: "Diese Berechtigung wurde abgelehnt und lässt sich jetzt nur noch in den Systemeinstellungen einschalten.",
    revokeTitle: "Benachrichtigungen widerrufen",
    revokeBody: "Wenn du das ausschaltest, kann Seelogd keine Benachrichtigungen mehr an dein Telefon senden.",
    gain: [
      { t: "Starterinnerungen", d: "Erfahre, wenn Filme und Folgen erscheinen, denen du folgst" },
      { t: "Freunde und Nachrichten", d: "Anfragen und Nachrichten erreichen dich sofort" },
      { t: "Likes und Kommentare", d: "Verpasse keine Reaktionen auf deine Beiträge" },
    ],
    lose: [
      { t: "Erinnerungen stoppen", d: "Erinnerungen erreichen dein Telefon nicht mehr" },
      { t: "Nachrichten bleiben stumm", d: "Neue Nachrichten siehst du beim Öffnen der App" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Speichern in der Galerie erlauben",
    requestBody: "Wird benötigt, damit du Poster und Karten auf deinem Telefon speichern kannst.",
    allow: "Speichern erlauben",
    blockedTitle: "Galerie-Berechtigung ist aus",
    blockedBody: "Diese Berechtigung wurde abgelehnt und lässt sich jetzt nur noch in den Systemeinstellungen einschalten.",
    revokeTitle: "Galerie-Berechtigung widerrufen",
    revokeBody: "Wenn du das ausschaltest, kann Seelogd keine Bilder auf deinem Telefon speichern.",
    gain: [
      { t: "Nur speichern", d: "Seelogd fügt deiner Galerie nur neue Bilder hinzu" },
      { t: "Deine Galerie wird nicht gelesen", d: "Deine Fotos werden weder angesehen noch gesendet" },
      { t: "Nur auf Wunsch", d: "Ein Bild wird nur hinzugefügt, wenn du auf Speichern tippst" },
    ],
    lose: [
      { t: "Kein Speichern von Bildern", d: "Du kannst keine Poster und Karten herunterladen" },
      { t: "Gespeichertes bleibt", d: "Was du gespeichert hast, bleibt in deiner Galerie" },
    ],
  },
};

export const PERMISSION_SHEET_COPY = { tr, en, es, pt, de };

export const getPermissionSheetCopy = (language) =>
  PERMISSION_SHEET_COPY[copyLanguage(language, Object.keys(PERMISSION_SHEET_COPY))];

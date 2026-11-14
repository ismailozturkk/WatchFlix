// components/permissions/permissionSheetCopy.js
//
// İzin sayfasının (PermissionActionSheet) metinleri, sekiz dil. Takvimin kendi sayfası
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

const it = {
  shared: {
    notNow: "Non ora",
    cancel: "Annulla",
    openSettings: "Apri le impostazioni di sistema",
    revokeAction: "Disattiva nelle impostazioni di sistema",
    settingsFootnote: "I permessi si possono cambiare solo nelle impostazioni di sistema; questo pulsante ti porta lì.",
    requestFootnote: "Puoi cambiare idea quando vuoi in Impostazioni › Permessi.",
  },
  notifications: {
    requestTitle: "Consenti le notifiche",
    requestBody: "Promemoria e messaggi hanno bisogno del permesso di notifica per arrivare sul tuo telefono.",
    allow: "Attiva le notifiche",
    blockedTitle: "Notifiche disattivate",
    blockedBody: "Questo permesso è stato negato in precedenza: ora si può attivare solo dalle impostazioni di sistema.",
    revokeTitle: "Revoca il permesso di notifica",
    revokeBody: "Se lo disattivi, Seelogd non potrà inviare notifiche al tuo telefono.",
    gain: [
      { t: "Promemoria di uscita", d: "Ti avvisiamo quando escono i film e gli episodi che segui" },
      { t: "Amici e messaggi", d: "Richieste di amicizia e messaggi arrivano subito" },
      { t: "Mi piace e commenti", d: "Non perdi le reazioni ai tuoi post" },
    ],
    lose: [
      { t: "I promemoria si fermano", d: "I promemoria di film ed episodi non arrivano sul telefono" },
      { t: "I messaggi restano muti", d: "Vedrai i nuovi messaggi quando apri l'app" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Permesso di salvare nella galleria",
    requestBody: "Serve per salvare locandine e schede di condivisione sul telefono.",
    allow: "Consenti il salvataggio",
    blockedTitle: "Permesso galleria disattivato",
    blockedBody: "Questo permesso è stato negato in precedenza: ora si può attivare solo dalle impostazioni di sistema.",
    revokeTitle: "Revoca il permesso della galleria",
    revokeBody: "Se lo disattivi, Seelogd non potrà salvare immagini sul tuo telefono.",
    gain: [
      { t: "Solo salvataggio", d: "Seelogd aggiunge soltanto nuove immagini alla galleria" },
      { t: "La galleria non viene letta", d: "Le tue foto non vengono viste né inviate da nessuna parte" },
      { t: "Solo quando lo chiedi", d: "Un'immagine viene aggiunta solo quando tocchi salva" },
    ],
    lose: [
      { t: "Niente salvataggi", d: "Non potrai scaricare locandine e schede di condivisione" },
      { t: "Le immagini salvate restano", d: "Ciò che hai salvato resta nella galleria" },
    ],
  },
};

const fr = {
  shared: {
    notNow: "Pas maintenant",
    cancel: "Annuler",
    openSettings: "Ouvrir les réglages du système",
    revokeAction: "Désactiver dans les réglages du système",
    settingsFootnote: "Les autorisations ne se modifient que dans les réglages du système ; ce bouton t'y emmène.",
    requestFootnote: "Tu peux changer d'avis à tout moment dans Réglages › Autorisations.",
  },
  notifications: {
    requestTitle: "Autoriser les notifications",
    requestBody: "Tes rappels et messages ont besoin de l'autorisation de notification pour arriver sur ton téléphone.",
    allow: "Activer les notifications",
    blockedTitle: "Notifications désactivées",
    blockedBody: "Cette autorisation a déjà été refusée : elle ne peut plus être activée que dans les réglages du système.",
    revokeTitle: "Retirer l'autorisation de notification",
    revokeBody: "Si tu la désactives, Seelogd ne pourra plus envoyer de notifications sur ton téléphone.",
    gain: [
      { t: "Rappels de sortie", d: "Sois prévenu quand les films et épisodes que tu suis sortent" },
      { t: "Amis et messages", d: "Les demandes d'amis et les messages arrivent tout de suite" },
      { t: "J'aime et commentaires", d: "Ne rate aucune réaction à tes publications" },
    ],
    lose: [
      { t: "Les rappels s'arrêtent", d: "Les rappels de films et d'épisodes n'arrivent plus" },
      { t: "Les messages restent muets", d: "Tu verras les nouveaux messages en ouvrant l'app" },
    ],
  },
  mediaLibrary: {
    requestTitle: "Autoriser l'enregistrement dans la galerie",
    requestBody: "Nécessaire pour enregistrer les affiches et les cartes de partage sur ton téléphone.",
    allow: "Autoriser l'enregistrement",
    blockedTitle: "Accès à la galerie désactivé",
    blockedBody: "Cette autorisation a déjà été refusée : elle ne peut plus être activée que dans les réglages du système.",
    revokeTitle: "Retirer l'accès à la galerie",
    revokeBody: "Si tu le désactives, Seelogd ne pourra plus enregistrer d'images sur ton téléphone.",
    gain: [
      { t: "Enregistrement seulement", d: "Seelogd ajoute uniquement de nouvelles images à ta galerie" },
      { t: "Ta galerie n'est pas lue", d: "Tes photos ne sont ni vues ni envoyées nulle part" },
      { t: "Seulement quand tu le demandes", d: "Une image n'est ajoutée que si tu touches Enregistrer" },
    ],
    lose: [
      { t: "Plus d'enregistrement", d: "Tu ne pourras plus télécharger d'affiches ni de cartes de partage" },
      { t: "Les images enregistrées restent", d: "Ce que tu as enregistré reste dans ta galerie" },
    ],
  },
};

const ja = {
  shared: {
    notNow: "今はしない",
    cancel: "キャンセル",
    openSettings: "システム設定を開く",
    revokeAction: "システム設定でオフにする",
    settingsFootnote: "権限はシステム設定でのみ変更できます。このボタンから設定を開けます。",
    requestFootnote: "設定 › 権限 からいつでも変更できます。",
  },
  notifications: {
    requestTitle: "通知を許可",
    requestBody: "リマインダーやメッセージをスマートフォンに届けるには通知の許可が必要です。",
    allow: "通知をオンにする",
    blockedTitle: "通知はオフです",
    blockedBody: "この権限は以前に拒否されたため、システム設定からのみオンにできます。",
    revokeTitle: "通知の許可を取り消す",
    revokeBody: "オフにすると、Seelogdはスマートフォンに通知を送れなくなります。",
    gain: [
      { t: "公開リマインダー", d: "フォロー中の映画やエピソードが公開されたらお知らせします" },
      { t: "フレンドとメッセージ", d: "フレンド申請やメッセージがすぐに届きます" },
      { t: "いいねとコメント", d: "投稿へのリアクションを見逃しません" },
    ],
    lose: [
      { t: "リマインダーが止まります", d: "映画やエピソードのリマインダーが届かなくなります" },
      { t: "メッセージが通知されません", d: "新しいメッセージはアプリを開いたときに確認できます" },
    ],
  },
  mediaLibrary: {
    requestTitle: "ギャラリーへの保存を許可",
    requestBody: "ポスターや共有カードをスマートフォンに保存するために必要です。",
    allow: "保存を許可",
    blockedTitle: "ギャラリーの権限はオフです",
    blockedBody: "この権限は以前に拒否されたため、システム設定からのみオンにできます。",
    revokeTitle: "ギャラリーの権限を取り消す",
    revokeBody: "オフにすると、Seelogdはスマートフォンに画像を保存できなくなります。",
    gain: [
      { t: "保存のみ", d: "Seelogdはギャラリーに新しい画像を追加するだけです" },
      { t: "ギャラリーは読み取りません", d: "既存の写真を見たり、どこかへ送ったりしません" },
      { t: "求めたときだけ", d: "保存をタップしたときにだけ画像が追加されます" },
    ],
    lose: [
      { t: "画像を保存できません", d: "ポスターや共有カードをダウンロードできなくなります" },
      { t: "保存済みの画像は残ります", d: "これまでに保存した画像はギャラリーに残ります" },
    ],
  },
};

export const PERMISSION_SHEET_COPY = { tr, en, es, pt, de, it, fr, ja };

export const getPermissionSheetCopy = (language) =>
  PERMISSION_SHEET_COPY[copyLanguage(language, Object.keys(PERMISSION_SHEET_COPY))];

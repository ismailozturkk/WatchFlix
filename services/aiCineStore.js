// services/aiCineStore.js
//
// CineMatch Pro (yapılandırılmış AI) sohbet geçmişi — BULUT YEDEKLİ, yerel-öncelikli.
//
// Eskiden yalnız cihazdaki MMKV'de tutuluyordu (telefon değişince / uygulama
// silinince kaybolurdu). Artık Notlar ve Hatırlatıcılar ile aynı motorda
// (services/userData) bir alandır:
//
//   OKUMA   yerel kopyadan, senkron (açılışta buluttan okuma YOK)
//   YAZMA   önce yerelde + kalıcı günlükte, buluta arka planda
//   İNDİRME yalnız yerel kopya yokken tek seferlik (yeni telefon / yeniden kurulum)
//
// Firestore: AiConversations/{uid}/items/{conversationId}
// Şema, boyut bütçesi ve depo API'si: services/userData/aiConversations.js.
// Ekranlar `hooks/useAiConversations` ile okur/yazar; bu dosya yalnız sohbet
// kimliği/başlık yardımcılarını ve veri şeklinin belgesini taşır.
//
// Conversation = { id, title, messages: Message[], createdAt, updatedAt }
// Message = {
//   id, role: "user" | "assistant",
//   text?: string,          // user mesajı + history için
//   display?: string,       // baloncukta gösterilecek kullanıcı metni
//   aiResponse?: object,    // assistant: normalize edilmiş yapılandırılmış cevap
//   posterMap?: object,     // assistant: posterKey -> TMDB kartı
//   status?: "error", retry?: string,
// }
//
// Eski CineMatch'in (aiConversationsStore.js) ayrı bir geçmişi vardır; yalnız
// kimlik/başlık yardımcıları buradan paylaşılır.

import { makeId, summarizeTitle } from "./aiConversationsStore";

export { makeId, summarizeTitle };

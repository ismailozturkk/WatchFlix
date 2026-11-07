// utils/searchDebounce.js
//
// Yazarken arama gecikmesi — TEK kaynak. Kullanıcı yazmayı bu kadar süre bırakınca istek atılır; her tuşta değil.
// 300 ms: hızlı yazan biri harfler arasında ~150–250 ms durur (istek atılmaz), sonuç yine "anında" hissedilir.
// Eskiden ekrandan ekrana 280 / 350 / 380 / 450 / 500 ms dağınıktı.
//
// Kullananlar: film / dizi / kişi araması (screens/search/*), arkadaş araması (SearchFriendsScreen), paylaşım
// penceresi içerik araması, liste ekleme araması, sohbet medya araması, Top 100, Film Kulübü, dört favori, turnuva
// adayı, tier list ekleme, Günün Karesi. Yalnız cihazdaki listeyi süzen kutular (arkadaş listesi, notlar, sohbetler)
// gecikmesiz kalır: ağ isteği yok, süzme anında.
//
// Eski yanıtın yenisini ezmemesi ayrı iş: her arama kendi sıra numarasıyla (reqId) bayat yanıtı atar.

export const SEARCH_DEBOUNCE_MS = 300;

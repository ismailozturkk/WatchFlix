"use strict";

// functions/rtdbInstance.js
//
// Uygulamanın kullandığı Realtime Database örneği.
//
// Projede İKİ örnek var:
//   • movieandtv-2832a (europe-west1)      ← istemci buraya yazar (EXPO_PUBLIC_FIREBASE_DATABASE_URL)
//   • movieandtv-2832a-default-rtdb         ← projenin varsayılanı, BOŞ
// Admin SDK'nın `getDatabase()`'i varsayılanı (boş olanı) açar. 10 Kas 2026'ya kadar
// sunucu oraya bakıyordu: "alıcı bu sohbeti ekranda tutuyor mu" kontrolü hep false
// dönüyor (açık sohbetin push'u hiç susmuyordu) ve hesap silme, kullanıcının
// bağlantı kaydını / sohbet bayraklarını gerçek veritabanından silmiyordu.
//
// Adres gizli değil (istemci paketinde de var). Değişirse istemcinin .env'i ve
// firebase.json'daki `database` örnek listesi de birlikte değişmeli.
const APP_DATABASE_URL = "https://movieandtv-2832a.europe-west1.firebasedatabase.app";

module.exports = { APP_DATABASE_URL };

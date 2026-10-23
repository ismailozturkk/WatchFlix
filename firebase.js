import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  } from "firebase/auth";
import { mmkvAuthPersistence } from "./services/storage/authPersistence";
import {
  initializeFirestore,
  memoryLocalCache,
  memoryLruGarbageCollector,
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "movieandtv-2832a.firebaseapp.com",
  // Realtime Database — ephemeral sinyaller (presence/typing/inChat) için.
  // Console'da RTDB instance'ı oluşturulduktan sonra verilen URL .env'e konur.
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: "movieandtv-2832a",
  storageBucket: "movieandtv-2832a.firebasestorage.app",
  messagingSenderId: "427087836931",
  appId: "1:427087836931:web:dbfa3ca10b4d725fe91b36",
  measurementId: "G-ML19ZRGCE4",
};

const app = initializeApp(firebaseConfig);

// App Check: Firestore/Functions istekleri Play Integrity token'ı taşısın.
// Auth/Firestore handle'ları oluşmadan ÖNCE kurulmalı; native modül yoksa
// sessiz no-op (bkz. services/appCheck.js).
// eslint-disable-next-line global-require
require("./services/appCheck").initAppCheck(app);

// Oturum kalıcılığı MMKV'de. Köprü, MMKV'de bulamadığı anahtarı AsyncStorage'da
// arayıp oraya taşıyor — bu sayede güncellemeyi alan mevcut kullanıcılar
// çıkışa düşmüyor (bkz. services/storage/authPersistence.js).
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(mmkvAuthPersistence),
});

// Firestore önbelleği: BELLEKTE, LRU. React Native'de disk kalıcılığı yok (JS
// SDK'sı IndexedDB ister). Varsayılan "eager" bellek önbelleği, dinleyici
// kapanınca belgeleri ve sorgunun devam token'ını hemen atıyordu: bir sohbete
// (ya da herhangi bir ekrana) dönünce sorgu sıfırdan, sunucu beklenerek
// okunuyordu. LRU önbellek bunları oturum boyunca tutar:
//   • yeniden açılan sorgu önce önbellekten ANINDA çizilir, sonra sunucu
//     tazeler (emülatörde ölçüldü: 30 mesajlık sayfa 8 ms, sunucu ~30 ms);
//   • SDK yeniden dinlerken devam token'ını gönderir — Firestore 30 dk içindeki
//     yeniden bağlanmayı yeni sorgu gibi faturalamaz, yalnız değişenler okunur
//     (emülatör bunu uygulamadığından gerçek etki kullanım panelinden izlenmeli).
// Süreç kapanınca önbellek gider; cihaza veri YAZILMAZ. Üst sınır aşılınca en
// az kullanılan sorgular atılır. Sınırı değiştirirken __tests__/firebaseCache.test.js.
const FIRESTORE_MEMORY_CACHE_BYTES = 20 * 1024 * 1024;
const db = initializeFirestore(app, {
  localCache: memoryLocalCache({
    garbageCollector: memoryLruGarbageCollector({
      cacheSizeBytes: FIRESTORE_MEMORY_CACHE_BYTES,
    }),
  }),
});

// Cloud Functions (callable) — Gemini proxy `callGemini` buradan çağrılır.
// Bölge: functions varsayılanı (us-central1); sunucu tarafı bölge değişirse
// getFunctions(app, "region") ile eşitlenmeli.
const fns = getFunctions(app);

// Realtime Database handle. databaseURL tanımlı değilse (env eksik) getDatabase
// throw eder ve TÜM uygulamayı çökertir — bu yüzden guard'la. rtdb null ise
// presence/chat servisleri sessizce no-op olur (uygulama normal çalışır).
let rtdb = null;
try {
  rtdb = getDatabase(app);
} catch (e) {
  console.warn(
    "Realtime Database başlatılamadı (EXPO_PUBLIC_FIREBASE_DATABASE_URL eksik?). " +
      "Presence/typing devre dışı.",
    e?.message,
  );
}

export { auth, db, rtdb, fns };

import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
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

// Firebase Auth'un zaten başlatılıp başlatılmadığını kontrol edin
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

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

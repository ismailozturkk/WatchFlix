import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyDoooqZO4XPh8ExhpHsDap9GCW8jyGKvuI",
  authDomain: "movieandtv-2832a.firebaseapp.com",
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

export { auth, db };

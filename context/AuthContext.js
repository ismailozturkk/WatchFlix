import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase"; // Firebase bağlantını ekle
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("LoginScreen");
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setInitialRoute("TabScreen");
        setUser(user);
        setLoading(false);
        AsyncStorage.setItem("cachedUserId", user.uid).catch(() => {});
      } else {
        // İlk açılışta (onboarding görülmediyse) tanıtım akışına, sonrasında
        // doğrudan giriş ekranına yönlendir.
        let seenOnboarding = null;
        try {
          seenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
        } catch (e) {
          // okunamazsa güvenli varsayılan: giriş ekranı
        }
        // ⚠️ GELİŞTİRME MODU: onboarding'i her açılışta göster.
        // Üretim için bu satırı sil ve alttaki satırı aç:
        const FORCE_ONBOARDING_DEV = true;
        // setInitialRoute(seenOnboarding ? "LoginScreen" : "OnboardingScreen");
        setInitialRoute(
          FORCE_ONBOARDING_DEV || !seenOnboarding
            ? "OnboardingScreen"
            : "LoginScreen",
        );
        setUser(null);
        setLoading(false);
        AsyncStorage.removeItem("cachedUserId").catch(() => {});
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, initialRoute }}>
      {children}
    </AuthContext.Provider>
  );
};

// Kullanımı kolaylaştıran özel hook
export const useAuth = () => useContext(AuthContext);

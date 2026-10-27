// components/premium/PremiumTopBannerLayout.js
//
// Kök stack'in `screenLayout`'u (App.js): her ekranı sarar ve Free kullanıcıda ekranın
// en üstünde YÜZEN "Premium'a geç" şeridini (PremiumTopBanner) çizer. Kurallar
// utils/premiumTopBanner.js'de; Premium olunca şerit kalkar.
//
// Neden ekran başına (kökte tek şerit değil): şerit ekranla birlikte kayar, tam ekran
// modal sunumlarında da kendi ekranının tepesinde kalır, gizlenecek rotalar tek yerde
// seçilir — 100+ ekrana tek tek dokunulmaz.
//
// Yüzen yerleşim (kullanıcı kararı, 28 Eki): ekran gövdesi pencerenin tepesinden başlar,
// şerit durum çubuğunun hemen altına bindirilir, kaydırılan içerik altından geçer. İçerik
// şeridin altında kalmasın diye gövdeye `useSafeAreaInsets().top` şeridin taştığı kadar
// büyütülmüş verilir. Bağlamı okumayan yerler (yerel SafeAreaView, Modal, sabit boşluk)
// için: context/ScreenInsetsContext.
//
// Ağaç şekli şerit olsa da olmasa da AYNIDIR (yalnız değerler değişir): plan yüklenince
// ya da Premium alınınca ekran yeniden kurulmasın, durumu (kaydırma, form) kaybolmasın.

import React, { useMemo } from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { usePremium } from "../../context/PremiumContext";
import {
  PremiumBannerOverlapContext,
  WindowInsetsContext,
} from "../../context/ScreenInsetsContext";
import {
  PREMIUM_TOP_BANNER_GAP_TOP,
  premiumTopBannerOverlap,
  shouldShowPremiumTopBanner,
} from "@utils/premiumTopBanner";
import PremiumTopBanner from "./PremiumTopBanner";

export default function PremiumTopBannerLayout({ routeName, children }) {
  const insets = useSafeAreaInsets();
  const { user, needsProfileCompletion } = useAuth() || {};
  const { plan, loading } = usePremium();
  const visible = shouldShowPremiumTopBanner({
    plan,
    routeName,
    signedIn: Boolean(user?.uid && !needsProfileCompletion),
    loading,
  });

  // Durum çubuğunun alt kenarı. Android'de güvenli alan bazen durum çubuğundan kısa
  // raporlanıyor (şerit bildirim çubuğunun altına giriyordu); ikisinin büyüğü alınır.
  const statusTop =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight || 0)
      : insets.top;
  const overlap = visible ? premiumTopBannerOverlap(insets.top, statusTop) : 0;

  const bodyInsets = useMemo(
    () => (overlap ? { ...insets, top: insets.top + overlap } : insets),
    [overlap, insets],
  );

  return (
    <View style={styles.root}>
      <WindowInsetsContext.Provider value={insets}>
        <PremiumBannerOverlapContext.Provider value={overlap}>
          <SafeAreaInsetsContext.Provider value={bodyInsets}>
            <View style={styles.body}>{children}</View>
          </SafeAreaInsetsContext.Provider>
        </PremiumBannerOverlapContext.Provider>
      </WindowInsetsContext.Provider>
      {/* Gövdeden SONRA: çizim sırasında üstte kalır. box-none: şeridin yanındaki boşluk
          alttaki ekrana dokunuşu geçirir. */}
      {visible ? (
        <View
          pointerEvents="box-none"
          style={[styles.bannerWrap, { paddingTop: statusTop + PREMIUM_TOP_BANNER_GAP_TOP }]}
        >
          <PremiumTopBanner />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bannerWrap: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    zIndex: 20,
    elevation: 20,
  },
  body: { flex: 1 },
});

// components/profile/ProfileLogoutButton.js
//
// Profil sayfasının EN ALTINDAKİ "Çıkış Yap" düğmesi + onay sayfası. Eskiden
// Ayarlar'ın sonundaydı; çıkış hesaba ait bir eylem olduğu için Profil'e taşındı.
//
// Çıkıştan ÖNCE buluta gitmemiş notları/hatırlatıcıları göndermeyi dener:
// çıkıştan sonra yetkisiz kalınır. En çok 4 sn bekler; çevrimdışıysa vazgeçer —
// değişiklikler yazma günlüğünde durur ve aynı hesapla tekrar girişte gider
// (çıkışı asla kilitlemez).

import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getAuth } from "firebase/auth";
import ConfirmSheet from "@components/common/ConfirmSheet";
import GlassPillButton from "@components/common/GlassPillButton";
import { appAlert } from "@components/AppAlert";
import { useLanguage } from "../../context/LanguageContext";
import { flushUserData } from "../../services/userData";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

export default function ProfileLogoutButton({ navigation, theme }) {
  const { t } = useLanguage();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const label = t.logout || "Çıkış Yap";
  const danger = theme.colors.red;

  const handleSignOut = useCallback(async () => {
    try {
      const auth = getAuth();
      if (auth.currentUser?.uid) {
        await flushUserData(auth.currentUser.uid, { timeoutMs: 4000 }).catch(() => {});
      }
      await auth.signOut();
      // Kök yığının navigation'ı (TabScreenNavigator'dan gelir).
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (error) {
      appAlert(
        i18nText("autoI18n.hata", "Hata"),
        error?.message || i18nText("autoI18n.hata_olustu", "Hata oluştu"),
        undefined,
        { type: "error" },
      );
    }
  }, [navigation]);

  return (
    <View style={styles.wrap}>
      <GlassPillButton
        label={label}
        icon="log-out-outline"
        color={danger}
        tint={alpha(danger, 0.18)}
        height={48}
        fallbackRadius={24}
        fallbackStyle={{
          backgroundColor: alpha(danger, 0.12),
          borderColor: alpha(danger, 0.35),
          borderWidth: 1,
        }}
        onPress={() => setConfirmVisible(true)}
      />
      <ConfirmSheet
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={() => {
          setConfirmVisible(false);
          handleSignOut();
        }}
        icon="log-out-outline"
        tone="danger"
        title={label}
        message={
          t.profileScreen?.logoutMessage ||
          i18nText(
            "autoI18n.cikis_onay_mesaj",
            "Hesabından çıkış yapmak istediğine emin misin?",
          )
        }
        confirmLabel={label}
        cancelLabel={t.cancel || "İptal"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    paddingHorizontal: 16,
    marginTop: 18,
  },
});

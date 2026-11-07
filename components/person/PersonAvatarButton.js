// components/person/PersonAvatarButton.js
//
// Oyuncu / yönetmen sayfasında (screens/actor/ActorViewScreen.js, "Takip et"
// hapının yanında) "Avatarım yap": kişinin TMDB fotoğrafını profil avatarı
// yapar. Seçicideki "Oyuncu & Yönetmen" sekmesiyle AYNI yol:
// personAvatarChoice → ProfileUiContext.selectAvatar → userService.setAvatarIndex.
//
// ONAY: avatar günde bir kez değişebiliyor (utils/profileIdentityCooldown);
// yanlışlıkla dokunuş o hakkı yakmasın diye önce ConfirmSheet sorar.
// Kişi zaten avatarsa hap "Avatarın" der ve dokunulmaz. Fotoğrafı olmayan /
// yetişkin işaretli kişide hiç çizilmez.
//
// HERO ÜSTÜ: yazı her zaman beyaz (FollowPersonButton ile aynı kural).
import React, { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { toast } from "../AppToast";
import { useTheme } from "../../context/ThemeContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import { triggerHaptic } from "../../services/hapticsService";
import { personAvatarChoice, sameAvatarChoice } from "../../utils/avatarPhotos";
import { i18nText } from "../../utils/i18nText";
import GlassPressable from "../common/GlassPressable";
import ConfirmSheet from "../common/ConfirmSheet";

function PersonAvatarButton({ person, style }) {
  const { theme } = useTheme();
  const { myAvatar, selectAvatar, isloadingAvatar } = useProfileUi() || {};
  const [confirming, setConfirming] = useState(false);

  const choice = useMemo(() => personAvatarChoice(person), [person]);
  const isMine = !!choice && sameAvatarChoice(choice, myAvatar);

  const confirm = useCallback(async () => {
    if (!choice || !selectAvatar) return;
    try {
      const saved = await selectAvatar(choice);
      setConfirming(false);
      if (saved) {
        triggerHaptic("success");
        toast.success(i18nText("autoI18n.avatar_guncellendi", "Avatar güncellendi"));
      }
    } catch {
      // selectAvatar hatayı kendisi gösteriyor; sayfa açık kalsın, tekrar denenebilir.
    }
  }, [choice, selectAvatar]);

  if (!choice || !selectAvatar) return null;

  return (
    <>
      <GlassPressable
        onPress={() => setConfirming(true)}
        disabled={isMine}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: isMine, disabled: isMine }}
        accessibilityLabel={
          isMine
            ? i18nText("autoI18n.avatar_su_an", "Avatarın")
            : i18nText("autoI18n.avatar_yap", "Avatarım yap")
        }
        style={({ pressed }) => [
          styles.pill,
          isMine ? { backgroundColor: theme.accent, borderColor: theme.accent } : styles.pillIdle,
          pressed && styles.pressed,
          style,
        ]}
      >
        <Ionicons name={isMine ? "person-circle" : "person-circle-outline"} size={16} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>
          {isMine
            ? i18nText("autoI18n.avatar_su_an", "Avatarın")
            : i18nText("autoI18n.avatar_yap", "Avatarım yap")}
        </Text>
      </GlassPressable>

      <ConfirmSheet
        visible={confirming}
        onClose={() => !isloadingAvatar && setConfirming(false)}
        onConfirm={confirm}
        busy={!!isloadingAvatar}
        tone="accent"
        icon="person-circle-outline"
        title={i18nText("autoI18n.avatar_yap_soru_baslik", "Avatarın olsun mu?")}
        message={i18nText(
          "autoI18n.avatar_yap_soru",
          "{{name}} fotoğrafı profil avatarın olacak. Avatarını günde bir kez değiştirebilirsin.",
          { name: choice.photoPerson.name },
        )}
        confirmLabel={i18nText("autoI18n.avatar_yap_onay", "Avatar yap")}
        cancelLabel={i18nText("autoI18n.vazgec", "Vazgeç")}
      />
    </>
  );
}

export default memo(PersonAvatarButton);

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillIdle: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.35)" },
  pressed: { opacity: 0.8 },
  label: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
